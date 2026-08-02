#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
完整版：LAN-Play 监控 + 内置 WebView + 原生文件选择器
兼容 Kivy / Buildozer (Android) 和桌面开发
"""
from __future__ import annotations

# ============================================================================
# 标准库导入（与原版一致）
# ============================================================================
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
from email.parser import BytesParser
from email.policy import default as default_policy
from pathlib import Path
from typing import Any, Callable, Tuple
import http.client
import urllib.request
import urllib.error
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

# ============================================================================
# Kivy 专用导入（新增）
# ============================================================================
from kivy.app import App
from kivy.uix.webview import WebView
from kivy.clock import Clock
from plyer import filechooser
from android.permissions import request_permissions, Permission
from android import javascript_interface

# ============================================================================
# 日志捕获器（与原版相同）
# ============================================================================
class LogCapturer:
    def __init__(self, maxlen: int = 500):
        self.terminal = sys.stdout
        self.buffer: deque[str] = deque(maxlen=maxlen)
        self.lock = threading.Lock()

    def write(self, message: str):
        msg = message.strip()
        if msg.startswith("Traceback") or 'File "/' in msg:
            return
        if self.terminal:
            self.terminal.write(message)
            self.terminal.flush()
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

def info(*a, **k): print("[INFO]", *a, **k)
def warn(*a, **k): print("[WARN]", *a, **k)
def err(*a, **k):  print("[ERROR]", *a, **k)

# ============================================================================
# 网络检测（与原版相同）
# ============================================================================
NETWORK_CHECK_URL = "https://www.baidu.com"
_network_status_cache: dict[str, Any] = {
    "online": True,
    "last_check": 0.0,
    "last_success": 0.0,
    "consecutive_failures": 0,
}
_network_status_lock = threading.Lock()
NETWORK_CHECK_INTERVAL = 5

def _create_ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

def check_network_reachability() -> bool:
    req = urllib.request.Request(
        NETWORK_CHECK_URL,
        headers={"User-Agent": f"{APP_NAME}/1.0", "Accept": "text/html"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5, context=_create_ssl_context()) as resp:
            return 200 <= resp.status < 600
    except (urllib.error.URLError, socket.timeout, OSError):
        return False

def get_network_status(force: bool = False) -> dict[str, Any]:
    now = time.time()
    with _network_status_lock:
        cached = _network_status_cache
        if not force and now - cached["last_check"] < NETWORK_CHECK_INTERVAL:
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
# 常量 & 配置（与原版相同）
# ============================================================================
SCRIPT_DIR = Path(__file__).resolve().parent
LOCAL_SERVERS_FILE = str(SCRIPT_DIR / "servers.json")
MANUAL_SERVERS_FILE = str(SCRIPT_DIR / "servers_manual.json")
SERVERS_FILE = os.getenv("SERVERS_FILE", "").strip() or MANUAL_SERVERS_FILE
DEFAULT_SERVERS_FILE = MANUAL_SERVERS_FILE

REMOTE_DOWNLOAD_INTERVAL = 30
APP_NAME = "lan-play-monitor"
CACHE_TTL = max(0.5, float(os.getenv("CACHE_TTL", "1.0")))
REQUEST_TIMEOUT = max(1.0, float(os.getenv("REQUEST_TIMEOUT", "10.0")))
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

BUILTIN_GAME_TITLES: dict[str, str] = {"FFFFFFFFFFFFFFFF": "未知游戏"}

ROOM_CACHE: dict = {}
ROOM_CACHE_LOCK = threading.Lock()
ROOM_CACHE_TTL = 10.0

UPLOAD_DIR = SCRIPT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_VIDEO_EXTS = {".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv"}
ALLOWED_EXTS = ALLOWED_IMAGE_EXTS | ALLOWED_VIDEO_EXTS

MAX_IMAGE_SIZE = 10 * 1024 * 1024
MAX_VIDEO_SIZE = 100 * 1024 * 1024

MIME_TYPES: dict[str, str] = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp",
    ".mp4": "video/mp4", ".webm": "video/webm", ".ogg": "video/ogg",
    ".mov": "video/quicktime", ".avi": "video/x-msvideo", ".mkv": "video/x-matroska",
}

_download_status_lock = threading.Lock()
_download_status: dict[str, Any] = {
    "chinese_db_last_success": 0.0, "chinese_db_last_error": "",
    "servers_last_success": 0.0, "servers_last_error": "",
    "remote_servers_available": False,
}

# ============================================================================
# 远程下载（与原版相同）
# ============================================================================
def _download_remote_file(url: str, dest_path: str) -> bool:
    tmp_path = f"{dest_path}.{os.getpid()}.{uuid.uuid4().hex[:6]}.tmp"
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": f"{APP_NAME}/1.0", "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10, context=_create_ssl_context()) as resp:
            data = resp.read()
            json.loads(data.decode("utf-8-sig"))
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

def _update_download_status(**fields):
    with _download_status_lock:
        _download_status.update(fields)

def _download_and_report(db_url: str, servers_url: str) -> None:
    ok_db = _download_remote_file(db_url, LOCAL_CHINESE_DB_FILE)
    with _download_status_lock:
        _download_status["chinese_db_last_success"] = time.time() if ok_db else _download_status.get("chinese_db_last_success", 0)
        _download_status["chinese_db_last_error"] = "" if ok_db else "下载失败"
    info("[远程下载] ✅ 标题映射已更新" if ok_db else "[远程下载] ❌ 标题映射下载失败")

    ok_srv = _download_remote_file(servers_url, LOCAL_SERVERS_FILE)
    with _download_status_lock:
        _download_status["servers_last_success"] = time.time() if ok_srv else _download_status.get("servers_last_success", 0)
        _download_status["servers_last_error"] = "" if ok_srv else "下载失败"
        _download_status["remote_servers_available"] = ok_srv or Path(LOCAL_SERVERS_FILE).is_file()
    info("[远程下载] ✅ 服务器列表已更新" if ok_srv else "[远程下载] ❌ 服务器列表下载失败")

def remote_download_worker():
    while True:
        try:
            _download_and_report(REMOTE_CHINESE_DB_URL, REMOTE_SERVERS_URL)
        except Exception as exc:
            err(f"[远程下载] 意外错误: {exc}")
        time.sleep(REMOTE_DOWNLOAD_INTERVAL)

def start_remote_download_thread():
    def _first_then_loop():
        try:
            _download_and_report(REMOTE_CHINESE_DB_URL, REMOTE_SERVERS_URL)
        except Exception as exc:
            err(f"[远程下载] 首次下载异常: {exc}")
        remote_download_worker()
    t = threading.Thread(target=_first_then_loop, daemon=True, name="remote-downloader")
    t.start()
    info(f"[远程下载] 后台下载线程已启动，间隔 {REMOTE_DOWNLOAD_INTERVAL} 秒")

# ============================================================================
# 标题映射加载（与原版相同）
# ============================================================================
def load_game_titles() -> dict[str, str]:
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
# TTL 缓存（与原版相同）
# ============================================================================
@dataclass
class CacheItem:
    value: Any
    expires_at: float

class TTLCache:
    def __init__(self, max_items: int = 1024):
        self._items: dict[str, CacheItem] = {}
        self._lock = threading.Lock()
        self.max_items = max_items

    def get(self, key: str) -> Any | None:
        now = time.monotonic()
        with self._lock:
            item = self._items.get(key)
            if item is None or item.expires_at <= now:
                self._items.pop(key, None)
                return None
            return copy.deepcopy(item.value)

    def set(self, key: str, value: Any, ttl: float = CACHE_TTL) -> None:
        with self._lock:
            self._items[key] = CacheItem(copy.deepcopy(value), time.monotonic() + ttl)
            if len(self._items) > self.max_items:
                self._items.pop(next(iter(self._items)), None)

    def clear(self):
        with self._lock:
            self._items.clear()

cache = TTLCache(max_items=2048)

# ============================================================================
# 工具函数（与原版相同）
# ============================================================================
ERROR_TRANSLATIONS: list[Tuple[str, str]] = [
    ("404",            "HTTP 404 未找到"),
    ("timed out",      "连接超时"),
    ("remote end closed connection", "远程服务器关闭连接，未响应"),
    ("connection refused", "连接被拒绝"),
    ("name or service not known", "DNS 解析失败"),
    ("network is unreachable", "网络不可达"),
    ("ssl",            "SSL 证书错误"),
    ("graphql",        "GraphQL 查询失败"),
]

def translate_error_message(msg: str) -> str:
    if not msg:
        return "未知错误"
    lowered = msg.lower()
    for needle, translated in ERROR_TRANSLATIONS:
        if needle in lowered:
            return f"{translated}: {msg}" if needle == "graphql" else translated
    return f"服务器错误: {msg}"

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def int_or_zero(value: Any) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0

HOST_RE = re.compile(r"^(?:[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?|\[[0-9A-Fa-f:]+\])$")
ID_RE = re.compile(r"^[A-Za-z0-9_ -]{1,64}$")

_QUESTION_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">'
    '<circle cx="24" cy="24" r="22" fill="#34495e"/>'
    '<text x="24" y="34" text-anchor="middle" font-size="30" fill="white" '
    'font-family="sans-serif" font-weight="bold">?</text></svg>'
)
QUESTION_ICON = "data:image/svg+xml," + urllib.parse.quote(_QUESTION_SVG)
UNKNOWN_ID = "FFFFFFFFFFFFFFFF"

def get_game_info(content_id: str, titles_map: dict[str, str]) -> dict[str, str]:
    normalized = str(content_id or "").upper()
    game_name = titles_map.get(normalized)
    is_unknown = not game_name
    if not game_name:
        game_name = f"未知游戏 ({normalized})" if normalized else "未知游戏"
    if normalized == UNKNOWN_ID:
        is_unknown = False
        game_name = "未知游戏"
    icon = QUESTION_ICON if is_unknown else f"https://tinfoil.media/ti/{normalized or UNKNOWN_ID}/48/48"
    return {"name": game_name, "icon": icon}

# ============================================================================
# HTTP 客户端（与原版相同）
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
            return HTTPResponse(resp, resp.read(), url)
        except urllib.error.HTTPError as e:
            return HTTPResponse(e, e.read() or b"", url, str(e))
        except (urllib.error.URLError, socket.timeout, OSError) as e:
            raise RuntimeError(e.reason if hasattr(e, "reason") else str(e)) from e

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
# LDN UDP 扫描（与原版相同）
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

UDP_SCAN_SECONDS = max(0.5, float(os.getenv("UDP_SCAN_SECONDS", "0.5")))
LDN_PORT = 11452
LDN_MAGIC = bytes.fromhex("00144511")
LDN_SCAN_HEADER = LDN_MAGIC + bytes(8)
SCANNER_VIRTUAL_IP = "10.13.37.0"
LDN_BROADCAST_IP = "10.13.255.255"
MAX_REASSEMBLED_PACKET = 65535
MAX_SCAN_ITERATIONS = 2000
SOCKET_MAX_LIFETIME = 300

def internet_checksum(data: bytes) -> int:
    if len(data) % 2:
        data += b"\x00"
    total = sum(struct.unpack(f"!{len(data) // 2}H", data))
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    return (~total) & 0xFFFF

def build_ldn_scan_frame() -> bytes:
    source = socket.inet_aton(SCANNER_VIRTUAL_IP)
    destination = socket.inet_aton(LDN_BROADCAST_IP)
    udp_length = 8 + len(LDN_SCAN_HEADER)
    udp_header_wo_cs = struct.pack("!HHHH", LDN_PORT, LDN_PORT, udp_length, 0)
    pseudo = source + destination + struct.pack("!BBH", 0, socket.IPPROTO_UDP, udp_length)
    udp_checksum = internet_checksum(pseudo + udp_header_wo_cs + LDN_SCAN_HEADER)
    udp_header = struct.pack("!HHHH", LDN_PORT, LDN_PORT, udp_length, udp_checksum)
    ip_wo_cs = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 20 + udp_length, 0, 0x4000, 64,
                            socket.IPPROTO_UDP, 0, source, destination)
    ip_checksum = internet_checksum(ip_wo_cs)
    ip_header = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 20 + udp_length, 0, 0x4000, 64,
                            socket.IPPROTO_UDP, ip_checksum, source, destination)
    return b"\x01" + ip_header + udp_header + LDN_SCAN_HEADER

LDN_SCAN_FRAME = build_ldn_scan_frame()

def decompress_ldn(data: bytes, expected_size: int) -> bytes:
    if expected_size <= 0 or expected_size > 8192:
        raise ValueError("ldn_mitm 解压长度异常")
    output = bytearray()
    i = 0
    while i < len(data) and len(output) < expected_size:
        val = data[i]; i += 1
        output.append(val)
        if val == 0:
            if i >= len(data):
                raise ValueError("ldn_mitm 压缩数据不完整")
            output.extend(b"\x00" * data[i])
            i += 1
    if i != len(data) or len(output) != expected_size:
        raise ValueError("ldn_mitm 解压长度不匹配")
    return bytes(output)

def decode_player_name(raw: bytes) -> str:
    return raw.split(b"\x00", 1)[0].decode("utf-8", errors="replace").strip() or "未命名玩家"

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
    for idx in range(node_count):
        node = payload[0x68 + 0x40 * idx: 0x68 + 0x40 * (idx + 1)]
        if len(node) < 0x40:
            break
        name = decode_player_name(node[0x0C:0x2C])
        players.append(name)
        nodes.append({"playerName": name})

    host = decode_player_name(payload[0x74:0x94]) or (players[0] if players else "未命名玩家")
    if not players:
        players.append(host)

    adv_len = min(int.from_bytes(payload[0x26A:0x26C], "little"), 384)
    advertise_data = payload[0x26C:0x26C + adv_len].hex() if adv_len > 0 else ""

    return {
        "sessionId": session_id or f"{source_ip}-{content_id}",
        "contentId": content_id, "hostPlayerName": host,
        "nodeCount": node_count, "nodeCountMax": node_count_max,
        "advertiseData": advertise_data, "nodes": nodes,
        "sourceIp": source_ip, "players": players,
    }

def parse_ipv4_ldn_response(packet: bytes) -> dict[str, Any] | None:
    if len(packet) < 20 or packet[0] >> 4 != 4:
        return None
    hdr_len = (packet[0] & 0x0F) * 4
    if hdr_len < 20 or len(packet) < hdr_len + 8:
        return None
    total_len = int.from_bytes(packet[2:4], "big")
    packet = packet[:min(total_len, len(packet))]
    if packet[9] != socket.IPPROTO_UDP:
        return None

    src_ip = socket.inet_ntoa(packet[12:16])
    udp = packet[hdr_len:]
    src_port, dst_port, udp_len, _ = struct.unpack("!HHHH", udp[:8])
    if src_port != LDN_PORT or dst_port != LDN_PORT or udp_len < 8:
        return None

    ldn = udp[8:min(len(udp), udp_len)]
    if len(ldn) < 12 or ldn[:4] != LDN_MAGIC:
        return None
    if ldn[4] != 1:
        return None

    compressed = ldn[5] == 1
    body_len = int.from_bytes(ldn[6:8], "little")
    decompressed_len = int.from_bytes(ldn[8:10], "little")
    if body_len > len(ldn) - 12:
        return None

    body = ldn[12:12 + body_len]
    if compressed:
        body = decompress_ldn(body, decompressed_len)
    return parse_network_info(body, src_ip)

class FragmentCollector:
    def __init__(self):
        self.parts: dict[Tuple[bytes, int], dict[str, Any]] = {}

    def add(self, frame: bytes) -> bytes | None:
        if len(frame) < 16:
            return None
        key = (frame[0:4], int.from_bytes(frame[8:10], "big"))
        part_idx = frame[10]
        total_parts = frame[11]
        part_len = int.from_bytes(frame[12:14], "little")
        pmtu = int.from_bytes(frame[14:16], "big")

        if not (1 <= total_parts <= 64 and part_idx < total_parts and pmtu > 0):
            return None
        if part_len > len(frame) - 16:
            return None

        item = self.parts.setdefault(key, {"total": total_parts, "pmtu": pmtu, "parts": {}})
        if item["total"] != total_parts or item["pmtu"] != pmtu:
            self.parts.pop(key, None)
            return None

        item["parts"][part_idx] = frame[16:16 + part_len]
        if len(item["parts"]) != total_parts:
            return None

        final_size = max(i * pmtu + len(v) for i, v in item["parts"].items())
        if not (0 < final_size <= MAX_REASSEMBLED_PACKET):
            self.parts.pop(key, None)
            return None

        output = bytearray(final_size)
        for i, v in item["parts"].items():
            output[i * pmtu:i * pmtu + len(v)] = v
        self.parts.pop(key, None)
        return bytes(output)

class ActiveRoomScanner:
    def __init__(self, server: dict[str, Any]):
        self.server = server
        self._sock: socket.socket | None = None
        self._sock_created_at: float = 0.0
        self._lock = threading.Lock()

    def close(self):
        if self._sock is not None:
            try:
                self._sock.close()
            except OSError:
                pass
            self._sock = None
            self._sock_created_at = 0.0

    def _ensure_socket(self) -> socket.socket:
        now = time.monotonic()
        if self._sock and now - self._sock_created_at < SOCKET_MAX_LIFETIME:
            return self._sock
        self.close()
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.2)
        sock.connect((self.server["host"], self.server["port"]))
        self._sock = sock
        self._sock_created_at = now
        return sock

    @staticmethod
    def _drain(sock: socket.socket):
        sock.setblocking(False)
        try:
            while True:
                sock.recv(65535)
        except (BlockingIOError, OSError):
            pass
        finally:
            sock.setblocking(True)

    def scan(self) -> Tuple[list[dict[str, Any]], str]:
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
                        warn(f"[扫描] {self.server['name']} 达到最大迭代上限")
                        break
                    now = time.monotonic()
                    if now >= next_send:
                        try:
                            sock.send(LDN_SCAN_FRAME)
                        except OSError as e:
                            warn(f"[扫描] send 失败: {e}")
                            self.close()
                            break
                        next_send = now + 0.7
                    sock.settimeout(min(0.2, max(0.01, deadline - time.monotonic())))
                    try:
                        frame = sock.recv(65535)
                    except socket.timeout:
                        continue
                    except OSError as e:
                        warn(f"[扫描] recv 错误: {e}")
                        self.close()
                        break
                    if not frame:
                        continue

                    packet = None
                    if frame[0] == 1:
                        packet = frame[1:]
                    elif frame[0] == 3:
                        packet = collector.add(frame[1:])
                    if not packet:
                        continue
                    try:
                        room = parse_ipv4_ldn_response(packet)
                    except (ValueError, struct.error):
                        continue
                    if room:
                        key = room.get("sessionId") or f"{room.get('sourceIp')}:{room.get('contentId')}"
                        found[str(key)] = room
                return list(found.values()), ""
            except (OSError, socket.gaierror) as exc:
                self.close()
                return [], str(exc)

# ============================================================================
# 应用上下文（与原版相同）
# ============================================================================
class AppContext:
    def __init__(self):
        self.lock = threading.RLock()
        self.servers: list[dict[str, Any]] = []
        self.servers_by_id: dict[str, dict[str, Any]] = {}
        self.scanners: dict[str, ActiveRoomScanner] = {}
        self.game_titles: dict[str, str] = dict(BUILTIN_GAME_TITLES)
        self.download_status: dict[str, Any] = dict(_download_status)

    def refresh_config(self):
        with self.lock:
            self.game_titles = load_game_titles()
            new_servers = _load_servers_merged()
            self.servers = new_servers
            self.servers_by_id = {s["id"]: s for s in new_servers}
            for sid in list(self.scanners.keys()):
                if sid not in self.servers_by_id:
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

    def get_scanner(self, sid: str) -> ActiveRoomScanner | None:
        with self.lock:
            return self.scanners.get(sid)

    def get_all_servers(self) -> list[dict[str, Any]]:
        with self.lock:
            return list(self.servers)

ctx = AppContext()

# ============================================================================
# 服务器配置管理（与原版相同）
# ============================================================================
def validate_server(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("服务器配置项必须是对象")
    sid = str(raw.get("id", "")).strip()
    name = str(raw.get("name", sid)).strip()
    host = str(raw.get("host", "")).strip()
    region = str(raw.get("region", "")).strip()
    protocol = str(raw.get("type", "graphql")).strip().lower()

    try:
        port = int(raw.get("port", 11451))
    except (TypeError, ValueError) as e:
        raise ValueError(f"服务器 {sid or host} 的端口无效") from e

    if not ID_RE.fullmatch(sid):
        raise ValueError(f"服务器 id 无效：{sid!r}")
    if not name or len(name) > 100:
        raise ValueError(f"服务器 {sid} 的名称无效")
    if not HOST_RE.fullmatch(host) or ".." in host:
        raise ValueError(f"服务器 {sid} 的主机名无效")
    if not 1 <= port <= 65535:
        raise ValueError(f"服务器 {sid} 的端口无效")
    if protocol not in {"graphql", "rest"}:
        raise ValueError(f"服务器 {sid} 的 type 仅支持 graphql/rest")

    result = {"id": sid, "name": name, "host": host, "port": port, "type": protocol, "region": region}
    for flag in ("is_builtin", "is_remote", "is_manual", "is_env"):
        if flag in raw:
            result[flag] = raw[flag]
    return result

def _read_json_file(file_path: str) -> Any:
    path = Path(file_path)
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception as exc:
        warn(f"[配置警告] 读取失败 {file_path}: {exc}")
        return None

def _write_json_file(file_path: str, data: Any) -> None:
    Path(file_path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def _load_servers_from_file(file_path: str) -> list[dict[str, Any]]:
    raw = _read_json_file(file_path)
    if not isinstance(raw, list):
        if raw is not None:
            warn(f"[配置警告] 服务器列表格式不正确: {file_path}")
        return []
    servers = []
    for item in raw:
        try:
            servers.append(validate_server(item))
        except Exception as exc:
            warn(f"[配置警告] 服务器项解析失败: {exc}")
    return servers

def _load_servers_merged() -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    builtin_ids: set[str] = set()
    remote_ids: set[str] = set()
    env_ids: set[str] = set()

    local_exists = Path(LOCAL_SERVERS_FILE).is_file()
    if local_exists:
        remote_list = _load_servers_from_file(LOCAL_SERVERS_FILE)
        if remote_list:
            for srv in remote_list:
                srv.setdefault("is_remote", True)
                merged[srv["id"]] = srv
                remote_ids.add(srv["id"])
            info(f"[配置] 使用本地服务器列表，共 {len(remote_ids)} 台")
        else:
            info("[配置] 本地服务器列表为空，降级到内置兜底")
            local_exists = False

    if not local_exists:
        info("[配置] 本地服务器列表不可用，使用内置兜底")
        for item in DEFAULT_SERVERS:
            try:
                srv = validate_server(item)
                srv["is_builtin"] = True
                merged[srv["id"]] = srv
                builtin_ids.add(srv["id"])
            except Exception as exc:
                warn(f"[配置警告] 内置服务器解析失败: {exc}")

    env_path_str = os.getenv("SERVERS_FILE", "").strip()
    if env_path_str and env_path_str != DEFAULT_SERVERS_FILE:
        env_path = Path(env_path_str).expanduser()
        if env_path.is_file():
            for srv in _load_servers_from_file(str(env_path)):
                srv["is_env"] = True
                merged[srv["id"]] = srv
                env_ids.add(srv["id"])

    seen_ids = builtin_ids | remote_ids | env_ids
    for mf in {MANUAL_SERVERS_FILE, SERVERS_FILE}:
        mp = Path(mf)
        if not mp.is_file() or str(mp) == env_path_str:
            continue
        for srv in _load_servers_from_file(str(mp)):
            if srv["id"] in seen_ids:
                continue
            srv.setdefault("is_manual", True)
            merged[srv["id"]] = srv

    result = list(merged.values())
    info(f"[配置] 最终服务器列表: {len(result)} 台")
    return result

# ============================================================================
# 房间扫描 & 规范化（与原版相同）
# ============================================================================
SCAN_EXECUTOR = ThreadPoolExecutor(max_workers=min(MAX_WORKERS, 64), thread_name_prefix="scanner")

def normalize_room(raw: Any, server: dict[str, Any], index: int) -> dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    content_id = str(raw.get("contentId") or raw.get("content_id") or "").upper()
    g_info = get_game_info(content_id, ctx.game_titles)

    nodes = raw.get("nodes") if isinstance(raw.get("nodes"), list) else []
    players = []
    for n in nodes:
        if isinstance(n, dict):
            name = str(n.get("playerName") or n.get("player_name") or "").strip()
        else:
            name = str(n).strip()
        if not name:
            name = "未命名玩家"
        players.append(name)

    host = str(raw.get("hostPlayerName") or raw.get("host_player_name") or "").strip()
    if not host:
        host = players[0] if players else "未知玩家"
    if not players:
        players.append(host)

    return {
        "id": str(raw.get("sessionId") or raw.get("session_id") or f"{server['id']}-{index}"),
        "server_id": server["id"], "server_name": server["name"],
        "server_address": f"{server['host']}:{server['port']}",
        "content_id": content_id, "game": g_info["name"], "game_icon": g_info["icon"],
        "host": host,
        "node_count": int_or_zero(raw.get("nodeCount", raw.get("node_count", len(players)))),
        "node_count_max": int_or_zero(raw.get("nodeCountMax", raw.get("node_count_max", 0))),
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

def _scan_http(server: dict[str, Any], result: dict[str, Any]) -> None:
    is_graphql = server["type"] == "graphql"
    url = f"http://{server['host']}:{server['port']}/" + ("" if is_graphql else "info")
    started = time.monotonic()
    try:
        if is_graphql:
            response = http.post(url, json_body={"query": GRAPHQL_QUERY}, timeout=REQUEST_TIMEOUT, allow_redirects=False)
        else:
            response = http.get(url, timeout=REQUEST_TIMEOUT, allow_redirects=False)

        result["latency_ms"] = max(1, int((time.monotonic() - started) * 1000))

        if response.is_redirect:
            raise RuntimeError("服务器返回意外重定向")
        response.raise_for_status()
        payload = response.json()

        if is_graphql:
            if not isinstance(payload, dict) or payload.get("errors"):
                msg = ""
                if isinstance(payload.get("errors"), list) and payload["errors"]:
                    first = payload["errors"][0]
                    msg = first.get("message", "") if isinstance(first, dict) else str(first)
                raise RuntimeError(f"GraphQL：{msg}" if msg else "GraphQL 查询失败")
            data = payload.get("data") or {}
            info_block = data.get("serverInfo") if isinstance(data.get("serverInfo"), dict) else {}
            online = int_or_zero(info_block.get("online"))
            idle = int_or_zero(info_block.get("idle"))
            raw_rooms = data.get("room") if isinstance(data.get("room"), list) else []
        else:
            if not isinstance(payload, dict):
                raise RuntimeError("响应不是 JSON 对象")
            online = int_or_zero(payload.get("online", payload.get("clientCount", 0)))
            idle = int_or_zero(payload.get("idle", 0))
            raw_rooms = payload.get("rooms") if isinstance(payload.get("rooms"), list) else []

        rooms = [normalize_room(item, server, i + 1) for i, item in enumerate(raw_rooms)]
        result.update({
            "status": "online", "online": online, "idle": idle,
            "active": max(0, online - idle), "room_count": len(rooms), "rooms": rooms
        })
    except Exception as exc:
        result["error"] = translate_error_message(str(exc))

def scan_server(server: dict[str, Any], force: bool = False) -> Tuple[dict[str, Any], bool]:
    cache_key = f"scan:{server['id']}"
    if not force:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached, True

    result = base_result(server)
    _scan_http(server, result)
    http_ok = (result.get("status") == "online" and not result.get("error"))

    scanner = ctx.get_scanner(server["id"])
    active_raw, scan_err = scanner.scan() if scanner else ([], "Scanner not found")
    active_rooms = [normalize_room(r, server, i + 1) for i, r in enumerate(active_raw)]
    udp_has_rooms = len(active_rooms) > 0

    merged = {}
    for room in (*result.get("rooms", []), *active_rooms):
        rid = str(room.get("id") or f"{room.get('server_id')}:{room.get('host')}:{room.get('content_id')}")
        merged[rid] = room
    result["rooms"] = list(merged.values())
    result["room_count"] = len(result["rooms"])
    result["scanner_error"] = scan_err
    result["detection"] = "active-udp-scan+monitor-api"

    if http_ok or udp_has_rooms:
        result["status"] = "online"
        http_on = int_or_zero(result.get("online"))
        udp_on = sum(max(1, r["node_count"]) for r in active_rooms) if udp_has_rooms else 0
        result["online"] = max(http_on, udp_on)
        result["active"] = max(0, result["online"] - int_or_zero(result.get("idle")))
        result["error"] = ""
        if not http_ok:
            result["latency_ms"] = None
    else:
        result["status"] = "offline"
        result["online"] = result["idle"] = result["active"] = 0
        result["latency_ms"] = None
        if not result.get("error"):
            result["error"] = "服务器不可达或未响应"

    now = time.time()
    sid = server["id"]
    with ROOM_CACHE_LOCK:
        for room in result.get("rooms", []):
            rid = room.get("id")
            if rid:
                ROOM_CACHE[(sid, rid)] = {"room": room, "last_seen": now}
        expired = [k for k, v in ROOM_CACHE.items() if v["last_seen"] + ROOM_CACHE_TTL < now and k[0] == sid]
        for k in expired:
            del ROOM_CACHE[k]

    final = {}
    for room in result.get("rooms", []):
        rid = room.get("id")
        if rid:
            final[rid] = room
    with ROOM_CACHE_LOCK:
        for (ksid, rid), item in ROOM_CACHE.items():
            if ksid == sid and rid not in final:
                final[rid] = item["room"]
    result["rooms"] = list(final.values())
    result["room_count"] = len(final)

    cache.set(cache_key, result)
    return result, False

def scan_all(force: bool = False) -> Tuple[list[dict[str, Any]], bool]:
    ctx.refresh_config()
    servers = ctx.get_all_servers()

    if not servers:
        info("[扫描] 服务器列表为空，跳过扫描")
        return [], True

    results: dict[str, dict[str, Any]] = {}
    all_cached = True
    futures = {SCAN_EXECUTOR.submit(scan_server, s, force): s["id"] for s in servers}

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
            fallback["latency_ms"] = None
            results[sid] = fallback
            all_cached = False

    return [results[s["id"]] for s in servers if s["id"] in results], all_cached

# ============================================================================
# HTTP 请求参数 & 响应辅助（与原版相同）
# ============================================================================
def parse_query(query_string: str) -> dict[str, str]:
    if not query_string:
        return {}
    return {k: v[0] for k, v in urllib.parse.parse_qs(query_string, keep_blank_values=True).items()}

def wants_refresh(query: dict[str, str]) -> bool:
    return query.get("refresh", "0").strip().lower() in {"1", "true", "yes"}

def make_json_response(data: dict, cache_hit: bool = False, status: int = 200) -> Tuple[bytes, dict, int]:
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
# 前端页面模板（与原版相同）
# ============================================================================
def get_static_file(filename: str) -> str:
    fp = SCRIPT_DIR / filename
    return fp.read_text(encoding="utf-8") if fp.is_file() else ""

def build_html() -> str:
    html = get_static_file("index.html")
    css = get_static_file("styles.css")
    js = get_static_file("script.js")
    if html:
        return html.replace("{{STYLES}}", css).replace("{{SCRIPTS}}", js)
    return f"""<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#dff3ff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f1923" media="(prefers-color-scheme: dark)">
