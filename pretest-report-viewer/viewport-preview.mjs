#!/usr/bin/env node
import { createServer } from "http";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "pretext-check-config.json");
const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("="); return [k, v || "true"];
  })
);
const TARGET = args.target || "http://localhost:3000";
const PORT = parseInt(args.port || "4445");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
const bp = config.breakpoints || [];
const pages = [...new Set(["/", ...(config.pages || []), ...(config.checks || []).map((c) => c.page).filter(Boolean)])];

const ico = {
  mobile:  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>',
  tablet:  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>',
  desktop: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
};
function cat(w) { return w <= 430 ? 'mobile' : w <= 1024 ? 'tablet' : 'desktop'; }

const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Viewport Preview</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
${config.googleFontsUrl ? '<link href="' + config.googleFontsUrl + '" rel="stylesheet"/>' : ''}
<style>
:root {
  --bg:#08080a; --s:#0f0f12; --sr:#141418; --b:#1c1c22; --bs:#16161c; --bh:#28282f;
  --t:#e4e4e7; --td:#a1a1aa; --tm:#63637a; --tf:#3f3f50;
  --gold:#c9a84c; --gd:rgba(201,168,76,0.15);
  --pass:#4ade80; --warn:#facc15; --fail:#f87171;
  --r:10px;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Inter",system-ui,sans-serif;background:var(--bg);color:var(--t);-webkit-font-smoothing:antialiased}

/* TOPBAR */
.topbar{position:sticky;top:0;z-index:100;background:rgba(8,8,10,.88);backdrop-filter:blur(20px);border-bottom:1px solid var(--bs);height:48px;padding:0 1.25rem;display:flex;align-items:center;justify-content:space-between}
.topbar h1{font-size:.8125rem;font-weight:600}
.topbar .url{font-size:.6875rem;color:var(--tm);font-family:"SF Mono",monospace;background:rgba(255,255,255,.03);padding:.2rem .5rem;border-radius:5px;border:1px solid var(--bs);margin-left:.75rem}
.cg{display:flex;background:var(--s);border:1px solid var(--bs);border-radius:8px;padding:2px;gap:1px;margin-left:6px}
.cg button{font-family:inherit;font-size:.6875rem;font-weight:500;padding:.3rem .6rem;border-radius:6px;border:none;background:0;color:var(--tm);cursor:pointer;transition:all .12s;white-space:nowrap;display:flex;align-items:center;gap:.3rem}
.cg button:hover{color:var(--td);background:rgba(255,255,255,.04)}
.cg button.on{background:rgba(255,255,255,.07);color:var(--t);box-shadow:0 1px 2px rgba(0,0,0,.2)}

/* PAGE NAV */
.pnav{display:flex;gap:2px;padding:.375rem 1.25rem;background:var(--s);border-bottom:1px solid var(--bs);overflow-x:auto;scrollbar-width:none}
.pnav::-webkit-scrollbar{display:none}
.pnav button{font-family:"SF Mono",monospace;font-size:.625rem;font-weight:500;padding:.25rem .5rem;border-radius:5px;border:none;background:0;color:var(--tf);cursor:pointer;transition:all .12s;white-space:nowrap}
.pnav button:hover{color:var(--td);background:rgba(255,255,255,.04)}
.pnav button.on{color:var(--gold);background:var(--gd)}

/* DASHBOARD */
.dash{padding:1.25rem;display:flex;gap:1rem;flex-wrap:wrap}
.dash-card{background:var(--s);border:1px solid var(--b);border-radius:var(--r);padding:.75rem 1rem;min-width:120px;flex:1;text-align:center}
.dash-card .num{font-size:1.5rem;font-weight:700;letter-spacing:-.02em}
.dash-card .lbl{font-size:.625rem;color:var(--tm);margin-top:.2rem;text-transform:uppercase;letter-spacing:.06em}
.dash-card.fail .num{color:var(--fail)} .dash-card.warn .num{color:var(--warn)} .dash-card.pass .num{color:var(--pass)}

/* GALLERY */
.gallery{padding:0 1.25rem 1.25rem;display:flex;flex-wrap:wrap;gap:1rem;justify-content:center}
.df{background:var(--s);border:1px solid var(--b);border-radius:var(--r);overflow:hidden;cursor:pointer;flex-shrink:0;transition:transform .2s,box-shadow .2s,border-color .2s}
.df:hover{transform:translateY(-2px);border-color:var(--bh);box-shadow:0 8px 24px rgba(0,0,0,.3)}
.df.on{border-color:var(--gold);box-shadow:0 0 0 2px var(--gd)}
.df.hid{display:none}
.dc{display:flex;align-items:center;gap:.5rem;padding:.375rem .5rem;background:var(--sr);border-bottom:1px solid var(--bs);font-size:.625rem;user-select:none}
.dc .ico{color:var(--tf);display:flex} .dc .nm{color:var(--td);font-weight:500;flex:1} .dc .dm{color:var(--tf);font-family:monospace;font-size:.5625rem}
.iw{position:relative;overflow:hidden;background:#000}
.iw iframe{border:none;display:block;transform-origin:top left;background:var(--bg)}
.df .iw iframe{pointer-events:none}
.fl{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5rem;background:var(--s);color:var(--tf);font-size:.6875rem;z-index:5;transition:opacity .4s}
.fl.ok{opacity:0;pointer-events:none}
.sp{width:14px;height:14px;border:1.5px solid var(--b);border-top-color:var(--tm);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* Touch */
.df[data-cat=mobile] .iw,.df[data-cat=tablet] .iw{cursor:none}
.tc{display:none;position:absolute;width:30px;height:30px;border-radius:50%;pointer-events:none;z-index:20;transform:translate(-50%,-50%);transition:transform .08s ease-out,box-shadow .08s ease-out;background:radial-gradient(circle,rgba(255,255,255,.22) 0%,rgba(255,255,255,.08) 60%,transparent 100%);border:1.5px solid rgba(255,255,255,.18);box-shadow:0 0 8px rgba(255,255,255,.06)}
.tc.p{transform:translate(-50%,-50%) scale(.82);background:radial-gradient(circle,rgba(255,255,255,.35) 0%,rgba(255,255,255,.12) 60%,transparent 100%);border-color:rgba(255,255,255,.3);box-shadow:0 0 12px rgba(255,255,255,.1)}
.tc.lp{animation:touch-lp .5s ease-out forwards}
@keyframes touch-lp{0%{transform:translate(-50%,-50%) scale(.82);box-shadow:0 0 0 0 rgba(255,255,255,.2)}50%{transform:translate(-50%,-50%) scale(1.1);box-shadow:0 0 0 10px rgba(255,255,255,.06)}100%{transform:translate(-50%,-50%) scale(1.25);box-shadow:0 0 0 16px rgba(255,255,255,.0)}}
.df[data-cat=mobile]:hover .tc,.df[data-cat=tablet]:hover .tc{display:block}
/* Swipe-style scroll for mobile/tablet gallery thumbnails */
.df[data-cat=mobile] .iw,.df[data-cat=tablet] .iw{scrollbar-width:none;-ms-overflow-style:none}
.df[data-cat=mobile] .iw::-webkit-scrollbar,.df[data-cat=tablet] .iw::-webkit-scrollbar{display:none}

/* FINDINGS LIST */
.findings{padding:0 1.25rem 1.5rem}
.findings h2{font-size:.8125rem;font-weight:600;margin-bottom:.75rem;display:flex;align-items:center;gap:.5rem}
.fi{background:var(--s);border:1px solid var(--b);border-radius:8px;margin-bottom:.5rem;overflow:hidden;transition:border-color .15s}
.fi:hover{border-color:var(--bh)}
.fi-head{display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;cursor:pointer;user-select:none;transition:background .12s}
.fi-head:hover{background:rgba(255,255,255,.02)}
.fi-head .ch{color:var(--tf);font-size:.5rem;transition:transform .2s;flex-shrink:0}
.fi.open .ch{transform:rotate(90deg)}
.badge{font-size:.5625rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:.1rem .4rem;border-radius:4px;flex-shrink:0}
.badge.pass{background:rgba(74,222,128,.1);color:var(--pass)} .badge.warn{background:rgba(250,204,21,.1);color:var(--warn)} .badge.fail{background:rgba(248,113,113,.1);color:var(--fail)}
.fi-label{font-size:.75rem;font-weight:500;color:var(--td);flex:1}
.fi-text{font-size:.6875rem;color:var(--tf);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fi-cnt{font-size:.625rem;color:var(--tf);white-space:nowrap}
.fi-body{display:none;padding:0 .75rem .625rem}
.fi.open .fi-body{display:block}
.fi.pass-only .fi-head{padding:.35rem .625rem}
.fi.pass-only .fi-label{font-size:.6875rem}
.fi.pass-only .fi-text{max-width:220px}
.compact .fi.pass-only{display:none}
.devs{display:flex;flex-direction:column;gap:.375rem}
.dp{display:flex;align-items:center;gap:.5rem;padding:.4rem .625rem;border-radius:7px;font-size:.6875rem;background:rgba(255,255,255,.02);border:1px solid var(--bs);cursor:pointer;transition:all .12s;position:relative}
.dp:hover{border-color:var(--bh);background:rgba(255,255,255,.04)}
.dp .ico{color:var(--tf);display:flex} .dp .nm{color:var(--td);font-weight:500;min-width:100px}
.dp .dt{color:var(--tf);font-family:monospace;font-size:.5625rem;flex:1}
.dp .ln{font-family:monospace;font-size:.6875rem;font-weight:700}
.dp .ln.pass{color:var(--pass)} .dp .ln.warn{color:var(--warn)} .dp .ln.fail{color:var(--fail)}
.dp .ins{font-size:.5625rem;font-weight:600;color:var(--tf);padding:.15rem .4rem;border-radius:4px;border:1px solid var(--b);transition:all .12s}
.dp:hover .ins{color:var(--gold);border-color:var(--gd);background:rgba(201,168,76,.06)}
/* Hover preview — scrollable, page-aware */
.dp .hover-preview{display:none;position:absolute;right:-220px;top:50%;transform:translateY(-50%);width:200px;height:200px;border-radius:8px;border:1px solid var(--b);overflow:hidden;background:#000;z-index:50;box-shadow:0 12px 32px rgba(0,0,0,.6)}
.dp:hover .hover-preview{display:block}
.dp .hover-preview iframe{border:none;transform-origin:top left}

/* Page groups */
.pg-group{margin-bottom:.75rem;border:1px solid var(--b);border-radius:8px;background:var(--s);overflow:hidden}
.pg-head{display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;cursor:pointer;user-select:none;font-size:.75rem;transition:background .12s}
.pg-head:hover{background:rgba(255,255,255,.02)}
.pg-head .ch{color:var(--tf);font-size:.5rem;transition:transform .2s;flex-shrink:0}
.pg-group.open>.pg-head .ch{transform:rotate(90deg)}
.pg-path{font-family:"SF Mono",monospace;font-weight:600;color:var(--gold)}
.pg-counts{margin-left:auto;font-size:.625rem;display:flex;gap:.5rem}
.pg-group>.fi,.pg-group>.fi:last-child{border-radius:0;border-left:0;border-right:0;border-bottom:0;margin-bottom:0}
.pg-group>.fi{border-top:1px solid var(--bs)}
.pg-group:not(.open)>.fi{display:none}

/* VIEWPORT MODAL */
.vmod{display:none;position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);align-items:center;justify-content:center}
.vmod.open{display:flex}
.vm-wrap{position:relative;display:flex;flex-direction:column;align-items:center;max-width:95vw;max-height:95vh}
.vm-chrome{display:flex;align-items:center;width:100%;padding:.5rem .75rem;background:var(--sr);border:1px solid var(--b);border-bottom:none;border-radius:14px 14px 0 0;min-height:36px;gap:.5rem}
.vm-left{display:flex;align-items:center;gap:.5rem;flex-shrink:1;min-width:0;overflow:hidden}
.vm-name{font-size:.75rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .vm-dims{font-size:.625rem;color:var(--tm);font-family:monospace;white-space:nowrap}
.vm-dots{display:flex;align-items:center;gap:.3rem;flex:1;justify-content:center;flex-shrink:0}
.vm-dot{width:6px;height:6px;border-radius:50%;background:var(--b);cursor:pointer;transition:all .15s}
.vm-dot:hover{background:var(--tm)} .vm-dot.cur{background:var(--gold)}
.vm-right{display:flex;align-items:center;gap:.375rem}
.vm-btn{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:7px;border:1px solid var(--b);background:var(--s);color:var(--tm);cursor:pointer;font-size:.75rem;transition:all .12s}
.vm-btn:hover{background:rgba(255,255,255,.06);color:var(--t);border-color:var(--bh)}
.vm-btn:active{transform:scale(.95)}
.vm-close{margin-left:.25rem}
.vm-close:hover{background:rgba(255,60,60,.1);color:var(--fail);border-color:rgba(248,113,113,.2)}
.vm-frame{border:1px solid var(--b);border-top:none;border-radius:0 0 14px 14px;overflow:hidden;position:relative;background:#000;transition:width .3s ease,height .3s ease}
.vm-frame iframe{border:none;display:block;transform-origin:top left;background:var(--bg);transition:width .3s ease,height .3s ease,transform .3s ease}
.vm-chrome{transition:width .3s ease}
.vm-frame.touch{cursor:none}
.vm-frame.touch iframe{cursor:default;pointer-events:auto;touch-action:pan-y}
.vm-frame:not(.touch) iframe{pointer-events:auto;cursor:default}
.vm-tc{display:none;position:absolute;width:36px;height:36px;border-radius:50%;pointer-events:none;z-index:20;transform:translate(-50%,-50%);transition:transform .08s ease-out,box-shadow .08s ease-out;background:radial-gradient(circle,rgba(255,255,255,.22) 0%,rgba(255,255,255,.08) 60%,transparent 100%);border:1.5px solid rgba(255,255,255,.18);box-shadow:0 0 10px rgba(255,255,255,.06)}
.vm-frame.touch:hover .vm-tc{display:block}
.vm-tc.p{transform:translate(-50%,-50%) scale(.82);background:radial-gradient(circle,rgba(255,255,255,.35) 0%,rgba(255,255,255,.12) 60%,transparent 100%);border-color:rgba(255,255,255,.3);box-shadow:0 0 14px rgba(255,255,255,.1)}
.vm-tc.lp{animation:touch-lp-modal .5s ease-out forwards}
@keyframes touch-lp-modal{0%{transform:translate(-50%,-50%) scale(.82);box-shadow:0 0 0 0 rgba(255,255,255,.2)}50%{transform:translate(-50%,-50%) scale(1.15);box-shadow:0 0 0 12px rgba(255,255,255,.06)}100%{transform:translate(-50%,-50%) scale(1.3);box-shadow:0 0 0 20px rgba(255,255,255,.0)}}
/* Swipe-style scroll for modal touch frames */
.vm-frame.touch{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch}
.vm-frame.touch::-webkit-scrollbar{display:none}
.kbd-hint{position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);z-index:600;display:none;align-items:center;gap:.75rem;padding:.4rem .75rem;background:rgba(20,20,24,.9);border:1px solid var(--b);border-radius:8px;font-size:.625rem;color:var(--tm);backdrop-filter:blur(8px)}
.vmod.open~.kbd-hint{display:flex}
kbd{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:18px;padding:0 .3rem;background:rgba(255,255,255,.06);border:1px solid var(--b);border-radius:4px;font-family:inherit;font-size:.5625rem;color:var(--td)}

@media(max-width:768px){.topbar{height:auto;flex-direction:column;padding:.5rem;gap:.5rem;align-items:flex-start}.gallery,.dash,.findings{padding:.75rem}}
</style>
</head><body>

<!-- TOPBAR -->
<div class="topbar">
  <div style="display:flex;align-items:center">
    <h1>Viewport Preview</h1>
    <span class="url">${TARGET}</span>
  </div>
  <div style="display:flex;align-items:center">
    <div class="cg" id="filters">
      <button class="on" data-f="all">All</button>
      <button data-f="mobile">${ico.mobile} Mobile</button>
      <button data-f="tablet">${ico.tablet} Tablet</button>
      <button data-f="desktop">${ico.desktop} Desktop</button>
    </div>
    <div class="cg">
      <button id="btn-compact" class="on">Compact</button>
      <button id="btn-refresh">Refresh</button>
    </div>
  </div>
</div>

<!-- PAGE NAV -->
<div class="pnav" id="pnav">
${pages.map((p, i) => `<button${i === 0 ? ' class="on"' : ''} data-p="${p}">${p}</button>`).join("\n")}
</div>

<!-- DASHBOARD CARDS -->
<div class="dash" id="dash">
  <div class="dash-card" id="dc-total"><div class="num">-</div><div class="lbl">Total Checks</div></div>
  <div class="dash-card pass" id="dc-pass"><div class="num">-</div><div class="lbl">Passed</div></div>
  <div class="dash-card warn" id="dc-warn"><div class="num">-</div><div class="lbl">Warnings</div></div>
  <div class="dash-card fail" id="dc-fail"><div class="num">-</div><div class="lbl">Failures</div></div>
</div>

<!-- FINDINGS -->
<div class="findings" id="findings">
  <h2>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
    Findings
  </h2>
  <div id="fi-loading" style="color:var(--tf);font-size:.75rem;display:flex;align-items:center;gap:.5rem"><div class="sp"></div>Running Pretext checks...</div>
  <div id="fi-list"></div>
</div>

<!-- DEVICE GALLERY -->
<div class="gallery" id="gallery">
${bp.map((b, i) => {
  const c = cat(b.width);
  const ih = b.width <= 430 ? 667 : b.width <= 1024 ? 1024 : 900;
  const pw = b.width <= 430 ? 210 : b.width <= 1024 ? 260 : 300;
  const sc = pw / b.width;
  const ph = Math.round(ih * sc);
  return `
  <div class="df" data-i="${i}" data-cat="${c}" data-w="${b.width}" data-h="${ih}" data-nm="${b.name}" data-sc="${sc}" onclick="openViewport(${i})">
    <div class="dc">
      <span class="ico">${ico[c]}</span>
      <span class="nm">${b.name}</span>
      <span class="dm">${b.width}&times;${ih}</span>
    </div>
    <div class="iw" style="width:${pw}px;height:${ph}px"
      ${c!=='desktop'?`onmousemove="mtc(event,this)" onmousedown="tcDown(this)" onmouseup="tcUp(this)" onmouseleave="tcLeave(this)"`:''}>
      <div class="fl" id="ld-${i}"><div class="sp"></div>Loading</div>
      ${c!=='desktop'?'<div class="tc"></div>':''}
      <iframe id="fr-${i}" width="${b.width}" height="${ih}" style="transform:scale(${sc});width:${b.width}px;height:${ih}px" loading="lazy" onload="document.getElementById('ld-${i}').classList.add('ok')"></iframe>
    </div>
  </div>`;
}).join('')}
</div>

<!-- VIEWPORT MODAL -->
<div class="vmod" id="vmod" onclick="if(event.target===this)closeViewport()">
  <div class="vm-wrap">
    <div class="vm-chrome" id="vm-chrome">
      <div class="vm-left"><span id="vm-ico"></span><span class="vm-name" id="vm-name"></span><span class="vm-dims" id="vm-dims"></span></div>
      <div class="vm-dots" id="vm-dots"></div>
      <div class="vm-right">
        <button class="vm-btn" id="vm-prev" onclick="event.stopPropagation();navVP(-1)" title="Previous">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button class="vm-btn" id="vm-next" onclick="event.stopPropagation();navVP(1)" title="Next">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button class="vm-btn vm-close" onclick="event.stopPropagation();closeViewport()">&times;</button>
      </div>
    </div>
    <div class="vm-frame" id="vm-frame"
      onmousemove="mvmc(event)"
      onmousedown="vmTcDown()"
      onmouseup="vmTcUp()"
      onmouseleave="vmTcLeave()">
      <div class="vm-tc"></div>
      <iframe id="vm-iframe"></iframe>
    </div>
  </div>
</div>
<div class="kbd-hint"><span><kbd>&larr;</kbd> <kbd>&rarr;</kbd> navigate (cycles)</span><span><kbd>Esc</kbd> close</span></div>

<script>
const TARGET="${TARGET}";
const BP=${JSON.stringify(bp)};
let path="/",vpIdx=-1,savedScroll=0;
let compactMode=true;
const frames=document.querySelectorAll('.df');
const vmod=document.getElementById('vmod');

// Staggered load
frames.forEach((f,i)=>{setTimeout(()=>{f.querySelector('iframe').src=TARGET+path},i*120)});

// Touch cursor — gallery cards
let _tcTimers=new WeakMap();
function mtc(e,w){const c=w.querySelector('.tc');if(!c)return;const r=w.getBoundingClientRect();c.style.left=(e.clientX-r.left)+'px';c.style.top=(e.clientY-r.top)+'px'}
function tcDown(w){const c=w.querySelector('.tc');if(!c)return;c.classList.add('p');c.classList.remove('lp');const t=setTimeout(()=>{c.classList.add('lp')},500);_tcTimers.set(w,t)}
function tcUp(w){const c=w.querySelector('.tc');if(!c)return;c.classList.remove('p','lp');clearTimeout(_tcTimers.get(w));_tcTimers.delete(w)}
function tcLeave(w){const c=w.querySelector('.tc');if(!c)return;c.classList.remove('p','lp');clearTimeout(_tcTimers.get(w));_tcTimers.delete(w)}
// Touch cursor — modal
let _vmLpTimer=null;
function mvmc(e){const c=document.querySelector('.vm-tc');if(!c)return;const r=document.getElementById('vm-frame').getBoundingClientRect();c.style.left=(e.clientX-r.left)+'px';c.style.top=(e.clientY-r.top)+'px'}
function vmTcDown(){const c=document.querySelector('.vm-tc');if(!c)return;c.classList.add('p');c.classList.remove('lp');_vmLpTimer=setTimeout(()=>{c.classList.add('lp')},500)}
function vmTcUp(){const c=document.querySelector('.vm-tc');if(!c)return;c.classList.remove('p','lp');clearTimeout(_vmLpTimer);_vmLpTimer=null}
function vmTcLeave(){const c=document.querySelector('.vm-tc');if(!c)return;c.classList.remove('p','lp');clearTimeout(_vmLpTimer);_vmLpTimer=null}

// Filter
document.getElementById('filters').onclick=e=>{const b=e.target.closest('button[data-f]');if(!b)return;const f=b.dataset.f;document.querySelectorAll('[data-f]').forEach(x=>x.classList.remove('on'));b.classList.add('on');frames.forEach(fr=>{fr.classList.toggle('hid',f!=='all'&&fr.dataset.cat!==f)})};

// Page nav
document.getElementById('pnav').onclick=e=>{const b=e.target.closest('button[data-p]');if(!b)return;path=b.dataset.p;document.querySelectorAll('[data-p]').forEach(x=>x.classList.remove('on'));b.classList.add('on');frames.forEach(f=>{f.querySelector('.fl').classList.remove('ok');f.querySelector('iframe').src=TARGET+path})};

// Refresh
document.getElementById('btn-refresh').onclick=()=>{frames.forEach(f=>{f.querySelector('.fl').classList.remove('ok');f.querySelector('iframe').src=TARGET+path})};
document.getElementById('btn-compact').onclick=()=>{
  compactMode=!compactMode;
  document.getElementById('btn-compact').classList.toggle('on',compactMode);
  document.getElementById('findings').classList.toggle('compact',compactMode);
};

// Visible indices for nav
function visIdx(){return[...frames].map((f,i)=>f.classList.contains('hid')?-1:i).filter(i=>i>=0)}

// Viewport modal — SMOOTH transitions, no reload between device switches
let vmLoaded=false; // track if iframe has content
function openViewport(idx){
  const wasOpen=vpIdx>=0;
  vpIdx=idx;vmod.classList.add('open');document.body.style.overflow='hidden';
  renderVP(!wasOpen); // only load iframe on first open
  frames.forEach(f=>f.classList.remove('on'));frames[idx]?.classList.add('on');
}
function closeViewport(){
  vmod.classList.remove('open');document.body.style.overflow='';vpIdx=-1;vmLoaded=false;
  frames.forEach(f=>f.classList.remove('on'));
  // Clear src so next open is fresh
  document.getElementById('vm-iframe').src='about:blank';
}
function navVP(dir){
  const vis=visIdx();const cur=vis.indexOf(vpIdx);
  let next=cur+dir;
  if(next<0)next=vis.length-1;
  if(next>=vis.length)next=0;
  vpIdx=vis[next];
  renderVP(false); // false = don't reload, just resize
  frames.forEach(f=>f.classList.remove('on'));frames[vpIdx]?.classList.add('on');
}
function renderVP(shouldLoad){
  const f=frames[vpIdx];if(!f)return;
  const w=+f.dataset.w,h=+f.dataset.h,nm=f.dataset.nm,c=f.dataset.cat;
  const icoMap={mobile:\`${ico.mobile}\`,tablet:\`${ico.tablet}\`,desktop:\`${ico.desktop}\`};
  document.getElementById('vm-ico').innerHTML=icoMap[c]||'';
  document.getElementById('vm-name').textContent=nm;
  document.getElementById('vm-dims').textContent=w+' x '+h;
  // Dots
  const vis=visIdx();
  document.getElementById('vm-dots').innerHTML=vis.map(i=>'<div class="vm-dot'+(i===vpIdx?' cur':'')+'" onclick="event.stopPropagation();openViewport('+i+')"></div>').join('');
  // Touch mode — no mouse on mobile/tablet
  const mf=document.getElementById('vm-frame');
  mf.classList.toggle('touch',c!=='desktop');
  // Size — smooth transition via CSS
  const ch=36,mw=innerWidth*.92,mh=(innerHeight*.9)-ch;
  const sc=Math.min(mw/w,mh/h,1),dw=Math.round(w*sc),dh=Math.round(h*sc);
  mf.style.width=dw+'px';mf.style.height=dh+'px';
  const ifr=document.getElementById('vm-iframe');
  // Resize the iframe — the page inside reflows to new width (like resizing a browser window)
  ifr.width=w;ifr.height=h;ifr.style.width=w+'px';ifr.style.height=h+'px';
  ifr.style.transform='scale('+sc+')';ifr.style.transformOrigin='top left';
  // Only load src on first open or page change — NOT on device switch
  if(shouldLoad||!vmLoaded){
    ifr.src=TARGET+path;
    vmLoaded=true;
    // After load: inject CSS to disable mouse effects on touch viewports
    ifr.onload=function(){
      try{
        const doc=ifr.contentDocument;
        if(!doc)return;
        // Remove old injected style if any
        const old=doc.getElementById('vp-inject');
        if(old)old.remove();
        if(c!=='desktop'){
          const style=doc.createElement('style');
          style.id='vp-inject';
          style.textContent='*{cursor:none!important}.flashlight,.flashlight-overlay,[data-flashlight],[class*=flashlight]{display:none!important;opacity:0!important;pointer-events:none!important}body{cursor:none!important;-webkit-overflow-scrolling:touch}';
          doc.head.appendChild(style);
        }
      }catch(e){}
    };
  } else if(c!=='desktop'){
    // If just resizing (not reloading), still inject/update
    try{
      const doc=ifr.contentDocument;
      if(doc){
        let style=doc.getElementById('vp-inject');
        if(!style){style=doc.createElement('style');style.id='vp-inject';doc.head.appendChild(style)}
        style.textContent='*{cursor:none!important}.flashlight,.flashlight-overlay,[data-flashlight],[class*=flashlight]{display:none!important;opacity:0!important;pointer-events:none!important}body{cursor:none!important;-webkit-overflow-scrolling:touch}';
      }
    }catch(e){}
  } else {
    // Desktop — remove injected style
    try{const s=ifr.contentDocument?.getElementById('vp-inject');if(s)s.remove()}catch(e){}
  }
  document.getElementById('vm-chrome').style.width=dw+'px';
}

// Keyboard — cyclic
document.onkeydown=e=>{if(vpIdx<0)return;if(e.key==='Escape')closeViewport();else if(e.key==='ArrowLeft')navVP(-1);else if(e.key==='ArrowRight')navVP(1)};

// Findings click delegation — navigates to correct page then opens viewport
document.getElementById('fi-list').onclick=e=>{
  const h=e.target.closest('.fi-head');if(h){h.parentElement.classList.toggle('open');return}
  const p=e.target.closest('.dp');
  if(p&&p.dataset.di!==undefined){
    // Navigate to the check's page first if different
    const pg=p.dataset.pg;
    if(pg&&pg!==path){
      path=pg;
      document.querySelectorAll('[data-p]').forEach(x=>x.classList.toggle('on',x.dataset.p===pg));
      frames.forEach(f=>{f.querySelector('.fl').classList.remove('ok');f.querySelector('iframe').src=TARGET+path});
      vmLoaded=false; // force reload in modal
    }
    openViewport(+p.dataset.di);
  }
};
</script>

<!-- PRETEXT ENGINE — local, no CDN -->
<script type="module">
import{prepare,layout}from"/pretext/layout.js";
const config=${JSON.stringify(config,null,2)};
const TARGET="${TARGET}";
const path="/";
const PAGES=${JSON.stringify(pages)};
// Load fonts with timeout — don't hang forever
try {
  await Promise.race([
    Promise.all([
      document.fonts.load('400 16px "Cormorant Garamond"'),
      document.fonts.load('700 16px "Cormorant Garamond"'),
      document.fonts.load('500 16px Cinzel'),
      document.fonts.load('700 16px Cinzel'),
    ]),
    new Promise((_,rej) => setTimeout(() => rej('Font load timeout'), 3000))
  ]);
} catch(e) { console.warn('Fonts may not be loaded:', e); }
document.getElementById('fi-loading').textContent = 'Running checks...';

let tp=0,tw=0,tf=0;const checks=[];
try {
for(const ck of config.checks){
  const targetPages=Array.isArray(ck.pages)&&ck.pages.length
    ?ck.pages
    :((ck.page==="*"||ck.page==="all")?PAGES:[ck.page||"/"]);
  const lh=ck.lineHeight||parseFloat(ck.fontSize)*1.4,ml=ck.maxLines||1;
  const devsTemplate=[];
  for(let bi=0;bi<config.breakpoints.length;bi++){
    const b=config.breakpoints[bi];
    let fs=ck.fontSize;
    if(ck.responsive)for(const o of ck.responsive)if(b.width>=o.minWidth)fs=o.fontSize;
    const font=(ck.fontWeight||"400")+" "+fs+" "+ck.fontFamily;
    const cw=b.width-(ck.horizontalPadding||48);
    let lc=0,st="pass";
    try{const p=prepare(ck.text,font);const r=layout(p,cw,lh);lc=r.lineCount;st=lc<=ml?"pass":lc<=ml+1?"warn":"fail"}catch{st="fail";lc="?"}
    if(st==="pass")tp++;else if(st==="warn")tw++;else tf++;
    devsTemplate.push({b,bi,lc,ml,st,fs,cw});
  }
  for(const pg of targetPages){
    const devs=devsTemplate.map(d=>({ ...d }));
    const worst=devs.some(d=>d.st==="fail")?"fail":devs.some(d=>d.st==="warn")?"warn":"pass";
    checks.push({ck,devs,worst,page:pg});
  }
}
checks.sort((a,b)=>({fail:0,warn:1,pass:2}[a.worst])-({fail:0,warn:1,pass:2}[b.worst]));

// Dashboard cards
const tot=tp+tw+tf;
document.querySelector('#dc-total .num').textContent=tot;
document.querySelector('#dc-pass .num').textContent=tp;
document.querySelector('#dc-warn .num').textContent=tw;
document.querySelector('#dc-fail .num').textContent=tf;

// Findings — grouped by page
const icoMap={mobile:'${ico.mobile}',tablet:'${ico.tablet}',desktop:'${ico.desktop}'};
function catOf(w){return w<=430?'mobile':w<=1024?'tablet':'desktop'}

// Group checks by page
const byPage={};
for(const c of checks){
  const pg=c.page||'/';
  if(!byPage[pg])byPage[pg]=[];
  byPage[pg].push(c);
}

let html="";
for(const[pg,pgChecks]of Object.entries(byPage)){
  const pgHasIssues=pgChecks.some(c=>c.worst!=='pass');
  html+='<div class="pg-group'+(pgHasIssues?' open':'')+'">';
  html+='<div class="pg-head" onclick="this.parentElement.classList.toggle(\\'open\\')"><span class="ch">&#9654;</span><span class="pg-path">'+pg+'</span><span class="pg-counts">';
  const pgFail=pgChecks.filter(c=>c.worst==='fail').length;
  const pgWarn=pgChecks.filter(c=>c.worst==='warn').length;
  const pgPass=pgChecks.filter(c=>c.worst==='pass').length;
  if(pgFail)html+='<span style="color:var(--fail)">'+pgFail+' fail</span> ';
  if(pgWarn)html+='<span style="color:var(--warn)">'+pgWarn+' warn</span> ';
  html+='<span style="color:var(--pass)">'+pgPass+' pass</span>';
  html+='</span></div>';

  for(const{ck,devs,worst,page}of pgChecks){
    const hasIssue=worst!=="pass";
    const issues=devs.filter(d=>d.st!=="pass");
    const pills=issues.map(d=>{
      const c=catOf(d.b.width);
      const pw=200,sc=pw/d.b.width;
      return '<div class="dp" data-di="'+d.bi+'" data-pg="'+(page||'/')+'">'+
        '<span class="ico">'+icoMap[c]+'</span>'+
        '<span class="nm">'+d.b.name+'</span>'+
        '<span class="dt">'+d.fs+' in '+d.cw+'px</span>'+
        '<span class="ln '+d.st+'">'+d.lc+'/'+d.ml+'</span>'+
        '<span class="ins">Inspect</span>'+
        '<div class="hover-preview"><iframe src="'+TARGET+(page||'/')+'" width="'+d.b.width+'" height="600" style="transform:scale('+sc+');width:'+d.b.width+'px;height:'+Math.round(600/sc)+'px"></iframe></div>'+
      '</div>';
    }).join('');

    if(!hasIssue){
      html+='<div class="fi pass-only"><div class="fi-head"><span class="ch">&#9654;</span><span class="badge pass">PASS</span><span class="fi-label">'+ck.label+'</span><span class="fi-text">&ldquo;'+ck.text+'&rdquo;</span></div><div class="fi-body"><div style="padding:.25rem 0;font-size:.6875rem;color:var(--pass)">Fits on all '+devs.length+' devices</div></div></div>';
    }else{
      html+='<div class="fi open"><div class="fi-head"><span class="ch">&#9654;</span><span class="badge '+worst+'">'+worst.toUpperCase()+'</span><span class="fi-label">'+ck.label+'</span><span class="fi-text">&ldquo;'+ck.text+'&rdquo;</span><span class="fi-cnt">'+issues.length+' device'+(issues.length>1?'s':'')+'</span></div><div class="fi-body"><div class="devs">'+pills+'</div></div></div>';
    }
  }
  html+='</div>';
}
document.getElementById('fi-loading').style.display='none';
document.getElementById('fi-list').innerHTML=html;
document.getElementById('findings').classList.add('compact');
} catch(err) {
  document.getElementById('fi-loading').innerHTML='<span style="color:var(--fail)">Error: '+err.message+'</span>';
  console.error('Pretext engine error:', err);
}
</script>
</body></html>`;

// Serve pretext ESM files locally instead of CDN
const pretextDistDir = resolve(__dirname, "../node_modules/@chenglou/pretext/dist");
const pretextModulePattern = /^\/pretext(?:\/([a-zA-Z0-9._-]+))?\.js$/;

const server = createServer((req, res) => {
  const reqPath = req.url?.split("?")[0] || "/";
  const pretextMatch = reqPath.match(pretextModulePattern);
  if (pretextMatch) {
    const moduleName = pretextMatch[1] ? `${pretextMatch[1]}.js` : "layout.js";
    const modulePath = resolve(pretextDistDir, moduleName);
    if (!modulePath.startsWith(pretextDistDir) || !existsSync(modulePath)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600" });
    res.end(readFileSync(modulePath, "utf-8"));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});
server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Viewport Preview: ${url}`);
  console.log(`Target site:      ${TARGET}`);
  console.log(`\nPress Ctrl+C to stop.\n`);
  try { execSync(`open "${url}"`); } catch { console.log(`Open manually: ${url}`); }
});
