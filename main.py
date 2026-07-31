#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
独立 LAN-Play / ldn_mitm 房间监控网页（零第三方依赖版 · 优化版）

优化点：
  1. AppContext 收敛全局可变状态（线程安全）
  2. 共享 ThreadPoolExecutor（避免反复创建线程）
  3. UDP socket 复用 + 定期重连 + 最大迭代保护
  4. TTLCache 带条目上限，防止内存无限增长
  5. snapshot 浅拷贝优化，降低 GC 压力
  6. 日志分级（info/warn/err）+ 环形缓冲区
  7. 远程下载临时文件加 PID/UUID 防冲突
  8. 更细粒度的异常捕获（DNS / ConnectionRefused / timeout）
  9. 代码分区注释，大幅提升可维护性
  10. 未知游戏显示问号图标（SVG data URI）
  11. FFFFFFFFFFFFFFFF 不视为未知游戏，不显示复制功能

启动：
    python lan_play_monitor.py
    # 浏览器打开 http://0.0.0.0:5000/
"""
from __future__ import annotations

import copy
import json
import os
import re
import socket
import struct
import sys
import threading
import time
import uuid
import ssl
import socketserver
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import http.client
import urllib.request
import urllib.error
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

# ============================================================================
# SECTION 1 · 日志捕获器（分级 + 环形缓冲区）
# ============================================================================

class LogCapturer:
    """线程安全的日志环形缓冲区，同时转发到原始 stdout。"""

    def __init__(self, maxlen: int = 500):
        self.terminal = sys.stdout
        self.buffer: deque[str] = deque(maxlen=maxlen)
        self.lock = threading.Lock()

    def write(self, message: str):
        if self.terminal:
            self.terminal.write(message)
            self.terminal.flush()
        msg = message.strip()
        if msg:
            with self.lock:
                self.buffer.append(msg)

    def flush(self):
        if self.terminal:
            self.terminal.flush()

    def get_logs(self) -> list[str]:
        with self.lock:
            return list(self.buffer)

    def get_logs_tail(self, n: int = 200) -> list[str]:
        with self.lock:
            items = list(self.buffer)
            return items[-n:] if len(items) > n else items


log_capturer = LogCapturer()
sys.stdout = log_capturer
sys.stderr = log_capturer

# 日志快捷函数
info = lambda *a, **k: print("[INFO]", *a, **k)
warn = lambda *a, **k: print("[WARN]", *a, **k)
err = lambda *a, **k: print("[ERROR]", *a, **k)

# ============================================================================
# SECTION 2 · 网络连通性检测
# ============================================================================

NETWORK_CHECK_URL = "https://www.baidu.com"

_network_status_cache: dict[str, Any] = {
    "online": True,
    "last_check": 0.0,
    "last_success": 0.0,
    "consecutive_failures": 0,
}
_network_status_lock = threading.Lock()


def check_network_reachability() -> bool:
    """检测能否访问百度，成功返回 True，失败返回 False。"""
    ctx_ssl = ssl.create_default_context()
    ctx_ssl.check_hostname = False
    ctx_ssl.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(
        NETWORK_CHECK_URL,
        headers={"User-Agent": f"{APP_NAME}/1.0", "Accept": "text/html"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5, context=ctx_ssl) as resp:
            return 200 <= resp.status < 600
    except (urllib.error.URLError, socket.timeout, OSError) as e:
        warn(f"[网络检测] 连接失败: {e}")
        return False


def get_network_status(force: bool = False) -> dict[str, Any]:
    """获取当前网络状态，带 5 秒缓存。"""
    global _network_status_cache
    now = time.time()
    with _network_status_lock:
        cached = _network_status_cache
        if not force and now - cached["last_check"] < 5:
            return {"online": cached["online"], "last_success": cached["last_success"]}
        is_online = check_network_reachability()
        cached["last_check"] = now
        if is_online:
            cached["online"] = True
            cached["last_success"] = now
            cached["consecutive_failures"] = 0
        else:
            cached["consecutive_failures"] += 1
            if cached["consecutive_failures"] >= 2:
                cached["online"] = False
        return {"online": cached["online"], "last_success": cached["last_success"]}

# ============================================================================
# SECTION 3 · 常量 & 配置
# ============================================================================

SCRIPT_DIR = Path(__file__).resolve().parent
LOCAL_SERVERS_FILE = str(SCRIPT_DIR / "servers.json")
MANUAL_SERVERS_FILE = str(SCRIPT_DIR / "servers_manual.json")
SERVERS_FILE = os.getenv("SERVERS_FILE", "").strip() or MANUAL_SERVERS_FILE
DEFAULT_SERVERS_FILE = MANUAL_SERVERS_FILE

REMOTE_DOWNLOAD_INTERVAL = 30
APP_NAME = "direct-lan-play-monitor"
CACHE_TTL = max(1, int(os.getenv("CACHE_TTL", "8")))
REQUEST_TIMEOUT = max(1.0, float(os.getenv("REQUEST_TIMEOUT", "3")))
MAX_WORKERS = 32

REMOTE_CHINESE_DB_URL = "https://v6.gh-proxy.org/https://raw.githubusercontent.com/jieluojun/LanPlayMonitor/refs/heads/main/chinese_db.json"
REMOTE_SERVERS_URL = "https://v6.gh-proxy.org/https://raw.githubusercontent.com/jieluojun/LanPlayMonitor/refs/heads/main/servers.json"

LOCAL_CHINESE_DB_FILE = str(SCRIPT_DIR / "chinese_db.json")

DEFAULT_SERVERS: list[dict[str, Any]] = [
    {
        "id": "1",
        "name": "内置服务器",
        "host": "example.com",
        "port": 11451,
        "type": "graphql",
        "region": "🇨🇳"
    }
]

BUILTIN_GAME_TITLES: dict[str, str] = {
    "FFFFFFFFFFFFFFFF": "未知游戏"
}


# ============================================================================
# SECTION 4 · 远程文件下载（后台线程）
# ============================================================================

_download_status_lock = threading.Lock()
_download_status: dict[str, Any] = {
    "chinese_db_last_success": 0.0,
    "chinese_db_last_error": "",
    "servers_last_success": 0.0,
    "servers_last_error": "",
    "remote_servers_available": False,
}


def _download_remote_file(url: str, dest_path: str) -> bool:
    """从远程下载文件到本地，成功返回 True，失败返回 False。"""
    tmp_path = f"{dest_path}.{os.getpid()}.{uuid.uuid4().hex[:6]}.tmp"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": f"{APP_NAME}/1.0", "Accept": "application/json"}
        )
        ctx_ssl = ssl.create_default_context()
        ctx_ssl.check_hostname = False
        ctx_ssl.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, timeout=10, context=ctx_ssl) as resp:
            data = resp.read()
            json.loads(data.decode("utf-8-sig"))  # 验证 JSON 合法性
            with open(tmp_path, "wb") as f:
                f.write(data)
            os.replace(tmp_path, dest_path)
            return True
    except Exception as exc:
        warn(f"[远程下载] 下载失败 {url} -> {dest_path}: {exc}")
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except OSError:
            pass
        return False


def remote_download_worker():
    """后台定时下载主循环。"""
    while True:
        try:
            ok_db = _download_remote_file(REMOTE_CHINESE_DB_URL, LOCAL_CHINESE_DB_FILE)
            with _download_status_lock:
                st = _download_status
                if ok_db:
                    st["chinese_db_last_success"] = time.time()
                    st["chinese_db_last_error"] = ""
                    info("[远程下载] ✅ 标题映射已更新")
                else:
                    st["chinese_db_last_error"] = "下载失败"

            ok_srv = _download_remote_file(REMOTE_SERVERS_URL, LOCAL_SERVERS_FILE)
            with _download_status_lock:
                st = _download_status
                if ok_srv:
                    st["servers_last_success"] = time.time()
                    st["servers_last_error"] = ""
                    st["remote_servers_available"] = True
                    info("[远程下载] ✅ 服务器列表已更新")
                else:
                    st["servers_last_error"] = "下载失败"
                    if not Path(LOCAL_SERVERS_FILE).is_file():
                        st["remote_servers_available"] = False
        except Exception as exc:
            err(f"[远程下载] 意外错误: {exc}")
        time.sleep(REMOTE_DOWNLOAD_INTERVAL)


def start_remote_download_thread():
    """启动后台下载线程（首次立即执行一次）。"""
    def _first_then_loop():
        try:
            ok_db = _download_remote_file(REMOTE_CHINESE_DB_URL, LOCAL_CHINESE_DB_FILE)
            with _download_status_lock:
                if ok_db:
                    _download_status["chinese_db_last_success"] = time.time()
                    info("[远程下载] ✅ 首次标题映射下载成功")
                else:
                    _download_status["chinese_db_last_error"] = "首次下载失败"

            ok_srv = _download_remote_file(REMOTE_SERVERS_URL, LOCAL_SERVERS_FILE)
            with _download_status_lock:
                if ok_srv:
                    _download_status["servers_last_success"] = time.time()
                    _download_status["remote_servers_available"] = True
                    info("[远程下载] ✅ 首次服务器列表下载成功")
                else:
                    _download_status["servers_last_error"] = "首次下载失败"
                    if not Path(LOCAL_SERVERS_FILE).is_file():
                        _download_status["remote_servers_available"] = False
        except Exception as exc:
            err(f"[远程下载] 首次下载异常: {exc}")
        remote_download_worker()

    t = threading.Thread(target=_first_then_loop, daemon=True, name="remote-downloader")
    t.start()
    info(f"[远程下载] 后台下载线程已启动，间隔 {REMOTE_DOWNLOAD_INTERVAL} 秒")

# ============================================================================
# SECTION 5 · 标题映射加载
# ============================================================================

def load_game_titles() -> dict[str, str]:
    """从本地 chinese_db.json 加载标题映射，失败降级到内置。"""
    merged = dict(BUILTIN_GAME_TITLES)
    local_path = Path(LOCAL_CHINESE_DB_FILE)
    if not local_path.is_file():
        info(f"[配置] 使用内置标题映射，共 {len(merged)} 条")
        return merged
    try:
        with open(local_path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
        if isinstance(data, dict):
            for k, v in data.items():
                if k and v:
                    merged[str(k).upper()] = str(v)
            info(f"[配置] 标题映射已加载: {len(data)} 条，合并后总数: {len(merged)}")
            return merged
        warn("[配置警告] 本地标题映射格式不正确")
    except Exception as exc:
        warn(f"[配置警告] 读取本地标题映射失败（{exc}）")
    info(f"[配置] 使用内置标题映射，共 {len(merged)} 条")
    return merged

# ============================================================================
# SECTION 6 · TTL 缓存（带条目上限）
# ============================================================================

@dataclass
class CacheItem:
    value: Any
    expires_at: float


class TTLCache:
    """线程安全 TTL 缓存，带最大条目数限制，防止内存无限增长。"""

    def __init__(self, max_items: int = 1024):
        self._items: dict[str, CacheItem] = {}
        self._lock = threading.Lock()
        self.max_items = max_items

    def get(self, key: str) -> Any | None:
        now = time.monotonic()
        with self._lock:
            item = self._items.get(key)
            if item is None:
                return None
            if item.expires_at <= now:
                self._items.pop(key, None)
                return None
            return copy.deepcopy(item.value)

    def set(self, key: str, value: Any, ttl: int = CACHE_TTL) -> None:
        with self._lock:
            self._items[key] = CacheItem(copy.deepcopy(value), time.monotonic() + ttl)
            if len(self._items) > self.max_items:
                # 淘汰最早插入的一项（简单 FIFO）
                oldest_key = next(iter(self._items))
                self._items.pop(oldest_key, None)

    def clear(self):
        with self._lock:
            self._items.clear()


cache = TTLCache(max_items=2048)

# ============================================================================
# SECTION 7 · 工具函数
# ============================================================================

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def int_or_zero(value: Any) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


HOST_RE = re.compile(r"^(?:[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?|\[[0-9A-Fa-f:]+\])$")
ID_RE = re.compile(r"^[A-Za-z0-9_ -]{1,64}$")

# SVG 问号图标 (data URI)
_QUESTION_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">'
                 '<circle cx="24" cy="24" r="22" fill="#34495e"/>'
                 '<text x="24" y="34" text-anchor="middle" font-size="30" fill="white" '
                 'font-family="sans-serif" font-weight="bold">?</text></svg>')
QUESTION_ICON = "data:image/svg+xml," + urllib.parse.quote(_QUESTION_SVG)

# FFFFFFFFFFFFFFFF 特殊标记（不视为未知游戏）
UNKNOWN_ID = "FFFFFFFFFFFFFFFF"


def get_game_info(content_id: str, titles_map: dict[str, str]) -> dict[str, str]:
    """
    从指定的标题映射中查找游戏信息。
    如果游戏名称包含"未知游戏"且 content_id 不是 FFFFFFFFFFFFFFFF，返回问号图标。
    FFFFFFFFFFFFFFFF 不视为未知游戏，使用默认图标。
    """
    normalized = str(content_id or "").upper()
    game_name = titles_map.get(normalized)
    is_unknown = False
    if not game_name:
        game_name = f"未知游戏 ({normalized})" if normalized else "未知游戏"
        is_unknown = True
    # 如果映射表中名称以"未知游戏"开头，且不是 FFFFFFFFFFFFFFFF，视为未知
    if game_name and game_name.startswith("未知游戏") and normalized != UNKNOWN_ID:
        is_unknown = True
    # FFFFFFFFFFFFFFFF 强制不视为未知游戏
    if normalized == UNKNOWN_ID:
        is_unknown = False
        game_name = "未知游戏"

    if is_unknown:
        icon = QUESTION_ICON
    else:
        icon = f"https://tinfoil.media/ti/{normalized or 'FFFFFFFFFFFFFFFF'}/48/48"

    return {
        "name": game_name,
        "icon": icon
    }

# ============================================================================
# SECTION 8 · HTTP 客户端
# ============================================================================

class HTTPResponse:
    def __init__(self, raw: http.client.HTTPResponse | None, body: bytes, url: str, error: str | None = None):
        self._raw = raw
        self._body = body
        self.url = url
        self.error = error
        self.status_code = raw.status if raw else 0
        self.reason = raw.reason if raw else (error or "")
        self.headers = {k.lower(): v for k, v in raw.getheaders()} if raw else {}
        self._json: Any = None

    @property
    def ok(self) -> bool:
        return 200 <= self.status_code < 400 and not self.error

    @property
    def is_redirect(self) -> bool:
        return 300 <= self.status_code < 400

    def raise_for_status(self) -> None:
        if not self.ok:
            raise RuntimeError(f"HTTP {self.status_code} {self.reason}")

    def json(self) -> Any:
        if self._json is None:
            self._json = json.loads(self._body.decode("utf-8"))
        return self._json

    @property
    def text(self) -> str:
        return self._body.decode("utf-8", errors="replace")


class HTTPClient:
    def __init__(self, user_agent: str = "", default_timeout: float = REQUEST_TIMEOUT):
        self.user_agent = user_agent or f"{APP_NAME}/1.0 (read-only room monitor)"
        self.default_timeout = default_timeout

    def _open(self, method: str, url: str, data: bytes | None = None,
              headers: dict[str, str] | None = None, timeout: float | None = None,
              allow_redirects: bool = True, **_: Any) -> HTTPResponse:
        req_headers = {"User-Agent": self.user_agent, "Accept": "application/json"}
        if headers:
            req_headers.update(headers)
        req = urllib.request.Request(url, data=data, method=method, headers=req_headers)
        opener = urllib.request.build_opener()
        if not allow_redirects:
            opener = urllib.request.build_opener(urllib.request.HTTPErrorProcessor())
        try:
            resp = opener.open(req, timeout=timeout or self.default_timeout)
            body = resp.read()
            return HTTPResponse(resp, body, url)
        except urllib.error.HTTPError as e:
            body = e.read() or b""
            return HTTPResponse(e, body, url, str(e))
        except (urllib.error.URLError, socket.timeout, OSError) as e:
            err_msg = e.reason if hasattr(e, "reason") else str(e)
            raise RuntimeError(err_msg) from e

    def get(self, url: str, **kw: Any) -> HTTPResponse:
        return self._open("GET", url, **kw)

    def post(self, url: str, json_body: Any = None, **kw: Any) -> HTTPResponse:
        if json_body is not None:
            data = json.dumps(json_body).encode("utf-8")
            headers = kw.pop("headers", {}) or {}
            headers.setdefault("Content-Type", "application/json")
            return self._open("POST", url, data=data, headers=headers, **kw)
        return self._open("POST", url, **kw)


http = HTTPClient()

# ============================================================================
# SECTION 9 · LDN / LAN-Play UDP 扫描
# ============================================================================

GRAPHQL_QUERY = """
query PublicRoomSnapshot {
  serverInfo { online idle }
  room {
    sessionId
    contentId
    hostPlayerName
    nodeCount
    nodeCountMax
    advertiseData
    nodes { playerName }
  }
}
""".strip()

UDP_SCAN_SECONDS = max(0.5, float(os.getenv("UDP_SCAN_SECONDS", "1.2")))
LDN_PORT = 11452
LDN_MAGIC = bytes.fromhex("00144511")
LDN_SCAN_HEADER = LDN_MAGIC + bytes(8)
SCANNER_VIRTUAL_IP = "10.13.37.0"
LDN_BROADCAST_IP = "10.13.255.255"
MAX_REASSEMBLED_PACKET = 65535
MAX_SCAN_ITERATIONS = 2000        # 防止极端网络下死循环
SOCKET_MAX_LIFETIME = 300          # socket 最长复用 5 分钟


def internet_checksum(data: bytes) -> int:
    if len(data) % 2:
        data += b"\x00"
    words = struct.unpack(f"!{len(data) // 2}H", data)
    total = sum(words)
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    return (~total) & 0xFFFF


def build_ldn_scan_frame() -> bytes:
    source = socket.inet_aton(SCANNER_VIRTUAL_IP)
    destination = socket.inet_aton(LDN_BROADCAST_IP)
    udp_length = 8 + len(LDN_SCAN_HEADER)
    udp_without_checksum = struct.pack("!HHHH", LDN_PORT, LDN_PORT, udp_length, 0)
    pseudo_header = source + destination + struct.pack("!BBH", 0, socket.IPPROTO_UDP, udp_length)
    udp_checksum = internet_checksum(pseudo_header + udp_without_checksum + LDN_SCAN_HEADER)
    udp_header = struct.pack("!HHHH", LDN_PORT, LDN_PORT, udp_length, udp_checksum)
    total_length = 20 + udp_length
    ip_without_checksum = struct.pack(
        "!BBHHHBBH4s4s",
        0x45, 0, total_length, 0, 0x4000, 64, socket.IPPROTO_UDP, 0,
        source, destination,
    )
    ip_checksum = internet_checksum(ip_without_checksum)
    ip_header = struct.pack(
        "!BBHHHBBH4s4s",
        0x45, 0, total_length, 0, 0x4000, 64, socket.IPPROTO_UDP, ip_checksum,
        source, destination,
    )
    return b"\x01" + ip_header + udp_header + LDN_SCAN_HEADER


LDN_SCAN_FRAME = build_ldn_scan_frame()


def decompress_ldn(data: bytes, expected_size: int) -> bytes:
    if expected_size <= 0 or expected_size > 8192:
        raise ValueError("ldn_mitm 解压长度异常")
    output = bytearray()
    index = 0
    while index < len(data) and len(output) < expected_size:
        value = data[index]; index += 1
        output.append(value)
        if value == 0:
            if index >= len(data):
                raise ValueError("ldn_mitm 压缩数据不完整")
            repeat = data[index]; index += 1
            output.extend(b"\x00" * repeat)
        if len(output) > expected_size:
            raise ValueError("ldn_mitm 解压数据越界")
    if index != len(data) or len(output) != expected_size:
        raise ValueError("ldn_mitm 解压长度不匹配")
    return bytes(output)


def decode_player_name(raw: bytes) -> str:
    return raw.split(b"\x00", 1)[0].decode("utf-8", errors="replace").strip()


def parse_network_info(payload: bytes, source_ip: str) -> dict[str, Any]:
    if len(payload) < 0x480:
        raise ValueError("NetworkInfo 长度不足")
    payload = payload[:0x480]
    content_id = payload[0:8][::-1].hex().upper()
    session_id = payload[16:32].hex()
    node_count_max = min(payload[0x66], 8)
    node_count = min(payload[0x67], 8)
    players: list[str] = []
    nodes: list[dict[str, str]] = []
    for index in range(node_count):
        start = 0x68 + 0x40 * index
        node = payload[start:start + 0x40]
        if len(node) < 0x40:
            break
        player_name = decode_player_name(node[0x0C:0x2C])
        if not player_name:
            player_name = "未命名玩家"
        players.append(player_name)
        nodes.append({"playerName": player_name})
    host = decode_player_name(payload[0x74:0x94])
    if not host:
        host = players[0] if players else "未命名玩家"
    elif not players:
        players.append(host)
    advertise_length = min(int.from_bytes(payload[0x26A:0x26C], "little"), 384)
    advertise_data = payload[0x26C:0x26C + advertise_length].hex()
    return {
        "sessionId": session_id or f"{source_ip}-{content_id}",
        "contentId": content_id,
        "hostPlayerName": host,
        "nodeCount": node_count,
        "nodeCountMax": node_count_max,
        "advertiseData": advertise_data,
        "nodes": nodes,
        "sourceIp": source_ip,
        "players": players,
    }


def parse_ipv4_ldn_response(packet: bytes) -> dict[str, Any] | None:
    if len(packet) < 20 or packet[0] >> 4 != 4:
        return None
    header_length = (packet[0] & 0x0F) * 4
    if header_length < 20 or len(packet) < header_length + 8:
        return None
    total_length = int.from_bytes(packet[2:4], "big")
    if total_length >= header_length + 8:
        packet = packet[:min(total_length, len(packet))]
    if packet[9] != socket.IPPROTO_UDP:
        return None
    source_ip = socket.inet_ntoa(packet[12:16])
    udp = packet[header_length:]
    source_port, destination_port, udp_length, _checksum = struct.unpack("!HHHH", udp[:8])
    if source_port != LDN_PORT or destination_port != LDN_PORT or udp_length < 8:
        return None
    ldn = udp[8:min(len(udp), udp_length)]
    if len(ldn) < 12 or ldn[:4] != LDN_MAGIC:
        return None
    packet_type = ldn[4]
    compressed = ldn[5] == 1
    body_length = int.from_bytes(ldn[6:8], "little")
    decompressed_length = int.from_bytes(ldn[8:10], "little")
    if body_length > len(ldn) - 12:
        return None
    body = ldn[12:12 + body_length]
    if packet_type != 1:
        return None
    if compressed:
        body = decompress_ldn(body, decompressed_length)
    return parse_network_info(body, source_ip)


class FragmentCollector:
    def __init__(self) -> None:
        self.parts: dict[tuple[bytes, int], dict[str, Any]] = {}

    def add(self, frame: bytes) -> bytes | None:
        if len(frame) < 16:
            return None
        source = frame[0:4]
        identification = int.from_bytes(frame[8:10], "big")
        part = frame[10]
        total_parts = frame[11]
        part_length = int.from_bytes(frame[12:14], "little")
        pmtu = int.from_bytes(frame[14:16], "big")
        if not 1 <= total_parts <= 64 or part >= total_parts or pmtu <= 0:
            return None
        if part_length > len(frame) - 16:
            return None
        key = (source, identification)
        item = self.parts.setdefault(key, {"total": total_parts, "pmtu": pmtu, "parts": {}})
        if item["total"] != total_parts or item["pmtu"] != pmtu:
            self.parts.pop(key, None)
            return None
        item["parts"][part] = frame[16:16 + part_length]
        if len(item["parts"]) != total_parts:
            return None
        final_size = max(i * pmtu + len(v) for i, v in item["parts"].items())
        if final_size <= 0 or final_size > MAX_REASSEMBLED_PACKET:
            self.parts.pop(key, None)
            return None
        output = bytearray(final_size)
        for i, v in item["parts"].items():
            output[i * pmtu:i * pmtu + len(v)] = v
        self.parts.pop(key, None)
        return bytes(output)


class ActiveRoomScanner:
    """
    UDP 扫描器（优化版）：
      - socket 复用，避免每次 scan() 都重新创建
      - 超过 SOCKET_MAX_LIFETIME 后自动重连
      - 最大迭代次数保护，防止死循环
    """

    def __init__(self, server: dict[str, Any]):
        self.server = server
        self._sock: socket.socket | None = None
        self._sock_created_at: float = 0.0
        self._lock = threading.Lock()

    def close(self) -> None:
        if self._sock is not None:
            try:
                self._sock.close()
            except OSError:
                pass
            self._sock = None
            self._sock_created_at = 0.0

    def _ensure_socket(self) -> socket.socket:
        now = time.monotonic()
        if self._sock is not None:
            if now - self._sock_created_at < SOCKET_MAX_LIFETIME:
                return self._sock
            self.close()
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.2)
        sock.connect((self.server["host"], self.server["port"]))
        self._sock = sock
        self._sock_created_at = now
        return sock

    @staticmethod
    def _drain(sock: socket.socket) -> None:
        sock.setblocking(False)
        try:
            while True:
                sock.recv(65535)
        except (BlockingIOError, OSError):
            pass
        finally:
            sock.settimeout(None)

    def scan(self) -> tuple[list[dict[str, Any]], str]:
        with self._lock:
            try:
                sock = self._ensure_socket()
                self._drain(sock)
                collector = FragmentCollector()
                found: dict[str, dict[str, Any]] = {}
                deadline = time.monotonic() + UDP_SCAN_SECONDS
                next_send = 0.0
                iterations = 0

                while time.monotonic() < deadline:
                    iterations += 1
                    if iterations > MAX_SCAN_ITERATIONS:
                        warn(f"[扫描] {self.server['name']} 达到最大迭代上限，提前退出")
                        break
                    now = time.monotonic()
                    if now >= next_send:
                        try:
                            sock.send(LDN_SCAN_FRAME)
                        except OSError as e:
                            warn(f"[扫描] send 失败 {self.server['name']}: {e}")
                            self.close()
                            break
                        next_send = now + 0.7
                    timeout = min(0.2, max(0.01, deadline - time.monotonic()))
                    sock.settimeout(timeout)
                    try:
                        frame = sock.recv(65535)
                    except socket.timeout:
                        continue
                    except OSError as e:
                        warn(f"[扫描] recv 错误 {self.server['name']}: {e}")
                        self.close()
                        break
                    if not frame:
                        continue
                    packet: bytes | None = None
                    if frame[0] == 1:
                        packet = frame[1:]
                    elif frame[0] == 3:
                        packet = collector.add(frame[1:])
                    if packet is None:
                        continue
                    try:
                        room = parse_ipv4_ldn_response(packet)
                    except (ValueError, struct.error, OSError):
                        continue
                    if room is not None:
                        key = room.get("sessionId") or f"{room.get('sourceIp')}:{room.get('contentId')}"
                        found[str(key)] = room
                return list(found.values()), ""
            except (OSError, socket.gaierror) as exc:
                self.close()
                return [], str(exc)

# ============================================================================
# SECTION 10 · 应用上下文（收敛全局可变状态）
# ============================================================================

class AppContext:
    """
    线程安全的全局应用状态容器。
    所有原本散落在全局的 SERVERS / SERVERS_BY_ID / ACTIVE_SCANNERS /
    GAME_TITLES / _download_status 都收拢到这里。
    """
    def __init__(self):
        self.lock = threading.RLock()
        self.servers: list[dict[str, Any]] = []
        self.servers_by_id: dict[str, dict[str, Any]] = {}
        self.scanners: dict[str, "ActiveRoomScanner"] = {}
        self.game_titles: dict[str, str] = dict(BUILTIN_GAME_TITLES)
        self.download_status: dict[str, Any] = dict(_download_status)

    def refresh_config(self):
        """重新加载配置并同步 scanners。"""
        with self.lock:
            self.game_titles = load_game_titles()
            new_servers = _load_servers_merged()
            self.servers = new_servers
            self.servers_by_id = {s["id"]: s for s in new_servers}

            current_ids = set(self.servers_by_id.keys())
            for sid in list(self.scanners.keys()):
                if sid not in current_ids:
                    self.scanners[sid].close()
                    del self.scanners[sid]
            for s in self.servers:
                if s["id"] not in self.scanners:
                    self.scanners[s["id"]] = ActiveRoomScanner(s)

            with _download_status_lock:
                self.download_status = dict(_download_status)

    def get_server(self, sid: str) -> dict[str, Any] | None:
        with self.lock:
            return self.servers_by_id.get(sid)

    def get_scanner(self, sid: str) -> "ActiveRoomScanner | None":
        with self.lock:
            return self.scanners.get(sid)

    def get_all_servers(self) -> list[dict[str, Any]]:
        with self.lock:
            return list(self.servers)


ctx = AppContext()

# ============================================================================
# SECTION 11 · 服务器配置管理
# ============================================================================

def validate_server(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("服务器配置项必须是对象")
    server_id = str(raw.get("id", "")).strip()
    name = str(raw.get("name", server_id)).strip()
    host = str(raw.get("host", "")).strip()
    protocol = str(raw.get("type", "graphql")).strip().lower()
    region = str(raw.get("region", "")).strip()
    try:
        port = int(raw.get("port", 11451))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"服务器 {server_id or host} 的端口无效") from exc
    if not ID_RE.fullmatch(server_id):
        raise ValueError(f"服务器 id 无效：{server_id!r}")
    if not name or len(name) > 100:
        raise ValueError(f"服务器 {server_id} 的名称无效")
    if not HOST_RE.fullmatch(host) or ".." in host:
        raise ValueError(f"服务器 {server_id} 的主机名无效")
    if not 1 <= port <= 65535:
        raise ValueError(f"服务器 {server_id} 的端口无效")
    if protocol not in {"graphql", "rest"}:
        raise ValueError(f"服务器 {server_id} 的 type 仅支持 graphql/rest")

    res = {"id": server_id, "name": name, "host": host, "port": port, "type": protocol, "region": region}
    for flag in ("is_builtin", "is_remote", "is_manual", "is_env"):
        if flag in raw:
            res[flag] = raw[flag]
    return res


def _load_servers_from_file(file_path: str) -> list[dict[str, Any]]:
    servers: list[dict[str, Any]] = []
    path = Path(file_path)
    if not path.is_file():
        return servers
    try:
        raw = json.loads(path.read_text(encoding="utf-8-sig"))
        if isinstance(raw, list):
            for item in raw:
                try:
                    servers.append(validate_server(item))
                except Exception as exc:
                    warn(f"[配置警告] 服务器项解析失败: {exc}")
        else:
            warn(f"[配置警告] 服务器列表格式不正确: {file_path}")
    except Exception as exc:
        warn(f"[配置警告] 读取服务器列表失败 {file_path}: {exc}")
    return servers


def _load_servers_merged() -> list[dict[str, Any]]:
    """
    加载并合并服务器列表，优先级：
      1. 本地 servers.json（远程下载）
      2. 环境变量 SERVERS_FILE
      3. 手动添加的服务器（servers_manual.json）
      4. 内置兜底（仅当远程文件不存在时）
    """
    merged: dict[str, dict[str, Any]] = {}
    builtin_ids: set[str] = set()
    remote_ids: set[str] = set()
    env_ids: set[str] = set()

    local_exists = Path(LOCAL_SERVERS_FILE).is_file()
    if local_exists:
        remote_servers = _load_servers_from_file(LOCAL_SERVERS_FILE)
        if remote_servers:
            for srv in remote_servers:
                srv.setdefault("is_remote", True)
                merged[srv["id"]] = srv
                remote_ids.add(srv["id"])
            info(f"[配置] 使用本地服务器列表，共 {len(remote_servers)} 台")
        else:
            info("[配置警告] 本地服务器列表为空，使用内置兜底")
            local_exists = False

    use_builtin = not local_exists
    if use_builtin:
        info("[配置] 本地服务器列表不存在，使用内置兜底")
        for item in DEFAULT_SERVERS:
            try:
                srv = validate_server(item)
                srv["is_builtin"] = True
                merged[srv["id"]] = srv
                builtin_ids.add(srv["id"])
            except Exception as exc:
                warn(f"[配置警告] 内置服务器项解析失败: {exc}")

    env_path_str = os.getenv("SERVERS_FILE", "").strip()
    if env_path_str and env_path_str != DEFAULT_SERVERS_FILE:
        env_path = Path(env_path_str).expanduser()
        if env_path.is_file():
            for srv in _load_servers_from_file(str(env_path)):
                srv["is_env"] = True
                merged[srv["id"]] = srv
                env_ids.add(srv["id"])

    manual_path = Path(MANUAL_SERVERS_FILE)
    if manual_path.is_file():
        for srv in _load_servers_from_file(str(manual_path)):
            if srv["id"] not in builtin_ids and srv["id"] not in remote_ids and srv["id"] not in env_ids:
                srv.setdefault("is_manual", True)
                merged[srv["id"]] = srv

    env_manual = Path(SERVERS_FILE)
    if env_manual.is_file() and str(env_manual) != str(manual_path):
        for srv in _load_servers_from_file(str(env_manual)):
            if srv["id"] not in builtin_ids and srv["id"] not in remote_ids and srv["id"] not in env_ids:
                srv.setdefault("is_manual", True)
                merged[srv["id"]] = srv

    return list(merged.values())

# ============================================================================
# SECTION 12 · 房间扫描 & 规范化（共享线程池）
# ============================================================================

# 模块级共享线程池（避免每次 scan_all 都新建）
SCAN_EXECUTOR = ThreadPoolExecutor(
    max_workers=min(MAX_WORKERS, 64),
    thread_name_prefix="scanner"
)


def normalize_room(raw: Any, server: dict[str, Any], index: int,
                  titles_map: dict[str, str]) -> dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    content_id = str(raw.get("contentId") or raw.get("content_id") or "").upper()
    g_info = get_game_info(content_id, titles_map)
    nodes = raw.get("nodes") if isinstance(raw.get("nodes"), list) else []
    players: list[str] = []
    for node in nodes:
        if isinstance(node, dict):
            name = str(node.get("playerName") or node.get("player_name") or "").strip()
        else:
            name = str(node).strip()
        if not name:
            name = "未命名玩家"
        players.append(name)
    host = str(raw.get("hostPlayerName") or raw.get("host_player_name") or "").strip()
    if not host:
        host = players[0] if players else "未知玩家"
    elif not players:
        players.append(host)
    node_count = int_or_zero(raw.get("nodeCount", raw.get("node_count", len(players))))
    node_max = int_or_zero(raw.get("nodeCountMax", raw.get("node_count_max", 0)))
    return {
        "id": str(raw.get("sessionId") or raw.get("session_id") or f"{server['id']}-{index}"),
        "server_id": server["id"],
        "server_name": server["name"],
        "server_address": f"{server['host']}:{server['port']}",
        "content_id": content_id,
        "game": g_info["name"],
        "game_icon": g_info["icon"],
        "host": host,
        "node_count": node_count or len(players),
        "node_count_max": node_max,
        "players": players,
    }


def base_result(server: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": server["id"], "name": server["name"], "host": server["host"],
        "port": server["port"], "address": f"{server['host']}:{server['port']}",
        "type": server["type"], "region": server.get("region", ""),
        "is_manual": server.get("is_manual", False),
        "status": "offline", "online": 0, "idle": 0, "active": 0,
        "room_count": 0, "rooms": [], "latency_ms": None, "error": "",
        "scanner_error": "", "detection": "active-udp-scan",
        "checked_at": utc_now(),
    }


def scan_graphql(server: dict[str, Any]) -> dict[str, Any]:
    result = base_result(server)
    url = f"http://{server['host']}:{server['port']}/"
    started = time.monotonic()
    try:
        response = http.post(url, json_body={"query": GRAPHQL_QUERY},
                             timeout=REQUEST_TIMEOUT, allow_redirects=False)
        elapsed_ms = max(1, int((time.monotonic() - started) * 1000))
        result["latency_ms"] = elapsed_ms
        if response.is_redirect:
            raise RuntimeError("服务器返回意外重定向")
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise RuntimeError("响应不是 JSON 对象")
        if payload.get("errors"):
            first = payload["errors"][0] if isinstance(payload["errors"], list) else payload["errors"]
            message = first.get("message") if isinstance(first, dict) else str(first)
            raise RuntimeError(f"GraphQL：{message}")
        data = payload.get("data")
        if not isinstance(data, dict):
            raise RuntimeError("GraphQL 缺少 data")
        info_block = data.get("serverInfo") if isinstance(data.get("serverInfo"), dict) else {}
        online = int_or_zero(info_block.get("online"))
        idle = int_or_zero(info_block.get("idle"))
        raw_rooms = data.get("room") if isinstance(data.get("room"), list) else []
        rooms = [normalize_room(item, server, i + 1, ctx.game_titles) for i, item in enumerate(raw_rooms)]
        result.update({
            "status": "online", "online": online, "idle": idle,
            "active": max(0, online - idle), "room_count": len(rooms), "rooms": rooms
        })
    except Exception as exc:
        if result["latency_ms"] is None:
            result["latency_ms"] = max(1, int((time.monotonic() - started) * 1000))
        result["error"] = str(exc)
    return result


def scan_rest(server: dict[str, Any]) -> dict[str, Any]:
    result = base_result(server)
    url = f"http://{server['host']}:{server['port']}/info"
    started = time.monotonic()
    try:
        response = http.get(url, timeout=REQUEST_TIMEOUT, allow_redirects=False)
        elapsed_ms = max(1, int((time.monotonic() - started) * 1000))
        result["latency_ms"] = elapsed_ms
        if response.is_redirect:
            raise RuntimeError("服务器返回意外重定向")
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            raise RuntimeError("响应不是 JSON 对象")
        online = int_or_zero(data.get("online", data.get("clientCount", 0)))
        idle = int_or_zero(data.get("idle", 0))
        raw_rooms = data.get("rooms") if isinstance(data.get("rooms"), list) else []
        rooms = [normalize_room(item, server, i + 1, ctx.game_titles) for i, item in enumerate(raw_rooms)]
        result.update({
            "status": "online", "online": online, "idle": idle,
            "active": max(0, online - idle), "room_count": len(rooms), "rooms": rooms
        })
    except Exception as exc:
        if result["latency_ms"] is None:
            result["latency_ms"] = max(1, int((time.monotonic() - started) * 1000))
        result["error"] = str(exc)
    return result


def scan_server(server: dict[str, Any], force: bool = False) -> tuple[dict[str, Any], bool]:
    key = f"scan:{server['id']}"
    if not force:
        cached = cache.get(key)
        if cached is not None:
            return cached, True

    result = scan_graphql(server) if server["type"] == "graphql" else scan_rest(server)
    scanner = ctx.get_scanner(server["id"])
    active_raw, scanner_error = scanner.scan() if scanner else ([], "Scanner not found")
    active_rooms = [normalize_room(item, server, i + 1, ctx.game_titles) for i, item in enumerate(active_raw)]

    # 合并去重（浅拷贝，避免 deepcopy 开销）
    merged: dict[str, dict[str, Any]] = {}
    for room in (*result.get("rooms", []), *active_rooms):
        rid = str(room.get("id") or f"{room.get('server_id')}:{room.get('host')}:{room.get('content_id')}")
        merged[rid] = room
    rooms = list(merged.values())

    result["rooms"] = rooms
    result["room_count"] = len(rooms)
    result["scanner_error"] = scanner_error
    result["detection"] = "active-udp-scan+monitor-api"
    if rooms and result.get("status") != "online":
        result["status"] = "online"
        result["online"] = max(int_or_zero(result.get("online")), sum(max(1, r["node_count"]) for r in rooms))
        result["active"] = max(0, result["online"] - int_or_zero(result.get("idle")))
        result["error"] = ""
    if result.get("latency_ms") is None:
        result["latency_ms"] = -1
    cache.set(key, result)
    return result, False


def scan_all(force: bool = False) -> tuple[list[dict[str, Any]], bool]:
    ctx.refresh_config()
    servers_snapshot = ctx.get_all_servers()
    if not servers_snapshot:
        return [], True

    results: dict[str, dict[str, Any]] = {}
    all_cached = True
    futures = {
        SCAN_EXECUTOR.submit(scan_server, s, force): s["id"]
        for s in servers_snapshot
    }
    for future in as_completed(futures):
        sid = futures[future]
        try:
            result, hit = future.result()
            results[sid] = result
            all_cached = all_cached and hit
        except Exception as exc:
            srv = ctx.get_server(sid) or {"id": sid, "name": "?", "host": "?", "port": 0}
            fallback = base_result(srv)
            fallback["error"] = str(exc)
            fallback["latency_ms"] = -1
            results[sid] = fallback
            all_cached = False

    # 按原始顺序返回
    return [results[s["id"]] for s in servers_snapshot if s["id"] in results], all_cached

# ============================================================================
# SECTION 13 · HTTP 请求参数 & 响应辅助
# ============================================================================

def parse_query(query_string: str) -> dict[str, str]:
    if not query_string:
        return {}
    parsed = urllib.parse.parse_qs(query_string, keep_blank_values=True)
    return {k: v[0] for k, v in parsed.items()}


def wants_refresh(query: dict[str, str]) -> bool:
    return query.get("refresh", "0").strip().lower() in {"1", "true", "yes"}


def bounded_int(query: dict[str, str], name: str, default: int,
               minimum: int, maximum: int) -> int:
    raw = query.get(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError(f"参数 {name} 必须是整数") from exc
    if not minimum <= value <= maximum:
        raise ValueError(f"参数 {name} 必须在 {minimum} 到 {maximum} 之间")
    return value


def make_json_response(data: dict[str, Any], cache_hit: bool = False,
                       status: int = 200) -> tuple[bytes, dict[str, str], int]:
    body = json.dumps(data, ensure_ascii=False, sort_keys=False).encode("utf-8")
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "X-Cache": "HIT" if cache_hit else "MISS",
        "Cache-Control": f"public, max-age={CACHE_TTL}",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
    }
    return body, headers, status

# ============================================================================
# SECTION 14 · 前端页面模板（读取外部文件）
# ============================================================================

def get_static_file(filename: str) -> str:
    """读取静态文件内容，如果文件不存在则返回空字符串。"""
    file_path = SCRIPT_DIR / filename
    if file_path.is_file():
        try:
            return file_path.read_text(encoding="utf-8")
        except Exception:
            return ""
    return ""


def build_html() -> str:
    """构建完整的 HTML 页面（内联 CSS 和 JS）。"""
    html = get_static_file("index.html")
    css = get_static_file("styles.css")
    js = get_static_file("script.js")
    
    # 如果 HTML 模板存在，注入 CSS 和 JS
    if html:
        # 如果 HTML 中有占位符，替换它们
        html = html.replace('{{STYLES}}', css)
        html = html.replace('{{SCRIPTS}}', js)
        return html
    
    # 降级：如果 index.html 不存在，使用内联版本
    # 但由于我们已经拆分，这里返回一个简单的框架
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#dff3ff" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0f1923" media="(prefers-color-scheme: dark)">
  <title>LAN-Play 房间监控</title>
  <style>{css}</style>
</head>
<body>
  {html}
  <script>{js}</script>
</body>
</html>"""