<title>LAN-Play 房间监控</title>
<style>{css}</style></head>
<body>{html}<script>{js}</script></body></html>"""

# ============================================================================
# HTTP 请求处理器（与原版相同，不做修改）
# ============================================================================
def _modify_manual_servers(modify_fn: Callable[[list[dict]], None]) -> bool:
    local_path = Path(MANUAL_SERVERS_FILE)
    existing = _read_json_file(str(local_path)) or []
    if not isinstance(existing, list):
        existing = []
    modify_fn(existing)
    _write_json_file(str(local_path), existing)
    ctx.refresh_config()
    return True

def _send_json(handler: BaseHTTPRequestHandler, data: dict, status: int = 200):
    body, headers, st = make_json_response(data, status=status)
    try:
        handler.send_response(st)
        for k, v in headers.items():
            handler.send_header(k, v)
        handler.send_header("Content-Length", str(len(body)))
        handler.end_headers()
        handler.wfile.write(body)
    except (BrokenPipeError, ConnectionResetError):
        pass
    except Exception as e:
        err(f"[HTTP] _send_json 异常: {e}")

class MonitorHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        pass

    def do_GET(self) -> None:
        try:
            parsed = urllib.parse.urlparse(self.path)
            path, query_str = parsed.path, parsed.query
            query = parse_query(query_str)

            if path in {"", "/"}:
                body = build_html().encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            if path.startswith("/static/"):
                return self._serve_static(path[8:])

            if path.startswith("/uploads/"):
                return self._serve_upload(path[9:])

            if path == "/api/servers":
                try:
                    servers = ctx.get_all_servers()
                    _send_json(self, {"ok": True, "servers": servers})
                except Exception as e:
                    err(f"[API] /api/servers 异常: {e}")
                    _send_json(self, {"ok": False, "error": str(e)}, 500)
                return

            if path == "/api/snapshot":
                try:
                    force = wants_refresh(query)
                    servers_data, all_cached = scan_all(force=force)
                    all_rooms = []
                    for s in servers_data:
                        for r in s.get("rooms", []):
                            all_rooms.append(dict(r))
                    _send_json(self, {"ok": True, "servers": servers_data, "rooms": all_rooms},
                               200 if not all_cached else 200)
                except Exception as e:
                    err(f"[API] /api/snapshot 异常: {e}")
                    _send_json(self, {"ok": False, "error": str(e)}, 500)
                return

            if path == "/api/network-status":
                try:
                    st = get_network_status(force=wants_refresh(query))
                    _send_json(self, {"ok": True, "online": st["online"]})
                except Exception as e:
                    _send_json(self, {"ok": False, "error": str(e)}, 500)
                return

            if path == "/api/logs":
                try:
                    logs = log_capturer.get_logs_tail(200)
                    with _download_status_lock:
                        ds = dict(_download_status)
                    lines = list(logs)
                    if ds.get("remote_servers_available"):
                        ts = ds.get("servers_last_success", 0)
                        lines.append(f"[远程下载] 服务器列表: 正常 | 上次成功: {time.strftime('%H:%M:%S', time.localtime(ts))}")
                    else:
                        lines.append("[远程下载] 服务器列表: 不可用（使用内置兜底）")
                    if ds.get("chinese_db_last_error"):
                        ts = ds.get("chinese_db_last_success", 0)
                        msg = f"标题映射: {ds['chinese_db_last_error']}"
                        lines.append(f"[远程下载] {msg} | 上次成功: {time.strftime('%H:%M:%S', time.localtime(ts))}" if ts else f"[远程下载] {msg}")
                    else:
                        ts = ds.get("chinese_db_last_success", 0)
                        lines.append(f"[远程下载] 标题映射: 正常 | 上次成功: {time.strftime('%H:%M:%S', time.localtime(ts))}" if ts else "[远程下载] 标题映射: 正常")
                    _send_json(self, {"ok": True, "logs": lines})
                except Exception as e:
                    _send_json(self, {"ok": False, "error": str(e)}, 500)
                return

            self.send_response(404)
            self.end_headers()
        except Exception as e:
            err(f"[HTTP] GET {self.path} 异常: {e}")
            try:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b"Internal Server Error")
            except Exception:
                pass

    def do_POST(self) -> None:
        try:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path
            content_length = int(self.headers.get("Content-Length", 0))

            if path == "/api/upload":
                return self._handle_upload()

            body_data = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                req_json = json.loads(body_data.decode("utf-8"))
            except Exception:
                req_json = {}

            post_routes = {
                "/api/servers/add":      self._api_add_server,
                "/api/servers/delete":   self._api_delete_server,
                "/api/servers/edit":     self._api_edit_server,
                "/api/servers/reorder":  self._api_reorder_servers,
            }
            handler = post_routes.get(path)
            if handler:
                return handler(req_json)

            self.send_response(404)
            self.end_headers()
        except Exception as e:
            err(f"[HTTP] POST {self.path} 异常: {e}")
            try:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b"Internal Server Error")
            except Exception:
                pass

    # ---- 辅助方法 ----
    def _serve_static(self, filename: str):
        if ".." in filename or filename.startswith("/"):
            self.send_response(403); self.end_headers(); return
        fp = SCRIPT_DIR / filename
        types = {
            "index.html": "text/html; charset=utf-8",
            "styles.css": "text/css; charset=utf-8",
            "script.js": "application/javascript; charset=utf-8",
            "goeasy-lite.min.js": "application/javascript; charset=utf-8",
        }
        if fp.is_file() and filename in types:
            body = fp.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", types[filename])
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404); self.end_headers()

    def _serve_upload(self, filename: str):
        if ".." in filename or filename.startswith("/"):
            self.send_response(403); self.end_headers(); return
        fp = UPLOAD_DIR / filename
        if fp.is_file():
            body = fp.read_bytes()
            ext = fp.suffix.lower()
            self.send_response(200)
            self.send_header("Content-Type", MIME_TYPES.get(ext, "application/octet-stream"))
            self.send_header("Content-Length", str(len(body)))
            if ext in ALLOWED_VIDEO_EXTS:
                self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404); self.end_headers()

    def _handle_upload(self) -> None:
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                raise RuntimeError("Content-Length 为空")

            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                raise RuntimeError("只支持 multipart/form-data")

            body_bytes = self.rfile.read(content_length)
            if len(body_bytes) != content_length:
                raise RuntimeError(f"数据不完整: 期望 {content_length}, 实际 {len(body_bytes)}")

            fake_header = f"Content-Type: {content_type}\r\n\r\n".encode("utf-8")
            msg = BytesParser(policy=default_policy).parsebytes(fake_header + body_bytes)

            file_data, filename = None, None
            for part in msg.iter_parts():
                if part.get_content_maintype() == "multipart":
                    continue
                disp_name = part.get_param("name", header="Content-Disposition")
                if disp_name in ("image", "file"):
                    filename = part.get_param("filename", header="Content-Disposition")
                    file_data = part.get_payload(decode=True)
                    break

            if not file_data or not filename:
                raise RuntimeError("未找到上传文件字段（image/file）")

            ext = Path(str(filename)).suffix.lower()
            if ext not in ALLOWED_EXTS:
                raise RuntimeError(f"不支持的格式: {ext}")

            file_size = len(file_data)
            if ext in ALLOWED_VIDEO_EXTS and file_size > MAX_VIDEO_SIZE:
                raise RuntimeError(f"视频过大: {file_size/1024/1024:.1f}MB > {MAX_VIDEO_SIZE//1024//1024}MB")
            if ext in ALLOWED_IMAGE_EXTS and file_size > MAX_IMAGE_SIZE:
                raise RuntimeError(f"图片过大: {file_size/1024/1024:.1f}MB > {MAX_IMAGE_SIZE//1024//1024}MB")

            save_name = f"{uuid.uuid4().hex}{ext}"
            filepath = UPLOAD_DIR / save_name
            with open(filepath, "wb") as f:
                f.write(file_data)

            file_type = "video" if ext in ALLOWED_VIDEO_EXTS else "image"
            info(f"[上传] ✅ {file_type} 上传成功: {save_name} ({file_size} bytes)")
            _send_json(self, {
                "ok": True,
                "url": f"/uploads/{save_name}",
                "file_type": file_type,
                "filename": filename,
                "size": file_size
            })
        except Exception as e:
            err(f"[上传] ❌ 错误: {e}")
            _send_json(self, {"ok": False, "error": str(e)}, 400)

    def _api_add_server(self, req_json: dict):
        try:
            name = str(req_json.get("name", "")).strip()
            host = str(req_json.get("host", "")).strip()
            port = int(req_json.get("port", 11451))
            stype = str(req_json.get("type", "graphql")).strip().lower()
            region = str(req_json.get("region", "")).strip()
            new_id = f"manual_{uuid.uuid4().hex[:8]}"
            new_server = {"id": new_id, "name": name, "host": host,
                          "port": port, "type": stype, "region": region, "is_manual": True}
            validated = validate_server(new_server)
            def _do_add(existing: list):
                existing.append(validated)
            _modify_manual_servers(_do_add)
            _send_json(self, {"ok": True, "server": validated})
        except Exception as e:
            _send_json(self, {"ok": False, "error": str(e)}, 400)

    def _api_delete_server(self, req_json: dict):
        try:
            sid = str(req_json.get("id", "")).strip()
            if not Path(MANUAL_SERVERS_FILE).is_file():
                raise RuntimeError("没有找到本地配置文件")
            def _do_del(existing: list):
                for i in range(len(existing) - 1, -1, -1):
                    if str(existing[i].get("id")) == sid:
                        del existing[i]
            _modify_manual_servers(_do_del)
            _send_json(self, {"ok": True})
        except Exception as e:
            _send_json(self, {"ok": False, "error": str(e)}, 400)

    def _api_edit_server(self, req_json: dict):
        try:
            sid = str(req_json.get("id", "")).strip()
            name = str(req_json.get("name", "")).strip()
            host = str(req_json.get("host", "")).strip()
            port = int(req_json.get("port", 11451))
            stype = str(req_json.get("type", "graphql")).strip().lower()
            region = str(req_json.get("region", "")).strip()

            local_path = Path(MANUAL_SERVERS_FILE)
            if not local_path.is_file():
                raise RuntimeError("没有找到本地配置文件")

            existing = _read_json_file(str(local_path)) or []
            found = False
            for item in existing:
                if str(item.get("id")) == sid:
                    item["name"] = name
                    item["host"] = host
                    item["port"] = port
                    item["type"] = stype
                    item["region"] = region
                    found = True
                    break
            if not found:
                raise RuntimeError("未找到指定 ID 的服务器")
            _write_json_file(str(local_path), existing)
            ctx.refresh_config()
            _send_json(self, {"ok": True})
        except Exception as e:
            _send_json(self, {"ok": False, "error": str(e)}, 400)

    def _api_reorder_servers(self, req_json: dict):
        try:
            order = req_json.get("order", [])
            is_reset = req_json.get("reset", False)
            local_path = Path(MANUAL_SERVERS_FILE)
            existing = _read_json_file(str(local_path)) or []

            if is_reset:
                _write_json_file(str(local_path), existing)
            elif isinstance(order, list) and order:
                existing_map = {str(it.get("id")): it for it in existing}
                reordered = [existing_map[sid] for sid in order if sid in existing_map]
                for sid, it in existing_map.items():
                    if sid not in order:
                        reordered.append(it)
                if reordered:
                    _write_json_file(str(local_path), reordered)
            ctx.refresh_config()
            _send_json(self, {"ok": True})
        except Exception as e:
            _send_json(self, {"ok": False, "error": str(e)}, 400)

# ============================================================================
# Kivy 应用主类（新增）
# ============================================================================
class LanPlayApp(App):
    def build(self):
        # 请求存储权限（Android 6+）
        request_permissions([
            Permission.READ_EXTERNAL_STORAGE,
            Permission.WRITE_EXTERNAL_STORAGE,
            Permission.READ_MEDIA_IMAGES,
            Permission.READ_MEDIA_VIDEO
        ])

        self.webview = WebView()
        # 注入 JavaScript 接口（对象名为 'android'）
        self.webview.add_javascript_interface(self, 'android')
        # 启动 HTTP 服务器线程
        threading.Thread(target=self._run_server, daemon=True).start()
        # 加载本地页面
        Clock.schedule_once(lambda dt: self.webview.load_url('http://127.0.0.1:5000'), 0.5)
        return self.webview

    def _run_server(self):
        # 使用全局 httpd 对象（在启动 App 前创建）
        global httpd
        httpd.serve_forever()

    @javascript_interface
    def pickFile(self, callback_name: str):
        """JavaScript 调用的方法：弹出系统文件选择器"""
        self._js_callback = callback_name
        filechooser.open_file(
            title="选择图片或视频",
            filters=[("Images/Videos", "*.png;*.jpg;*.jpeg;*.gif;*.mp4;*.mov;*.avi;*.mkv;*.webm")],
            on_selection=self._on_file_selected
        )

    def _on_file_selected(self, selection):
        if selection and len(selection) > 0:
            file_path = selection[0]
            # 转义路径中的单引号，防止 JS 注入
            safe_path = file_path.replace("'", "\\'")
            js_code = f"window['{self._js_callback}']('{safe_path}');"
        else:
            js_code = f"window['{self._js_callback}'](null);"
        # 在主线程回调前端
        Clock.schedule_once(lambda dt: self.webview.evaluate_javascript(js_code), 0)

# ============================================================================
# 程序入口
# ============================================================================
if __name__ == '__main__':
    # 初始化上下文
    ctx.refresh_config()
    info(f"[配置] 初始服务器数: {len(ctx.servers)}")
    start_remote_download_thread()

    port = int(os.getenv("PORT", "5000"))
    global httpd
    httpd = ThreadingHTTPServer(("0.0.0.0", port), MonitorHandler)
    info(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 监控服务已启动，监听端口: {port}")
    info(f"[访问地址] http://127.0.0.1:{port}/")

    # 启动 Kivy App（Android 或桌面）
    LanPlayApp().run()
