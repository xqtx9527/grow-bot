// The Grow Bot surface: one more layer over everything else, for the minimal
// black-white-grey layout: 260px column, 96px Bot card, monochrome bubbles and a
// floating white composer. Colours come from the theme's --bt-* variables.
export const GROW_BOT_CSS = `
body{--bt-font:-apple-system,BlinkMacSystemFont,"PingFang SC","SF Pro Text","Helvetica Neue",Arial,sans-serif}
/* Left column */
.bt-side-actions{display:flex;align-items:center;justify-content:flex-start;gap:6px;padding:10px 12px 0}
.bt-side-actions .bt-round{width:30px;height:30px;background:none;color:var(--bt-ink-2)}
.bt-side-actions .bt-round:hover{background:#f0f0f0;color:var(--bt-ink)}
body[data-ds-dark-theme] .bt-side-actions .bt-round:hover{background:#242424}
.bt-tile-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0 8px}
.bt-tile{width:96px;height:96px;border:0;border-radius:50%!important;overflow:hidden;background:#f0f0f0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background-color .15s ease-out}
.bt-tile:hover{background:#e9e9e9}
.bt-tile-name{font-size:14px;font-weight:600;color:var(--bt-ink)}
body[data-ds-dark-theme] .bt-tile{background:#242424}
body[data-ds-dark-theme] .bt-tile:hover{background:#2c2c2c}
.bt-row{min-height:44px;padding:5px 8px;border-radius:10px;gap:10px;transition:background-color .15s ease-out}
.bt-row:hover{background:#f4f4f4}
.bt-row[aria-current=page]{background:#ededed}
body[data-ds-dark-theme] .bt-row:hover{background:#202020}
body[data-ds-dark-theme] .bt-row[aria-current=page]{background:#262626}
.bt-row-name{font-size:14px;line-height:20px;font-weight:500}
.bt-row-preview{font-size:12px;line-height:17px;color:#8a8a8a}
/* Chat */
.bt-head{height:44px}
.bt-pill{height:38px;border:0;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.06)}
body[data-ds-dark-theme] .bt-pill{background:#1c1c1c;box-shadow:0 2px 10px rgba(0,0,0,.35)}
.bt-time-sep{font-size:12px;line-height:16px;color:#8a8a8a;margin:16px 0 10px}
.bt-msg,.bt-umsg{animation:bt-msg-in-soft .15s ease-out both}
@keyframes bt-msg-in-soft{from{opacity:0;translate:0 4px}to{opacity:1;translate:0 0}}
.bt-bubble{border-radius:22px;padding:11px 16px;max-width:min(70%,100%);font-size:14px;line-height:1.6;background:var(--bt-bubble);color:var(--bt-ink)}
.bt-ubody{border-radius:22px;padding:11px 16px;font-size:14px;line-height:1.6;background:var(--bt-user);color:var(--bt-user-ink)}
[class*="_userRow"] [class*="_bubble"],[data-chat-flow-kind=question-reply] [class*="_bubble"],[data-chat-flow-kind=command-input] [class*="_bubble"]{border-radius:22px!important;padding:11px 16px!important;font-size:14px!important;line-height:1.6!important}
/* Composer: a white capsule floating 16px above the bottom */
[data-composer-card]{border:0!important;border-radius:22px!important;background:#fff!important;box-shadow:0 4px 24px rgba(0,0,0,.06)!important}
body[data-ds-dark-theme] [data-composer-card]{background:#1c1c1c!important;box-shadow:0 4px 24px rgba(0,0,0,.4)!important}
[class*="_root"]:has(> [data-composer-card]){padding:0 16px 16px!important}
[data-composer-card] button[class*="_primary"],.bt-voice{background:#111!important;color:#fff!important}
body[data-ds-dark-theme] [data-composer-card] button[class*="_primary"],body[data-ds-dark-theme] .bt-voice{background:#f2f2f2!important;color:#111!important}
body[data-bt-bot-accent] [data-composer-card] button[class*="_primary"],body[data-bt-bot-accent] .bt-voice{background:var(--bt-accent)!important;color:var(--bt-accent-ink)!important}
body[data-bt-bot-accent] .bt-ubody,body[data-bt-bot-accent] [class*="_userRow"] [class*="_bubble"]{background:var(--bt-accent)!important;color:var(--bt-accent-ink)!important}
/* Bottom-left: the account picture and name, nothing else */
.bt-user-foot{display:flex;align-items:center;gap:9px;width:100%;margin:0;padding:8px;border:0;border-radius:12px;background:none;color:var(--bt-ink);font:inherit;cursor:pointer;transition:background-color .15s ease-out}
.bt-user-foot:hover{background:#f4f4f4}
body[data-ds-dark-theme] .bt-user-foot:hover{background:#202020}
.bt-user-pic{width:32px;height:32px;border-radius:50%!important;clip-path:circle(50% at 50% 50%);object-fit:cover;flex:none;display:block;background:#f0f0f0}
.bt-user-none{box-shadow:inset 0 0 0 1px var(--bt-line)}
.bt-user-row{display:flex;align-items:center;gap:8px;width:100%;min-width:0}
.bt-user-row .bt-user-foot{flex:1 1 auto;min-width:0;width:auto}
.bt-user-connectors{flex:none;margin-left:auto;display:grid;place-items:center;width:36px;height:36px;padding:0;border:1px solid var(--bt-line);border-radius:50%;background:var(--bt-main);color:var(--bt-ink);cursor:pointer}
.bt-user-connectors:hover{background:var(--bt-hover)}
.bt-user-name{font-size:14px;line-height:20px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-leftcol-foot{padding:8px 8px 10px}
/* Right panel */
.bt-panel{border-left:0!important;background:#fafafa!important}
body[data-ds-dark-theme] .bt-panel{background:#161616!important}
.bt-panel .bt-card,.bt-panel [class*="_card"]{border-radius:16px!important}
/* Motion: 150ms ease-out everywhere */
:is(.bt-row,.bt-tile,.bt-pill,.bt-send,.bt-soft,.bt-icon-btn,.bt-avedit-tab,.bt-shape,.bt-color,.bt-plus,.bt-mic,.bt-voice,.bt-shape-row button){transition-duration:.15s!important;transition-timing-function:ease-out!important}
/* Create Bot: one white card in the middle of the window, as Grok Bot shows it */
.bt-create{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(10,10,10,.18);padding:24px;box-sizing:border-box}
.bt-create-card{width:min(500px,100%);height:min(700px,calc(100vh - 48px));max-height:calc(100vh - 48px);background:var(--bt-card);border-radius:30px;box-shadow:0 24px 80px rgba(0,0,0,.22);display:flex;flex-direction:column;overflow:hidden}
.bt-create-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 0;border-bottom:0;min-height:0}
.bt-create-title{font-size:16px;line-height:22px;font-weight:600}
.bt-add-overlay{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:rgba(10,10,10,.18);color:var(--bt-ink);font-family:var(--bt-font)}
.bt-add-card{width:min(500px,100%);height:min(700px,calc(100vh - 48px));max-height:calc(100vh - 48px);overflow:auto;box-sizing:border-box;background:var(--bt-card);border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.22);padding:20px;display:flex;flex-direction:column}
.bt-add-head{display:flex;align-items:center;justify-content:space-between;font-size:16px;margin-bottom:16px}
.bt-add-head .bt-icon-btn{font-size:24px}
.bt-add-tabs{display:flex;gap:4px;padding:4px;margin:0 20px 8px;background:var(--bt-hover);border-radius:14px}
.bt-add-card .bt-add-tabs{margin:0 0 16px}
.bt-add-tabs button{flex:1;border:0;border-radius:11px;padding:9px 12px;background:transparent;color:var(--bt-ink-2);font:inherit;cursor:pointer}
.bt-add-tabs button[aria-pressed=true]{background:var(--bt-card);color:var(--bt-ink);box-shadow:0 1px 4px rgba(0,0,0,.1)}
.bt-add-options,.bt-add-group{display:flex;flex-direction:column;gap:10px}
.bt-add-group{flex:1;min-height:0}.bt-add-group .bt-add-list{flex:1;max-height:none}.bt-add-group .bt-create-foot{margin-top:auto}
.bt-add-bot-form{flex:1;min-height:0;display:flex;flex-direction:column}.bt-add-bot-form .bt-create-body{padding:4px 0 0}.bt-add-bot-form .bt-shape-row{gap:2px;grid-template-columns:repeat(5,1fr)}.bt-add-bot-form .bt-shape{aspect-ratio:auto;height:60px}.bt-add-bot-form .bt-create-looks{width:min(360px,100%);align-self:center}.bt-add-bot-form .bt-colors{gap:10px;padding:8px 4px}
.bt-add-card [hidden]{display:none!important}
/* Switching creation types changes only the content: no panel or control motion. */
.bt-add-overlay,.bt-add-card,.bt-add-head,.bt-add-tabs,.bt-add-tabs button,.bt-add-bot-form,.bt-add-group,.bt-add-group .bt-token,.bt-add-bot-form .bt-create-body,.bt-add-bot-form .bt-create-looks,.bt-add-bot-form .bt-shapes,.bt-add-bot-form .bt-colors{animation:none!important;transition:none!important}
.bt-add-options>button,.bt-add-list>button{display:flex;align-items:center;gap:12px;width:100%;border:0;border-radius:16px;background:var(--bt-hover);color:var(--bt-ink);padding:13px;text-align:left;font:inherit;cursor:pointer}
.bt-add-options>button:hover,.bt-add-list>button:hover{background:var(--bt-active)}
.bt-add-icon{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:12px;background:var(--bt-card)}
.bt-add-prompt{font-size:14px;color:var(--bt-ink-2)}
.bt-add-selected{display:flex;flex-wrap:wrap;gap:6px}
.bt-add-search{box-sizing:border-box;width:100%;border:1px solid var(--bt-line-2);border-radius:14px;background:var(--bt-main);color:var(--bt-ink);padding:12px;font:inherit;outline:none}
.bt-add-list{display:flex;flex-direction:column;gap:4px;max-height:260px;overflow:auto}
.bt-add-list>button{background:transparent;padding:9px 12px}
.bt-add-hint{margin-left:auto;font-size:12px;color:var(--bt-ink-2)}
.bt-create-body{display:flex;flex-direction:column;gap:12px;padding:4px 20px 16px;overflow-y:auto}
.bt-create .bt-shapes{gap:2px}
.bt-create .bt-shape-row{gap:2px;grid-template-columns:repeat(5,1fr)}
.bt-create .bt-shape{aspect-ratio:auto;height:60px}
.bt-create .bt-create-looks{width:min(360px,100%);align-self:center}
.bt-create .bt-colors{gap:10px;padding:8px 4px}
.bt-create .bt-create-looks{padding-top:2px}
.bt-create-preview{justify-content:center;padding:10px 0 2px}
.bt-create-input{width:100%;height:42px;box-sizing:border-box;border:1px solid var(--bt-line-2);border-radius:14px;background:var(--bt-card);color:var(--bt-ink);font:inherit;font-size:14px;text-align:center;outline:none;padding:0 16px}
body[data-ds-dark-theme] .bt-create-input{background:#242424}
.bt-create-input::placeholder{color:#8a8a8a}
.bt-create-looks{padding:0;border:0;background:transparent;gap:10px}
.bt-create-model{display:flex;align-items:center;gap:10px}
.bt-create-model-label{flex:none;font-size:12px;line-height:18px;color:#8a8a8a}
.bt-create-model .bt-model-trigger{flex:1 1 auto;max-width:none}
.bt-create-foot{justify-content:flex-end;gap:8px;padding-top:4px;margin-top:2px}
.bt-create-go{height:36px;padding:0 18px;border-radius:999px}
.bt-model-menu{z-index:110!important}


/* Compact roster and a quiet conversation surface. */
.bt-side-actions{justify-content:flex-end;gap:8px;padding:8px 0 0}
.bt-side-actions .bt-round{width:34px;height:34px;background:var(--bt-card);color:var(--bt-ink)}
.bt-tile-wrap{gap:4px;padding:22px 0 22px}
.bt-tile,.bt-tile:hover,body[data-ds-dark-theme] .bt-tile,body[data-ds-dark-theme] .bt-tile:hover{width:96px;height:96px;padding:0;background:transparent;box-shadow:none;overflow:visible}
.bt-tile-name{font-size:13px;font-weight:400}
.bt-leftcol{background:var(--bt-sidebar)!important;border-right:1px solid var(--bt-line)!important;box-shadow:none!important}
.bt-panel{background:var(--bt-main)!important;border-left:1px solid var(--bt-line)!important;box-shadow:none!important}
.bt-bubble{box-shadow:none!important}
.bt-ubody{background:var(--bt-user)!important;color:var(--bt-user-ink)!important}
.bt-pill{box-shadow:0 2px 10px color-mix(in srgb,var(--bt-ink) 7%,transparent)!important}
[data-composer-card]{border-radius:22px!important;box-shadow:0 3px 16px color-mix(in srgb,var(--bt-ink) 7%,transparent)!important}
/* The roster, conversation, and details use the same quiet card language. */
.bt-side-actions{padding:10px 2px 0}
.bt-side-actions .bt-round{width:36px;height:36px;border:1px solid var(--bt-line);border-radius:50%;background:var(--bt-card)}
.bt-tile-wrap{padding:22px 0 20px;gap:6px}
.bt-tile-name{font-size:14px;font-weight:500}
.bt-row{min-height:46px;padding:4px 8px;border-radius:12px}
.bt-row[aria-current=page]{background:var(--bt-hover)}
.bt-row-name{font-weight:500}
.bt-row-preview{color:var(--bt-ink-2)}
.bt-bubble,.bt-ubody{border-radius:18px!important;padding:12px 16px!important;line-height:1.6}
.bt-msg:not(:first-child)>.bt-msg-line>.bt-bubble,.bt-msg:not(:last-child)>.bt-msg-line>.bt-bubble{border-radius:18px!important}
.bt-panel{background:var(--bt-sidebar)!important}
.bt-drawer-id{padding:16px 16px 0}
.bt-drawer-name{font-size:18px;font-weight:600}
.bt-drawer-role{color:var(--bt-ink-2);font-size:12px}
.bt-drawer-body{gap:10px;padding:20px 16px 16px}
.bt-drawer-body>.bt-drawer-model,.bt-drawer-body>.bt-drawer-permission,.bt-drawer-body>.bt-card,.bt-drawer-body>.bt-kv,.bt-drawer-body>button.bt-more{box-sizing:border-box;background:var(--bt-card);border:1px solid var(--bt-line);border-radius:12px;padding:14px}
.bt-drawer-body>.bt-overview-card{box-sizing:border-box;width:100%;background:var(--bt-card);border:1px solid var(--bt-line);border-radius:12px;padding:14px;text-align:left}
.bt-drawer-body .bt-section-title{margin-bottom:8px}
/* Three separate surfaces, with a shared gutter around each column. */
html,body{background:var(--bt-sidebar)!important}
[class*="_frame"]:has(>[class*="_sidebarCol"]){background:var(--bt-sidebar)!important}
[class*="_centerCol"],.bt-panel{
  box-sizing:border-box;
  border:6px solid var(--bt-sidebar)!important;
  border-radius:18px;
  background-clip:padding-box!important;
  box-shadow:inset 0 0 0 1px var(--bt-line)!important;
}
.bt-leftcol{background:var(--bt-sidebar)!important;border:0!important;border-right:1px solid var(--bt-line)!important;border-radius:0;box-shadow:none!important}
[class*="_centerCol"]{background-color:var(--bt-main)!important}
.bt-panel{background-color:var(--bt-card)!important}
.bt-leftcol-grip{right:-6px}
.bt-panel-grip{left:-6px}
/* Larger, consistent corners for settings surfaces and conversation bubbles. */
.bt-settings,.bt-create-card,.bt-palette,.bt-avedit{border-radius:24px!important}
.bt-set-card,.bt-drawer-body>.bt-overview-card,.bt-drawer-body>.bt-drawer-model,.bt-drawer-body>.bt-drawer-permission,.bt-drawer-body>.bt-card,.bt-drawer-body>button.bt-more,.bt-q{border-radius:20px!important}
.bt-settings-item,.bt-select,.bt-input,.bt-model-trigger,.bt-drawer-body .bt-folder-trigger,.bt-settings :is(input:not([type=range]):not([type=checkbox]),textarea,select){border-radius:14px!important}
.bt-settings :is([class*="_rowCard"],[class*="_providerCard"],[class*="_accountCard"],[class*="_balanceCard"]){border-radius:20px!important}
.bt-seg,.bt-look-seg{border-radius:16px!important}
.bt-seg button,.bt-seg .bt-thumb,.bt-look-seg button,.bt-look-seg .bt-thumb{border-radius:13px!important}
.bt-bubble,.bt-ubody,.bt-ububble,.bt-msg:not(:first-child)>.bt-msg-line>.bt-bubble,.bt-msg:not(:last-child)>.bt-msg-line>.bt-bubble,[class*="_userRow"] [class*="_bubble"],[data-chat-flow-kind=question-reply] [class*="_bubble"],[data-chat-flow-kind=command-input] [class*="_bubble"]{border-radius:32px!important;padding:14px 20px!important}
[data-composer-card]{border-radius:24px!important}
/* DSH draws its corners on a squircle curve, which turns a 50% button into a rounded square. */
*{corner-shape:round!important}
/* One soft scale for the whole window, last in the sheet so it settles the earlier rules. */
body{--bt-r-window:32px;--bt-r-card:28px;--bt-r-pop:22px;--bt-r-field:18px;--bt-r-item:14px}
.bt-settings,.bt-create-card,.bt-add-card,.bt-nc-card,.bt-palette,.bt-avedit,[data-composer-card],[role=dialog],[class*="_dialog"]{border-radius:var(--bt-r-window)!important}
.bt-set-card,.bt-us-card,.bt-us-stats,.bt-us-sheet>:first-child,.bt-mem,.bt-q,.bt-magpie,.bt-about-hero,.bt-update-pop,.bt-panel .bt-card,.bt-panel [class*="_card"],.bt-drawer-body>.bt-overview-card,.bt-drawer-body>.bt-drawer-model,.bt-drawer-body>.bt-drawer-permission,.bt-drawer-body>.bt-card,.bt-settings :is([class*="_rowCard"],[class*="_providerCard"],[class*="_accountCard"],[class*="_balanceCard"],[class*="_card"]){border-radius:var(--bt-r-card)!important}
.bt-menu,.bt-pmenu,.bt-toast,.bt-side-q,.bt-seg,.bt-look-seg,.bt-add-tabs,.bt-provider-modes,[role=menu],[role=listbox],[class*="_popover"],[class*="_menu"]{border-radius:var(--bt-r-pop)!important}
.bt-input,.bt-select,.bt-textarea,.bt-bs-input,.bt-folder-input,.bt-create-input,.bt-add-search,.bt-q-field,.bt-model-trigger,.bt-drawer-body .bt-folder-trigger,.bt-settings :is(input:not([type=range]):not([type=checkbox]):not([type=radio]),textarea,select),pre,[class*="_codeBlock"]{border-radius:var(--bt-r-field)!important}
.bt-row,.bt-rail .bt-row,.bt-user-foot,.bt-option,.bt-mem-row,.bt-member-row,.bt-task-line,.bt-mw-card,.bt-ufile{border-radius:var(--bt-r-field)!important}
.bt-settings-item,.bt-menu button,.bt-pmenu-item,.bt-palette button,.bt-seg button,.bt-seg .bt-thumb,.bt-look-seg button,.bt-look-seg .bt-thumb,.bt-add-tabs button,.bt-provider-modes button,.bt-connector-mark,.bt-add-icon,.bt-learning-icon,[role=menuitem],[role=option]{border-radius:var(--bt-r-item)!important}
:is(.bt-x,.bt-q-x,.bt-bcard-x,.bt-palette-clear,.bt-us-month-nav,.bt-title-toggle,.bt-tool){border-radius:50%!important}
/* The window's title band on macOS: the page has no title bar, so the top of it moves the window. */
html[data-mac-titlebar] body::before{content:"";position:fixed;top:0;left:0;right:0;height:44px;pointer-events:none;-webkit-app-region:drag}
html[data-mac-titlebar] :is(button,a,input,textarea,select,[contenteditable=true],[role=button],[role=dialog],[role=menu],[role=tab],.bt-row,.bt-tile,.bt-settings,.bt-create-card,.bt-palette,.bt-avedit){-webkit-app-region:no-drag}
.bt-user-bot{background:none;box-shadow:none;clip-path:none}
@media (prefers-reduced-motion:reduce){.bt-msg,.bt-umsg{animation:none}}
@media (prefers-reduced-motion:no-preference){body:not([data-bt-motion=quiet]) .bt-mark[data-live]:hover>svg{transform:rotate(-7deg) scale(1.07);transition:transform .2s ease-out}}
`

