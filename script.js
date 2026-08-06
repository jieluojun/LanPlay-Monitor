(() => {
  'use strict';

  function __lanPlayInit() {

  'use strict';

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
  border-radius: 10px;
  display: block;
  margin-top: 4px;
  cursor: zoom-in;
  object-fit: cover;
  background: rgba(0,0,0,.06);
}
.chat-media-video {
  max-width: 240px;
  max-height: 200px;
  border-radius: 10px;
  display: block;
  margin-top: 4px;
  background: #000;
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

/* 图片放大灯箱 */
.chat-lightbox {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0,0,0,.82);
  display: none;
  align-items: center;
  justify-content: center;
  padding: 24px;
  cursor: zoom-out;
}
.chat-lightbox.open {
  display: flex;
}
.chat-lightbox-img {
  max-width: min(96vw, 1100px);
  max-height: 90vh;
  border-radius: 8px;
  object-fit: contain;
  box-shadow: 0 12px 40px rgba(0,0,0,.45);
  cursor: default;
}
.chat-lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: rgba(255,255,255,.15);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
}
.chat-lightbox-close:hover {
  background: rgba(255,255,255,.28);
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
.chat-msg video,
.chat-msg audio {
  -webkit-touch-callout: none !important;
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
.chat-video-wrap { display:inline-block; max-width:100%; }

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
      <button id="copyPluginBtn" class="icon-btn" title="点击复制最新版联机插件地址">🎮</button>
      <button id="openAddModalBtn" class="icon-btn" title="添加自定义服务器">➕</button>
      <button id="resetOrderBtn" class="icon-btn" title="恢复默认排序">🔄</button>
      <button id="dpiToggleBtn" class="icon-btn" title="调节界面缩放 (DPI)">🔍</button>
      <button id="manualUpdateBtn" class="icon-btn" title="检查并更新前后端">⬆️</button>
      <button id="toggleAutoExpandBtn" class="icon-btn" title="切换自动展开房间">📂</button>
      <button id="openPublicChatBtn" class="icon-btn public-chat-btn" title="公共聊天">
        <span class="public-chat-icon">💬</span>
        <span id="publicUnreadBadge" class="online-count-badge zero">0</span>
      </button>
      <button id="onlineMembersBtn" class="icon-btn online-members-btn" title="在线成员">
        <span class="online-icon">👥</span>
        <span id="onlineCountBadge" class="online-count-badge">0</span>
      </button>
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
        <p style="margin:0 0 20px;font-size:14px;color:var(--ink);line-height:1.6;">确定要恢复默认排序吗？当前自定义排序将被清除。</p>
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
      __sdkEl.src = 'https://cdn.goeasy.io/goeasy-2.11.1.min.js';
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
        downloadHtml = `<a class="chat-media-download" href="${esc(url)}" download target="_blank" rel="noopener noreferrer">下载视频</a>`;
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
  // XOR 解密并下载：fetch → 解密 → Blob → 触发浏览器下载
  async function _xorDecryptAndDownload(url, originalName, mimeType) {
    try {
      showToast('⏳ 正在下载…', 60000, true);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('下载失败 HTTP ' + resp.status);
      const buf = await resp.arrayBuffer();
      _xorBuffer(buf);
      const blob = new Blob([buf], { type: mimeType || 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = originalName || 'file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      showToast('✅ 下载完成', 1200, true);
    } catch (e) {
      showToast('❌ 下载失败：' + e.message, 3000, false);
    }
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
    chunks: [],
    stream: null,
    timer: null,
    startedAt: 0,
    activeBtn: null,
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
    btn.textContent = '🎤';
    btn.title = '按住或点击录制语音';
  }

  function cancelVoiceRecording() {
    if (_voiceRecordState.timer) {
      clearInterval(_voiceRecordState.timer);
      _voiceRecordState.timer = null;
    }
    if (_voiceRecordState.recorder && _voiceRecordState.recorder.state !== 'inactive') {
      try { _voiceRecordState.recorder.onstop = null; _voiceRecordState.recorder.stop(); } catch (e) { /* ignore */ }
    }
    _voiceRecordState.recorder = null;
    _voiceRecordState.chunks = [];
    stopVoiceTracks();
    resetVoiceBtn(_voiceRecordState.activeBtn);
    _voiceRecordState.activeBtn = null;
  }

  async function startVoiceRecording(btn, onBlob) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('❌ 当前环境不支持录音', 2500, false);
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      showToast('❌ 浏览器不支持 MediaRecorder', 2500, false);
      return;
    }
    // 已在录制：再次点击 → 停止并发送
    if (_voiceRecordState.recorder && _voiceRecordState.recorder.state === 'recording') {
      finishVoiceRecording(onBlob);
      return;
    }
    cancelVoiceRecording();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      _voiceRecordState.stream = stream;
      _voiceRecordState.chunks = [];
      let mime = '';
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      for (let i = 0; i < candidates.length; i++) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(candidates[i])) {
          mime = candidates[i];
          break;
        }
      }
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      _voiceRecordState.recorder = recorder;
      _voiceRecordState.activeBtn = btn;
      _voiceRecordState.startedAt = Date.now();
      recorder.ondataavailable = function (ev) {
        if (ev.data && ev.data.size > 0) _voiceRecordState.chunks.push(ev.data);
      };
      recorder.onstop = async function () {
        if (_voiceRecordState.timer) {
          clearInterval(_voiceRecordState.timer);
          _voiceRecordState.timer = null;
        }
        const chunks = _voiceRecordState.chunks.slice();
        const usedMime = recorder.mimeType || mime || 'audio/webm';
        stopVoiceTracks();
        resetVoiceBtn(btn);
        _voiceRecordState.recorder = null;
        _voiceRecordState.activeBtn = null;
        if (!chunks.length) {
          showToast('⚠️ 未录到声音', 1500, false);
          return;
        }
        const blob = new Blob(chunks, { type: usedMime });
        if (blob.size < 256) {
          showToast('⚠️ 录音太短', 1500, false);
          return;
        }
        const ext = usedMime.indexOf('mp4') >= 0 ? 'm4a' : (usedMime.indexOf('ogg') >= 0 ? 'ogg' : 'webm');
        const file = new File([blob], 'voice_' + Date.now() + '.' + ext, { type: usedMime });
        if (typeof onBlob === 'function') onBlob(file);
      };
      recorder.start(200);
      btn.classList.add('recording');
      btn.textContent = '⏹';
      btn.title = '点击停止并发送';
      showToast('🎙 正在录音… 再次点击停止发送', 2000, true);
      _voiceRecordState.timer = setInterval(function () {
        const sec = Math.floor((Date.now() - _voiceRecordState.startedAt) / 1000);
        btn.textContent = '⏹' + sec + 's';
        if (sec >= 60) finishVoiceRecording(onBlob);
      }, 500);
    } catch (e) {
      console.warn('录音失败', e);
      cancelVoiceRecording();
      showToast('❌ 无法开始录音：' + (e.message || '权限被拒绝'), 3000, false);
    }
  }

  function finishVoiceRecording(onBlob) {
    const recorder = _voiceRecordState.recorder;
    if (!recorder || recorder.state === 'inactive') {
      cancelVoiceRecording();
      return;
    }
    try {
      recorder.stop();
    } catch (e) {
      cancelVoiceRecording();
    }
  }

  // 语音上传后进入待发送状态，由发送按钮统一发送。

  // ---- 链接识别（URL、域名、IPv4、IPv6）- 不追加协议头 ----
  function linkifyText(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?|\b(?:(?:[0-9]{1,3}\.){3}[0-9]{1,3}|(?:[0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}|::[0-9a-fA-F]{1,4}|[0-9a-fA-F]{1,4}::)\b)/g;
    return text.replace(urlRegex, function(match) {
      const cleaned = match.replace(/[.,;:!?]+$/, '');
      return `<span class="chat-link" data-url="${esc(cleaned)}">${esc(match)}</span>`;
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
      let fname = _restoreBlockedExt(parts[1] || '文件');
      // .dlp 后缀表示 XOR 加密文件
      const isXor = fname.toLowerCase().endsWith('.dlp');
      if (isXor) fname = fname.replace(/\.dlp$/i, '');
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

  function openImageLightbox(url) {
    let overlay = document.getElementById('chatImageLightbox');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'chatImageLightbox';
      overlay.className = 'chat-lightbox';
      overlay.innerHTML = '<img class="chat-lightbox-img" alt="预览"><button type="button" class="chat-lightbox-close" aria-label="关闭">✕</button>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay || e.target.classList.contains('chat-lightbox-close')) {
          overlay.classList.remove('open');
        }
      });
    }
    const img = overlay.querySelector('.chat-lightbox-img');
    if (img) img.src = url;
    overlay.classList.add('open');
  }

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
        return `<span class="chat-image-wrap"><img class="chat-media-img" src="${esc(url)}" alt="图片" loading="lazy" data-full="${esc(url)}" title="点击放大"></span>`;
      }
      if (type === 'video') {
        return `<span class="chat-video-wrap"><video class="chat-media-video" src="${esc(url)}" controls playsinline preload="metadata"></video></span>`;
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

  function startMsgLongPress(row, x, y) {
    cancelMsgLongPress();
    longPressingMsg = true;
    pressStartX = x;
    pressStartY = y;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      const id = row.dataset.msgId;
      if (!id) return;
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
    if (!row) return;
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
    if (old) old.remove();

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

    function close() {
      // 立即重置长按状态，恢复卡片可拖动
      longPressingMsg = false;
      restoreCardDrag();
      // 立即移除遮罩 DOM，彻底杜绝 transition 残留灰色遮罩
      const mask = menu.querySelector('.msg-action-mask');
      if (mask) mask.remove();
      menu.classList.remove('open');
      setTimeout(() => { if (menu.parentElement) menu.remove(); }, 200);
    }

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

  // 委托：聊天图片点击放大
  document.addEventListener('click', function (e) {
    const img = e.target.closest('.chat-media-img');
    if (img && img.dataset.full) {
      e.preventDefault();
      e.stopPropagation();
      openImageLightbox(img.dataset.full);
    }
  });

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
          appkey: 'BC-e891108825ab43fb97dabe3327478e30',
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
        loadChannelHistory(channel, message => handleChatMessage(serverId, message.content));
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
    if (!goEasy || !state.goEasyReady) return;
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
        loadChannelHistory(PUBLIC_CHANNEL, message => {
          try { const msg = JSON.parse(message.content);
            if (msg.type === 'delete' && msg.id) { markMsgDeleted(msg.id); state.publicMessages = (state.publicMessages||[]).filter(m=>m.id!==msg.id); return; }
            if (_deletedMsgIds.has(msg.id)) return;
            if (!state.publicMessages.some(m => m.id === msg.id)) {
              const isMine=(msg.senderId===state.userId)||(msg.sender===state.userId)||(msg.sender===state.username);
              const restored = Object.assign({}, msg, {isMine, senderName:msg.senderName||msg.sender, senderId:msg.senderId||'', fileName:_restoreBlockedExt(msg.fileName||''), isXor:!!msg.isXor});
            state.publicMessages.push(restored);
            }
          } catch(e) {}
        });
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
          if (state.goEasyReady) {
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
    // 后台每 5 秒刷新；弹窗打开时在 bind 里会加速
    presenceRefreshTimer = setInterval(() => {
      if (!state.goEasyReady || document.hidden) return;
      queryHereNow();
    }, 5000);
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
      modalPollTimer = setInterval(() => {
        if (state.goEasyReady && modal.classList.contains('open')) {
          queryHereNow();
        }
      }, 2000);
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
      state.autoExpand = !state.autoExpand;
      localStorage.setItem(AUTO_EXPAND_KEY, String(state.autoExpand));
      this.textContent = state.autoExpand ? '📂' : '📁';
      render();
      showToast(state.autoExpand ? '✅ 自动展开已开启' : '⛔ 自动展开已关闭', 1200, true);
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
  if(manualUpdateBtn) manualUpdateBtn.addEventListener('click', openUpdateModal);
  if(closeUpdateModalBtn) closeUpdateModalBtn.addEventListener('click', closeUpdateModal);
  if(updateModal) updateModal.addEventListener('click', e=>{ if(e.target===updateModal) closeUpdateModal(); });
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