# ============================================================================
# SECTION 15 · HTTP 请求处理器（多线程并发）
# ============================================================================

class MonitorHandler(BaseHTTPRequestHandler):
    """处理所有 HTTP 请求（页面 / API）。"""

    # ── 关闭日志噪音 ──
    def log_message(self, format: str, *args: Any) -> None:
        pass

    # ── GET 路由 ──
    def do_GET(self) -> None:
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = parse_query(parsed_url.query)

        # 根路径 → 返回前端页面
        if path in {"", "/"}:
            body = build_html().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # 提供静态文件
        if path.startswith("/static/"):
            filename = path[8:]  # 去掉 "/static/"
            # 安全检查：防止目录遍历
            if ".." in filename or filename.startswith("/"):
                self.send_response(403)
                self.end_headers()
                return
            file_path = SCRIPT_DIR / filename
            if file_path.is_file() and filename in ("index.html", "styles.css", "script.js"):
                content_type = {
                    "index.html": "text/html; charset=utf-8",
                    "styles.css": "text/css; charset=utf-8",
                    "script.js": "application/javascript; charset=utf-8",
                }.get(filename, "application/octet-stream")
                try:
                    body = file_path.read_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", content_type)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return
                except Exception:
                    pass
            self.send_response(404)
            self.end_headers()
            return

        # /api/snapshot → 全量扫描
        if path == "/api/snapshot":
            try:
                force = wants_refresh(query)
                servers_data, all_cached = scan_all(force=force)
                # 浅拷贝合并房间列表（避免 deepcopy 开销）
                all_rooms: list[dict[str, Any]] = []
                for s in servers_data:
                    for r in s.get("rooms", []):
                        rc = dict(r)
                        all_rooms.append(rc)
                data = {"ok": True, "servers": servers_data, "rooms": all_rooms}
                body, headers, status = make_json_response(data, cache_hit=all_cached)
            except Exception as e:
                err(f"[API] /api/snapshot 异常: {e}")
                data = {"ok": False, "error": str(e)}
                body, headers, status = make_json_response(data, status=500)
            self._send(body, headers, status)
            return

        # /api/network-status → 网络连通性
        if path == "/api/network-status":
            try:
                force_check = wants_refresh(query)
                net_status = get_network_status(force=force_check)
                data = {"ok": True, "online": net_status["online"]}
                body, headers, status = make_json_response(data)
            except Exception as e:
                data = {"ok": False, "error": str(e)}
                body, headers, status = make_json_response(data, status=500)
            self._send(body, headers, status)
            return

        # /api/logs → 实时日志
        if path == "/api/logs":
            try:
                logs = log_capturer.get_logs_tail(200)
                with _download_status_lock:
                    st = dict(_download_status)
                log_lines = list(logs)
                if st.get("remote_servers_available"):
                    ts = st.get("servers_last_success", 0)
                    log_lines.append(f"[远程下载] 服务器列表: 正常 | 上次成功: {time.strftime('%H:%M:%S', time.localtime(ts))}")
                else:
                    log_lines.append("[远程下载] 服务器列表: 不可用（使用内置兜底）")
                if st.get("chinese_db_last_error"):
                    ts = st.get("chinese_db_last_success", 0)
                    msg = f"标题映射: {st['chinese_db_last_error']}"
                    log_lines.append(f"[远程下载] {msg} | 上次成功: {time.strftime('%H:%M:%S', time.localtime(ts))}" if ts else f"[远程下载] {msg}")
                else:
                    ts = st.get("chinese_db_last_success", 0)
                    log_lines.append(f"[远程下载] 标题映射: 正常 | 上次成功: {time.strftime('%H:%M:%S', time.localtime(ts))}" if ts else "[远程下载] 标题映射: 正常")
                data = {"ok": True, "logs": log_lines}
                body, headers, status = make_json_response(data)
            except Exception as e:
                data = {"ok": False, "error": str(e)}
                body, headers, status = make_json_response(data, status=500)
            self._send(body, headers, status)
            return

        self.send_response(404)
        self.end_headers()

    # ── POST 路由 ──
    def do_POST(self) -> None:
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        content_length = int(self.headers.get("Content-Length", 0))
        body_data = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            req_json = json.loads(body_data.decode("utf-8"))
        except Exception:
            req_json = {}

        # /api/servers/add → 添加自定义服务器
        if path == "/api/servers/add":
            try:
                name = str(req_json.get("name", "")).strip()
                host = str(req_json.get("host", "")).strip()
                port = int(req_json.get("port", 11451))
                stype = str(req_json.get("type", "graphql")).strip().lower()
                region = str(req_json.get("region", "")).strip()
                new_id = f"manual_{uuid.uuid4().hex[:8]}"
                new_server = {"id": new_id, "name": name, "host": host,
                              "port": port, "type": stype, "region": region,
                              "is_manual": True}
                validated = validate_server(new_server)
                local_path = Path(MANUAL_SERVERS_FILE)
                existing_list = []
                if local_path.is_file():
                    try:
                        existing_list = json.loads(local_path.read_text(encoding="utf-8"))
                        if not isinstance(existing_list, list):
                            existing_list = []
                    except Exception:
                        existing_list = []
                existing_list.append(validated)
                local_path.write_text(json.dumps(existing_list, ensure_ascii=False, indent=2), encoding="utf-8")
                ctx.refresh_config()
                data = {"ok": True, "server": validated}
                body, headers, status = make_json_response(data)
            except Exception as e:
                data = {"ok": False, "error": str(e)}
                body, headers, status = make_json_response(data, status=400)
            self._send(body, headers, status)
            return

        # /api/servers/delete → 删除自定义服务器
        if path == "/api/servers/delete":
            try:
                sid = str(req_json.get("id", "")).strip()
                local_path = Path(MANUAL_SERVERS_FILE)
                if not local_path.is_file():
                    raise RuntimeError("没有找到本地配置文件")
                existing_list = json.loads(local_path.read_text(encoding="utf-8"))
                if not isinstance(existing_list, list):
                    existing_list = []
                new_list = [item for item in existing_list if str(item.get("id")) != sid]
                local_path.write_text(json.dumps(new_list, ensure_ascii=False, indent=2), encoding="utf-8")
                ctx.refresh_config()
                data = {"ok": True}
                body, headers, status = make_json_response(data)
            except Exception as e:
                data = {"ok": False, "error": str(e)}
                body, headers, status = make_json_response(data, status=400)
            self._send(body, headers, status)
            return

        # /api/servers/reorder → 排序 & 恢复默认
        if path == "/api/servers/reorder":
            try:
                order = req_json.get("order", [])
                is_reset = req_json.get("reset", False)
                local_path = Path(MANUAL_SERVERS_FILE)
                if is_reset:
                    if local_path.is_file():
                        try:
                            ex_list = json.loads(local_path.read_text(encoding="utf-8"))
                            if isinstance(ex_list, list):
                                local_path.write_text(json.dumps(ex_list, ensure_ascii=False, indent=2), encoding="utf-8")
                        except Exception:
                            pass
                    ctx.refresh_config()
                elif isinstance(order, list) and order:
                    existing_map: dict[str, dict] = {}
                    if local_path.is_file():
                        try:
                            ex_list = json.loads(local_path.read_text(encoding="utf-8"))
                            if isinstance(ex_list, list):
                                existing_map = {str(item.get("id")): item for item in ex_list}
                        except Exception:
                            pass
                    reordered = [existing_map[sid] for sid in order if sid in existing_map]
                    for sid, item in existing_map.items():
                        if sid not in order:
                            reordered.append(item)
                    if reordered:
                        local_path.write_text(json.dumps(reordered, ensure_ascii=False, indent=2), encoding="utf-8")
                        ctx.refresh_config()
                data = {"ok": True}
                body, headers, status = make_json_response(data)
            except Exception as e:
                data = {"ok": False, "error": str(e)}
                body, headers, status = make_json_response(data, status=400)
            self._send(body, headers, status)
            return

        self.send_response(404)
        self.end_headers()

    # ── 内部工具 ──
    def _send(self, body: bytes, headers: dict[str, str], status: int):
        self.send_response(status)
        for k, v in headers.items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

