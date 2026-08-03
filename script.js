(() => {
  'use strict';

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());

  const CHAT_STORAGE_KEY = 'lanplay_chat_messages';
  const PUBLIC_STORAGE_KEY = 'lanplay_public_messages';
  const USERNAME_KEY = 'lan_play_username';
  const UNREAD_STORAGE_KEY = 'lanplay_unread_status';
  const PUBLIC_UNREAD_KEY = 'lanplay_public_unread';

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
  };

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
    const serverList = document.getElementById('serverList');
    if (serverList) {
      serverList.style.zoom = clamped / 100;
    }
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
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const hour12 = hours % 12 || 12;

    let period;
    if (hours < 5) period = '凌晨';
    else if (hours < 12) period = '上午';
    else if (hours < 13) period = '中午';
    else if (hours < 18) period = '下午';
    else period = '晚上';

    if (date >= today) {
      return `${period} ${hour12}:${minutes}`;
    } else if (date >= yesterday) {
      return `昨天 ${hour12}:${minutes}`;
    } else {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${month}/${day} ${hour12}:${minutes}`;
    }
  }

  // ===== 双副本 HTML =====
  function makeServerNameHtml(name, copyText) {
    const escaped = esc(name);
    const shortClass = name.length > 20 ? '' : 'short-text';
    return `<span class="server-name ${shortClass}" data-copytext="${esc(copyText)}" title="点击复制服务器名称">
      <span class="scroll-wrapper">
        <span class="server-name-text">${escaped}</span>
        <span class="server-name-text">${escaped}</span>
      </span>
    </span>`;
  }
  function makeServerAddressHtml(address, copyText) {
    const escaped = esc(address);
    const shortClass = address.length > 20 ? '' : 'short-text';
    return `<span class="server-address ${shortClass}" data-copytext="${esc(copyText)}" title="点击复制服务器地址: ${esc(copyText)}">
      <span class="scroll-wrapper">
        <span class="server-address-text">${escaped}</span>
        <span class="server-address-text">${escaped}</span>
      </span>
    </span>`;
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

    const isLongGame = gameDisplay.length > 20;
    const shortClassGame = isLongGame ? '' : 'short-text';
    let gameNameHtml = `<span class="game-name ${copyClass} ${shortClassGame}" data-contentid="${esc(contentId)}" data-isunknown="${canCopy ? 'true' : 'false'}" title="${esc(gameTitle)}">
      <span class="scroll-wrapper">
        <span class="game-name-text">${esc(gameDisplay)}</span>
        <span class="game-name-text">${esc(gameDisplay)}</span>
      </span>
    </span>`;

    const hostName = room.host || '未知房间';
    const isLongHost = hostName.length > 20;
    const shortClassHost = isLongHost ? '' : 'short-text';
    let hostHtml = `<span class="room-host-meta"><span class="host-icon-fixed">🏠</span><span class="host-name ${shortClassHost}"><span class="scroll-wrapper"><span class="host-name-text">${esc(hostName)}</span><span class="host-name-text">${esc(hostName)}</span></span></span></span>`;

    const roomId = esc(room.id || '');
    return `<div class="room-item" data-game="${esc(gameVal)}" data-room-id="${roomId}">
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

  // ===== 溢出检测 =====
  function checkOverflow() {
    const selectors = [
      '.server-name.short-text',
      '.server-address.short-text',
      '.game-name.short-text',
      '.host-name.short-text'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(el => {
      if (el.scrollWidth > el.clientWidth) {
        el.classList.remove('short-text');
      }
    });
  }

  // ===== 新消息指示器相关函数 =====
  function loadUnreadStatus() {
    try {
      const data = localStorage.getItem(UNREAD_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'object' && parsed !== null) {
          state.unreadStatus = parsed;
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

  function updateUnreadIndicators() {
    document.querySelectorAll('.unread-indicator').forEach(el => {
      const sid = el.dataset.serverId;
      const show = state.unreadStatus[sid] ? true : false;
      el.style.display = show ? 'inline-block' : 'none';
    });
  }

  function syncUnreadWithExpanded() {
    let changed = false;
    state.expanded.forEach(id => {
      if (state.unreadStatus[id]) {
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
    if (indicator) {
      indicator.style.display = state.unreadStatus[serverId] ? 'inline-block' : 'none';
    }
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
    const g = state.game;
    const isAll = (g === 'all');
    const isAllServers = (g === 'all_servers');
    const filteredRooms = isAllServers ? state.rooms : (isAll ? state.rooms : state.rooms.filter(r => r.game === g));
    const onlineCount = state.servers.filter(s => s.status === 'online').length;
    document.getElementById('ovServers').textContent = `${onlineCount}/${state.servers.length}`;
    document.getElementById('ovOnline').textContent = state.servers.filter(s => s.status === 'online').reduce((a, s) => a + (s.online || 0), 0);
    document.getElementById('ovIdle').textContent = state.servers.filter(s => s.status === 'online').reduce((a, s) => a + (s.idle || 0), 0);
    document.getElementById('ovRooms').textContent = filteredRooms.length;
    document.querySelectorAll('.room-item').forEach(el => { el.style.display = (isAll || isAllServers || el.dataset.game === g) ? '' : 'none'; });
    state.servers.forEach(s => {
      const group = document.querySelector(`.server-group[data-id="${s.id}"]`);
      if (!group) return;
      const items = group.querySelectorAll('.room-item');
      let visible = 0;
      items.forEach(el => { if (el.style.display !== 'none') visible++; });
      const isOnline = s.status === 'online' && !s.error;
      if (isAllServers) {
        group.style.display = '';
        if (autoExpand && !group.classList.contains('open')) { group.classList.add('open'); state.expanded.add(s.id); }
        group.querySelectorAll('.no-rooms,.no-rooms-empty,.no-rooms-match').forEach(el => el.remove());
        if (items.length === 0 && isOnline) {
          let m = group.querySelector('.no-rooms-empty');
          if (!m) { m = document.createElement('div'); m.className = 'no-rooms-empty no-rooms'; m.textContent = '📭 该服务器暂无公开房间'; const body = group.querySelector('.server-body > .body-inner'); if (body) body.appendChild(m); }
          m.style.display = '';
        }
      } else if (isAll) {
        const hasAny = items.length > 0;
        group.style.display = (hasAny && isOnline) ? '' : 'none';
        if (autoExpand && hasAny && !group.classList.contains('open')) { group.classList.add('open'); state.expanded.add(s.id); }
        group.querySelectorAll('.no-rooms,.no-rooms-empty,.no-rooms-match').forEach(el => el.remove());
      } else {
        if (visible > 0 && isOnline) {
          group.style.display = '';
          if (autoExpand && !group.classList.contains('open')) { group.classList.add('open'); state.expanded.add(s.id); }
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

    checkOverflow();
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
  // ========== GoEasy 聊天模块 ==========
  // ============================================================
  let goEasy = null;
  const CHAT_PREFIX = 'lanplay_chat_';
  const PUBLIC_CHANNEL = 'public_chat';
  let goEasyInitTimer = null;

  let usernameModalInstance = null;

  function getStoredUsername() {
    return localStorage.getItem(USERNAME_KEY) || '';
  }

  // ---- 消息持久化 ----
  function loadChatMessages() {
    try {
      const data = localStorage.getItem(CHAT_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'object' && parsed !== null) {
          state.chatMessages = parsed;
          return;
        }
      }
    } catch (e) { /* ignore */ }
    state.chatMessages = {};
  }

  function saveChatMessages() {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state.chatMessages));
    } catch (e) { /* ignore */ }
  }

  function loadPublicMessages() {
    try {
      const data = localStorage.getItem(PUBLIC_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          state.publicMessages = parsed;
          return;
        }
      }
    } catch (e) { /* ignore */ }
    state.publicMessages = [];
  }

  function savePublicMessages() {
    try {
      localStorage.setItem(PUBLIC_STORAGE_KEY, JSON.stringify(state.publicMessages));
    } catch (e) { /* ignore */ }
  }

  function updateAllMessagesIsMine() {
    const currentUser = state.username;
    Object.keys(state.chatMessages).forEach(serverId => {
      const msgs = state.chatMessages[serverId];
      if (msgs) {
        msgs.forEach(msg => {
          msg.isMine = (msg.sender === currentUser);
        });
        renderChatMessages(serverId);
      }
    });
    if (state.publicMessages) {
      state.publicMessages.forEach(msg => {
        msg.isMine = (msg.sender === currentUser);
      });
      renderPublicChat();
    }
    saveChatMessages();
    savePublicMessages();
  }

  function saveUsername(name) {
    const trimmed = name.trim();
    if (trimmed) {
      localStorage.setItem(USERNAME_KEY, trimmed);
      state.username = trimmed;
      updateAllMessagesIsMine();
      updateChatUI();
      return true;
    }
    return false;
  }

  function showUsernamePrompt(callback) {
    if (usernameModalInstance) {
      usernameModalInstance.remove();
      usernameModalInstance = null;
    }

    const modal = document.createElement('div');
    modal.className = 'custom-modal open';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="custom-modal-box" style="width:min(380px,calc(100% - 32px));">
        <div class="custom-modal-header">
          <span>👤 设置用户名</span>
          <button class="custom-modal-close username-modal-close">✕</button>
        </div>
        <div class="custom-modal-body">
          <p style="margin:0 0 16px;font-size:14px;color:var(--muted);">请输入您在聊天中显示的名称：</p>
          <div class="form-row">
            <input type="text" id="usernameInput" placeholder="输入用户名" value="${esc(getStoredUsername())}" maxlength="20" autofocus>
          </div>
          <button id="usernameConfirmBtn" class="submit-btn" style="margin-top:12px;">
            <span class="spinner"></span>
            <span class="btn-text">确认</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    usernameModalInstance = modal;

    const closeBtn = modal.querySelector('.username-modal-close');
    const confirmBtn = modal.querySelector('#usernameConfirmBtn');
    const input = modal.querySelector('#usernameInput');

    function doConfirm() {
      const name = input.value.trim();
      if (!name) {
        showToast('⚠️ 用户名不能为空', 1500, false);
        input.focus();
        return;
      }
      if (saveUsername(name)) {
        modal.remove();
        usernameModalInstance = null;
        showToast('✅ 用户名已设置为: ' + name, 1500, true);
        if (callback) callback();
        updateChatUI();
      }
    }

    closeBtn.addEventListener('click', () => {
      modal.remove();
      usernameModalInstance = null;
      if (!state.username) {
        setTimeout(() => showUsernamePrompt(callback), 300);
      }
    });
    confirmBtn.addEventListener('click', doConfirm);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doConfirm();
      }
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        usernameModalInstance = null;
        if (!state.username) {
          setTimeout(() => showUsernamePrompt(callback), 300);
        }
      }
    });
    setTimeout(() => input.focus(), 100);
  }

  function ensureUsername(callback) {
    if (state.username) {
      if (callback) callback();
      return true;
    }
    const stored = getStoredUsername();
    if (stored) {
      state.username = stored;
      updateAllMessagesIsMine();
      updateChatUI();
      if (callback) callback();
      return true;
    }
    showUsernamePrompt(callback);
    return false;
  }

  function updateChatUI() {
    const hasUsername = !!state.username;
    const ready = state.goEasyReady && hasUsername;
    document.querySelectorAll('.server-group .chat-input').forEach(inp => {
      inp.disabled = !ready;
      inp.placeholder = ready ? '输入聊天内容...' : (state.goEasyReady ? '请先设置用户名' : '聊天未连接');
    });
    document.querySelectorAll('.server-group .chat-send-btn').forEach(btn => {
      btn.disabled = !ready;
    });
    const pubInput = document.getElementById('publicChatInput');
    const pubSend = document.getElementById('publicChatSendBtn');
    if (pubInput) {
      pubInput.disabled = !ready;
      pubInput.placeholder = ready ? '输入公共消息...' : (state.goEasyReady ? '请先设置用户名' : '聊天未连接');
    }
    if (pubSend) pubSend.disabled = !ready;
  }

  // ===== 文件上传 =====
  async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      showToast('⏳ 上传中...', 3000, false);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.ok && data.url) {
        const fileType = data.file_type || (file.type && file.type.startsWith('video') ? 'video' : 'image');
        return {
          url: data.url,
          type: fileType
        };
      } else {
        throw new Error(data.error || '上传失败');
      }
    } catch (e) {
      showToast('❌ 上传失败：' + e.message, 3000, false);
      console.error('上传错误:', e);
      return null;
    }
  }

  function sendMessageWithMedia(serverId, inputElement, sendFunction, isPublic = false) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,video/*';
    fileInput.multiple = false;
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const result = await uploadFile(file);
      if (!result) return;

      const prefix = result.type === 'video' ? '[视频]' : '[图片]';
      const text = `${prefix}${result.url}`;

      if (isPublic) {
        sendPublicMessage(text, result.type === 'video');
      } else {
        sendFunction(serverId, text, result.type === 'video');
      }

      if (inputElement) inputElement.value = '';
    };
    fileInput.click();
  }

  // ---- 链接识别（URL、域名、IPv4、IPv6）- 不追加协议头 ----
  function linkifyText(text) {
    if (!text) return '';
    // 匹配：完整URL、域名（含子域名）、IPv4、IPv6（简写/完整）
    const urlRegex = /(https?:\/\/[^\s]+|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?|\b(?:(?:[0-9]{1,3}\.){3}[0-9]{1,3}|(?:[0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}|::[0-9a-fA-F]{1,4}|[0-9a-fA-F]{1,4}::)\b)/g;
    return text.replace(urlRegex, function(match) {
      // 移除末尾常见标点（不影响中文）
      const cleaned = match.replace(/[.,;:!?]+$/, '');
      // 不再补协议，直接使用原始字符串（复制时不加 http://）
      return `<span class="chat-link" data-url="${esc(cleaned)}">${esc(match)}</span>`;
    });
  }

  // ---- 渲染消息内容 ----
  function renderMessageContent(msg) {
    if (msg.isImage && msg.text.startsWith('[图片]')) {
      const url = msg.text.substring(4);
      return `<img src="${esc(url)}" alt="图片" style="max-width:200px;max-height:200px;border-radius:8px;display:block;margin-top:4px;">`;
    }
    if (msg.isImage && msg.text.startsWith('[视频]')) {
      const url = msg.text.substring(4);
      return `<video src="${esc(url)}" controls preload="metadata" style="max-width:200px;max-height:200px;border-radius:8px;display:block;margin-top:4px;background:#000;"></video>`;
    }
    // 普通文本：检测链接
    return linkifyText(msg.text);
  }

  // ---- 初始化 GoEasy ----
  function initGoEasy(retryCount) {
    if (retryCount === undefined) retryCount = 0;
    if (typeof GoEasy === 'undefined') {
      if (retryCount < 3) {
        console.warn(`GoEasy SDK 未加载，${retryCount+1}秒后重试...`);
        setTimeout(() => initGoEasy(retryCount + 1), 2000);
      } else {
        console.error('GoEasy SDK 加载失败，聊天功能不可用');
        state.goEasyReady = false;
        document.querySelectorAll('.server-group .chat-wrapper .chat-messages').forEach(el => {
          el.innerHTML = '<div style="color:var(--red);text-align:center;padding:8px;">⚠️ 聊天服务未连接</div>';
        });
        document.querySelectorAll('.server-group .chat-input').forEach(inp => { inp.disabled = true; inp.placeholder = '聊天未连接'; });
        document.querySelectorAll('.server-group .chat-send-btn').forEach(btn => btn.disabled = true);
        const pubContainer = document.getElementById('publicChatMessages');
        if (pubContainer) pubContainer.innerHTML = '<div style="color:var(--red);text-align:center;padding:20px;">⚠️ 聊天服务未连接</div>';
      }
      return;
    }

    ensureUsername(() => {
      try {
        goEasy = GoEasy.getInstance({
          host: 'hangzhou.goeasy.io',
          appkey: 'BC-e891108825ab43fb97dabe3327478e30',
          modules: ['pubsub'],
          forceTLS: true
        });
        goEasy.connect({
          id: state.username || 'anonymous_' + generateMsgId(),
          onSuccess: function () {
            console.log('GoEasy 连接成功，用户ID:', goEasy.id);
            state.goEasyReady = true;
            showToast('✅ 聊天服务已连接', 1500, true);
            subscribePublicChannel();
            forceSubscribeAll();
            state.servers.forEach(s => renderChatMessages(s.id));
            renderPublicChat();
            updateChatUI();
            restorePublicUnread();
          },
          onFailed: function (error) {
            console.error('GoEasy 连接失败', error);
            state.goEasyReady = false;
            if (retryCount < 3) {
              console.warn(`GoEasy 连接失败，${retryCount+1}秒后重试...`);
              setTimeout(() => {
                if (goEasy) {
                  try { goEasy.disconnect(); } catch(e) {}
                  goEasy = null;
                }
                initGoEasy(retryCount + 1);
              }, 2000);
            } else {
              showToast('❌ 聊天服务连接失败，请检查网络或 appkey', 3000, false);
              document.querySelectorAll('.server-group .chat-input').forEach(inp => { inp.disabled = true; inp.placeholder = '聊天不可用'; });
              document.querySelectorAll('.server-group .chat-send-btn').forEach(btn => btn.disabled = true);
              const pubContainer = document.getElementById('publicChatMessages');
              if (pubContainer) pubContainer.innerHTML = '<div style="color:var(--red);text-align:center;padding:20px;">⚠️ 聊天服务未连接</div>';
            }
          }
        });
      } catch (e) {
        console.error('GoEasy 初始化异常', e);
        state.goEasyReady = false;
        if (retryCount < 3) {
          setTimeout(() => initGoEasy(retryCount + 1), 2000);
        } else {
          showToast('❌ 聊天服务初始化失败', 3000, false);
        }
      }
    });
  }

  // ---- 公共未读状态管理 ----
  function getPublicUnread() {
    return localStorage.getItem(PUBLIC_UNREAD_KEY) === 'true';
  }

  function setPublicUnread(value) {
    localStorage.setItem(PUBLIC_UNREAD_KEY, value ? 'true' : 'false');
    const btn = document.getElementById('openPublicChatBtn');
    if (btn) {
      if (value) {
        btn.classList.add('has-new');
      } else {
        btn.classList.remove('has-new');
      }
    }
  }

  function restorePublicUnread() {
    if (getPublicUnread()) {
      const btn = document.getElementById('openPublicChatBtn');
      if (btn) btn.classList.add('has-new');
    } else {
      const btn = document.getElementById('openPublicChatBtn');
      if (btn) btn.classList.remove('has-new');
    }
  }

  // ---- 订阅服务器频道 ----
  function subscribeChannel(serverId) {
    if (!goEasy || !state.goEasyReady) return;
    const channel = CHAT_PREFIX + serverId;
    goEasy.pubsub.subscribe({
      channel: channel,
      history: 50,
      onMessage: function (message) {
        handleChatMessage(serverId, message.content);
      },
      onSuccess: function () {
        state.chatSubscribed[serverId] = true;
        console.log(`订阅频道 ${channel} 成功`);
      },
      onFailed: function (error) {
        console.error(`订阅频道 ${channel} 失败`, error);
        setTimeout(() => {
          if (state.goEasyReady) {
            subscribeChannel(serverId);
          }
        }, 5000);
      }
    });
  }

  function subscribeAllChannels() {
    if (!goEasy || !state.goEasyReady) return;
    state.servers.forEach(s => {
      subscribeChannel(s.id);
    });
  }

  function forceSubscribeAll() {
    if (!state.goEasyReady) return;
    state.chatSubscribed = {};
    subscribeAllChannels();
    subscribePublicChannel();
    console.log('[聊天] 强制重新订阅所有频道');
  }

  // ---- 服务器聊天接收 ----
  function handleChatMessage(serverId, content) {
    try {
      const msg = JSON.parse(content);
      if (!state.chatMessages[serverId]) state.chatMessages[serverId] = [];

      const exists = state.chatMessages[serverId].some(m => m.id === msg.id);
      if (exists) return;

      const isMine = (msg.sender === state.username);
      state.chatMessages[serverId].push({
        id: msg.id,
        text: msg.text,
        sender: msg.sender,
        isMine: isMine,
        time: msg.time || Date.now(),
        isImage: msg.isImage || false,
      });
      saveChatMessages();
      renderChatMessages(serverId);

      if (!isMine && !state.expanded.has(serverId)) {
        state.unreadStatus[serverId] = true;
        saveUnreadStatus();
        updateUnreadIndicators();
      }
    } catch (e) {
      console.warn('解析聊天消息失败', e);
    }
  }

  // ---- 服务器聊天发送 ----
  function sendChatMessage(serverId, text, isVideo = false) {
    if (!text.trim()) return;
    if (!state.username) {
      ensureUsername(() => {});
      showToast('⚠️ 请先设置用户名', 1500, false);
      return;
    }
    if (!goEasy || !state.goEasyReady) {
      showToast('⚠️ 聊天服务未连接，请稍后重试', 2000, false);
      return;
    }
    const channel = CHAT_PREFIX + serverId;
    const msgId = generateMsgId();
    const payload = JSON.stringify({
      id: msgId,
      text: text.trim(),
      sender: state.username,
      time: Date.now(),
      isImage: true,
    });
    goEasy.pubsub.publish({
      channel: channel,
      message: payload,
      qos: 1,
      onSuccess: function () {
        if (!state.chatMessages[serverId]) state.chatMessages[serverId] = [];
        const exists = state.chatMessages[serverId].some(m => m.id === msgId);
        if (!exists) {
          state.chatMessages[serverId].push({
            id: msgId,
            text: text.trim(),
            sender: state.username,
            isMine: true,
            time: Date.now(),
            isImage: true,
          });
          saveChatMessages();
        }
        renderChatMessages(serverId);
        const card = document.querySelector(`.server-group[data-id="${serverId}"]`);
        if (card) {
          const input = card.querySelector('.chat-input');
          if (input) input.value = '';
        }
      },
      onFailed: function (error) {
        console.error('消息发送失败', error);
        showToast('❌ 消息发送失败：' + error.content, 2500, false);
      }
    });
  }

  // ---- 渲染消息列表 ----
  function renderChatMessages(serverId) {
    const card = document.querySelector(`.server-group[data-id="${serverId}"]`);
    if (!card) return;
    const container = card.querySelector('.chat-messages');
    if (!container) return;
    if (!state.goEasyReady) {
      container.innerHTML = '<div style="color:var(--red);text-align:center;padding:8px;">⚠️ 聊天服务未连接</div>';
      return;
    }
    const messages = state.chatMessages[serverId] || [];
    if (messages.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:8px;font-size:12px;">暂无消息</div>';
      return;
    }
    container.innerHTML = messages.map(msg => {
      const cls = msg.isMine ? 'chat-msg-mine' : 'chat-msg-other';
      const sender = msg.sender || '匿名';
      const timeStr = formatMessageTime(msg.time);
      const contentHtml = renderMessageContent(msg);
      return `<div class="chat-msg ${cls}">
        <div class="msg-content"><strong>${esc(sender)}</strong>：${contentHtml}</div>
        <div class="msg-time">${esc(timeStr)}</div>
      </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }

  // ===== 初始化聊天卡片 =====
  function initChatForCard(serverId, cardElement) {
    let wrapper = cardElement.querySelector('.chat-wrapper');
    const bodyInner = cardElement.querySelector('.server-body > .body-inner');
    if (!bodyInner) return;

    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'chat-wrapper';
      const hasUsername = !!state.username;
      const ready = state.goEasyReady && hasUsername;
      wrapper.innerHTML = `
        <div class="chat-messages"></div>
        <div class="chat-input-area" style="display:flex;gap:6px;align-items:center;margin-top:8px;">
          <button class="image-upload-btn chat-image-btn" title="从相册选择图片或视频">🖼️</button>
          <input type="text" class="chat-input" placeholder="${ready ? '输入聊天内容...' : (state.goEasyReady ? '请先设置用户名' : '聊天未连接')}" ${ready ? '' : 'disabled'}>
          <button class="chat-send-btn" ${ready ? '' : 'disabled'}>发送</button>
        </div>
      `;
      const roomList = bodyInner.querySelector('.room-list');
      if (roomList) {
        bodyInner.insertBefore(wrapper, roomList);
      } else {
        bodyInner.prepend(wrapper);
      }
    } else {
      const roomList = bodyInner.querySelector('.room-list');
      if (roomList && wrapper.nextSibling !== roomList) {
        bodyInner.insertBefore(wrapper, roomList);
      } else if (!roomList && wrapper !== bodyInner.firstChild) {
        bodyInner.prepend(wrapper);
      }
    }

    const input = wrapper.querySelector('.chat-input');
    const sendBtn = wrapper.querySelector('.chat-send-btn');
    const imageBtn = wrapper.querySelector('.chat-image-btn');
    if (input && sendBtn) {
      const sendHandler = function() {
        const text = input.value.trim();
        if (text) sendChatMessage(serverId, text, false);
      };
      if (!wrapper.dataset.bound) {
        sendBtn.addEventListener('click', sendHandler);
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            sendHandler();
          }
        });
        imageBtn.addEventListener('click', function() {
          sendMessageWithMedia(serverId, input, sendChatMessage, false);
        });
        wrapper.dataset.bound = 'true';
      }
    }

    renderChatMessages(serverId);
    if (state.goEasyReady && !state.chatSubscribed[serverId]) {
      subscribeChannel(serverId);
    }
  }

  // ---- 公共频道 ----
  function subscribePublicChannel() {
    if (!goEasy || !state.goEasyReady) return;
    goEasy.pubsub.subscribe({
      channel: PUBLIC_CHANNEL,
      history: 50,
      onMessage: function (message) {
        try {
          const msg = JSON.parse(message.content);
          if (!state.publicMessages) state.publicMessages = [];

          const exists = state.publicMessages.some(m => m.id === msg.id);
          if (exists) return;

          const isMine = (msg.sender === state.username);
          state.publicMessages.push({
            id: msg.id,
            text: msg.text,
            sender: msg.sender || '匿名',
            isMine: isMine,
            time: msg.time || Date.now(),
            isImage: msg.isImage || false,
          });
          savePublicMessages();
          renderPublicChat();

          if (!isMine && !state.publicModalOpen) {
            setPublicUnread(true);
          }
        } catch (e) {
          console.warn('公共消息解析失败', e);
        }
      },
      onSuccess: function () {
        console.log('公共频道订阅成功');
        state.publicChatReady = true;
        restorePublicUnread();
      },
      onFailed: function (error) {
        console.error('公共频道订阅失败', error);
        setTimeout(() => {
          if (state.goEasyReady) {
            subscribePublicChannel();
          }
        }, 5000);
      }
    });
  }

  function sendPublicMessage(text, isVideo = false) {
    if (!text.trim()) return;
    if (!state.username) {
      ensureUsername(() => {});
      showToast('⚠️ 请先设置用户名', 1500, false);
      return;
    }
    if (!goEasy || !state.goEasyReady) {
      showToast('⚠️ 聊天服务未连接', 2000, false);
      return;
    }
    const msgId = generateMsgId();
    const payload = JSON.stringify({
      id: msgId,
      text: text.trim(),
      sender: state.username,
      time: Date.now(),
      isImage: true,
    });
    goEasy.pubsub.publish({
      channel: PUBLIC_CHANNEL,
      message: payload,
      qos: 1,
      onSuccess: function () {
        if (!state.publicMessages) state.publicMessages = [];
        const exists = state.publicMessages.some(m => m.id === msgId);
        if (!exists) {
          state.publicMessages.push({
            id: msgId,
            text: text.trim(),
            sender: state.username,
            isMine: true,
            time: Date.now(),
            isImage: true,
          });
          savePublicMessages();
        }
        renderPublicChat();
        document.getElementById('publicChatInput').value = '';
        setPublicUnread(false);
      },
      onFailed: function (error) {
        showToast('❌ 公共消息发送失败', 2000, false);
        console.error(error);
      }
    });
  }

  function renderPublicChat() {
    const container = document.getElementById('publicChatMessages');
    if (!container) return;
    const msgs = state.publicMessages || [];
    if (!state.goEasyReady) {
      container.innerHTML = '<div style="color:var(--red);text-align:center;padding:20px;">⚠️ 聊天服务未连接</div>';
      return;
    }
    if (msgs.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px;font-size:14px;">暂无消息</div>';
      return;
    }
    container.innerHTML = msgs.map(msg => {
      const cls = msg.isMine ? 'chat-msg-mine' : 'chat-msg-other';
      const sender = msg.sender || '匿名';
      const timeStr = formatMessageTime(msg.time);
      const contentHtml = renderMessageContent(msg);
      return `<div class="chat-msg ${cls}">
        <div class="msg-content"><strong>${esc(sender)}</strong>：${contentHtml}</div>
        <div class="msg-time">${esc(timeStr)}</div>
      </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }

  function bindPublicChatEvents() {
    const openBtn = document.getElementById('openPublicChatBtn');
    const modal = document.getElementById('publicChatModal');
    const closeBtn = document.getElementById('closePublicChatBtn');
    const sendBtn = document.getElementById('publicChatSendBtn');
    const input = document.getElementById('publicChatInput');
    const imageBtn = document.getElementById('publicChatImageBtn');

    if (!openBtn || !modal || !closeBtn || !sendBtn || !input) {
      console.warn('公共聊天 DOM 元素未找到，请检查 index.html');
      return;
    }

    openBtn.addEventListener('click', function() {
      state.publicModalOpen = true;
      modal.classList.add('open');
      setPublicUnread(false);
      renderPublicChat();

      const header = modal.querySelector('.custom-modal-header');
      if (header) {
        let editBtn = header.querySelector('.edit-username-btn');
        if (!editBtn) {
          editBtn = document.createElement('button');
          editBtn.className = 'edit-username-btn';
          editBtn.textContent = '✏️';
          editBtn.title = '编辑用户名';
          editBtn.style.cssText = 'background:none;border:0;font-size:16px;cursor:pointer;color:var(--muted);margin-right:auto;';
          const closeBtnElem = header.querySelector('.custom-modal-close');
          if (closeBtnElem) {
            header.insertBefore(editBtn, closeBtnElem);
          } else {
            header.appendChild(editBtn);
          }
          editBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            showUsernamePrompt(() => {
              renderPublicChat();
              updateChatUI();
            });
          });
        }
        const titleSpan = header.querySelector('.title-text');
        if (titleSpan) {
          titleSpan.style.cursor = 'default';
          titleSpan.title = '';
        }
      }
    });

    closeBtn.addEventListener('click', function() {
      state.publicModalOpen = false;
      modal.classList.remove('open');
    });
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        state.publicModalOpen = false;
        modal.classList.remove('open');
      }
    });

    sendBtn.addEventListener('click', function() {
      const text = input.value.trim();
      if (text) sendPublicMessage(text, false);
    });
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendBtn.click();
      }
    });
    if (imageBtn) {
      imageBtn.textContent = '🖼️';
      imageBtn.title = '从相册选择图片或视频';
      imageBtn.addEventListener('click', function() {
        sendMessageWithMedia(null, input, null, true);
      });
    }
  }

  function reconnectChat() {
    if (state.goEasyReady) {
      forceSubscribeAll();
    } else {
      initGoEasy(0);
    }
  }

  // ============================================================
  // ========== 渲染服务器列表 ==========
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
      const errMsg = s.error ? `<div class="server-error">⚠️ ${esc(s.error)}</div>` : '';
      const newRoomsHtml = rooms.length ? `<div class="room-list">${rooms.map(r => roomCard(r)).join('')}</div>` : '';
      let group = existing.get(s.id);
      const address = s.address || `${s.host}:${s.port}`;

      if (group) {
        // 更新已有卡片
        const dotEl = group.querySelector('.server-status-dot');
        if (dotEl && dotEl.className !== 'server-status-dot ' + dot) dotEl.className = 'server-status-dot ' + dot;

        let nameEl = group.querySelector('.server-name');
        if (nameEl) {
          const texts = nameEl.querySelectorAll('.server-name-text');
          if (texts.length === 2) {
            texts[0].textContent = s.name;
            texts[1].textContent = s.name;
          } else {
            const newHtml = makeServerNameHtml(s.name, s.name);
            nameEl.outerHTML = newHtml;
            nameEl = group.querySelector('.server-name');
          }
          nameEl.dataset.copytext = s.name;
          nameEl.classList.toggle('short-text', s.name.length <= 20);
        } else {
          const info = group.querySelector('.server-info');
          if (info) {
            const newHtml = makeServerNameHtml(s.name, s.name);
            info.insertAdjacentHTML('afterbegin', newHtml);
          }
        }

        let addrEl = group.querySelector('.server-address');
        if (addrEl) {
          const texts = addrEl.querySelectorAll('.server-address-text');
          if (texts.length === 2) {
            texts[0].textContent = address;
            texts[1].textContent = address;
          } else {
            const newHtml = makeServerAddressHtml(address, address);
            addrEl.outerHTML = newHtml;
            addrEl = group.querySelector('.server-address');
          }
          addrEl.dataset.copytext = address;
          addrEl.classList.toggle('short-text', address.length <= 20);
        } else {
          const info = group.querySelector('.server-info');
          if (info) {
            const newHtml = makeServerAddressHtml(address, address);
            info.appendChild(createElementFromHTML(newHtml));
          }
        }

        // 更新地区标签
        const regionEl = group.querySelector('.card-region');
        if (regionEl) {
          if (!s.region) { regionEl.remove(); }
          else if (regionEl.textContent !== s.region) { regionEl.textContent = s.region; regionEl.title = s.region; }
        } else if (s.region) {
          group.querySelector('.server-head').insertAdjacentHTML('afterbegin', regionHtml);
        }

        // 更新类型标签
        let typeEl = group.querySelector('.server-type-badge');
        if (typeBadgeHtml) {
          if (!typeEl) {
            // 插入到 .server-head 的开头
            const head = group.querySelector('.server-head');
            if (head) head.insertAdjacentHTML('afterbegin', typeBadgeHtml);
            typeEl = group.querySelector('.server-type-badge');
          } else {
            // 更新内容
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

        if (s.id !== state.frozenCardId) {
          const body = group.querySelector('.server-body');
          if (body) {
            let errEl = body.querySelector('.server-error');
            let roomListEl = body.querySelector('.room-list');
            if (errEl) errEl.remove();
            if (roomListEl) roomListEl.remove();

            if (errMsg) {
              const temp = document.createElement('div');
              temp.innerHTML = errMsg;
              body.querySelector('.body-inner').prepend(temp.firstElementChild);
            }
            if (newRoomsHtml) {
              const temp = document.createElement('div');
              temp.innerHTML = newRoomsHtml;
              const roomList = temp.firstElementChild;
              const chatWrapper = body.querySelector('.chat-wrapper');
              const bodyInner = body.querySelector('.body-inner');
              if (chatWrapper && bodyInner) {
                bodyInner.insertBefore(roomList, chatWrapper.nextSibling);
              } else if (bodyInner) {
                bodyInner.appendChild(roomList);
              }
            }
          }
          initChatForCard(s.id, group);
        }

        ensureUnreadIndicator(group, s.id);

      } else {
        // ---- 新建卡片 ----
        const isOpen = state.expanded.has(s.id) ? 'open' : '';
        const nameHtml = makeServerNameHtml(s.name, s.name);
        const addrHtml = makeServerAddressHtml(address, address);
        const indicatorStyle = state.unreadStatus[s.id] ? 'inline-block' : 'none';

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
              ${typeBadgeHtml}
              ${regionHtml}
              <div class="server-status-dot ${dot}"></div>
              <div class="server-info">
                ${nameHtml}
                ${addrHtml}
                <div class="server-detail"></div>
              </div>
              <span class="unread-indicator" data-server-id="${s.id}" style="display: ${indicatorStyle};"></span>
              <div class="server-stats">
                <div class="stat-item online"><span>在线</span><b>${s.online || 0}</b></div>
                <div class="stat-item idle"><span>空闲</span><b>${s.idle || 0}</b></div>
                <div class="stat-item rooms"><span>房间</span><b>${s.room_count || 0}</b></div>
                <div class="stat-item latency"><span>延迟</span>${latencyHTML(s)}</div>
              </div>
            </div>
            <div class="server-body">
              <div class="body-inner">
                ${errMsg}
                ${newRoomsHtml}
              </div>
            </div>
          </div>
        `;

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

    checkOverflow();
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
  function renderFilters() {
    const games = [...new Set(state.rooms.map(r => r.game).filter(Boolean))];
    const tabs = ['all_servers', 'all', ...games.slice(0, 10)];
    const container = document.getElementById('filters');
    const existing = container.children;

    while (existing.length < tabs.length) {
      const btn = document.createElement('button');
      btn.className = 'filter-tab';
      btn.addEventListener('click', () => {
        container.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.game = btn.dataset.game;

        if (state.game === 'all_servers') {
          state.servers.forEach(s => {
            const g = document.querySelector(`.server-group[data-id="${s.id}"]`);
            if (!g) return;
            if ((s.room_count || 0) > 0) {
              if (!g.classList.contains('open')) {
                g.classList.add('open');
                state.expanded.add(s.id);
              }
            } else {
              g.classList.remove('open');
              state.expanded.delete(s.id);
            }
          });
        }

        // 修改：点击“全部”时，不自动展开任何卡片
        const autoExpand = (btn.dataset.game !== 'all_servers' && btn.dataset.game !== 'all');
        applyFilter(autoExpand);
      });
      container.appendChild(btn);
    }

    while (existing.length > tabs.length) {
      existing[existing.length - 1].remove();
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

  // ===== 核心渲染 =====
  function render() {
    state.servers.forEach(s => {
      if (state.frozenCardId === s.id) {
        return;
      }
      const hasRooms = state.rooms.some(r => r.server_id === s.id);
      if (hasRooms) {
        state.expanded.add(s.id);
      } else {
        state.expanded.delete(s.id);
      }
    });

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
      state.rooms = Array.isArray(data.rooms) ? data.rooms : [];

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
    checkOverflow();
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
  startPolling();

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
  });

})();