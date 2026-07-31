(() => {
  'use strict';
  const state = { servers:[], rooms:[], game:'all', expanded:new Set(), loading:false, firstLoad:true, firstExpand:true, _domCache:new Map(), _defaultOrder:null };
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // SVG 问号图标 data URI（用于图片加载失败备用）
  const QUESTION_ICON_DATA = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
    '<circle cx="24" cy="24" r="22" fill="#34495e"/>' +
    '<text x="24" y="34" text-anchor="middle" font-size="30" fill="white" font-family="sans-serif" font-weight="bold">?</text>' +
    '</svg>'
  );
  // FFFFFFFFFFFFFFFF 特殊 ID（不显示复制功能）
  const UNKNOWN_ID = 'FFFFFFFFFFFFFFFF';

  const themeToggleBtn = $('themeToggleBtn');
  const htmlEl = document.documentElement;
  const savedTheme = localStorage.getItem('lan_play_theme');
  if (savedTheme) {
    if (savedTheme === 'dark') htmlEl.classList.add('dark');
    else htmlEl.classList.remove('dark');
  }
  function updateThemeIcon() {
    const isDark = htmlEl.classList.contains('dark') || (!localStorage.getItem('lan_play_theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    themeToggleBtn.textContent = isDark ? '🌞' : '🌙';
  }
  updateThemeIcon();
  themeToggleBtn.addEventListener('click', () => {
    const isDark = htmlEl.classList.contains('dark');
    if (isDark) { htmlEl.classList.remove('dark'); htmlEl.classList.add('light'); localStorage.setItem('lan_play_theme', 'light'); }
    else { htmlEl.classList.remove('light'); htmlEl.classList.add('dark'); localStorage.setItem('lan_play_theme', 'dark'); }
    updateThemeIcon();
  });

  const addServerModal = $('addServerModal');
  $('openAddModalBtn').addEventListener('click', () => addServerModal.classList.add('open'));
  $('closeAddModalBtn').addEventListener('click', () => addServerModal.classList.remove('open'));
  addServerModal.addEventListener('click', (e) => { if(e.target === addServerModal) addServerModal.classList.remove('open'); });

  $('addServerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('.submit-btn');
    if (submitBtn.classList.contains('loading')) return;
    const name = $('addName').value.trim();
    const host = $('addHost').value.trim();
    const port = parseInt($('addPort').value) || 11451;
    const type = $('addType').value;
    const region = $('addRegion').value.trim();
    submitBtn.classList.add('loading'); submitBtn.disabled = true;
    const btnTextEl = submitBtn.querySelector('.btn-text');
    const originalText = btnTextEl.textContent;
    btnTextEl.textContent = '保存中...';
    try {
      const res = await fetch('/api/servers/add', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,host,port,type,region}) });
      const d = await res.json().catch(()=>({}));
      if(!res.ok || !d.ok) throw new Error(d.error || '添加失败');
      $('addName').value=''; $('addHost').value=''; $('addRegion').value='';
      addServerModal.classList.remove('open');
      if (d.server && !state.servers.some(s=>s.id===d.server.id)) { state.servers.push(d.server); }
      renderServers(); renderFilters();
      load(true);
    } catch(err) { alert('添加服务器失败: ' + err.message); }
    finally { submitBtn.classList.remove('loading'); submitBtn.disabled=false; btnTextEl.textContent=originalText; }
  });

  const deleteModal = $('deleteConfirmModal');
  let pendingDelete = null;
  function openDeleteConfirm(serverId, serverName, cardEl) {
    pendingDelete = { id:serverId, name:serverName, cardEl };
    $('deleteConfirmText').textContent = `确定要删除服务器「${serverName}」吗？此操作不可恢复。`;
    deleteModal.classList.add('open');
  }
  $('closeDeleteModalBtn').addEventListener('click', ()=>{deleteModal.classList.remove('open');pendingDelete=null;});
  $('deleteCancelBtn').addEventListener('click', ()=>{deleteModal.classList.remove('open');pendingDelete=null;});
  deleteModal.addEventListener('click', e=>{if(e.target===deleteModal){deleteModal.classList.remove('open');pendingDelete=null;}});
  $('deleteConfirmBtn').addEventListener('click', async ()=>{
    if(!pendingDelete) return;
    const {id,cardEl} = pendingDelete;
    deleteModal.classList.remove('open'); pendingDelete=null;
    try {
      const res = await fetch('/api/servers/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id}) });
      const d = await res.json().catch(()=>({}));
      if(!res.ok || !d.ok) throw new Error(d.error||'删除失败');
      if(cardEl && cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
      if(state._domCache) state._domCache.delete(id);
      state.servers = state.servers.filter(s=>s.id!==id);
      const cachedOrder = localStorage.getItem('lan_play_server_order');
      if(cachedOrder){ try{ const arr=JSON.parse(cachedOrder).filter(x=>x!==id); localStorage.setItem('lan_play_server_order',JSON.stringify(arr)); }catch(e){} }
      const onlineCount = state.servers.filter(s=>s.status==='online').length;
      $('ovServers').textContent = `${onlineCount}/${state.servers.length}`;
      $('ovOnline').textContent = state.servers.filter(s=>s.status==='online').reduce((a,s)=>a+(s.online||0),0);
      $('ovIdle').textContent = state.servers.filter(s=>s.status==='online').reduce((a,s)=>a+(s.idle||0),0);
      load(true);
    } catch(e) { alert('删除失败: '+e.message); }
  });

  const resetModal = $('resetOrderModal');
  $('resetOrderBtn').addEventListener('click', ()=>resetModal.classList.add('open'));
  $('closeResetModalBtn').addEventListener('click', ()=>resetModal.classList.remove('open'));
  $('resetCancelBtn').addEventListener('click', ()=>resetModal.classList.remove('open'));
  resetModal.addEventListener('click', e=>{if(e.target===resetModal)resetModal.classList.remove('open');});
  $('resetConfirmBtn').addEventListener('click', async ()=>{
    resetModal.classList.remove('open');
    try {
      localStorage.removeItem('lan_play_server_order');
      fetch('/api/servers/reorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order:[],reset:true})}).catch(()=>{});
      if(state._defaultOrder && state._defaultOrder.length>0){
        const defaultMap={}; state._defaultOrder.forEach(s=>{defaultMap[s.id]=s;});
        const newServers=[];
        state._defaultOrder.forEach(ref=>{ const live=state.servers.find(s=>s.id===ref.id); if(live) newServers.push(live); });
        state.servers.forEach(s=>{if(!defaultMap[s.id]) newServers.push(s);});
        state.servers=newServers;
        requestAnimationFrame(()=>{ renderFilters(); renderServers(); applyFilter(false); });
      }
      load(true);
    } catch(e) { alert('恢复默认排序失败: '+e.message); }
  });

  async function getJSON(url){
    const r = await fetch(url, { headers:{'Accept':'application/json'}, cache:'no-store' });
    const d = await r.json().catch(()=>({}));
    if(!r.ok || d.ok===false) throw new Error(d.error || `请求失败 (${r.status})`);
    return d;
  }

  const netDot = $('netDot');
  let netCheckTimer = null;
  let lastNetState = '';
  async function checkNetwork(force) {
    if(!netDot) return;
    const prevState = lastNetState;
    netDot.classList.remove('online','offline'); netDot.classList.add('checking');
    netDot.title = '正在检测网络连接...'; lastNetState='checking';
    try {
      const url = '/api/network-status'+(force?'?refresh=1':'?_='+Date.now());
      const data = await getJSON(url);
      netDot.classList.remove('checking');
      if(data.ok && data.online){ netDot.classList.add('online'); netDot.title='网络正常'; lastNetState='online'; }
      else { netDot.classList.add('offline'); netDot.title='无网络连接'; lastNetState='offline'; }
    } catch(e) {
      netDot.classList.remove('checking'); netDot.classList.add('offline');
      netDot.title='网络检测失败：'+e.message; lastNetState='offline';
    }
    if(prevState && prevState!==lastNetState && lastNetState!=='checking') setTimeout(()=>checkNetwork(true),3000);
  }
  function scheduleNetworkCheck(){ if(netCheckTimer) clearInterval(netCheckTimer); netCheckTimer=setInterval(checkNetwork,2000); }
  checkNetwork(); scheduleNetworkCheck();

  const PLUGIN_DOWNLOAD_URL = 'https://www.tomodachilife.cn/downloads/ldn-mitm/latest';
  function showPluginToast(){
    const toast=$('pluginToast'); if(!toast) return;
    toast.classList.add('show');
    if(toast._timer) clearTimeout(toast._timer);
    toast._timer=setTimeout(()=>{toast.classList.remove('show');toast._timer=null;},3000);
  }
  function copyPluginLink(){
    const onSuccess=()=>showPluginToast();
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(PLUGIN_DOWNLOAD_URL).then(onSuccess).catch(()=>{
        const ta=document.createElement('textarea');ta.value=PLUGIN_DOWNLOAD_URL;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();
        try{document.execCommand('copy');onSuccess();}catch(e){} document.body.removeChild(ta);
      });
    } else {
      const ta=document.createElement('textarea');ta.value=PLUGIN_DOWNLOAD_URL;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();
      try{document.execCommand('copy');onSuccess();}catch(e){} document.body.removeChild(ta);
    }
  }
  $('copyPluginBtn').addEventListener('click', copyPluginLink);

  /* 全局单例 toast —— 同一时间页面只存在一个"✓ 已复制服务器名称" */
  let _globalToast=null;
  let _globalToastTimer=null;
  function _dismissToast(){
    if(_globalToast&&_globalToast.parentElement){try{_globalToast.parentElement.removeChild(_globalToast);}catch(e){}}
    _globalToast=null;
    if(_globalToastTimer){clearTimeout(_globalToastTimer);_globalToastTimer=null;}
  }
  function _showGlobalToast(text){
    _dismissToast();
    const t=document.createElement('div');t.className='global-copy-toast';
    t.textContent=text||'✓ 已复制服务器地址';
    document.body.appendChild(t);
    /* 强制重排以触发动画 */
    t.offsetHeight;
    t.classList.add('show');
    _globalToast=t;
    _globalToastTimer=setTimeout(()=>{
      t.classList.remove('show');
      setTimeout(()=>{if(_globalToast===t)_dismissToast();},300);
    },1500);
  }

  function copyText(text, el){
    if(!text) return;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(String(text)).then(()=>_showGlobalToast()).catch(()=>fallbackCopy(String(text)));
    } else { fallbackCopy(String(text)); }
  }
  function fallbackCopy(text){
    const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();
    try{document.execCommand('copy');}catch(e){} document.body.removeChild(ta);
    _showGlobalToast();
  }

  const logModal = $('logModal'); const logContent = $('logContent'); let logInterval=null;
  async function fetchLogs(){
    try { const d=await getJSON('/api/logs'); if(d.ok && Array.isArray(d.logs)){ logContent.textContent=d.logs.join('\n'); logContent.scrollTop=logContent.scrollHeight; } }
    catch(e){ logContent.textContent='加载日志失败: '+e.message; }
  }
  $('openLogModalBtn').addEventListener('click', ()=>{logModal.classList.add('open');fetchLogs();if(logInterval)clearInterval(logInterval);logInterval=setInterval(fetchLogs,2000);});
  $('closeLogBtn').addEventListener('click', ()=>{logModal.classList.remove('open');if(logInterval)clearInterval(logInterval);});
  logModal.addEventListener('click', e=>{if(e.target===logModal){logModal.classList.remove('open');if(logInterval)clearInterval(logInterval);}});

  const statusDot = s => s==='online'?'online':s==='checking'?'checking':'offline';
  function latencyHTML(s){
    if(s.status!=='online'||s.error||s.latency_ms==null||s.latency_ms<0) return '<b class="latency-badge error">-</b>';
    const lat=s.latency_ms;
    if(lat<=300) return `<b class="latency-badge fast">${lat}ms</b>`;
    return `<b class="latency-badge slow">${lat}ms</b>`;
  }

  // ===== 房间卡片渲染 =====
  // FFFFFFFFFFFFFFFF 不显示为可复制，且使用默认图标
  function roomCard(room){
    const players=Array.isArray(room.players)?room.players:[];
    const count=`${room.node_count||players.length}${room.node_count_max?' / '+room.node_count_max:''} 人`;
    const gameVal=String(room.game||'');
    const contentId=String(room.content_id||'').toUpperCase();
    // 判断是否为 FFFFFFFFFFFFFFFF（特殊处理，不视为未知游戏）
    const isUnknownId = contentId === UNKNOWN_ID;
    // 未知游戏判断：包含"未知游戏" 且 不是 FFFFFFFFFFFFFFFF
    const isUnknown = gameVal.includes('未知游戏') && !isUnknownId;
    // 使用问号图标：仅当是未知游戏且不是 FFFFFFFFFFFFFFFF
    const iconUrl = room.game_icon || QUESTION_ICON_DATA;
    const finalIcon = isUnknown ? QUESTION_ICON_DATA : iconUrl;
    const gameDisplay = gameVal;
    // 只有非 FFFFFFFFFFFFFFFF 的未知游戏才可复制
    const canCopy = isUnknown && !isUnknownId;
    const copyClass = canCopy ? 'copy-game-id' : 'no-copy';
    const gameTitle = canCopy ? `点击复制游戏 ID: ${contentId}` : gameVal;
    return `<div class="room-item" data-game="${esc(gameVal)}">
      <div class="room-top">
        <div class="room-host"><span>${esc(room.host||'未知房间')}</span><img src="${esc(finalIcon)}" alt="${esc(room.game)}" title="${esc(room.game)}" class="room-host-icon" loading="lazy" onerror="this.src='${QUESTION_ICON_DATA}'"></div>
        <span class="room-game ${copyClass}" data-contentid="${esc(contentId)}" data-isunknown="${canCopy ? 'true' : 'false'}" title="${esc(gameTitle)}">${esc(gameDisplay)}</span>
      </div>
      <div class="room-meta"><span class="green">● 正在联机</span><span>|</span><span>${esc(count)}</span><span>|</span><span>🖥️ ${esc(room.server_name)}</span></div>
      <div class="room-players">${players.map(p=>`<span class="player">${esc(p)}</span>`).join('')}</div>
    </div>`;
  }

  function applyFilter(autoExpand){
    if(autoExpand===undefined) autoExpand=false;
    const g=state.game; const isAll=(g==='all'); const isAllServers=(g==='all_servers');
    const filteredRooms = isAllServers?state.rooms:(isAll?state.rooms:state.rooms.filter(r=>r.game===g));
    const onlineCount=state.servers.filter(s=>s.status==='online').length;
    $('ovServers').textContent=`${onlineCount}/${state.servers.length}`;
    $('ovOnline').textContent=state.servers.filter(s=>s.status==='online').reduce((a,s)=>a+(s.online||0),0);
    $('ovIdle').textContent=state.servers.filter(s=>s.status==='online').reduce((a,s)=>a+(s.idle||0),0);
    $('ovRooms').textContent=filteredRooms.length;
    document.querySelectorAll('.room-item').forEach(el=>{el.style.display=(isAll||isAllServers||el.dataset.game===g)?'':'none';});
    state.servers.forEach(s=>{
      const group=document.querySelector(`.server-group[data-id="${s.id}"]`); if(!group) return;
      const items=group.querySelectorAll('.room-item'); let visible=0; items.forEach(el=>{if(el.style.display!=='none')visible++;});
      const isOnline=s.status==='online'&&!s.error;
      if(isAllServers){ group.style.display=''; if(autoExpand&&!group.classList.contains('open')){group.classList.add('open');state.expanded.add(s.id);} group.querySelectorAll('.no-rooms,.no-rooms-empty,.no-rooms-match').forEach(el=>el.remove()); if(items.length===0&&isOnline){ let m=group.querySelector('.no-rooms-empty'); if(!m){m=document.createElement('div');m.className='no-rooms-empty no-rooms';m.textContent='📭 该服务器暂无公开房间';const body=group.querySelector('.server-body > .body-inner');if(body)body.appendChild(m);} m.style.display='';} }
      else if(isAll){ const hasAny=items.length>0; group.style.display=(hasAny&&isOnline)?'':'none'; if(autoExpand&&hasAny&&!group.classList.contains('open')){group.classList.add('open');state.expanded.add(s.id);} group.querySelectorAll('.no-rooms,.no-rooms-empty,.no-rooms-match').forEach(el=>el.remove()); }
      else { if(visible>0&&isOnline){ group.style.display=''; if(autoExpand&&!group.classList.contains('open')){group.classList.add('open');state.expanded.add(s.id);} group.querySelectorAll('.no-rooms,.no-rooms-empty').forEach(el=>el.remove()); } else group.style.display='none'; group.querySelectorAll('.no-rooms,.no-rooms-empty').forEach(el=>el.style.display='none'); }
    });
    let gm=document.getElementById('no-server-match');
    if(!isAll&&!isAllServers&&document.querySelectorAll('.server-group:not([style*="display: none"])').length===0){
      if(!gm){gm=document.createElement('div');gm.id='no-server-match';gm.className='no-rooms';gm.style.cssText='text-align:center;padding:24px;font-size:14px;';document.getElementById('serverList').appendChild(gm);}
      gm.textContent=`🔍 没有服务器有游戏「${g}」的房间`; gm.style.display='';
    } else if(gm) gm.style.display='none';
  }

  let draggedEl=null;
  function initDragAndDrop(div, s){
    div.setAttribute('draggable','true');
    div.addEventListener('dragstart',e=>{draggedEl=div;div.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    div.addEventListener('dragend',()=>{div.classList.remove('dragging');draggedEl=null;document.querySelectorAll('.server-group').forEach(el=>el.classList.remove('drag-over'));saveCurrentOrder();});
    div.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';if(div!==draggedEl)div.classList.add('drag-over');});
    div.addEventListener('dragleave',()=>div.classList.remove('drag-over'));
    div.addEventListener('drop',e=>{
      e.preventDefault(); div.classList.remove('drag-over');
      if(draggedEl&&draggedEl!==div){
        const list=$('serverList'); const all=[...list.querySelectorAll('.server-group')];
        const di=all.indexOf(draggedEl); const ti=all.indexOf(div);
        if(di<ti) div.parentNode.insertBefore(draggedEl,div.nextSibling); else div.parentNode.insertBefore(draggedEl,div);
        saveCurrentOrder();
      }
    });
    if(s.is_manual){ const btn=div.querySelector('.del-btn'); if(btn) btn.addEventListener('click',e=>{e.stopPropagation();openDeleteConfirm(s.id,s.name,div);}); }
  }

  function saveCurrentOrder(){
    const list=$('serverList'); const ids=[...list.querySelectorAll('.server-group')].map(el=>el.dataset.id);
    const map={}; state.servers.forEach(s=>{map[s.id]=s;}); state.servers=ids.map(id=>map[id]).filter(Boolean);
    try{localStorage.setItem('lan_play_server_order',JSON.stringify(ids));}catch(e){}
    fetch('/api/servers/reorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order:ids})}).catch(()=>{});
  }

  function loadSavedOrder(){
    try{ const cached=localStorage.getItem('lan_play_server_order'); if(!cached) return null; const arr=JSON.parse(cached); if(!Array.isArray(arr)||!arr.length) return null; const map={}; state.servers.forEach(s=>{map[s.id]=s;}); const ordered=arr.map(id=>map[id]).filter(Boolean); state.servers.forEach(s=>{if(!arr.includes(s.id))ordered.push(s);}); if(ordered.length) return state.servers=ordered,arr; }catch(e){} return null;
  }

  function getServerBadge(s){ if(s.is_builtin)return '<span class="badge badge-builtin">内置</span>'; if(s.is_remote)return '<span class="badge badge-remote">远程</span>'; if(s.is_manual)return '<button class="del-btn" title="删除此服务器">✕</button>'; return ''; }
  function getServerClass(s){ if(s.is_builtin)return ' is-builtin'; if(s.is_remote)return ' is-remote'; if(s.is_manual)return ' is-manual'; return ''; }

  function renderServers(){
    const list=$('serverList'); const roomsByServer={};
    state.rooms.forEach(r=>{(roomsByServer[r.server_id]=roomsByServer[r.server_id]||[]).push(r);});
    const onlineCount=state.servers.filter(s=>s.status==='online').length;
    $('ovServers').textContent=`${onlineCount}/${state.servers.length}`;
    $('ovOnline').textContent=state.servers.filter(s=>s.status==='online').reduce((a,s)=>a+(s.online||0),0);
    $('ovIdle').textContent=state.servers.filter(s=>s.status==='online').reduce((a,s)=>a+(s.idle||0),0);
    $('ovRooms').textContent=state.rooms.length;
    if(!state.servers.length){ if(state.firstLoad){list.innerHTML='<div class="skeleton"></div><div class="skeleton"></div>';} return; }
    const existing=state._domCache; if(existing.size===0) list.querySelectorAll('.server-group').forEach(el=>existing.set(el.dataset.id,el));
    const currentIds=new Set(state.servers.map(s=>s.id)); for(const[id,el]of existing) if(!currentIds.has(id)){el.remove();existing.delete(id);}
    const order=[];
    state.servers.forEach(s=>{
      const dot=statusDot(s.status); const rooms=roomsByServer[s.id]||[];
      const regionHtml=s.region?`<span class="card-region" title="${esc(s.region)}">${esc(s.region)}</span>`:'';
      const errMsg=s.error?`<div class="server-error">⚠️ ${esc(s.error)}</div>`:'';
      const roomsHtml=rooms.length?`<div class="room-list">${rooms.map(r=>roomCard(r)).join('')}</div>`:'';
      let group=existing.get(s.id);
      if(group){
        const dotEl=group.querySelector('.server-status-dot'); if(dotEl&&dotEl.className!=='server-status-dot '+dot) dotEl.className='server-status-dot '+dot;
        const nameEl=group.querySelector('.server-name'); const address=s.address||`${s.host}:${s.port}`;
        const nameHtml=`${esc(s.name)}`;
        if(nameEl){ if(nameEl.innerHTML!==nameHtml)nameEl.innerHTML=nameHtml; nameEl.title='点击复制服务器名称'; nameEl.dataset.copytext=s.name||''; if(!nameEl._copyBound){nameEl.addEventListener('click',e=>{e.stopPropagation();copyText(nameEl.dataset.copytext,nameEl);});nameEl._copyBound=true;} }
        const addressEl=group.querySelector('.server-address'); const addrHtml=`${esc(address)}`;
        if(addressEl){ if(addressEl.textContent!==address)addressEl.textContent=address; addressEl.title='点击复制服务器地址: '+address; addressEl.dataset.copytext=address; if(!addressEl._copyBound){addressEl.addEventListener('click',e=>{e.stopPropagation();copyText(addressEl.dataset.copytext,addressEl);});addressEl._copyBound=true;} }
        else { const infoEl=group.querySelector('.server-info'); if(infoEl&&!infoEl.querySelector('.server-address')){const a=document.createElement('div');a.className='server-address';a.title='点击复制服务器地址: '+address;a.dataset.copytext=address;a.textContent=address;a.addEventListener('click',e=>{e.stopPropagation();copyText(a.dataset.copytext,a);});infoEl.appendChild(a);} }
        const regionEl=group.querySelector('.card-region');
        if(regionEl){ if(!s.region){regionEl.remove();} else if(regionEl.outerHTML!==regionHtml){regionEl.outerHTML=regionHtml;} }
        else if(regionHtml){ group.querySelector('.server-head').insertAdjacentHTML('afterbegin',regionHtml);}
        const badgeContainer=group.querySelector('.card-badges'); if(badgeContainer){ const newBadge=getServerBadge(s); if(badgeContainer.innerHTML!==newBadge){badgeContainer.innerHTML=newBadge;const db=badgeContainer.querySelector('.del-btn');if(db)db.addEventListener('click',e=>{e.stopPropagation();openDeleteConfirm(s.id,s.name,group);});} }
        const detailEl=group.querySelector('.server-detail'); if(detailEl&&detailEl.innerHTML!=='') detailEl.innerHTML='';
        const statBs=group.querySelectorAll('.stat-item b'); if(statBs.length>=3){statBs[0].textContent=String(s.online||0);statBs[1].textContent=String(s.idle||0);statBs[2].textContent=String(s.room_count||0);}
        const latEl=group.querySelector('.stat-item.latency'); if(latEl){const nb=latEl.querySelector('.latency-badge');const nl=latencyHTML(s);if(!nb||nb.outerHTML!==nl)latEl.innerHTML=`<span>延迟</span>${nl}`;}
        const shouldOpen=state.expanded.has(s.id); const isOpen=group.classList.contains('open'); if(shouldOpen!==isOpen) group.classList.toggle('open',shouldOpen);
        const body=group.querySelector('.server-body > .body-inner'); if(body){const nb=errMsg+roomsHtml;if(body.innerHTML!==nb)body.innerHTML=nb;}
        const oldMsg=group.querySelector('.no-rooms-match'); if(oldMsg)oldMsg.remove();
      } else {
        const isOpen=state.expanded.has(s.id)?'open':''; const extraClass=getServerClass(s); const badgeHtml=getServerBadge(s); const address=s.address||`${s.host}:${s.port}`;
        const regionHtml=s.region?`<span class="card-region" title="${esc(s.region)}">${esc(s.region)}</span>`:'';
        const div=document.createElement('div'); div.className=`server-group ${isOpen}${extraClass}`; div.dataset.id=s.id;
        div.innerHTML=`${regionHtml}<div class="server-head"><div class="server-status-dot ${dot}"></div><div class="server-info"><div class="server-name" title="点击复制服务器名称" data-copytext="${esc(s.name)}">${esc(s.name)}</div><div class="server-address" title="点击复制服务器地址: ${esc(address)}" data-copytext="${esc(address)}">${esc(address)}</div><div class="server-detail"></div></div><div class="card-badges">${badgeHtml}</div><div class="server-stats"><div class="stat-item online"><span>在线</span><b>${s.online||0}</b></div><div class="stat-item idle"><span>空闲</span><b>${s.idle||0}</b></div><div class="stat-item rooms"><span>房间</span><b>${s.room_count||0}</b></div><div class="stat-item latency"><span>延迟</span>${latencyHTML(s)}</div></div></div><div class="server-body"><div class="body-inner">${errMsg}${roomsHtml}</div></div>`;
        const nameEl=div.querySelector('.server-name'); if(nameEl) nameEl.addEventListener('click',e=>{e.stopPropagation();copyText(nameEl.dataset.copytext,nameEl);});
        const addrEl=div.querySelector('.server-address'); if(addrEl) addrEl.addEventListener('click',e=>{e.stopPropagation();copyText(addrEl.dataset.copytext,addrEl);});
        initDragAndDrop(div,s); existing.set(s.id,div);
        div.querySelector('.server-head').addEventListener('click',()=>{const id=div.dataset.id;if(state.expanded.has(id)){state.expanded.delete(id);div.classList.remove('open');}else{state.expanded.add(id);div.classList.add('open');}});
      }
      order.push(existing.get(s.id));
    });
    if(state.firstLoad||list.children.length===0){ list.innerHTML=''; const frag=document.createDocumentFragment(); order.forEach(el=>frag.appendChild(el)); list.appendChild(frag); state.firstLoad=false; saveCurrentOrder(); }
    else { const cur=[...list.children]; let changed=cur.length!==order.length; if(!changed)for(let i=0;i<cur.length;i++)if(cur[i]!==order[i]){changed=true;break;} if(changed){const frag=document.createDocumentFragment();order.forEach(el=>frag.appendChild(el));list.appendChild(frag);} }

    // 绑定游戏 ID 点击复制事件（使用事件委托，仅对 isunknown=true 有效）
  }

  // ===== 全局事件委托：点击复制未映射游戏 ID（仅非 FFFFFFFFFFFFFFFF） =====
  document.addEventListener('click', function(e) {
    const target = e.target.closest('.room-game.copy-game-id');
    if (target && target.dataset.isunknown === 'true') {
      e.stopPropagation();
      const contentId = target.dataset.contentid;
      if (contentId && contentId !== UNKNOWN_ID) {
        copyText(contentId, target);
        _showGlobalToast('✓ 已复制游戏 ID: ' + contentId);
      }
    }
  });

  function renderFilters(){
    const games=[...new Set(state.rooms.map(r=>r.game).filter(Boolean))];
    const tabs=['all_servers','all',...games.slice(0,10)]; const container=$('filters'); const existing=container.children;
    while(existing.length<tabs.length){ const btn=document.createElement('button'); btn.className='filter-tab'; btn.addEventListener('click',()=>{container.querySelectorAll('.filter-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');state.game=btn.dataset.game;if(state.game==='all_servers'){state.servers.forEach(s=>{const g=document.querySelector(`.server-group[data-id="${s.id}"]`);if(!g)return;if((s.room_count||0)>0){if(!g.classList.contains('open')){g.classList.add('open');state.expanded.add(s.id);}}else{g.classList.remove('open');state.expanded.delete(s.id);}});}applyFilter(false);}); container.appendChild(btn); }
    while(existing.length>tabs.length) existing[existing.length-1].remove();
    tabs.forEach((g,i)=>{ const btn=existing[i]; let label; if(g==='all')label=`总房间 (${state.rooms.length})`; else if(g==='all_servers')label=`全部 (${state.servers.length})`; else label=esc(g); btn.dataset.game=g; btn.textContent=label; const active=(g==='all'&&state.game==='all')||(g==='all_servers'&&state.game==='all_servers')||(g!=='all'&&g!=='all_servers'&&state.game===g); btn.classList.toggle('active',active); });
  }

  function render(data, isFirstLoad){
    state.servers=Array.isArray(data.servers)?data.servers:[]; state.rooms=Array.isArray(data.rooms)?data.rooms:[];
    // 首次加载时，保存默认顺序（在 loadSavedOrder 之前保存，以便后续恢复）
    if(isFirstLoad || !state._defaultOrder || state._defaultOrder.length===0){
      state._defaultOrder=state.servers.map(s=>({id:s.id}));
    }
    const hadOrder=loadSavedOrder();
    if(state.firstExpand){state.game='all_servers';state.firstExpand=false;}
    if(state.game==='all_servers'){state.servers.forEach(s=>{if((s.room_count||0)>0)state.expanded.add(s.id);else state.expanded.delete(s.id);});}
    requestAnimationFrame(()=>{renderFilters();renderServers();applyFilter(false);});
  }

  async function load(force){
    if(state.loading&&!force)return; state.loading=true;
    const btn=$('refreshBtn'); btn.classList.add('loading');
    const isFirstLoad = state.firstLoad;
    // 首次加载时尝试显示缓存
    if(isFirstLoad){try{const cs=localStorage.getItem('lan_play_cache_servers');const cr=localStorage.getItem('lan_play_cache_rooms');if(cs&&cr)render({servers:JSON.parse(cs),rooms:JSON.parse(cr)}, false);}catch(e){}}
    try{
      const url='/api/snapshot?refresh='+(force?'1':'0')+'&_='+Date.now();
      const data=await getJSON(url);
      localStorage.setItem('lan_play_cache_servers',JSON.stringify(data.servers));
      localStorage.setItem('lan_play_cache_rooms',JSON.stringify(data.rooms));
      await new Promise(res=>requestAnimationFrame(res)); 
      // 首次加载时传入 true 以保存默认顺序
      render(data, isFirstLoad);
      if(btn){btn.classList.remove('loading');btn.classList.add('success');btn.querySelector('.refresh-text').innerHTML='<span>✓ 已刷新</span>';setTimeout(()=>btn.classList.remove('success'),1200);}
      checkNetwork(true);
    }catch(e){btn.classList.remove('loading');checkNetwork(true);}
    finally{state.loading=false;scheduleRefresh();}
  }

  let refreshTimer=null;
  function scheduleRefresh(){if(refreshTimer)clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>load(false),10000);}
  $('refreshBtn').addEventListener('click',()=>{if(refreshTimer)clearTimeout(refreshTimer);load(true);});

  let touchStartY=0;
  document.addEventListener('touchstart',e=>{touchStartY=e.changedTouches[0].screenY},{passive:true});
  document.addEventListener('touchend',e=>{const dy=touchStartY-e.changedTouches[0].screenY;if(dy<-80&&window.scrollY<=0){if(refreshTimer)clearTimeout(refreshTimer);load(true);}},{passive:true});

  state.firstLoad=true;state.firstExpand=true;load(false);
})();