# ============================================================================
# SECTION 16 · 入口 & 启动
# ============================================================================

class ThreadingHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    daemon_threads = True


def main() -> None:
    # 1. 初始化配置
    ctx.refresh_config()
    info(f"[配置] 初始服务器数: {len(ctx.servers)}")
    info(f"[配置] 远程文件下载间隔: {REMOTE_DOWNLOAD_INTERVAL} 秒")
    info(f"[配置] 远程服务器列表本地路径: {LOCAL_SERVERS_FILE}")
    info(f"[配置] 远程标题映射本地路径: {LOCAL_CHINESE_DB_FILE}")

    # 2. 启动后台远程文件下载线程
    start_remote_download_thread()

    # 3. 启动 HTTP 服务
    port = int(os.getenv("PORT", "5000"))
    server_address = ("0.0.0.0", port)
    httpd = ThreadingHTTPServer(server_address, MonitorHandler)
    info(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 监控服务已启动，监听端口: {port}")
    info(f"[访问地址] http://0.0.0.0:{port}/")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        info("\n[服务] 正在关闭...")
        # 关闭所有 scanner socket
        for scanner in ctx.scanners.values():
            scanner.close()
        SCAN_EXECUTOR.shutdown(wait=False)
        httpd.server_close()


if __name__ == "__main__":
    main()