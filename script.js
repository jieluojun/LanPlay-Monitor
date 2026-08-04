(() => {
  'use strict';

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());

  const CHAT_STORAGE_KEY = 'lanplay_chat_messages';
  const PUBLIC_STORAGE_KEY = 'lanplay_public_messages';
  const USERNAME_KEY = 'lan_play_username';
  const UNREAD_STORAGE_KEY = 'lanplay_unread_status';
  const PUBLIC_UNREAD_KEY = 'lanplay_public_unread';
  const AUTO_EXPAND_KEY = 'lan_play_auto_expand';

  const state = {
    servers: [],
    rooms: [],
    game: 'all',
    expanded: new Set(),
    loading: false,
    firstLoad: true,
    firstExpand: true,
    _domCache: new Map(),
    _defaultOrder: null,
    pollInterval: null,
    pollPaused: false,
    chatMessages: {},
    chatSubscribed: {},
    goEasyReady: false,
    goEasyRetries: 0,
    publicMessages: [],
    publicChatReady: false,
    username: '',
    publicModalOpen: false,
    frozenCardId: null,
    unreadStatus: {},
    autoExpand: true,
    onlineMembers: [],
    onlineCount: 0,
    presenceReady: false,
  };

  const savedAuto = localStorage.getItem(AUTO_EXPAND_KEY);
  if (savedAuto !== null) {
    state.autoExpand = savedAuto === 'true';
  } else {
    localStorage.setItem(AUTO_EXPAND_KEY, 'true');
  }

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const generateMsgId = () => Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);

  const QUESTION_ICON_DATA = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
    '<circle cx="24" cy="24" r="22" fill="#34495e"/>' +
    '<text x="24" y="34" text-anchor="middle" font-size="30" fill="white" font-family="sans-serif" font-weight="bold">?</text>' +
    '</svg>'
  );
  const UNKNOWN_ID = 'FFFFFFFFFFFFFFFF';

  // ---------- 滚动位置存储（聊天用） ----------
  const CHAT_SCROLL_PREFIX = 'lanplay_chat_scroll_';
  const PUBLIC_SCROLL_KEY = 'lanplay_public_scroll';

  function saveChatScroll(serverId, scrollTop) {
    try { localStorage.setItem(CHAT_SCROLL_PREFIX + serverId, String(scrollTop)); } catch(e) {}
  }
  function getChatScroll(serverId) {
    try { const v = localStorage.getItem(CHAT_SCROLL_PREFIX + serverId); return v !== null ? parseInt(v, 10) : null; } catch(e) { return null; }
  }
  function savePublicScroll(scrollTop) {
    try { localStorage.setItem(PUBLIC_SCROLL_KEY, String(scrollTop)); } catch(e) {}
  }
  function getPublicScroll() {
    try { const v = localStorage.getItem(PUBLIC_SCROLL_KEY); return v !== null ? parseInt(v, 10) : null; } catch(e) { return null; }
  }

  // ---------- Toast ----------
  let _globalToast = null;
  let _globalToastTimer = null;

  function _dismissToast() {
    if (_globalToast && _globalToast.parentElement) {
      try { _globalToast.parentElement.removeChild(_globalToast); } catch (e) { }
    }
    _globalToast = null;
    if (_globalToastTimer) { clearTimeout(_globalToastTimer); _globalToastTimer = null; }
  }

  function showToast(text, duration, isSuccess) {
    _dismissToast();
    const t = document.createElement('div');
    t.className = 'global-copy-toast';
    if (isSuccess === true) t.classList.add('success');
    else if (isSuccess === false) t.classList.add('error');
    t.textContent = text || '✓ 已复制';
    document.body.appendChild(t);
    t.offsetHeight;
    t.classList.add('show');
    _globalToast = t;
    const dur = duration || 2000;
    _globalToastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => {
        if (_globalToast === t) _dismissToast();
      }, 300);
    }, dur);
  }

  // ---------- 复制功能 ----------
  function copyServerName(text, el) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(String(text))
        .then(() => showToast('📋 已复制服务器名称: ' + text))
        .catch(() => fallbackCopyName(String(text)));
    } else {
      fallbackCopyName(String(text));
    }
  }
  function fallbackCopyName(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { }
    document.body.removeChild(ta);
    showToast('📋 已复制服务器名称: ' + text);
  }

  function copyServerAddress(text, el) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(String(text))
        .then(() => showToast('🔗 已复制服务器地址: ' + text))
        .catch(() => fallbackCopyAddress(String(text)));
    } else {
      fallbackCopyAddress(String(text));
    }
  }
  function fallbackCopyAddress(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { }
    document.body.removeChild(ta);
    showToast('🔗 已复制服务器地址: ' + text);
  }

  function copyWithMessage(text, successMsg) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(String(text))
        .then(() => showToast(successMsg || '✓ 已复制'))
        .catch(() => fallbackCopyWithMessage(String(text), successMsg));
    } else {
      fallbackCopyWithMessage(String(text), successMsg);
    }
  }
  function fallbackCopyWithMessage(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { }
    document.body.removeChild(ta);
    showToast(successMsg || '✓ 已复制');
  }

  // ===== 主题切换 =====
  const themeToggleBtn = $('themeToggleBtn');
  const htmlEl = document.documentElement;
  const savedTheme = localStorage.getItem('lan_play_theme');
  if (savedTheme) {
    if (savedTheme === 'dark') htmlEl.classList.add('dark');
    else htmlEl.classList.remove('dark');
  }

  function updateThemeColor() {
    const isDark = htmlEl.classList.contains('dark');
    const color = isDark ? '#0f1923' : '#dff3ff';
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.appendChild(meta);
    const iosMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (iosMeta) {
      iosMeta.content = isDark ? 'black-translucent' : 'default';
    }
  }

  function updateThemeIcon() {
    const isDark = htmlEl.classList.contains('dark') || (!localStorage.getItem('lan_play_theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    themeToggleBtn.textContent = isDark ? '🌞' : '🌙';
  }
  updateThemeIcon();
  updateThemeColor();

  let scrollColorTimer = null;
  document.addEventListener('scroll', () => {
    if (scrollColorTimer) cancelAnimationFrame(scrollColorTimer);
    scrollColorTimer = requestAnimationFrame(() => {
      updateThemeColor();
      scrollColorTimer = null;
    });
  }, { passive: true });

  themeToggleBtn.addEventListener('click', () => {
    const isDark = htmlEl.classList.contains('dark');
    if (isDark) {
      htmlEl.classList.remove('dark');
      htmlEl.classList.add('light');
      localStorage.setItem('lan_play_theme', 'light');
    } else {
      htmlEl.classList.remove('light');
      htmlEl.classList.add('dark');
      localStorage.setItem('lan_play_theme', 'dark');
    }
    updateThemeIcon();
    updateThemeColor();
    document.body.style.transform = 'scale(0.999)';
    const hero = document.querySelector('.hero');
    if (hero) {
      hero.style.transform = 'scale(0.999)';
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.style.transform = '';
        if (hero) {
          hero.style.transform = '';
        }
      });
    });
  });

  // ===== DPI 缩放 =====
  const dpiToggleBtn = document.getElementById('dpiToggleBtn');
  const dpiModal = document.getElementById('dpiModal');
  const closeDpiModalBtn = document.getElementById('closeDpiModalBtn');
  const dpiSlider = document.getElementById('dpiSlider');
  const dpiLabel = document.getElementById('dpiLabel');
  const dpiResetBtn = document.getElementById('dpiResetBtn');
  const DPI_STORAGE_KEY = 'lan_play_dpi_percent';

  dpiToggleBtn.textContent = '🔍';
  let currentDpiPercent = parseInt(localStorage.getItem(DPI_STORAGE_KEY), 10) || 100;

  function applyDpi(percent) {
    const clamped = Math.min(150, Math.max(60, percent));
    const ratio = clamped / 100;
    const serverList = document.getElementById('serverList');
    if (serverList) serverList.style.zoom = ratio;
    // 公共聊天弹窗输入区与服务器卡片聊天区共用同一 DPI
    const pubBox = document.querySelector('#publicChatModal .custom-modal-box');
    if (pubBox) pubBox.style.zoom = ratio;
    const onlineBox = document.querySelector('#onlineMembersModal .custom-modal-box');
    if (onlineBox) onlineBox.style.zoom = ratio;
    dpiLabel.textContent = Math.round(clamped) + '%';
    dpiSlider.value = clamped;
    localStorage.setItem(DPI_STORAGE_KEY, String(clamped));
    currentDpiPercent = clamped;
  }
  applyDpi(currentDpiPercent);

  dpiToggleBtn.addEventListener('click', () => {
    dpiModal.classList.add('open');
    dpiSlider.value = currentDpiPercent;
    dpiLabel.textContent = Math.round(currentDpiPercent) + '%';
  });

  function closeDpiModal() {
    dpiModal.classList.remove('open');
  }
  closeDpiModalBtn.addEventListener('click', closeDpiModal);
  dpiModal.addEventListener('click', (e) => {
    if (e.target === dpiModal) closeDpiModal();
  });

  dpiSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    applyDpi(val);
  });

  dpiResetBtn.addEventListener('click', () => {
    applyDpi(100);
    showToast('✅ 已恢复默认缩放 (100%)', 1500, true);
  });

  try {
    const oldIndex = localStorage.getItem('lan_play_dpi_index');
    if (oldIndex !== null) {
      const levels = [0.8, 0.9, 1.0, 1.1, 1.2];
      const idx = parseInt(oldIndex, 10);
      if (!isNaN(idx) && idx >= 0 && idx < levels.length) {
        const pct = levels[idx] * 100;
        localStorage.setItem(DPI_STORAGE_KEY, String(pct));
        applyDpi(pct);
      }
      localStorage.removeItem('lan_play_dpi_index');
    }
  } catch (e) { /* ignore */ }

  // ===== 插件链接复制 =====
  const PLUGIN_DOWNLOAD_URL = 'https://www.tomodachilife.cn/downloads/ldn-mitm/latest';
  function copyPluginLink() {
    copyWithMessage(PLUGIN_DOWNLOAD_URL, '✅ 已复制最新版联机插件地址！请前往浏览器下载');
  }
  $('copyPluginBtn').addEventListener('click', copyPluginLink);

  // ===== 模态框管理 =====
  const addServerModal = $('addServerModal');
  $('openAddModalBtn').addEventListener('click', () => addServerModal.classList.add('open'));
  $('closeAddModalBtn').addEventListener('click', () => addServerModal.classList.remove('open'));
  addServerModal.addEventListener('click', (e) => { if (e.target === addServerModal) addServerModal.classList.remove('open'); });

  // ============================================================
  // ★★★ 严格 IPv4 校验 ★★★
  // ============================================================
  function isValidHost(host) {
    if (!host || !host.trim()) return false;
    const trimmed = host.trim();
    if (/^[\d.]+$/.test(trimmed)) {
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) return false;
      const parts = trimmed.split('.');
      return parts.every(p => {
        const num = parseInt(p, 10);
        return num >= 0 && num <= 255 && p === String(num);
      });
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const ipv6 = trimmed.slice(1, -1);
      return /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::|^([0-9a-fA-F]{1,4}:){1,7}:$/.test(ipv6);
    }
    return /^(?!-)[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63})+$/.test(trimmed);
  }

  // ===== 自动解析 host:port =====
  function setupHostPortAutoFill(hostInput, portInput) {
    if (!hostInput || !portInput) return;
    hostInput.addEventListener('input', function(e) {
      const value = this.value.trim();
      if (value.includes(':')) {
        const parts = value.split(':');
        if (parts.length === 2) {
          const hostPart = parts[0].trim();
          const portPart = parts[1].trim();
          if (hostPart && /^\d+$/.test(portPart)) {
            const portNum = parseInt(portPart, 10);
            if (portNum >= 1 && portNum <= 65535) {
              this.value = hostPart;
              portInput.value = portNum;
            }
          }
        }
      }
    });
  }

  // ===== 添加服务器（含 ID） =====
  $('addServerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('.submit-btn');
    if (submitBtn.classList.contains('loading')) return;

    const id = document.getElementById('addId').value.trim();
    const name = document.getElementById('addName').value.trim();
    const host = document.getElementById('addHost').value.trim();
    const port = parseInt(document.getElementById('addPort').value) || 11451;
    const type = document.getElementById('addType').value;
    const region = document.getElementById('addRegion').value.trim();

    if (id && !/^[A-Za-z0-9_ -]{1,64}$/.test(id)) {
      showToast('❌ ID 格式无效，仅允许字母、数字、下划线、空格和连字符，长度1-64', 2500, false);
      document.getElementById('addId').focus();
      return;
    }
    if (!name) {
      showToast('❌ 请输入服务器名称', 2500, false);
      document.getElementById('addName').focus();
      return;
    }
    if (!isValidHost(host)) {
      showToast('❌ 请输入有效的主机地址（域名或IP）', 2500, false);
      document.getElementById('addHost').focus();
      return;
    }

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    const btnTextEl = submitBtn.querySelector('.btn-text');
    const originalText = btnTextEl.textContent;
    btnTextEl.textContent = '提交中...';

    try {
      const res = await fetch('/api/servers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id || undefined, name, host, port, type, region })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || '添加失败');
      document.getElementById('addId').value = '';
      document.getElementById('addName').value = '';
      document.getElementById('addHost').value = '';
      document.getElementById('addRegion').value = '';
      addServerModal.classList.remove('open');
      await load(true);
      showToast('✅ 服务器「' + name + '」添加成功！', 2000, true);
    } catch (err) {
      showToast('❌ 添加失败：' + err.message, 2500, false);
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      btnTextEl.textContent = originalText;
    }
  });

  // ===== 删除确认 =====
  const deleteModal = $('deleteConfirmModal');
  let pendingDelete = null;
  function openDeleteConfirm(serverId, serverName, cardEl) {
    pendingDelete = { id: serverId, name: serverName, cardEl };
    document.getElementById('deleteConfirmText').textContent = `确定要删除服务器「${serverName}」吗？此操作不可恢复。`;
    deleteModal.classList.add('open');
  }
  document.getElementById('closeDeleteModalBtn').addEventListener('click', () => { deleteModal.classList.remove('open'); pendingDelete = null; });
  document.getElementById('deleteCancelBtn').addEventListener('click', () => { deleteModal.classList.remove('open'); pendingDelete = null; });
  deleteModal.addEventListener('click', e => { if (e.target === deleteModal) { deleteModal.classList.remove('open'); pendingDelete = null; } });

  document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    deleteModal.classList.remove('open');
    pendingDelete = null;

    const btn = document.getElementById('deleteConfirmBtn');
    const originalText = btn.textContent;
    btn.textContent = '提交中...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/servers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || '删除失败');
      await load(true);
      showToast('🗑️ 服务器「' + name + '」删除成功！', 2000, true);
    } catch (e) {
      showToast('❌ 删除失败：' + e.message, 2500, false);
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });

  // ===== 恢复默认排序 =====
  const resetModal = document.getElementById('resetOrderModal');
  document.getElementById('resetOrderBtn').addEventListener('click', () => resetModal.classList.add('open'));
  document.getElementById('closeResetModalBtn').addEventListener('click', () => resetModal.classList.remove('open'));
  document.getElementById('resetCancelBtn').addEventListener('click', () => resetModal.classList.remove('open'));
  resetModal.addEventListener('click', e => { if (e.target === resetModal) resetModal.classList.remove('open'); });
  document.getElementById('resetConfirmBtn').addEventListener('click', async () => {
    resetModal.classList.remove('open');
    try {
      localStorage.removeItem('lan_play_server_order');
      await fetch('/api/servers/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: [], reset: true })
      });
      await load(true, true);
      showToast('🔄 已恢复默认排序', 2000, true);
    } catch (e) {
      showToast('❌ 恢复默认排序失败：' + e.message, 2500, false);
    }
  });

  // ===== 网络检测 =====
  async function getJSON(url) {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.ok === false) throw new Error(d.error || `请求失败 (${r.status})`);
    return d;
  }

  const netDot = document.getElementById('netDot');
  let netCheckTimer = null;
  let lastNetState = '';
  async function checkNetwork(force) {
    if (!netDot) return;
    if (!navigator.onLine) {
      netDot.classList.remove('online', 'offline');
      netDot.classList.add('offline');
      netDot.title = '网络已断开';
      lastNetState = 'offline';
      return;
    }
    const prevState = lastNetState;
    netDot.classList.remove('online', 'offline');
    netDot.title = '检测网络...';
    lastNetState = 'checking';
    try {
      const url = '/api/network-status' + (force ? '?refresh=1' : '?_=' + Date.now());
      const data = await getJSON(url);
      netDot.classList.remove('checking');
      if (data.ok && data.online) { netDot.classList.add('online'); netDot.title = '网络正常'; lastNetState = 'online'; }
      else { netDot.classList.add('offline'); netDot.title = '无网络连接'; lastNetState = 'offline'; }
    } catch (e) {
      netDot.classList.remove('checking');
      netDot.classList.add('offline');
      netDot.title = '网络检测失败：' + e.message;
      lastNetState = 'offline';
    }
    if (prevState && prevState !== lastNetState && lastNetState !== 'checking') setTimeout(() => checkNetwork(true), 3000);
  }
  function scheduleNetworkCheck() { if (netCheckTimer) clearInterval(netCheckTimer); netCheckTimer = setInterval(checkNetwork, 2000); }
  checkNetwork();
  scheduleNetworkCheck();

  // ===== 日志 =====
  const logModal = document.getElementById('logModal');
  const logContent = document.getElementById('logContent');
  let logInterval = null;
  async function fetchLogs() {
    try { const d = await getJSON('/api/logs'); if (d.ok && Array.isArray(d.logs)) { logContent.textContent = d.logs.join('\n'); logContent.scrollTop = logContent.scrollHeight; } } catch (e) { logContent.textContent = '加载日志失败: ' + e.message; }
  }
  document.getElementById('openLogModalBtn').addEventListener('click', () => { logModal.classList.add('open'); fetchLogs(); if (logInterval) clearInterval(logInterval); logInterval = setInterval(fetchLogs, 2000); });
  document.getElementById('closeLogBtn').addEventListener('click', () => { logModal.classList.remove('open'); if (logInterval) clearInterval(logInterval); });
  logModal.addEventListener('click', e => { if (e.target === logModal) { logModal.classList.remove('open'); if (logInterval) clearInterval(logInterval); } });

  // ===== 辅助函数 =====
  const statusDot = s => s === 'online' ? 'online' : s === 'checking' ? 'checking' : 'offline';
  function latencyHTML(s) {
    if (s.status !== 'online' || s.error || s.latency_ms == null || s.latency_ms < 0) return '<b class="latency-badge error">-</b>';
    const lat = s.latency_ms;
    if (lat <= 300) return `<b class="latency-badge fast">${lat}ms</b>`;
    return `<b class="latency-badge slow">${lat}ms</b>`;
  }

  // ===== 时间格式化 =====
  function formatMessageTime(timestamp) {
    const date = new Date(timestamp || Date.now());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const hour12 = hours % 12 || 12;
    const timeStr = hour12 + ':' + minutes + ':' + seconds;

    let period;
    if (hours < 5) period = '凌晨';
    else if (hours < 12) period = '上午';
    else if (hours < 13) period = '中午';
    else if (hours < 18) period = '下午';
    else period = '晚上';

    if (date >= today) {
      return period + ' ' + timeStr;
    } else if (date >= yesterday) {
      return '昨天 ' + timeStr;
    } else {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return month + '/' + day + ' ' + timeStr;
    }
  }

  // QQ 风格：两条消息间隔超过 5 分钟则插入时间分割线
  const CHAT_TIME_GAP_MS = 5 * 60 * 1000;

  function shouldShowTimeDivider(prevTs, currTs) {
    if (prevTs == null || currTs == null) return true;
    const a = Number(prevTs);
    const b = Number(currTs);
    if (!a || !b || isNaN(a) || isNaN(b)) return true;
    return Math.abs(b - a) >= CHAT_TIME_GAP_MS;
  }

  function buildChatMessagesHtml(messages) {
    if (!messages || !messages.length) return '';
    let html = '';
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const t = msg.time || Date.now();
      const cls = msg.isMine ? 'chat-msg-mine' : 'chat-msg-other';
      const sender = msg.sender || '匿名';
      const contentHtml = renderMessageContent(msg);
      const timeLabel = formatMessageTime(t);
      // 布局：用户名 → 消息 → 时间（时间字体约为消息一半）
      html += '<div class="chat-msg ' + cls + '">' +
        '<div class="msg-sender">' + esc(sender) + '：</div>' +
        '<div class="msg-body">' + contentHtml + '</div>' +
        '<div class="msg-time">' + esc(timeLabel) + '</div>' +
      '</div>';
    }
    return html;
  }

  // ===== 双副本 HTML（改为省略号） =====
  function makeServerNameHtml(name, copyText) {
    const escaped = esc(name);
    return `<span class="server-name ellipsis" data-copytext="${esc(copyText)}" title="点击复制服务器名称">${escaped}</span>`;
  }

  function makeServerAddressHtml(address, copyText) {
    const escaped = esc(address);
    return `<span class="server-address ellipsis" data-copytext="${esc(copyText)}" title="点击复制服务器地址: ${esc(copyText)}">${escaped}</span>`;
  }

  // ===== roomCard =====
  function roomCard(room) {
    const players = Array.isArray(room.players) ? room.players : [];
    const count = `${room.node_count || players.length}${room.node_count_max ? ' / ' + room.node_count_max : ''} 人`;
    const gameVal = String(room.game || '');
    const contentId = String(room.content_id || '').toUpperCase();
    const isUnknownId = contentId === UNKNOWN_ID;
    const isUnknown = gameVal.includes('未知游戏') && !isUnknownId;
    const iconUrl = room.game_icon || QUESTION_ICON_DATA;
    const finalIcon = (isUnknown || !iconUrl || iconUrl === '') ? QUESTION_ICON_DATA : iconUrl;

    let iconHtml;
    if (contentId === UNKNOWN_ID) {
      iconHtml = `<span class="room-icon" style="display:inline-block;width:22px;height:22px;border-radius:4px;background:#34495e;color:white;text-align:center;line-height:22px;font-weight:bold;font-size:14px;" title="${esc(room.game)}">?</span>`;
    } else {
      iconHtml = `<img src="${finalIcon}" alt="${esc(room.game)}" title="${esc(room.game)}" class="room-icon" loading="lazy" onerror="this.onerror=null;this.src='${QUESTION_ICON_DATA}'">`;
    }

    const gameDisplay = gameVal;
    const canCopy = isUnknown && !isUnknownId;
    const copyClass = canCopy ? 'copy-game-id' : 'no-copy';
    const gameTitle = canCopy ? `点击复制游戏 ID: ${contentId}` : gameVal;

    let gameNameHtml = `<span class="game-name ${copyClass} ellipsis" data-contentid="${esc(contentId)}" data-isunknown="${canCopy ? 'true' : 'false'}" title="${esc(gameTitle)}">${esc(gameDisplay)}</span>`;

    const hostName = room.host || '未知房间';
    let hostHtml = `<span class="room-host-meta"><span class="host-icon-fixed">🏠</span><span class="host-name ellipsis">${esc(hostName)}</span></span>`;

    const roomId = esc(room.id || '');
    const gameKey = normalizeFilterGame(gameVal);
    return `<div class="room-item" data-game="${esc(gameVal)}" data-game-key="${esc(gameKey)}" data-room-id="${roomId}">
      <div class="room-top">
        <div class="room-game-left">
          ${iconHtml}
          ${gameNameHtml}
        </div>
      </div>
      <div class="room-meta">
        <span class="green">● 正在联机</span>
        <span>|</span>
        <span>${esc(count)}</span>
        <span>|</span>
        ${hostHtml}
      </div>
      <div class="room-players">${players.map(p => `<span class="player">${esc(p)}</span>`).join('')}</div>
    </div>`;
  }

  // ===== 新消息数字角标相关函数 =====
  function normalizeUnreadCount(v) {
    if (v === true) return 1; // 兼容旧布尔值
    const n = parseInt(v, 10);
    return isNaN(n) || n < 0 ? 0 : n;
  }

  function getUnreadCount(serverId) {
    return normalizeUnreadCount(state.unreadStatus[serverId]);
  }

  function loadUnreadStatus() {
    try {
      const data = localStorage.getItem(UNREAD_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'object' && parsed !== null) {
          const normalized = {};
          Object.keys(parsed).forEach(k => {
            const n = normalizeUnreadCount(parsed[k]);
            if (n > 0) normalized[k] = n;
          });
          state.unreadStatus = normalized;
          return;
        }
      }
    } catch (e) { /* ignore */ }
    state.unreadStatus = {};
  }

  function saveUnreadStatus() {
    try {
      localStorage.setItem(UNREAD_STORAGE_KEY, JSON.stringify(state.unreadStatus));
    } catch (e) { /* ignore */ }
  }

  function applyUnreadToElement(el, count) {
    if (!el) return;
    if (count > 0) {
      el.textContent = count > 99 ? '99+' : String(count);
      el.style.display = 'inline-block';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  function updateUnreadIndicators() {
    document.querySelectorAll('.unread-indicator').forEach(el => {
      const sid = el.dataset.serverId;
      applyUnreadToElement(el, getUnreadCount(sid));
    });
  }

  function syncUnreadWithExpanded() {
    let changed = false;
    state.expanded.forEach(id => {
      if (getUnreadCount(id) > 0) {
        delete state.unreadStatus[id];
        changed = true;
      }
    });
    if (changed) {
      saveUnreadStatus();
      updateUnreadIndicators();
    }
  }

  function ensureUnreadIndicator(card, serverId) {
    let indicator = card.querySelector('.unread-indicator');
    if (!indicator) {
      const stats = card.querySelector('.server-stats');
      if (stats) {
        indicator = document.createElement('span');
        indicator.className = 'unread-indicator';
        indicator.dataset.serverId = serverId;
        stats.parentNode.insertBefore(indicator, stats);
      }
    }
    applyUnreadToElement(indicator, getUnreadCount(serverId));
  }

  // 服务器错误角标（卡片顶部居中，文案随错误变化）
  function ensureErrorBadge(card, errorText) {
    if (!card) return;
    const host = card.querySelector('.server-card-inner') || card;
    card.querySelectorAll('.server-error').forEach(el => el.remove());
    let badge = host.querySelector('.server-error-badge');
    if (!badge) badge = card.querySelector('.server-error-badge');
    const text = (errorText || '').trim();
    if (!text) {
      if (badge) {
        badge.classList.remove('show');
        badge.textContent = '';
        badge.removeAttribute('title');
      }
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'server-error-badge';
      host.appendChild(badge);
    } else if (badge.parentElement !== host) {
      host.appendChild(badge);
    }
    const label = text.length > 28 ? text.slice(0, 28) + '…' : text;
    if (badge.textContent !== label) badge.textContent = label;
    badge.title = text;
    badge.classList.add('show');
  }

  // ===== 滑动交互（仅对自定义服务器启用） =====
  const SWIPE_THRESHOLD = 40;
  const ACTION_WIDTH = 160;

  function initSwipe(card) {
    const serverId = card.dataset.id;
    const server = state.servers.find(s => s.id === serverId);
    if (!server || !server.is_manual) {
      const actions = card.querySelector('.server-actions');
      if (actions) actions.style.display = 'none';
      return;
    }
    if (card.dataset.swipeBound === 'true') return;
    card.dataset.swipeBound = 'true';

    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let isSwiping = false;
    let startTime = 0;
    let offset = 0;

    const inner = card.querySelector('.server-card-inner');
    if (!inner) return;

    function updateTransform(x) {
      const clamped = Math.min(0, Math.max(-ACTION_WIDTH, x));
      offset = Math.abs(clamped);
      inner.style.transform = `translateX(${clamped}px)`;
      if (offset >= ACTION_WIDTH - 10) {
        card.classList.add('swipe-open');
      } else {
        card.classList.remove('swipe-open');
      }
    }

    function onStart(e) {
      const touch = e.touches ? e.touches[0] : e;
      startX = touch.clientX;
      currentX = startX;
      startTime = Date.now();
      isDragging = true;
      isSwiping = false;
      if (card.classList.contains('swipe-open')) {
        offset = ACTION_WIDTH;
        inner.style.transform = `translateX(${-ACTION_WIDTH}px)`;
      } else {
        offset = 0;
        inner.style.transform = `translateX(0px)`;
      }
    }

    function onMove(e) {
      if (!isDragging) return;
      const touch = e.touches ? e.touches[0] : e;
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - (e.changedTouches ? e.changedTouches[0].clientY : 0);
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
        isSwiping = true;
        e.preventDefault();
      }
      if (!isSwiping) return;
      const newOffset = offset - deltaX;
      updateTransform(-newOffset);
      currentX = touch.clientX;
    }

    function onEnd(e) {
      if (!isDragging) return;
      isDragging = false;
      const dt = Date.now() - startTime;
      const dx = Math.abs(currentX - startX);
      if (dx < 10 && dt < 300) {
        isSwiping = false;
        if (card.classList.contains('swipe-open')) {
          updateTransform(-ACTION_WIDTH);
        } else {
          updateTransform(0);
        }
        return;
      }
      if (isSwiping) {
        if (offset > SWIPE_THRESHOLD) {
          updateTransform(-ACTION_WIDTH);
          card.classList.add('swipe-open');
        } else {
          updateTransform(0);
          card.classList.remove('swipe-open');
        }
      }
      isSwiping = false;
    }

    card.addEventListener('touchstart', onStart, { passive: true });
    card.addEventListener('touchmove', onMove, { passive: false });
    card.addEventListener('touchend', onEnd, { passive: true });

    let mouseDown = false;
    card.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      mouseDown = true;
      onStart(e);
    });
    document.addEventListener('mousemove', (e) => {
      if (!mouseDown) return;
      onMove(e);
    });
    document.addEventListener('mouseup', (e) => {
      if (!mouseDown) return;
      mouseDown = false;
      onEnd(e);
    });

    const head = card.querySelector('.server-head');
    if (head) {
      head.addEventListener('click', (e) => {
        if (card.classList.contains('swipe-open')) {
          e.stopPropagation();
          card.classList.remove('swipe-open');
          updateTransform(0);
          return;
        }
        if (isSwiping) {
          e.stopPropagation();
          isSwiping = false;
          return;
        }
      });
    }

    const editBtn = card.querySelector('.action-edit');
    const deleteBtn = card.querySelector('.action-delete');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sid = card.dataset.id;
        const server = state.servers.find(s => s.id === sid);
        if (server) {
          openEditModal(sid, server.name, card);
        }
        card.classList.remove('swipe-open');
        updateTransform(0);
      });
    }
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sid = card.dataset.id;
        const server = state.servers.find(s => s.id === sid);
        if (server) {
          openDeleteConfirm(sid, server.name, card);
        }
        card.classList.remove('swipe-open');
        updateTransform(0);
      });
    }

    card._resetSwipe = function() {
      card.classList.remove('swipe-open');
      updateTransform(0);
    };
  }

  // ===== 获取类型标签 HTML =====
  function getTypeBadge(server) {
    let type = '';
    let cls = '';
    if (server.is_builtin) {
      type = '内置';
      cls = 'builtin';
    } else if (server.is_remote) {
      type = '远程';
      cls = 'remote';
    } else if (server.is_manual) {
      type = '自定义';
      cls = 'manual';
    } else {
      return '';
    }
    return `<span class="server-type-badge ${cls}">${type}</span>`;
  }

  // ===== 筛选应用 =====
  function applyFilter(autoExpand) {
    if (autoExpand === undefined) autoExpand = false;
    // 正在卡片内聊天时，不允许筛选逻辑把其它卡片自动展开
    let chattingNow = false;
    if (state.autoExpand) {
      for (let i = 0; i < state.servers.length; i++) {
        if (isServerChatActive(state.servers[i].id)) { chattingNow = true; break; }
      }
    }
    const effectiveAutoExpand = autoExpand && state.autoExpand && !chattingNow;

    const g = state.game;
    const isAll = (g === 'all');
    const isAllServers = (g === 'all_servers');
    const filteredRooms = isAllServers || isAll
      ? state.rooms
      : state.rooms.filter(r => roomMatchesFilterGame(r, g));
    const onlineCount = state.servers.filter(s => s.status === 'online').length;
    document.getElementById('ovServers').textContent = `${onlineCount}/${state.servers.length}`;
    document.getElementById('ovOnline').textContent = state.servers.filter(s => s.status === 'online').reduce((a, s) => a + (s.online || 0), 0);
    document.getElementById('ovIdle').textContent = state.servers.filter(s => s.status === 'online').reduce((a, s) => a + (s.idle || 0), 0);
    document.getElementById('ovRooms').textContent = filteredRooms.length;
    document.querySelectorAll('.room-item').forEach(el => {
      const roomGame = el.dataset.gameKey || normalizeFilterGame(el.dataset.game);
      el.style.display = (isAll || isAllServers || roomGame === normalizeFilterGame(g)) ? '' : 'none';
    });
    state.servers.forEach(s => {
      const group = document.querySelector(`.server-group[data-id="${s.id}"]`);
      if (!group) return;
      const items = group.querySelectorAll('.room-item');
      let visible = 0;
      items.forEach(el => { if (el.style.display !== 'none') visible++; });
      const isOnline = s.status === 'online' && !s.error;
      if (isAllServers) {
        group.style.display = '';
        if (effectiveAutoExpand && !group.classList.contains('open')) { group.classList.add('open'); state.expanded.add(s.id); }
        group.querySelectorAll('.no-rooms,.no-rooms-empty,.no-rooms-match').forEach(el => el.remove());
        // 以数据源判断是否有房间，避免 DOM 尚未刷出房间列表时误显示“暂无公开房间”
        const serverRoomCount = state.rooms.filter(r => r.server_id === s.id).length;
        if (serverRoomCount === 0 && items.length === 0 && isOnline) {
          let m = group.querySelector('.no-rooms-empty');
          if (!m) {
            m = document.createElement('div');
            m.className = 'no-rooms-empty no-rooms';
            m.textContent = '📭 该服务器暂无公开房间';
            const body = group.querySelector('.server-body > .body-inner');
            if (body) {
              const chat = body.querySelector('.chat-wrapper');
              if (chat) {
                if (chat.nextSibling) body.insertBefore(m, chat.nextSibling);
                else body.appendChild(m);
              } else {
                body.appendChild(m);
              }
            }
          }
          m.style.display = '';
        }
      } else if (isAll) {
        // 总房间：有保活房间就显示（不因短暂离线/超时隐藏）
        const hasKept = state.rooms.some(r => r.server_id === s.id);
        const hasAny = items.length > 0 || hasKept;
        group.style.display = hasAny ? '' : 'none';
        if (effectiveAutoExpand && hasAny && !group.classList.contains('open')) { group.classList.add('open'); state.expanded.add(s.id); }
        group.querySelectorAll('.no-rooms,.no-rooms-empty,.no-rooms-match').forEach(el => el.remove());
      } else {
        // 游戏筛选（含未知游戏）：有匹配保活房间就显示，不要求服务器当前在线
        const hasKeptMatch = state.rooms.some(
          r => r.server_id === s.id && roomMatchesFilterGame(r, g)
        );
        if (visible > 0 || hasKeptMatch) {
          group.style.display = '';
          if (effectiveAutoExpand && !group.classList.contains('open')) { group.classList.add('open'); state.expanded.add(s.id); }
          group.querySelectorAll('.no-rooms,.no-rooms-empty').forEach(el => el.style.display = 'none');
        } else {
          group.style.display = 'none';
          group.querySelectorAll('.no-rooms,.no-rooms-empty').forEach(el => el.style.display = 'none');
        }
      }
    });
    let gm = document.getElementById('no-server-match');
    if (!isAll && !isAllServers && document.querySelectorAll('.server-group:not([style*="display: none"])').length === 0) {
      if (!gm) { gm = document.createElement('div'); gm.id = 'no-server-match'; gm.className = 'no-rooms'; gm.style.cssText = 'text-align:center;padding:24px;font-size:14px;'; document.getElementById('serverList').appendChild(gm); }
      gm.textContent = `🔍 没有服务器有游戏「${g}」的房间`;
      gm.style.display = '';
    } else if (gm) gm.style.display = 'none';

    // 不再需要 checkOverflow
  }

  // ===== 拖拽排序 =====
  let draggedEl = null;
  function initDragAndDrop(div, s) {
    div.setAttribute('draggable', 'true');
    div.addEventListener('dragstart', e => { draggedEl = div; div.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    div.addEventListener('dragend', () => {
      div.classList.remove('dragging');
      draggedEl = null;
      document.querySelectorAll('.server-group').forEach(el => el.classList.remove('drag-over'));
    });
    div.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (div !== draggedEl) div.classList.add('drag-over'); });
    div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
    div.addEventListener('drop', e => {
      e.preventDefault();
      div.classList.remove('drag-over');
      if (draggedEl && draggedEl !== div) {
        const list = document.getElementById('serverList');
        const all = [...list.querySelectorAll('.server-group')];
        const di = all.indexOf(draggedEl);
        const ti = all.indexOf(div);
        if (di < ti) div.parentNode.insertBefore(draggedEl, div.nextSibling);
        else div.parentNode.insertBefore(draggedEl, div);

        const newServers = [];
        document.querySelectorAll('.server-group').forEach(el => {
          const id = el.dataset.id;
          const server = state.servers.find(s => s.id === id);
          if (server) newServers.push(server);
        });
        state.servers = newServers;
        state._defaultOrder = state.servers.map(s => ({ id: s.id }));
        saveCurrentOrder();
      }
    });
  }

  function saveCurrentOrder() {
    const ids = state.servers.map(s => s.id);
    try { localStorage.setItem('lan_play_server_order', JSON.stringify(ids)); } catch (e) { }
    fetch('/api/servers/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: ids }) }).catch(() => { });
  }

  function loadSavedOrder() {
    try {
      const cached = localStorage.getItem('lan_play_server_order');
      if (!cached) return false;
      const arr = JSON.parse(cached);
      if (!Array.isArray(arr) || !arr.length) return false;
      const map = {};
      state.servers.forEach(s => { map[s.id] = s; });
      const ordered = arr.map(id => map[id]).filter(Boolean);
      state.servers.forEach(s => {
        if (!arr.includes(s.id)) ordered.push(s);
      });
      if (ordered.length) {
        state.servers = ordered;
        state._defaultOrder = state.servers.map(s => ({ id: s.id }));
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  // ===== 编辑模态框（含 ID 修改） =====
  let editModalInstance = null;

  function openEditModal(serverId, serverName, cardEl) {
    if (editModalInstance) {
      editModalInstance.remove();
      editModalInstance = null;
    }

    const server = state.servers.find(s => s.id === serverId);
    if (!server) {
      showToast('❌ 未找到服务器数据', 1500, false);
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'custom-modal open';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="custom-modal-box" style="width:min(450px,calc(100% - 32px));">
        <div class="custom-modal-header">
          <span>✏️ 编辑服务器</span>
          <button class="custom-modal-close edit-modal-close">✕</button>
        </div>
        <div class="custom-modal-body">
          <form id="editServerForm" class="form-grid">
            <div class="form-row">
              <input type="text" id="editId" placeholder="服务器ID (可选)" value="${esc(server.id)}" pattern="[A-Za-z0-9_ -]{1,64}" title="仅允许字母、数字、下划线、空格和连字符，长度1-64">
            </div>
            <div class="form-row">
              <input type="text" id="editName" placeholder="服务器名称 (必填)" value="${esc(server.name)}" required>
            </div>
            <div class="form-row">
              <input type="text" id="editHost" placeholder="主机地址" value="${esc(server.host)}" required>
            </div>
            <div class="form-row-group">
              <input type="number" id="editPort" value="${server.port || 11451}" placeholder="端口" required>
              <select id="editType">
                <option value="graphql" ${server.type === 'graphql' ? 'selected' : ''}>GraphQL</option>
                <option value="rest" ${server.type === 'rest' ? 'selected' : ''}>REST</option>
              </select>
            </div>
            <div class="form-row">
              <input type="text" id="editRegion" placeholder="地区标签" value="${esc(server.region || '')}">
            </div>
            <button type="submit" class="submit-btn" id="editSubmitBtn">
              <span class="spinner"></span>
              <span class="btn-text">保存修改</span>
            </button>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    editModalInstance = modal;

    const editHost = document.getElementById('editHost');
    const editPort = document.getElementById('editPort');
    setupHostPortAutoFill(editHost, editPort);

    const closeBtn = modal.querySelector('.edit-modal-close');
    closeBtn.addEventListener('click', () => {
      modal.remove();
      editModalInstance = null;
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        editModalInstance = null;
      }
    });

    const form = modal.querySelector('#editServerForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('editSubmitBtn');
      if (submitBtn.classList.contains('loading')) return;

      const newId = document.getElementById('editId').value.trim();
      const name = document.getElementById('editName').value.trim();
      const host = document.getElementById('editHost').value.trim();
      const port = parseInt(document.getElementById('editPort').value) || 11451;
      const type = document.getElementById('editType').value;
      const region = document.getElementById('editRegion').value.trim();

      if (newId && !/^[A-Za-z0-9_ -]{1,64}$/.test(newId)) {
        showToast('❌ 新 ID 格式无效，仅允许字母、数字、下划线、空格和连字符，长度1-64', 2500, false);
        document.getElementById('editId').focus();
        return;
      }
      if (!name) {
        showToast('❌ 请输入服务器名称', 2500, false);
        document.getElementById('editName').focus();
        return;
      }
      if (!isValidHost(host)) {
        showToast('❌ 请输入有效的主机地址（域名或IP）', 2500, false);
        document.getElementById('editHost').focus();
        return;
      }

      submitBtn.classList.add('loading');
      submitBtn.disabled = true;
      const btnTextEl = submitBtn.querySelector('.btn-text');
      const originalText = btnTextEl.textContent;
      btnTextEl.textContent = '提交中...';

      try {
        const res = await fetch('/api/servers/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: serverId, 
            new_id: newId || serverId, 
            name, host, port, type, region 
          })
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.ok) throw new Error(d.error || '编辑失败');
        modal.remove();
        editModalInstance = null;
        await load(true);
        showToast('✅ 服务器「' + name + '」已更新', 2000, true);
      } catch (err) {
        showToast('❌ 编辑失败：' + err.message, 2500, false);
      } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
        btnTextEl.textContent = originalText;
      }
    });
  }

  // ============================================================
  // ========== GoEasy IM 即时通讯（纯 IM + 离线消息） ==========
  // ============================================================
  let goEasy = null;
  const CHAT_PREFIX = 'lanplay_chat_';
  const PUBLIC_CHANNEL = 'public_chat';
  const PRESENCE_GROUP = 'lanplay_presence';
  const PRESENCE_TTL_MS = 90 * 1000;
  const PRESENCE_HEARTBEAT_MS = 25 * 1000;
  const HISTORY_LIMIT = 30;
  let goEasyInitTimer = null;
  let presenceHeartbeatTimer = null;
  let presenceExpireTimer = null;
  let _imListenersBound = false;
  const _presenceMap = Object.create(null);
  const _pendingReadByGroup = Object.create(null);
  const _historySynced = Object.create(null);

  function serverGroupId(serverId) { return CHAT_PREFIX + String(serverId); }
  function groupToServerId(groupId) {
    if (!groupId || groupId === PUBLIC_CHANNEL || groupId === PRESENCE_GROUP) return null;
    const s = String(groupId);
    return s.startsWith(CHAT_PREFIX) ? s.slice(CHAT_PREFIX.length) : null;
  }
  function imSceneGroup() {
    try { if (typeof GoEasy !== 'undefined' && GoEasy.IM_SCENE) return GoEasy.IM_SCENE.GROUP; } catch (e) {}
    return 'group';
  }
  function getIm() { return (goEasy && goEasy.im) ? goEasy.im : null; }
  function buildGroupTo(groupId, label) {
    return { type: imSceneGroup(), id: groupId, data: { nickname: label || groupId, avatar: '' } };
  }

  let usernameModalInstance = null;
  function getStoredUsername() { return localStorage.getItem(USERNAME_KEY) || ''; }

  function loadChatMessages() {
    try {
      const data = localStorage.getItem(CHAT_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'object' && parsed !== null) { state.chatMessages = parsed; return; }
      }
    } catch (e) {}
    state.chatMessages = {};
  }
  function saveChatMessages() {
    try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state.chatMessages)); } catch (e) {}
  }
  function loadPublicMessages() {
    try {
      const data = localStorage.getItem(PUBLIC_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) { state.publicMessages = parsed; return; }
      }
    } catch (e) {}
    state.publicMessages = [];
  }
  function savePublicMessages() {
    try { localStorage.setItem(PUBLIC_STORAGE_KEY, JSON.stringify(state.publicMessages)); } catch (e) {}
  }

  function updateAllMessagesIsMine() {
    const currentUser = state.username;
    Object.keys(state.chatMessages).forEach(serverId => {
      const msgs = state.chatMessages[serverId];
      if (msgs) {
        msgs.forEach(msg => { msg.isMine = (msg.sender === currentUser); });
        renderChatMessages(serverId, false);
      }
    });
    if (state.publicMessages) {
      state.publicMessages.forEach(msg => { msg.isMine = (msg.sender === currentUser); });
      renderPublicChat(false);
    }
    saveChatMessages();
    savePublicMessages();
  }

  function saveUsername(name) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    localStorage.setItem(USERNAME_KEY, trimmed);
    state.username = trimmed;
    updateAllMessagesIsMine();
    updateChatUI();
    if (state.goEasyReady) sendPresenceAction('join');
    return true;
  }

  function showUsernamePrompt(callback) {
    if (usernameModalInstance) {
      try { document.body.removeChild(usernameModalInstance); } catch (e) {}
      usernameModalInstance = null;
    }
    const overlay = document.createElement('div');
    overlay.className = 'custom-modal open';
    overlay.innerHTML = `
      <div class="custom-modal-box" style="width:min(380px,calc(100% - 32px));">
        <div class="custom-modal-header"><span>设置聊天昵称</span>
          <button class="custom-modal-close" type="button">✕</button></div>
        <div class="custom-modal-body"><div class="form-grid">
          <div class="form-row">
            <input type="text" id="usernamePromptInput" placeholder="请输入昵称（2-16字）" maxlength="16" value="${esc(state.username || '')}">
          </div>
          <button type="button" class="submit-btn" id="usernamePromptConfirm">确认</button>
        </div></div>
      </div>`;
    document.body.appendChild(overlay);
    usernameModalInstance = overlay;
    const input = overlay.querySelector('#usernamePromptInput');
    const confirmBtn = overlay.querySelector('#usernamePromptConfirm');
    const closeBtn = overlay.querySelector('.custom-modal-close');
    function cleanup() {
      try { document.body.removeChild(overlay); } catch (e) {}
      usernameModalInstance = null;
    }
    function doConfirm() {
      const v = (input.value || '').trim();
      if (v.length < 2) { showToast('昵称至少 2 个字符', 1500, false); return; }
      if (saveUsername(v)) { cleanup(); if (typeof callback === 'function') callback(v); }
    }
    confirmBtn.addEventListener('click', doConfirm);
    closeBtn.addEventListener('click', cleanup);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doConfirm(); } });
    setTimeout(() => input.focus(), 50);
  }

  function ensureUsername(callback) {
    if (state.username && state.username.trim()) {
      if (typeof callback === 'function') callback(state.username);
      return;
    }
    const stored = getStoredUsername();
    if (stored) {
      state.username = stored;
      if (typeof callback === 'function') callback(stored);
      return;
    }
    showUsernamePrompt(callback);
  }

  function updateChatUI() {
    const hasUsername = !!(state.username && state.username.trim());
    const ready = state.goEasyReady && hasUsername;
    document.querySelectorAll('.server-group .chat-input').forEach(inp => {
      inp.disabled = !ready;
      inp.placeholder = ready ? '输入聊天内容...' : (state.goEasyReady ? '请先设置用户名' : '聊天未连接');
    });
    document.querySelectorAll('.server-group .chat-send-btn').forEach(btn => { btn.disabled = !ready; });
    document.querySelectorAll('.server-group .chat-image-btn, .server-group .image-upload-btn').forEach(btn => { btn.disabled = !ready; });
    const pubInput = document.getElementById('publicChatInput');
    const pubSend = document.getElementById('publicChatSendBtn');
    const pubImg = document.getElementById('publicChatImageBtn');
    if (pubInput) {
      pubInput.disabled = !ready;
      pubInput.placeholder = ready ? '输入公共消息...' : (state.goEasyReady ? '请先设置用户名' : '聊天未连接');
    }
    if (pubSend) pubSend.disabled = !ready;
    if (pubImg) pubImg.disabled = !ready;
  }

  function detectMediaKind(file) {
    const t = (file && file.type) || '';
    const name = (file && file.name) || '';
    if (t.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(name)) return 'image';
    if (t.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv)$/i.test(name)) return 'video';
    if (t.startsWith('audio/') || /\.(mp3|m4a|wav|aac|ogg|amr)$/i.test(name)) return 'audio';
    return 'file';
  }

  const chatDrafts = Object.create(null);
  const _sendingLock = Object.create(null);
  const _recentMineMedia = [];

  function draftKey(serverId, isPublic) { return isPublic ? 'public' : String(serverId || ''); }

  function clearDraft(key) {
    const d = chatDrafts[key];
    if (d && d.items) {
      d.items.forEach(function (it) {
        if (it.previewUrl) { try { URL.revokeObjectURL(it.previewUrl); } catch (e) {} }
      });
    }
    delete chatDrafts[key];
    renderDraftPreview(key);
  }

  function setDraft(key, file, kind) {
    // 兼容单文件：覆盖为单条草稿队列
    clearDraft(key);
    const item = { file: file, kind: kind, previewUrl: URL.createObjectURL(file), name: file.name || '' };
    chatDrafts[key] = { items: [item], file: file, kind: kind, previewUrl: item.previewUrl, name: item.name };
    renderDraftPreview(key);
  }

  function setDraftFiles(key, files) {
    clearDraft(key);
    const items = [];
    Array.from(files || []).forEach(function (file) {
      if (!file) return;
      const kind = detectMediaKind(file);
      items.push({ file: file, kind: kind, previewUrl: URL.createObjectURL(file), name: file.name || '' });
    });
    if (!items.length) return;
    const first = items[0];
    chatDrafts[key] = { items: items, file: first.file, kind: first.kind, previewUrl: first.previewUrl, name: first.name };
    renderDraftPreview(key);
  }

  function getDraftHost(key) {
    if (key === 'public') {
      const modal = document.getElementById('publicChatModal');
      if (!modal) return null;
      let host = modal.querySelector('.chat-draft-host');
      if (!host) {
        const area = modal.querySelector('.chat-input-area');
        if (!area || !area.parentElement) return null;
        host = document.createElement('div');
        host.className = 'chat-draft-host';
        area.parentElement.insertBefore(host, area);
      }
      return host;
    }
    const card = document.querySelector('.server-group[data-id="' + key + '"]');
    if (!card) return null;
    const wrapper = card.querySelector('.chat-wrapper');
    if (!wrapper) return null;
    let host = wrapper.querySelector('.chat-draft-host');
    if (!host) {
      const area = wrapper.querySelector('.chat-input-area');
      host = document.createElement('div');
      host.className = 'chat-draft-host';
      if (area) wrapper.insertBefore(host, area); else wrapper.appendChild(host);
    }
    return host;
  }

  function renderDraftPreview(key) {
    const host = getDraftHost(key);
    if (!host) return;
    const d = chatDrafts[key];
    if (!d || !d.items || !d.items.length) { host.innerHTML = ''; host.style.display = 'none'; return; }
    host.style.display = 'block';
    const thumbs = d.items.map(function (it, idx) {
      let inner = '';
      if (it.kind === 'image') inner = '<img class="chat-draft-thumb" src="' + esc(it.previewUrl) + '" alt="预览">';
      else if (it.kind === 'video') inner = '<video class="chat-draft-thumb" src="' + esc(it.previewUrl) + '" muted playsinline></video><span class="chat-draft-badge">视频</span>';
      else if (it.kind === 'audio') inner = '<div class="chat-draft-audio">🎤 语音</div>';
      else inner = '<div class="chat-draft-file">📎 ' + esc(it.name || '文件') + '</div>';
      return '<div class="chat-draft-item" data-idx="' + idx + '">' + inner + '</div>';
    }).join('');
    const countLabel = d.items.length > 1 ? ('<span class="chat-draft-count">' + d.items.length + ' 个文件</span>') : '';
    host.innerHTML = '<div class="chat-draft-bar"><div class="chat-draft-media chat-draft-media-multi">' + thumbs + '</div>' + countLabel + '<button type="button" class="chat-draft-remove" title="取消">✕</button></div>';
    const rm = host.querySelector('.chat-draft-remove');
    if (rm) rm.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); clearDraft(key); });
  }

  function pickMediaAsDraft(serverId, isPublic) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,video/*';
    fileInput.multiple = true;
    fileInput.onchange = function (e) {
      const files = e.target.files;
      if (!files || !files.length) return;
      const key = draftKey(serverId, isPublic);
      // 视频通常一次一个；图片可多选。混合时全部加入队列
      setDraftFiles(key, files);
    };
    fileInput.click();
  }

  function sendMessageWithMedia(serverId, inputElement, sendFunction, isPublic) {
    pickMediaAsDraft(serverId, !!isPublic);
  }

  function normalizeUploadProgress(p) {
    if (p == null || p === '') return null;
    if (typeof p === 'number' && isFinite(p)) return p <= 1 ? Math.round(p * 100) : Math.round(p);
    if (typeof p === 'object') {
      if (typeof p.percent === 'number' && isFinite(p.percent)) return p.percent <= 1 ? Math.round(p.percent * 100) : Math.round(p.percent);
      if (typeof p.progress === 'number' && isFinite(p.progress)) return p.progress <= 1 ? Math.round(p.progress * 100) : Math.round(p.progress);
      if (typeof p.loaded === 'number' && typeof p.total === 'number' && p.total > 0) return Math.round(p.loaded / p.total * 100);
    }
    const n = Number(p);
    if (isFinite(n)) return n <= 1 ? Math.round(n * 100) : Math.round(n);
    return null;
  }

  function showUploadProgress(p) {
    const pct = normalizeUploadProgress(p);
    if (pct == null) { showToast('⏳ 上传中...', 1500, false); return; }
    showToast('⏳ 上传中 ' + Math.max(0, Math.min(100, pct)) + '%', 1500, false);
  }

  function rememberMineMedia(local) {
    if (!local) return;
    _recentMineMedia.push({ fp: (local.msgType || '') + '|' + (local.mediaUrl || local.text || ''), t: Date.now(), id: local.id });
    if (_recentMineMedia.length > 30) _recentMineMedia.shift();
  }

  function isRecentMineDuplicate(local) {
    if (!local || !local.isMine) return false;
    const fp = (local.msgType || '') + '|' + (local.mediaUrl || local.text || '');
    const now = Date.now();
    return _recentMineMedia.some(function (x) { return x.fp === fp && (now - x.t) < 15000; });
  }

  let _voiceRec = null, _voiceChunks = [], _voiceKey = null, _voiceStartAt = 0, _voiceStream = null;
  let _voiceTimerInterval = null;

  function formatRecordSeconds(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  function getVoiceTimerEl(key) {
    // 优先 data-draft-key 匹配的按钮旁的计时器
    const btns = document.querySelectorAll('.chat-voice-btn');
    for (let i = 0; i < btns.length; i++) {
      if (btns[i].dataset.draftKey === key) {
        const wrap = btns[i].closest('.chat-voice-wrap');
        if (wrap) return wrap.querySelector('.chat-voice-timer');
      }
    }
    return null;
  }

  function startVoiceTimer(key) {
    stopVoiceTimerDisplay();
    const tick = function () {
      const elapsed = (Date.now() - _voiceStartAt) / 1000;
      const label = formatRecordSeconds(elapsed);
      document.querySelectorAll('.chat-voice-btn.recording').forEach(function (b) {
        const wrap = b.closest('.chat-voice-wrap');
        const timer = wrap && wrap.querySelector('.chat-voice-timer');
        if (timer) {
          timer.textContent = label;
          timer.style.display = 'block';
        }
      });
    };
    tick();
    _voiceTimerInterval = setInterval(tick, 200);
  }

  function stopVoiceTimerDisplay() {
    if (_voiceTimerInterval) { clearInterval(_voiceTimerInterval); _voiceTimerInterval = null; }
    document.querySelectorAll('.chat-voice-timer').forEach(function (t) {
      t.style.display = 'none';
      t.textContent = '0:00';
    });
  }

  function releaseVoiceStream() {
    if (!_voiceStream) return;
    try {
      _voiceStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
    } catch (e) {}
    _voiceStream = null;
  }

  function stopVoiceRecording(cancel) {
    const rec = _voiceRec; _voiceRec = null;
    stopVoiceTimerDisplay();
    document.querySelectorAll('.chat-voice-btn.recording').forEach(function (b) {
      b.classList.remove('recording');
      b.textContent = '🎤';
      b.title = '点击录制语音';
    });
    if (!rec) return;
    try {
      if (cancel) {
        // 取消录音时也必须停掉麦克风轨道，否则浏览器会一直占用麦克风
        rec.ondataavailable = null;
        rec.onstop = releaseVoiceStream;
        if (rec.state !== 'inactive') rec.stop();
        _voiceChunks = [];
        releaseVoiceStream(); // 双保险
        return;
      }
      if (rec.state !== 'inactive') rec.stop();
    } catch (e) {}
  }

  function canLiveRecord() {
    try {
      const host = (location.hostname || '').toLowerCase();
      const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
      const secure = !!(window.isSecureContext || isLocal);
      return !!(secure && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    } catch (e) { return false; }
  }

  function pickAudioAsDraft(key) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*,.mp3,.m4a,.wav,.aac,.ogg,.amr,.webm';
    fileInput.multiple = false;
    fileInput.onchange = function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      setDraft(key, file, 'audio');
      showToast('✅ 语音文件已就绪，点击发送', 1500, true);
    };
    fileInput.click();
  }

  function startVoiceRecording(key) {
    // HTTP / 非安全上下文下浏览器禁止麦克风，自动降级为选择本地语音文件
    if (!canLiveRecord()) {
      // 非 localhost/HTTPS 时无法实时录音，降级选文件；localhost 应走实时录音
      showToast('ℹ️ 请用 localhost 或 HTTPS 访问以实时录音，已改为选择语音文件', 2500, true);
      pickAudioAsDraft(key);
      return;
    }
    if (_voiceRec) stopVoiceRecording(true);
    _voiceKey = key; _voiceChunks = [];
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      _voiceStream = stream;
      let mime = '';
      if (window.MediaRecorder) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
        else if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mime = 'audio/mp4';
      }
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      _voiceRec = rec; _voiceStartAt = Date.now();
      rec.ondataavailable = function (ev) { if (ev.data && ev.data.size > 0) _voiceChunks.push(ev.data); };
      rec.onstop = function () {
        releaseVoiceStream();
        const duration = (Date.now() - _voiceStartAt) / 1000;
        document.querySelectorAll('.chat-voice-btn.recording').forEach(function (b) { b.classList.remove('recording'); b.textContent = '🎤'; });
        if (duration < 0.6) { showToast('录音时间太短', 1200, false); _voiceChunks = []; return; }
        const blobType = (rec.mimeType || mime || 'audio/webm').split(';')[0];
        const ext = blobType.indexOf('mp4') >= 0 ? 'm4a' : 'webm';
        const file = new File([new Blob(_voiceChunks, { type: blobType })], 'voice_' + Date.now() + '.' + ext, { type: blobType });
        _voiceChunks = [];
        setDraft(_voiceKey || key, file, 'audio');
        // 把录音时长写入草稿，供 GoEasy createAudioMessage 使用
        try {
          const dk = _voiceKey || key;
          if (chatDrafts[dk] && chatDrafts[dk].items && chatDrafts[dk].items[0]) {
            chatDrafts[dk].items[0].duration = duration;
            chatDrafts[dk].duration = duration;
          }
        } catch (e) {}
        showToast('✅ 语音已就绪，点击发送', 1500, true);
      };
      rec.start();
      document.querySelectorAll('.chat-voice-btn').forEach(function (b) {
        if (b.dataset.draftKey === key) {
          b.classList.add('recording');
          b.textContent = '⏹️';
          b.title = '点击结束录音';
        }
      });
      startVoiceTimer(key);
      showToast('🎤 录音中… 再次点击结束', 2000, true);
    }).catch(function (err) {
      console.warn(err);
      releaseVoiceStream();
      showToast('⚠️ 麦克风不可用，改为选择语音文件', 2000, false);
      pickAudioAsDraft(key);
    });
  }

  function toggleVoiceRecording(key) {
    if (_voiceRec && _voiceRec.state === 'recording') stopVoiceRecording(false);
    else startVoiceRecording(key);
  }


  function linkifyText(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?|\b(?:(?:[0-9]{1,3}\.){3}[0-9]{1,3}|(?:[0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}|::[0-9a-fA-F]{1,4}|[0-9a-fA-F]{1,4}::)\b)/g;
    return text.replace(urlRegex, function (match) {
      const cleaned = match.replace(/[.,;:!?]+$/, '');
      return `<span class="chat-link" data-url="${esc(cleaned)}">${esc(match)}</span>`;
    });
  }


  // ===== QQ 风格语音：点击气泡播放 =====
  let _voiceAudio = null;
  let _voiceActiveBubble = null;

  function stopVoicePlayback() {
    if (_voiceAudio) {
      try { _voiceAudio.pause(); _voiceAudio.currentTime = 0; } catch (e) {}
    }
    if (_voiceActiveBubble) {
      _voiceActiveBubble.classList.remove('playing');
      const icon = _voiceActiveBubble.querySelector('.chat-voice-icon');
      if (icon) icon.textContent = '▶';
      _voiceActiveBubble = null;
    }
  }

  function playVoiceBubble(bubble) {
    if (!bubble) return;
    const url = bubble.getAttribute('data-url');
    if (!url) return;

    // 再次点击同一条 → 暂停
    if (_voiceActiveBubble === bubble && _voiceAudio && !_voiceAudio.paused) {
      stopVoicePlayback();
      return;
    }

    stopVoicePlayback();

    if (!_voiceAudio) {
      _voiceAudio = new Audio();
      _voiceAudio.preload = 'metadata';
      _voiceAudio.addEventListener('ended', function () { stopVoicePlayback(); });
      _voiceAudio.addEventListener('error', function () {
        showToast('❌ 语音播放失败', 1500, false);
        stopVoicePlayback();
      });
    }

    _voiceActiveBubble = bubble;
    bubble.classList.add('playing');
    const icon = bubble.querySelector('.chat-voice-icon');
    if (icon) icon.textContent = '⏸';

    // 若还没有时长，加载后更新气泡
    const onMeta = function () {
      const d = _voiceAudio.duration;
      if (d && isFinite(d) && d > 0) {
        bubble.setAttribute('data-duration', String(d));
        const w = Math.max(64, Math.min(180, 64 + d * 8));
        bubble.style.width = w + 'px';
        let durEl = bubble.querySelector('.chat-voice-dur');
        if (!durEl) {
          durEl = document.createElement('span');
          durEl.className = 'chat-voice-dur';
          bubble.appendChild(durEl);
        }
        durEl.textContent = Math.ceil(d) + '"';
      }
    };
    _voiceAudio.addEventListener('loadedmetadata', onMeta, { once: true });

    _voiceAudio.src = url;
    const p = _voiceAudio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function (err) {
        console.warn(err);
        showToast('❌ 无法播放语音', 1500, false);
        stopVoicePlayback();
      });
    }
  }

  document.addEventListener('click', function (e) {
    const bubble = e.target.closest && e.target.closest('.chat-voice-bubble');
    if (!bubble) return;
    e.preventDefault();
    e.stopPropagation();
    playVoiceBubble(bubble);
  }, true);

  function openMediaLightbox(url, kind) {
    if (!url) return;
    let box = document.getElementById('mediaLightbox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'mediaLightbox';
      box.className = 'media-lightbox';
      box.innerHTML = '<div class="media-lightbox-inner"></div><button type="button" class="media-lightbox-close" title="关闭">✕</button>';
      document.body.appendChild(box);
      box.addEventListener('click', function (e) {
        if (e.target === box || e.target.classList.contains('media-lightbox-close')) {
          box.classList.remove('open');
          const inner = box.querySelector('.media-lightbox-inner');
          if (inner) inner.innerHTML = '';
        }
      });
    }
    const inner = box.querySelector('.media-lightbox-inner');
    if (kind === 'video') {
      inner.innerHTML = '<video class="media-lightbox-video" src="' + esc(url) + '" controls autoplay playsinline></video>';
    } else {
      inner.innerHTML = '<img class="media-lightbox-img" src="' + esc(url) + '" alt="预览">';
    }
    box.classList.add('open');
  }

  // 事件委托：点击聊天图片/视频封面放大
  document.addEventListener('click', function (e) {
    const img = e.target.closest && e.target.closest('img.chat-media-thumb');
    if (img) {
      e.preventDefault();
      e.stopPropagation();
      openMediaLightbox(img.getAttribute('data-full') || img.src, 'image');
      return;
    }
    const cover = e.target.closest && e.target.closest('.chat-video-cover');
    if (cover) {
      e.preventDefault();
      e.stopPropagation();
      openMediaLightbox(cover.getAttribute('data-full'), 'video');
    }
  }, true);

  function renderMessageContent(msg) {
    const t = msg.text || '';
    if (msg.msgType === 'image' || (msg.isImage && t.startsWith('[图片]'))) {
      const url = msg.mediaUrl || (t.startsWith('[图片]') ? t.substring(4) : t);
      return '<img class="chat-media-thumb" src="' + esc(url) + '" data-full="' + esc(url) + '" alt="图片">';
    }
    if (msg.msgType === 'video' || (msg.isImage && t.startsWith('[视频]'))) {
      const url = msg.mediaUrl || (t.startsWith('[视频]') ? t.substring(4) : t);
      const poster = msg.thumbUrl ? esc(msg.thumbUrl) : '';
      // 列表里只显示封面，点击全屏播放，避免气泡里控件抢点击
      return '<div class="chat-video-cover" data-full="' + esc(url) + '" title="点击播放">' +
        (poster ? '<img src="' + poster + '" alt="视频">' : '<video src="' + esc(url) + '" muted preload="metadata"></video>') +
        '<span class="chat-video-play">▶</span></div>';
    }
    if (msg.msgType === 'audio' || t.startsWith('[语音]')) {
      const url = msg.mediaUrl || (t.startsWith('[语音]') ? t.substring(4) : t);
      let durSec = Number(msg.duration) || 0;
      // 气泡宽度随时长变化（最短约 64px，最长约 180px）
      const w = Math.max(64, Math.min(180, 64 + (durSec || 3) * 8));
      const durLabel = durSec > 0 ? (Math.ceil(durSec) + '"') : '';
      return '<div class="chat-voice-bubble" data-url="' + esc(url) + '" data-duration="' + esc(String(durSec || '')) + '" style="width:' + w + 'px;" title="点击播放">' +
        '<span class="chat-voice-icon">▶</span>' +
        '<span class="chat-voice-waves" aria-hidden="true"><i></i><i></i><i></i></span>' +
        (durLabel ? ('<span class="chat-voice-dur">' + durLabel + '</span>') : '') +
      '</div>';
    }
    if (msg.msgType === 'file' || t.startsWith('[文件]')) {
      const url = msg.mediaUrl || (t.startsWith('[文件]') ? t.substring(4) : t);
      const name = msg.fileName || '文件';
      return '<a class="chat-link" data-url="' + esc(url) + '" href="' + esc(url) + '" target="_blank" rel="noopener">📎 ' + esc(name) + '</a>';
    }
    return linkifyText(t);
  }

  function initGoEasy(retryCount) {
    if (retryCount === undefined) retryCount = 0;
    if (typeof GoEasy === 'undefined') {
      if (retryCount < 3) setTimeout(() => initGoEasy(retryCount + 1), 2000);
      else {
        state.goEasyReady = false;
        document.querySelectorAll('.server-group .chat-input').forEach(inp => { inp.disabled = true; inp.placeholder = '聊天未连接'; });
        document.querySelectorAll('.server-group .chat-send-btn').forEach(btn => btn.disabled = true);
      }
      return;
    }
    ensureUsername(() => {
      try {
        goEasy = GoEasy.getInstance({
          host: 'hangzhou.goeasy.io',
          appkey: 'BC-6b89528811b742ab9af8b8f9641b1b9a',
          modules: ['im'],
          forceTLS: true
        });
        const userId = state.username || ('user_' + generateMsgId());
        const nick = state.username || '匿名用户';
        goEasy.connect({
          id: userId,
          data: { nickname: nick, avatar: '' },
          onSuccess: function () {
            console.log('GoEasy IM 连接成功，用户ID:', goEasy.id);
            state.goEasyReady = true;
            state.presenceReady = true;
            showToast('✅ IM 聊天服务已连接', 1500, true);
            setupImMessageListeners();
            forceSubscribeAll();
            startImPresence();
            setTimeout(function () { syncAllOfflineHistory(); }, 400);
            state.servers.forEach(s => renderChatMessages(s.id, false));
            renderPublicChat(false);
            updateChatUI();
            restorePublicUnread();
            updateOnlineMembersUI();
          },
          onFailed: function (error) {
            console.error('GoEasy IM 连接失败', error);
            state.goEasyReady = false;
            state.presenceReady = false;
            if (retryCount < 3) {
              setTimeout(() => {
                if (goEasy) { try { goEasy.disconnect(); } catch (e) {} goEasy = null; }
                _imListenersBound = false;
                initGoEasy(retryCount + 1);
              }, 2000);
            } else {
              showToast('❌ 聊天服务连接失败，请检查网络或 appkey', 3000, false);
              updateChatUI();
            }
          },
          onProgress: function (attempts) { console.log('GoEasy IM 连接中...', attempts); }
        });
      } catch (e) {
        console.error('GoEasy 初始化异常', e);
        state.goEasyReady = false;
        if (retryCount < 3) setTimeout(() => initGoEasy(retryCount + 1), 2000);
      }
    });
  }

  function getPublicUnreadCount() {
    const raw = localStorage.getItem(PUBLIC_UNREAD_KEY);
    if (raw === 'true') return 1;
    if (raw === 'false' || raw == null || raw === '') return 0;
    const n = parseInt(raw, 10);
    return isNaN(n) || n < 0 ? 0 : n;
  }
  function updatePublicUnreadBadge() {
    const badge = document.getElementById('publicUnreadBadge');
    if (!badge) return;
    const count = getPublicUnreadCount();
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('zero', count === 0);
  }
  function setPublicUnread(value) {
    if (value === true || value === 1) {
      localStorage.setItem(PUBLIC_UNREAD_KEY, String(Math.max(1, getPublicUnreadCount() + 1)));
    } else if (typeof value === 'number') {
      localStorage.setItem(PUBLIC_UNREAD_KEY, String(Math.max(0, value)));
    } else {
      localStorage.setItem(PUBLIC_UNREAD_KEY, '0');
    }
    updatePublicUnreadBadge();
  }
  function restorePublicUnread() { updatePublicUnreadBadge(); }

  function queueMarkAsRead(groupId, message) {
    if (!groupId || !message) return;
    if (!_pendingReadByGroup[groupId]) _pendingReadByGroup[groupId] = [];
    const list = _pendingReadByGroup[groupId];
    const mid = message.messageId;
    if (mid && list.some(m => m.messageId === mid)) return;
    list.push(message);
    if (!queueMarkAsRead._timer) {
      queueMarkAsRead._timer = setTimeout(function () {
        queueMarkAsRead._timer = null;
        flushMarkAsRead();
      }, 400);
    }
  }

  function flushMarkAsRead(onlyGroupId) {
    const im = getIm();
    if (!im || !im.markMessageAsRead) return;
    const groups = onlyGroupId ? [onlyGroupId] : Object.keys(_pendingReadByGroup);
    groups.forEach(function (gid) {
      const msgs = _pendingReadByGroup[gid];
      if (!msgs || !msgs.length) return;
      const shouldRead = (gid === PUBLIC_CHANNEL && state.publicModalOpen) ||
        (gid !== PUBLIC_CHANNEL && gid !== PRESENCE_GROUP && state.expanded.has(groupToServerId(gid)));
      if (!shouldRead && !onlyGroupId) return;
      const batch = msgs.splice(0, msgs.length);
      try {
        im.markMessageAsRead({
          id: gid,
          type: imSceneGroup(),
          messages: batch,
          onSuccess: function () { console.log('[IM] 已读标记成功', gid, batch.length); },
          onFailed: function (err) {
            console.warn('[IM] 已读标记失败', gid, err);
            if (!_pendingReadByGroup[gid]) _pendingReadByGroup[gid] = [];
            batch.forEach(function (m) {
              if (!_pendingReadByGroup[gid].some(x => x.messageId === m.messageId)) _pendingReadByGroup[gid].push(m);
            });
          }
        });
      } catch (e) { console.warn('[IM] markMessageAsRead 异常', e); }
    });
  }

  function markGroupReadNow(groupId) {
    if (!groupId) return;
    flushMarkAsRead(groupId);
  }

  function isPresenceText(text) {
    if (!text) return false;
    if (text.indexOf('"__presence__"') >= 0) return true;
    try { const o = JSON.parse(text); return !!(o && o.__presence__); } catch (e) { return false; }
  }

  function imMessageToLocal(message) {
    if (!message) return null;
    const type = message.type || 'text';
    const payload = message.payload || {};
    const senderData = message.senderData || {};
    const sender = senderData.nickname || message.senderId || '匿名';
    const id = message.messageId || generateMsgId();
    const time = message.timestamp || Date.now();
    const isMine = (message.senderId && goEasy && message.senderId === goEasy.id) || (sender === state.username);
    let text = '', isImage = false, mediaUrl = '', thumbUrl = '', fileName = '', duration = 0, msgType = type;

    if (type === 'text') {
      text = payload.text != null ? String(payload.text) : '';
      if (isPresenceText(text)) return null;
      if (text.startsWith('[图片]') || text.startsWith('[视频]')) isImage = true;
    } else if (type === 'image') {
      mediaUrl = payload.url || ''; text = '[图片]' + mediaUrl; isImage = true; msgType = 'image';
    } else if (type === 'video') {
      const v = payload.video || payload;
      mediaUrl = (v && v.url) || payload.url || '';
      thumbUrl = (payload.thumbnail && payload.thumbnail.url) || '';
      text = '[视频]' + mediaUrl; isImage = true; msgType = 'video'; duration = (v && v.duration) || 0;
    } else if (type === 'audio') {
      mediaUrl = payload.url || ''; text = '[语音]' + mediaUrl; msgType = 'audio';
      duration = payload.duration || 0; fileName = payload.name || '';
    } else if (type === 'file') {
      mediaUrl = payload.url || '';
      fileName = payload.name || '文件';
      // 语音被降级为文件消息发来时（或对端 SDK 以文件形式发送的音频），按语音气泡展示
      const ct = String(payload.contentType || '');
      if (/^audio\//i.test(ct) || /\.(mp3|m4a|aac|ogg|opus|oga|wav|webm|amr|flac)$/i.test(fileName)) {
        msgType = 'audio';
        duration = payload.duration || 0;
        text = '[语音]' + mediaUrl;
        fileName = '';
      } else {
        text = '[文件]' + mediaUrl;
        msgType = 'file';
      }
    } else if (type === 'custom') {
      try {
        const c = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (c && c.__presence__) { handlePresencePayload(c, message.senderId, senderData); return null; }
      } catch (e) {}
      text = typeof payload === 'string' ? payload : (payload.text || JSON.stringify(payload));
    } else {
      text = typeof payload === 'string' ? payload : (payload.text || JSON.stringify(payload));
    }

    return {
      id, text, sender, isMine, time, isImage, msgType, mediaUrl, thumbUrl, fileName, duration,
      offline: !!(message.offline || message.isOffline)
    };
  }

  // 自己发送的媒体消息可能先用本地 blob 预览地址上屏；
  // 服务端回执携带真实 URL 到达后原地替换，避免刷新后语音/图片失效。
  function upgradeBlobMedia(existing, incoming) {
    if (!existing || !incoming) return false;
    const oldUrl = existing.mediaUrl || '';
    const newUrl = incoming.mediaUrl || '';
    if (oldUrl.indexOf('blob:') === 0 && newUrl && newUrl.indexOf('blob:') !== 0) {
      existing.mediaUrl = newUrl;
      existing.text = incoming.text || existing.text;
      if (incoming.duration) existing.duration = incoming.duration;
      if (incoming.thumbUrl) existing.thumbUrl = incoming.thumbUrl;
      return true;
    }
    return false;
  }

  function ingestLocalMessage(groupId, local, rawMessage, opts) {
    opts = opts || {};
    if (!local) return false;
    const fromHistory = !!opts.fromHistory;
    const fromOffline = !!opts.fromOffline || !!local.offline;

    if (groupId === PUBLIC_CHANNEL) {
      if (!state.publicMessages) state.publicMessages = [];
      const existingPub = state.publicMessages.find(m => m.id === local.id);
      if (existingPub) {
        if (upgradeBlobMedia(existingPub, local)) { savePublicMessages(); renderPublicChat(false); }
        return false;
      }
      if (isRecentMineDuplicate(local)) return false;
      state.publicMessages.push(local);
      state.publicMessages.sort((a, b) => (a.time || 0) - (b.time || 0));
      savePublicMessages();
      renderPublicChat(!fromHistory);
      if (!local.isMine && !state.publicModalOpen && (!fromHistory || fromOffline)) setPublicUnread(true);
      if (rawMessage && state.publicModalOpen) queueMarkAsRead(PUBLIC_CHANNEL, rawMessage);
      return true;
    }

    const serverId = groupToServerId(groupId);
    if (!serverId) return false;
    if (!state.chatMessages[serverId]) state.chatMessages[serverId] = [];
    const existingSrv = state.chatMessages[serverId].find(m => m.id === local.id);
    if (existingSrv) {
      if (upgradeBlobMedia(existingSrv, local)) { saveChatMessages(); renderChatMessages(serverId, false); }
      return false;
    }
    if (isRecentMineDuplicate(local)) return false;
    state.chatMessages[serverId].push(local);
    state.chatMessages[serverId].sort((a, b) => (a.time || 0) - (b.time || 0));
    saveChatMessages();
    renderChatMessages(serverId, !fromHistory);
    if (!local.isMine && !state.expanded.has(serverId) && (!fromHistory || fromOffline)) {
      state.unreadStatus[serverId] = getUnreadCount(serverId) + 1;
      saveUnreadStatus();
      updateUnreadIndicators();
    }
    if (rawMessage && state.expanded.has(serverId)) queueMarkAsRead(groupId, rawMessage);
    return true;
  }

  function setupImMessageListeners() {
    const im = getIm();
    if (!im || _imListenersBound) return;
    _imListenersBound = true;
    const onGroup = function (message) {
      try {
        if (message.groupId === PRESENCE_GROUP) {
          const payload = message.payload || {};
          let body = payload.text != null ? payload.text : payload;
          if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
          if (body && body.__presence__) handlePresencePayload(body, message.senderId, message.senderData || {});
          return;
        }
        const local = imMessageToLocal(message);
        if (!local) return;
        const isOffline = !!(message.offline || message.isOffline);
        ingestLocalMessage(message.groupId, local, message, { fromOffline: isOffline });
        if (message.groupId && !local.isMine) {
          const viewing = (message.groupId === PUBLIC_CHANNEL && state.publicModalOpen) ||
            state.expanded.has(groupToServerId(message.groupId));
          if (!viewing) queueMarkAsRead(message.groupId, message);
        }
      } catch (e) { console.warn('处理 IM 群消息失败', e); }
    };
    try {
      if (typeof GoEasy !== 'undefined' && GoEasy.IM_EVENT) im.on(GoEasy.IM_EVENT.GROUP_MESSAGE_RECEIVED, onGroup);
      else im.on('GROUP_MESSAGE_RECEIVED', onGroup);
    } catch (e) {
      console.error('绑定 IM 监听失败', e);
      _imListenersBound = false;
    }
  }

  function fetchGroupHistory(groupId, callback) {
    const im = getIm();
    if (!im || !im.history || !groupId) { if (typeof callback === 'function') callback([]); return; }
    try {
      im.history({
        id: groupId,
        type: imSceneGroup(),
        lastTimestamp: null,
        limit: HISTORY_LIMIT,
        onSuccess: function (result) {
          let list = [];
          if (result && Array.isArray(result.content)) list = result.content;
          else if (result && Array.isArray(result)) list = result;
          else if (result && result.content && Array.isArray(result.content.messages)) list = result.content.messages;
          if (typeof callback === 'function') callback(list);
        },
        onFailed: function (error) {
          console.warn('[IM] history 失败', groupId, error);
          if (typeof callback === 'function') callback([]);
        }
      });
    } catch (e) {
      console.warn('[IM] history 异常', e);
      if (typeof callback === 'function') callback([]);
    }
  }

  function mergeHistoryIntoLocal(groupId, historyList) {
    if (!historyList || !historyList.length) return 0;
    const sorted = historyList.slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    let added = 0, localLatest = 0;
    if (groupId === PUBLIC_CHANNEL) {
      (state.publicMessages || []).forEach(m => { if (m.time > localLatest) localLatest = m.time; });
    } else {
      const sid = groupToServerId(groupId);
      if (sid) (state.chatMessages[sid] || []).forEach(m => { if (m.time > localLatest) localLatest = m.time; });
    }
    sorted.forEach(function (message) {
      const local = imMessageToLocal(message);
      if (!local) return;
      const isNewOffline = localLatest > 0 && (local.time || 0) > localLatest;
      if (ingestLocalMessage(groupId, local, message, { fromHistory: true, fromOffline: isNewOffline })) added++;
      if (message && !local.isMine) {
        const viewing = (groupId === PUBLIC_CHANNEL && state.publicModalOpen) ||
          state.expanded.has(groupToServerId(groupId));
        if (viewing) queueMarkAsRead(groupId, message);
      }
    });
    return added;
  }

  function syncGroupOfflineHistory(groupId) {
    if (!groupId || groupId === PRESENCE_GROUP) return;
    fetchGroupHistory(groupId, function (list) {
      const n = mergeHistoryIntoLocal(groupId, list);
      _historySynced[groupId] = Date.now();
      if (n > 0) console.log('[IM] 同步历史/离线消息', groupId, n);
      const viewing = (groupId === PUBLIC_CHANNEL && state.publicModalOpen) ||
        state.expanded.has(groupToServerId(groupId));
      if (viewing) markGroupReadNow(groupId);
    });
  }

  function syncAllOfflineHistory() {
    if (!state.goEasyReady || !getIm()) return;
    syncGroupOfflineHistory(PUBLIC_CHANNEL);
    (state.servers || []).forEach(function (s) { syncGroupOfflineHistory(serverGroupId(s.id)); });
  }

  function subscribeChannel(serverId) {
    if (!goEasy || !state.goEasyReady) return;
    const im = getIm();
    if (!im) return;
    const gid = serverGroupId(serverId);
    im.subscribeGroup({
      groupIds: [gid],
      onSuccess: function () {
        state.chatSubscribed[serverId] = true;
        console.log('IM 订阅群成功:', gid);
        syncGroupOfflineHistory(gid);
      },
      onFailed: function (error) {
        console.error('IM 订阅群失败:', gid, error);
        setTimeout(() => { if (state.goEasyReady) subscribeChannel(serverId); }, 5000);
      }
    });
  }

  function subscribeAllChannels() {
    if (!goEasy || !state.goEasyReady) return;
    const im = getIm();
    if (!im) return;
    const ids = (state.servers || []).map(s => serverGroupId(s.id));
    if (ids.length) {
      im.subscribeGroup({
        groupIds: ids,
        onSuccess: function () {
          state.servers.forEach(s => { state.chatSubscribed[s.id] = true; });
          console.log('IM 批量订阅服务器群成功:', ids.length);
          ids.forEach(syncGroupOfflineHistory);
        },
        onFailed: function (error) {
          console.error('IM 批量订阅失败，逐个订阅', error);
          state.servers.forEach(s => subscribeChannel(s.id));
        }
      });
    }
    subscribePublicAndPresence();
  }

  function subscribePublicAndPresence() {
    const im = getIm();
    if (!im) return;
    im.subscribeGroup({
      groupIds: [PUBLIC_CHANNEL, PRESENCE_GROUP],
      onSuccess: function () {
        console.log('IM 公共群 + 在线群订阅成功');
        state.publicChatReady = true;
        restorePublicUnread();
        syncGroupOfflineHistory(PUBLIC_CHANNEL);
      },
      onFailed: function (error) {
        console.error('IM 公共/在线群订阅失败', error);
        setTimeout(() => { if (state.goEasyReady) subscribePublicAndPresence(); }, 5000);
      }
    });
  }

  function subscribePublicChannel() { subscribePublicAndPresence(); }

  function forceSubscribeAll() {
    if (!state.goEasyReady) return;
    state.chatSubscribed = {};
    subscribeAllChannels();
    console.log('[IM] 强制重新订阅所有群');
  }

  function appendLocalChat(serverId, local) {
    if (!state.chatMessages[serverId]) state.chatMessages[serverId] = [];
    if (state.chatMessages[serverId].some(m => m.id === local.id)) return;
    state.chatMessages[serverId].push(local);
    saveChatMessages();
    renderChatMessages(serverId, true);
    const card = document.querySelector(`.server-group[data-id="${serverId}"]`);
    if (card) {
      const input = card.querySelector('.chat-input');
      if (input) input.value = '';
    }
  }

  function sendChatMessage(serverId, text, isVideo = false) {
    const _dk = draftKey(serverId, false);
    if (chatDrafts[_dk]) { sendDraftMedia(_dk); return; }
    if (!text || !String(text).trim()) {
      showToast('请输入内容或选择图片/语音', 1200, false);
      return;
    }
    if (!state.username) { ensureUsername(() => {}); showToast('⚠️ 请先设置用户名', 1500, false); return; }
    if (!goEasy || !state.goEasyReady) { showToast('⚠️ 聊天服务未连接，请稍后重试', 2000, false); return; }
    const im = getIm();
    if (!im) { showToast('⚠️ IM 模块未就绪', 2000, false); return; }
    const gid = serverGroupId(serverId);
    const trimmed = text.trim();
    const isMediaText = /\[(图片|视频|语音|文件)\]/.test(trimmed);
    const textMessage = im.createTextMessage({ text: trimmed, to: buildGroupTo(gid, '服务器聊天') });
    im.sendMessage({
      message: textMessage,
      onSuccess: function () {
        const mid = (textMessage && textMessage.messageId) || generateMsgId();
        appendLocalChat(serverId, {
          id: mid, text: trimmed, sender: state.username, isMine: true, time: Date.now(),
          isImage: isMediaText && (trimmed.startsWith('[图片]') || trimmed.startsWith('[视频]')),
          msgType: isVideo ? 'video' : (trimmed.startsWith('[图片]') ? 'image' : 'text')
        });
      },
      onFailed: function (error) {
        showToast('❌ 消息发送失败：' + (error && error.content ? error.content : '未知错误'), 2500, false);
      }
    });
  }

  // 创建 GoEasy 媒体消息。
  // 语音优先走原生 createAudioMessage；当前 SDK 版本不支持或创建失败时，
  // 自动降级为文件消息发送（接收端会按音频特征还原成语音气泡），不再直接抛异常。
  function createImMediaMessage(im, file, kind, to, extra) {
    extra = extra || {};
    const progress = function (p) { showUploadProgress(p); };
    if (kind === 'image' && typeof im.createImageMessage === 'function') {
      return { message: im.createImageMessage({ file: file, to: to, onProgress: progress }), outKind: 'image' };
    }
    if (kind === 'video' && typeof im.createVideoMessage === 'function') {
      return { message: im.createVideoMessage({ file: file, to: to, onProgress: progress }), outKind: 'video' };
    }
    if (kind === 'audio' && typeof im.createAudioMessage === 'function') {
      const opts = { file: file, to: to, onProgress: progress };
      if (extra.duration && isFinite(extra.duration) && extra.duration > 0) {
        opts.duration = Math.max(1, Math.round(extra.duration));
      }
      try {
        return { message: im.createAudioMessage(opts), outKind: 'audio' };
      } catch (e1) {
        // 兼容部分版本参数名差异
        try {
          return { message: im.createAudioMessage({ audioFile: file, to: to, duration: opts.duration, onProgress: progress }), outKind: 'audio' };
        } catch (e2) {
          console.warn('[IM] createAudioMessage 不可用，降级为文件消息发送', e1, e2);
        }
      }
    }
    if (typeof im.createFileMessage === 'function') {
      return { message: im.createFileMessage({ file: file, to: to, onProgress: progress }), outKind: 'file' };
    }
    return null;
  }

  function pushLocalMediaMsg(isPublic, serverId, local) {
    local.isMine = true;
    local.sender = state.username;
    rememberMineMedia(local);
    if (isPublic) {
      if (!state.publicMessages) state.publicMessages = [];
      if (!state.publicMessages.some(function (m) { return m.id === local.id; })) {
        state.publicMessages.push(local); savePublicMessages();
      }
      renderPublicChat(true); setPublicUnread(false);
    } else {
      appendLocalChat(serverId, local);
    }
  }

  function formatImSendError(error) {
    if (!error) return '未知错误';
    const parts = [];
    if (error.code !== undefined && error.code !== null) parts.push('code:' + error.code);
    if (error.content) parts.push(String(error.content));
    if (!parts.length && error.message) parts.push(String(error.message));
    return parts.join(' ') || '未知错误';
  }

  // 构建本地已发送媒体消息；outKind 为降级后的实际消息类型。
  // 语音即使被降级成文件消息发出，本地仍按语音气泡展示。
  function buildLocalMediaMessage(message, kind, outKind, item) {
    const payload = (message && message.payload) || {};
    const viewKind = (kind === 'audio') ? 'audio' : (outKind || kind);
    const local = imMessageToLocal(message) || {};
    local.id = local.id || (message && message.messageId) || generateMsgId();
    local.time = local.time || Date.now();
    local.msgType = viewKind;
    local.isImage = viewKind === 'image' || viewKind === 'video';
    if (!local.mediaUrl) {
      local.mediaUrl = payload.url || (payload.video && payload.video.url) || '';
    }
    // GoEasy 未回传 url 时（少见），先用本地预览地址顶上，保证气泡不空白；
    // 服务端回执到达后会由 upgradeBlobMedia 替换为真实地址
    if (!local.mediaUrl && item.previewUrl) local.mediaUrl = item.previewUrl;
    if (!local.duration && item.duration) local.duration = item.duration;
    if (!local.fileName && item.name) local.fileName = item.name;
    local.text = (viewKind === 'image' ? '[图片]' : viewKind === 'video' ? '[视频]' : viewKind === 'audio' ? '[语音]' : '[文件]') + local.mediaUrl;
    return local;
  }

  function sendOneMediaItem(im, to, item, isPublic, serverId) {
    return new Promise(function (resolve) {
      const kind = item.kind || 'file';
      let created = null;
      try {
        created = createImMediaMessage(im, item.file, kind, to, { duration: item.duration });
      } catch (e) {
        console.error('[IM] 创建媒体消息异常', e);
        resolve({ ok: false, error: { content: '创建消息失败：' + (e && e.message ? e.message : '未知错误') } });
        return;
      }
      const message = created && created.message;
      const outKind = created && created.outKind ? created.outKind : kind;
      if (!message) {
        resolve({ ok: false, error: { content: '当前 GoEasy SDK 不支持发送该媒体类型' } });
        return;
      }
      im.sendMessage({
        message: message,
        onSuccess: function () {
          const local = buildLocalMediaMessage(message, kind, outKind, item);
          pushLocalMediaMsg(isPublic, serverId, local);
          resolve({ ok: true });
        },
        onFailed: function (error) {
          console.error('[IM] 媒体消息发送失败 kind=' + kind + ' outKind=' + outKind, error);
          resolve({ ok: false, error: error });
        }
      });
    });
  }

  // 发送失败时保留草稿：只清掉已成功的项，失败项留在输入区可重发。
  // 这是“语音发送失败后会消失”的核心修复点。
  function keepDraftItems(key, failedItems) {
    if (!failedItems || !failedItems.length) { clearDraft(key); return; }
    const old = chatDrafts[key];
    if (old && old.items) {
      old.items.forEach(function (it) {
        if (failedItems.indexOf(it) === -1 && it.previewUrl) {
          try { URL.revokeObjectURL(it.previewUrl); } catch (e) {}
        }
      });
    }
    const first = failedItems[0];
    chatDrafts[key] = {
      items: failedItems.slice(),
      file: first.file, kind: first.kind, previewUrl: first.previewUrl, name: first.name,
      duration: first.duration
    };
    renderDraftPreview(key);
  }

  async function sendDraftMedia(key) {
    const d = chatDrafts[key];
    if (!d || !d.items || !d.items.length) return false;
    if (_sendingLock[key]) { showToast('⏳ 正在发送，请稍候', 1200, false); return true; }
    if (!state.username) { ensureUsername(function () {}); showToast('⚠️ 请先设置用户名', 1500, false); return true; }
    const im = getIm();
    if (!im || !state.goEasyReady) { showToast('⚠️ IM 未连接', 2000, false); return true; }
    const isPublic = key === 'public';
    const serverId = isPublic ? null : key;
    const to = buildGroupTo(isPublic ? PUBLIC_CHANNEL : serverGroupId(serverId), isPublic ? '公共聊天' : '服务器聊天');
    const items = d.items.slice();
    _sendingLock[key] = true;
    let okCount = 0;
    const failedItems = [];
    let lastError = null;
    try {
      for (let i = 0; i < items.length; i++) {
        showToast(items.length > 1 ? ('⏳ 正在发送 ' + (i + 1) + '/' + items.length + '...') : '⏳ 正在发送...', 2000, false);
        const result = await sendOneMediaItem(im, to, items[i], isPublic, serverId);
        if (result && result.ok) {
          okCount++;
        } else {
          failedItems.push(items[i]);
          if (result && result.error) lastError = result.error;
        }
      }
    } finally {
      _sendingLock[key] = false;
    }
    if (!failedItems.length) {
      // 全部成功才清空草稿
      clearDraft(key);
      showToast('✅ 发送成功' + (items.length > 1 ? (' (' + okCount + ')') : ''), 1200, true);
    } else {
      keepDraftItems(key, failedItems);
      const reason = formatImSendError(lastError);
      if (okCount > 0) {
        showToast('⚠️ 部分发送成功 ' + okCount + '/' + items.length + '，失败内容已保留：' + reason, 3500, false);
      } else {
        showToast('❌ 发送失败：' + reason + '（内容已保留，可重新点击发送）', 3500, false);
      }
    }
    return true;
  }

  function sendChatImMedia(serverId, file, kind) {
    setDraft(draftKey(serverId, false), file, kind);
  }

  function sendPublicMessage(text, isVideo = false) {
    const _dk = draftKey(null, true);
    if (chatDrafts[_dk]) { sendDraftMedia(_dk); return; }
    if (!text || !String(text).trim()) {
      showToast('请输入内容或选择图片/语音', 1200, false);
      return;
    }
    if (!state.username) { ensureUsername(() => {}); showToast('⚠️ 请先设置用户名', 1500, false); return; }
    if (!goEasy || !state.goEasyReady) { showToast('⚠️ 聊天服务未连接', 2000, false); return; }
    const im = getIm();
    if (!im) { showToast('⚠️ IM 模块未就绪', 2000, false); return; }
    const trimmed = text.trim();
    const isMediaText = /\[(图片|视频|语音|文件)\]/.test(trimmed);
    const textMessage = im.createTextMessage({ text: trimmed, to: buildGroupTo(PUBLIC_CHANNEL, '公共聊天') });
    im.sendMessage({
      message: textMessage,
      onSuccess: function () {
        const msgId = (textMessage && textMessage.messageId) || generateMsgId();
        if (!state.publicMessages) state.publicMessages = [];
        if (!state.publicMessages.some(m => m.id === msgId)) {
          state.publicMessages.push({
            id: msgId, text: trimmed, sender: state.username, isMine: true, time: Date.now(),
            isImage: isMediaText && (trimmed.startsWith('[图片]') || trimmed.startsWith('[视频]')),
            msgType: isVideo ? 'video' : (trimmed.startsWith('[图片]') ? 'image' : 'text')
          });
          savePublicMessages();
        }
        renderPublicChat(true);
        const el = document.getElementById('publicChatInput');
        if (el) el.value = '';
        setPublicUnread(false);
      },
      onFailed: function () { showToast('❌ 公共消息发送失败', 2000, false); }
    });
  }

  function sendPublicImMedia(file, kind) {
    setDraft(draftKey(null, true), file, kind);
  }

  function handlePresencePayload(body, senderId, senderData) {
    if (!body || !body.__presence__) return;
    const id = body.id || senderId || '';
    if (!id) return;
    const nickname = body.nickname || (senderData && senderData.nickname) || id;
    const action = body.action || 'join';
    if (action === 'leave') {
      if (_presenceMap[id]) { delete _presenceMap[id]; syncPresenceToState(); }
      return;
    }
    const wasOnline = !!_presenceMap[id];
    _presenceMap[id] = { id: id, nickname: nickname, lastSeen: Date.now() };
    syncPresenceToState();
    if (!wasOnline && action === 'join') {
      if (id !== state.username && !(goEasy && id === goEasy.id)) {
        showToast('🟢 成员 ' + nickname + ' 已上线', 2000, true);
      }
    }
  }

  function syncPresenceToState() {
    const now = Date.now();
    const list = [];
    Object.keys(_presenceMap).forEach(id => {
      const m = _presenceMap[id];
      if (!m) return;
      if (now - (m.lastSeen || 0) > PRESENCE_TTL_MS) { delete _presenceMap[id]; return; }
      list.push({ id: m.id, nickname: m.nickname, data: { nickname: m.nickname } });
    });
    const myId = (goEasy && goEasy.id) || state.username;
    if (myId && !list.some(x => x.id === myId || x.nickname === state.username)) {
      list.unshift({ id: myId, nickname: state.username || myId, data: { nickname: state.username || myId } });
      _presenceMap[myId] = { id: myId, nickname: state.username || myId, lastSeen: now };
    }
    state.onlineMembers = list;
    state.onlineCount = list.length;
    updateOnlineMembersUI();
  }

  function sendPresenceAction(action) {
    const im = getIm();
    if (!im || !state.goEasyReady) return;
    const body = JSON.stringify({
      __presence__: true,
      action: action || 'heartbeat',
      id: (goEasy && goEasy.id) || state.username,
      nickname: state.username || '匿名',
      ts: Date.now()
    });
    try {
      const msg = im.createTextMessage({ text: body, to: buildGroupTo(PRESENCE_GROUP, '在线状态') });
      im.sendMessage({
        message: msg,
        onSuccess: function () {
          const myId = (goEasy && goEasy.id) || state.username;
          if (myId) {
            _presenceMap[myId] = { id: myId, nickname: state.username || myId, lastSeen: Date.now() };
            syncPresenceToState();
          }
        },
        onFailed: function () {}
      });
    } catch (e) {}
  }

  function startImPresence() {
    stopImPresence();
    sendPresenceAction('join');
    presenceHeartbeatTimer = setInterval(() => {
      if (!state.goEasyReady || document.hidden) return;
      sendPresenceAction('heartbeat');
    }, PRESENCE_HEARTBEAT_MS);
    presenceExpireTimer = setInterval(() => { syncPresenceToState(); }, 10000);
  }
  function stopImPresence() {
    if (presenceHeartbeatTimer) { clearInterval(presenceHeartbeatTimer); presenceHeartbeatTimer = null; }
    if (presenceExpireTimer) { clearInterval(presenceExpireTimer); presenceExpireTimer = null; }
  }
  function queryHereNow() { syncPresenceToState(); }
  function initPresence() { startImPresence(); }

  function updateOnlineMembersUI() {
    const badge = document.getElementById('onlineCountBadge');
    const titleCount = document.getElementById('onlineMembersTitleCount');
    const list = document.getElementById('onlineMembersList');
    const listLen = (state.onlineMembers && state.onlineMembers.length) || 0;
    state.onlineCount = listLen;
    const label = listLen > 99 ? '99+' : String(listLen);
    if (badge) {
      if (badge.textContent !== label) badge.textContent = label;
      badge.classList.toggle('zero', listLen === 0);
    }
    if (titleCount) {
      const t = '(' + listLen + ')';
      if (titleCount.textContent !== t) titleCount.textContent = t;
    }
    if (!list) return;
    if (!listLen) {
      list.innerHTML = '<div class="online-members-empty">暂无在线成员</div>';
      return;
    }
    list.innerHTML = state.onlineMembers.map(m => {
      const rawName = m.nickname || m.id || '匿名';
      const rawId = m.id || '';
      const name = esc(rawName);
      const idStr = esc(rawId);
      const initial = String(rawName || '?').charAt(0).toUpperCase();
      const isMe = (m.id === state.username) || (m.nickname === state.username) || (goEasy && m.id === goEasy.id);
      const showId = rawId && String(rawName) !== String(rawId);
      const idHtml = showId ? `<div class="online-member-id">${idStr}</div>` : '';
      return `<div class="online-member-item" title="${idStr}">
        <div class="online-member-avatar">${esc(initial)}</div>
        <div class="online-member-info">
          <div class="online-member-name">${name}${isMe ? ' <span style="color:var(--cyan);font-size:11px;">(我)</span>' : ''}</div>
          ${idHtml}
        </div>
        <div class="online-member-dot" title="在线"></div>
      </div>`;
    }).join('');
  }

  function bindOnlineMembersEvents() {
    const btn = document.getElementById('onlineMembersBtn');
    const modal = document.getElementById('onlineMembersModal');
    const closeBtn = document.getElementById('closeOnlineMembersBtn');
    if (!btn || !modal) return;
    let modalPollTimer = null;
    function startModalPoll() {
      if (modalPollTimer) clearInterval(modalPollTimer);
      modalPollTimer = setInterval(() => {
        if (state.goEasyReady && modal.classList.contains('open')) syncPresenceToState();
      }, 2000);
    }
    function stopModalPoll() {
      if (modalPollTimer) { clearInterval(modalPollTimer); modalPollTimer = null; }
    }
    btn.addEventListener('click', () => {
      modal.classList.add('open');
      if (state.goEasyReady) { sendPresenceAction('heartbeat'); syncPresenceToState(); }
      updateOnlineMembersUI();
      startModalPoll();
    });
    if (closeBtn) closeBtn.addEventListener('click', () => { modal.classList.remove('open'); stopModalPoll(); });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) { modal.classList.remove('open'); stopModalPoll(); }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.goEasyReady) {
        sendPresenceAction('heartbeat');
        syncPresenceToState();
        setTimeout(function () { syncAllOfflineHistory(); }, 300);
      }
    });
  }

  function getChatMessagesSignature(messages) {
    if (!messages || !messages.length) return 'empty';
    const first = messages[0], last = messages[messages.length - 1];
    return messages.length + '|' + (first && first.id) + '|' + (last && last.id) + '|' + (last && last.time);
  }

  function renderChatMessages(serverId, forceScroll = false) {
    const card = document.querySelector(`.server-group[data-id="${serverId}"]`);
    if (!card) return;
    const container = card.querySelector('.chat-messages');
    if (!container) return;
    const active = document.activeElement;
    const inputFocused = active && card.contains(active) && active.classList.contains('chat-input');
    if (!state.goEasyReady) {
      container.innerHTML = '<div style="color:var(--red);text-align:center;padding:8px;">⚠️ 聊天服务未连接</div>';
      return;
    }
    const msgs = state.chatMessages[serverId] || [];
    const sig = getChatMessagesSignature(msgs);
    if (container.dataset.sig === sig && !forceScroll) return;
    container.dataset.sig = sig;
    if (!msgs.length) {
      container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:8px;font-size:12px;">暂无消息，来说点什么吧</div>';
    } else {
      container.innerHTML = buildChatMessagesHtml(msgs);
    }
    if (forceScroll || !inputFocused) {
      const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
      if (forceScroll || nearBottom) {
        container.scrollTop = container.scrollHeight;
        saveChatScroll(serverId, container.scrollTop);
      }
    }
  }

  function initChatForCard(serverId, cardElement) {
    if (!cardElement) return;
    const bodyInner = cardElement.querySelector('.body-inner');
    if (!bodyInner) return;
    let wrapper = bodyInner.querySelector('.chat-wrapper');
    const isNew = !wrapper;
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'chat-wrapper';
      const hasUsername = !!(state.username && state.username.trim());
      const ready = state.goEasyReady && hasUsername;
      wrapper.innerHTML = `
        <div class="chat-messages"></div>
        <div class="chat-draft-host" style="display:none;"></div>
        <div class="chat-input-area">
          <div class="chat-voice-wrap">
            <button class="image-upload-btn chat-voice-btn" type="button" title="点击录制语音" data-draft-key="${esc(serverId)}">🎤</button>
            <span class="chat-voice-timer" style="display:none">0:00</span>
          </div>
          <button class="image-upload-btn chat-image-btn" title="选择图片/视频" type="button">🖼️</button>
          <input type="text" class="chat-input" placeholder="${ready ? '输入聊天内容...' : (state.goEasyReady ? '请先设置用户名' : '聊天未连接')}" ${ready ? '' : 'disabled'}>
          <button class="chat-send-btn" type="button" ${ready ? '' : 'disabled'}>发送</button>
        </div>`;
      bodyInner.insertBefore(wrapper, bodyInner.firstChild);
    }
    if (wrapper.dataset.bound !== 'true') {
      const input = wrapper.querySelector('.chat-input');
      const sendBtn = wrapper.querySelector('.chat-send-btn');
      const imageBtn = wrapper.querySelector('.chat-image-btn');
      const sendHandler = function () {
        // 有草稿时即使输入框为空也要发送；无草稿再发文字
        sendChatMessage(serverId, (input && input.value) || '', false);
      };
      sendBtn.addEventListener('click', sendHandler);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); sendHandler(); }
      });
      if (imageBtn) {
        imageBtn.addEventListener('click', function () {
          pickMediaAsDraft(serverId, false);
        });
      }
      const voiceBtn = wrapper.querySelector('.chat-voice-btn');
      if (voiceBtn) {
        voiceBtn.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          toggleVoiceRecording(draftKey(serverId, false));
        });
      }
      const msgBox = wrapper.querySelector('.chat-messages');
      if (msgBox) {
        msgBox.addEventListener('scroll', function () { saveChatScroll(serverId, msgBox.scrollTop); }, { passive: true });
      }
      wrapper.dataset.bound = 'true';
    }
    if (isNew) renderChatMessages(serverId, true);
    else renderChatMessages(serverId, false);
    if (state.goEasyReady && !state.chatSubscribed[serverId]) subscribeChannel(serverId);
  }

  function renderPublicChat(forceScroll = false) {
    const container = document.getElementById('publicChatMessages');
    if (!container) return;
    const msgs = state.publicMessages || [];
    if (!state.goEasyReady) {
      container.innerHTML = '<div style="color:var(--red);text-align:center;padding:20px;">⚠️ 聊天服务未连接</div>';
      return;
    }
    if (msgs.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px;font-size:14px;">暂无消息</div>';
    } else {
      container.innerHTML = buildChatMessagesHtml(msgs);
    }
    if (forceScroll) {
      container.scrollTop = container.scrollHeight;
      savePublicScroll(container.scrollTop);
    } else {
      const saved = getPublicScroll();
      if (saved != null) container.scrollTop = saved;
    }
  }

  function bindPublicChatEvents() {
    const modal = document.getElementById('publicChatModal');
    const openBtn = document.getElementById('openPublicChatBtn');
    const closeBtn = document.getElementById('closePublicChatBtn');
    const sendBtn = document.getElementById('publicChatSendBtn');
    const input = document.getElementById('publicChatInput');
    const imageBtn = document.getElementById('publicChatImageBtn');
    if (!modal || !openBtn) return;

    openBtn.addEventListener('click', function () {
      state.publicModalOpen = true;
      modal.classList.add('open');
      setPublicUnread(false);
      renderPublicChat(true);
      syncGroupOfflineHistory(PUBLIC_CHANNEL);
      markGroupReadNow(PUBLIC_CHANNEL);
      const header = modal.querySelector('.custom-modal-header');
      if (header && !header.dataset.editBound) {
        header.dataset.editBound = '1';
        let editBtn = header.querySelector('.edit-nick-btn');
        if (!editBtn) {
          editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'edit-nick-btn';
          editBtn.textContent = '修改用户名';
          editBtn.style.cssText = 'margin-left:8px;border:0;background:transparent;color:var(--cyan);font-size:12px;font-weight:700;cursor:pointer;';
          const title = header.querySelector('span');
          if (title) title.appendChild(editBtn);
          else header.insertBefore(editBtn, header.firstChild);
        }
        editBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          showUsernamePrompt(() => { renderPublicChat(false); updateChatUI(); });
        });
      }
    });
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        state.publicModalOpen = false;
        modal.classList.remove('open');
      });
    }
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        state.publicModalOpen = false;
        modal.classList.remove('open');
      }
    });
    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        // 有草稿时即使输入框为空也要发送
        sendPublicMessage((input && input.value) || '', false);
      });
    }
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (sendBtn) sendBtn.click();
        }
      });
    }
    if (imageBtn) {
      imageBtn.textContent = '🖼️';
      imageBtn.title = '选择图片/视频';
      imageBtn.addEventListener('click', function () {
        pickMediaAsDraft(null, true);
      });
    }
    let voiceBtn = document.getElementById('publicChatVoiceBtn');
    if (!voiceBtn) {
      const area = document.querySelector('#publicChatModal .chat-input-area');
      if (area && imageBtn) {
        const wrap = document.createElement('div');
        wrap.className = 'chat-voice-wrap';
        voiceBtn = document.createElement('button');
        voiceBtn.id = 'publicChatVoiceBtn';
        voiceBtn.type = 'button';
        voiceBtn.className = 'image-upload-btn chat-voice-btn';
        voiceBtn.title = '点击录制语音';
        voiceBtn.textContent = '🎤';
        voiceBtn.dataset.draftKey = 'public';
        const timer = document.createElement('span');
        timer.className = 'chat-voice-timer';
        timer.style.display = 'none';
        timer.textContent = '0:00';
        wrap.appendChild(voiceBtn);
        wrap.appendChild(timer);
        area.insertBefore(wrap, imageBtn);
      }
    }
    if (voiceBtn) {
      voiceBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        toggleVoiceRecording('public');
      });
    }
    const msgBox = document.getElementById('publicChatMessages');
    if (msgBox) {
      msgBox.addEventListener('scroll', function () { savePublicScroll(msgBox.scrollTop); }, { passive: true });
    }
  }

  function reconnectChat() {
    if (state.goEasyReady) {
      forceSubscribeAll();
      sendPresenceAction('heartbeat');
      setTimeout(function () { syncAllOfflineHistory(); }, 300);
    } else {
      _imListenersBound = false;
      initGoEasy(0);
    }
  }

  // ============================================================
  function renderServers() {
    const list = document.getElementById('serverList');
    const roomsByServer = {};
    state.rooms.forEach(r => { (roomsByServer[r.server_id] = roomsByServer[r.server_id] || []).push(r); });
    const onlineCount = state.servers.filter(s => s.status === 'online').length;
    document.getElementById('ovServers').textContent = `${onlineCount}/${state.servers.length}`;
    document.getElementById('ovOnline').textContent = state.servers.filter(s => s.status === 'online').reduce((a, s) => a + (s.online || 0), 0);
    document.getElementById('ovIdle').textContent = state.servers.filter(s => s.status === 'online').reduce((a, s) => a + (s.idle || 0), 0);
    document.getElementById('ovRooms').textContent = state.rooms.length;
    if (!state.servers.length) { if (state.firstLoad) { list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>'; } return; }

    const existing = state._domCache;
    if (existing.size === 0) list.querySelectorAll('.server-group').forEach(el => existing.set(el.dataset.id, el));
    const currentIds = new Set(state.servers.map(s => s.id));
    for (const [id, el] of existing) if (!currentIds.has(id)) { el.remove(); existing.delete(id); }

    const order = [];
    state.servers.forEach(s => {
      const dot = statusDot(s.status);
      const rooms = roomsByServer[s.id] || [];
      const regionHtml = s.region ? `<span class="card-region" title="${esc(s.region)}">${esc(s.region)}</span>` : '';
      const typeBadgeHtml = getTypeBadge(s);
      const errText = s.error ? String(s.error) : '';
      const newRoomsHtml = rooms.length ? `<div class="room-list">${rooms.map(r => roomCard(r)).join('')}</div>` : '';
      let group = existing.get(s.id);
      const address = s.address || `${s.host}:${s.port}`;

      if (group) {
        const dotEl = group.querySelector('.server-status-dot');
        if (dotEl && dotEl.className !== 'server-status-dot ' + dot) dotEl.className = 'server-status-dot ' + dot;

        let nameEl = group.querySelector('.server-name');
        if (nameEl) {
          nameEl.textContent = s.name;
          nameEl.dataset.copytext = s.name;
          nameEl.classList.remove('short-text'); // 不需要 short-text
        } else {
          const info = group.querySelector('.server-info');
          if (info) {
            const newHtml = makeServerNameHtml(s.name, s.name);
            info.insertAdjacentHTML('afterbegin', newHtml);
          }
        }

        let addrEl = group.querySelector('.server-address');
        if (addrEl) {
          addrEl.textContent = address;
          addrEl.dataset.copytext = address;
          addrEl.classList.remove('short-text');
        } else {
          const info = group.querySelector('.server-info');
          if (info) {
            const newHtml = makeServerAddressHtml(address, address);
            info.appendChild(createElementFromHTML(newHtml));
          }
        }

        const infoEl = group.querySelector('.server-info');
        const regionEl = group.querySelector('.card-region');
        if (regionEl) {
          if (!s.region) { regionEl.remove(); }
          else if (regionEl.textContent !== s.region) { regionEl.textContent = s.region; regionEl.title = s.region; }
        } else if (s.region && infoEl) {
          // 插在地址后面
          const addr = infoEl.querySelector('.server-address');
          if (addr && addr.nextSibling) infoEl.insertBefore(createElementFromHTML(regionHtml), addr.nextSibling);
          else if (addr) infoEl.appendChild(createElementFromHTML(regionHtml));
          else infoEl.insertAdjacentHTML('beforeend', regionHtml);
        }

        let typeEl = group.querySelector('.server-type-badge');
        if (typeBadgeHtml) {
          if (!typeEl && infoEl) {
            // 放在地区之后 / 地址之后
            const regionNow = infoEl.querySelector('.card-region');
            const addr = infoEl.querySelector('.server-address');
            const anchor = regionNow || addr;
            if (anchor && anchor.nextSibling) infoEl.insertBefore(createElementFromHTML(typeBadgeHtml), anchor.nextSibling);
            else if (anchor) infoEl.appendChild(createElementFromHTML(typeBadgeHtml));
            else infoEl.insertAdjacentHTML('beforeend', typeBadgeHtml);
            typeEl = group.querySelector('.server-type-badge');
          } else if (typeEl) {
            const newType = s.is_builtin ? '内置' : s.is_remote ? '远程' : s.is_manual ? '自定义' : '';
            if (newType) {
              typeEl.textContent = newType;
              typeEl.className = 'server-type-badge ' + (s.is_builtin ? 'builtin' : s.is_remote ? 'remote' : 'manual');
            } else {
              typeEl.remove();
            }
          }
        } else {
          if (typeEl) typeEl.remove();
        }

        const statBs = group.querySelectorAll('.stat-item b');
        if (statBs.length >= 3) {
          statBs[0].textContent = String(s.online || 0);
          statBs[1].textContent = String(s.idle || 0);
          statBs[2].textContent = String(s.room_count || 0);
        }
        const latEl = group.querySelector('.stat-item.latency');
        if (latEl) {
          const nb = latEl.querySelector('.latency-badge');
          const nl = latencyHTML(s);
          if (!nb || nb.outerHTML !== nl) latEl.innerHTML = `<span>延迟</span>${nl}`;
        }

        const shouldOpen = state.expanded.has(s.id);
        const isOpen = group.classList.contains('open');
        if (shouldOpen !== isOpen) group.classList.toggle('open', shouldOpen);

        // 错误角标：卡片顶部居中，文案随错误变化
        ensureErrorBadge(group, errText);

        // 始终更新房间列表；不碰聊天 DOM，避免输入法被收起
        const body = group.querySelector('.server-body');
        if (body) {
          const bodyInner = body.querySelector('.body-inner');
          if (bodyInner) {
            const chatWrapper = bodyInner.querySelector('.chat-wrapper');
            // 清理旧版横幅错误 + 房间列表，绝不移除聊天区
            bodyInner.querySelectorAll('.server-error, .room-list, .no-rooms-empty, .no-rooms-match, .no-rooms').forEach(el => {
              if (!chatWrapper || !chatWrapper.contains(el)) el.remove();
            });

            // 顺序：聊天 → 房间列表
            if (newRoomsHtml) {
              const temp = document.createElement('div');
              temp.innerHTML = newRoomsHtml;
              const roomList = temp.firstElementChild;
              if (chatWrapper) {
                if (chatWrapper.nextSibling) bodyInner.insertBefore(roomList, chatWrapper.nextSibling);
                else bodyInner.appendChild(roomList);
              } else {
                bodyInner.appendChild(roomList);
              }
            }
          }
        }
        // 聊天区已存在时不要反复 init；仅确保消息增量更新
        if (!group.querySelector('.chat-wrapper')) {
          initChatForCard(s.id, group);
        } else {
          renderChatMessages(s.id, false);
        }

        ensureUnreadIndicator(group, s.id);

      } else {
        const isOpen = state.expanded.has(s.id) ? 'open' : '';
        const nameHtml = makeServerNameHtml(s.name, s.name);
        const addrHtml = makeServerAddressHtml(address, address);
        const unreadCount = getUnreadCount(s.id);
        const indicatorStyle = unreadCount > 0 ? 'inline-block' : 'none';
        const indicatorText = unreadCount > 99 ? '99+' : (unreadCount > 0 ? String(unreadCount) : '');

        const actionsHtml = s.is_manual ? `
          <div class="server-actions">
            <button class="action-btn action-edit">编辑</button>
            <button class="action-btn action-delete">删除</button>
          </div>` : '';

        const div = document.createElement('div');
        div.className = `server-group ${isOpen}`;
        div.dataset.id = s.id;
        div.innerHTML = `
          ${actionsHtml}
          <div class="server-card-inner">
            <div class="server-head">
              <div class="server-status-dot ${dot}"></div>
              <div class="server-info">
                ${nameHtml}
                ${addrHtml}
                ${regionHtml}
                ${typeBadgeHtml}
                <div class="server-detail"></div>
              </div>
              <span class="unread-indicator" data-server-id="${s.id}" style="display: ${indicatorStyle};">${indicatorText}</span>
              <div class="server-stats">
                <div class="stat-item online"><span>在线</span><b>${s.online || 0}</b></div>
                <div class="stat-item idle"><span>空闲</span><b>${s.idle || 0}</b></div>
                <div class="stat-item rooms"><span>房间</span><b>${s.room_count || 0}</b></div>
                <div class="stat-item latency"><span>延迟</span>${latencyHTML(s)}</div>
              </div>
            </div>
            <div class="server-body">
              <div class="body-inner">
                ${newRoomsHtml}
              </div>
            </div>
          </div>
        `;
        ensureErrorBadge(div, errText);

        const nameEl = div.querySelector('.server-name');
        if (nameEl) {
          nameEl.addEventListener('click', function (e) {
            e.stopPropagation();
            copyServerName(this.dataset.copytext, this);
          });
        }
        const addrEl = div.querySelector('.server-address');
        if (addrEl) {
          addrEl.addEventListener('click', function (e) {
            e.stopPropagation();
            copyServerAddress(this.dataset.copytext, this);
          });
        }

        initDragAndDrop(div, s);

        if (s.is_manual) {
          initSwipe(div);
        } else {
          const actions = div.querySelector('.server-actions');
          if (actions) actions.style.display = 'none';
        }

        initChatForCard(s.id, div);
        ensureUnreadIndicator(div, s.id);

        existing.set(s.id, div);
      }
      order.push(existing.get(s.id));
    });

    if (state.firstLoad || list.children.length === 0) {
      list.innerHTML = '';
      const frag = document.createDocumentFragment();
      order.forEach(el => frag.appendChild(el));
      list.appendChild(frag);
      state.firstLoad = false;
      saveCurrentOrder();
    } else {
      const cur = [...list.children];
      let changed = cur.length !== order.length;
      if (!changed) for (let i = 0; i < cur.length; i++) if (cur[i] !== order[i]) { changed = true; break; }
      if (changed) { const frag = document.createDocumentFragment(); order.forEach(el => frag.appendChild(el)); list.appendChild(frag); }
    }

    // 不再需要 checkOverflow
  }

  // ===== 全局事件：复制游戏 ID =====
  document.addEventListener('click', function (e) {
    const target = e.target.closest('.game-name.copy-game-id');
    if (target && target.dataset.isunknown === 'true') {
      e.stopPropagation();
      const contentId = target.dataset.contentid;
      if (contentId && contentId !== UNKNOWN_ID) {
        copyWithMessage(contentId, '✅ 已复制游戏 ID: ' + contentId);
      }
    }
  });

  // ---- 聊天链接点击复制 ----
  document.addEventListener('click', function(e) {
    const link = e.target.closest('.chat-link');
    if (link) {
      e.stopPropagation();
      const url = link.dataset.url;
      if (url) {
        copyWithMessage(url, '✅ 已复制：' + url);
      }
    }
  });

  // ===== 筛选器渲染 =====
  // 房间保活：与「全部」相同（后端 + 前端 5 次）
  // 游戏标题栏：跟随保活后的房间；该游戏保活房间归零后标签消失并回退到「总房间」
  const ROOM_KEEP_MISSES = 5;
  const _roomKeepClient = Object.create(null); // key -> { room, misses }

  function normalizeFilterGame(game) {
    const g = (game == null ? '' : String(game)).trim();
    if (!g) return '未知游戏';
    // 统一：未知游戏 / 未知游戏 (TITLEID) / 含「未知」的占位名
    if (g === '未知游戏' || g.startsWith('未知游戏') || /^未知/.test(g)) return '未知游戏';
    return g;
  }

  function isUnknownFilterGame(game) {
    return normalizeFilterGame(game) === '未知游戏';
  }

  function roomClientKey(r) {
    return [
      r.server_id || '',
      r.id || '',
      r.content_id || '',
      r.host || '',
      normalizeFilterGame(r.game)
    ].join('|');
  }

  // 前端房间保活：全部 / 总房间 / 各游戏筛选共用
  function applyClientRoomKeepalive(incoming) {
    const seen = Object.create(null);
    (incoming || []).forEach(r => {
      const k = roomClientKey(r);
      seen[k] = true;
      _roomKeepClient[k] = { room: r, misses: 0 };
    });
    Object.keys(_roomKeepClient).forEach(k => {
      if (seen[k]) return;
      _roomKeepClient[k].misses = (Number(_roomKeepClient[k].misses) || 0) + 1;
      if (_roomKeepClient[k].misses >= ROOM_KEEP_MISSES) {
        delete _roomKeepClient[k];
      }
    });
    return Object.keys(_roomKeepClient).map(k => _roomKeepClient[k].room);
  }

  // 从保活后的房间列表提取游戏（含未知游戏）
  function getActiveFilterGames() {
    const set = new Set();
    (state.rooms || []).forEach(r => {
      set.add(normalizeFilterGame(r.game));
    });
    const list = [...set];
    list.sort((a, b) => {
      if (a === '未知游戏') return -1;
      if (b === '未知游戏') return 1;
      return String(a).localeCompare(String(b), 'zh');
    });
    return list;
  }

  function roomMatchesFilterGame(room, gameKey) {
    if (gameKey === 'all' || gameKey === 'all_servers') return true;
    if (gameKey === '未知游戏') return isUnknownFilterGame(room.game);
    return normalizeFilterGame(room.game) === gameKey;
  }

  function renderFilters() {
    const games = getActiveFilterGames().slice(0, 10);
    // 固定：全部 / 总房间；游戏标签随保活房间存在而显示
    const tabs = ['all_servers', 'all', ...games];
    const container = document.getElementById('filters');
    if (!container) return;
    const existing = container.children;

    while (existing.length < tabs.length) {
      const btn = document.createElement('button');
      btn.className = 'filter-tab';
      btn.addEventListener('click', () => {
        container.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.game = btn.dataset.game;

        let autoExpand = true;
        if (btn.dataset.game === 'all') {
          autoExpand = false;
        } else if (btn.dataset.game === 'all_servers') {
          autoExpand = true;
        } else {
          autoExpand = true;
        }
        applyFilter(autoExpand);
      });
      container.appendChild(btn);
    }

    while (existing.length > tabs.length) {
      existing[existing.length - 1].remove();
    }

    // 当前选中的游戏已无保活房间 → 回退到「总房间」
    const activeGames = new Set(games);
    if (state.game !== 'all' && state.game !== 'all_servers' &&
        !activeGames.has(normalizeFilterGame(state.game))) {
      state.game = 'all';
    }

    tabs.forEach((g, i) => {
      const btn = existing[i];
      let label;
      if (g === 'all') label = `总房间 (${state.rooms.length})`;
      else if (g === 'all_servers') label = `全部 (${state.servers.length})`;
      else label = esc(g);
      btn.dataset.game = g;
      btn.textContent = label;

      const active = (g === 'all' && state.game === 'all') ||
        (g === 'all_servers' && state.game === 'all_servers') ||
        (g !== 'all' && g !== 'all_servers' && state.game === g);
      btn.classList.toggle('active', active);
    });
  }

  // 正在该服务器卡片内聊天（输入框聚焦）时，自动展开逻辑不得收起该卡片
  function isServerChatActive(serverId) {
    const group = document.querySelector(`.server-group[data-id="${serverId}"]`);
    if (!group) return false;
    const active = document.activeElement;
    if (!active || !group.contains(active)) return false;
    // 输入框、发送按钮、图片按钮等聊天区内的交互都算“正在聊天”
    return !!(
      active.classList.contains('chat-input') ||
      active.classList.contains('chat-send-btn') ||
      active.classList.contains('chat-image-btn') ||
      active.classList.contains('chat-voice-btn') ||
      active.classList.contains('image-upload-btn') ||
      active.closest('.chat-wrapper')
    );
  }

  // ===== 核心渲染 =====
  function render() {
    if (state.autoExpand) {
      // 若正在某个卡片内聊天：只保留该卡片展开，禁止其它卡片被自动展开
      let chattingId = null;
      for (let i = 0; i < state.servers.length; i++) {
        if (isServerChatActive(state.servers[i].id)) {
          chattingId = state.servers[i].id;
          break;
        }
      }

      if (chattingId) {
        state.servers.forEach(s => {
          if (s.id === chattingId) state.expanded.add(s.id);
          else state.expanded.delete(s.id);
        });
      } else {
        state.servers.forEach(s => {
          const hasRooms = state.rooms.some(r => r.server_id === s.id);
          if (hasRooms) state.expanded.add(s.id);
          else state.expanded.delete(s.id);
        });
      }
    }

    if (state.firstExpand) { state.game = 'all_servers'; state.firstExpand = false; }
    renderFilters();
    renderServers();
    applyFilter(false);
    syncUnreadWithExpanded();
  }

  // ===== 加载数据 =====
  let refreshTimer = null;

  async function load(force, ignoreSaved = false) {
    if (document.hidden && !force) return;
    if (state.loading && !force) return;

    if (!navigator.onLine) {
      state.servers.forEach(s => {
        s.status = 'offline';
        s.latency_ms = null;
        s.error = '网络已断开';
      });
      render();
      if (netDot) {
        netDot.classList.remove('online', 'offline');
        netDot.classList.add('offline');
        netDot.title = '网络已断开';
      }
      state.loading = false;
      return;
    }

    state.loading = true;
    const isFirstLoad = state.firstLoad;
    if (isFirstLoad && !ignoreSaved) {
      try {
        const cs = localStorage.getItem('lan_play_cache_servers');
        const cr = localStorage.getItem('lan_play_cache_rooms');
        if (cs && cr) {
          state.servers = JSON.parse(cs);
          state.rooms = JSON.parse(cr);
          loadSavedOrder();
          render();
        }
      } catch (e) { /* ignore */ }
    }

    try {
      const url = '/api/snapshot?refresh=' + (force ? '1' : '0') + '&_=' + Date.now();
      const data = await getJSON(url);

      state.servers = Array.isArray(data.servers) ? data.servers : [];
      // 全部 / 总房间 / 游戏筛选共用保活后的房间列表
      const rawRooms = Array.isArray(data.rooms) ? data.rooms : [];
      state.rooms = applyClientRoomKeepalive(rawRooms);

      if (ignoreSaved) {
        state._defaultOrder = state.servers.map(s => ({ id: s.id }));
        saveCurrentOrder();
      } else {
        const loaded = loadSavedOrder();
        if (!loaded && state._defaultOrder === null) {
          state._defaultOrder = state.servers.map(s => ({ id: s.id }));
        }
      }

      localStorage.setItem('lan_play_cache_servers', JSON.stringify(state.servers));
      localStorage.setItem('lan_play_cache_rooms', JSON.stringify(state.rooms));

      await new Promise(res => requestAnimationFrame(res));
      render();

      if (state.goEasyReady) {
        forceSubscribeAll();
      }

      checkNetwork(true);
    } catch (e) {
      state.servers.forEach(s => {
        s.status = 'offline';
        s.latency_ms = null;
        s.error = '网络连接失败';
      });
      render();
      checkNetwork(true);
    } finally {
      state.loading = false;
    }
  }

  // ===== 轮询 =====
  function startPolling() {
    if (state.pollInterval) clearInterval(state.pollInterval);
    load(false);
    state.pollInterval = setInterval(() => {
      if (!document.hidden) {
        load(false);
      }
    }, 1000);
  }

  // ===== 可见性变化 =====
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.pollInterval) {
        clearInterval(state.pollInterval);
        state.pollInterval = null;
      }
    } else {
      startPolling();
      setTimeout(() => {
        reconnectChat();
      }, 500);
    }
  });

  // ===== 下拉刷新 =====
  let touchStartY = 0;
  document.addEventListener('touchstart', e => { touchStartY = e.changedTouches[0].screenY; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dy = touchStartY - e.changedTouches[0].screenY;
    if (dy < -80 && window.scrollY <= 0) {
      load(true);
    }
  }, { passive: true });

  // ===== 窗口resize =====
  window.addEventListener('resize', () => {
    // 不再需要 checkOverflow
  });

  // ===== 启动 =====
  state.firstLoad = true;
  state.firstExpand = true;

  state.username = getStoredUsername();
  loadChatMessages();
  loadPublicMessages();
  loadUnreadStatus();
  updateAllMessagesIsMine();
  restorePublicUnread();

  const addHost = document.getElementById('addHost');
  const addPort = document.getElementById('addPort');
  setupHostPortAutoFill(addHost, addPort);

  initGoEasy();
  bindPublicChatEvents();
  bindOnlineMembersEvents();
  updateOnlineMembersUI();
  startPolling();

  // ===== 自动展开按钮控制 =====
  const toggleAutoBtn = document.getElementById('toggleAutoExpandBtn');
  if (toggleAutoBtn) {
    toggleAutoBtn.textContent = state.autoExpand ? '📂' : '📁';
    toggleAutoBtn.addEventListener('click', function() {
      state.autoExpand = !state.autoExpand;
      localStorage.setItem(AUTO_EXPAND_KEY, String(state.autoExpand));
      this.textContent = state.autoExpand ? '📂' : '📁';
      render();
      showToast(state.autoExpand ? '✅ 自动展开已开启' : '⛔ 自动展开已关闭', 1200, true);
    });
  }

  // ===== 卡片点击委托 =====
  document.getElementById('serverList').addEventListener('click', function(e) {
    const head = e.target.closest('.server-head');
    if (!head) return;
    const group = head.closest('.server-group');
    if (!group) return;
    const id = group.dataset.id;
    if (!id) return;

    if (group.classList.contains('swipe-open')) {
      if (group._resetSwipe) group._resetSwipe();
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (state.expanded.has(id)) {
      state.expanded.delete(id);
      group.classList.remove('open');
      if (state.frozenCardId === id) {
        state.frozenCardId = null;
        renderServers();
      }
      return;
    }

    if (state.unreadStatus[id]) {
      delete state.unreadStatus[id];
      saveUnreadStatus();
      updateUnreadIndicators();
    }

    const allGroups = document.querySelectorAll('.server-group');
    allGroups.forEach(g => {
      const gid = g.dataset.id;
      if (gid && gid !== id && state.expanded.has(gid)) {
        state.expanded.delete(gid);
        g.classList.remove('open');
      }
    });

    if (state.frozenCardId) {
      state.frozenCardId = null;
    }

    state.expanded.add(id);
    group.classList.add('open');

    state.frozenCardId = null;
    renderServers();
    state.frozenCardId = id;
    try {
      const gid = serverGroupId(id);
      syncGroupOfflineHistory(gid);
      markGroupReadNow(gid);
      if (state.unreadStatus[id]) {
        delete state.unreadStatus[id];
        saveUnreadStatus();
        updateUnreadIndicators();
      }
    } catch (e) {}
  });

  function createElementFromHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild;
  }

  window.addEventListener('beforeunload', () => {
    if (state.pollInterval) clearInterval(state.pollInterval);
    if (netCheckTimer) clearInterval(netCheckTimer);
    if (logInterval) clearInterval(logInterval);
    if (refreshTimer) clearTimeout(refreshTimer);
    if (goEasyInitTimer) clearTimeout(goEasyInitTimer);
    try { stopImPresence(); sendPresenceAction('leave'); flushMarkAsRead(); } catch (e) {}
  });

})();