(() => {
  'use strict';

  function __lanPlayInit() {

  'use strict';

// ============================================================
// 补丁：沉浸式状态栏 + 网页深色跟随系统深色 + 电池优化桥接
// 适用：合并进 script.js 的最顶部 IIFE 入口 `__lanPlayInit()` 内。
//       在 `__lanPlayInit()` 函数最开始（约第 4 行 `use strict;` 之后）插入本块。
// ============================================================
//
// 1) 在脚本启动最早的时间建立"系统深色模式"主题管线（必须在 main themeToggle 之前）。
// 2) 提供 `window.applySystemDarkMode(isDark)` 给 Java 端调用（监听 Configuration 变化）。
// 3) 启动后通过 `window.LanPlayNative.syncPageTheme(...)` 把当前主题推给 Java，
//    Java 端据此切换状态栏图标颜色。
// 4) 监听 `prefers-color-scheme: dark` 变化，WebView 自身也跟随（Android 11+ WebView 已支持）。

// 替换 script.js 最顶部的 (function setupSystemThemeAndImmersive() { ... })();
// 这是已修复的完整版，可直接覆盖原  IIFE（约 1-150 行）
// 修复点：
//  - 增加 “跟随系统” 语义：lan_play_theme 的值为 'light'|'dark'|'auto'(或空) ，auto 才跟随系统
//  - 增加 window.resetToFollowSystem() 和长按主题按钮回到跟随系统
//  - 启动时优先从 Java 的 LanPlayNative.getInfo() 同步系统深色，避免 localStorage 竞态
//  - 初始推送延迟重试，确保 Java 的 evaluateJavascript 在页面就绪后仍能生效
//  - 修复深色切换时状态栏图标通过 syncPageTheme 回推，避免 Java 侧强制覆盖
//  - 兼容旧版 WebView 不支持 matchMedia addEventListener 的情况

(function setupSystemThemeAndImmersive() {
  'use strict';

  if (typeof window.__lanplaySystemDark === 'undefined') {
    window.__lanplaySystemDark = false;
  }

  // 对外暴露：让设置页或长按按钮可一键回到跟随系统
  window.resetToFollowSystem = function() {
    try {
      localStorage.removeItem('lan_play_theme');
      // 也清理旧的 light 标记（兼容只有 dark 存储的版本）
    } catch(e){}
    const isDark = !!window.__lanplaySystemDark
      || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    _applyThemeToDom(isDark ? 'dark' : 'light');
    _pushThemeToJava(isDark ? 'dark' : 'light');
    try { window.dispatchEvent(new CustomEvent('lanplay:system-theme-changed', {detail:{isDark}})); } catch(e){}
    // 同步更新图标
    try { if (typeof updateThemeIcon === 'function') updateThemeIcon(); } catch(e){}
    try { if (typeof updateThemeColor === 'function') updateThemeColor(); } catch(e){}
  };

  function _getSavedManualTheme() {
    try {
      const v = localStorage.getItem('lan_play_theme');
      if (v === 'light' || v === 'dark') return v;
      if (v === 'auto') return null; // 兼容 auto 显式值
    } catch(e){}
    return null;
  }

  function _fetchSystemDarkFromJava() {
    try {
      if (window.LanPlayNative && typeof window.LanPlayNative.getInfo === 'function') {
        const raw = window.LanPlayNative.getInfo();
        const info = JSON.parse(raw);
        if (info && typeof info.isSystemDark === 'boolean') return info.isSystemDark;
      }
    } catch(e){}
    return null;
  }

  function _resolveTheme() {
    const manual = _getSavedManualTheme();
    if (manual) return manual;
    // 跟随系统
    let cached = null;
    try {
      const v = localStorage.getItem('lanplay_system_dark');
      if (v === '1') cached = true;
      else if (v === '0') cached = false;
    } catch(e){}
    // 优先用 Java 提供的真实系统值（避免 WebView 虚拟值）
    const fromJava = _fetchSystemDarkFromJava();
    if (fromJava !== null) return fromJava ? 'dark' : 'light';
    if (cached === true) return 'dark';
    if (cached === false) return 'light';
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }

  function _applyThemeToDom(theme) {
    const html = document.documentElement;
    if (!html) return;
    if (theme === 'dark') {
      html.classList.add('dark');
      html.classList.remove('light');
    } else if (theme === 'light') {
      html.classList.add('light');
      html.classList.remove('dark');
    } else {
      html.classList.remove('light','dark');
    }
    // 同时更新 meta theme-color，并确保全局函数也更新（避免旧版本引用）
    try {
      const isDarkNow = theme === 'dark';
      const color = isDarkNow ? '#0f1923' : '#dff3ff';
      document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.remove());
      const meta = document.createElement('meta'); meta.name='theme-color'; meta.content=color;
      document.head.appendChild(meta);
      // 同步到全局 updateThemeColor 的逻辑（如果已定义）
      try { if (window.updateThemeColor && typeof window.updateThemeColor === 'function') { /* 已更新 meta，直接调用同步状态栏 */ } } catch(e){}
      // 兼容：尝试调用全局的图标更新
      if (typeof window.updateThemeIcon === 'function') {
        try { window.updateThemeIcon(); } catch(e){}
      }
    } catch(e){}
  }

  function _pushThemeToJava(theme) {
    try {
      if (window.LanPlayNative && typeof window.LanPlayNative.syncPageTheme === 'function') {
        window.LanPlayNative.syncPageTheme(theme === 'dark');
      }
    } catch(e){}
  }

  window.applySystemDarkMode = function(isDark) {
    try {
      window.__lanplaySystemDark = !!isDark;
      try { localStorage.setItem('lanplay_system_dark', isDark ? '1' : '0'); } catch(e){}
      const manual = _getSavedManualTheme();
      if (!manual) {
        const theme = isDark ? 'dark' : 'light';
        _applyThemeToDom(theme);
        _pushThemeToJava(theme);
        try { window.dispatchEvent(new CustomEvent('lanplay:system-theme-changed', {detail:{isDark:!!isDark}})); } catch(e){}
        // 让外层的 theme 图标也刷新
        try { if (typeof updateThemeIcon === 'function') updateThemeIcon(); } catch(e){}
      } else {
        // 已手动锁定：仅缓存系统值，不切页面，但仍让 Java 知道真实系统值备用
        // 不推送，避免状态栏被强制跟随系统而与页面不一致
      }
    } catch(e){ console.warn('[applySystemDarkMode] failed', e); }
  };

  // 监听系统媒体查询（Android 11+ WebView 支持，旧版需 Java 回调兜底）
  try {
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const _onMqChange = function(ev){
        try {
          const isDark = !!ev.matches;
          window.applySystemDarkMode(isDark);
        } catch(e){}
      };
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', _onMqChange);
      else if (typeof mq.addListener === 'function') mq.addListener(_onMqChange);
    }
  } catch(e){}

  // 启动时立即应用一次
  try {
    const t = _resolveTheme();
    _applyThemeToDom(t);
    // 推给 Java：需等待 bridge 注入
    const tryPush = (attempt) => {
      if (window.LanPlayNative && typeof window.LanPlayNative.syncPageTheme === 'function') {
        _pushThemeToJava(t);
      } else if (attempt < 8) {
        setTimeout(()=>tryPush(attempt+1), 250);
      } else {
        window.addEventListener('load', ()=> setTimeout(()=>_pushThemeToJava(_resolveTheme()), 100));
      }
    };
    tryPush(0);
    // 若 Java 后续通过 evaluateJavascript 再次推送，会自动覆盖
  } catch(e){}

  // 沉浸式安全区（保持原逻辑，略）
  try {
    function _applySafeArea(){
      const html = document.documentElement; if(!html) return;
      try{
        const probe=document.createElement('div');
        probe.style.cssText='position:fixed;left:-9999px;top:-9999px;width:0;height:0;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px);';
        document.body.appendChild(probe);
        const cs=getComputedStyle(probe);
        html.style.setProperty('--safe-top', (parseFloat(cs.paddingTop)||0)+'px');
        html.style.setProperty('--safe-bottom', (parseFloat(cs.paddingBottom)||0)+'px');
        html.style.setProperty('--safe-left', (parseFloat(cs.paddingLeft)||0)+'px');
        html.style.setProperty('--safe-right', (parseFloat(cs.paddingRight)||0)+'px');
        document.body.removeChild(probe);
      }catch(e){}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _applySafeArea);
    else _applySafeArea();
    window.addEventListener('resize', _applySafeArea, {passive:true});
    window.addEventListener('orientationchange', _applySafeArea, {passive:true});
  } catch(e){}

  // 点击主题按钮：light -> dark -> 跟随系统（auto）三态循环，长按直接回到跟随
  try {
    document.addEventListener('DOMContentLoaded', function(){
      const btn = document.getElementById('themeToggleBtn');
      if(!btn) return;
      // 单击：三态循环
      btn.addEventListener('click', function(){
        setTimeout(function(){
          const manual = _getSavedManualTheme();
          let next;
          if (!manual) {
            // 当前是跟随系统，点一下锁定为与当前相反的固定主题
            const curIsDark = document.documentElement.classList.contains('dark')
              || (!document.documentElement.classList.contains('light') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
            next = curIsDark ? 'light' : 'dark';
            try{ localStorage.setItem('lan_play_theme', next); }catch(e){}
          } else if (manual === 'light') {
            next = 'dark';
            try{ localStorage.setItem('lan_play_theme', 'dark'); }catch(e){}
          } else {
            // dark -> 回到跟随
            try{ localStorage.removeItem('lan_play_theme'); }catch(e){}
            next = _resolveTheme();
          }
          _applyThemeToDom(next);
          _pushThemeToJava(next);
          try{ if(typeof updateThemeIcon==='function') updateThemeIcon(); }catch(e){}
        },0);
      });
      // 长按 600ms 回到跟随系统
      let lpTimer=null, sx=0, sy=0;
      btn.addEventListener('pointerdown', e=>{
        sx=e.clientX; sy=e.clientY;
        lpTimer=setTimeout(()=>{
          window.resetToFollowSystem();
          try{ if(navigator.vibrate) navigator.vibrate(20);}catch(e){}
          // 阻止随后的 click
          const blocker=(ev)=>{ev.preventDefault();ev.stopImmediatePropagation();};
          btn.addEventListener('click', blocker, {capture:true, once:true});
          setTimeout(()=>btn.removeEventListener('click', blocker, {capture:true}), 700);
          // 提示
          try{ if(typeof showToast==='function') showToast('已切换为跟随系统',1500,true);}catch(e){}
        },600);
      });
      ['pointerup','pointercancel','pointerleave','pointermove'].forEach(ev=>{
        btn.addEventListener(ev, e=>{
          if(ev==='pointermove' && lpTimer){
            const dx=e.clientX-sx, dy=e.clientY-sy;
            if(dx*dx+dy*dy>64){ clearTimeout(lpTimer); lpTimer=null; }
          } else { clearTimeout(lpTimer); lpTimer=null; }
        }, {passive:true});
      });
    });
  } catch(e){}

  // 监听外部事件：当 Java 或其它脚本分发 lanplay:system-theme-changed 时刷新图标
  try {
    window.addEventListener('lanplay:system-theme-changed', ()=>{ try{ if(typeof updateThemeIcon==='function') updateThemeIcon(); }catch(e){} });
  } catch(e){}
})();


    // ============================================================
    // ★ 单文件版：HTML + CSS 已合并进本 JS（由 build_merged.py 生成）
    // ============================================================

    // ---------- 页面元信息（对应原 index.html <head>） ----------
    document.title = 'LAN-Play 房间监控';
    if (document.documentElement) {
      document.documentElement.setAttribute('lang', 'zh-CN');
    }
    if (!document.querySelector('meta[name="viewport"]')) {
      const __vpMeta = document.createElement('meta');
      __vpMeta.name = 'viewport';
      __vpMeta.content = 'width=device-width,initial-scale=1,viewport-fit=cover';
      document.head.appendChild(__vpMeta);
    }

    // ---------- 注入 CSS（原 styles.css 全文） ----------
    const __styleEl = document.createElement('style');
    __styleEl.id = 'lanplay-injected-style';
    __styleEl.textContent = `/* ===== 全局禁用长按选中/复制文字 ===== */
* {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

/* 允许输入框等可交互元素正常选择 */
input, textarea, select, button {
  -webkit-user-select: auto;
  -moz-user-select: auto;
  -ms-user-select: auto;
  user-select: auto;
}

/* 日志内容允许复制 */
.log-content {
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

:root{
  --bg:#dff3ff;--card:rgba(255,255,255,.82);--white:#fff;--ink:#0c3154;--muted:#50728d;
  --blue:#d8effd;--cyan:#19c8ae;--red:#dc3048;--line:rgba(55,130,175,.12);
  --shadow:0 16px 44px rgba(65,136,178,.11);
  --green:#178a78;--green-bg:#dcf6f1;--orange:#e8820c;
  --radius-lg:28px;--radius-md:20px;--radius-sm:14px;
  --font:"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  --transition:all .25s cubic-bezier(.4,0,.2,1);
}
html.dark{
  --bg:#0f1923;--card:rgba(22,34,46,.85);--white:#16222e;--ink:#e0eef8;
  --muted:#7a9bb5;--blue:#1a3344;--cyan:#2ee6c8;--red:#ff5a6e;
  --line:rgba(255,255,255,.06);--shadow:0 16px 44px rgba(0,0,0,.4);
  --green:#3dd9b8;--green-bg:rgba(61,217,184,.12);--orange:#ffb347;
}
@media (prefers-color-scheme: dark){
  :root:not(.light){
    --bg:#0f1923;--card:rgba(22,34,46,.85);--white:#16222e;--ink:#e0eef8;
    --muted:#7a9bb5;--blue:#1a3344;--cyan:#2ee6c8;--red:#ff5a6e;
    --line:rgba(255,255,255,.06);--shadow:0 16px 44px rgba(0,0,0,.4);
    --green:#3dd9b8;--green-bg:rgba(61,217,184,.12);--orange:#ffb347;
  }
}
*,*::before,*::after{box-sizing:border-box}
html{
  background:var(--bg);
  scroll-behavior:smooth;
}
body{
  margin:0;min-height:100vh;color:var(--ink);font-family:var(--font);
  background:var(--bg);
  transition:background .4s ease,color .4s ease;
  -webkit-tap-highlight-color:transparent;overflow-x:hidden;
}
a{color:inherit;text-decoration:none}
button{font:inherit}
::selection{background:var(--cyan);color:#fff}
.page{width:min(1100px,calc(100%-32px));margin:auto;padding:24px 0 24px;animation:fadeIn .5s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.glass{border:1px solid rgba(255,255,255,.8);background:var(--card);box-shadow:var(--shadow);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);transition:var(--transition)}
html.dark .glass{border-color:rgba(255,255,255,.05)}
@media (prefers-color-scheme: dark){:root:not(.light) .glass{border-color:rgba(255,255,255,.05)}}

.hero{margin-top:0;min-height:68px;border-radius:var(--radius-lg);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:12px;z-index:100}
.brand-area{
  display:flex;
  align-items:center;
  gap:8px;
  min-width:0;
  flex:1 1 auto;
  overflow-x:auto;
  overflow-y:hidden;
  scrollbar-width:none;
  -ms-overflow-style:none;
  -webkit-overflow-scrolling:touch;
  touch-action:pan-x;
}
.brand-area::-webkit-scrollbar{display:none}
.brand-area > *{flex-shrink:0}
/* 导航栏图标拖拽排序（虚线用内边框，避免被 overflow 裁切） */
.brand-area > button.nav-dragging{
  opacity:0.35;
  transform:scale(0.9);
  z-index:5;
  filter:grayscale(0.2);
}
.brand-area > button.nav-drag-over{
  /* 内描边虚线：不依赖 outline，不会被 overflow-x/y 裁掉 */
  border:2px dashed var(--cyan)!important;
  background:rgba(25,200,174,.14)!important;
  box-sizing:border-box;
}
html.dark .brand-area > button.nav-drag-over,
:root:not(.light) .brand-area > button.nav-drag-over{
  background:rgba(46,230,200,.18)!important;
  border-color:var(--cyan)!important;
}
.brand-area.nav-reordering{
  touch-action:none;
  overflow:visible; /* 拖动时允许阴影/拖影溢出 */
}
/* 跟手拖影（fixed，挂在 body 上，不受导航栏裁切） */
.nav-drag-ghost{
  position:fixed;
  width:42px;
  height:42px;
  border-radius:12px;
  display:grid;
  place-items:center;
  font-size:18px;
  font-weight:700;
  pointer-events:none;
  z-index:10050;
  margin:0;
  padding:0;
  border:2px solid rgba(255,255,255,.55);
  background:linear-gradient(145deg,var(--cyan),#14a891);
  color:#fff;
  box-shadow:0 10px 28px rgba(25,200,174,.45),0 2px 8px rgba(0,0,0,.18);
  transform:translate(-50%,-50%) scale(1.08);
  opacity:0.95;
  transition:none;
  line-height:1;
  overflow:visible;
}
html.dark .nav-drag-ghost,
:root:not(.light) .nav-drag-ghost{
  color:#0f1923;
  border-color:rgba(15,25,35,.25);
  box-shadow:0 10px 28px rgba(0,0,0,.5),0 0 0 1px rgba(46,230,200,.35);
}
.nav-drag-ghost .online-count-badge,
.nav-drag-ghost .public-unread-badge{
  display:none!important;
}
.brand{display:flex;align-items:center;gap:12px;min-width:0;cursor:pointer}
.logo{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(145deg,#fff970,#ffd626);box-shadow:inset 0 0 0 2px rgba(255,255,255,.7),0 4px 12px rgba(255,200,40,.25);font-size:16px;animation:pulse 3s ease-in-out infinite;flex-shrink:0}
.plugin-toast{
  position:fixed;left:50%;top:90px;transform:translateX(-50%) translateY(-16px);
  background:linear-gradient(135deg,#19c8ae,#14a891);color:#fff;
  padding:12px 24px;border-radius:12px;font-size:14px;font-weight:700;
  box-shadow:0 8px 28px rgba(25,200,174,.35);z-index:9999;
  opacity:0;pointer-events:none;transition:opacity .3s ease,transform .3s ease;
  white-space:nowrap;
}
.plugin-toast.show{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto}
html.dark .plugin-toast{background:linear-gradient(135deg,#2ee6c8,#1ab89a);color:#0f1923}
@media (prefers-color-scheme: dark){:root:not(.light) .plugin-toast{background:linear-gradient(135deg,#2ee6c8,#1ab89a);color:#0f1923}}
@media (max-width:600px){
  .plugin-toast{font-size:12.5px;padding:10px 18px;top:80px;white-space:normal;text-align:center;max-width:calc(100% - 32px)}
}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}

.hero-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.theme-toggle,.icon-btn{border:0;width:38px;height:38px;border-radius:12px;background:#e1f1fa;color:var(--ink);cursor:pointer;display:grid;place-items:center;font-size:16px;transition:var(--transition);flex-shrink:0}
.theme-toggle:hover,.icon-btn:hover{background:#cce9f9;transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.08)}
html.dark .theme-toggle,html.dark .icon-btn{background:rgba(255,255,255,.08);color:var(--cyan)}
html.dark .theme-toggle:hover,html.dark .icon-btn:hover{background:rgba(255,255,255,.15)}
@media (prefers-color-scheme: dark){
  :root:not(.light) .theme-toggle,:root:not(.light) .icon-btn{background:rgba(255,255,255,.08);color:var(--cyan)}
  :root:not(.light) .theme-toggle:hover,:root:not(.light) .icon-btn:hover{background:rgba(255,255,255,.15)}
}

/* ===== 公共聊天数字角标（与在线成员一致） ===== */
.public-chat-btn {
  position: relative;
  overflow: hidden;
}
.public-chat-btn .public-chat-icon {
  font-size: 16px;
  line-height: 1;
}
#publicUnreadBadge.zero {
  display: none;
}

/* ===== 在线成员按钮 ===== */
.online-members-btn {
  position: relative;
  overflow: hidden; /* 角标限制在图标内 */
}
.online-members-btn .online-icon {
  font-size: 16px;
  line-height: 1;
}
.online-count-badge {
  position: absolute;
  top: 1px;
  right: 1px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 999px;
  background: var(--cyan);
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  line-height: 14px;
  text-align: center;
  box-shadow: none;
  pointer-events: none;
  z-index: 2;
  transition: transform .2s ease, opacity .2s ease;
}
.online-count-badge.zero {
  opacity: 0.55;
  background: var(--muted);
  box-shadow: none;
}
html.dark .online-count-badge {
  color: #0f1923;
}
html.dark .online-count-badge.zero {
  color: #fff;
  background: rgba(255,255,255,.25);
}

/* ===== 在线成员列表 ===== */
.online-members-list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.online-member-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(125,175,210,.06);
  transition: background .2s;
}
.online-member-item:hover {
  background: rgba(125,175,210,.12);
}
.online-member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--cyan), #14a891);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 800;
  flex-shrink: 0;
}
.online-member-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.online-member-name {
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.online-member-id {
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.online-member-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 0 3px rgba(25,200,174,.15);
  flex-shrink: 0;
}
.online-members-empty {
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  padding: 28px 12px;
}
html.dark .online-member-item {
  background: rgba(255,255,255,.04);
}
html.dark .online-member-item:hover {
  background: rgba(255,255,255,.08);
}

.dot{width:12px;height:12px;border-radius:50%;background:#19c8ae;box-shadow:0 0 0 6px rgba(25,200,174,.13);animation:pulse-dot 2s ease-in-out infinite;flex-shrink:0}
.dot.online{background:#19c8ae;box-shadow:0 0 0 6px rgba(25,200,174,.15)}
.dot.offline{background:#dc3048;box-shadow:0 0 0 6px rgba(220,48,72,.15);animation:none}
.dot.checking{background:#e8820c;box-shadow:0 0 0 6px rgba(232,130,12,.12)}
@keyframes pulse-dot{0%,100%{box-shadow:0 0 0 6px rgba(25,200,174,.13)}50%{box-shadow:0 0 0 10px rgba(25,200,174,.06)}}

.scan{display:flex;align-items:center;gap:10px;color:var(--muted);font-weight:700;font-size:13px;flex-shrink:0;justify-content:flex-end}
.refresh{border:0;border-radius:12px;padding:10px 18px;background:#e1f1fa;color:var(--ink);font-weight:750;cursor:pointer;font-size:13.5px;transition:var(--transition);display:inline-flex;align-items:center;gap:6px}
.refresh:hover{background:#cce9f9;transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.08)}
.refresh:active{transform:translateY(0)}
.refresh.loading{pointer-events:none;opacity:.7}
.refresh .spinner{width:14px;height:14px;border:2.5px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite;display:none}
.refresh.loading .spinner{display:block}
.refresh.loading .refresh-text::before{content:'刷新中'}
.refresh.loading .refresh-text span{display:none}
@keyframes spin{to{transform:rotate(360deg)}}
html.dark .refresh{background:rgba(255,255,255,.08);color:var(--ink)}
html.dark .refresh:hover{background:rgba(255,255,255,.15)}
@media (prefers-color-scheme: dark){:root:not(.light) .refresh{background:rgba(255,255,255,.08);color:var(--ink)}:root:not(.light) .refresh:hover{background:rgba(255,255,255,.15)}}

.log-modal{position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(5px);display:none;align-items:center;justify-content:center;z-index:1000}
.log-modal.open{display:flex}
.log-box{background:var(--white);width:min(800px,calc(100% - 32px));height:500px;border-radius:var(--radius-md);box-shadow:var(--shadow);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--line)}
.log-header{padding:14px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);font-weight:800;font-size:15px}
.log-close{background:none;border:0;font-size:18px;cursor:pointer;color:var(--muted)}
.log-content{flex:1;padding:16px;background:#0b131a;color:#3dd9b8;font-family:monospace;font-size:12.5px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;line-height:1.5}

.overview{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px}
.ov-card{padding:18px 10px;background:var(--white);border-radius:var(--radius-md);box-shadow:0 6px 20px rgba(82,142,178,.06);text-align:center;transition:var(--transition);min-width:0}
.ov-card:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(82,142,178,.1)}
.ov-card span{display:block;color:var(--muted);font-size:11.5px;font-weight:600;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ov-card b{font-size:24px;font-weight:900}
.ov-card.online b{color:#2b8a6f}.ov-card.idle b{color:#b8860b}.ov-card.rooms b{color:#1a73c0}.ov-card.servers b{color:#6f42c1}
html.dark .ov-card.online b{color:#3dd9b8}html.dark .ov-card.idle b{color:#ffb347}html.dark .ov-card.rooms b{color:#7ab8ff}html.dark .ov-card.servers b{color:#c4a7ff}
@media (prefers-color-scheme: dark){
  :root:not(.light) .ov-card.online b{color:#3dd9b8}
  :root:not(.light) .ov-card.idle b{color:#ffb347}
  :root:not(.light) .ov-card.rooms b{color:#7ab8ff}
  :root:not(.light) .ov-card.servers b{color:#c4a7ff}
}

.server-list{margin-top:18px;display:grid;gap:12px;contain:layout style}

/* ===== 服务器卡片（含滑动） ===== */
.server-group{
  position: relative;
  background:var(--white);
  border-radius:var(--radius-md);
  filter: drop-shadow(0 6px 20px rgba(82,142,178,.06));
  overflow:hidden;
  will-change:auto;
  contain:layout style paint;
  cursor:grab;
  transition: filter 0.25s ease;
  touch-action:pan-y;
}
.server-group:active{cursor:grabbing}
.server-group:hover {
  filter: drop-shadow(0 10px 30px rgba(82,142,178,.1));
}
.server-group.dragging{
  opacity:0.4;
  transform:scale(0.98);
  filter: drop-shadow(0 20px 40px rgba(0,0,0,0.15));
  border-radius:var(--radius-md) !important;
  overflow:hidden;
}
.server-group.drag-over{border:2px dashed var(--cyan);background:rgba(25,200,174,.05)}

html.dark .server-group {
  filter: drop-shadow(0 6px 20px rgba(0,0,0,0.5));
}
html.dark .server-group:hover {
  filter: drop-shadow(0 10px 30px rgba(0,0,0,0.6));
}
html.dark .server-group.dragging {
  filter: drop-shadow(0 20px 40px rgba(0,0,0,0.7));
}
@media (prefers-color-scheme: dark) {
  :root:not(.light) .server-group {
    filter: drop-shadow(0 6px 20px rgba(0,0,0,0.5));
  }
  :root:not(.light) .server-group:hover {
    filter: drop-shadow(0 10px 30px rgba(0,0,0,0.6));
  }
  :root:not(.light) .server-group.dragging {
    filter: drop-shadow(0 20px 40px rgba(0,0,0,0.7));
  }
}

/* 动作层（右侧按钮） - 默认隐藏，滑动后显示 */
.server-actions {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 160px;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transform: translateX(100%);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.server-group.swipe-open .server-actions {
  pointer-events: auto;
  opacity: 1;
  transform: translateX(0);
}

.action-btn {
  flex: 1;
  border: 0;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  touch-action: manipulation;
}
.action-btn:active {
  opacity: 0.8;
}
.action-edit {
  background: #1a73c0;
}
.action-edit:hover {
  background: #155a9b;
}
.action-delete {
  background: var(--red);
}
.action-delete:hover {
  background: #b0243a;
}

/* 卡片内容容器 */
.server-card-inner {
  position: relative;
  background: var(--white);
  border-radius: var(--radius-md);
  transition: transform 0.3s cubic-bezier(.4,0,.2,1);
  will-change: transform;
  z-index: 1;
  touch-action: pan-y;
}
.server-group.swipe-open .server-card-inner {
  transform: translateX(-160px);
}

/* ===== 地区 / 类型标签：左侧与名称、地址上下对齐 ===== */
.card-region {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--green);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .3px;
  line-height: 1.35;
  margin: 1px 0 0;
  pointer-events: none;
}

.server-type-badge {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: transparent;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .3px;
  line-height: 1.35;
  margin: 1px 0 0;
  pointer-events: none;
}
.server-type-badge.builtin {
  color: var(--orange);
}
.server-type-badge.remote {
  color: #1a73c0;
}
.server-type-badge.manual {
  color: var(--cyan);
}

/* ===== 服务器卡片头部 ===== */
.server-head{
  position: relative;
  display:flex;
  align-items:stretch;
  gap:14px;
  padding:22px 22px 18px;
  cursor:pointer;
  user-select:none;
  -webkit-tap-highlight-color:transparent;
  touch-action:manipulation
}
.server-head:hover{background:rgba(125,175,210,.06)}
html.dark .server-head:hover{background:rgba(255,255,255,.03)}
@media (prefers-color-scheme: dark){:root:not(.light) .server-head:hover{background:rgba(255,255,255,.03)}}

.server-status-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;position:relative;align-self:center;display:block;margin:0}
.server-status-dot.online{background:#19c8ae;box-shadow:0 0 0 4px rgba(25,200,174,.15);animation:server-pulse-online 2s ease-in-out infinite}
.server-status-dot.offline{background:#dc3048;box-shadow:0 0 0 4px rgba(220,48,72,.12);animation:none}
.server-status-dot.checking{background:#e8820c;box-shadow:0 0 0 4px rgba(232,130,12,.12);animation:pulse-dot 1.5s ease-in-out infinite}
@keyframes server-pulse-online{0%,100%{box-shadow:0 0 0 4px rgba(25,200,174,.15),0 0 0 0 rgba(25,200,174,.25)}50%{box-shadow:0 0 0 8px rgba(25,200,174,.08),0 0 12px 4px rgba(25,200,174,.2)}}

.server-info {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  align-self: stretch;
  padding: 0;
}

/* ========== 新增省略号通用类 ========== */
.ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: inline-block;
  max-width: 100%;
  vertical-align: middle;
}

.server-name,
.server-address,
.game-name,
.host-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: inline-block;
  max-width: 100%;
  vertical-align: middle;
}
/* 移除旧的双副本滚动相关样式 */
.scroll-wrapper,
.server-name .scroll-wrapper,
.server-address .scroll-wrapper,
.game-name .scroll-wrapper,
.host-name .scroll-wrapper {
  display: none !important;
}

/* ===== 原有服务器名称和地址样式（继承 ellipsis） ===== */
.server-name {
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  user-select: text;
  padding: 0;
  margin: 0;
  border-radius: 0;
  transition: var(--transition);
  line-height: 1.4;
}
.server-name:hover {
  background: rgba(125,175,210,.08);
  border-radius: 6px;
  padding: 0 8px;
  margin: 0 -8px;
}

.server-address {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  padding: 0;
  margin: 0;
  cursor: pointer;
  user-select: text;
  border-radius: 6px;
  transition: var(--transition);
  line-height: 1.4;
}
.server-address:hover {
  background: rgba(125,175,210,.08);
  color: var(--ink);
  border-radius: 6px;
  padding: 0 8px;
  margin: 0 -8px;
}
.server-address:active {
  background: rgba(25,200,174,.15);
  border-radius: 6px;
  padding: 0 8px;
  margin: 0 -8px;
}

.server-stats{display:grid;grid-template-columns:repeat(4,1fr);width:280px;gap:8px;align-items:center;flex-shrink:0}
.stat-item{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0}
.stat-item span{display:block;font-size:10.5px;color:var(--muted);font-weight:600;margin-bottom:2px;line-height:1.3}
.stat-item b{font-size:18px;font-weight:900;line-height:1.3;height:auto;display:flex;align-items:center;justify-content:center}
.stat-item.online b{color:#2b8a6f} .stat-item.idle b{color:#b8860b} .stat-item.rooms b{color:#1a73c0}
html.dark .stat-item.online b{color:#3dd9b8}html.dark .stat-item.idle b{color:#ffb347}html.dark .stat-item.rooms b{color:#7ab8ff}
@media (prefers-color-scheme: dark){
  :root:not(.light) .stat-item.online b{color:#3dd9b8}
  :root:not(.light) .stat-item.idle b{color:#ffb347}
  :root:not(.light) .stat-item.rooms b{color:#7ab8ff}
}
/* 延迟与其它统计项对齐，数字字号一致 */
.stat-item.latency{
  align-items:center;
  justify-content:center;
}
.stat-item.latency b,
.stat-item.latency .latency-badge{
  font-size:18px;
  font-weight:900;
  line-height:1.3;
  height:auto;
  display:flex;
  align-items:center;
  justify-content:center;
  background:transparent!important;
}
.latency-badge.fast{color:#17776b}
.latency-badge.normal{color:var(--muted)}
.latency-badge.slow{color:#a52639}
.latency-badge.error{color:var(--muted);font-weight:900}
html.dark .latency-badge.fast{color:#3dd9b8}
html.dark .latency-badge.slow{color:#ff5a6e}
@media (prefers-color-scheme: dark){
  :root:not(.light) .latency-badge.fast{color:#3dd9b8}
  :root:not(.light) .latency-badge.slow{color:#ff5a6e}
}

/* ===== 服务器卡片新消息数字角标：卡片右上角 ===== */
.unread-indicator {
  position: absolute;
  top: 6px;
  right: 8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--cyan);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  line-height: 16px;
  text-align: center;
  box-shadow: none;
  flex-shrink: 0;
  display: none;
  pointer-events: none;
  z-index: 3;
}
html.dark .unread-indicator {
  color: #0f1923;
}

.server-body{display:grid;grid-template-rows:0fr;overflow:hidden;transition:none}
.server-body > .body-inner{overflow:hidden;min-height:0}
.server-group.open .server-body{grid-template-rows:1fr;overflow:visible}
/* 展开区内边距缩小，房间更贴近卡片边缘；顶部分割线与收起态边线一致 */
.server-group.open .server-body > .body-inner{padding:0 10px 10px;overflow:visible}

/* 服务器错误角标：卡片顶部居中，无背景，红色文字 */
.server-error-badge {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  max-width: min(70%, 280px);
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 0;
  background: transparent;
  color: var(--red);
  font-size: 11px;
  font-weight: 800;
  line-height: 18px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: none;
  pointer-events: none;
  z-index: 4;
  display: none;
}
.server-error-badge.show {
  display: block;
}
html.dark .server-error-badge {
  color: #ff5a6e;
  background: transparent;
  box-shadow: none;
}
@media (prefers-color-scheme: dark) {
  :root:not(.light) .server-error-badge {
    color: #ff5a6e;
    background: transparent;
    box-shadow: none;
  }
}
@media (max-width:600px) {
  .server-error-badge {
    top: 4px;
    max-width: min(72%, 220px);
    height: 16px;
    line-height: 16px;
    font-size: 10px;
    padding: 0 2px;
  }
}
/* 兼容旧版横幅错误（若残留则隐藏） */
.server-error { display: none !important; }

.room-list{display:grid;gap:10px;margin-top:6px;margin-bottom:0}
.room-item{padding:16px 18px;border-radius:16px;background:var(--card);box-shadow:0 4px 14px rgba(82,142,178,.05);transition:transform .15s ease,box-shadow .15s ease;contain:layout style paint;max-width:100%;overflow:hidden}
.room-item:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(82,142,178,.09)}

.room-top {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
}

.room-game-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
}
.room-icon {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
  background: #34495e;
}

.game-name {
  font-size: 12.5px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 999px;
  background: #e9f5fb;
  color: #326887;
  /* 继承 ellipsis 特性，已用 .ellipsis 类 */
}
.game-name.copy-game-id {
  cursor: pointer;
  border: 1px dashed var(--red);
  transition: var(--transition);
}
.game-name.copy-game-id:hover {
  background: rgba(220,48,72,.15);
  transform: scale(1.02);
}
.game-name.no-copy {
  cursor: default;
  border: 1px solid var(--line);
  opacity: 0.7;
}
html.dark .game-name {
  background: rgba(97,194,233,.12);
  color: #7dd3fc;
}
@media (prefers-color-scheme: dark) {
  :root:not(.light) .game-name {
    background: rgba(97,194,233,.12);
    color: #7dd3fc;
  }
}

.room-meta {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: center;
  margin-top: 8px;
  font-size: 13px;
  color: #376482;
  font-weight: 600;
  max-width: 100%;
  overflow: hidden;
}
.room-meta > * {
  white-space: nowrap;
  flex-shrink: 0;
}
.room-meta .green {
  color: var(--green);
  font-weight: 750;
}
.room-meta .red {
  color: var(--red);
  font-weight: 800;
}

.room-host-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 120px;
  overflow: hidden;
  white-space: nowrap;
  flex: 0 1 auto;
  flex-shrink: 1;
  flex-grow: 0;
  min-width: 0;
}
.host-icon-fixed {
  flex-shrink: 0;
  font-size: 15px;
}
.host-name {
  display: inline-block;
  overflow: hidden;
  white-space: nowrap;
  flex: 0 1 auto;
  min-width: 0;
}

/* 移除旧的滚动动画 */
@keyframes marquee-dual {
  /* 已废弃 */
}

/* 其他原有样式保持不变... */
.room-players{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
.room-players .player{
  padding:3px 10px;border-radius:999px;background:var(--green-bg);color:#17776b;
  font-size:11.5px;font-weight:600;
  white-space:normal;
  word-break:break-word;
  flex-shrink:0;
}
html.dark .room-players .player{background:rgba(61,217,184,.12);color:#3dd9b8}
@media (prefers-color-scheme: dark){:root:not(.light) .room-players .player{background:rgba(61,217,184,.12);color:#3dd9b8}}

.no-rooms{padding:20px;text-align:center;color:var(--muted);font-size:13px;background:rgba(125,175,210,.04);border-radius:14px;margin-top:8px}
.skeleton{height:60px;border-radius:14px;background:linear-gradient(100deg,#f0f6fa 20%,#e2eef5 38%,#f0f6fa 56%);background-size:300% 100%;animation:shine 1.4s infinite;margin-top:8px}
html.dark .skeleton{background:linear-gradient(100deg,#1a2530 20%,#243240 38%,#1a2530 56%);background-size:300% 100%}
@media (prefers-color-scheme: dark){:root:not(.light) .skeleton{background:linear-gradient(100deg,#1a2530 20%,#243240 38%,#1a2530 56%);background-size:300% 100%}}
@keyframes shine{to{background-position-x:-100%}}

.filters{display:flex;gap:8px;overflow-x:auto;padding:14px 0 4px;scrollbar-width:none}
.filters::-webkit-scrollbar{display:none}
.filter-tab{flex:0 0 auto;border:0;border-radius:999px;padding:9px 18px;background:#e8f3f9;color:var(--ink);font-weight:700;cursor:pointer;font-size:13px;transition:var(--transition);white-space:nowrap}
.filter-tab:hover{background:#d8eaf3}
.filter-tab.active{
  background:#cde9fa;
  color:#0c5d91;
  font-weight:800;
  filter: drop-shadow(0 2px 8px rgba(97,194,233,.25));
}
html.dark .filter-tab{background:rgba(255,255,255,.06)}
html.dark .filter-tab:hover{background:rgba(255,255,255,.10)}
html.dark .filter-tab.active{
  background:rgba(97,194,233,.20);
  color:#7dd3fc;
  filter: drop-shadow(0 2px 8px rgba(97,194,233,.3));
}
@media (prefers-color-scheme: dark){
  :root:not(.light) .filter-tab{background:rgba(255,255,255,.06)}
  :root:not(.light) .filter-tab:hover{background:rgba(255,255,255,.10)}
  :root:not(.light) .filter-tab.active{
    background:rgba(97,194,233,.20);
    color:#7dd3fc;
    filter: drop-shadow(0 2px 8px rgba(97,194,233,.3));
  }
}

.custom-modal{position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(5px);display:none;align-items:center;justify-content:center;z-index:1000}
.custom-modal.open{display:flex}
.custom-modal-box{background:var(--white);width:min(450px,calc(100% - 32px));border-radius:var(--radius-md);box-shadow:var(--shadow);overflow:hidden;border:1px solid var(--line);animation:fadeIn .25s ease}
.custom-modal-header{padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);font-weight:800;font-size:15px}
.custom-modal-close{background:none;border:0;font-size:18px;cursor:pointer;color:var(--muted)}
.custom-modal-body{padding:20px}
.form-grid{display:grid;gap:12px;margin-top:4px}
.form-row input,.form-row select{width:100%;padding:10px 14px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:13.5px;outline:none;transition:var(--transition)}
.form-row input:focus,.form-row select:focus{border-color:var(--cyan);box-shadow:0 0 0 3px rgba(25,200,174,.15)}
.form-row-group{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.submit-btn{width:100%;border:0;border-radius:12px;padding:12px;background:var(--cyan);color:#fff;font-weight:800;cursor:pointer;font-size:14px;transition:var(--transition);margin-top:4px;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.submit-btn:hover{opacity:.9;transform:translateY(-1px)}
.submit-btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
.submit-btn .spinner{width:14px;height:14px;border:2.5px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite;display:none}
.submit-btn.loading .spinner{display:block}

/* ===== Toast ===== */
.global-copy-toast {
  position: fixed;
  left: 50%;
  top: 80px;
  transform: translateX(-50%) translateY(-12px);
  z-index: 9999;
  pointer-events: none;
  opacity: 0;
  transition: opacity .25s ease, transform .25s ease;
  background: linear-gradient(135deg, #19c8ae, #14a891);
  color: #fff;
  padding: 10px 22px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 8px 28px rgba(25, 200, 174, .35);
  white-space: normal;
  max-width: min(90vw, 400px);
  word-wrap: break-word;
  text-align: center;
}
.global-copy-toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.global-copy-toast.success {
  background: linear-gradient(135deg, #19c8ae, #14a891);
}
.global-copy-toast.error {
  background: linear-gradient(135deg, #dc3048, #b0243a);
  box-shadow: 0 8px 28px rgba(220, 48, 72, .35);
}
html.dark .global-copy-toast {
  background: linear-gradient(135deg, #2ee6c8, #1ab89a);
  color: #0f1923;
}
html.dark .global-copy-toast.error {
  background: linear-gradient(135deg, #ff5a6e, #cc3048);
  color: #fff;
}
@media (prefers-color-scheme: dark) {
  :root:not(.light) .global-copy-toast {
    background: linear-gradient(135deg, #2ee6c8, #1ab89a);
    color: #0f1923;
  }
  :root:not(.light) .global-copy-toast.error {
    background: linear-gradient(135deg, #ff5a6e, #cc3048);
    color: #fff;
  }
}
@media (max-width:600px) {
  .global-copy-toast {
    font-size: 12.5px;
    padding: 8px 16px;
    top: 72px;
    max-width: 92vw;
  }
}

footer{text-align:center;padding:24px 16px 8px;color:#55758c;font-size:12px;line-height:1.9;margin-top:12px}
html.dark footer{color:var(--muted)}
@media (prefers-color-scheme: dark){:root:not(.light) footer{color:var(--muted)}}

/* ===== DPI 调节模态框 ===== */
.dpi-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dpi-modal.open {
  display: flex;
}
.dpi-modal-box {
  background: var(--white);
  width: min(320px, calc(100% - 32px));
  border-radius: var(--radius-md);
  box-shadow: var(--shadow);
  overflow: hidden;
  border: 1px solid var(--line);
  animation: fadeIn .2s ease;
}
.dpi-modal-header {
  padding: 14px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--line);
  font-weight: 800;
  font-size: 15px;
}
.dpi-modal-close {
  background: none;
  border: 0;
  font-size: 18px;
  cursor: pointer;
  color: var(--muted);
  padding: 0 4px;
}
.dpi-modal-body {
  padding: 24px 20px 20px;
}
.dpi-slider-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
#dpiLabel {
  font-size: 20px;
  font-weight: 800;
  color: var(--cyan);
}
#dpiSlider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--line);
  border-radius: 3px;
  outline: none;
  transition: background .2s;
}
#dpiSlider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--cyan);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(25,200,174,.3);
}
#dpiSlider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--cyan);
  cursor: pointer;
  border: 0;
}
html.dark #dpiSlider {
  background: rgba(255,255,255,.15);
}
html.dark #dpiSlider::-webkit-slider-thumb {
  background: var(--cyan);
}
html.dark #dpiSlider::-moz-range-thumb {
  background: var(--cyan);
}
@media (prefers-color-scheme: dark) {
  :root:not(.light) #dpiSlider {
    background: rgba(255,255,255,.15);
  }
  :root:not(.light) #dpiSlider::-webkit-slider-thumb {
    background: var(--cyan);
  }
  :root:not(.light) #dpiSlider::-moz-range-thumb {
    background: var(--cyan);
  }
}

.dpi-reset-btn {
  margin-top: 4px;
  padding: 8px 20px;
  border: 0;
  border-radius: 12px;
  background: var(--cyan);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: var(--transition);
  width: 100%;
  max-width: 200px;
}
.dpi-reset-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}
.dpi-reset-btn:active {
  transform: scale(0.97);
}
html.dark .dpi-reset-btn {
  background: var(--cyan);
  color: #0f1923;
}
@media (prefers-color-scheme: dark) {
  :root:not(.light) .dpi-reset-btn {
    background: var(--cyan);
    color: #0f1923;
  }
}

/* ===== 响应式 ===== */
@media (max-width:900px){
  .page{width:calc(100% - 20px);padding-top:14px}
  .hero{border-radius:20px;padding:10px 14px;gap:10px}
  .brand-area{min-width:0;flex:1 1 auto}
  .scan{font-size:12px;flex-shrink:0}
  .ov-card{padding:14px 6px}
  .ov-card b{font-size:20px}
  .server-head{padding:14px 16px;gap:10px}
  .server-stats{width:250px;gap:6px;align-items:center}
  .server-info{align-self:stretch;padding:0}
  .server-name{font-size:14.5px}
  .server-address{font-size:11.5px}
  .stat-item b{height:auto;line-height:1.3}
}
@media (max-width:600px){
  .page{width:calc(100% - 14px);padding:10px 0 16px}
  .hero{border-radius:16px;padding:8px 10px;gap:6px;position:sticky;top:6px}
  .brand-area{min-width:0;flex:1 1 auto;gap:6px}
  .brand strong{font-size:15px}
  .brand small{display:none}
  .logo{width:34px;height:34px;border-radius:10px;font-size:16px}
  .theme-toggle,.icon-btn{width:34px;height:34px;border-radius:10px;font-size:14px}
  .scan{margin-top:0;font-size:11.5px;flex-shrink:0}
  .scan .refresh{flex:0 0 auto;padding:7px 12px;font-size:12px}
  .overview{grid-template-columns:repeat(4,1fr);gap:5px;margin-top:14px}
  .ov-card{padding:10px 2px;border-radius:12px}
  .ov-card b{font-size:16px}
  .ov-card span{font-size:10px}
  .server-list{margin-top:14px;gap:10px}
  .server-head{padding:12px 14px;gap:8px;flex-wrap:nowrap}
  .server-status-dot{width:10px;height:10px;align-self:center;display:block;flex-shrink:0}
  .server-info{align-self:stretch;padding:0}
  .server-name{font-size:13.5px}
  .server-address{font-size:11px}
  .server-stats{width:210px;gap:4px;align-items:center}
  .server-stats .stat-item span{font-size:9.5px}
  .server-stats .stat-item b,
  .server-stats .stat-item.latency b,
  .server-stats .stat-item.latency .latency-badge{
    font-size:15px;
    height:auto;
    line-height:1.3;
  }
  .server-group.open .server-body{padding:0}
  .server-group.open .server-body > .body-inner{padding:0 8px 8px}
  .room-list{gap:8px;margin-top:6px}
  .room-item{padding:14px;border-radius:14px}
  .room-game-left .game-name{font-size:11px;padding:3px 10px;flex:0 1 auto;max-width:100%}
  .room-host-meta{max-width:100px;flex-shrink:1}
  .room-meta{font-size:12px;gap:6px;flex-wrap:nowrap}
  .room-players{gap:4px}
  .room-players .player{font-size:10.5px;padding:2px 8px;white-space:normal;word-break:break-word}
  .filters{padding:10px 0 2px}
  .filter-tab{padding:7px 14px;font-size:12px}
}
@media (max-width:380px){
  .brand strong{font-size:14px}
  .logo{width:30px;height:30px;font-size:14px}
  .theme-toggle,.icon-btn{width:30px;height:30px;font-size:12px}
  .scan{font-size:10.5px;gap:6px}
  .scan .refresh{padding:6px 10px;font-size:11px}
  .server-stats{grid-template-columns:repeat(3,1fr);width:150px;align-items:center}
  .server-stats .stat-item.idle{display:none}
  .server-name{font-size:12.5px}
  .server-address{font-size:10px}
  .room-game-left .game-name{font-size:10.5px;padding:2px 8px}
  .room-host-meta{max-width:80px;flex-shrink:1}
  .room-meta{font-size:11px;gap:4px;flex-wrap:nowrap}
  .room-players .player{font-size:10px;padding:2px 6px}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
}

/* ===== 聊天模块样式 ===== */
.chat-wrapper {
    margin-top: 0;
    border-top: 1px solid var(--line);
    padding-top: 8px;
    padding-bottom: 4px;
}
.chat-messages {
    max-height: 120px;
    overflow-y: auto;
    background: var(--card);
    border-radius: 12px;
    padding: 8px 12px;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.chat-msg {
    padding: 4px 10px;
    border-radius: 12px;
    max-width: 80%;
    word-break: break-word;
    background: rgba(125,175,210,.08);
    align-self: flex-start;
}
.chat-msg-mine {
    background: #fff;
    color: #17344d;
    align-self: flex-end;
}
/* QQ 风格时间分割线 */
.chat-time-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    align-self: stretch;
    margin: 8px 0 4px;
    pointer-events: none;
    user-select: none;
}
.chat-time-divider span {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    background: transparent;
    padding: 2px 10px;
    border-radius: 999px;
    letter-spacing: 0.2px;
    opacity: 0.9;
}
html.dark .chat-time-divider span {
    color: var(--muted);
    opacity: 0.85;
}
.chat-input-area {
    display: flex;
    gap: 6px;
    margin-top: 8px;
}
.chat-input {
    flex: 1;
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid var(--line);
    background: var(--card);
    color: var(--ink);
    font-size: 13px;
    outline: none;
}
.chat-input:focus {
    border-color: var(--cyan);
}
.chat-send-btn {
    padding: 6px 16px;
    border: 0;
    border-radius: 20px;
    background: var(--cyan);
    color: #fff;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
}
.chat-send-btn:hover {
    opacity: 0.85;
}
html.dark .chat-msg {
    background: rgba(255,255,255,.06);
}
html.dark .chat-msg-mine {
    background: var(--cyan);
    color: #0f1923;
}

.image-upload-btn {
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 12px;
  transition: var(--transition);
  color: var(--muted);
}
.image-upload-btn:hover {
  background: var(--line);
  color: var(--ink);
}

/* ===== 聊天链接 - 无背景，纯亮蓝色 ===== */
.chat-link {
    color: #1e90ff;
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-thickness: 2px;
    text-decoration-color: #1e90ff;
    cursor: pointer;
    user-select: text;
    transition: color 0.2s, transform 0.1s;
    font-weight: 600;
}
.chat-link:hover {
    color: #0077ea;
    transform: scale(1.02);
}

html.dark .chat-link,
@media (prefers-color-scheme: dark) {
    :root:not(.light) .chat-link {
        color: #4fc3f7;
        text-decoration-color: #4fc3f7;
    }
    html.dark .chat-link:hover,
    :root:not(.light) .chat-link:hover {
        color: #81d4fa;
    }
}
/* ===== 聊天多媒体消息 ===== */
.chat-messages {
  max-height: 220px;
}
.chat-media-img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 0;
  display: block;
  margin-top: 4px;
  cursor: zoom-in;
  object-fit: cover;
  background: rgba(0,0,0,.06);
}
.chat-media-video {
  max-width: 240px;
  max-height: 200px;
  border-radius: 0;
  display: block;
  margin-top: 4px;
  background: #000;
  cursor: zoom-in;
}
.chat-media-audio {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
  min-width: 200px;
  max-width: 260px;
}
.chat-media-audio-el {
  display: none;
}
.chat-media-audio-label {
  display: none;
}
/* ===== 自定义音频播放器 ===== */
.audio-player-ui {
  display: flex;
  align-items: center;
  gap: 8px;
}
.audio-play-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 0;
  background: var(--cyan);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;
  transition: opacity .2s, transform .2s;
}
.audio-play-btn:hover {
  opacity: .85;
  transform: scale(1.06);
}
.audio-play-btn:active {
  transform: scale(.95);
}
/* 进度条：浅色气泡(白底)用深色轨道 */
.audio-progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(0,40,60,.25);
  border-radius: 3px;
  cursor: pointer;
  position: relative;
  min-width: 60px;
  overflow: hidden;
  border: 1px solid rgba(0,40,60,.08);
}
.audio-progress-fill {
  height: 100%;
  background: #19c8ae;
  border-radius: 3px;
  width: 0%;
  pointer-events: none;
  box-shadow: 0 0 4px rgba(25,200,174,.50);
}
.audio-time-display {
  font-size: 12px;
  font-weight: 600;
  color: #08786e;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 38px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
/* 自己发的气泡(cyan底)：深色轨道 + 深色填充 */
/* 浅色：自己气泡(白底，与对方一致) */
.chat-msg-mine .audio-progress-bar {
  background: rgba(0,40,60,.18);
}
.chat-msg-mine .audio-progress-fill {
  background: #19c8ae;
  box-shadow: 0 0 4px rgba(25,200,174,.50);
}
.chat-msg-mine .audio-time-display {
  color: #08786e;
}

/* ===== 深色模式：深色气泡(深蓝灰底 #263746) ===== */
html.dark .audio-play-btn,
:root:not(.light) .audio-play-btn {
  background: var(--cyan);
  color: #0f1923;
}
/* 轨道大幅提亮，在 #263746 背景上清晰可见 */
html.dark .audio-progress-bar,
:root:not(.light) .audio-progress-bar {
  background: rgba(255,255,255,.35);
}
html.dark .audio-progress-fill,
:root:not(.light) .audio-progress-fill {
  background: #2ee6c8;
  box-shadow: 0 0 8px rgba(46,230,200,.65);
}
html.dark .audio-time-display,
:root:not(.light) .audio-time-display {
  color: #70ddff;
}
/* 深色模式下别人气泡内：轨道更亮 */
html.dark .chat-msg .audio-progress-bar,
:root:not(.light) .chat-msg .audio-progress-bar {
  background: rgba(255,255,255,.35);
}
html.dark .chat-msg .audio-progress-fill,
:root:not(.light) .chat-msg .audio-progress-fill {
  background: #2ee6c8;
  box-shadow: 0 0 8px rgba(46,230,200,.65);
}
/* 深色模式下自己气泡(与对方一致 #263746 底) */
html.dark .chat-msg-mine .audio-progress-bar,
:root:not(.light) .chat-msg-mine .audio-progress-bar {
  background: rgba(255,255,255,.35);
}
html.dark .chat-msg-mine .audio-progress-fill,
:root:not(.light) .chat-msg-mine .audio-progress-fill {
  background: #2ee6c8;
  box-shadow: 0 0 8px rgba(46,230,200,.65);
}
html.dark .chat-msg-mine .audio-time-display,
:root:not(.light) .chat-msg-mine .audio-time-display {
  color: #70ddff;
}
.chat-media-file {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(125,175,210,.10);
  color: var(--ink);
  text-decoration: none;
  max-width: 260px;
  transition: background .2s;
}
.chat-media-file:hover {
  background: rgba(125,175,210,.18);
}
.chat-media-file-icon {
  font-size: 22px;
  flex-shrink: 0;
}
.chat-media-file-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.chat-media-file-name {
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-media-file-size {
  font-size: 11px;
  color: var(--muted);
}
html.dark .chat-media-file {
  background: rgba(255,255,255,.06);
}
html.dark .chat-media-file:hover {
  background: rgba(255,255,255,.10);
}

/* ===== 聊天图片 / 视频放大预览 ===== */
.chat-lightbox,
.chat-video-lightbox {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0,0,0,.86);
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  overscroll-behavior: contain;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: none;
}
.chat-lightbox.open,
.chat-video-lightbox.open {
  display: flex;
}
.chat-lightbox-stage,
.chat-video-lightbox-stage {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  touch-action: none;
}
.chat-lightbox-img {
  position: absolute;
  top: 50%;
  left: 50%;
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
  border-radius: 0 !important;
  object-fit: contain;
  box-shadow: none;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  -webkit-touch-callout: none;
  transform: translate3d(-50%, -50%, 0) translate3d(0, 0, 0) scale(1);
  transform-origin: center center;
  will-change: transform;
}
.chat-lightbox-img.is-dragging {
  cursor: grabbing;
}
/* ===== QQ 风格内置视频播放器：不使用原生 controls ===== */
.chat-video-player {
  position: relative;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  background: transparent;
  line-height: normal;
  border-radius: 0;
  isolation: isolate;
  padding: 0;
  margin: 0;
  vertical-align: top;
}
.chat-video-player .chat-media-video,
.chat-video-player .chat-lightbox-video {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  border-radius: 0 !important;
  background: #000;
  object-fit: contain;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
}
.chat-video-wrap .chat-media-video {
  max-width: 255px;
  max-height: 180px;
}
.chat-video-lightbox-player {
  width: min(96vw, 1200px);
  max-width: 96vw;
  max-height: 90vh;
  touch-action: none;
}
.chat-video-lightbox-player .chat-lightbox-video {
  width: 100%;
  max-width: min(96vw, 1200px);
  max-height: 90vh;
}
/* 竖屏视频：按原比例完整显示，不强行拉伸或裁切。 */
.chat-video-player.is-portrait .chat-media-video {
  width: auto;
  height: auto;
  max-width: min(62vw, 220px);
  max-height: min(58vh, 300px);
  object-fit: contain;
  /* 裁掉竖屏源视频顶部极薄的黑边，避免预览出现黑色横条。 */
  transform: scale(1.04);
  transform-origin: center center;
  background: transparent;
}
.chat-video-lightbox-player.is-portrait {
  width: auto;
  max-width: 96vw;
}
.chat-video-lightbox-player.is-portrait .chat-lightbox-video {
  width: auto;
  height: auto;
  max-width: 96vw;
  max-height: 90vh;
  object-fit: contain;
}
.chat-video-player.is-portrait .chat-video-controls {
  gap: 2px;
  padding: 20px 4px 5px;
}
.chat-video-player.is-portrait .chat-video-control-btn {
  width: 21px;
  height: 21px;
  font-size: 13px;
}
.chat-video-player.is-portrait .chat-video-time {
  min-width: 23px;
  font-size: 9px;
}
.chat-video-player.is-portrait .chat-video-duration {
  display: none;
}
.chat-video-player.is-portrait .chat-video-progress {
  min-width: 18px;
  margin: 0 1px;
}
.chat-video-center-play { 
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 4;
  width: 64px;
  height: 64px;
  padding: 0 0 0 4px;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  transform: translate(-50%, -50%);
  background: rgba(255,255,255,.78);
  color: #000;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 4px 18px rgba(0,0,0,.32);
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: transform .18s ease, background .18s ease, opacity .18s ease;
}
.chat-video-center-play:hover {
  transform: translate(-50%, -50%) scale(1.06);
  background: rgba(255,255,255,.92);
}
.chat-video-center-play:active {
  transform: translate(-50%, -50%) scale(.94);
}
.chat-video-center-play.is-hidden {
  display: none !important;
}
.chat-video-controls {
  position: absolute;
  touch-action: manipulation;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 24px 8px 7px;
  color: #fff;
  background: linear-gradient(to bottom, transparent, rgba(0,0,0,.82));
  line-height: 1;
  opacity: .96;
}
.chat-video-control-btn {
  flex: 0 0 auto;
  width: 27px;
  height: 27px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: transparent;
  color: #fff;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.chat-video-control-btn:hover {
  background: rgba(255,255,255,.18);
}
.chat-video-time {
  flex: 0 0 auto;
  min-width: 34px;
  color: #fff;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
}
.chat-video-progress {
  flex: 1 1 auto;
  min-width: 40px;
  height: 4px;
  margin: 0 2px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
  cursor: pointer;
  background: linear-gradient(to right, #fff var(--video-progress, 0%), rgba(255,255,255,.42) var(--video-progress, 0%));
}
.chat-video-progress::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: transparent;
}
.chat-video-progress::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
  margin-top: -4px;
  border: 0;
  border-radius: 50%;
  appearance: none;
  -webkit-appearance: none;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.35);
}
.chat-video-progress::-moz-range-track {
  height: 4px;
  border: 0;
  border-radius: 999px;
  background: rgba(255,255,255,.42);
}
.chat-video-progress::-moz-range-progress {
  height: 4px;
  border-radius: 999px;
  background: #fff;
}
.chat-video-progress::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 0;
  border-radius: 50%;
  background: #fff;
}
.chat-video-lightbox-player .chat-video-controls {
  min-height: 46px;
  padding-bottom: 10px;
}
.chat-video-lightbox-player .chat-video-control-btn {
  width: 34px;
  height: 34px;
  font-size: 19px;
}
.chat-video-lightbox-player .chat-video-time {
  font-size: 13px;
}
.chat-lightbox-close,
.chat-video-lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: rgba(255,255,255,.15);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
}
.chat-lightbox-close:hover,
.chat-video-lightbox-close:hover {
  background: rgba(255,255,255,.28);
}
.chat-video-lightbox-hint {
  position: absolute;
  left: 50%;
  bottom: 18px;
  z-index: 2;
  transform: translateX(-50%);
  padding: 6px 10px;
  border-radius: 8px;
  color: rgba(255,255,255,.78);
  background: rgba(0,0,0,.35);
  font-size: 12px;
  pointer-events: none;
}

.chat-input-area .image-upload-btn {
  font-size: 18px;
  padding: 4px 6px;
}

/* ===== 聊天输入区：+ 菜单 + 语音按钮 ===== */
.chat-input-area {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 8px;
  position: relative;
}
.chat-plus-wrap {
  position: relative;
  flex-shrink: 0;
}
.chat-plus-btn,
.chat-voice-btn {
  border: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(125,175,210,.12);
  color: var(--ink);
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: var(--transition);
  flex-shrink: 0;
  padding: 0;
  line-height: 1;
}
.chat-plus-btn:hover,
.chat-voice-btn:hover {
  background: rgba(125,175,210,.22);
  transform: translateY(-1px);
}
.chat-voice-btn.recording {
  background: var(--red);
  color: #fff;
  animation: voice-pulse 1s ease-in-out infinite;
  font-size: 12px;
  font-weight: 800;
}
@keyframes voice-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220,48,72,.35); }
  50% { box-shadow: 0 0 0 8px rgba(220,48,72,.08); }
}
.chat-plus-panel {
  display: none;
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  min-width: 132px;
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: var(--shadow);
  padding: 6px;
  z-index: 20;
  flex-direction: column;
  gap: 2px;
}
.chat-plus-panel.open {
  display: flex;
}
.chat-plus-panel button {
  border: 0;
  background: transparent;
  text-align: left;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  cursor: pointer;
  white-space: nowrap;
}
.chat-plus-panel button:hover {
  background: rgba(125,175,210,.12);
}
html.dark .chat-plus-btn,
html.dark .chat-voice-btn {
  background: rgba(255,255,255,.08);
  color: var(--cyan);
}
html.dark .chat-plus-btn:hover,
html.dark .chat-voice-btn:hover {
  background: rgba(255,255,255,.14);
}
html.dark .chat-plus-panel {
  background: var(--white);
  border-color: var(--line);
}
.chat-input-area .chat-input {
  flex: 1;
  min-width: 0;
}

/* 聊天身份、长文本与待发送附件 */
.chat-msg .msg-content { display:flex; flex-wrap:wrap; align-items:baseline; gap:0 4px; line-height:1.5; }
.chat-msg .msg-content strong { display:inline-block; }
.msg-sender-id { flex-basis:100%; display:block; margin-top:-2px; color:var(--muted); font-size:10px; font-weight:500; line-height:1.1; }
.chat-msg-mine .msg-sender-id { color:rgba(100,130,150,.72); }
.msg-separator { white-space:pre; }
.chat-input { min-height:36px; max-height:120px; resize:none; overflow-y:auto; line-height:1.45; }
.chat-pending { flex:0 1 auto; max-width:170px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border-radius:12px; padding:7px 8px; background:rgba(25,200,174,.14); color:var(--ink); font-size:11px; }
.chat-pending button { border:0; background:none; color:var(--red); cursor:pointer; font-size:15px; padding:0 0 0 4px; }
@media (max-width:600px) {
  .chat-msg { max-width:92%; }
  .chat-pending { max-width:120px; }
}

/* ===== 手机 QQ 风格聊天重制 ===== */
.chat-wrapper {
  margin: 8px -2px 2px;
  padding: 10px 8px 6px;
  border-top: 1px solid rgba(255,255,255,.07);
  background: linear-gradient(180deg, rgba(10,22,33,.32), rgba(10,22,33,.08));
  border-radius: 16px;
}
.chat-messages,
#publicChatMessages {
  max-height: 300px;
  min-height: 78px;
  overflow-y: auto;
  padding: 12px 10px;
  gap: 10px;
  background: #101d29;
  border: 1px solid rgba(255,255,255,.055);
  border-radius: 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(141,170,190,.35) transparent;
}
html.light .chat-messages,
html.light #publicChatMessages {
  background: #f3f7fa;
  border-color: rgba(55,130,175,.10);
}
.chat-msg {
  display: block;
  flex: 0 0 auto;
  width: fit-content;
  max-width: min(82%, 360px);
  padding: 8px 12px;
  border-radius: 17px 17px 17px 5px;
  background: #263746;
  color: #e8f1f6;
  box-shadow: 0 2px 5px rgba(0,0,0,.12);
  font-size: 14px;
  line-height: 1.45;
  word-break: break-word;
  overflow-wrap: anywhere;
  touch-action: manipulation;
  -webkit-touch-callout: none;
  position: relative;
}
/* 气泡内媒体元素不拦截长按：视频/音频/图片的 pointer-events 由气泡接管 */
.chat-msg .chat-media-video,
.chat-msg .chat-media-audio-el,
.chat-msg .chat-media-img,
.chat-msg .chat-media-audio,
.chat-msg .audio-player-ui,
.chat-msg .audio-play-btn,
.chat-msg .audio-progress-bar,
.chat-msg .chat-media-file,
.chat-msg .msg-content strong,
.chat-msg .msg-content .msg-body {
  -webkit-touch-callout: none;
  touch-action: manipulation;
}
/* 视频和音频播放器的控件仍需可点击，但长按由气泡接管 */
.chat-msg video::-webkit-media-controls {
  -webkit-touch-callout: none;
}
/* 气泡内所有子元素禁用原生长按菜单 */
.chat-msg * {
  -webkit-touch-callout: none !important;
}
.chat-msg img,
.chat-msg video,
.chat-msg audio {
  -webkit-touch-callout: none !important;
  -webkit-user-drag: none;
  user-drag: none;
  outline: none;
}
/* 防止视频/音频长按弹出系统菜单 */
.chat-msg .chat-media-video,
.chat-msg .chat-media-audio {
  -webkit-touch-callout: none !important;
  touch-callout: none;
}
html.light .chat-msg {
  background: #fff;
  color: #17344d;
  box-shadow: 0 2px 8px rgba(39,91,120,.10);
}
.chat-msg-mine {
  align-self: flex-end;
  width: fit-content;
  max-width: min(82%, 360px);
  border-radius: 17px 17px 5px 17px;
  background: #fff;
  color: #17344d;
}
html.dark .chat-msg-mine { background: #263746; color: #e7f1f5; }
.chat-msg .msg-content {
  display: block;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
}
.chat-msg .msg-content strong {
  display: block;
  margin-bottom: 1px;
  font-size: 13px;
  line-height: 1.2;
  color: #65d8ff;
}
.chat-msg-mine .msg-content strong { color: #08786e; }
.chat-msg .msg-sender-id {
  display: block;
  margin: 0 0 5px;
  color: #8ba5b6;
  font-size: 10px;
  line-height: 1.15;
  opacity: .9;
  overflow-wrap: anywhere;
}
.chat-msg-mine .msg-sender-id { color: rgba(100,130,150,.72); }
.msg-separator { display: none; }
.chat-media-audio { min-width: 200px; max-width: 255px; }
.chat-media-video { max-width: 255px; max-height: 180px; }
.chat-media-img { max-width: 220px; max-height: 220px; }
.chat-media-file { max-width: 255px; background: rgba(0,0,0,.08); }
.chat-time-divider { margin: 5px 0 1px; }
.chat-time-divider span {
  padding: 3px 10px;
  color: #7891a2;
  font-size: 10px;
  background: rgba(125,175,210,.08);
}
.chat-input-area {
  gap: 7px;
  padding: 2px 0 0;
}
.chat-input-area .chat-input {
  min-height: 42px;
  padding: 9px 15px;
  border-radius: 22px;
  background: #172735;
  border-color: rgba(255,255,255,.08);
  color: #edf7fb;
  font-size: 14px;
}
html.light .chat-input-area .chat-input {
  background: #fff;
  border-color: rgba(55,130,175,.14);
  color: #17344d;
}
.chat-input-area .chat-input::placeholder { color: #7891a2; }
.chat-plus-btn, .chat-voice-btn {
  width: 42px;
  height: 42px;
  background: #253746;
  color: #9cb6c5;
  font-size: 21px;
}
html.light .chat-plus-btn,
html.light .chat-voice-btn { background: #e8f0f4; color: #55768b; }
/* 录音中固定语音按钮尺寸，计时显示为小角标，避免按钮横向撑大。 */
.chat-input-area .chat-voice-btn.recording {
  width: 42px !important;
  min-width: 42px !important;
  max-width: 42px !important;
  flex: 0 0 42px !important;
  height: 42px !important;
  min-height: 42px !important;
  max-height: 42px !important;
  padding: 0 !important;
  overflow: visible;
  position: relative;
  transform: none !important;
  font-size: 18px !important;
  line-height: 1 !important;
  white-space: nowrap;
}
.chat-input-area .chat-voice-btn.recording::after {
  content: attr(data-recording-seconds) 's';
  position: absolute;
  top: -5px;
  right: -9px;
  min-width: 25px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--red);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  line-height: 17px;
  text-align: center;
  box-shadow: 0 1px 5px rgba(0,0,0,.28);
  pointer-events: none;
}
.chat-send-btn {
  min-width: 78px;
  height: 42px;
  padding: 0 18px;
  border-radius: 22px;
  background: #25d8bd;
  color: #062a2b;
  font-size: 15px;
  box-shadow: 0 4px 12px rgba(37,216,189,.20);
}
.chat-pending {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  z-index: 5;
  max-width: 210px;
  background: #263746;
  color: #e8f1f6;
  box-shadow: 0 6px 18px rgba(0,0,0,.22);
}
@media (max-width:600px) {
  .chat-msg, .chat-msg-mine { max-width: 86%; }
  .chat-media-audio { min-width: 180px; max-width: 235px; }
  .chat-send-btn { min-width: 70px; padding: 0 14px; }
}
@media (prefers-color-scheme: light) {
  .chat-messages, #publicChatMessages { background:#f3f7fa; border-color:rgba(55,130,175,.10); }
  .chat-msg { background:#fff; color:#17344d; box-shadow:0 2px 8px rgba(39,91,120,.10); }
  .chat-input-area .chat-input { background:#fff; border-color:rgba(55,130,175,.14); color:#17344d; }
  .chat-plus-btn, .chat-voice-btn { background:#e8f0f4; color:#55768b; }
}

/* 恢复聊天区域原本的主题背景色，仅保留 QQ 气泡布局 */
.chat-wrapper { background: transparent; }
.chat-messages, #publicChatMessages { background: var(--card); }
.chat-msg { background: rgba(125,175,210,.08); color: var(--ink); }
html.dark .chat-msg { background: rgba(255,255,255,.06); color: var(--ink); }
.chat-input-area .chat-input { background: var(--card); color: var(--ink); }
.chat-plus-btn, .chat-voice-btn { background: rgba(125,175,210,.12); color: var(--ink); }
html.dark .chat-plus-btn, html.dark .chat-voice-btn { background: rgba(255,255,255,.08); color: var(--cyan); }
@media (prefers-color-scheme: dark) {
  :root:not(.light) .chat-msg { background: rgba(255,255,255,.06); color: var(--ink); }
  :root:not(.light) .chat-plus-btn, :root:not(.light) .chat-voice-btn { background: rgba(255,255,255,.08); color: var(--cyan); }
}

/* Telegram 风格消息时间：不显示用户 ID，时间放在气泡右下角 */
.chat-msg .msg-sender-id { display: none !important; }
.chat-msg .msg-content { position: relative; padding-bottom: 2px; }
.chat-msg .msg-time {
  display: inline-block;
  margin-left: 8px;
  color: rgba(145,169,181,.9);
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
  vertical-align: bottom;
}
.chat-msg-mine .msg-time { color: rgba(100,130,150,.72); }
.chat-msg .msg-content strong { margin-right: 2px; }
/* 聊天相关界面不展示用户 ID（在线成员列表也仅显示昵称） */
.online-member-id { display: block; }
.online-member-item { cursor: default; }

/* ===== 聊天气泡可读性优化：浅色 / 深色高对比 ===== */
/* 默认浅色 */
.chat-messages, #publicChatMessages { color: #17344d; }
.chat-msg {
  background: #ffffff;
  color: #17344d;
  border: 1px solid rgba(42,91,119,.10);
  box-shadow: 0 2px 8px rgba(37,82,108,.12);
}
.chat-msg .msg-content { color: #17344d; }
.chat-msg .msg-content strong { color: #08786e; }
.chat-msg .msg-time { color: #66808f; }
.chat-msg-mine {
  background: #fff;
  color: #17344d;
  border-color: rgba(42,91,119,.10);
  box-shadow: 0 2px 8px rgba(37,82,108,.12);
}
.chat-msg-mine .msg-content,
.chat-msg-mine .msg-content strong { color: #17344d; }
.chat-msg-mine .msg-time { color: #66808f; }
.chat-msg .chat-media-audio-label,
.chat-msg .chat-media-file-size { color: #5c7888; }
.chat-msg-mine .chat-media-audio-label,
.chat-msg-mine .chat-media-file-size { color: #5c7888; }
.chat-link { color: #075fc4; text-decoration-color: #075fc4; }

/* 深色模式 */
html.dark .chat-messages, html.dark #publicChatMessages,
:root:not(.light) .chat-messages, :root:not(.light) #publicChatMessages { color: #e7f1f5; }
html.dark .chat-msg,
:root:not(.light) .chat-msg {
  background: #263746;
  color: #e7f1f5;
  border-color: rgba(255,255,255,.08);
  box-shadow: 0 2px 8px rgba(0,0,0,.22);
}
html.dark .chat-msg .msg-content,
:root:not(.light) .chat-msg .msg-content { color: #e7f1f5; }
html.dark .chat-msg .msg-content strong,
:root:not(.light) .chat-msg .msg-content strong { color: #70ddff; }
html.dark .chat-msg .msg-time,
:root:not(.light) .chat-msg .msg-time { color: #a8bfca; }
html.dark .chat-msg-mine,
:root:not(.light) .chat-msg-mine {
  background: #263746;
  color: #e7f1f5;
  border-color: rgba(255,255,255,.08);
  box-shadow: 0 2px 8px rgba(0,0,0,.22);
}
html.dark .chat-msg-mine .msg-content,
html.dark .chat-msg-mine .msg-content strong,
:root:not(.light) .chat-msg-mine .msg-content,
:root:not(.light) .chat-msg-mine .msg-content strong { color: #e7f1f5; }
html.dark .chat-msg-mine .msg-time,
:root:not(.light) .chat-msg-mine .msg-time { color: #a8bfca; }
html.dark .chat-msg .chat-media-audio-label,
html.dark .chat-msg .chat-media-file-size,
:root:not(.light) .chat-msg .chat-media-audio-label,
:root:not(.light) .chat-msg .chat-media-file-size { color: #b5c8d1; }
html.dark .chat-msg-mine .chat-media-audio-label,
html.dark .chat-msg-mine .chat-media-file-size,
:root:not(.light) .chat-msg-mine .chat-media-audio-label,
:root:not(.light) .chat-msg-mine .chat-media-file-size { color: #b5c8d1; }
html.dark .chat-link,
:root:not(.light) .chat-link { color: #72cfff; text-decoration-color: #72cfff; }

@media (prefers-color-scheme: light) {
  :root:not(.dark) .chat-msg { background:#fff; color:#17344d; border-color:rgba(42,91,119,.10); }
  :root:not(.dark) .chat-msg .msg-content { color:#17344d; }
  :root:not(.dark) .chat-msg .msg-content strong { color:#08786e; }
  :root:not(.dark) .chat-msg .msg-time { color:#66808f; }
  :root:not(.dark) .chat-msg-mine { background:#fff; color:#17344d; }
  :root:not(.dark) .chat-msg-mine .msg-content,
  :root:not(.dark) .chat-msg-mine .msg-content strong { color:#17344d; }
  :root:not(.dark) .chat-msg-mine .msg-time { color:#66808f; }
  :root:not(.dark) .chat-link { color:#075fc4; text-decoration-color:#075fc4; }
}

/* 深色模式链接提高亮度，避免被深色气泡吞掉 */
html.dark .chat-link,
html.dark .chat-msg .chat-link,
:root:not(.light) .chat-link,
:root:not(.light) .chat-msg .chat-link { color:#8bdcff !important; text-decoration-color:#8bdcff !important; text-shadow:0 0 1px rgba(139,220,255,.25); }
html.dark .chat-link:hover,
:root:not(.light) .chat-link:hover { color:#c1efff !important; }
.chat-audio-duration { display: none !important; }

/* 待发送附件的取消按钮始终完整可见 */
.chat-pending {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  padding-right: 5px;
}
.chat-pending-name {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-pending button {
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  padding: 0;
  line-height: 1;
  font-size: 18px;
}

/* 图片消息支持下载 */
.chat-image-wrap {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  max-width: 100%;
}
.chat-image-download {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 8px;
  color: #0876b8;
  background: rgba(25,150,210,.10);
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
}
.chat-image-download:hover { background: rgba(25,150,210,.20); }
html.dark .chat-image-download,
:root:not(.light) .chat-image-download { color: #8bdcff; background: rgba(80,190,240,.14); }

/* 媒体消息：时间放在媒体和下载按钮之间 */
.chat-msg.media-message .msg-content { display:flex; flex-direction:column; align-items:flex-start; }
.chat-msg.media-message .msg-content > strong { order:1; }
.chat-msg.media-message .chat-image-wrap,
.chat-msg.media-message .chat-video-wrap { order:2; }
.chat-msg.media-message .msg-time { order:3; margin:4px 0 0; }
.chat-msg.media-message .chat-image-download,
.chat-msg.media-message .chat-video-download { order:4; }
.chat-image-download, .chat-video-download {
  display:inline-flex;
  align-items:center;
  margin-top:4px;
  padding:4px 9px;
  border-radius:8px;
  color:#075d91;
  background:rgba(25,150,210,.12);
  font-size:11px;
  font-weight:700;
  text-decoration:none;
}
.chat-image-download:hover, .chat-video-download:hover { background:rgba(25,150,210,.22); }
html.dark .chat-image-download, html.dark .chat-video-download,
:root:not(.light) .chat-image-download, :root:not(.light) .chat-video-download {
  color:#d7f5ff !important;
  background:rgba(79,190,240,.24);
  text-shadow:0 1px 2px rgba(0,0,0,.65);
}
.chat-video-wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
  line-height: 0;
}
/* 最终消息格式：用户名： / 消息 / 时间 下载图片或下载视频 */
.chat-msg .msg-content { display:block; width:fit-content; max-width:100%; }
.chat-msg .msg-sender { display:block; margin:0 0 4px; line-height:1.25; }
.chat-msg .msg-body { display:block; line-height:1.45; }
.chat-msg .msg-footer { display:flex; align-items:center; gap:8px; margin-top:6px; min-height:14px; }
.chat-msg .msg-footer .msg-time,
.chat-msg .msg-footer .chat-media-download {
  display:inline-flex;
  align-items:center;
  margin:0;
  font-size:10px;
  line-height:1.2;
  white-space:nowrap;
}
.chat-media-download { text-decoration:none; font-weight:700; }
.chat-msg .msg-footer .chat-media-download { color:#075d91; }
.chat-msg-mine .msg-footer .chat-media-download { color:#075d91; }
html.dark .chat-msg .msg-footer .chat-media-download,
:root:not(.light) .chat-msg .msg-footer .chat-media-download { color:#d7f5ff !important; text-shadow:0 1px 2px rgba(0,0,0,.65); }
/* 移除旧版媒体排序规则对新页脚的影响 */
.chat-msg.media-message .msg-content { display:block; }
.chat-msg.media-message .msg-time { order:initial; }

/* 深色模式链接颜色与浅色模式统一 */
html.dark .chat-link,
html.dark .chat-msg .chat-link,
:root:not(.light) .chat-link,
:root:not(.light) .chat-msg .chat-link {
  color: #075fc4 !important;
  text-decoration-color: #075fc4 !important;
  text-shadow: none !important;
}
html.dark .chat-link:hover,
:root:not(.light) .chat-link:hover {
  color: #075fc4 !important;
}

/* 气泡时间与用户名使用同等深度的文字颜色 */
.chat-msg .msg-footer .msg-time { color:#08786e; opacity:1; }
.chat-msg-mine .msg-footer .msg-time { color:#66808f; opacity:1; }
html.dark .chat-msg .msg-footer .msg-time,
:root:not(.light) .chat-msg .msg-footer .msg-time { color:#70ddff; opacity:1; }
html.dark .chat-msg-mine .msg-footer .msg-time,
:root:not(.light) .chat-msg-mine .msg-footer .msg-time { color:#a8bfca; opacity:1; }
@media (prefers-color-scheme: light) {
  :root:not(.dark) .chat-msg .msg-footer .msg-time { color:#08786e; }
  :root:not(.dark) .chat-msg-mine .msg-footer .msg-time { color:#66808f; }
}

.chat-audio-duration { display: none !important; }
html.dark .chat-audio-duration,
:root:not(.light) .chat-audio-duration { display: none !important; }
.chat-msg-mine .chat-audio-duration { display: none !important; }

/* ===== 消息操作菜单（撤回/删除） ===== */
.msg-action-menu {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.msg-action-menu.open {
  pointer-events: auto;
}
.msg-action-mask {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0);
  transition: background .25s ease;
}
.msg-action-menu.open .msg-action-mask {
  background: rgba(0,0,0,.35);
}
.msg-action-sheet {
  position: relative;
  z-index: 1;
  width: min(280px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 18px;
  background: var(--white);
  box-shadow: 0 12px 40px rgba(0,0,0,.2);
  overflow: hidden;
  transform: scale(.85);
  opacity: 0;
  transition: transform .2s cubic-bezier(.4,0,.2,1), opacity .2s ease;
}
.msg-action-menu.open .msg-action-sheet {
  transform: scale(1);
  opacity: 1;
}
.msg-action-btn {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: center;
  padding: 16px 20px;
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
  cursor: pointer;
  transition: background .15s;
}
.msg-action-btn:hover {
  background: rgba(125,175,210,.08);
}
.msg-action-btn:active {
  background: rgba(125,175,210,.15);
}
.msg-action-btn.recall {
  color: var(--red);
}
.msg-action-btn.delete {
  color: var(--muted);
}
.msg-action-btn.cancel {
  color: var(--muted);
  border-top: 1px solid var(--line);
  font-weight: 600;
}
html.dark .msg-action-sheet {
  background: #1a2a38;
  box-shadow: 0 12px 40px rgba(0,0,0,.5);
}
html.dark .msg-action-btn:hover {
  background: rgba(255,255,255,.06);
}
html.dark .msg-action-btn.recall {
  color: #ff5a6e;
}
@media (prefers-color-scheme: dark) {
  :root:not(.light) .msg-action-sheet { background: #1a2a38; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
  :root:not(.light) .msg-action-btn:hover { background: rgba(255,255,255,.06); }
  :root:not(.light) .msg-action-btn.recall { color: #ff5a6e; }
}
/* ============================================================
   CSS 补丁：沉浸式状态栏适配
   把这段追加到 script.js 注入的 __styleEl.textContent 模板字符串最末尾。
   ============================================================ */

/* 安全区变量由前端 JS 在启动时通过 getComputedStyle(env(safe-area-inset-*))
   计算并写入 :root；此处仅作 fallback。 */
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}

/* ====== 沉浸式状态栏：让顶部 hero 留出状态栏高度 ======
   WebView 已延伸到状态栏下方（FLAG_LAYOUT_NO_LIMITS / setDecorFitsSystemWindows(false)），
   所以我们需要给：
     1) .hero（导航栏）— 加 top padding，避免被状态栏遮挡
     2) .page — 加左右 padding，避免被手势条/导航条遮挡
     3) body — 保持背景色延伸到顶部 */
body {
  background: var(--bg);
  /* 防止在沉浸式下底部出现白条（导航条透明后仍要画背景） */
  background-attachment: fixed;
  /* 底部安全区 */
  padding-bottom: var(--safe-bottom);
  padding-left: var(--safe-left);
  padding-right: var(--safe-right);
}

/* hero（导航栏）自身需要顶部 padding，避开状态栏 */
.hero {
  margin-top: var(--safe-top);
  /* 替代原来的 sticky top:12px，改为可计算的安全距离 */
  top: var(--safe-top);
}

/* log-modal、custom-modal、dpi-modal、chat-lightbox、msg-action-menu 也要避开状态栏 */
.log-modal,
.custom-modal,
.dpi-modal,
.chat-lightbox,
.chat-video-lightbox,
.msg-action-menu {
  /* 这些是全屏模态，顶部不需 padding（背景已铺满到顶部） */
}

/* 在 600px 以下的小屏，hero 的 padding 还需要更紧凑 */
@media (max-width: 600px) {
  .hero {
    border-radius: 16px;
    padding: 8px 10px;
  }
  .hero .theme-toggle,
  .hero .icon-btn {
    width: 34px;
    height: 34px;
  }
}

/* ====== 暗色模式下状态栏图标变白（由 Java 端控制） ======
   下面这条规则仅作 fallback，真实场景下 Java 已经在
   WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS 切了。 */
html.dark {
  /* 让浏览器知道：当前背景是深色，状态栏应切白图标 */
  color-scheme: dark;
}
html:not(.dark) {
  color-scheme: light;
}

/* ====== 沉浸式下 hero 玻璃效果稍微调整 ====== */
.hero {
  /* 沉浸式下，hero 顶部留出状态栏后，整体看上去更"悬浮" */
  margin-top: max(var(--safe-top), 6px);
  margin-left: max(var(--safe-left), 0px);
  margin-right: max(var(--safe-right), 0px);
}

/* 任何 fixed 在顶部的元素都要避开状态栏 */
.global-copy-toast,
.plugin-toast {
  top: calc(80px + var(--safe-top));
}
@media (max-width: 600px) {
  .global-copy-toast,
  .plugin-toast {
    top: calc(72px + var(--safe-top));
  }
}
`;
    document.head.appendChild(__styleEl);

    // ---------- 注入页面结构（原 index.html 的 <body> 内容） ----------
    document.body.innerHTML = `
<div class="page">
  <section class="hero glass">
    <div class="brand-area" id="brandArea">
      <!-- 顺序：主题切换 → 日志 → 复制插件 → 添加服务器 → 重置排序 → DPI → 自动展开 → 公共聊天 → 在线成员 -->
      <button id="themeToggleBtn" class="theme-toggle" title="切换浅色/深色主题">🌙</button>
      <button id="openLogModalBtn" class="icon-btn" title="查看运行日志">💻</button>
      <button id="openAddModalBtn" class="icon-btn" title="添加自定义服务器">➕</button>
      <button id="resetOrderBtn" class="icon-btn" title="恢复默认排序">🔄</button>
      <button id="dpiToggleBtn" class="icon-btn" title="调节界面缩放 (DPI)">🔍</button>
      <button id="manualUpdateBtn" class="icon-btn" title="点击检查并更新前后端">⬆️</button>
      <button id="toggleAutoExpandBtn" class="icon-btn" title="切换自动展开房间">📂</button>
      <button id="openPublicChatBtn" class="icon-btn public-chat-btn" title="公共聊天">
        <span class="public-chat-icon">💬</span>
        <span id="publicUnreadBadge" class="online-count-badge zero">0</span>
      </button>
      <button id="onlineMembersBtn" class="icon-btn online-members-btn" title="在线成员">
        <span class="online-icon">👥</span>
        <span id="onlineCountBadge" class="online-count-badge">0</span>
      </button>
      <button id="copyPluginBtn" class="icon-btn" title="点击下载最新版联机插件">🎮</button>
    </div>
    <div class="scan">
      <i id="netDot" class="dot" title="检测网络连接中..."></i>
    </div>
  </section>

  <!-- 在线成员模态框 -->
  <div id="onlineMembersModal" class="custom-modal">
    <div class="custom-modal-box" style="width:min(400px,calc(100% - 32px));">
      <div class="custom-modal-header">
        <span>👥 在线成员 <span id="onlineMembersTitleCount" style="color:var(--cyan);font-weight:700;">(0)</span></span>
        <button id="closeOnlineMembersBtn" class="custom-modal-close">✕</button>
      </div>
      <div class="custom-modal-body" style="padding:12px 16px 16px;">
        <div id="onlineMembersList" class="online-members-list">
          <div class="online-members-empty">暂无在线成员</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 公共聊天模态框 -->
  <div id="publicChatModal" class="custom-modal">
    <div class="custom-modal-box" style="width:min(500px,calc(100% - 32px));">
      <div class="custom-modal-header">
        <span>💬 公共聊天</span>
        <button id="closePublicChatBtn" class="custom-modal-close">✕</button>
      </div>
      <div class="custom-modal-body">
        <div id="publicChatMessages" style="height:300px;overflow-y:auto;background:var(--card);border-radius:12px;padding:12px;margin-bottom:12px;display:flex;flex-direction:column;gap:4px;border:1px solid var(--line);">
          <div style="color:var(--muted);text-align:center;padding:20px;font-size:14px;">暂无消息</div>
        </div>
        <div class="chat-input-area">
          <div class="chat-plus-wrap">
            <button type="button" id="publicChatPlusBtn" class="chat-plus-btn" title="添加附件">＋</button>
            <div id="publicChatPlusPanel" class="chat-plus-panel">
              <button type="button" data-plus-action="image">🖼️ 图片</button>
              <button type="button" data-plus-action="video">🎬 视频</button>
              <button type="button" data-plus-action="file">📎 文件</button>
            </div>
          </div>
          <textarea id="publicChatInput" rows="1" placeholder="输入公共消息..." style="flex:1;min-width:120px;padding:8px 14px;border-radius:20px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:14px;outline:none;resize:none;overflow-y:hidden;line-height:1.45;max-height:120px;"></textarea>
          <button type="button" id="publicChatVoiceBtn" class="chat-voice-btn" title="录制语音">🎤</button>
          <button id="publicChatSendBtn" style="padding:8px 20px;border:0;border-radius:20px;background:var(--cyan);color:#fff;font-weight:700;cursor:pointer;transition:var(--transition);">发送</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 日志模态框 -->
  <div id="logModal" class="log-modal">
    <div class="log-box">
      <div class="log-header">
        <span>🖥️ 实时运行日志</span>
        <button id="closeLogBtn" class="log-close">✕</button>
      </div>
      <div id="logContent" class="log-content">正在加载日志...</div>
    </div>
  </div>

  <!-- 添加服务器模态框 -->
  <div id="addServerModal" class="custom-modal">
    <div class="custom-modal-box">
      <div class="custom-modal-header">
        <span>➕ 添加自定义服务器</span>
        <button id="closeAddModalBtn" class="custom-modal-close">✕</button>
      </div>
      <div class="custom-modal-body">
        <form id="addServerForm" class="form-grid">
          <div class="form-row">
            <input type="text" id="addId" placeholder="服务器ID (可选，不填自动生成)" pattern="[A-Za-z0-9_ -]{1,64}" title="仅允许字母、数字、下划线、空格和连字符，长度1-64">
          </div>
          <div class="form-row">
            <input type="text" id="addName" placeholder="服务器名称 (必填)" required>
          </div>
          <div class="form-row">
            <input type="text" id="addHost" placeholder="主机地址 (例如: example.com 或 IP)" required>
          </div>
          <div class="form-row-group">
            <input type="number" id="addPort" value="11451" placeholder="端口" required>
            <select id="addType">
              <option value="graphql">GraphQL</option>
              <option value="rest">REST</option>
            </select>
          </div>
          <div class="form-row">
            <input type="text" id="addRegion" placeholder="地区标签 (例如: 🇨🇳 中国 上海，不填默认 🌐 未知)">
          </div>
          <button type="submit" class="submit-btn">
            <span class="spinner"></span>
            <span class="btn-text">立即添加并保存</span>
          </button>
        </form>
      </div>
    </div>
  </div>

  <!-- 删除确认模态框 -->
  <div id="deleteConfirmModal" class="custom-modal">
    <div class="custom-modal-box" style="width:min(380px,calc(100% - 32px));">
      <div class="custom-modal-header">
        <span>⚠️ 确认删除</span>
        <button id="closeDeleteModalBtn" class="custom-modal-close">✕</button>
      </div>
      <div class="custom-modal-body">
        <p id="deleteConfirmText" style="margin:0 0 20px;font-size:14px;color:var(--ink);line-height:1.6;"></p>
        <div style="display:flex;gap:10px;">
          <button id="deleteCancelBtn" style="flex:1;border:0;border-radius:12px;padding:11px;background:rgba(125,175,210,.15);color:var(--ink);font-weight:700;cursor:pointer;font-size:14px;transition:var(--transition);">取消</button>
          <button id="deleteConfirmBtn" style="flex:1;border:0;border-radius:12px;padding:11px;background:var(--red);color:#fff;font-weight:800;cursor:pointer;font-size:14px;transition:var(--transition);display:inline-flex;align-items:center;justify-content:center;gap:6px;">确认删除</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 恢复默认排序模态框 -->
  <div id="resetOrderModal" class="custom-modal">
    <div class="custom-modal-box" style="width:min(380px,calc(100% - 32px));">
      <div class="custom-modal-header">
        <span>🔄 恢复默认排序</span>
        <button id="closeResetModalBtn" class="custom-modal-close">✕</button>
      </div>
      <div class="custom-modal-body">
        <p style="margin:0 0 20px;font-size:14px;color:var(--ink);line-height:1.6;">确定要恢复默认排序吗？服务器卡片与导航栏图标的自定义排序将被清除。</p>
        <div style="display:flex;gap:10px;">
          <button id="resetCancelBtn" style="flex:1;border:0;border-radius:12px;padding:11px;background:rgba(125,175,210,.15);color:var(--ink);font-weight:700;cursor:pointer;font-size:14px;transition:var(--transition);">取消</button>
          <button id="resetConfirmBtn" style="flex:1;border:0;border-radius:12px;padding:11px;background:var(--cyan);color:#fff;font-weight:800;cursor:pointer;font-size:14px;transition:var(--transition);display:inline-flex;align-items:center;justify-content:center;gap:6px;">确认恢复</button>
        </div>
      </div>
    </div>
  </div>

  <!-- DPI 调节模态框 -->
  <div id="dpiModal" class="dpi-modal">
    <div class="dpi-modal-box">
      <div class="dpi-modal-header">
        <span>🔍 缩放调节</span>
        <button id="closeDpiModalBtn" class="dpi-modal-close">✕</button>
      </div>
      <div class="dpi-modal-body">
        <div class="dpi-slider-container">
          <span id="dpiLabel">100%</span>
          <input type="range" id="dpiSlider" min="60" max="150" value="100" step="5">
          <button id="dpiResetBtn" class="dpi-reset-btn">恢复默认 (100%)</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 手动更新前后端模态框 -->
  <div id="updateModal" class="custom-modal">
    <div class="custom-modal-box" style="width:min(420px,calc(100% - 32px));">
      <div class="custom-modal-header">
        <span>⬆️ 手动远程更新</span>
        <button id="closeUpdateModalBtn" class="custom-modal-close">✕</button>
      </div>
      <div class="custom-modal-body" style="display:grid;gap:12px;">
        <p style="margin:0;color:var(--muted);font-size:13px;line-height:1.6;">对比本地与远程哈希值，哈希一致则跳过更新。更新完成后请重启应用。</p>
        <div id="updateStatus" style="display:grid;gap:8px;"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button id="updateFrontendBtn" style="border:0;border-radius:12px;padding:11px;background:var(--cyan);color:#fff;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;">🖼️ 更新前端</button>
          <button id="updateBackendBtn" style="border:0;border-radius:12px;padding:11px;background:#1a73c0;color:#fff;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;">⚙️ 更新后端</button>
        </div>
        <button id="updateAllBtn" style="border:0;border-radius:12px;padding:11px;background:linear-gradient(135deg,#19c8ae,#1a73c0);color:#fff;font-weight:800;cursor:pointer;">⬆️ 一键更新前后端</button>

      </div>
    </div>
  </div>

  <!-- 统计概览 -->
  <div class="overview" id="overview">
    <div class="ov-card servers"><span>在线服务器</span><b id="ovServers">—</b></div>
    <div class="ov-card online"><span>总在线</span><b id="ovOnline">—</b></div>
    <div class="ov-card idle"><span>空闲</span><b id="ovIdle">—</b></div>
    <div class="ov-card rooms"><span>总房间</span><b id="ovRooms">—</b></div>
  </div>

  <div class="filters" id="filters"></div>
  <div class="server-list" id="serverList">
    <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
  </div>
</div>
`;

    // ---------- 按需加载 GoEasy SDK（原 <head> 中的 goeasy.min.js） ----------
    function ensureGoEasySdk(cb) {
      if (typeof GoEasy !== 'undefined') { if (typeof cb === 'function') cb(); return; }
      const __sdkEl = document.createElement('script');
      __sdkEl.src = 'https://cdn.goeasy.io/goeasy-2.13.3.min.js';
      __sdkEl.onload = function () { if (typeof cb === 'function') cb(); };
      __sdkEl.onerror = function () { if (typeof cb === 'function') cb(); };
      document.head.appendChild(__sdkEl);
    }



  document.addEventListener('contextmenu', (e) => {
    // 始终阻止浏览器原生右键/长按菜单
    e.preventDefault();
    // 如果在气泡内，也阻止视频/音频/图片的默认长按行为
    if (e.target.closest('.chat-msg')) {
      e.stopPropagation();
    }
  });
  document.addEventListener('selectstart', (e) => e.preventDefault());

  const CHAT_STORAGE_KEY = 'lanplay_chat_messages';
  const PUBLIC_STORAGE_KEY = 'lanplay_public_messages';
  const USERNAME_KEY = 'lan_play_username';
  const USER_ID_KEY = 'lan_play_user_id';
  const UNREAD_STORAGE_KEY = 'lanplay_unread_status';
  const PUBLIC_UNREAD_KEY = 'lanplay_public_unread';
  const AUTO_EXPAND_KEY = 'lan_play_auto_expand';
  const HISTORY_LIMIT = 30;

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
    userId: '',
    pendingAttachments: {},
    publicModalOpen: false,
    frozenCardId: null,
    unreadStatus: {},
    autoExpand: false,
    onlineMembers: [],
    onlineCount: 0,
    presenceReady: false,
  };

  // 自动展开默认关闭；首次升级时清理旧版本默认写入的 true。
  const AUTO_EXPAND_DEFAULT_VERSION_KEY = 'lan_play_auto_expand_default_v2';
  const savedAuto = localStorage.getItem(AUTO_EXPAND_KEY);
  const autoExpandDefaultMigrated = localStorage.getItem(AUTO_EXPAND_DEFAULT_VERSION_KEY) === '1';
  if (!autoExpandDefaultMigrated) {
    state.autoExpand = false;
    localStorage.setItem(AUTO_EXPAND_KEY, 'false');
    localStorage.setItem(AUTO_EXPAND_DEFAULT_VERSION_KEY, '1');
  } else if (savedAuto !== null) {
    state.autoExpand = savedAuto === 'true';
  } else {
    state.autoExpand = false;
    localStorage.setItem(AUTO_EXPAND_KEY, 'false');
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

  // ===== 主题切换（已修复：单例 + 实时同步状态栏） =====
  const themeToggleBtn = $('themeToggleBtn');
  const htmlEl = document.documentElement;
  // savedTheme 逻辑已由顶部 setupSystemThemeAndImmersive 接管，这里只做兼容兜底
  const __savedThemeCompat = localStorage.getItem('lan_play_theme');
  if (__savedThemeCompat) {
    if (__savedThemeCompat === 'dark') { htmlEl.classList.add('dark'); htmlEl.classList.remove('light'); }
    else if (__savedThemeCompat === 'light') { htmlEl.classList.add('light'); htmlEl.classList.remove('dark'); }
  }

  function _syncStatusBarFromDom(isDark) {
    try {
      if (window.LanPlayNative && typeof window.LanPlayNative.syncPageTheme === 'function') {
        window.LanPlayNative.syncPageTheme(isDark);
      }
    } catch(e){}
  }

  // 全局暴露，供顶部 IIFE 调用（避免 ReferenceError）
  window.updateThemeColor = window.updateThemeColor || function() {
    const isDark = htmlEl.classList.contains('dark');
    const color = isDark ? '#0f1923' : '#dff3ff';
    // 清理旧 meta
    document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.appendChild(meta);
    const iosMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (iosMeta) iosMeta.content = isDark ? 'black-translucent' : 'default';
    _syncStatusBarFromDom(isDark);
  };

  function updateThemeColor() { return window.updateThemeColor(); }

  window.updateThemeIcon = window.updateThemeIcon || function() {
    const manual = localStorage.getItem('lan_play_theme');
    const isDark = htmlEl.classList.contains('dark') || (!manual && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (themeToggleBtn) themeToggleBtn.textContent = isDark ? '🌞' : '🌙';
  };

  function updateThemeIcon() { return window.updateThemeIcon(); }

  // 初始化图标与颜色（会同步状态栏）
  updateThemeIcon();
  updateThemeColor();

  // 滚动时不再反复重设 theme-color，避免频繁触发 WebView 重绘导致状态栏闪烁
  // 如需动态切换，可保留但节流
  let scrollColorTimer = null;
  document.addEventListener('scroll', () => {
    if (scrollColorTimer) cancelAnimationFrame(scrollColorTimer);
    scrollColorTimer = requestAnimationFrame(() => {
      // 仅在系统跟随模式下才更新，避免覆盖手动主题
      if (!localStorage.getItem('lan_play_theme')) {
        updateThemeColor();
      }
      scrollColorTimer = null;
    });
  }, { passive: true });

  // 【关键修复】移除底部重复的 click 监听，主题切换已由顶部 IIFE 的三态循环接管。
  // 这里只保留一个保险监听：如果顶部监听因 DOM 时序未绑定，则由本处接管并同步状态栏。
  // 使用 {once:false} 但通过标记避免重复执行。
  if (themeToggleBtn && !themeToggleBtn.dataset.__fixedBound) {
    themeToggleBtn.dataset.__fixedBound = '1';
    // 不再在此处 addEventListener('click', ...) 切换主题，
    // 仅确保如果顶部 IIFE 未生效时，点一下仍能同步状态栏。
    // 顶部 IIFE 的监听已在 DOMContentLoaded 时绑定，这里不再重复。
  }

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

  // ===== 插件链接下载 =====
  // 改为点击直接调用内置下载器下载（_builtInDownload 会自动探测扩展名）
  const PLUGIN_DOWNLOAD_URL = 'https://www.tomodachilife.cn/downloads/ldn-mitm/latest';
  // 已知该 URL 永远返回 application/zip 压缩包
  // 提前写好 .zip 后缀，避免 HEAD 请求被 CORS/中间件拦截时丢失扩展名
  const PLUGIN_DOWNLOAD_NAME = 'ldn-mitm-latest.zip';
  function downloadPlugin() {
    _builtInDownload(PLUGIN_DOWNLOAD_URL, PLUGIN_DOWNLOAD_NAME, false);
  }
  $('copyPluginBtn').addEventListener('click', downloadPlugin);

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


  // ===== 导航栏图标长按拖动排序 =====
  const NAV_ORDER_KEY = 'lan_play_nav_order';
  const DEFAULT_NAV_ORDER = [
    'themeToggleBtn',
    'openLogModalBtn',
    'openAddModalBtn',
    'resetOrderBtn',
    'dpiToggleBtn',
    'manualUpdateBtn',
    'toggleAutoExpandBtn',
    'openPublicChatBtn',
    'onlineMembersBtn',
    'copyPluginBtn',
  ];

  function applyNavOrder(order) {
    const area = document.getElementById('brandArea');
    if (!area || !Array.isArray(order) || !order.length) return;
    const map = {};
    [...area.children].forEach(el => {
      if (el.id) map[el.id] = el;
    });
    order.forEach(id => {
      if (map[id]) {
        area.appendChild(map[id]);
        delete map[id];
      }
    });
    // 未在保存列表中的图标（新版本新增）追加到末尾，保持相对稳定
    Object.keys(map).forEach(id => area.appendChild(map[id]));
  }

  function saveNavOrder() {
    const area = document.getElementById('brandArea');
    if (!area) return;
    const ids = [...area.children].map(el => el.id).filter(Boolean);
    try { localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(ids)); } catch (e) { /* ignore */ }
  }

  function loadNavOrder() {
    try {
      const raw = localStorage.getItem(NAV_ORDER_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) applyNavOrder(arr);
    } catch (e) { /* ignore */ }
  }

  function resetNavOrder() {
    try { localStorage.removeItem(NAV_ORDER_KEY); } catch (e) { /* ignore */ }
    applyNavOrder(DEFAULT_NAV_ORDER);
  }

  function initNavIconReorder() {
    const area = document.getElementById('brandArea');
    if (!area || area.dataset.navDragBound === '1') return;
    area.dataset.navDragBound = '1';

    let dragEl = null;
    let longPressTimer = null;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let suppressClick = false;
    let activePointerId = null;
    let ghostEl = null;
    let lastX = 0;
    let lastY = 0;

    function clearTimer() {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    function clearDragOver() {
      area.querySelectorAll('.nav-drag-over').forEach(el => el.classList.remove('nav-drag-over'));
    }

    function removeGhost() {
      if (ghostEl) {
        try { ghostEl.remove(); } catch (_) { /* ignore */ }
        ghostEl = null;
      }
    }

    function moveGhost(x, y) {
      if (!ghostEl) return;
      ghostEl.style.left = x + 'px';
      ghostEl.style.top = y + 'px';
    }

    function createGhost(btn, x, y) {
      removeGhost();
      const g = document.createElement('div');
      g.className = 'nav-drag-ghost';
      // 只复制可见图标文字/emoji，避免角标干扰
      const icon =
        btn.querySelector('.public-chat-icon, .online-icon') ||
        null;
      g.textContent = icon ? icon.textContent.trim() : (btn.textContent || '').trim().charAt(0) || '•';
      // 若按钮本身就是 emoji（无子 span），取完整文本首个非空白
      if (!icon) {
        const t = (btn.childNodes && btn.childNodes.length)
          ? [...btn.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('')
          : '';
        if (t) g.textContent = t;
        else if (btn.firstChild && btn.firstChild.nodeType === 3) g.textContent = btn.firstChild.textContent.trim();
        else {
          // 回退：去掉角标数字后的文本
          const clone = btn.cloneNode(true);
          clone.querySelectorAll('.online-count-badge, #publicUnreadBadge, #onlineCountBadge').forEach(n => n.remove());
          g.textContent = (clone.textContent || '•').trim() || '•';
        }
      }
      g.style.left = x + 'px';
      g.style.top = y + 'px';
      document.body.appendChild(g);
      ghostEl = g;
    }

    function endDragVisual() {
      clearDragOver();
      if (dragEl) dragEl.classList.remove('nav-dragging');
      area.classList.remove('nav-reordering');
      removeGhost();
    }

    function getBtnFromPoint(x, y) {
      // 拖影 pointer-events:none，可直接取下方元素
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const btn = el.closest('#brandArea > button');
      return (btn && area.contains(btn)) ? btn : null;
    }

    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      const btn = e.target.closest('#brandArea > button');
      if (!btn || !area.contains(btn)) return;
      activePointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      dragging = false;
      dragEl = null;
      clearTimer();
      longPressTimer = setTimeout(() => {
        dragging = true;
        dragEl = btn;
        btn.classList.add('nav-dragging');
        area.classList.add('nav-reordering');
        createGhost(btn, lastX, lastY);
        try {
          if (btn.setPointerCapture && activePointerId != null) {
            btn.setPointerCapture(activePointerId);
          }
        } catch (_) { /* ignore */ }
        try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) { /* ignore */ }
      }, 420);
    }

    function onPointerMove(e) {
      if (activePointerId != null && e.pointerId !== activePointerId) return;
      lastX = e.clientX;
      lastY = e.clientY;
      if (!dragging) {
        if (longPressTimer) {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          if (dx * dx + dy * dy > 64) clearTimer();
        }
        return;
      }
      e.preventDefault();
      moveGhost(e.clientX, e.clientY);
      clearDragOver();
      const over = getBtnFromPoint(e.clientX, e.clientY);
      if (over && over !== dragEl) over.classList.add('nav-drag-over');
    }

    function onPointerUp(e) {
      if (activePointerId != null && e.pointerId !== activePointerId) return;
      clearTimer();
      if (!dragging || !dragEl) {
        dragging = false;
        dragEl = null;
        activePointerId = null;
        endDragVisual();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 50);

      const x = e.clientX, y = e.clientY;
      const over = getBtnFromPoint(x, y);
      if (over && over !== dragEl && area.contains(over)) {
        const children = [...area.children];
        const di = children.indexOf(dragEl);
        const ti = children.indexOf(over);
        if (di >= 0 && ti >= 0) {
          if (di < ti) area.insertBefore(dragEl, over.nextSibling);
          else area.insertBefore(dragEl, over);
          saveNavOrder();
        }
      }
      endDragVisual();
      dragging = false;
      dragEl = null;
      activePointerId = null;
    }

    function onPointerCancel(e) {
      if (activePointerId != null && e.pointerId !== activePointerId) return;
      clearTimer();
      endDragVisual();
      dragging = false;
      dragEl = null;
      activePointerId = null;
    }

    area.addEventListener('pointerdown', onPointerDown);
    area.addEventListener('pointermove', onPointerMove, { passive: false });
    area.addEventListener('pointerup', onPointerUp);
    area.addEventListener('pointercancel', onPointerCancel);
    // 拖拽结束后吞掉一次 click，避免误触打开功能
    area.addEventListener('click', (e) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);

    loadNavOrder();
  }

  initNavIconReorder();

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
      localStorage.removeItem(NAV_ORDER_KEY);
      resetNavOrder();
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

  // QQ 风格：两条消息间隔超过 5 分钟则插入时间分割线
  const CHAT_TIME_GAP_MS = 5 * 60 * 1000;

  function shouldShowTimeDivider(prevTs, currTs) {
    if (prevTs == null || currTs == null) return true;
    const a = Number(prevTs);
    const b = Number(currTs);
    if (!a || !b || isNaN(a) || isNaN(b)) return true;
    return Math.abs(b - a) >= CHAT_TIME_GAP_MS;
  }

  function formatChatTime(timestamp) {
    const d = new Date(Number(timestamp) || Date.now());
    const h = d.getHours();
    let period;
    if (h < 6) period = '凌晨';
    else if (h < 9) period = '早上';
    else if (h < 12) period = '上午';
    else if (h < 14) period = '中午';
    else if (h < 19) period = '下午';
    else period = '晚上';
    const hour12 = h % 12 || 12;
    return period + ' ' + hour12 + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function buildChatMessagesHtml(messages) {
    if (!messages || !messages.length) return '';
    let html = '';
    let prevTime = null;
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const t = msg.time || 0;
      if (shouldShowTimeDivider(prevTime, t)) {
        html += `<div class="chat-time-divider"><span>${esc(formatMessageTime(t))}</span></div>`;
      }
      prevTime = t;
      const cls = msg.isMine ? 'chat-msg-mine' : 'chat-msg-other';
      const sender = msg.senderName || msg.sender || '匿名';
      const contentHtml = renderMessageContent(msg);
      const mediaType = msg.mediaType || '';
      const url = msg.url || '';
      let downloadHtml = '';
      // 图片/视频直接走 COS CDN；文件/语音走后端代理绕过 COS 下载限制
      if (url && mediaType === 'image') {
        downloadHtml = `<a class="chat-media-download" href="${esc(url)}" download="${esc(msg.fileName || 'image')}" target="_blank" rel="noopener noreferrer">下载图片</a>`;
      } else if (url && mediaType === 'video') {
        downloadHtml = `<a class="chat-media-download" href="${esc(url)}" download="${esc(msg.fileName || 'video')}" target="_blank" rel="noopener noreferrer">下载视频</a>`;
      } else if (url && mediaType === 'file') {
        if (_isXorMsg(msg)) {
          downloadHtml = `<a class="chat-media-download" data-xor-url="${esc(url)}" data-xor-name="${esc(msg.fileName || '文件')}" data-xor-mime="${esc(msg.mimeType || '')}">下载文件</a>`;
        } else {
          downloadHtml = `<a class="chat-media-download" href="${esc(url)}" download="${esc(msg.fileName || '文件')}" target="_blank" rel="noopener noreferrer">下载文件</a>`;
        }
      } else if (url && mediaType === 'audio') {
        if (_isXorMsg(msg)) {
          downloadHtml = `<a class="chat-media-download" data-xor-url="${esc(url)}" data-xor-name="${esc(msg.fileName || '语音')}" data-xor-mime="${esc(msg.mimeType || 'audio/mpeg')}">下载语音</a>`;
        } else {
          downloadHtml = `<a class="chat-media-download" href="${esc(url)}" download="${esc(msg.fileName || '语音')}" target="_blank" rel="noopener noreferrer">下载语音</a>`;
        }
      }
      html += `<div class="chat-msg ${cls}" data-msg-id="${esc(msg.id || '')}">
        <div class="msg-content">
          <strong class="msg-sender">${esc(sender)}：</strong>
          <div class="msg-body">${contentHtml}</div>
          <div class="msg-footer"><span class="msg-time">${esc(formatChatTime(t))}</span>${downloadHtml}</div>
        </div>
      </div>`;
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
    div.addEventListener('dragstart', e => {
      // 聊天消息内（尤其是图片）长按不能启动服务器卡片拖拽，否则卡片会停留在 opacity:.4 的灰色状态。
      const target = e.target;
      if (target && target.closest && target.closest('.chat-msg')) {
        e.preventDefault();
        e.stopPropagation();
        div.classList.remove('dragging');
        draggedEl = null;
        return;
      }
      draggedEl = div;
      div.classList.add('dragging');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
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
  // 使用公共聊天频道做在线状态，所有已连上聊天的用户都会出现在列表中
  const PRESENCE_CHANNEL = 'public_chat';
  let goEasyInitTimer = null;
  let presenceRefreshTimer = null;

  let usernameModalInstance = null;

  function getStoredUsername() { return localStorage.getItem(USERNAME_KEY) || ''; }
  function getStoredUserId() {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) { id = 'u_' + generateMsgId(); localStorage.setItem(USER_ID_KEY, id); }
    return id;
  }

  // ---- 消息持久化 ----
  function loadChatMessages() {
    try {
      const data = localStorage.getItem(CHAT_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'object' && parsed !== null) {
          // 过滤掉已删除的消息
          const filtered = {};
          Object.keys(parsed).forEach(k => {
            const msgs = parsed[k];
            if (Array.isArray(msgs)) {
              filtered[k] = msgs.filter(m => !_deletedMsgIds.has(m.id));
            } else {
              filtered[k] = msgs;
            }
          });
          state.chatMessages = filtered;
          return;
        }
      }
    } catch (e) { /* ignore */ }
    state.chatMessages = {};
  }

  function saveChatMessages() {
    try {
      // 保存前再清理一次已删除消息
      const cleaned = {};
      Object.keys(state.chatMessages).forEach(k => {
        const msgs = state.chatMessages[k];
        if (Array.isArray(msgs)) {
          cleaned[k] = msgs.filter(m => !_deletedMsgIds.has(m.id));
        } else {
          cleaned[k] = msgs;
        }
      });
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(cleaned));
    } catch (e) { /* ignore */ }
  }

  function loadPublicMessages() {
    try {
      const data = localStorage.getItem(PUBLIC_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          // 过滤掉已删除的消息
          state.publicMessages = parsed.filter(m => !_deletedMsgIds.has(m.id));
          return;
        }
      }
    } catch (e) { /* ignore */ }
    state.publicMessages = [];
  }

  function savePublicMessages() {
    try {
      const cleaned = (state.publicMessages || []).filter(m => !_deletedMsgIds.has(m.id));
      localStorage.setItem(PUBLIC_STORAGE_KEY, JSON.stringify(cleaned));
    } catch (e) { /* ignore */ }
  }

  function updateAllMessagesIsMine() {
    const currentUser = state.username;
    Object.keys(state.chatMessages).forEach(serverId => {
      const msgs = state.chatMessages[serverId];
      if (msgs) {
        msgs.forEach(msg => {
          msg.isMine = (msg.senderId && msg.senderId === state.userId) || msg.sender === currentUser || msg.sender === state.userId;
        });
        renderChatMessages(serverId, false);
      }
    });
    if (state.publicMessages) {
      state.publicMessages.forEach(msg => {
        msg.isMine = (msg.senderId && msg.senderId === state.userId) || msg.sender === currentUser || msg.sender === state.userId;
      });
      renderPublicChat(false);
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

  // ===== 文件上传（腾讯云 COS，经后端 /api/upload） =====
  function formatFileSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
    return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  function detectMediaTypeFromFile(file) {
    const t = (file && file.type || '').toLowerCase();
    const name = (file && file.name || '').toLowerCase();
    if (t.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(name)) return 'image';
    if (t.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(name)) return 'video';
    if (t.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|amr|opus)$/i.test(name)) return 'audio';
    return 'file';
  }

  // 上传进度 Toast（0–100%）
  // 0~89%: 上传到服务器；90~99%: 存入云存储；100%: 完成
  var _cosSimTimer = null; // COS 阶段模拟进度定时器
  function showUploadProgress(percent) {
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    if (p >= 100) {
      // 上传全部完成（含 COS）
      showToast('✅ 上传成功', 1500, true);
    } else if (p >= 90) {
      showToast('⏳ 存入云存储 ' + p + '%', 60000, true);
    } else {
      showToast('⏳ 上传中 ' + p + '%', 60000, true);
    }
  }
  // 浏览器上传完成后，模拟 COS 存储进度 90%→99%
  var _cosSimLastP = -1; // 上次显示的整数百分比，避免重复
  function _startCosSimProgress() {
    _stopCosSimProgress();
    var cosP = 90;
    _cosSimLastP = 90;
    showUploadProgress(90);
    _cosSimTimer = setInterval(function () {
      if (cosP >= 99) { _stopCosSimProgress(); return; }
      // 越接近 99% 越慢，模拟真实上传感
      var step = cosP < 94 ? 1 : (cosP < 97 ? 0.7 : 0.4);
      cosP = Math.min(99, cosP + step);
      var rp = Math.round(cosP);
      if (rp !== _cosSimLastP) { _cosSimLastP = rp; showUploadProgress(rp); }
    }, 600);
  }
  function _stopCosSimProgress() {
    if (_cosSimTimer) { clearInterval(_cosSimTimer); _cosSimTimer = null; }
  }

  // 腾讯 COS 屏蔽下载的文件后缀（COS 检测文件内容，改文件名无效）
  const _cosBlockedExts = ['apk', 'ipa', 'exe', 'msi', 'bat', 'cmd', 'ps1', 'vbs', 'scr', 'dll', 'sys'];
  function _isCosBlockedExt(name) {
    const n = (name || '').toLowerCase();
    return _cosBlockedExts.some(ext => n.endsWith('.' + ext));
  }

  // ===== XOR 加密：绕过 COS 文件内容检测 =====
  // 上传前 XOR 加密 → COS 无法识别文件格式 → 下载时 XOR 解密还原
  const _XOR_KEY = 0x5A;
  // 判断消息是否为 XOR 加密文件：优先用 isXor 标志，兜底检测 URL/.dlp 后缀
  function _isXorMsg(msg) {
    if (msg.isXor) return true;
    const url = msg.url || '';
    if (url.toLowerCase().endsWith('.dlp')) return true;
    return false;
  }
  function _xorBuffer(buf) {
    const arr = new Uint8Array(buf);
    for (let i = 0; i < arr.length; i++) arr[i] ^= _XOR_KEY;
    return arr.buffer;
  }
  async function _xorEncryptFile(file) {
    const buf = await file.arrayBuffer();
    _xorBuffer(buf);
    const safeName = file.name + '.dlp';
    return new File([buf], safeName, { type: 'application/octet-stream' });
  }
  // ===== 内置下载器：由 Python 后端直接保存到 Android 公共 Download 目录 =====
  const BUILTIN_DOWNLOAD_DIR = '/storage/emulated/0/Download';
  let _downloadRequestId = 0;

  // 已知文件扩展名白名单（用于无后缀 URL 的扩展名推断）
  // 完整列表太长，这里只放最常见、命中率最高的几个
  const _KNOWN_FILE_EXTS = new Set([
    'zip','rar','7z','tar','gz','bz2','xz',
    'exe','msi','apk','ipa','dmg','pkg','deb','rpm',
    'pdf','doc','docx','xls','xlsx','ppt','pptx',
    'jpg','jpeg','png','gif','bmp','webp','svg','ico','tiff',
    'mp3','wav','flac','aac','ogg','m4a','opus',
    'mp4','mkv','avi','mov','wmv','flv','webm','m4v','ts',
    'iso','img','bin','dat',
    'txt','md','json','xml','csv','log',
    'apk.dlp','dlp'
  ]);

  // 根据 MIME 或 URL 末段推断扩展名
  // 优先用 Content-Type,失败再用 URL 末段,都没有返回 null
  function _inferFileExtension(url, mimeType) {
    // 1. 从 MIME 推断
    if (mimeType) {
      const m = String(mimeType).toLowerCase().split(';')[0].trim();
      const mimeMap = {
        'application/zip': '.zip',
        'application/x-zip-compressed': '.zip',
        'application/x-rar-compressed': '.rar',
        'application/x-7z-compressed': '.7z',
        'application/x-tar': '.tar',
        'application/gzip': '.gz',
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'application/vnd.ms-powerpoint': '.ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
        'application/octet-stream': null, // 不可靠,继续尝试 URL
        'application/x-apk': '.apk',
        'application/vnd.android.package-archive': '.apk',
        'application/x-iso9660-image': '.iso',
        'application/x-msdownload': '.exe',
        'application/x-deb': '.deb',
        'application/x-rpm': '.rpm',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
        'image/x-icon': '.ico',
        'image/bmp': '.bmp',
        'audio/mpeg': '.mp3',
        'audio/mp3': '.mp3',
        'audio/wav': '.wav',
        'audio/x-wav': '.wav',
        'audio/flac': '.flac',
        'audio/aac': '.aac',
        'audio/ogg': '.ogg',
        'audio/x-m4a': '.m4a',
        'audio/mp4': '.m4a',
        'audio/opus': '.opus',
        'video/mp4': '.mp4',
        'video/x-matroska': '.mkv',
        'video/x-msvideo': '.avi',
        'video/quicktime': '.mov',
        'video/webm': '.webm',
        'text/plain': '.txt',
        'text/markdown': '.md',
        'application/json': '.json',
        'application/xml': '.xml',
        'text/xml': '.xml',
        'text/csv': '.csv',
      };
      if (m in mimeMap) return mimeMap[m]; // 可能是 null(继续 URL 推断)
    }
    // 2. 从 URL 末段推断
    try {
      const u = new URL(url, window.location.href);
      const pathname = u.pathname || '';
      const lastSlash = pathname.lastIndexOf('/');
      const lastSeg = lastSlash >= 0 ? pathname.substring(lastSlash + 1) : pathname;
      // 去掉查询参数(已由 URL 解析隔离)
      const dotIdx = lastSeg.lastIndexOf('.');
      if (dotIdx > 0 && dotIdx < lastSeg.length - 1) {
        const ext = lastSeg.substring(dotIdx).toLowerCase();
        if (ext.length <= 6 && /^\.[a-z0-9.]+$/.test(ext)) {
          return ext;
        }
      }
      // 2.1 末段是常见下载入口关键字时兜底为 .zip
      // 例如 https://xxx.com/downloads/ldn-mitm/latest 这种 "latest" 端点
      // 多数服务器都会返回 zip 压缩包，这样即使 HEAD 请求被 CORS/中间件拦截
      // 也能保证保存的文件有正确的扩展名
      const lastSegLower = lastSeg.toLowerCase();
      if (lastSegLower === 'latest' || lastSegLower === 'download' || lastSegLower === 'dl' || lastSegLower === 'setup') {
        return '.zip';
      }
    } catch (_) { /* URL 解析失败 */ }
    return null;
  }

  // 推断 URL 内容类型(文件 / 网站)
  // 返回 { type: 'file'|'web'|'unknown', ext?: string, mimeHint?: string }
  function _classifyLink(url) {
    if (!url) return { type: 'unknown' };
    const cleaned = String(url).trim();
    // 1. 明显的文件扩展名 → 文件
    try {
      const u = new URL(cleaned, window.location.href);
      const pathname = u.pathname || '';
      const lastSlash = pathname.lastIndexOf('/');
      const lastSeg = lastSlash >= 0 ? pathname.substring(lastSlash + 1) : pathname;
      const dotIdx = lastSeg.lastIndexOf('.');
      if (dotIdx > 0 && dotIdx < lastSeg.length - 1) {
        const ext = lastSeg.substring(dotIdx + 1).toLowerCase();
        if (ext.length <= 6 && /^[a-z0-9]+$/.test(ext) && _KNOWN_FILE_EXTS.has(ext)) {
          return { type: 'file', ext: '.' + ext };
        }
      }
    } catch (_) { /* ignore */ }
    // 2. 域名/IP/无扩展名路径 → 网站
    return { type: 'web' };
  }

  // 显示"在系统 WebView 中查看 / 用外部浏览器打开"选择弹窗
  function _showLinkOpenChooser(url) {
    return new Promise((resolve) => {
      // 移除旧弹窗
      const old = document.getElementById('linkOpenChooser');
      if (old) old.remove();

      const overlay = document.createElement('div');
      overlay.id = 'linkOpenChooser';
      overlay.className = 'msg-action-menu open';
      // 显示域名
      let displayHost = url;
      try { displayHost = new URL(url, window.location.href).host || url; } catch (_) {}
      // 截断过长 host
      if (displayHost.length > 40) displayHost = displayHost.substring(0, 38) + '…';

      overlay.innerHTML =
        '<div class="msg-action-mask"></div>' +
        '<div class="link-open-sheet" style="position:relative;z-index:1;width:min(320px,calc(100% - 32px));background:var(--white);border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:hidden;">' +
          '<div style="padding:18px 18px 8px;text-align:center;">' +
            '<div style="font-size:14px;color:var(--muted);margin-bottom:8px;">🔗 打开链接</div>' +
            '<div style="font-size:13px;font-weight:700;color:var(--ink);word-break:break-all;line-height:1.4;">' + esc(displayHost) + '</div>' +
          '</div>' +
          '<div style="padding:8px 12px 12px;display:flex;flex-direction:column;gap:8px;">' +
            '<button type="button" data-action="webview" ' +
              'style="width:100%;border:0;border-radius:14px;padding:14px;background:linear-gradient(135deg,var(--cyan),#14a891);color:#fff;font-weight:800;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">' +
              '<span style="font-size:18px;">🌐</span>' +
              '<span>在系统 WebView 中打开</span>' +
            '</button>' +
            '<button type="button" data-action="external" ' +
              'style="width:100%;border:0;border-radius:14px;padding:14px;background:rgba(125,175,210,.15);color:var(--ink);font-weight:800;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">' +
              '<span style="font-size:18px;">🚀</span>' +
              '<span>用外部浏览器打开</span>' +
            '</button>' +
            '<button type="button" data-action="cancel" ' +
              'style="width:100%;border:0;border-radius:14px;padding:10px;background:transparent;color:var(--muted);font-weight:600;font-size:13px;cursor:pointer;margin-top:2px;">' +
              '取消' +
            '</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(overlay);

      let resolved = false;
      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        document.removeEventListener('keydown', onKey, true);
        if (overlay.parentElement) overlay.remove();
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { cleanup(); resolve(null); }
      };

      overlay.querySelector('.msg-action-mask').addEventListener('click', () => {
        cleanup(); resolve(null);
      });
      overlay.querySelector('[data-action="webview"]').addEventListener('click', () => {
        cleanup(); resolve('webview');
      });
      overlay.querySelector('[data-action="external"]').addEventListener('click', () => {
        cleanup(); resolve('external');
      });
      overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        cleanup(); resolve(null);
      });
      document.addEventListener('keydown', onKey, true);
    });
  }

  // 调用原生 Intent 打开外部浏览器(绕开 WebView intent:// 包装 bug) - 已修复：检测 Java 返回值
  function _openExternalBrowser(url) {
    try {
      if (window.LanPlayNative && typeof window.LanPlayNative.openExternalBrowser === 'function') {
        const ok = window.LanPlayNative.openExternalBrowser(String(url));
        if (ok === false) {
          console.warn('[外部浏览器] Java 端拒绝:', url);
          try { window.open(String(url), '_blank', 'noopener'); return true; } catch (_) {}
          return false;
        }
        return true;
      }
    } catch (e) { console.warn('[外部浏览器] Java 桥接调用失败', e); }
    try { window.open(String(url), '_blank', 'noopener'); return true; } catch (_) {}
    return false;
  }

  // 内置下载器:由 Python 后端直接保存到 Android 公共 Download 目录
  // 自动追加后缀:若 fileName 没有扩展名,先用 HEAD 请求拿 Content-Type,再用 URL 末段/Content-Type 推断补上
  async function _builtInDownload(url, fileName, isXor) {
    if (!url) return false;
    const requestId = ++_downloadRequestId;
    let displayName = (fileName || '').trim() || '文件';
    let mimeHint = '';

    // 智能追加扩展名:无后缀时探测
    try {
      const hasExt = /\.[a-z0-9]{1,6}(?:\.[a-z0-9]{1,6})?$/i.test(displayName);
      if (!hasExt) {
        // 1. 先 HEAD 拿 Content-Type
        let headMime = '';
        try {
          const headRes = await fetch(String(url), { method: 'HEAD', cache: 'no-store' });
          headMime = headRes.headers.get('content-type') || '';
          // 一些服务器对 HEAD 返回 octet-stream,这种不可靠,继续走 URL 推断
        } catch (_) { /* HEAD 失败,继续 */ }

        // 2. 推断扩展名
        const ext = _inferFileExtension(String(url), headMime || mimeHint);
        if (ext) {
          displayName = displayName + ext;
          console.log('[下载] 自动追加扩展名:', ext, '→', displayName);
        }
      }
    } catch (e) {
      console.warn('[下载] 扩展名推断失败,继续使用原文件名:', e);
    }

    // 不使用省略号结尾，完整显示文件名
    showToast('⏳ 正在下载文件 ' + displayName, 60000, true);
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          url: String(url),
          filename: String(displayName),
          xor: !!isXor,
        }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || ('下载失败 (' + response.status + ')'));
      const savedPath = data.file_path || ((data.directory || BUILTIN_DOWNLOAD_DIR) + '/' + (data.file_name || displayName));
      // 显示完整保存路径，不使用省略号截断
      showToast('✅ 已保存到 ' + savedPath, 3600, true);
      return true;
    } catch (e) {
      // 后端不可用时不再打开浏览器下载，避免文件落到未知目录。
      showToast('❌ 下载失败：' + (e && e.message ? e.message : e), 3500, false);
      return false;
    } finally {
      // 保留 requestId，便于后续扩展下载队列/进度显示。
      void requestId;
    }
  }

  // XOR 文件由后端边下载边解密，直接落盘为原始文件名。
  async function _xorDecryptAndDownload(url, originalName, mimeType) {
    void mimeType;
    return _builtInDownload(url, originalName, true);
  }

  function uploadFile(file) {
    if (!file) return Promise.resolve(null);
    return new Promise((resolve) => {
      const formData = new FormData();
      // 如果文件后缀被 COS 屏蔽下载，XOR 加密文件内容让 COS 无法识别格式
      // 例: Arena_1.0.0.apk → XOR 加密 → 上传为 Arena_1.0.0.apk.dlp
      const originalName = file.name || 'file';
      const isBlocked = _isCosBlockedExt(originalName);
      // blocked 文件：XOR 加密后上传；普通文件：原样上传
      const encryptPromise = isBlocked ? _xorEncryptFile(file) : Promise.resolve(file);
      encryptPromise.then(fileToUpload => {
        formData.append('file', fileToUpload, fileToUpload.name);
        _doUpload(formData, file, originalName, isBlocked, resolve);
      });
      return; // 不走下面的直接 upload
    });
  }
  function _doUpload(formData, file, originalName, isBlocked, resolve) {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.timeout = 600000;  // 10 分钟，大文件上传需要更长时间
      // 两阶段进度：浏览器→服务器(0~89%) + 服务器→COS(90~100%)
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable && e.total > 0) {
          showUploadProgress((e.loaded / e.total) * 89);
        } else {
          showUploadProgress(Math.min(89, (e.loaded / Math.max(file.size, 1)) * 89));
        }
      };
      xhr.upload.onloadstart = function () {
        showUploadProgress(0);
      };
      // 浏览器上传完成，服务器正在存入 COS → 模拟 90%→99% 进度
      xhr.upload.onload = function () {
        _startCosSimProgress();
      };
      xhr.onerror = function () {
        _stopCosSimProgress();
        showToast('❌ 上传失败：网络错误', 3000, false);
        resolve(null);
      };
      xhr.ontimeout = function () {
        _stopCosSimProgress();
        showToast('❌ 上传超时', 3000, false);
        resolve(null);
      };
      xhr.onload = function () {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300 && data.ok && data.url) {
            _stopCosSimProgress();
            showUploadProgress(100);
            const fileType = data.file_type || detectMediaTypeFromFile(file);
            // fileName 始终返回原始文件名，下载时用原始名保存
            // isXor 标记：下载时需 XOR 解密还原
            resolve({
              url: data.url,
              type: fileType,
              fileName: originalName,
              fileSize: data.file_size != null ? data.file_size : (file.size || 0),
              mimeType: data.mime_type || file.type || '',
              isXor: isBlocked
            });
            return;
          }
          throw new Error((data && data.error) || ('上传失败 (' + xhr.status + ')'));
        } catch (e) {
          _stopCosSimProgress();
          showToast('❌ 上传失败：' + e.message, 3000, false);
          console.error('上传错误:', e);
          resolve(null);
        }
      };
      xhr.send(formData);
  }

  function buildMediaText(meta) {
    // 兼容旧客户端：前缀 + URL；额外字段走 mediaType/url/fileName/fileSize
    const type = meta.type || 'file';
    const url = meta.url || '';
    if (type === 'image') return '[图片]' + url;
    if (type === 'video') return '[视频]' + url;
    if (type === 'audio') return '[语音]' + url;
    return '[文件]' + url + '|' + (meta.fileName || 'file') + '|' + (meta.fileSize || 0);
  }

  // ---- 待发送附件（支持多文件队列） ----
  function _pendingList(key) {
    if (!Array.isArray(state.pendingAttachments[key])) state.pendingAttachments[key] = [];
    return state.pendingAttachments[key];
  }
  function _renderPendingUI(key, input) {
    const area = input && input.closest('.chat-input-area');
    if (!area) return;
    let el = area.querySelector('.chat-pending');
    const list = state.pendingAttachments[key];
    const arr = Array.isArray(list) ? list : (list ? [list] : []);
    if (!arr.length) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'chat-pending'; area.insertBefore(el, area.firstChild); }
    if (arr.length === 1) {
      const m = arr[0];
      el.innerHTML = `<span class="chat-pending-name">📎 ${esc(m.fileName || ({image:'图片',video:'视频',audio:'语音'}[m.mediaType] || '文件'))}</span><button type="button" aria-label="取消附件">×</button>`;
    } else {
      el.innerHTML = `<span class="chat-pending-name">📎 ${arr.length} 个附件待发送</span><button type="button" aria-label="取消全部附件">×</button>`;
    }
    el.querySelector('button').onclick = () => { delete state.pendingAttachments[key]; el.remove(); };
  }
  function setPendingAttachment(key, media, input) {
    const list = _pendingList(key);
    list.push(media);
    _renderPendingUI(key, input);
  }
  function clearPendingAttachment(key, input) {
    delete state.pendingAttachments[key];
    const area = input && input.closest('.chat-input-area');
    const el = area && area.querySelector('.chat-pending');
    if (el) el.remove();
  }
  function sendPendingAttachment(key, input, isPublic, serverId) {
    const list = state.pendingAttachments[key];
    const arr = Array.isArray(list) ? list : (list ? [list] : []);
    if (!arr.length) return false;
    // 逐条发送
    arr.forEach(media => {
      if (isPublic) sendPublicMessage(media.text, media);
      else sendChatMessage(serverId, media.text, media);
    });
    clearPendingAttachment(key, input);
    return true;
  }
  function storeRecordedVoice(file, key, isPublic) {
    uploadFile(file).then(result => {
      if (!result) return;
      result.type = 'audio';
      const media = { mediaType:'audio', url:result.url, fileName:result.fileName || '语音消息', fileSize:result.fileSize, mimeType:result.mimeType,
        text:buildMediaText({type:'audio',url:result.url,fileName:result.fileName,fileSize:result.fileSize}) };
      const input = isPublic ? document.getElementById('publicChatInput') : document.querySelector(`.server-group[data-id="${key}"] .chat-input`);
      setPendingAttachment(key, media, input);
      showToast('🎙 语音已准备好，请点击“发送”', 1800, true);
    });
  }

  function sendMessageWithMedia(serverId, inputElement, sendFunction, isPublic, accept) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = accept || 'image/*,video/*,audio/*,*/*';
    fileInput.multiple = true;
    fileInput.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      // 过滤超限文件
      const oversized = files.filter(f => f.size > 200 * 1024 * 1024);
      const valid = files.filter(f => f.size <= 200 * 1024 * 1024);
      if (oversized.length) {
        showToast('❌ ' + oversized.length + ' 个文件超过 200MB 已跳过', 2500, false);
      }
      if (!valid.length) return;

      // 逐个上传，全部加入待发送队列，点「发送」才发出
      const key = isPublic ? 'public' : serverId;
      showToast('⏳ 正在上传 ' + valid.length + ' 个文件…', 60000, true);
      let successCount = 0;
      let failCount = 0;
      for (let i = 0; i < valid.length; i++) {
        const result = await uploadFile(valid[i]);
        if (!result) { failCount++; continue; }
        const media = {
          mediaType: result.type,
          url: result.url,
          fileName: result.fileName,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
          text: buildMediaText(result)
        };
        setPendingAttachment(key, media, inputElement);
        successCount++;
      }
      if (failCount > 0) {
        showToast('✅ ' + successCount + ' 个附件已准备好，❌ ' + failCount + ' 个上传失败', 2500, false);
      } else {
        showToast('📎 ' + successCount + ' 个附件已准备好，请点击“发送”', 1800, true);
      }
      if (inputElement) inputElement.focus();
    };
    fileInput.click();
  }

  // ---------- 「+」附件菜单：图片 / 视频 / 文件 ----------
  function closeAllPlusPanels(except) {
    document.querySelectorAll('.chat-plus-panel.open').forEach(function (el) {
      if (except && el === except) return;
      el.classList.remove('open');
    });
  }

  function bindPlusMenu(plusBtn, panel, handlers) {
    if (!plusBtn || !panel) return;
    plusBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      const willOpen = !panel.classList.contains('open');
      closeAllPlusPanels();
      if (willOpen) panel.classList.add('open');
    });
    panel.querySelectorAll('[data-plus-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        panel.classList.remove('open');
        const action = btn.getAttribute('data-plus-action');
        if (action === 'image' && handlers.image) handlers.image();
        else if (action === 'video' && handlers.video) handlers.video();
        else if (action === 'file' && handlers.file) handlers.file();
      });
    });
  }

  if (!window.__chatPlusGlobalBound) {
    window.__chatPlusGlobalBound = true;
    document.addEventListener('click', function () {
      closeAllPlusPanels();
    });
  }

  // ---------- 语音录制（发送按钮左侧） ----------
  const _voiceRecordState = {
    recorder: null,
    stream: null,
    timer: null,
    startedAt: 0,
    activeBtn: null,
    audioContext: null,
    source: null,
    processor: null,
    silentGain: null,
    wavChunks: [],
    wavSampleRate: 44100,
    onBlob: null,
    stopping: false,
    cancelled: false,
  };

  function stopVoiceTracks() {
    if (_voiceRecordState.stream) {
      try {
        _voiceRecordState.stream.getTracks().forEach(function (t) { t.stop(); });
      } catch (e) { /* ignore */ }
      _voiceRecordState.stream = null;
    }
  }

  function resetVoiceBtn(btn) {
    if (!btn) return;
    btn.classList.remove('recording');
    btn.removeAttribute('data-recording-seconds');
    btn.textContent = '🎤';
    btn.title = '按住或点击录制语音';
  }

  function _disconnectVoiceGraph() {
    const state = _voiceRecordState;
    if (state.processor) {
      state.processor.onaudioprocess = null;
      try { state.processor.disconnect(); } catch (_) { /* ignore */ }
    }
    if (state.source) {
      try { state.source.disconnect(); } catch (_) { /* ignore */ }
    }
    if (state.silentGain) {
      try { state.silentGain.disconnect(); } catch (_) { /* ignore */ }
    }
    state.processor = null;
    state.source = null;
    state.silentGain = null;
    if (state.audioContext) {
      try { state.audioContext.close(); } catch (_) { /* ignore */ }
      state.audioContext = null;
    }
  }

  function _writeWavString(view, offset, value) {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  }

  function _makeWavBlob(chunks, sampleRate) {
    const totalSamples = chunks.reduce(function (sum, chunk) { return sum + chunk.length; }, 0);
    const dataSize = totalSamples * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    _writeWavString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    _writeWavString(view, 8, 'WAVE');
    _writeWavString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);       // PCM fmt chunk size
    view.setUint16(20, 1, true);        // PCM
    view.setUint16(22, 1, true);        // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true);        // block align
    view.setUint16(34, 16, true);       // bits per sample
    _writeWavString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    let offset = 44;
    chunks.forEach(function (chunk) {
      for (let i = 0; i < chunk.length; i++) {
        view.setInt16(offset, chunk[i], true);
        offset += 2;
      }
    });
    return new Blob([buffer], { type: 'audio/wav' });
  }

  async function _stopWavRecording() {
    const state = _voiceRecordState;
    const recorder = state.recorder;
    if (!recorder || state.stopping) return;
    state.stopping = true;
    recorder.state = 'stopping';
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }

    const cancelled = state.cancelled;
    if (state.processor) {
      state.processor.onaudioprocess = null;
      try { state.processor.disconnect(); } catch (_) { /* ignore */ }
    }
    stopVoiceTracks();
    _disconnectVoiceGraph();

    const chunks = state.wavChunks.slice();
    const sampleRate = state.wavSampleRate || 44100;
    const btn = state.activeBtn;
    const onBlob = state.onBlob;
    state.recorder = null;
    state.wavChunks = [];
    state.wavSampleRate = 44100;
    state.onBlob = null;
    state.stopping = false;
    state.cancelled = false;
    resetVoiceBtn(btn);
    state.activeBtn = null;

    if (cancelled) return;
    if (!chunks.length) {
      showToast('⚠️ 未录到声音', 1800, false);
      return;
    }
    const blob = _makeWavBlob(chunks, sampleRate);
    if (blob.size < 256) {
      showToast('⚠️ 录音太短', 1800, false);
      return;
    }
    const file = new File([blob], 'voice_' + Date.now() + '.wav', { type: 'audio/wav' });
    if (typeof onBlob === 'function') onBlob(file);
  }

  function cancelVoiceRecording() {
    const state = _voiceRecordState;
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    if (state.recorder && state.recorder.state !== 'inactive' && !state.stopping) {
      state.cancelled = true;
      try { state.recorder.stop(); } catch (_) { _disconnectVoiceGraph(); }
      return;
    }
    state.recorder = null;
    state.wavChunks = [];
    state.wavSampleRate = 44100;
    state.onBlob = null;
    stopVoiceTracks();
    _disconnectVoiceGraph();
    resetVoiceBtn(state.activeBtn);
    state.activeBtn = null;
  }

  async function startVoiceRecording(btn, onBlob) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('❌ 当前环境不支持录音', 2500, false);
      return;
    }
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      showToast('❌ 当前环境不支持 WAV 录音', 3000, false);
      return;
    }
    // 已在录制：再次点击 → 停止并发送 WAV
    if (_voiceRecordState.recorder && _voiceRecordState.recorder.state === 'recording') {
      finishVoiceRecording(onBlob);
      return;
    }
    cancelVoiceRecording();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const audioContext = new AudioContextCtor();
      if (audioContext.resume) await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor
        ? audioContext.createScriptProcessor(4096, 1, 1)
        : audioContext.createJavaScriptNode(4096, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      _voiceRecordState.stream = stream;
      _voiceRecordState.audioContext = audioContext;
      _voiceRecordState.source = source;
      _voiceRecordState.processor = processor;
      _voiceRecordState.silentGain = silentGain;
      _voiceRecordState.wavChunks = [];
      _voiceRecordState.wavSampleRate = Math.round(audioContext.sampleRate || 44100);
      _voiceRecordState.onBlob = onBlob;
      _voiceRecordState.cancelled = false;
      _voiceRecordState.stopping = false;
      _voiceRecordState.activeBtn = btn;
      _voiceRecordState.startedAt = Date.now();

      processor.onaudioprocess = function (event) {
        if (_voiceRecordState.cancelled) return;
        const input = event.inputBuffer.getChannelData(0);
        const samples = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const sample = Math.max(-1, Math.min(1, input[i]));
          samples[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
        _voiceRecordState.wavChunks.push(samples);
      };
      source.connect(processor);
      // 静音输出保证 ScriptProcessor 在 Android WebView 中持续工作，避免麦克风回放啸叫。
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      _voiceRecordState.recorder = {
        state: 'recording',
        stop: function () { _stopWavRecording(); },
      };
      btn.classList.add('recording');
      btn.textContent = '⏹';
      btn.dataset.recordingSeconds = '0';
      btn.title = '点击停止并发送 WAV 语音';
      showToast('🎙 正在录制 WAV… 再次点击停止发送', 2000, true);
      _voiceRecordState.timer = setInterval(function () {
        const sec = Math.floor((Date.now() - _voiceRecordState.startedAt) / 1000);
        btn.textContent = '⏹';
        btn.dataset.recordingSeconds = String(sec);
        btn.title = '点击停止并发送 WAV 语音（' + sec + ' 秒）';
        if (sec >= 60) finishVoiceRecording(onBlob);
      }, 500);
    } catch (e) {
      console.warn('WAV 录音失败', e);
      cancelVoiceRecording();
      showToast('❌ 无法录制 WAV：' + (e.message || '请检查录音权限'), 3500, false);
    }
  }

  function finishVoiceRecording(onBlob) {
    const recorder = _voiceRecordState.recorder;
    if (!recorder || recorder.state === 'inactive' || recorder.state === 'stopping') {
      cancelVoiceRecording();
      return;
    }
    _voiceRecordState.onBlob = onBlob || _voiceRecordState.onBlob;
    try { recorder.stop(); } catch (e) { cancelVoiceRecording(); }
  }

  // 语音上传后进入待发送状态，由发送按钮统一发送。

  // ---- 链接识别（URL、域名、IPv4、IPv6）- 不追加协议头 ----
  // 根据 URL 末段扩展名判断是文件还是网站,给 chat-link 加 data-type
  function linkifyText(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?|\b(?:(?:[0-9]{1,3}\.){3}[0-9]{1,3}|(?:[0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}|::[0-9a-fA-F]{1,4}|[0-9a-fA-F]{1,4}::)\b)/g;
    return text.replace(urlRegex, function(match) {
      const cleaned = match.replace(/[.,;:!?]+$/, '');
      const cls = _classifyLink(cleaned);
      return `<span class="chat-link" data-url="${esc(cleaned)}" data-type="${cls.type}">${esc(match)}</span>`;
    });
  }

  // 从旧版文本前缀解析媒体信息
  // 去掉 .dlp 后缀（XOR 加密文件上传时追加的）
  function _restoreBlockedExt(name) {
    if (typeof name !== 'string') return name;
    return name.replace(/\.dlp$/i, '');
  }

  function parseMediaFromText(text) {
    if (!text || typeof text !== 'string') return null;
    if (text.startsWith('[图片]')) {
      return { mediaType: 'image', url: text.substring(4).trim(), fileName: '', fileSize: 0 };
    }
    if (text.startsWith('[视频]')) {
      return { mediaType: 'video', url: text.substring(4).trim(), fileName: '', fileSize: 0 };
    }
    if (text.startsWith('[语音]')) {
      return { mediaType: 'audio', url: text.substring(4).trim(), fileName: '语音', fileSize: 0 };
    }
    if (text.startsWith('[文件]')) {
      const rest = text.substring(4);
      const parts = rest.split('|');
      const rawName = parts[1] || '文件';
      // .dlp 后缀表示 XOR 加密文件，先判断再去掉后缀。
      const isXor = rawName.toLowerCase().endsWith('.dlp');
      const fname = _restoreBlockedExt(rawName);
      return {
        mediaType: 'file',
        url: (parts[0] || '').trim(),
        fileName: fname,
        fileSize: parseInt(parts[2], 10) || 0,
        isXor: isXor
      };
    }
    return null;
  }

  // ===== 图片预览：鼠标滚轮 / 双击缩放，拖拽平移，移动端双指缩放 =====
  const _imageLightboxState = {
    overlay: null,
    stage: null,
    img: null,
    scale: 1,
    minScale: 1,
    maxScale: 4,
    x: 0,
    y: 0,
    baseWidth: 0,
    baseHeight: 0,
    pointers: new Map(),
    dragPointerId: null,
    dragStartX: 0,
    dragStartY: 0,
    dragOriginX: 0,
    dragOriginY: 0,
    pinching: false,
    pinchStartDistance: 0,
    pinchStartScale: 1,
    pinchAnchorX: 0,
    pinchAnchorY: 0,
    moved: false,
  };

  const _videoLightboxState = {
    overlay: null,
    stage: null,
    video: null,
    pendingStartTime: 0,
  };

  function _clampPreview(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function _getImageStageCenter() {
    const s = _imageLightboxState;
    const rect = s.stage.getBoundingClientRect();
    return {
      rect,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function _updateImageLightboxTransform() {
    const s = _imageLightboxState;
    if (!s.img) return;
    s.img.style.transform = `translate3d(-50%, -50%, 0) translate3d(${s.x}px, ${s.y}px, 0) scale(${s.scale})`;
  }

  function _clampImageLightboxPan() {
    const s = _imageLightboxState;
    if (!s.stage || !s.baseWidth || !s.baseHeight) return;
    const rect = s.stage.getBoundingClientRect();
    // 图片缩小时不允许被拖出视口；放大后允许平移到图片边缘。
    const maxX = Math.max(0, (s.baseWidth * s.scale - rect.width) / 2);
    const maxY = Math.max(0, (s.baseHeight * s.scale - rect.height) / 2);
    s.x = _clampPreview(s.x, -maxX, maxX);
    s.y = _clampPreview(s.y, -maxY, maxY);
  }

  function _imagePointAt(clientX, clientY) {
    const s = _imageLightboxState;
    const center = _getImageStageCenter();
    return {
      x: (clientX - center.x - s.x) / s.scale,
      y: (clientY - center.y - s.y) / s.scale,
    };
  }

  function _fitImageLightbox() {
    const s = _imageLightboxState;
    if (!s.img || !s.stage) return;
    const naturalWidth = s.img.naturalWidth || 0;
    const naturalHeight = s.img.naturalHeight || 0;
    if (!naturalWidth || !naturalHeight) return;

    const rect = s.stage.getBoundingClientRect();
    const availableWidth = Math.max(1, rect.width - 32);
    const availableHeight = Math.max(1, rect.height - 64);
    const fitScale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
    s.baseWidth = Math.max(1, Math.round(naturalWidth * fitScale));
    s.baseHeight = Math.max(1, Math.round(naturalHeight * fitScale));
    s.img.style.width = s.baseWidth + 'px';
    s.img.style.height = s.baseHeight + 'px';
    s.scale = s.minScale;
    s.x = 0;
    s.y = 0;
    s.moved = false;
    _updateImageLightboxTransform();
  }

  function _setImageLightboxScaleAt(clientX, clientY, nextScale) {
    const s = _imageLightboxState;
    if (!s.stage || !s.baseWidth) return;
    const imagePoint = _imagePointAt(clientX, clientY);
    s.scale = _clampPreview(nextScale, s.minScale, s.maxScale);
    const center = _getImageStageCenter();
    s.x = clientX - center.x - imagePoint.x * s.scale;
    s.y = clientY - center.y - imagePoint.y * s.scale;
    _clampImageLightboxPan();
    _updateImageLightboxTransform();
  }

  function _getPointerPair() {
    const s = _imageLightboxState;
    return Array.from(s.pointers.values()).slice(0, 2);
  }

  function _pointerDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function _pointerCenter(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function _beginImagePinch() {
    const s = _imageLightboxState;
    const pair = _getPointerPair();
    if (pair.length < 2) return;
    const center = _pointerCenter(pair[0], pair[1]);
    s.pinching = true;
    s.dragPointerId = null;
    s.pinchStartDistance = Math.max(1, _pointerDistance(pair[0], pair[1]));
    s.pinchStartScale = s.scale;
    const imagePoint = _imagePointAt(center.x, center.y);
    s.pinchAnchorX = imagePoint.x;
    s.pinchAnchorY = imagePoint.y;
  }

  function _onImagePointerDown(e) {
    const s = _imageLightboxState;
    if (!s.overlay || !s.overlay.classList.contains('open')) return;
    if (e.target && e.target.closest && e.target.closest('.chat-lightbox-close')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    s.pointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }

    if (s.pointers.size >= 2) {
      _beginImagePinch();
    } else {
      s.pinching = false;
      s.dragPointerId = e.pointerId;
      s.dragStartX = e.clientX;
      s.dragStartY = e.clientY;
      s.dragOriginX = s.x;
      s.dragOriginY = s.y;
      s.moved = false;
      if (s.img) s.img.classList.add('is-dragging');
    }
    e.preventDefault();
  }

  function _onImagePointerMove(e) {
    const s = _imageLightboxState;
    if (!s.pointers.has(e.pointerId)) return;
    s.pointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

    if (s.pointers.size >= 2) {
      if (!s.pinching) _beginImagePinch();
      const pair = _getPointerPair();
      const center = _pointerCenter(pair[0], pair[1]);
      const distance = Math.max(1, _pointerDistance(pair[0], pair[1]));
      const nextScale = _clampPreview(
        s.pinchStartScale * distance / Math.max(1, s.pinchStartDistance),
        s.minScale,
        s.maxScale
      );
      const stageCenter = _getImageStageCenter();
      s.scale = nextScale;
      s.x = center.x - stageCenter.x - s.pinchAnchorX * nextScale;
      s.y = center.y - stageCenter.y - s.pinchAnchorY * nextScale;
      s.moved = true;
      _clampImageLightboxPan();
      _updateImageLightboxTransform();
      e.preventDefault();
      return;
    }

    if (!s.pinching && s.dragPointerId === e.pointerId) {
      const dx = e.clientX - s.dragStartX;
      const dy = e.clientY - s.dragStartY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) s.moved = true;
      s.x = s.dragOriginX + dx;
      s.y = s.dragOriginY + dy;
      _clampImageLightboxPan();
      _updateImageLightboxTransform();
      if (s.moved) e.preventDefault();
    }
  }

  function _onImagePointerUp(e) {
    const s = _imageLightboxState;
    s.pointers.delete(e.pointerId);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }

    if (s.pointers.size >= 2) {
      _beginImagePinch();
    } else if (s.pinching) {
      s.pinching = false;
      const remaining = _getPointerPair()[0];
      if (remaining) {
        s.dragPointerId = remaining.id;
        s.dragStartX = remaining.x;
        s.dragStartY = remaining.y;
        s.dragOriginX = s.x;
        s.dragOriginY = s.y;
      } else {
        s.dragPointerId = null;
      }
    } else if (s.dragPointerId === e.pointerId) {
      s.dragPointerId = null;
    }
    if (!s.pointers.size && s.img) s.img.classList.remove('is-dragging');
  }

  function _closeImageLightbox() {
    const s = _imageLightboxState;
    if (!s.overlay) return;
    s.overlay.classList.remove('open');
    s.pointers.clear();
    s.dragPointerId = null;
    s.pinching = false;
    if (s.img) s.img.classList.remove('is-dragging');
  }

  function _ensureImageLightbox() {
    const s = _imageLightboxState;
    if (s.overlay) return s;
    const overlay = document.createElement('div');
    overlay.id = 'chatImageLightbox';
    overlay.className = 'chat-lightbox';
    overlay.innerHTML = '<div class="chat-lightbox-stage"><img class="chat-lightbox-img" alt="预览" draggable="false"><button type="button" class="chat-lightbox-close" aria-label="关闭">✕</button></div>';
    document.body.appendChild(overlay);
    s.overlay = overlay;
    s.stage = overlay.querySelector('.chat-lightbox-stage');
    s.img = overlay.querySelector('.chat-lightbox-img');
    const closeBtn = overlay.querySelector('.chat-lightbox-close');

    s.img.addEventListener('load', function () {
      if (s.overlay.classList.contains('open')) _fitImageLightbox();
    });
    s.stage.addEventListener('wheel', function (e) {
      if (!s.overlay.classList.contains('open')) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      _setImageLightboxScaleAt(e.clientX, e.clientY, s.scale * factor);
    }, { passive: false });
    s.stage.addEventListener('pointerdown', _onImagePointerDown, { passive: false });
    s.stage.addEventListener('pointermove', _onImagePointerMove, { passive: false });
    s.stage.addEventListener('pointerup', _onImagePointerUp, { passive: true });
    s.stage.addEventListener('pointercancel', _onImagePointerUp, { passive: true });
    s.stage.addEventListener('lostpointercapture', function (e) {
      if (s.pointers.has(e.pointerId)) _onImagePointerUp(e);
    });
    s.stage.addEventListener('dblclick', function (e) {
      if (e.target !== s.img) return;
      e.preventDefault();
      const next = s.scale > s.minScale + 0.05 ? s.minScale : 2;
      _setImageLightboxScaleAt(e.clientX, e.clientY, next);
    });
    s.stage.addEventListener('click', function (e) {
      const wasMoved = s.moved;
      s.moved = false;
      if (e.target === s.stage && !wasMoved) _closeImageLightbox();
    });
    closeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      _closeImageLightbox();
    });
    return s;
  }

  function openImageLightbox(url) {
    if (!url) return;
    const s = _ensureImageLightbox();
    s.overlay.classList.add('open');
    s.pointers.clear();
    s.dragPointerId = null;
    s.pinching = false;
    s.scale = s.minScale;
    s.x = 0;
    s.y = 0;
    s.moved = false;
    s.img.style.width = '';
    s.img.style.height = '';
    if (s.img.getAttribute('src') !== url) s.img.src = url;
    if (s.img.complete && s.img.naturalWidth) _fitImageLightbox();
  }

  function _videoControlsHTML() {
    return '<button type="button" class="chat-video-control-btn chat-video-play-toggle" aria-label="播放或暂停">▶</button>' +
      '<span class="chat-video-time chat-video-current">0:00</span>' +
      '<input class="chat-video-progress" type="range" min="0" max="100" value="0" step="0.1" aria-label="视频进度">' +
      '<span class="chat-video-time chat-video-duration">0:00</span>' +
      '<button type="button" class="chat-video-control-btn chat-video-mute-toggle" aria-label="静音">🔊</button>' +
      '<button type="button" class="chat-video-control-btn chat-video-fullscreen-toggle" aria-label="全屏播放">⛶</button>';
  }

  function _closeVideoLightbox() {
    const s = _videoLightboxState;
    if (!s.overlay) return;
    s.overlay.classList.remove('open');
    if (s.video) {
      s.video.pause();
      s.video.onloadedmetadata = null;
      s.video.removeAttribute('src');
      s.video.load();
    }
  }

  function _ensureVideoLightbox() {
    const s = _videoLightboxState;
    if (s.overlay) return s;
    const overlay = document.createElement('div');
    overlay.id = 'chatVideoLightbox';
    overlay.className = 'chat-video-lightbox';
    overlay.innerHTML =
      '<div class="chat-video-lightbox-stage">' +
        '<div class="chat-video-player chat-video-lightbox-player">' +
          '<video class="chat-lightbox-video" playsinline="true" webkit-playsinline="true" preload="metadata"></video>' +
          '<button type="button" class="chat-video-center-play" aria-label="播放视频">▶</button>' +
          '<div class="chat-video-controls">' + _videoControlsHTML() + '</div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="chat-lightbox-close chat-video-lightbox-close" aria-label="关闭">✕</button>';
    document.body.appendChild(overlay);
    s.overlay = overlay;
    s.stage = overlay.querySelector('.chat-video-lightbox-stage');
    s.video = overlay.querySelector('.chat-lightbox-video');
    const closeBtn = overlay.querySelector('.chat-video-lightbox-close');

    s.stage.addEventListener('click', function (e) {
      if (e.target === s.stage) _closeVideoLightbox();
    });
    s.video.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
    closeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      _closeVideoLightbox();
    });
    return s;
  }

  function openVideoLightbox(url, startTime) {
    if (!url) return;
    const s = _ensureVideoLightbox();
    s.pendingStartTime = Number.isFinite(Number(startTime)) ? Math.max(0, Number(startTime)) : 0;
    s.overlay.classList.add('open');
    s.video.onloadedmetadata = function () {
      if (s.pendingStartTime > 0 && isFinite(s.video.duration)) {
        s.video.currentTime = Math.min(s.pendingStartTime, Math.max(0, s.video.duration - 0.05));
      }
      _syncCustomVideoUI(s.video);
      const playPromise = s.video.play();
      if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
    };
    s.video.src = url;
    s.video.load();
    _syncCustomVideoUI(s.video);
    const immediatePlay = s.video.play();
    if (immediatePlay && typeof immediatePlay.catch === 'function') immediatePlay.catch(() => {});
  }

  document.addEventListener('keydown', function (e) {
    const imageOpen = _imageLightboxState.overlay && _imageLightboxState.overlay.classList.contains('open');
    const videoOpen = _videoLightboxState.overlay && _videoLightboxState.overlay.classList.contains('open');
    if (e.key === 'Escape') {
      if (imageOpen) _closeImageLightbox();
      if (videoOpen) _closeVideoLightbox();
      return;
    }
    if (imageOpen && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '0')) {
      e.preventDefault();
      const center = _getImageStageCenter();
      if (e.key === '0') _setImageLightboxScaleAt(center.x, center.y, 1);
      else _setImageLightboxScaleAt(center.x, center.y, _imageLightboxState.scale * (e.key === '-' ? 0.8 : 1.25));
    }
  });

  window.addEventListener('resize', function () {
    if (_imageLightboxState.overlay && _imageLightboxState.overlay.classList.contains('open')) {
      _fitImageLightbox();
    }
  });

  // ---- 渲染消息内容：图片缩略图 / 视频播放器 / 语音控件 / 文件下载 ----
  function renderMessageContent(msg) {
    const mediaType = msg.mediaType || (msg.isImage ? (String(msg.text || '').startsWith('[视频]') ? 'video' : 'image') : '');
    let info = null;
    if (mediaType || msg.url) {
      info = {
        mediaType: mediaType || 'file',
        url: msg.url || '',
        fileName: msg.fileName || '',
        fileSize: msg.fileSize || 0,
        mimeType: msg.mimeType || '',
        isXor: !!msg.isXor,
      };
    }
    if (!info || !info.url) {
      info = parseMediaFromText(msg.text);
    }
    if (info && info.url) {
      const url = info.url;
      const type = info.mediaType;
      if (type === 'image') {
        return `<span class="chat-image-wrap"><img class="chat-media-img" src="${esc(url)}" alt="图片" loading="lazy" draggable="false" data-full="${esc(url)}" title="点击放大"></span>`;
      }
      if (type === 'video') {
        return `<div class="chat-video-wrap chat-video-player"><video class="chat-media-video" src="${esc(url)}" playsinline="true" webkit-playsinline="true" x5-playsinline="true" preload="metadata" title="点击播放"></video><button type="button" class="chat-video-center-play" aria-label="播放视频">▶</button><div class="chat-video-controls">${_videoControlsHTML()}</div></div>`;
      }
      if (type === 'audio') {
        return `<div class="chat-media-audio">
          <audio class="chat-media-audio-el" src="${esc(url)}" preload="metadata"></audio>
          <div class="audio-player-ui">
            <button class="audio-play-btn" type="button" title="播放">▶</button>
            <div class="audio-progress-bar"><div class="audio-progress-fill"></div></div>
            <span class="audio-time-display">--:--</span>
          </div>
        </div>`;
      }
      // file
      const name = info.fileName || '文件';
      const sizeStr = info.fileSize ? formatFileSize(info.fileSize) : '';
      const isXorFile = type === 'file' && (info.isXor || (url && url.toLowerCase().endsWith('.dlp')));
      const fileLinkAttrs = isXorFile
        ? `data-xor-url="${esc(url)}" data-xor-name="${esc(name)}" data-xor-mime="${esc(info.mimeType || '')}"`
        : `href="${esc(url)}" target="_blank" rel="noopener noreferrer" download="${esc(name)}"`;
      return `<a class="chat-media-file" ${fileLinkAttrs}>
        <span class="chat-media-file-icon">📎</span>
        <span class="chat-media-file-meta">
          <span class="chat-media-file-name">${esc(name)}</span>
          <span class="chat-media-file-size">${esc(sizeStr || '点击下载')}</span>
        </span>
      </a>`;
    }
    return linkifyText(msg.text);
  }

  // ===== 长按消息：撤回/删除菜单 =====
  // ===== 已撤回/删除的消息 ID 集合（防止历史消息重放后复活） =====
  const _deletedMsgIds = new Set();
  const DELETED_MSG_STORAGE_KEY = 'lanplay_deleted_msg_ids';
  function loadDeletedMsgIds() {
    try {
      const raw = localStorage.getItem(DELETED_MSG_STORAGE_KEY);
      if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) arr.forEach(id => _deletedMsgIds.add(id)); }
    } catch(e) {}
    if (_deletedMsgIds.size > 500) {
      const entries = [..._deletedMsgIds];
      entries.slice(0, entries.length - 500).forEach(id => _deletedMsgIds.delete(id));
    }
  }
  function saveDeletedMsgIds() {
    try { localStorage.setItem(DELETED_MSG_STORAGE_KEY, JSON.stringify([..._deletedMsgIds])); } catch(e) {}
  }
  function markMsgDeleted(id) { _deletedMsgIds.add(id); saveDeletedMsgIds(); }
  loadDeletedMsgIds();

  // ===== 长按消息：撤回/删除菜单 =====
  // 用 flag 标记正在长按气泡，在 dragstart 里阻止拖动
  let pressTimer = null;
  let pressStartX = 0;
  let pressStartY = 0;
  let longPressingMsg = false;
  let _suppressMessageClickUntil = 0;
  let _suppressMessageClickRow = null;
  // 长按气泡时临时移除父卡片 draggable，防止浏览器在 500ms 前抢先启动拖拽幽灵
  let touchedDraggableEl = null;

  function disableCardDragForLongPress(row) {
    const group = row.closest('.server-group[draggable="true"]');
    if (group) {
      touchedDraggableEl = group;
      group.removeAttribute('draggable');
    }
  }
  function restoreCardDrag() {
    if (touchedDraggableEl) {
      if (touchedDraggableEl.parentElement) {
        touchedDraggableEl.setAttribute('draggable', 'true');
      }
      touchedDraggableEl = null;
    }
  }

  function _allowMsgLongPressAt(row, x, y, target) {
    if (!row) return false;
    const video = row.querySelector('.chat-media-video');
    // 普通文字/文件消息保持原来的整条气泡长按；视频消息只允许按视频本体。
    if (!video) return true;
    return _videoAtPoint(x, y, target) === video;
  }

  function _markMessageClickSuppressed(row) {
    _suppressMessageClickRow = row;
    _suppressMessageClickUntil = Date.now() + 900;
  }
  function _consumeSuppressedMessageClick(target) {
    if (!_suppressMessageClickRow || Date.now() > _suppressMessageClickUntil) {
      _suppressMessageClickRow = null;
      _suppressMessageClickUntil = 0;
      return false;
    }
    const row = target && target.closest ? target.closest('.chat-msg') : null;
    if (row !== _suppressMessageClickRow) return false;
    _suppressMessageClickRow = null;
    _suppressMessageClickUntil = 0;
    return true;
  }

  function startMsgLongPress(row, x, y) {
    cancelMsgLongPress();
    longPressingMsg = true;
    pressStartX = x;
    pressStartY = y;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      const id = row.dataset.msgId;
      if (!id) return;
      _markMessageClickSuppressed(row);
      const isMine = row.classList.contains('chat-msg-mine');
      showMsgActionMenu(id, isMine, row);
    }, 500);
  }
  function cancelMsgLongPress() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    longPressingMsg = false;
  }

  // pointer 事件（桌面）
  document.addEventListener('pointerdown', e => {
    const row = e.target.closest('.chat-msg'); if (!row) return;
    if (!_allowMsgLongPressAt(row, e.clientX, e.clientY, e.target)) return;
    disableCardDragForLongPress(row);
    startMsgLongPress(row, e.clientX, e.clientY);
  });
  document.addEventListener('pointermove', e => {
    if (!pressTimer) return;
    const dx = e.clientX - pressStartX;
    const dy = e.clientY - pressStartY;
    if (dx * dx + dy * dy > 100) { cancelMsgLongPress(); restoreCardDrag(); }
  }, {passive:true});
  ['pointerup','pointercancel'].forEach(ev => document.addEventListener(ev, () => {
    cancelMsgLongPress();
    if (!document.getElementById('msgActionMenu')) restoreCardDrag();
  }, {passive:true}));

  // touch 事件（移动端更可靠，穿透 video/audio 控件）
  let touchPressRow = null;
  document.addEventListener('touchstart', e => {
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = el && el.closest('.chat-msg');
    if (!row || !_allowMsgLongPressAt(row, touch.clientX, touch.clientY, el)) return;
    touchPressRow = row;
    // 临时移除父卡片 draggable，阻止浏览器启动拖拽幽灵
    disableCardDragForLongPress(row);
    startMsgLongPress(row, touch.clientX, touch.clientY);
  }, {passive:true});
  document.addEventListener('touchmove', e => {
    if (!pressTimer) return;
    const touch = e.touches[0];
    const dx = touch.clientX - pressStartX;
    const dy = touch.clientY - pressStartY;
    if (dx * dx + dy * dy > 100) { cancelMsgLongPress(); restoreCardDrag(); }
  }, {passive:true});
  document.addEventListener('touchend', () => {
    cancelMsgLongPress(); touchPressRow = null;
    // 菜单打开时不恢复 draggable，等菜单关闭时再恢复
    if (!document.getElementById('msgActionMenu')) restoreCardDrag();
  }, {passive:true});
  document.addEventListener('touchcancel', () => {
    cancelMsgLongPress(); touchPressRow = null;
    restoreCardDrag();
  }, {passive:true});

  // 仅在长按气泡或菜单打开时阻止卡片拖动（不再阻止聊天区域的正常拖动）
  document.addEventListener('dragstart', function(e) {
    const menuOpen = document.getElementById('msgActionMenu');
    if (longPressingMsg || menuOpen) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // 消息操作菜单（撤回 / 删除）
  function showMsgActionMenu(msgId, isMine, rowEl) {
    // 移除旧菜单
    const old = document.getElementById('msgActionMenu');
    if (old) {
      if (typeof old._close === 'function') old._close();
      else old.remove();
    }

    const menu = document.createElement('div');
    menu.id = 'msgActionMenu';
    menu.className = 'msg-action-menu';
    menu.innerHTML = `
      <div class="msg-action-mask"></div>
      <div class="msg-action-sheet">
        ${isMine ? '<button class="msg-action-btn recall" type="button">撤回消息</button>' : ''}
        <button class="msg-action-btn delete" type="button">删除消息</button>
        <button class="msg-action-btn cancel" type="button">取消</button>
      </div>
    `;
    document.body.appendChild(menu);
    requestAnimationFrame(() => menu.classList.add('open'));

    let menuClosed = false;
    function close() {
      if (menuClosed) return;
      menuClosed = true;
      // 立即重置长按状态，恢复卡片可拖动并彻底移除遮罩。
      longPressingMsg = false;
      restoreCardDrag();
      document.removeEventListener('pointerdown', closeWhenOutside, true);
      document.removeEventListener('touchstart', closeWhenOutside, true);
      if (menu.parentElement) menu.remove();
    }
    function closeWhenOutside(e) {
      if (!menu.contains(e.target)) close();
    }
    document.addEventListener('pointerdown', closeWhenOutside, true);
    document.addEventListener('touchstart', closeWhenOutside, true);
    menu._close = close;

    menu.querySelector('.msg-action-mask').addEventListener('click', close);
    menu.querySelector('.cancel').addEventListener('click', close);

    menu.querySelector('.delete').addEventListener('click', () => {
      close();
      markMsgDeleted(msgId);
      Object.keys(state.chatMessages).forEach(k => { state.chatMessages[k] = (state.chatMessages[k]||[]).filter(m=>m.id!==msgId); });
      state.publicMessages = (state.publicMessages||[]).filter(m=>m.id!==msgId);
      saveChatMessages(); savePublicMessages();
      if (rowEl && rowEl.parentElement) rowEl.remove();
      else { state.servers.forEach(s => renderChatMessages(s.id, false)); renderPublicChat(false); }
    });

    if (isMine) {
      menu.querySelector('.recall').addEventListener('click', () => {
        close();
        markMsgDeleted(msgId);
        Object.keys(state.chatMessages).forEach(k => { state.chatMessages[k] = (state.chatMessages[k]||[]).filter(m=>m.id!==msgId); });
        state.publicMessages = (state.publicMessages||[]).filter(m=>m.id!==msgId);
        const group = rowEl && rowEl.closest('.server-group');
        const channel = group ? (CHAT_PREFIX + group.dataset.id) : PUBLIC_CHANNEL;
        if (goEasy && state.goEasyReady) goEasy.pubsub.publish({channel, message:JSON.stringify({type:'delete', id:msgId, senderId:state.userId}), qos:1});
        saveChatMessages(); savePublicMessages();
        if (rowEl && rowEl.parentElement) rowEl.remove();
        else { state.servers.forEach(s => renderChatMessages(s.id, false)); renderPublicChat(false); }
      });
    }
  }

  // 委托：XOR 加密文件点击 → 解密下载
  document.addEventListener('click', function (e) {
    const xorEl = e.target.closest('[data-xor-url]');
    if (xorEl) {
      e.preventDefault();
      e.stopPropagation();
      _xorDecryptAndDownload(xorEl.dataset.xorUrl, xorEl.dataset.xorName, xorEl.dataset.xorMime);
    }
  });

  // 所有带 download 属性的聊天附件都交给内置下载器，避免落到浏览器默认目录。
  // 注意：必须先 e.preventDefault() 再做 URL 校验，
  // 否则 WebView 看到非 https:// 的链接(比如只有域名的 "cos.svf.dpdns.org")
  // 会自动用 Intent.parseUri 包装成 intent://cos.svf.dpdns.org#Intent;scheme=https;... 的形式
  // 然后在系统层弹"无法打开 ERR_UNKNOWN_URL_SCHEDULE"错误。
  document.addEventListener('click', function (e) {
    const link = e.target.closest('a[download]');
    if (!link) return;
    // ① 先无条件拦截默认行为，杜绝 WebView 自己用 intent:// 跳系统浏览器
    e.preventDefault();
    e.stopPropagation();
    const rawUrl = link.getAttribute('href') || '';
    if (!rawUrl || rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) return;
    // ② 协议白名单：只允许 http/https，其他全部拒绝
    if (!/^https?:\/\//i.test(rawUrl)) {
      try {
        const u = new URL(rawUrl, window.location.href);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          console.warn('[下载] 非 http(s) 协议，拒绝:', rawUrl);
          if (typeof showToast === 'function') {
            showToast('❌ 不支持下载该链接(' + u.protocol.replace(':', '') + ')', 2500, false);
          }
          return;
        }
      } catch (e2) {
        console.warn('[下载] URL 解析失败:', rawUrl, e2);
        return;
      }
    }
    let downloadUrl = rawUrl;
    try { downloadUrl = new URL(rawUrl, window.location.href).href; } catch (_) { /* 使用原始地址 */ }
    const mediaName = link.querySelector('.chat-media-file-name');
    const fileName = link.getAttribute('download') || (mediaName && mediaName.textContent.trim()) || '';
    _builtInDownload(downloadUrl, fileName, false);
  });

  // 委托：聊天图片点击放大（支持拖动、滚轮/双指缩放）
  document.addEventListener('click', function (e) {
    const img = e.target.closest('.chat-media-img');
    if (img && img.dataset.full) {
      e.preventDefault();
      if (_consumeSuppressedMessageClick(img)) {
        e.stopImmediatePropagation();
        return;
      }
      e.stopPropagation();
      openImageLightbox(img.dataset.full);
    }
  });

  // 只认视频播放器本体的可见矩形；自定义控制栏也属于当前视频区域。
  function _videoAtPoint(x, y, fallbackTarget) {
    function findVideo(el) {
      if (!el || !el.closest) return null;
      const direct = el.closest('.chat-media-video');
      if (direct) return direct;
      const player = el.closest('.chat-video-player');
      return player ? player.querySelector('.chat-media-video') : null;
    }
    const pointTarget = document.elementFromPoint(x, y);
    const video = findVideo(pointTarget) || findVideo(fallbackTarget);
    if (!video) return null;
    const rect = video.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
    return video;
  }

  function _videoPlayerFor(video) {
    return video && video.closest ? video.closest('.chat-video-player') : null;
  }

  function _formatVideoTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    return minutes + ':' + String(secs).padStart(2, '0');
  }

  function _syncCustomVideoUI(video) {
    const player = _videoPlayerFor(video);
    if (!player || !video) return;
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      player.classList.toggle('is-portrait', video.videoHeight > video.videoWidth);
    }
    const duration = Number(video.duration);
    const current = Number(video.currentTime) || 0;
    const progress = player.querySelector('.chat-video-progress');
    const currentEl = player.querySelector('.chat-video-current');
    const durationEl = player.querySelector('.chat-video-duration');
    const playBtn = player.querySelector('.chat-video-play-toggle');
    const centerBtn = player.querySelector('.chat-video-center-play');
    const muteBtn = player.querySelector('.chat-video-mute-toggle');

    if (currentEl) currentEl.textContent = _formatVideoTime(current);
    if (durationEl) durationEl.textContent = _formatVideoTime(duration);
    if (progress) {
      const max = isFinite(duration) && duration > 0 ? duration : 100;
      const value = isFinite(duration) && duration > 0 ? Math.min(current, duration) : 0;
      const percent = max > 0 ? (value / max) * 100 : 0;
      progress.max = String(max);
      progress.value = String(value);
      progress.style.setProperty('--video-progress', percent + '%');
    }
    if (playBtn) {
      playBtn.textContent = video.paused || video.ended ? '▶' : '❚❚';
      playBtn.title = video.paused || video.ended ? '播放' : '暂停';
    }
    if (centerBtn) {
      centerBtn.classList.toggle('is-hidden', !video.paused && !video.ended);
    }
    if (muteBtn) {
      muteBtn.textContent = video.muted || video.volume === 0 ? '🔇' : '🔊';
      muteBtn.title = video.muted || video.volume === 0 ? '取消静音' : '静音';
    }
  }

  function _playCustomVideo(video) {
    if (!video) return;
    const promise = video.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  }

  // 自定义播放器按钮：播放/暂停、静音、进度和页面内全屏。
  document.addEventListener('click', function (e) {
    const control = e.target && e.target.closest
      ? e.target.closest('.chat-video-play-toggle, .chat-video-center-play, .chat-video-mute-toggle, .chat-video-fullscreen-toggle')
      : null;
    if (control) {
      const player = control.closest('.chat-video-player');
      const video = player && player.querySelector('video');
      if (!video) return;
      e.preventDefault();
      e.stopPropagation();
      if (control.classList.contains('chat-video-fullscreen-toggle')) {
        // 只打开网页内播放器，不调用 Android 原生全屏接口。
        if (!player.closest('#chatVideoLightbox')) {
          openVideoLightbox(video.currentSrc || video.src, video.currentTime || 0);
        }
        return;
      }
      if (control.classList.contains('chat-video-mute-toggle')) {
        video.muted = !video.muted;
        _syncCustomVideoUI(video);
        return;
      }
      if (video.paused || video.ended) _playCustomVideo(video);
      else video.pause();
      return;
    }

    const video = e.target && e.target.closest
      ? e.target.closest('.chat-media-video, .chat-lightbox-video')
      : null;
    if (video && _videoPlayerFor(video)) {
      e.preventDefault();
      if (_consumeSuppressedMessageClick(video)) {
        e.stopImmediatePropagation();
        return;
      }
      if (Date.now() < _suppressCustomVideoClickUntil) {
        e.stopPropagation();
        return;
      }
      if (video.paused || video.ended) _playCustomVideo(video);
      else video.pause();
    }
  });

  // 全屏播放器内左右滑动视频画面调节进度，控制栏/按钮区域不参与滑动。
  let _videoSeekGesture = null;
  let _suppressCustomVideoClickUntil = 0;
  function _startVideoSeekGesture(e) {
    const player = e.target && e.target.closest
      ? e.target.closest('#chatVideoLightbox .chat-video-player')
      : null;
    if (!player || e.target.closest('.chat-video-controls') || e.target.closest('button, input')) return;
    const video = player.querySelector('video');
    if (!video) return;
    _videoSeekGesture = {
      pointerId: e.pointerId,
      player,
      video,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Number(video.currentTime) || 0,
      moved: false,
    };
  }
  function _moveVideoSeekGesture(e) {
    const g = _videoSeekGesture;
    if (!g || g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
    const duration = Number(g.video.duration);
    if (!isFinite(duration) || duration <= 0) return;
    g.moved = true;
    const width = Math.max(1, g.player.clientWidth);
    const nextTime = Math.max(0, Math.min(duration, g.startTime + (dx / width) * duration));
    g.video.currentTime = nextTime;
    _syncCustomVideoUI(g.video);
    _suppressCustomVideoClickUntil = Date.now() + 350;
    e.preventDefault();
  }
  function _endVideoSeekGesture(e) {
    if (!_videoSeekGesture || _videoSeekGesture.pointerId !== e.pointerId) return;
    if (_videoSeekGesture.moved) _suppressCustomVideoClickUntil = Date.now() + 350;
    _videoSeekGesture = null;
  }
  document.addEventListener('pointerdown', _startVideoSeekGesture, { capture: true, passive: true });
  document.addEventListener('pointermove', _moveVideoSeekGesture, { capture: true, passive: false });
  document.addEventListener('pointerup', _endVideoSeekGesture, { capture: true, passive: true });
  document.addEventListener('pointercancel', _endVideoSeekGesture, { capture: true, passive: true });
  // 兼容不支持 PointerEvent 的旧 Android WebView。
  if (!window.PointerEvent) {
    document.addEventListener('touchstart', function (e) {
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      _startVideoSeekGesture({ target: e.target, pointerId: 'touch', clientX: t.clientX, clientY: t.clientY });
    }, { capture: true, passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      _moveVideoSeekGesture({ target: e.target, pointerId: 'touch', clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault() });
    }, { capture: true, passive: false });
    document.addEventListener('touchend', function () {
      _endVideoSeekGesture({ pointerId: 'touch' });
    }, { capture: true, passive: true });
    document.addEventListener('touchcancel', function () {
      _endVideoSeekGesture({ pointerId: 'touch' });
    }, { capture: true, passive: true });
  }

  document.addEventListener('input', function (e) {
    const progress = e.target && e.target.closest ? e.target.closest('.chat-video-progress') : null;
    if (!progress) return;
    const player = progress.closest('.chat-video-player');
    const video = player && player.querySelector('video');
    if (!video || !isFinite(Number(progress.value))) return;
    video.currentTime = Number(progress.value);
    _syncCustomVideoUI(video);
  });

  ['loadedmetadata', 'durationchange', 'timeupdate', 'progress', 'volumechange', 'play', 'pause', 'ended'].forEach(function (eventName) {
    document.addEventListener(eventName, function (e) {
      if (e.target && e.target.tagName === 'VIDEO') _syncCustomVideoUI(e.target);
    }, true);
  });

  // 播放当前视频时，自动暂停页面中其它正在播放的视频。
  document.addEventListener('play', function (e) {
    const currentVideo = e.target;
    if (!currentVideo || currentVideo.tagName !== 'VIDEO') return;
    document.querySelectorAll('video').forEach(function (video) {
      if (video !== currentVideo && !video.paused) {
        try { video.pause(); } catch (_) { /* ignore */ }
      }
    });
    _syncCustomVideoUI(currentVideo);
  }, true);

  function formatAudioDuration(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '--:--';
    const total = Math.round(seconds);
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }
  // ===== 自定义音频播放器：事件委托 =====
  // 未播放时显示总时长，播放时从 0 开始计时
  // 用 requestAnimationFrame 保证进度条与时间完全同步流畅
  function _audioWrap(e) {
    const audio = e.target;
    if (!audio || !audio.classList || !audio.classList.contains('chat-media-audio-el')) return null;
    return audio.closest('.chat-media-audio');
  }
  function _audioSyncUI(audio, w) {
    const td = w.querySelector('.audio-time-display');
    const pf = w.querySelector('.audio-progress-fill');
    if (td) td.textContent = formatAudioDuration(audio.currentTime);
    if (pf && audio.duration && isFinite(audio.duration)) {
      pf.style.width = ((audio.currentTime / audio.duration) * 100) + '%';
    }
  }
  // rAF 循环：播放期间每帧同步刷新进度条 + 时间
  const _audioRaf = new WeakMap();
  function _startAudioRaf(audio, w) {
    if (_audioRaf.has(audio)) return;
    function tick() {
      _audioSyncUI(audio, w);
      _audioRaf.set(audio, requestAnimationFrame(tick));
    }
    _audioRaf.set(audio, requestAnimationFrame(tick));
  }
  function _stopAudioRaf(audio, w) {
    const id = _audioRaf.get(audio);
    if (id) { cancelAnimationFrame(id); _audioRaf.delete(audio); }
    // 停止后立刻刷一次，确保停在准确位置
    _audioSyncUI(audio, w);
  }

  document.addEventListener('loadedmetadata', function (e) {
    const w = _audioWrap(e); if (!w) return;
    const audio = e.target;
    const td = w.querySelector('.audio-time-display');
    if (td && audio.duration && isFinite(audio.duration)) td.textContent = formatAudioDuration(audio.duration);
  }, true);
  document.addEventListener('canplay', function (e) {
    const w = _audioWrap(e); if (!w) return;
    const audio = e.target;
    const td = w.querySelector('.audio-time-display');
    if (td && audio.duration && isFinite(audio.duration) && audio.paused && audio.currentTime === 0) {
      td.textContent = formatAudioDuration(audio.duration);
    }
  }, true);
  document.addEventListener('durationchange', function (e) {
    const w = _audioWrap(e); if (!w) return;
    const audio = e.target;
    const td = w.querySelector('.audio-time-display');
    if (td && audio.duration && isFinite(audio.duration) && audio.paused && audio.currentTime === 0) {
      td.textContent = formatAudioDuration(audio.duration);
    }
  }, true);
  document.addEventListener('play', function (e) {
    const w = _audioWrap(e); if (!w) return;
    const audio = e.target;
    const btn = w.querySelector('.audio-play-btn');
    if (btn) { btn.textContent = '⏸'; btn.title = '暂停'; }
    _startAudioRaf(audio, w);
  }, true);
  document.addEventListener('pause', function (e) {
    const w = _audioWrap(e); if (!w) return;
    const audio = e.target;
    const btn = w.querySelector('.audio-play-btn');
    if (btn) { btn.textContent = '▶'; btn.title = '播放'; }
    _stopAudioRaf(audio, w);
  }, true);
  document.addEventListener('ended', function (e) {
    const w = _audioWrap(e); if (!w) return;
    const audio = e.target;
    const btn = w.querySelector('.audio-play-btn');
    const td = w.querySelector('.audio-time-display');
    const pf = w.querySelector('.audio-progress-fill');
    if (btn) { btn.textContent = '▶'; btn.title = '播放'; }
    _stopAudioRaf(audio, w);
    try { audio.currentTime = 0; } catch (_) {}
    if (td && audio.duration && isFinite(audio.duration)) td.textContent = formatAudioDuration(audio.duration);
    if (pf) pf.style.width = '0%';
  }, true);
  // 播放/暂停按钮 + 进度条点击跳转
  document.addEventListener('click', function (e) {
    const playBtn = e.target.closest('.audio-play-btn');
    if (playBtn) {
      e.stopPropagation();
      const w = playBtn.closest('.chat-media-audio');
      const audio = w && w.querySelector('.chat-media-audio-el');
      if (!audio) return;
      if (audio.paused) { audio.play().catch(() => {}); } else { audio.pause(); }
      return;
    }
    const bar = e.target.closest('.audio-progress-bar');
    if (bar) {
      e.stopPropagation();
      const w = bar.closest('.chat-media-audio');
      const audio = w && w.querySelector('.chat-media-audio-el');
      if (!audio || !audio.duration || !isFinite(audio.duration)) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = pct * audio.duration;
      // 跳转后立刻同步 UI（暂停时 rAF 不跑，需要手动刷一次）
      _audioSyncUI(audio, w);
    }
  });

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
          appkey: 'BC-729843d9d3fa40aa99dddda591554336',
          modules: ['pubsub'],
          forceTLS: true
        });
        const userId = state.userId;
        const nick = state.username || '匿名用户';
        goEasy.connect({
          id: userId,
          data: { nickname: nick, avatar: '' },
          onSuccess: function () {
            console.log('GoEasy 连接成功，用户ID:', goEasy.id);
            state.goEasyReady = true;
            showToast('✅ 聊天服务已连接', 1500, true);
            // 必须先 subscribe(presence:enable) 成功，再挂 Presence 监听
            subscribePublicChannel();
            forceSubscribeAll();
            state.servers.forEach(s => renderChatMessages(s.id, false));
            renderPublicChat(false);
            updateChatUI();
            restorePublicUnread();
          },
          onFailed: function (error) {
            console.error('GoEasy 连接失败', error);
            state.goEasyReady = false;
            state.presenceReady = false;
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
              updateOnlineMembersUI();
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
  function getPublicUnreadCount() {
    const raw = localStorage.getItem(PUBLIC_UNREAD_KEY);
    // 兼容旧布尔值存储
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
    // value: true 表示 +1；false 表示清零；number 表示直接设置
    if (value === false || value === 0) {
      localStorage.setItem(PUBLIC_UNREAD_KEY, '0');
    } else if (value === true) {
      const next = getPublicUnreadCount() + 1;
      localStorage.setItem(PUBLIC_UNREAD_KEY, String(next));
    } else if (typeof value === 'number') {
      localStorage.setItem(PUBLIC_UNREAD_KEY, String(Math.max(0, value | 0)));
    }
    updatePublicUnreadBadge();
  }

  function restorePublicUnread() {
    updatePublicUnreadBadge();
  }

  // ---- 订阅服务器频道 ----
  function loadChannelHistory(channel, onMessage) {
    if (!goEasy || !state.goEasyReady || !goEasy.pubsub || !goEasy.pubsub.history) return;
    goEasy.pubsub.history({ channel: channel, limit: HISTORY_LIMIT,
      onSuccess: response => {
        const list = response && response.content && response.content.messages || [];
        list.forEach(item => { if (typeof onMessage === 'function') onMessage({content:item.content}); });
      },
      onFailed: error => console.warn('[历史消息] 获取失败', channel, error)
    });
  }

  function subscribeChannel(serverId) {
    if (!goEasy || !state.goEasyReady || state.chatSubscribed[serverId]) return;
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
          if (state.goEasyReady && !state.chatSubscribed[serverId]) {
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
    // subscribePublicChannel 成功回调里会 initPresence / queryHereNow
    subscribePublicChannel();
    console.log('[聊天] 强制重新订阅所有频道');
  }

  // ---- 服务器聊天接收 ----
  function handleChatMessage(serverId, content) {
    try {
      const msg = JSON.parse(content);
      if (msg.type === 'delete' && msg.id) {
        markMsgDeleted(msg.id);
        state.chatMessages[serverId] = (state.chatMessages[serverId] || []).filter(m => m.id !== msg.id);
        saveChatMessages(); renderChatMessages(serverId, false); return;
      }
      if (_deletedMsgIds.has(msg.id)) return;
      if (!state.chatMessages[serverId]) state.chatMessages[serverId] = [];

      const exists = state.chatMessages[serverId].some(m => m.id === msg.id);
      if (exists) return;

      const isMine = (msg.senderId === state.userId) || (msg.sender === state.username) || (msg.sender === state.userId);
      state.chatMessages[serverId].push({
        id: msg.id,
        text: msg.text,
        sender: msg.sender,
        senderName: msg.senderName || msg.nickname || msg.sender,
        senderId: msg.senderId || '',
        isMine: isMine,
        time: msg.time || Date.now(),
        isImage: !!msg.isImage,
        mediaType: msg.mediaType || '',
        url: msg.url || '',
        fileName: _restoreBlockedExt(msg.fileName || ''),
        fileSize: msg.fileSize || 0,
        mimeType: msg.mimeType || '',
        isXor: !!msg.isXor || ((msg.url || '').toLowerCase().endsWith('.dlp')),
      });
      saveChatMessages();
      renderChatMessages(serverId, true);

      if (!isMine && !state.expanded.has(serverId)) {
        state.unreadStatus[serverId] = getUnreadCount(serverId) + 1;
        saveUnreadStatus();
        updateUnreadIndicators();
      }
    } catch (e) {
      console.warn('解析聊天消息失败', e);
    }
  }

  // ---- 服务器聊天发送 ----
  // mediaOrFlag: 兼容旧布尔 isVideo，或媒体元数据对象
  function sendChatMessage(serverId, text, mediaOrFlag) {
    if (!text || !String(text).trim()) return;
    if (!state.username) {
      ensureUsername(() => {});
      showToast('⚠️ 请先设置用户名', 1500, false);
      return;
    }
    if (!goEasy || !state.goEasyReady) {
      showToast('⚠️ 聊天服务未连接，请稍后重试', 2000, false);
      return;
    }
    const media = (mediaOrFlag && typeof mediaOrFlag === 'object') ? mediaOrFlag : null;
    const isVideoFlag = mediaOrFlag === true;
    const channel = CHAT_PREFIX + serverId;
    const msgId = generateMsgId();
    const mediaType = media ? (media.mediaType || '') : (isVideoFlag ? 'video' : '');
    const msgObj = {
      id: msgId,
      text: String(text).trim(),
      sender: state.userId,
      senderName: state.username,
      senderId: state.userId,
      time: Date.now(),
      isImage: mediaType === 'image' || mediaType === 'video',
      mediaType: mediaType || undefined,
      url: media && media.url ? media.url : undefined,
      fileName: media && media.fileName ? media.fileName : undefined,
      fileSize: media && media.fileSize != null ? media.fileSize : undefined,
      mimeType: media && media.mimeType ? media.mimeType : undefined,
      isXor: media && media.isXor ? true : undefined,
    };
    const payload = JSON.stringify(msgObj);
    goEasy.pubsub.publish({
      channel: channel,
      message: payload,
      qos: 1,
      onSuccess: function () {
        if (!state.chatMessages[serverId]) state.chatMessages[serverId] = [];
        const exists = state.chatMessages[serverId].some(m => m.id === msgId);
        if (!exists) {
          state.chatMessages[serverId].push(Object.assign({ isMine: true }, msgObj, { isXor: !!msgObj.isXor }));
          saveChatMessages();
        }
        renderChatMessages(serverId, true);
        const card = document.querySelector(`.server-group[data-id="${serverId}"]`);
        if (card) {
          const input = card.querySelector('.chat-input');
          if (input) { input.value = ''; input.style.height = 'auto'; }
        }
      },
      onFailed: function (error) {
        console.error('消息发送失败', error);
        showToast('❌ 消息发送失败：' + (error && error.content ? error.content : error), 2500, false);
      }
    });
  }

  // ---- 渲染消息列表（支持滚动位置恢复） ----
  function getChatMessagesSignature(messages) {
    if (!messages || !messages.length) return 'empty';
    // 用条数 + 首尾 id/time 做轻量签名，避免无变化时重绘
    const first = messages[0];
    const last = messages[messages.length - 1];
    return messages.length + '|' + (first && first.id) + '|' + (last && last.id) + '|' + (last && last.time);
  }

  function renderChatMessages(serverId, forceScroll = false) {
    const card = document.querySelector(`.server-group[data-id="${serverId}"]`);
    if (!card) return;
    const container = card.querySelector('.chat-messages');
    if (!container) return;

    // 输入框正在输入时，除非强制滚到底（新消息），否则不要动 DOM，避免收起键盘
    const inputEl = card.querySelector('.chat-input');
    const inputFocused = inputEl && document.activeElement === inputEl;

    if (!state.goEasyReady) {
      if (container.dataset.sig !== 'disconnected') {
        container.innerHTML = '<div style="color:var(--red);text-align:center;padding:8px;">⚠️ 聊天服务未连接</div>';
        container.dataset.sig = 'disconnected';
      }
      return;
    }

    const messages = state.chatMessages[serverId] || [];
    const sig = getChatMessagesSignature(messages);

    // 消息未变化且非强制滚动：保持现状，避免跳到第一条 / 丢焦点
    if (container.dataset.sig === sig && !forceScroll) {
      return;
    }

    // 重绘前记住当前位置
    const prevScroll = container.scrollTop;
    const prevHeight = container.scrollHeight;
    const wasNearBottom = (prevScroll + container.clientHeight) >= (prevHeight - 40);

    if (messages.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:8px;font-size:12px;">暂无消息</div>';
    } else {
      container.innerHTML = buildChatMessagesHtml(messages);
    }
    container.dataset.sig = sig;

    // 滚动：新消息强制到底；否则尽量保持原位置 / 贴底
    const savedPosition = getChatScroll(serverId);
    if ((forceScroll && (savedPosition === null || wasNearBottom)) || (!forceScroll && wasNearBottom && savedPosition === null)) {
      container.scrollTop = container.scrollHeight;
      saveChatScroll(serverId, container.scrollTop);
    } else {
      const saved = savedPosition;
      if (saved !== null) {
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        container.scrollTop = Math.min(saved, maxScroll);
      } else {
        container.scrollTop = container.scrollHeight;
        saveChatScroll(serverId, container.scrollTop);
      }
    }

    // 若因重绘导致失焦，尝试恢复（仅在本次确实有输入焦点时）
    if (inputFocused && inputEl && document.activeElement !== inputEl) {
      try { inputEl.focus({ preventScroll: true }); } catch (e) { try { inputEl.focus(); } catch (_) {} }
    }
  }

  // ===== 初始化聊天卡片 =====
  function initChatForCard(serverId, cardElement) {
    let wrapper = cardElement.querySelector('.chat-wrapper');
    const bodyInner = cardElement.querySelector('.server-body > .body-inner');
    if (!bodyInner) return;

    const isNew = !wrapper;

    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'chat-wrapper';
      const hasUsername = !!state.username;
      const ready = state.goEasyReady && hasUsername;
      wrapper.innerHTML = `
        <div class="chat-messages"></div>
        <div class="chat-input-area">
          <div class="chat-plus-wrap">
            <button type="button" class="chat-plus-btn" title="添加附件">＋</button>
            <div class="chat-plus-panel">
              <button type="button" data-plus-action="image">🖼️ 图片</button>
              <button type="button" data-plus-action="video">🎬 视频</button>
              <button type="button" data-plus-action="file">📎 文件</button>
            </div>
          </div>
          <textarea rows="1" class="chat-input" placeholder="${ready ? '输入聊天内容...' : (state.goEasyReady ? '请先设置用户名' : '聊天未连接')}" ${ready ? '' : 'disabled'}></textarea>
          <button type="button" class="chat-voice-btn" title="录制语音">🎤</button>
          <button class="chat-send-btn" ${ready ? '' : 'disabled'}>发送</button>
        </div>
      `;
      const roomList = bodyInner.querySelector('.room-list');
      if (roomList) {
        bodyInner.insertBefore(wrapper, roomList);
      } else {
        bodyInner.prepend(wrapper);
      }

      // 绑定滚动事件以保存位置
      const container = wrapper.querySelector('.chat-messages');
      if (container && !container.dataset.scrollBound) {
        container.addEventListener('scroll', function() {
          saveChatScroll(serverId, this.scrollTop);
        });
        container.dataset.scrollBound = 'true';
      }

      const input = wrapper.querySelector('.chat-input');
      const sendBtn = wrapper.querySelector('.chat-send-btn');
      const plusBtn = wrapper.querySelector('.chat-plus-btn');
      const plusPanel = wrapper.querySelector('.chat-plus-panel');
      const voiceBtn = wrapper.querySelector('.chat-voice-btn');
      const sendHandler = function() {
        if (sendPendingAttachment(serverId, input, false, serverId)) return;
        const text = input.value.trim();
        if (text) sendChatMessage(serverId, text, false);
      };
      sendBtn.addEventListener('click', sendHandler);
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendHandler();
        }
      });
      bindPlusMenu(plusBtn, plusPanel, {
        image: function () { sendMessageWithMedia(serverId, input, sendChatMessage, false, 'image/*'); },
        video: function () { sendMessageWithMedia(serverId, input, sendChatMessage, false, 'video/*'); },
        file: function () { sendMessageWithMedia(serverId, input, sendChatMessage, false, '*/*'); },
      });
      if (voiceBtn) {
        voiceBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          startVoiceRecording(voiceBtn, function (file) {
            storeRecordedVoice(file, serverId, false);
          });
        });
      }
      wrapper.dataset.bound = 'true';
    }

    // 仅在新创建或消息可能变化时渲染；输入中由 renderChatMessages 内部保护
    if (isNew) {
      renderChatMessages(serverId, false); // 首次打开恢复上次位置
    } else {
      renderChatMessages(serverId, false);
    }

    if (state.goEasyReady && !state.chatSubscribed[serverId]) {
      subscribeChannel(serverId);
    }
  }

  // ---- 公共频道 ----
  function subscribePublicChannel() {
    if (!goEasy || !state.goEasyReady || state.publicChatReady) return;
    goEasy.pubsub.subscribe({
      channel: PUBLIC_CHANNEL,
      history: 50,
      // 官方要求：订阅时开启 presence，该订阅才会被计入在线成员
      presence: { enable: true },
      onMessage: function (message) {
        try {
          const msg = JSON.parse(message.content);
          if (msg.type === 'delete' && msg.id) {
            markMsgDeleted(msg.id);
            state.publicMessages = (state.publicMessages || []).filter(m => m.id !== msg.id);
            savePublicMessages(); renderPublicChat(false); return;
          }
          if (_deletedMsgIds.has(msg.id)) return;
          if (!state.publicMessages) state.publicMessages = [];

          const exists = state.publicMessages.some(m => m.id === msg.id);
          if (exists) return;

          const isMine = (msg.senderId === state.userId) || (msg.sender === state.username) || (msg.sender === state.userId);
          state.publicMessages.push({
            id: msg.id,
            text: msg.text,
            sender: msg.sender || '匿名',
            senderName: msg.senderName || msg.nickname || msg.sender || '匿名',
            senderId: msg.senderId || '',
            isMine: isMine,
            time: msg.time || Date.now(),
            isImage: !!msg.isImage,
            mediaType: msg.mediaType || '',
            url: msg.url || '',
            fileName: _restoreBlockedExt(msg.fileName || ''),
            fileSize: msg.fileSize || 0,
            mimeType: msg.mimeType || '',
            isXor: !!msg.isXor || ((msg.url || '').toLowerCase().endsWith('.dlp')),
          });
          savePublicMessages();
          renderPublicChat(true);

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
        savePublicMessages(); renderPublicChat(false);
        restorePublicUnread();
        // 公共频道订阅成功后再拉在线列表（自己已在该 channel 上）
        if (!state.presenceReady) {
          initPresence();
        } else {
          queryHereNow();
        }
      },
      onFailed: function (error) {
        console.error('公共频道订阅失败', error);
        setTimeout(() => {
          if (state.goEasyReady && !state.publicChatReady) {
            subscribePublicChannel();
          }
        }, 5000);
      }
    });
  }

  // ---- 在线成员 Presence ----
  function initPresence() {
    if (!goEasy || !state.goEasyReady) return;
    // 确保已用 presence:enable 订阅 channel 之后再监听
    subscribePresence();
    queryHereNow();
    startPresencePolling();
  }

  function startPresencePolling() {
    if (presenceRefreshTimer) clearInterval(presenceRefreshTimer);
    // 依赖 subscribePresence 监听实时上下线推送，定时器放宽至 60 秒作为保底校准
    presenceRefreshTimer = setInterval(() => {
      if (!state.goEasyReady || document.hidden) return;
      queryHereNow();
    }, 60000);
  }

  function normalizeMember(m) {
    if (!m) return { id: 'unknown', nickname: '未知用户', avatar: '' };
    // 兼容新版 {id, data:{nickname}} 与旧版 {id, data:"字符串"} / {userId, userData}
    let id = m.id || m.userId || 'unknown';
    let nickname = id;
    let avatar = '';
    const rawData = m.data !== undefined ? m.data : m.userData;
    if (rawData && typeof rawData === 'object') {
      nickname = rawData.nickname || rawData.name || id;
      avatar = rawData.avatar || '';
    } else if (typeof rawData === 'string' && rawData) {
      try {
        const parsed = JSON.parse(rawData);
        nickname = parsed.nickname || parsed.name || id;
        avatar = parsed.avatar || '';
      } catch (_) {
        nickname = rawData;
      }
    }
    return { id: String(id), nickname: String(nickname), avatar: String(avatar || '') };
  }

  let _presenceHereNowTimer = null;
  function scheduleHereNowRefresh(delay) {
    if (_presenceHereNowTimer) clearTimeout(_presenceHereNowTimer);
    _presenceHereNowTimer = setTimeout(function () {
      _presenceHereNowTimer = null;
      queryHereNow();
    }, typeof delay === 'number' ? delay : 400);
  }

  // 上线 Toast：同一用户短时间内只提示一次
  const _onlineToastAt = Object.create(null);
  function notifyMemberOnline(member) {
    if (!member) return;
    const norm = normalizeMember(member);
    const id = norm.id || '';
    const name = norm.nickname || id || '未知成员';
    // 不提示自己
    if (id && state.username && (id === state.username || name === state.username)) return;
    const now = Date.now();
    if (_onlineToastAt[id] && now - _onlineToastAt[id] < 8000) return;
    _onlineToastAt[id] = now;
    showToast('🟢 成员 ' + name + ' 已上线', 2000, true);
  }

  function notifyPresenceJoin(presenceEvent) {
    if (!presenceEvent) return;
    const action = presenceEvent.action;
    if (action === 'join' || action === 'online' || action === 'back') {
      if (presenceEvent.member) {
        notifyMemberOnline(presenceEvent.member);
        return;
      }
    }
    // 旧版 events 数组
    if (Array.isArray(presenceEvent.events)) {
      presenceEvent.events.forEach(function (ev) {
        const a = ev.action;
        if (a === 'join' || a === 'online' || a === 'back') {
          notifyMemberOnline({
            id: ev.userId || (ev.member && ev.member.id),
            data: ev.userData || (ev.member && ev.member.data)
          });
        }
      });
    }
  }

  function applyPresencePayload(payload, opts) {
    if (!payload) return false;
    opts = opts || {};
    let listUpdated = false;

    // 新版: { action, member, amount, members }
    // 文档拼写 memebers 也兼容
    // 旧版: { events:[], clientAmount, ... } 或 hereNow content
    if (typeof payload.amount === 'number') {
      state.onlineCount = payload.amount;
    } else if (typeof payload.clientAmount === 'number') {
      state.onlineCount = payload.clientAmount;
    } else if (typeof payload.userAmount === 'number') {
      state.onlineCount = payload.userAmount;
    }

    const listSource = Array.isArray(payload.members) ? payload.members
      : Array.isArray(payload.memebers) ? payload.memebers
      : Array.isArray(payload.users) ? payload.users
      : null;

    if (listSource) {
      // 全量成员列表（hereNow / presence 事件自带 members）——始终覆盖并同步人数
      state.onlineMembers = listSource.map(normalizeMember);
      if (typeof payload.amount === 'number') {
        state.onlineCount = payload.amount;
      } else if (typeof payload.clientAmount === 'number') {
        state.onlineCount = payload.clientAmount;
      } else {
        state.onlineCount = state.onlineMembers.length;
      }
      listUpdated = true;
    } else if (Array.isArray(payload.events)) {
      payload.events.forEach(function (ev) {
        const action = ev.action;
        const member = {
          id: ev.userId || (ev.member && ev.member.id),
          data: ev.userData || (ev.member && ev.member.data)
        };
        const mid = member.id;
        if (!mid) return;
        if (action === 'join' || action === 'online' || action === 'back') {
          const norm = normalizeMember(member);
          const idx = state.onlineMembers.findIndex(m => m.id === mid);
          if (idx >= 0) state.onlineMembers[idx] = norm;
          else state.onlineMembers.unshift(norm);
          listUpdated = true;
        } else if (action === 'leave' || action === 'offline' || action === 'timeout') {
          const before = state.onlineMembers.length;
          state.onlineMembers = state.onlineMembers.filter(m => m.id !== mid);
          if (state.onlineMembers.length !== before) listUpdated = true;
        }
      });
      if (typeof payload.clientAmount === 'number') {
        state.onlineCount = payload.clientAmount;
      } else if (listUpdated) {
        state.onlineCount = state.onlineMembers.length;
      }
    } else if (payload.member && payload.action) {
      const mid = payload.member.id;
      const action = payload.action;
      if (action === 'join' || action === 'set' || action === 'online' || action === 'back') {
        const norm = normalizeMember(payload.member);
        const idx = state.onlineMembers.findIndex(m => m.id === mid);
        if (idx >= 0) state.onlineMembers[idx] = norm;
        else state.onlineMembers.unshift(norm);
        listUpdated = true;
      } else if (action === 'leave' || action === 'offline' || action === 'timeout') {
        const before = state.onlineMembers.length;
        state.onlineMembers = state.onlineMembers.filter(m => m.id !== mid);
        if (state.onlineMembers.length !== before) listUpdated = true;
      }
      if (typeof payload.amount === 'number') state.onlineCount = payload.amount;
      else if (listUpdated) state.onlineCount = state.onlineMembers.length;
    }

    // 去重
    const seen = new Set();
    state.onlineMembers = state.onlineMembers.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    // 人数与列表不一致时，标记需要全量刷新
    const needFullRefresh = !opts.fromHereNow && (
      !listUpdated ||
      (typeof state.onlineCount === 'number' && state.onlineCount !== state.onlineMembers.length)
    );

    updateOnlineMembersUI();
    return needFullRefresh;
  }

  function subscribePresence() {
    if (!goEasy || !state.goEasyReady) return;
    try {
      goEasy.pubsub.subscribePresence({
        channel: PRESENCE_CHANNEL,
        membersLimit: 100,
        onPresence: function (presenceEvent) {
          try {
            console.log('[Presence] 事件:', presenceEvent);
            notifyPresenceJoin(presenceEvent);
            const needRefresh = applyPresencePayload(presenceEvent, { fromHereNow: false });
            // 有上下线变化或列表不完整时，立刻用 hereNow 拉全量，保证实时准确
            if (needRefresh || (presenceEvent && presenceEvent.action)) {
              scheduleHereNowRefresh(300);
            }
          } catch (e) {
            console.warn('Presence 事件处理异常', e);
            scheduleHereNowRefresh(500);
          }
        },
        onSuccess: function () {
          console.log('[Presence] 订阅成功 channel=', PRESENCE_CHANNEL);
          state.presenceReady = true;
          queryHereNow();
        },
        onFailed: function (error) {
          console.error('[Presence] 订阅失败', error);
          state.presenceReady = false;
          queryHereNow();
          setTimeout(() => {
            if (state.goEasyReady) subscribePresence();
          }, 8000);
        }
      });
    } catch (e) {
      console.error('[Presence] subscribePresence 异常', e);
      queryHereNow();
    }
  }

  function queryHereNow() {
    if (!goEasy || !state.goEasyReady) return;
    try {
      goEasy.pubsub.hereNow({
        channel: PRESENCE_CHANNEL,
        limit: 100,
        onSuccess: function (response) {
          try {
            console.log('[Presence] hereNow 响应:', response);
            const content = (response && response.content) ? response.content : response;
            if (content && content.channels && content.channels[PRESENCE_CHANNEL]) {
              applyPresencePayload(content.channels[PRESENCE_CHANNEL], { fromHereNow: true });
            } else {
              applyPresencePayload(content, { fromHereNow: true });
            }
          } catch (e) {
            console.warn('[Presence] hereNow 解析失败', e, response);
          }
        },
        onFailed: function (error) {
          console.warn('[Presence] hereNow 失败', error);
          tryLegacyHereNow();
        }
      });
    } catch (e) {
      console.warn('[Presence] hereNow 调用异常', e);
      tryLegacyHereNow();
    }
  }

  function tryLegacyHereNow() {
    if (!goEasy) return;
    try {
      // 兼容极旧 SDK：goEasy.hereNow(opts, callback)
      if (typeof goEasy.hereNow === 'function') {
        goEasy.hereNow({
          channels: [PRESENCE_CHANNEL],
          includeUsers: true,
          distinct: true
        }, function (response) {
          console.log('[Presence] legacy hereNow:', response);
          try {
            const content = (response && response.content) ? response.content : response;
            if (content && content.channels && content.channels[PRESENCE_CHANNEL]) {
              applyPresencePayload(content.channels[PRESENCE_CHANNEL]);
            } else if (content && content.channels) {
              const first = Object.values(content.channels)[0];
              if (first) applyPresencePayload(first);
            } else {
              applyPresencePayload(content);
            }
          } catch (err) {
            console.warn('[Presence] legacy 解析失败', err);
          }
        });
      }
    } catch (e) {
      console.warn('[Presence] legacy hereNow 不可用', e);
    }
  }

  function updateOnlineMembersUI() {
    const badge = document.getElementById('onlineCountBadge');
    const titleCount = document.getElementById('onlineMembersTitleCount');
    const list = document.getElementById('onlineMembersList');

    // 数字严格跟随当前成员列表长度，彻底避免 amount 旧值卡住角标
    const listLen = (state.onlineMembers && state.onlineMembers.length) || 0;
    const count = listLen;
    state.onlineCount = count;

    const label = count > 99 ? '99+' : String(count);
    if (badge) {
      if (badge.textContent !== label) {
        badge.textContent = label;
      }
      badge.classList.toggle('zero', count === 0);
    }
    if (titleCount) {
      const t = '(' + count + ')';
      if (titleCount.textContent !== t) {
        titleCount.textContent = t;
      }
    }
    if (!list) return;

    if (!listLen) {
      list.innerHTML = '<div class="online-members-empty">暂无在线成员</div>';
      return;
    }

    const html = state.onlineMembers.map(m => {
      const rawName = m.nickname || m.id || '匿名';
      const rawId = m.id || '';
      const name = esc(rawName);
      const idStr = esc(rawId);
      const initial = String(rawName || '?').charAt(0).toUpperCase();
      const isMe = (m.id === state.username) || (m.nickname === state.username);
      return `<div class="online-member-item" title="${idStr}">
        <div class="online-member-avatar">${esc(initial)}</div>
        <div class="online-member-info">
          <div class="online-member-name">${name}${isMe ? ' <span style="color:var(--cyan);font-size:11px;">(我)</span>' : ''}</div>
          <div class="online-member-id">${idStr}</div>
        </div>
        <div class="online-member-dot" title="在线"></div>
      </div>`;
    }).join('');
    list.innerHTML = html;
  }

  function bindOnlineMembersEvents() {
    const btn = document.getElementById('onlineMembersBtn');
    const modal = document.getElementById('onlineMembersModal');
    const closeBtn = document.getElementById('closeOnlineMembersBtn');
    if (!btn || !modal) return;

    let modalPollTimer = null;
    function startModalPoll() {
      if (modalPollTimer) clearInterval(modalPollTimer);
      // 打开弹窗时仅主动拉取一次，无需 2 秒高频轮询
      modalPollTimer = null;
    }
    function stopModalPoll() {
      if (modalPollTimer) {
        clearInterval(modalPollTimer);
        modalPollTimer = null;
      }
    }

    btn.addEventListener('click', () => {
      modal.classList.add('open');
      if (state.goEasyReady) queryHereNow();
      updateOnlineMembersUI();
      startModalPoll();
    });
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('open');
        stopModalPoll();
      });
    }
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
        stopModalPoll();
      }
    });

    // 页面重新可见时立即刷新在线状态
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.goEasyReady) {
        queryHereNow();
      }
    });
  }

  function sendPublicMessage(text, mediaOrFlag) {
    if (!text || !String(text).trim()) return;
    if (!state.username) {
      ensureUsername(() => {});
      showToast('⚠️ 请先设置用户名', 1500, false);
      return;
    }
    if (!goEasy || !state.goEasyReady) {
      showToast('⚠️ 聊天服务未连接', 2000, false);
      return;
    }
    const media = (mediaOrFlag && typeof mediaOrFlag === 'object') ? mediaOrFlag : null;
    const isVideoFlag = mediaOrFlag === true;
    const mediaType = media ? (media.mediaType || '') : (isVideoFlag ? 'video' : '');
    const msgId = generateMsgId();
    const msgObj = {
      id: msgId,
      text: String(text).trim(),
      sender: state.userId,
      senderName: state.username,
      senderId: state.userId,
      time: Date.now(),
      isImage: mediaType === 'image' || mediaType === 'video',
      mediaType: mediaType || undefined,
      url: media && media.url ? media.url : undefined,
      fileName: media && media.fileName ? media.fileName : undefined,
      fileSize: media && media.fileSize != null ? media.fileSize : undefined,
      mimeType: media && media.mimeType ? media.mimeType : undefined,
      isXor: media && media.isXor ? true : undefined,
    };
    const payload = JSON.stringify(msgObj);
    goEasy.pubsub.publish({
      channel: PUBLIC_CHANNEL,
      message: payload,
      qos: 1,
      onSuccess: function () {
        if (!state.publicMessages) state.publicMessages = [];
        const exists = state.publicMessages.some(m => m.id === msgId);
        if (!exists) {
          state.publicMessages.push(Object.assign({ isMine: true }, msgObj, { isXor: !!msgObj.isXor }));
          savePublicMessages();
        }
        renderPublicChat(true);
        const pubInput = document.getElementById('publicChatInput');
        if (pubInput) { pubInput.value = ''; pubInput.style.height = 'auto'; }
        setPublicUnread(false);
      },
      onFailed: function (error) {
        showToast('❌ 公共消息发送失败', 2000, false);
        console.error(error);
      }
    });
  }

  // ---- 渲染公共聊天（支持滚动位置恢复） ----
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
      if (saved !== null) {
        const maxScroll = container.scrollHeight - container.clientHeight;
        container.scrollTop = Math.min(saved, maxScroll);
      } else {
        container.scrollTop = 0;
      }
    }
  }

  function bindPublicChatEvents() {
    const openBtn = document.getElementById('openPublicChatBtn');
    const modal = document.getElementById('publicChatModal');
    const closeBtn = document.getElementById('closePublicChatBtn');
    const sendBtn = document.getElementById('publicChatSendBtn');
    const input = document.getElementById('publicChatInput');
    const plusBtn = document.getElementById('publicChatPlusBtn');
    const plusPanel = document.getElementById('publicChatPlusPanel');
    const voiceBtn = document.getElementById('publicChatVoiceBtn');
    const autoGrow = el => { if (!el) return; el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,120)+'px'; };
    [input, ...document.querySelectorAll('.chat-input')].forEach(el => el && el.addEventListener('input', () => autoGrow(el)));


    // 绑定滚动事件保存位置
    const pubContainer = document.getElementById('publicChatMessages');
    if (pubContainer && !pubContainer.dataset.scrollBound) {
      pubContainer.addEventListener('scroll', function() {
        savePublicScroll(this.scrollTop);
      });
      pubContainer.dataset.scrollBound = 'true';
    }

    if (!openBtn || !modal || !closeBtn || !sendBtn || !input) {
      console.warn('公共聊天 DOM 元素未找到，请检查 index.html');
      return;
    }

    openBtn.addEventListener('click', function() {
      state.publicModalOpen = true;
      modal.classList.add('open');
      setPublicUnread(false);
      renderPublicChat(false);

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
              renderPublicChat(false);
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
      if (sendPendingAttachment('public', input, true, null)) return;
      const text = input.value.trim();
      if (text) sendPublicMessage(text, false);
    });
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendBtn.click();
      }
    });
    bindPlusMenu(plusBtn, plusPanel, {
      image: function () { sendMessageWithMedia(null, input, null, true, 'image/*'); },
      video: function () { sendMessageWithMedia(null, input, null, true, 'video/*'); },
      file: function () { sendMessageWithMedia(null, input, null, true, '*/*'); },
    });
    if (voiceBtn) {
      voiceBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        startVoiceRecording(voiceBtn, function (file) {
          storeRecordedVoice(file, 'public', true);
        });
      });
    }
  }

  function reconnectChat() {
    if (state.goEasyReady) {
      if (Array.isArray(state.servers)) {
        state.servers.forEach(s => {
          if (s && s.id && !state.chatSubscribed[s.id]) {
            subscribeChannel(s.id);
          }
        });
      }
      if (!state.publicChatReady) {
        subscribePublicChannel();
      }
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

  // ---- 聊天链接点击：智能识别文件/网站 ----
  // - 文件(含 chat-media-download):直接调用内置下载器
  // - 网站:弹窗让用户选「系统 WebView」或「外部浏览器」
  // - 外部浏览器走 Java 原生 Intent(绕开 WebView intent:// 包装 bug,避免 ERR_UNKNOWN_URL_SCHEME)
  document.addEventListener('click', async function(e) {
    const link = e.target.closest('.chat-link');
    if (!link) return;
    e.preventDefault();
    e.stopPropagation();
    const url = link.dataset.url;
    if (!url) return;
    // 优先以 data-type 为准,缺失时即时判定
    const declared = link.dataset.type;
    const cls = declared ? { type: declared } : _classifyLink(url);
    if (cls.type === 'file') {
      // 抓文件名:有聊天文件卡片则用卡片名,否则用 URL 末段
      const fromCard = link.closest('.chat-media-file');
      const fileName = (fromCard && (fromCard.dataset.fileName || (fromCard.querySelector('.chat-media-file-name') || {}).textContent || '').trim())
        || (() => {
          try {
            const u = new URL(url, window.location.href);
            const last = (u.pathname || '').split('/').pop() || '';
            return last || '文件';
          } catch (_) { return '文件'; }
        })();
      await _builtInDownload(url, fileName, false);
      return;
    }
    // 网站域名:弹选择弹窗
    const choice = await _showLinkOpenChooser(url);
    if (choice === 'webview') {
      // 在当前 WebView 中打开(直接跳转)
      try { window.location.href = String(url); } catch (_) { showToast('❌ 打开失败', 2000, false); }
    } else if (choice === 'external') {
      // 走 Java 原生 Intent 启动外部浏览器
      const ok = _openExternalBrowser(url);
      if (!ok) showToast('❌ 无法启动外部浏览器', 2500, false);
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

      if (state.goEasyReady && Array.isArray(state.servers)) {
        state.servers.forEach(s => {
          if (s && s.id && !state.chatSubscribed[s.id]) {
            subscribeChannel(s.id);
          }
        });
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
  state.userId = getStoredUserId();
  loadChatMessages();
  loadPublicMessages();
  loadUnreadStatus();
  updateAllMessagesIsMine();
  restorePublicUnread();

  const addHost = document.getElementById('addHost');
  const addPort = document.getElementById('addPort');
  setupHostPortAutoFill(addHost, addPort);

  ensureGoEasySdk(() => initGoEasy());
  bindPublicChatEvents();
  bindOnlineMembersEvents();
  updateOnlineMembersUI();
  startPolling();

  // ===== 自动展开按钮控制 =====
  const toggleAutoBtn = document.getElementById('toggleAutoExpandBtn');
  if (toggleAutoBtn) {
    toggleAutoBtn.textContent = state.autoExpand ? '📂' : '📁';
    toggleAutoBtn.addEventListener('click', function() {
      const wasOn = state.autoExpand;
      state.autoExpand = !state.autoExpand;
      localStorage.setItem(AUTO_EXPAND_KEY, String(state.autoExpand));
      this.textContent = state.autoExpand ? '📂' : '📁';
      // 关闭自动展开时：清空 expanded 集合并立即收起所有已展开的卡片
      // 避免出现"已关掉自动展开但卡片还都展开着"的残留状态
      if (wasOn && !state.autoExpand) {
        state.expanded.clear();
        state.frozenCardId = null;
      }
      render();
      showToast(state.autoExpand ? '✅ 自动展开已开启' : '⛔ 自动展开已关闭，所有展开的卡片已收起', 1500, true);
    });
  }

  // ===== 手动远程更新前后端（哈希对比+toast） =====
  const updateModal = document.getElementById('updateModal');
  const updateStatus = document.getElementById('updateStatus');
  const manualUpdateBtn = document.getElementById('manualUpdateBtn');
  const updateFrontendBtn = document.getElementById('updateFrontendBtn');
  const updateBackendBtn = document.getElementById('updateBackendBtn');
  const updateAllBtn = document.getElementById('updateAllBtn');
  const closeUpdateModalBtn = document.getElementById('closeUpdateModalBtn');
  function openUpdateModal(){ if(updateModal) updateModal.classList.add('open'); checkRemoteUpdate(); }
  function closeUpdateModal(){ if(updateModal) updateModal.classList.remove('open'); }
  if(manualUpdateBtn) manualUpdateBtn.addEventListener('click', onManualUpdateIconClick);
  // 长按 ⬆️ 图标 → 打开手动更新模态框（细看哈希 + 选择更新策略）
  // 仅在原地按压（位移 < 10px）且按压时间达到 500ms 时触发，避免与导航栏拖拽手势冲突
  if (manualUpdateBtn) {
    let _upLongPressTimer = null;
    let _upLongPressed = false;
    let _upStartX = 0, _upStartY = 0;
    const cancelUpLongPress = () => {
      if (_upLongPressTimer) { clearTimeout(_upLongPressTimer); _upLongPressTimer = null; }
    };
    manualUpdateBtn.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button !== 0) return;
      _upLongPressed = false;
      _upStartX = e.clientX;
      _upStartY = e.clientY;
      cancelUpLongPress();
      _upLongPressTimer = setTimeout(() => {
        _upLongPressed = true;
        cancelUpLongPress();
        openUpdateModal();
      }, 500);
    });
    manualUpdateBtn.addEventListener('pointermove', (e) => {
      if (!_upLongPressTimer) return;
      const dx = e.clientX - _upStartX;
      const dy = e.clientY - _upStartY;
      if (dx * dx + dy * dy > 100) cancelUpLongPress(); // 位移 > 10px 视为拖拽
    }, { passive: true });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => manualUpdateBtn.addEventListener(ev, cancelUpLongPress, { passive: true }));
    manualUpdateBtn.addEventListener('click', (e) => {
      if (_upLongPressed) {
        e.preventDefault();
        e.stopImmediatePropagation();
        _upLongPressed = false;
      }
    }, true);
  }
  if(closeUpdateModalBtn) closeUpdateModalBtn.addEventListener('click', closeUpdateModal);
  if(updateModal) updateModal.addEventListener('click', e=>{ if(e.target===updateModal) closeUpdateModal(); });
  // 导航栏 ⬆️ 图标点击：拉取远程哈希，若有更新则弹确认弹窗让用户选择
  //  - 前端和后端都需更新：按需求优先更新前端（弹窗显示优先级）
  //  - 仅有其一需更新：弹窗提示是哪个，确认后直接更新
  //  - 都不需更新：toast 提示已是最新
  async function onManualUpdateIconClick() {
    if (!manualUpdateBtn || manualUpdateBtn.disabled) return;
    manualUpdateBtn.disabled = true;
    showToast('⏳ 正在检查前端和后端是否有更新…', 60000, true);
    try {
      const d = await getJSON('/api/update/check?_=' + Date.now());
      if (!d || d.ok === false) throw new Error((d && d.error) || '检查失败');
      const fe = d.frontend || {};
      const be = d.backend || {};
      const feNeed = !!fe.need_update;
      const beNeed = !!be.need_update;
      if (!feNeed && !beNeed) {
        // 无更新：toast 提示
        showToast('✅ 前后端已是最新', 1800, true);
        return;
      }
      // 有更新：弹"是否更新"的确认弹窗
      // 两端都需更新：按需求默认更新前端
      // 仅前端需更新：更新前端
      // 仅后端需更新：更新后端
      const targets = [];
      if (feNeed) targets.push({ key: 'frontend', label: '前端' });
      if (beNeed) targets.push({ key: 'backend', label: '后端' });
      let primary = 'frontend';
      if (feNeed && beNeed) {
        primary = 'frontend'; // 两端都需更新时优先前端
      } else if (!feNeed && beNeed) {
        primary = 'backend';
      }
      const confirmMsg = feNeed && beNeed
        ? '前端和后端都有新版本，是否开始更新？\n(将优先更新前端，更新完成后请重启应用)'
        : (feNeed
            ? '前端有新版本，是否立即更新？\n更新完成后请重启应用'
            : '后端有新版本，是否立即更新？\n更新完成后请重启应用');
      const ok = await _showUpdateConfirm(confirmMsg);
      if (!ok) {
        showToast('已取消更新', 1500, true);
        return;
      }
      // 用户确认：按 primary 更新；如果两端都需更新，确认后只更 primary（不自动更另一个）
      // 用户想都更则去模态框（长按图标进入）点"一键更新前后端"
      showToast('⏳ 正在更新' + (primary === 'frontend' ? '前端' : '后端') + '…', 2000, true);
      await doUpdate(primary);
    } catch (e) {
      showToast('❌ 更新检查失败：' + (e && e.message ? e.message : e), 3000, false);
    } finally {
      if (manualUpdateBtn) manualUpdateBtn.disabled = false;
    }
  }

  // 通用确认弹窗：返回 Promise<boolean>，true = 确认，false = 取消
  // 复用 .msg-action-menu 的遮罩 + .custom-modal-box 风格
  function _showUpdateConfirm(message) {
    return new Promise(function (resolve) {
      // 移除旧弹窗
      const old = document.getElementById('updateConfirmModal');
      if (old) old.remove();

      const modal = document.createElement('div');
      modal.id = 'updateConfirmModal';
      modal.className = 'custom-modal';
      modal.innerHTML =
        '<div class="custom-modal-box" style="width:min(360px,calc(100% - 32px));">' +
          '<div class="custom-modal-header">' +
            '<span>⬆️ 发现新版本</span>' +
            '<button class="custom-modal-close" type="button" aria-label="关闭">✕</button>' +
          '</div>' +
          '<div class="custom-modal-body">' +
            '<p style="margin:0 0 16px;font-size:14px;color:var(--ink);line-height:1.6;white-space:pre-line;">' + esc(message) + '</p>' +
            '<div style="display:flex;gap:10px;">' +
              '<button id="updateConfirmCancelBtn" type="button" style="flex:1;border:0;border-radius:12px;padding:11px;background:rgba(125,175,210,.15);color:var(--ink);font-weight:700;cursor:pointer;font-size:14px;transition:var(--transition);">取消</button>' +
              '<button id="updateConfirmOkBtn" type="button" style="flex:1;border:0;border-radius:12px;padding:11px;background:var(--cyan);color:#fff;font-weight:800;cursor:pointer;font-size:14px;transition:var(--transition);display:inline-flex;align-items:center;justify-content:center;gap:6px;">立即更新</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
      requestAnimationFrame(function () { modal.classList.add('open'); });

      function close(result) {
        if (modal.parentElement) modal.parentElement.removeChild(modal);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') close(false);
        else if (e.key === 'Enter') close(true);
      }
      modal.querySelector('.custom-modal-close').addEventListener('click', function () { close(false); });
      modal.querySelector('#updateConfirmCancelBtn').addEventListener('click', function () { close(false); });
      modal.querySelector('#updateConfirmOkBtn').addEventListener('click', function () { close(true); });
      modal.addEventListener('click', function (e) { if (e.target === modal) close(false); });
      document.addEventListener('keydown', onKey);
    });
  }
  async function checkRemoteUpdate(){
    if(!updateStatus) return;
    updateStatus.textContent = '⏳ 正在对比本地与远程哈希…';
    try{
      const d = await getJSON('/api/update/check?_='+Date.now());
      const fe = d.frontend||{}, be=d.backend||{};
      const feNeed = !!fe.need_update, beNeed=!!be.need_update;
      const rowStyle = 'display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(125,175,210,.08);border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.4;word-break:break-all;';
      const badge = (need)=> need ? '<span style="flex-shrink:0;background:linear-gradient(135deg,#ff8a3d,#ff5a3d);color:#fff;font-weight:800;font-size:11px;padding:3px 8px;border-radius:999px;">需要更新</span>' : '<span style="flex-shrink:0;background:rgba(25,200,174,.15);color:#178a78;font-weight:800;font-size:11px;padding:3px 8px;border-radius:999px;">已是最新</span>';
      const hashLine = (local,remote)=> `<span style="font-family:monospace;opacity:.95;">${(local||'—').slice(0,8)} → ${(remote||'—').slice(0,8)}</span>`;
      updateStatus.innerHTML = `
        <div style="${rowStyle}"><span style="font-weight:800;">🖼️ 前端</span><span style="display:flex;align-items:center;gap:8px;">${hashLine(fe.local_exists===false?null:fe.local_hash, fe.remote_hash)}${badge(feNeed)}</span></div>
        <div style="${rowStyle}"><span style="font-weight:800;">⚙️ 后端</span><span style="display:flex;align-items:center;gap:8px;">${hashLine(be.local_hash, be.remote_hash)}${badge(beNeed)}</span></div>
        ${(!fe.remote_available||!be.remote_available)?'<div style="color:#d87a00;font-size:12px;text-align:center;">⚠️ 远程不可达，请检查网络</div>':''}
      `;
      // 点击更新图片时如果检测到有更新就出现对应 toast
      if(feNeed) showToast('🔔 检测到前端有更新', 2500, true);
      else if(beNeed) showToast('🔔 检测到后端有更新', 2500, true);
      if(!feNeed && !beNeed && fe.remote_available && be.remote_available) showToast('✅ 前后端已是最新', 1500, true);
    }catch(e){ updateStatus.textContent = '❌ 检查失败: '+e.message; showToast('❌ 更新检查失败: '+e.message, 2500, false); }
  }
  async function doUpdate(target){
    const btn = target==='frontend'?updateFrontendBtn:target==='backend'?updateBackendBtn:updateAllBtn;
    if(btn) { btn.disabled=true; btn.style.opacity='0.6'; }
    try{
      if(target==='all'){
        showToast('⏳ 正在更新前后端…', 2000, true);
        const r = await fetch('/api/update/all', {method:'POST', headers:{'Content-Type':'application/json'}, body: '{}'});
        const d = await r.json().catch(()=>({}));
        if(!r.ok||!d.ok) throw new Error(d.error||'更新失败');
        const fe = d.frontend||{}, be=d.backend||{};
        if(fe.skipped) showToast('ℹ️ 前端已是最新，已跳过更新', 2000, true);
        else if(fe.ok) showToast('✅ 前端更新完成请重启应用', 3000, true);
        else showToast('❌ 前端更新失败: '+(fe.error||''), 3000, false);
        // 稍延后显示后端 toast，避免被前端 toast 覆盖
        setTimeout(()=>{
          if(be.skipped) showToast('ℹ️ 后端已是最新，已跳过更新', 2000, true);
          else if(be.ok) showToast('✅ 后端更新完成请重启应用', 3000, true);
          else showToast('❌ 后端更新失败: '+(be.error||''), 3000, false);
        }, fe.ok&&!fe.skipped? 1600: 200);
        await checkRemoteUpdate();
      } else {
        const label = target==='frontend'?'前端':'后端';
        showToast('⏳ 正在更新'+label+'…', 2000, true);
        const r = await fetch('/api/update/'+target, {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
        const d = await r.json().catch(()=>({}));
        if(!r.ok||!d.ok) throw new Error(d.error||'更新失败');
        if(d.skipped){ showToast('ℹ️ '+label+'已是最新，已跳过更新', 2000, true); }
        else { showToast('✅ '+label+'更新完成请重启应用', 3000, true); }
        await checkRemoteUpdate();
      }
    }catch(e){ showToast('❌ 更新失败: '+e.message, 3000, false); }
    finally{ if(btn){ btn.disabled=false; btn.style.opacity=''; } }
  }
  if(updateFrontendBtn) updateFrontendBtn.addEventListener('click', ()=>doUpdate('frontend'));
  if(updateBackendBtn) updateBackendBtn.addEventListener('click', ()=>doUpdate('backend'));
  if(updateAllBtn) updateAllBtn.addEventListener('click', ()=>doUpdate('all'));

  // ===== 每次启动自动检查一次前后端是否有更新（仅有更新时 toast） =====
  async function checkUpdateOnStartup() {
    try {
      if (!navigator.onLine) return;
      const d = await getJSON('/api/update/check?_=' + Date.now());
      if (!d || d.ok === false) return;
      const fe = d.frontend || {};
      const be = d.backend || {};
      const feNeed = !!fe.need_update;
      const beNeed = !!be.need_update;
      if (feNeed && beNeed) {
        showToast('🔔 检测到前端和后端有更新，点击 ⬆️ 可更新', 3500, true);
      } else if (feNeed) {
        showToast('🔔 检测到前端有更新，点击 ⬆️ 可更新', 3000, true);
      } else if (beNeed) {
        showToast('🔔 检测到后端有更新，点击 ⬆️ 可更新', 3000, true);
      }
    } catch (e) {
      console.warn('[更新] 启动检查失败', e);
    }
  }
  // 延后执行，避开首屏加载与网络检测
  setTimeout(checkUpdateOnStartup, 2500);

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
    if (presenceRefreshTimer) clearInterval(presenceRefreshTimer);
  });


  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', __lanPlayInit);
  } else {
    __lanPlayInit();
  }
})();

// 动态创建的服务器聊天框也支持 QQ 式自动换行扩展
if (!window.__chatAutoGrowBound) {
  window.__chatAutoGrowBound = true;
  document.addEventListener('input', function(e) {
    if (!e.target.matches('.chat-input, #publicChatInput')) return;
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  });
}

