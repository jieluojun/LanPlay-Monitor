(() => {
  'use strict';

  // ============================================================
  // 工具 & 全局状态
  // ============================================================
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const generateMsgId = () => Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);

  const CHAT_STORAGE_KEY = 'lanplay_chat_messages';
  const PUBLIC_STORAGE_KEY = 'lanplay_public_messages';
  const USERNAME_KEY = 'lan_play_username';

  const state = {
    servers: [],
    rooms: [],
    game: 'all_servers',
    expanded: new Set(),
    userToggled: {},          // 记录哪些卡片被用户手动切换过
    loading: false,
    firstLoad: true,
    firstExpand: true,
    _domCache: new Map(),
    _defaultOrder: null,
    pollInterval: null,
    chatMessages: {},
    chatSubscribed: {},
    goEasyReady: false,
    publicMessages: [],
    publicChatReady: false,
    username: '',
  };

  // ============================================================
  // Toast 通知
  // ============================================================
  let _toastEl = null;
  let _toastTimer = null;

  function _dismissToast() {
    if (_toastEl && _toastEl.parentElement) {
      try { _toastEl.parentElement.removeChild(_toastEl); } catch(e) {}
    }
    _toastEl = null;
    if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
  }

  function showToast(text, duration, isSuccess) {
    _dismissToast();
    const t = document.createElement('div');
    t.className = 'global-copy-toast';
    if (isSuccess === true) t.classList.add('success');
    else if (isSuccess === false) t.classList.add('error');
    t.textContent = text || '✓ 已复制';
    document.body.appendChild(t);
    t.offsetHeight; // reflow
    t.classList.add('show');
    _toastEl = t;
    const dur = duration || 2000;
    _toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { if (_toastEl === t) _dismissToast(); }, 300);
    }, dur);
  }

  // ============================================================
  // 复制到剪贴板
  // ============================================================
  function copyText(text, successMsg) {
    if (!text) return;
    const fallback = (msg) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;left:-9999px;';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch(e) {}
      document.body.removeChild(ta);
      showToast(msg, 1500, true);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(String(text))
        .then(() => showToast(successMsg || '✓ 已复制', 1500, true))
        .catch(() => fallback(successMsg || '✓ 已复制'));
    } else {
      fallback(successMsg || '✓ 已复制');
    }
  }

  function copyServerName(text) { copyText(text, '📋 已复制服务器名称: ' + text); }
  function copyServerAddress(text) { copyText(text, '🔗 已复制服务器地址: ' + text); }
  function copyGameId(text) { copyText(text, '✅ 已复制游戏 ID: ' + text); }

  // ============================================================
  // 主题切换
  // ============================================================
  const themeToggleBtn = $('themeToggleBtn');
  const htmlEl = document.documentElement;
  const savedTheme = localStorage.getItem('lan_play_theme');
  if (savedTheme === 'dark') htmlEl.classList.add('dark');
  else if (savedTheme === 'light') htmlEl.classList.remove('dark');

  function updateThemeColor() {
    const isDark = htmlEl.classList.contains('dark');
    const color = isDark ? '#0f1923' : '#dff3ff';
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.appendChild(meta);
  }

  function updateThemeIcon() {
    const isDark = htmlEl.classList.contains('dark') ||
      (!localStorage.getItem('lan_play_theme') && window.matchMedia &&
       window.matchMedia('(prefers-color-scheme: dark)').matches);
    themeToggleBtn.textContent = isDark ? '🌞' : '🌙';
  }
  updateThemeIcon();
  updateThemeColor();

  themeToggleBtn.addEventListener('click', () => {
    const isDark = htmlEl.classList.contains('dark');
    if (isDark) { htmlEl.classList.remove('dark'); localStorage.setItem('lan_play_theme','light'); }
    else { htmlEl.classList.add('dark'); localStorage.setItem('lan_play_theme','dark'); }
    updateThemeIcon(); updateThemeColor();
    // 触发重绘以刷新 CSS 变量
    document.body.style.transform = 'scale(0.999)';
    requestAnimationFrame(() => requestAnimationFrame(() => { document.body.style.transform = ''; }));
  });

  // ============================================================
  // DPI 缩放
  // ============================================================
  const dpiToggleBtn = $('dpiToggleBtn');
  const dpiModal = $('dpiModal');
  const closeDpiModalBtn = $('closeDpiModalBtn');
  const dpiSlider = $('dpiSlider');
  const dpiLabel = $('dpiLabel');
  const dpiResetBtn = $('dpiResetBtn');
  const DPI_KEY = 'lan_play_dpi_percent';
  dpiToggleBtn.textContent = '🔍';

  let currentDpi = parseInt(localStorage.getItem(DPI_KEY), 10) || 100;
  function applyDpi(p) {
    const v = Math.min(150, Math.max(60, p));
    const sl = $('serverList');
    if (sl) sl.style.zoom = v / 100;
    dpiLabel.textContent = Math.round(v) + '%';
    dpiSlider.value = v;
    localStorage.setItem(DPI_KEY, String(v));
    currentDpi = v;
  }
  applyDpi(currentDpi);

  dpiToggleBtn.addEventListener('click', () => {
    dpiModal.classList.add('open');
    dpiSlider.value = currentDpi;
    dpiLabel.textContent = Math.round(currentDpi) + '%';
  });
  closeDpiModalBtn.addEventListener('click', () => dpiModal.classList.remove('open'));
  dpiModal.addEventListener('click', e => { if (e.target === dpiModal) dpiModal.classList.remove('open'); });
  dpiSlider.addEventListener('input', e => applyDpi(parseFloat(e.target.value)));
  dpiResetBtn.addEventListener('click', () => { applyDpi(100); showToast('✅ 已恢复默认缩放 (100%)', 1500, true); });

  // ============================================================
  // 插件链接复制
  // ============================================================
  const PLUGIN_URL = 'https://www.tomodachilife.cn/downloads/ldn-mitm/latest';
  $('copyPluginBtn').addEventListener('click', () => copyText(PLUGIN_URL, '✅ 已复制最新版联机插件地址！'));

  // ============================================================
  // 模态框：添加服务器
  // ============================================================
  const addServerModal = $('addServerModal');
  $('openAddModalBtn').addEventListener('click', () => addServerModal.classList.add('open'));
  $('closeAddModalBtn').addEventListener('click', () => addServerModal.classList.remove('open'));
  addServerModal.addEventListener('click', e => { if (e.target === addServerModal) addServerModal.classList.remove('open'); });

  $('addServerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.submit-btn');
    if (btn.classList.contains('loading')) return;
    const name = $('addName').value.trim();
    const host = $('addHost').value.trim();
    const port = parseInt($('addPort').value) || 11451;
    const type = $('addType').value;
    const region = $('addRegion').value.trim();
    btn.classList.add('loading'); btn.disabled = true;
    const txtEl = btn.querySelector('.btn-text'); const orig = txtEl.textContent;
    txtEl.textContent = '提交中...';
    try {
      const res = await fetch('/api/servers/add', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name,host,port,type,region}) });
      const d = await res.json().catch(()=>({}));
      if (!res.ok || !d.ok) throw new Error(d.error || '添加失败');
      $('addName').value=''; $('addHost').value=''; $('addRegion').value='';
      addServerModal.classList.remove('open');
      await load(true);
      showToast('✅ 服务器「'+name+'」添加成功！', 2000, true);
    } catch(err) { showToast('❌ 添加失败：'+err.message, 2500, false); }
    finally { btn.classList.remove('loading'); btn.disabled=false; txtEl.textContent=orig; }
  });

  // ============================================================
  // 模态框：删除确认
  // ============================================================
  const deleteModal = $('deleteConfirmModal');
  let pendingDelete = null;
  function openDeleteConfirm(id, name) {
    pendingDelete = { id, name };
    $('deleteConfirmText').textContent = `确定要删除服务器「${name}」吗？此操作不可恢复。`;
    deleteModal.classList.add('open');
  }
  $('closeDeleteModalBtn').addEventListener('click', ()=>{deleteModal.classList.remove('open');pendingDelete=null;});
  $('deleteCancelBtn').addEventListener('click', ()=>{deleteModal.classList.remove('open');pendingDelete=null;});
  deleteModal.addEventListener('click', e=>{if(e.target===deleteModal){deleteModal.classList.remove('open');pendingDelete=null;}});
  $('deleteConfirmBtn').addEventListener('click', async ()=>{
    if(!pendingDelete) return;
    const {id,name} = pendingDelete;
    deleteModal.classList.remove('open'); pendingDelete=null;
    const btn = $('deleteConfirmBtn'); const orig = btn.textContent;
    btn.textContent='提交中...'; btn.disabled=true;
    try {
      const res = await fetch('/api/servers/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
      const d = await res.json().catch(()=>({}));
      if(!res.ok||!d.ok) throw new Error(d.error||'删除失败');
      await load(true);
      showToast('🗑️ 服务器「'+name+'」删除成功！',2000,true);
    } catch(e) { showToast('❌ 删除失败：'+e.message,2500,false); }
    finally { btn.textContent=orig; btn.disabled=false; }
  });

  // ============================================================
  // 模态框：恢复默认排序
  // ============================================================
  const resetModal = $('resetOrderModal');
  $('resetOrderBtn').addEventListener('click', ()=>resetModal.classList.add('open'));
  $('closeResetModalBtn').addEventListener('click', ()=>resetModal.classList.remove('open'));
  $('resetCancelBtn').addEventListener('click', ()=>resetModal.classList.remove('open'));
  resetModal.addEventListener('click', e=>{if(e.target===resetModal)resetModal.classList.remove('open');});
  $('resetConfirmBtn').addEventListener('click', async ()=>{
    resetModal.classList.remove('open');
    localStorage.removeItem('lan_play_server_order');
    try {
      await fetch('/api/servers/reorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order:[],reset:true})});
      await load(true,true);
      showToast('🔄 已恢复默认排序',2000,true);
    } catch(e) { showToast('❌ 恢复失败：'+e.message,2500,false); }
  });

  // ============================================================
  // 网络检测
  // ============================================================
  const netDot = $('netDot');
  let netCheckTimer = null;
  let lastNetState = '';

  async function checkNetwork(force) {
    if(!netDot) return;
    if(!navigator.onLine) {
      netDot.className=''; netDot.classList.add('offline'); netDot.title='网络已断开'; lastNetState='offline'; return;
    }
    netDot.className=''; netDot.classList.add('checking'); netDot.title='检测网络...'; lastNetState='checking';
    try {
      const url = '/api/network-status' + (force?'?refresh=1':'?_='+Date.now());
      const r = await fetch(url,{headers:{'Accept':'application/json'},cache:'no-store'});
      const d = await r.json().catch(()=>({}));
      netDot.className='';
      if(d.ok && d.online) { netDot.classList.add('online'); netDot.title='网络正常'; lastNetState='online'; }
      else { netDot.classList.add('offline'); netDot.title='无网络连接'; lastNetState='offline'; }
    } catch(e) {
      netDot.className=''; netDot.classList.add('offline'); netDot.title='网络检测失败：'+e.message; lastNetState='offline';
    }
  }
  function scheduleNetworkCheck() { if(netCheckTimer) clearInterval(netCheckTimer); netCheckTimer=setInterval(checkNetwork,2000); }
  checkNetwork(); scheduleNetworkCheck();

  // ============================================================
  // 日志模态框
  // ============================================================
  const logModal = $('logModal');
  const logContent = $('logContent');
  let logInterval = null;
  async function fetchLogs() {
    try {
      const r = await fetch('/api/logs',{cache:'no-store'});
      const d = await r.json().catch(()=>({}));
      if(d.ok && Array.isArray(d.logs)) { logContent.textContent = d.logs.join('\n'); logContent.scrollTop=logContent.scrollHeight; }
    } catch(e) { logContent.textContent='加载日志失败: '+e.message; }
  }
  $('openLogModalBtn').addEventListener('click', ()=>{logModal.classList.add('open');fetchLogs();if(logInterval)clearInterval(logInterval);logInterval=setInterval(fetchLogs,2000);});
  $('closeLogBtn').addEventListener('click', ()=>{logModal.classList.remove('open');if(logInterval)clearInterval(logInterval);});
  logModal.addEventListener('click', e=>{if(e.target===logModal){logModal.classList.remove('open');if(logInterval)clearInterval(logInterval);}});

  // ============================================================
  // 辅助渲染函数
  // ============================================================
  const statusDot = s => s==='online'?'online':s==='checking'?'checking':'offline';

  function latencyHTML(s) {
    if(s.status!=='online'||s.error||s.latency_ms==null||s.latency_ms<0) return '<b class="latency-badge error">-</b>';
    const lat = s.latency_ms;
    return lat<=300 ? `<b class="latency-badge fast">${lat}ms</b>` : `<b class="latency-badge slow">${lat}ms</b>`;
  }

  function formatMessageTime(ts) {
    const d = new Date(ts); const now = new Date();
    const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const yest = new Date(today); yest.setDate(yest.getDate()-1);
    const hh = d.getHours().toString().padStart(2,'0');
    const mm = d.getMinutes().toString().padStart(2,'0');
    const ampm = d.getHours()>=12?'下午':'上午';
    const h12 = (d.getHours()%12)||12;
    if(d>=today) return `${ampm} ${h12}:${mm}`;
    if(d>=yest) return `昨天 ${h12}:${mm}`;
    const mo=(d.getMonth()+1).toString().padStart(2,'0'); const dy=d.getDate().toString().padStart(2,'0');
    return `${mo}/${dy} ${h12}:${mm}`;
  }

  // 游戏图标
  const UNKNOWN_ID = 'FFFFFFFFFFFFFFFF';
  const QUESTION_ICON = 'data:image/svg+xml,'+encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">'+
    '<circle cx="24" cy="24" r="22" fill="#34495e"/>'+
    '<text x="24" y="34" text-anchor="middle" font-size="30" fill="white" font-family="sans-serif" font-weight="bold">?</text>'+
    '</svg>'
  );

  // ============================================================
  // Room 卡片
  // ============================================================
  function roomCard(room) {
    const players = Array.isArray(room.players)?room.players:[];
    const count = `${room.node_count||players.length}${room.node_count_max?' / '+room.node_count_max:''} 人`;
    const gameVal = String(room.game||'');
    const cid = String(room.content_id||'').toUpperCase();
    const isUnknownId = cid===UNKNOWN_ID;
    const isUnknown = gameVal.includes('未知游戏')&&!isUnknownId;
    const iconUrl = room.game_icon||QUESTION_ICON;
    const finalIcon = (isUnknown||!iconUrl||iconUrl==='')?QUESTION_ICON:iconUrl;
    let iconHtml;
    if(cid===UNKNOWN_ID) {
      iconHtml = `<span class="room-icon" style="display:inline-block;width:22px;height:22px;border-radius:4px;background:#34495e;color:white;text-align:center;line-height:22px;font-weight:bold;font-size:14px;" title="${esc(room.game)}">?</span>`;
    } else {
      iconHtml = `<img src="${finalIcon}" alt="${esc(room.game)}" title="${esc(room.game)}" class="room-icon" loading="lazy" onerror="this.onerror=null;this.src='${QUESTION_ICON}'">`;
    }
    const gameDisplay = gameVal;
    const canCopy = isUnknown&&!isUnknownId;
    const gameTitle = canCopy?`点击复制游戏 ID: ${cid}`:gameDisplay;
    const gameHtml = `<span class="game-name ${canCopy?'copy-game-id':''}" data-contentid="${esc(cid)}" data-isunknown="${canCopy?'true':'false'}" title="${esc(gameTitle)}">${esc(gameDisplay)}</span>`;
    const hostName = room.host||'未知房间';
    const hostHtml = `<span class="room-host-meta"><span class="host-icon-fixed">🏠</span><span class="host-name">${esc(hostName)}</span></span>`;
    const rid = esc(room.id||'');
    return `<div class="room-item" data-game="${esc(gameVal)}" data-room-id="${rid}">
      <div class="room-top"><div class="room-game-left">${iconHtml}${gameHtml}</div></div>
      <div class="room-meta"><span class="green">● 正在联机</span><span>|</span><span>${esc(count)}</span><span>|</span>${hostHtml}</div>
      <div class="room-players">${players.map(p=>`<span class="player">${esc(p)}</span>`).join('')}</div>
    </div>`;
  }

  // ============================================================
  // 筛选 & 渲染
  // ============================================================
  function applyFilter() {
    const g = state.game;
    const isAll = (g==='all');
    const isAllServers = (g==='all_servers');
    const filtered = isAllServers?state.rooms:(isAll?state.rooms:state.rooms.filter(r=>r.game===g));
    const onlineCount = state.servers.filter(s=>s.status==='online').length;
    $('ovServers').textContent = `${onlineCount}/${state.servers.length}`;
    $('ovOnline').textContent = state.servers.filter(s=>s.status==='online').reduce((a,s)=>a+(s.online||0),0);
    $('ovIdle').textContent = state.servers.filter(s=>s.status==='online').reduce((a,s)=>a+(s.idle||0),0);
    $('ovRooms').textContent = filtered.length;

    document.querySelectorAll('.room-item').forEach(el=>{
      el.style.display=(isAll||isAllServers||el.dataset.game===g)?'':'none';
    });

    // 调整服务器卡片的显示（隐藏无相关房间的卡片）
    state.servers.forEach(s=>{
      const group = document.querySelector(`.server-group[data-id="${s.id}"]`);
      if(!group) return;
      const items = group.querySelectorAll('.room-item');
      let visible=0; items.forEach(el=>{if(el.style.display!=='none')visible++;});
      const isOnline = s.status==='online'&&!s.error;
      if(isAllServers) {
        group.style.display='';
      } else if(isAll) {
        const hasAny=items.length>0;
        group.style.display=(hasAny&&isOnline)?'':'none';
      } else {
        if(visible>0&&isOnline) {
          group.style.display='';
        } else {
          group.style.display='none';
        }
      }
    });
  }

  function renderFilters() {
    const games = [...new Set(state.rooms.map(r=>r.game).filter(Boolean))];
    const tabs = ['all_servers','all',...games.slice(0,10)];
    const container = $('filters');
    // 补齐按钮
    while(container.children.length<tabs.length) {
      const b=document.createElement('button'); b.className='filter-tab';
      b.addEventListener('click',()=>{
        container.querySelectorAll('.filter-tab').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        state.game=b.dataset.game;
        // 切换筛选后，重新应用筛选，但不改变展开状态（展开由 renderServers 根据规则决定）
        // 但用户可能希望自动展开有房间的卡片，所以我们调用 renderServers 会重新计算
        renderServers();
        applyFilter();
      });
      container.appendChild(b);
    }
    while(container.children.length>tabs.length) container.removeChild(container.lastChild);
    // 更新文字和状态
    tabs.forEach((g,i)=>{
      const btn=container.children[i];
      let label;
      if(g==='all') label=`总房间 (${state.rooms.length})`;
      else if(g==='all_servers') label=`全部 (${state.servers.length})`;
      else label=esc(g);
      btn.dataset.game=g; btn.textContent=label;
      const active = (g==='all'&&state.game==='all')||(g==='all_servers'&&state.game==='all_servers')||(g!=='all'&&g!=='all_servers'&&state.game===g);
      btn.classList.toggle('active',active);
    });
  }

  // ============================================================
  // 拖拽排序
  // ============================================================
  let dragSrc = null;
  function initDragAndDrop(div) {
    div.setAttribute('draggable','true');
    div.addEventListener('dragstart',e=>{dragSrc=div;div.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    div.addEventListener('dragend',()=>{div.classList.remove('dragging');dragSrc=null;document.querySelectorAll('.server-group').forEach(el=>el.classList.remove('drag-over'));});
    div.addEventListener('dragover',e=>{e.preventDefault();if(div!==dragSrc)div.classList.add('drag-over');});
    div.addEventListener('dragleave',()=>div.classList.remove('drag-over'));
    div.addEventListener('drop',e=>{
      e.preventDefault(); div.classList.remove('drag-over');
      if(dragSrc&&dragSrc!==div) {
        const list=$('serverList');
        const all=[...list.querySelectorAll('.server-group')];
        const di=all.indexOf(dragSrc), ti=all.indexOf(div);
        if(di<ti) div.parentNode.insertBefore(dragSrc,div.nextSibling);
        else div.parentNode.insertBefore(dragSrc,div);
        const ids=[];
        document.querySelectorAll('.server-group').forEach(el=>{const s=state.servers.find(x=>x.id===el.dataset.id);if(s)ids.push(s.id);});
        state.servers=ids.map(id=>state.servers.find(s=>s.id===id)).filter(Boolean);
        try{localStorage.setItem('lan_play_server_order',JSON.stringify(ids));}catch(e){}
        fetch('/api/servers/reorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order:ids})}).catch(()=>{});
      }
    });
  }

  // ============================================================
  // 服务器卡片渲染（核心：展开逻辑）
  // ============================================================
  function getServerBadge(s) {
    if(s.is_builtin) return '<span class="badge badge-builtin">内置</span>';
    if(s.is_remote) return '<span class="badge badge-remote">远程</span>';
    if(s.is_manual) return '<span class="badge badge-delete">删除</span><span class="badge badge-edit">编辑</span>';
    return '';
  }

  function renderServers() {
    const list = $('serverList');
    const roomsByServer = {};
    state.rooms.forEach(r=>{(roomsByServer[r.server_id]=roomsByServer[r.server_id]||[]).push(r);});
    const onlineCount = state.servers.filter(s=>s.status==='online').length;
    $('ovServers').textContent=`${onlineCount}/${state.servers.length}`;
    $('ovOnline').textContent=state.servers.filter(s=>s.status==='online').reduce((a,s)=>a+(s.online||0),0);
    $('ovIdle').textContent=state.servers.filter(s=>s.status==='online').reduce((a,s)=>a+(s.idle||0),0);
    $('ovRooms').textContent=state.rooms.length;

    if(!state.servers.length) {
      if(state.firstLoad) list.innerHTML='<div class="skeleton"></div><div class="skeleton"></div>';
      return;
    }

    const existing = state._domCache;
    if(existing.size===0) list.querySelectorAll('.server-group').forEach(el=>existing.set(el.dataset.id,el));
    const currentIds = new Set(state.servers.map(s=>s.id));
    for(const [id,el] of existing) if(!currentIds.has(id)){el.remove();existing.delete(id);}

    const order=[];
    state.servers.forEach(s=>{
      const dot = statusDot(s.status);
      const rooms = roomsByServer[s.id]||[];
      const regionHtml = s.region?`<span class="card-region" title="${esc(s.region)}">${esc(s.region)}</span>`:'';
      const errMsg = s.error?`<div class="server-error">⚠️ ${esc(s.error)}</div>`:'';
      const roomsHtml = rooms.length?`<div class="room-list">${rooms.map(r=>roomCard(r)).join('')}</div>`:'';
      const addr = s.address||`${s.host}:${s.port}`;
      const badgeHtml = getServerBadge(s);

      // 计算展开状态
      let shouldOpen;
      if (state.userToggled[s.id]) {
        // 用户手动操作过，使用 expanded 记录的状态
        shouldOpen = state.expanded.has(s.id);
      } else {
        // 未手动操作，根据房间有无自动决定
        shouldOpen = rooms.length > 0;
        // 同步更新 expanded 以保持一致性
        if (shouldOpen) {
          state.expanded.add(s.id);
        } else {
          state.expanded.delete(s.id);
        }
      }

      let group = existing.get(s.id);
      if(group) {
        // 更新已有卡片
        const dEl=group.querySelector('.server-status-dot'); if(dEl) dEl.className='server-status-dot '+dot;
        const nmEl=group.querySelector('.server-name'); if(nmEl){nmEl.textContent=s.name;nmEl.dataset.copytext=s.name;}
        const adEl=group.querySelector('.server-address'); if(adEl){adEl.textContent=addr;adEl.dataset.copytext=addr;}
        const rgEl=group.querySelector('.card-region'); if(rgEl){if(!s.region){rgEl.remove();}else{rgEl.textContent=s.region;rgEl.title=s.region;}}else if(s.region){group.querySelector('.server-head').insertAdjacentHTML('afterbegin',regionHtml);}
        const bdEl=group.querySelector('.card-badges'); if(bdEl) bdEl.innerHTML=badgeHtml;
        const stBs=group.querySelectorAll('.stat-item b'); if(stBs.length>=3){stBs[0].textContent=String(s.online||0);stBs[1].textContent=String(s.idle||0);stBs[2].textContent=String(s.room_count||0);}
        const latEl=group.querySelector('.stat-item.latency'); if(latEl){const nb=latEl.querySelector('.latency-badge');const nl=latencyHTML(s);if(!nb||nb.outerHTML!==nl)latEl.innerHTML=`<span>延迟</span>${nl}`;}
        // 根据 shouldOpen 设置 open 类
        group.classList.toggle('open', shouldOpen);
        // 更新 rooms
        const body=group.querySelector('.server-body'); if(body){body.querySelectorAll('.room-list,.server-error').forEach(el=>el.remove());const inner=body.querySelector('.body-inner');if(errMsg)inner.insertAdjacentHTML('afterbegin',errMsg);if(roomsHtml)inner.insertAdjacentHTML('beforeend',roomsHtml);}
        // 重新绑定 badge 事件
        const del=group.querySelector('.badge-delete'); if(del){del.style.cursor='pointer';del.onclick=e=>{e.stopPropagation();openDeleteConfirm(s.id,s.name);};}
        const edit=group.querySelector('.badge-edit'); if(edit){edit.style.cursor='pointer';edit.onclick=e=>{e.stopPropagation();openEditModal(s.id,s.name,group);};}
      } else {
        // 新建卡片
        const div=document.createElement('div');
        div.className=`server-group ${shouldOpen?'open':''} ${s.is_builtin?'is-builtin':s.is_remote?'is-remote':s.is_manual?'is-manual':''}`;
        div.dataset.id=s.id;
        div.innerHTML=`${regionHtml}<div class="server-head"><div class="server-status-dot ${dot}"></div><div class="server-info"><span class="server-name" data-copytext="${esc(s.name)}">${esc(s.name)}</span><span class="server-address" data-copytext="${esc(addr)}">${esc(addr)}</span></div><div class="card-badges">${badgeHtml}</div><div class="server-stats"><div class="stat-item online"><span>在线</span><b>${s.online||0}</b></div><div class="stat-item idle"><span>空闲</span><b>${s.idle||0}</b></div><div class="stat-item rooms"><span>房间</span><b>${s.room_count||0}</b></div><div class="stat-item latency"><span>延迟</span>${latencyHTML(s)}</div></div></div><div class="server-body"><div class="body-inner">${errMsg}${roomsHtml}</div></div>`;
        const nmEl=div.querySelector('.server-name'); if(nmEl) nmEl.addEventListener('click',function(e){e.stopPropagation();copyServerName(this.dataset.copytext);});
        const adEl=div.querySelector('.server-address'); if(adEl) adEl.addEventListener('click',function(e){e.stopPropagation();copyServerAddress(this.dataset.copytext);});
        // ★ 点击头部切换展开/收起 —— 核心改动：清除所有手动标记，只标记当前卡片
        div.querySelector('.server-head').addEventListener('click',()=>{
          const id = div.dataset.id;
          // 清除所有卡片的手动标记
          state.userToggled = {};
          // 仅将当前卡片标记为手动操作
          state.userToggled[id] = true;
          // 切换展开状态
          if (state.expanded.has(id)) {
            state.expanded.delete(id);
          } else {
            state.expanded.add(id);
          }
          // 重新渲染以更新界面
          renderServers();
        });
        const del=div.querySelector('.badge-delete'); if(del){del.style.cursor='pointer';del.addEventListener('click',e=>{e.stopPropagation();openDeleteConfirm(s.id,s.name);});}
        const edit=div.querySelector('.badge-edit'); if(edit){edit.style.cursor='pointer';edit.addEventListener('click',e=>{e.stopPropagation();openEditModal(s.id,s.name,div);});}
        initDragAndDrop(div);
        initChatForCard(s.id,div);
        existing.set(s.id,div);
        order.push(div);
      }
      if(group) order.push(group);
    });

    // 排序
    if(state.firstLoad){list.innerHTML='';const frag=document.createDocumentFragment();order.forEach(el=>frag.appendChild(el));list.appendChild(frag);state.firstLoad=false;}
    else{const cur=[...list.children];let changed=cur.length!==order.length;if(!changed)for(let i=0;i<cur.length;i++)if(cur[i]!==order[i]){changed=true;break;}if(changed){const frag=document.createDocumentFragment();order.forEach(el=>frag.appendChild(el));list.appendChild(frag);}}
  }

  // ============================================================
  // 编辑服务器模态框
  // ============================================================
  let editModalInstance = null;
  function openEditModal(serverId, serverName) {
    if(editModalInstance){editModalInstance.remove();editModalInstance=null;}
    const s = state.servers.find(x=>x.id===serverId);
    if(!s) return;
    const modal=document.createElement('div'); modal.className='custom-modal open'; modal.style.display='flex';
    modal.innerHTML=`<div class="custom-modal-box" style="width:min(450px,calc(100% - 32px));">
      <div class="custom-modal-header"><span>✏️ 编辑服务器</span><button class="custom-modal-close edit-modal-close">✕</button></div>
      <div class="custom-modal-body"><form id="editServerForm" class="form-grid">
        <div class="form-row"><input type="text" id="editName" placeholder="服务器名称" value="${esc(s.name)}" required></div>
        <div class="form-row"><input type="text" id="editHost" placeholder="主机地址" value="${esc(s.host)}" required></div>
        <div class="form-row-group"><input type="number" id="editPort" value="${s.port||11451}" placeholder="端口" required><select id="editType"><option value="graphql" ${s.type==='graphql'?'selected':''}>GraphQL</option><option value="rest" ${s.type==='rest'?'selected':''}>REST</option></select></div>
        <div class="form-row"><input type="text" id="editRegion" placeholder="地区标签" value="${esc(s.region||'')}"></div>
        <button type="submit" class="submit-btn" id="editSubmitBtn"><span class="spinner"></span><span class="btn-text">保存修改</span></button>
      </form></div></div>`;
    document.body.appendChild(modal); editModalInstance=modal;
    const close=modal.querySelector('.edit-modal-close');
    close.addEventListener('click',()=>{modal.remove();editModalInstance=null;});
    modal.addEventListener('click',e=>{if(e.target===modal){modal.remove();editModalInstance=null;}});
    modal.querySelector('#editServerForm').addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=$('editSubmitBtn'); if(btn.classList.contains('loading'))return;
      const name=$('editName').value.trim(),host=$('editHost').value.trim(),port=parseInt($('editPort').value)||11451,type=$('editType').value,region=$('editRegion').value.trim();
      btn.classList.add('loading');btn.disabled=true;const tEl=btn.querySelector('.btn-text');const orig=tEl.textContent;tEl.textContent='提交中...';
      try{
        const r=await fetch('/api/servers/edit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:serverId,name,host,port,type,region})});
        const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||'编辑失败');
        modal.remove();editModalInstance=null;await load(true);showToast('✅ 服务器「'+name+'」已更新',2000,true);
      }catch(err){showToast('❌ 编辑失败：'+err.message,2500,false);}
      finally{btn.classList.remove('loading');btn.disabled=false;tEl.textContent=orig;}
    });
  }

  // ============================================================
  // 核心渲染
  // ============================================================
  function render() {
    renderFilters();
    renderServers();
    applyFilter();
  }

  // ============================================================
  // 数据加载 & 轮询
  // ============================================================
  async function load(force,ignoreSaved) {
    if(document.hidden&&!force) return;
    if(state.loading&&!force) return;
    if(!navigator.onLine) {
      state.servers.forEach(s=>{s.status='offline';s.latency_ms=null;s.error='网络已断开';});
      render(); checkNetwork(true); state.loading=false; return;
    }
    state.loading=true;
    const isFirst=state.firstLoad;
    if(isFirst&&!ignoreSaved) {
      try{const cs=localStorage.getItem('lan_play_cache_servers'),cr=localStorage.getItem('lan_play_cache_rooms');if(cs&&cr){state.servers=JSON.parse(cs);state.rooms=JSON.parse(cr);render();}}catch(e){}
    }
    try {
      const url='/api/snapshot?refresh='+(force?'1':'0')+'&_='+Date.now();
      const r=await fetch(url,{headers:{'Accept':'application/json'},cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||d.ok===false) throw new Error(d.error||'请求失败');
      state.servers=Array.isArray(d.servers)?d.servers:[];
      state.rooms=Array.isArray(d.rooms)?d.rooms:[];
      if(ignoreSaved){state._defaultOrder=state.servers.map(s=>({id:s.id}));}else{const loaded=loadSavedOrder();if(!loaded&&state._defaultOrder===null)state._defaultOrder=state.servers.map(s=>({id:s.id}));}
      localStorage.setItem('lan_play_cache_servers',JSON.stringify(state.servers));
      localStorage.setItem('lan_play_cache_rooms',JSON.stringify(state.rooms));
      await new Promise(res=>requestAnimationFrame(res));
      render();
      if(state.goEasyReady) forceSubscribeAll();
      checkNetwork(true);
    } catch(e) {
      state.servers.forEach(s=>{s.status='offline';s.latency_ms=null;s.error='网络连接失败';});
      render(); checkNetwork(true);
    } finally { state.loading=false; }
  }

  function loadSavedOrder() {
    try{const c=localStorage.getItem('lan_play_server_order');if(!c)return false;const arr=JSON.parse(c);if(!Array.isArray(arr)||!arr.length)return false;const map={};state.servers.forEach(s=>{map[s.id]=s;});const ordered=arr.map(id=>map[id]).filter(Boolean);state.servers.forEach(s=>{if(!arr.includes(s.id))ordered.push(s);});if(ordered.length){state.servers=ordered;state._defaultOrder=state.servers.map(s=>({id:s.id}));return true;}}catch(e){}return false;
  }

  function startPolling() {
    if(state.pollInterval) clearInterval(state.pollInterval);
    load(false);
    state.pollInterval=setInterval(()=>{if(!document.hidden)load(false);},1000);
  }

  // ============================================================
  // 可见性变化
  // ============================================================
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){if(state.pollInterval){clearInterval(state.pollInterval);state.pollInterval=null;}}
    else{startPolling();setTimeout(reconnectChat,500);}
  });

  // 下拉刷新
  let touchStartY=0;
  document.addEventListener('touchstart',e=>{touchStartY=e.changedTouches[0].screenY;},{passive:true});
  document.addEventListener('touchend',e=>{const dy=touchStartY-e.changedTouches[0].screenY;if(dy<-80&&window.scrollY<=0)load(true);},{passive:true});

  // ============================================================
  // 全局：复制游戏 ID
  // ============================================================
  document.addEventListener('click',e=>{
    const t=e.target.closest('.copy-game-id');
    if(t&&t.dataset.isunknown==='true'){e.stopPropagation();const cid=t.dataset.contentid;if(cid&&cid!==UNKNOWN_ID)copyGameId(cid);}
  });

  // ============================================================
  // ===== 聊天系统（GoEasy · 纯文本）=====
  // ============================================================
  let goEasy = null;
  const CHAT_PREFIX = 'lanplay_chat_';
  const PUBLIC_CHANNEL = 'public_chat';
  let goEasyInitTimer = null;
  let usernameModalInstance = null;

  // ---- 持久化 ----
  function loadChatMessages(){try{const d=localStorage.getItem(CHAT_STORAGE_KEY);if(d){const p=JSON.parse(d);if(p&&typeof p==='object')state.chatMessages=p;}}catch(e){} }
  function saveChatMessages(){try{localStorage.setItem(CHAT_STORAGE_KEY,JSON.stringify(state.chatMessages));}catch(e){}}
  function loadPublicMessages(){try{const d=localStorage.getItem(PUBLIC_STORAGE_KEY);if(d){const p=JSON.parse(d);if(Array.isArray(p))state.publicMessages=p;}}catch(e){}}
  function savePublicMessages(){try{localStorage.setItem(PUBLIC_STORAGE_KEY,JSON.stringify(state.publicMessages));}catch(e){}}

  function updateAllMessagesIsMine() {
    const cur=state.username;
    Object.keys(state.chatMessages).forEach(sid=>{state.chatMessages[sid].forEach(m=>{m.isMine=(m.sender===cur);});renderChatMessages(sid);});
    if(state.publicMessages){state.publicMessages.forEach(m=>{m.isMine=(m.sender===cur);});renderPublicChat();}
    saveChatMessages();savePublicMessages();
  }

  function getStoredUsername(){return localStorage.getItem(USERNAME_KEY)||'';}
  function saveUsername(name){const t=name.trim();if(t){localStorage.setItem(USERNAME_KEY,t);state.username=t;updateAllMessagesIsMine();updateChatUI();return true;}return false;}

  function showUsernamePrompt(callback) {
    if(usernameModalInstance){usernameModalInstance.remove();usernameModalInstance=null;}
    const modal=document.createElement('div');modal.className='custom-modal open';modal.style.display='flex';
    modal.innerHTML=`<div class="custom-modal-box" style="width:min(380px,calc(100% - 32px));">
      <div class="custom-modal-header"><span>👤 设置用户名</span><button class="custom-modal-close user-modal-close">✕</button></div>
      <div class="custom-modal-body"><p style="margin:0 0 16px;font-size:14px;color:var(--muted);">请输入您在聊天中显示的名称：</p>
      <div class="form-row"><input type="text" id="usernameInput" placeholder="输入用户名" value="${esc(getStoredUsername())}" maxlength="20" autofocus></div>
      <button id="usernameConfirmBtn" class="submit-btn" style="margin-top:12px;"><span class="spinner"></span><span class="btn-text">确认</span></button></div></div>`;
    document.body.appendChild(modal);usernameModalInstance=modal;
    const closeBtn=modal.querySelector('.user-modal-close'),confirmBtn=modal.querySelector('#usernameConfirmBtn'),input=modal.querySelector('#usernameInput');
    function doConfirm(){const n=input.value.trim();if(!n){showToast('⚠️ 用户名不能为空',1500,false);input.focus();return;}if(saveUsername(n)){modal.remove();usernameModalInstance=null;showToast('✅ 用户名已设置为: '+n,1500,true);if(callback)callback();updateChatUI();}}
    closeBtn.addEventListener('click',()=>{modal.remove();usernameModalInstance=null;if(!state.username)setTimeout(()=>showUsernamePrompt(callback),300);});
    confirmBtn.addEventListener('click',doConfirm);
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();doConfirm();}});
    modal.addEventListener('click',e=>{if(e.target===modal){modal.remove();usernameModalInstance=null;if(!state.username)setTimeout(()=>showUsernamePrompt(callback),300);}});
    setTimeout(()=>input.focus(),100);
  }

  function ensureUsername(callback) {
    if(state.username){if(callback)callback();return true;}
    const stored=getStoredUsername();
    if(stored){state.username=stored;updateAllMessagesIsMine();updateChatUI();if(callback)callback();return true;}
    showUsernamePrompt(callback);return false;
  }

  function updateChatUI() {
    const hasName=!!state.username; const ready=state.goEasyReady&&hasName;
    document.querySelectorAll('.chat-input').forEach(inp=>{inp.disabled=!ready;inp.placeholder=ready?'输入聊天内容...':(state.goEasyReady?'请先设置用户名':'聊天未连接');});
    document.querySelectorAll('.chat-send-btn').forEach(b=>b.disabled=!ready);
    const pubInp=$('publicChatInput'),pubBtn=$('publicChatSendBtn');
    if(pubInp){pubInp.disabled=!ready;pubInp.placeholder=ready?'输入公共消息...':(state.goEasyReady?'请先设置用户名':'聊天未连接');}
    if(pubBtn)pubBtn.disabled=!ready;
  }

  // ---- 发送文本消息 ----
  function sendChatMessage(serverId,text) {
    if(!text.trim()) return;
    if(!state.username){ensureUsername(()=>{});showToast('⚠️ 请先设置用户名',1500,false);return;}
    if(!goEasy||!state.goEasyReady){showToast('⚠️ 聊天服务未连接',2000,false);return;}
    const channel=CHAT_PREFIX+serverId; const msgId=generateMsgId();
    const payload=JSON.stringify({id:msgId,text:text.trim(),sender:state.username,time:Date.now()});
    goEasy.pubsub.publish({channel,message:payload,qos:1,
      onSuccess:()=>{if(!state.chatMessages[serverId])state.chatMessages[serverId]=[];const ex=state.chatMessages[serverId].some(m=>m.id===msgId);if(!ex){state.chatMessages[serverId].push({id:msgId,text:text.trim(),sender:state.username,isMine:true,time:Date.now()});saveChatMessages();}renderChatMessages(serverId);const card=document.querySelector(`.server-group[data-id="${serverId}"]`);if(card){const inp=card.querySelector('.chat-input');if(inp)inp.value='';}},
      onFailed:e=>{console.error('发送失败',e);showToast('❌ 发送失败：'+(e.content||''),2500,false);}
    });
  }

  // ---- 公共聊天发送 ----
  function sendPublicMessage(text) {
    if(!text.trim()) return;
    if(!state.username){ensureUsername(()=>{});showToast('⚠️ 请先设置用户名',1500,false);return;}
    if(!goEasy||!state.goEasyReady){showToast('⚠️ 聊天服务未连接',2000,false);return;}
    const msgId=generateMsgId();
    const payload=JSON.stringify({id:msgId,text:text.trim(),sender:state.username,time:Date.now()});
    goEasy.pubsub.publish({channel:PUBLIC_CHANNEL,message:payload,qos:1,
      onSuccess:()=>{if(!state.publicMessages)state.publicMessages=[];const ex=state.publicMessages.some(m=>m.id===msgId);if(!ex){state.publicMessages.push({id:msgId,text:text.trim(),sender:state.username,isMine:true,time:Date.now()});savePublicMessages();}renderPublicChat();const inp=$('publicChatInput');if(inp)inp.value='';},
      onFailed:e=>{showToast('❌ 公共消息发送失败',2000,false);console.error(e);}
    });
  }

  // ---- 渲染消息内容（纯文本） ----
  function renderMessageContent(msg) {
    return esc(msg.text);
  }

  // ---- 服务器聊天渲染 ----
  function renderChatMessages(serverId) {
    const card=document.querySelector(`.server-group[data-id="${serverId}"]`);
    if(!card) return;
    const container=card.querySelector('.chat-messages'); if(!container) return;
    if(!state.goEasyReady){container.innerHTML='<div style="color:var(--red);text-align:center;padding:8px;">⚠️ 聊天服务未连接</div>';return;}
    const msgs=state.chatMessages[serverId]||[];
    if(!msgs.length){container.innerHTML='<div style="color:var(--muted);text-align:center;padding:8px;font-size:12px;">暂无消息</div>';return;}
    container.innerHTML=msgs.map(msg=>{
      const cls=msg.isMine?'chat-msg-mine':'chat-msg-other';
      return `<div class="chat-msg ${cls}"><div class="msg-content"><strong>${esc(msg.sender||'匿名')}</strong>：${renderMessageContent(msg)}</div><div class="msg-time">${esc(formatMessageTime(msg.time))}</div></div>`;
    }).join('');
    container.scrollTop=container.scrollHeight;
  }

  // ---- 公共聊天渲染 ----
  function renderPublicChat() {
    const c=$('publicChatMessages'); if(!c) return;
    if(!state.goEasyReady){c.innerHTML='<div style="color:var(--red);text-align:center;padding:20px;">⚠️ 聊天服务未连接</div>';return;}
    const msgs=state.publicMessages||[];
    if(!msgs.length){c.innerHTML='<div style="color:var(--muted);text-align:center;padding:20px;font-size:14px;">暂无消息</div>';return;}
    c.innerHTML=msgs.map(msg=>{
      const cls=msg.isMine?'chat-msg-mine':'chat-msg-other';
      return `<div class="chat-msg ${cls}"><div class="msg-content"><strong>${esc(msg.sender||'匿名')}</strong>：${renderMessageContent(msg)}</div><div class="msg-time">${esc(formatMessageTime(msg.time))}</div></div>`;
    }).join('');
    c.scrollTop=c.scrollHeight;
  }

  // ---- 初始化聊天卡片（无图片按钮） ----
  function initChatForCard(serverId,card) {
    let wrap=card.querySelector('.chat-wrapper');
    if(!wrap) {
      const bodyInner=card.querySelector('.server-body > .body-inner'); if(!bodyInner) return;
      wrap=document.createElement('div'); wrap.className='chat-wrapper';
      const ready=state.goEasyReady&&!!state.username;
      wrap.innerHTML=`<div class="chat-messages"></div><div class="chat-input-area" style="display:flex;gap:6px;margin-top:8px;"><input type="text" class="chat-input" placeholder="${ready?'输入聊天内容...':(state.goEasyReady?'请先设置用户名':'聊天未连接')}" ${ready?'':'disabled'}><button class="chat-send-btn" ${ready?'':'disabled'}>发送</button></div>`;
      bodyInner.appendChild(wrap);
      const inp=wrap.querySelector('.chat-input'),btn=wrap.querySelector('.chat-send-btn');
      const sendHandler=()=>{const t=inp.value.trim();if(t)sendChatMessage(serverId,t);};
      btn.addEventListener('click',sendHandler);
      inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendHandler();}});
    }
    renderChatMessages(serverId);
    if(state.goEasyReady&&!state.chatSubscribed[serverId])subscribeChannel(serverId);
  }

  // ---- 公共聊天 UI 绑定 ----
  function bindPublicChatEvents() {
    const openBtn=$('openPublicChatBtn'),modal=$('publicChatModal'),closeBtn=$('closePublicChatBtn'),sendBtn=$('publicChatSendBtn'),input=$('publicChatInput');
    if(!openBtn||!modal||!closeBtn||!sendBtn||!input)return;
    openBtn.addEventListener('click',()=>{
      modal.classList.add('open');
      const header=modal.querySelector('.custom-modal-header');
      if(header&&!header.querySelector('.edit-username-btn')){
        const eb=document.createElement('button');eb.className='edit-username-btn';eb.textContent='✏️';eb.title='编辑用户名';
        eb.style.cssText='background:none;border:0;font-size:16px;cursor:pointer;color:var(--muted);margin-right:auto;';
        const cb=header.querySelector('.custom-modal-close'); if(cb)header.insertBefore(eb,cb);else header.appendChild(eb);
        eb.addEventListener('click',e=>{e.stopPropagation();showUsernamePrompt(()=>{renderPublicChat();updateChatUI();});});
      }
      renderPublicChat();
    });
    closeBtn.addEventListener('click',()=>modal.classList.remove('open'));
    modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open');});
    sendBtn.addEventListener('click',()=>{const t=input.value.trim();if(t)sendPublicMessage(t);});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendBtn.click();}});
  }

  // ---- GoEasy 初始化 ----
  function initGoEasy(retryCount) {
    if(retryCount===undefined) retryCount=0;
    if(typeof GoEasy==='undefined'){
      if(retryCount<3){console.warn('GoEasy SDK 未加载，重试...');setTimeout(()=>initGoEasy(retryCount+1),2000);}
      else{console.error('GoEasy SDK 加载失败');state.goEasyReady=false;updateChatUI();}
      return;
    }
    ensureUsername(()=>{
      try{
        goEasy=GoEasy.getInstance({host:'hangzhou.goeasy.io',appkey:'BC-e891108825ab43fb97dabe3327478e30',modules:['pubsub'],forceTLS:true});
        goEasy.connect({id:state.username||'anonymous_'+generateMsgId(),
          onSuccess:()=>{console.log('GoEasy 连接成功:',goEasy.id);state.goEasyReady=true;showToast('✅ 聊天服务已连接',1500,true);subscribePublicChannel();forceSubscribeAll();state.servers.forEach(s=>renderChatMessages(s.id));renderPublicChat();updateChatUI();},
          onFailed:err=>{console.error('GoEasy 连接失败',err);state.goEasyReady=false;if(retryCount<3)setTimeout(()=>{try{goEasy.disconnect();}catch(e){}goEasy=null;initGoEasy(retryCount+1);},2000);else{showToast('❌ 聊天服务连接失败',3000,false);updateChatUI();}}
        });
      }catch(e){console.error('GoEasy 异常',e);if(retryCount<3)setTimeout(()=>initGoEasy(retryCount+1),2000);else showToast('❌ 聊天初始化失败',3000,false);}
    });
  }

  // ---- 频道订阅 ----
  function subscribeChannel(serverId) {
    if(!goEasy||!state.goEasyReady)return;
    const ch=CHAT_PREFIX+serverId;
    goEasy.pubsub.subscribe({channel:ch,history:50,
      onMessage:m=>{try{const d=JSON.parse(m.content);if(!state.chatMessages[serverId])state.chatMessages[serverId]=[];if(state.chatMessages[serverId].some(x=>x.id===d.id))return;state.chatMessages[serverId].push({id:d.id,text:d.text,sender:d.sender,isMine:(d.sender===state.username),time:d.time||Date.now()});saveChatMessages();renderChatMessages(serverId);}catch(e){}},
      onSuccess:()=>{state.chatSubscribed[serverId]=true;console.log('订阅成功',ch);},
      onFailed:e=>{console.error('订阅失败',e);setTimeout(()=>state.goEasyReady&&subscribeChannel(serverId),5000);}
    });
  }
  function subscribePublicChannel() {
    if(!goEasy||!state.goEasyReady)return;
    goEasy.pubsub.subscribe({channel:PUBLIC_CHANNEL,history:50,
      onMessage:m=>{try{const d=JSON.parse(m.content);if(!state.publicMessages)state.publicMessages=[];if(state.publicMessages.some(x=>x.id===d.id))return;state.publicMessages.push({id:d.id,text:d.text,sender:d.sender||'匿名',isMine:(d.sender===state.username),time:d.time||Date.now()});savePublicMessages();renderPublicChat();}catch(e){}},
      onSuccess:()=>{state.publicChatReady=true;console.log('公共频道订阅成功');},
      onFailed:e=>{console.error('公共订阅失败',e);setTimeout(()=>state.goEasyReady&&subscribePublicChannel(),5000);}
    });
  }
  function forceSubscribeAll(){if(!state.goEasyReady)return;state.chatSubscribed={};state.servers.forEach(s=>subscribeChannel(s.id));subscribePublicChannel();}
  function reconnectChat(){if(state.goEasyReady)forceSubscribeAll();else initGoEasy(0);}

  // ============================================================
  // 启动
  // ============================================================
  state.username=getStoredUsername();
  loadChatMessages(); loadPublicMessages(); updateAllMessagesIsMine();
  initGoEasy(); bindPublicChatEvents(); startPolling();

  window.addEventListener('beforeunload',()=>{
    if(state.pollInterval)clearInterval(state.pollInterval);
    if(netCheckTimer)clearInterval(netCheckTimer);
    if(logInterval)clearInterval(logInterval);
    if(goEasyInitTimer)clearTimeout(goEasyInitTimer);
  });

})();