<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Auction Price Research — Equipment Cost Tracker</title>
<meta name="description" content="Used ophthalmic equipment auction price research and buying intelligence.">
<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
:root{
  --bg:#121212;--card:#1E1E1E;--card-2:#262626;--accent:#4CAF50;--accent-2:#3B82F6;
  --text:#fff;--subtext:#9AA0A6;--line:#2F2F2F;--line-soft:#232323;--warn:#F59E0B;--danger:#EF4444;
  --accent-ink:#0B2E12;--radius:16px;--radius-sm:10px;
  --shadow:0 10px 30px rgba(0,0,0,.45);--shadow-sm:0 4px 14px rgba(0,0,0,.35);
  --font:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
  --mono:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;
}
[data-theme="light"]{
  --bg:#F4F5F7;--card:#fff;--card-2:#F0F2F5;--text:#14161A;--subtext:#5B6470;
  --line:#E3E6EB;--line-soft:#ECEEF1;--accent-ink:#E7F6EA;
  --shadow:0 10px 30px rgba(20,30,50,.10);--shadow-sm:0 4px 14px rgba(20,30,50,.08);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;transition:background .25s,color .25s}
.wrap{max-width:1200px;margin:0 auto;padding:26px 22px 70px}
a{color:var(--accent-2)}
.muted{color:var(--subtext)}
kbd{font-family:var(--mono);font-size:11px;background:var(--card-2);border:1px solid var(--line);border-radius:6px;padding:1px 6px;color:var(--subtext)}
:focus-visible{outline:2px solid var(--accent-2);outline-offset:2px;border-radius:6px}

/* Header */
.head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:8px;flex-wrap:wrap}
.head__left{display:flex;align-items:center;gap:13px}
.mark{width:40px;height:40px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border-radius:11px;font-size:20px;flex:none}
h1{font-size:23px;font-weight:700;letter-spacing:-.02em}
.sub{color:var(--subtext);font-size:13px}
.head__actions{display:flex;gap:10px;flex-wrap:wrap}

.crumb{margin:18px 0 22px;font-size:13px;color:var(--subtext)}
.crumb a{text-decoration:none}

/* Buttons */
.btn{font:inherit;font-weight:600;cursor:pointer;padding:9px 15px;border-radius:10px;border:1px solid transparent;display:inline-flex;align-items:center;gap:8px;transition:transform .08s,background .15s,border-color .15s}
.btn:active{transform:translateY(1px)}
.btn--ghost{background:var(--card);color:var(--text);border-color:var(--line)}
.btn--ghost:hover{background:var(--card-2);border-color:var(--subtext)}
.btn--secondary{background:var(--accent-2);color:#fff}
.btn--secondary:hover{background:color-mix(in srgb,var(--accent-2) 88%,#fff)}

/* Insight banner */
.banner{background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 14%,var(--card)),var(--card));border:1px solid color-mix(in srgb,var(--accent) 30%,var(--line));border-radius:var(--radius);padding:18px 20px;margin-bottom:22px;display:flex;gap:14px;align-items:flex-start}
.banner__icon{font-size:20px;flex:none}
.banner strong{color:var(--accent)}

/* Stat cards */
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:18px;box-shadow:var(--shadow-sm);transition:transform .15s,border-color .15s}
.stat:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.stat__label{font-size:12px;color:var(--subtext);display:flex;align-items:center;gap:7px}
.stat__icon{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:13px;background:var(--accent-ink);color:var(--accent)}
.stat__value{font-size:25px;font-weight:700;letter-spacing:-.03em;margin-top:10px}
.stat__sub{font-size:12px;color:var(--subtext);margin-top:2px}

/* Card */
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:18px;box-shadow:var(--shadow-sm);margin-bottom:20px}
.card__head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:12px;flex-wrap:wrap}
h2{font-size:15px;font-weight:600;letter-spacing:-.01em}
.card__note{font-size:12px;color:var(--subtext);margin-bottom:14px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.chart-wrap{position:relative;height:300px}

/* Model summary table */
.tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
.tbl th{text-align:left;color:var(--subtext);font-weight:600;padding:10px 12px;border-bottom:1px solid var(--line);white-space:nowrap;cursor:pointer;user-select:none}
.tbl th:hover{color:var(--text)}
.tbl td{padding:11px 12px;border-bottom:1px solid var(--line-soft)}
.tbl tr:last-child td{border-bottom:none}
.tbl tbody tr:hover td{background:color-mix(in srgb,var(--accent-2) 7%,transparent)}
.price{font-family:var(--mono);font-weight:600;color:var(--accent)}
.tag{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;background:var(--accent-ink);color:var(--accent)}
.tag--chair{background:color-mix(in srgb,var(--accent-2) 18%,transparent);color:var(--accent-2)}
.tag--stand{background:color-mix(in srgb,var(--warn) 18%,transparent);color:var(--warn)}
.tag--slit{background:color-mix(in srgb,#8B5CF6 20%,transparent);color:#a98bff}
.range-bar{height:6px;border-radius:3px;background:var(--card-2);position:relative;min-width:90px;margin-top:5px}
.range-bar__fill{position:absolute;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--accent-2),var(--accent))}
.range-bar__dot{position:absolute;top:50%;width:9px;height:9px;border-radius:50%;background:#fff;border:2px solid var(--accent);transform:translate(-50%,-50%)}

/* Filters */
.filters{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:20px}
select,input{background:var(--card-2);border:1px solid var(--line);border-radius:9px;padding:9px 11px;color:var(--text);font:inherit}
select{cursor:pointer}
.seg{display:inline-flex;background:var(--card-2);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.seg button{background:none;border:none;color:var(--subtext);font:inherit;font-weight:600;padding:8px 14px;cursor:pointer;transition:background .15s,color .15s}
.seg button.is-active{background:var(--accent-ink);color:var(--accent)}

/* Raw table */
.raw td{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px}
.icon-btn{background:none;border:none;color:var(--subtext);cursor:pointer;font-size:16px;width:32px;height:32px;border-radius:8px;display:grid;place-items:center}
.icon-btn:hover{background:var(--card-2);color:var(--text)}

/* Toast */
.toasts{position:fixed;bottom:22px;right:22px;display:flex;flex-direction:column;gap:10px;z-index:90}
.toast{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:10px;padding:12px 16px;box-shadow:var(--shadow);animation:tin .25s}
@keyframes tin{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}

.note{font-size:12px;color:var(--subtext);margin-top:10px;line-height:1.6}
@media(max-width:900px){.grid-2{grid-template-columns:1fr}.cards{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.cards{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;transition-duration:.001ms!important}}
</style>
</head>
<body>
<div class="wrap">

  <div class="head">
    <div class="head__left">
      <span class="mark">◧</span>
      <div>
        <h1>Auction Price Research</h1>
        <div class="sub">Used ophthalmic equipment — buying intelligence from GSA auction sales</div>
      </div>
    </div>
    <div class="head__actions">
      <button class="btn btn--ghost" id="themeToggle">☀ Light</button>
      <button class="btn btn--ghost" id="exportCsv">Export CSV</button>
      <button class="btn btn--secondary" id="addSale">+ Add a sale</button>
    </div>
  </div>

  <div class="crumb"><a href="index.html">← Back to Equipment Tracker</a></div>

  <div class="banner">
    <span class="banner__icon">◎</span>
    <div id="headline">Analyzing sales…</div>
  </div>

  <div class="cards" id="cards"></div>

  <div class="filters">
    <div class="seg" id="catSeg"></div>
    <select id="sortBy">
      <option value="date">Sort: newest sale</option>
      <option value="price">Sort: highest price</option>
      <option value="pricelow">Sort: lowest price</option>
    </select>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card__head"><h2>Price over time</h2></div>
      <div class="card__note">Each dot is one recorded sale. Look for the trend before you bid.</div>
      <div class="chart-wrap"><canvas id="scatter"></canvas></div>
    </div>
    <div class="card">
      <div class="card__head"><h2>Average price by model</h2></div>
      <div class="card__note">Your baseline for a fair offer.</div>
      <div class="chart-wrap"><canvas id="byModel"></canvas></div>
    </div>
  </div>

  <div class="card">
    <div class="card__head"><h2>Model buying guide</h2></div>
    <div class="card__note">Low / average / high paid per model, so you know a good deal when you see one.</div>
    <table class="tbl" id="guideTbl"></table>
  </div>

  <div class="card">
    <div class="card__head"><h2>All recorded sales</h2></div>
    <table class="tbl raw" id="rawTbl"></table>
    <p class="note" id="dataNote"></p>
  </div>

</div>
<div class="toasts" id="toasts"></div>

<script>
(() => {
'use strict';

/* ---- Seed data: cleaned from Scatter_charts_on_equipment_prices.xlsx ----
   These are AUCTION SALE COMPARABLES (what used units sold for), not owned
   inventory. Source: GSA auctions. Edit / add rows freely — saved locally. */
const SEED = [
  {category:"Chair",    brand:"Reliance",   model:"7000 L",              dateSold:"2026-02-12", priceEach:3250,   notes:"GSA Auction — Lot of 24 chairs, good condition from pictures"},
  {category:"Chair",    brand:"Reliance",   model:"7000",                dateSold:"2025-03-28", priceEach:1935,   notes:"GSA Auction — just 1 chair"},
  {category:"Chair",    brand:"Reliance",   model:"7000",                dateSold:"2025-03-21", priceEach:2363.5, notes:"GSA Auction — lot of 10 chairs"},
  {category:"Chair",    brand:"Reliance",   model:"2×7000 + 4×FX920",    dateSold:"2024-10-04", priceEach:2670,   notes:"GSA Auction — mixed lot of 6 chairs"},
  {category:"Chair",    brand:"Reliance",   model:"6200",                dateSold:"2024-05-29", priceEach:1505,   notes:"GSA Auction — single chair"},
  {category:"Stand",    brand:"Reliance",   model:"7900",                dateSold:"2026-02-12", priceEach:2103,   notes:"GSA Auction — lot of 24, good condition"},
  {category:"Stand",    brand:"Reliance",   model:"7900",                dateSold:"2025-07-03", priceEach:2403,   notes:"GSA Auction — lot of 5, new condition"},
  {category:"Slit Lamp",brand:"Haag-Streit",model:"BM 900",             dateSold:"2025-11-24", priceEach:5500,   notes:""},
];

const KEY='ect.pricing.v1', PREF='ect.pricing.prefs.v1';
let sales=[], prefs={theme:'dark'}, filterCat='All', charts={};

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=n=>isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):'—';
const money2=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(+n||0);
const fmtDate=d=>d?new Date(d+'T00:00:00').toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}):'—';
const PALETTE=['#3B82F6','#F59E0B','#8B5CF6','#4CAF50','#EF4444','#14B8A6','#EC4899'];

function load(){
  try{sales=JSON.parse(localStorage.getItem(KEY))||SEED.slice()}catch{sales=SEED.slice()}
  try{prefs=JSON.parse(localStorage.getItem(PREF))||prefs}catch{}
}
function save(){localStorage.setItem(KEY,JSON.stringify(sales))}
function savePrefs(){localStorage.setItem(PREF,JSON.stringify(prefs))}
function toast(m){const e=document.createElement('div');e.className='toast';e.textContent=m;$('#toasts').appendChild(e);setTimeout(()=>e.remove(),2600)}

const cats=()=>['All',...new Set(sales.map(s=>s.category))];
const filtered=()=>filterCat==='All'?sales:sales.filter(s=>s.category===filterCat);

// group by model within current filter
function byModel(){
  const m={};
  filtered().forEach(s=>{(m[s.model]=m[s.model]||{model:s.model,category:s.category,prices:[],dates:[]});m[s.model].prices.push(s.priceEach);m[s.model].dates.push(s.dateSold)});
  return Object.values(m).map(g=>{
    const p=g.prices.filter(x=>isFinite(x));
    return{...g,n:p.length,min:Math.min(...p),max:Math.max(...p),avg:p.reduce((a,b)=>a+b,0)/p.length};
  });
}

function renderHeadline(){
  const f=filtered().filter(s=>isFinite(s.priceEach));
  if(!f.length){$('#headline').innerHTML='No sales recorded yet.';return}
  const avg=f.reduce((a,b)=>a+b.priceEach,0)/f.length;
  const cheapest=f.slice().sort((a,b)=>a.priceEach-b.priceEach)[0];
  const models=byModel();
  const best=models.filter(m=>m.n>1).sort((a,b)=>a.avg-b.avg)[0];
  let msg=`Across <strong>${f.length}</strong> recorded ${filterCat==='All'?'':filterCat.toLowerCase()+' '}sales, the average paid was <strong>${money(avg)}</strong>. `;
  msg+=`The lowest was <strong>${money(cheapest.priceEach)}</strong> for a ${esc(cheapest.brand)} ${esc(cheapest.model)} (${fmtDate(cheapest.dateSold)}). `;
  if(best) msg+=`Best-sampled model: <strong>${esc(best.model)}</strong> averages ${money(best.avg)} across ${best.n} sales — a fair target offer.`;
  $('#headline').innerHTML=msg;
}

function renderCards(){
  const f=filtered().filter(s=>isFinite(s.priceEach));
  const total=f.reduce((a,b)=>a+b.priceEach,0);
  const avg=f.length?total/f.length:0;
  const models=new Set(filtered().map(s=>s.model)).size;
  const recent=filtered().filter(s=>s.dateSold).sort((a,b)=>b.dateSold.localeCompare(a.dateSold))[0];
  const c=[
    {i:'#',l:'Recorded sales',v:f.length,s:filterCat==='All'?'all categories':filterCat},
    {i:'≈',l:'Average price',v:money(avg),s:'per unit'},
    {i:'⊞',l:'Distinct models',v:models,s:'tracked'},
    {i:'◷',l:'Most recent sale',v:recent?fmtDate(recent.dateSold):'—',s:recent?`${recent.model} · ${money(recent.priceEach)}`:'—'},
  ];
  $('#cards').innerHTML=c.map(x=>`<div class="stat"><div class="stat__label"><span class="stat__icon">${x.i}</span>${x.l}</div><div class="stat__value">${x.v}</div><div class="stat__sub">${esc(x.s)}</div></div>`).join('');
}

function catClass(c){return c==='Chair'?'chair':c==='Stand'?'stand':c==='Slit Lamp'?'slit':''}

function renderGuide(){
  const rows=byModel().sort((a,b)=>b.avg-a.avg);
  const globalMax=Math.max(...rows.map(r=>r.max),1);
  $('#guideTbl').innerHTML=`<thead><tr>
    <th>Model</th><th>Cat.</th><th># sales</th><th>Low</th><th>Avg</th><th>High</th><th>Range</th></tr></thead><tbody>`+
    rows.map(r=>{
      const lo=r.min/globalMax*100, hi=r.max/globalMax*100, av=r.avg/globalMax*100;
      return `<tr>
        <td><strong>${esc(r.model)}</strong></td>
        <td><span class="tag tag--${catClass(r.category)}">${esc(r.category)}</span></td>
        <td>${r.n}</td>
        <td class="price">${money(r.min)}</td>
        <td class="price">${money(r.avg)}</td>
        <td class="price">${money(r.max)}</td>
        <td><div class="range-bar"><div class="range-bar__fill" style="left:${lo}%;width:${Math.max(hi-lo,1)}%"></div><div class="range-bar__dot" style="left:${av}%"></div></div></td>
      </tr>`;
    }).join('')+`</tbody>`;
}

function renderRaw(){
  const sort=$('#sortBy').value;
  let rows=filtered().slice();
  if(sort==='date') rows.sort((a,b)=>(b.dateSold||'').localeCompare(a.dateSold||''));
  if(sort==='price') rows.sort((a,b)=>(b.priceEach||0)-(a.priceEach||0));
  if(sort==='pricelow') rows.sort((a,b)=>(a.priceEach||0)-(b.priceEach||0));
  $('#rawTbl').innerHTML=`<thead><tr><th>Date sold</th><th>Category</th><th>Brand</th><th>Model</th><th>Price each</th><th>Notes</th><th></th></tr></thead><tbody>`+
    rows.map(r=>{const idx=sales.indexOf(r);return `<tr>
      <td>${fmtDate(r.dateSold)}</td>
      <td><span class="tag tag--${catClass(r.category)}">${esc(r.category)}</span></td>
      <td>${esc(r.brand)}</td>
      <td><strong>${esc(r.model)}</strong></td>
      <td class="price">${money2(r.priceEach)}</td>
      <td class="muted" title="${esc(r.notes)}">${esc(r.notes||'—')}</td>
      <td><button class="icon-btn" data-del="${idx}" title="Remove">✕</button></td>
    </tr>`}).join('')+`</tbody>`;
  $$('#rawTbl [data-del]').forEach(b=>b.onclick=()=>{sales.splice(+b.dataset.del,1);save();renderAll();toast('Sale removed.')});
}

function chartColors(){const c=getComputedStyle(document.documentElement);return{grid:c.getPropertyValue('--line').trim(),text:c.getPropertyValue('--subtext').trim(),card:c.getPropertyValue('--card').trim()}}

function renderCharts(){
  if(typeof Chart==='undefined')return;
  Object.values(charts).forEach(c=>c&&c.destroy());
  const cc=chartColors();
  Chart.defaults.color=cc.text;Chart.defaults.borderColor=cc.grid;Chart.defaults.font.family=getComputedStyle(document.body).fontFamily;

  // Scatter: price over time, colored by category
  const catList=[...new Set(filtered().map(s=>s.category))];
  const ds=catList.map((cat,i)=>({
    label:cat,
    data:filtered().filter(s=>s.category===cat&&s.dateSold&&isFinite(s.priceEach)).map(s=>({x:s.dateSold,y:s.priceEach,m:s.model})),
    backgroundColor:PALETTE[i%PALETTE.length],pointRadius:7,pointHoverRadius:9,
  }));
  charts.scatter=new Chart($('#scatter'),{
    type:'scatter',
    data:{datasets:ds},
    options:{responsive:true,maintainAspectRatio:false,
      parsing:{xAxisKey:'x',yAxisKey:'y'},
      plugins:{legend:{position:'top',labels:{boxWidth:12}},
        tooltip:{callbacks:{label:ctx=>` ${ctx.raw.m}: ${money2(ctx.raw.y)} (${fmtDate(ctx.raw.x)})`}}},
      scales:{
        x:{type:'category',labels:[...new Set(filtered().map(s=>s.dateSold).filter(Boolean))].sort(),
           ticks:{callback:function(v){const l=this.getLabelForValue(v);return l?new Date(l+'T00:00:00').toLocaleDateString('en-US',{month:'short',year:'2-digit'}):l},maxRotation:0},grid:{display:false}},
        y:{beginAtZero:true,ticks:{callback:v=>'$'+(v/1000)+'k'},grid:{color:cc.grid}}}}
  });

  // Bar: avg by model
  const bm=byModel().sort((a,b)=>b.avg-a.avg);
  charts.byModel=new Chart($('#byModel'),{
    type:'bar',
    data:{labels:bm.map(m=>m.model),datasets:[{data:bm.map(m=>m.avg),backgroundColor:bm.map((_,i)=>PALETTE[i%PALETTE.length]),borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` avg ${money2(ctx.parsed.x)}`}}},
      scales:{x:{beginAtZero:true,ticks:{callback:v=>'$'+(v/1000)+'k'},grid:{color:cc.grid}},y:{grid:{display:false}}}}
  });
}

function renderSeg(){
  $('#catSeg').innerHTML=cats().map(c=>`<button class="${c===filterCat?'is-active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  $$('#catSeg [data-cat]').forEach(b=>b.onclick=()=>{filterCat=b.dataset.cat;renderAll()});
}

function renderAll(){renderSeg();renderHeadline();renderCards();renderCharts();renderGuide();renderRaw();
  $('#dataNote').innerHTML=`These are auction sale comparables (what used units sold for), sourced from GSA auctions — not owned inventory. ${sales.length} sales tracked. Data is saved in your browser; add or remove rows anytime.`;
}

function addSale(){
  const category=prompt('Category (Chair / Stand / Slit Lamp / …):','Chair');if(category===null)return;
  const brand=prompt('Brand:','Reliance')||'';
  const model=prompt('Model:','')||'';
  const dateSold=prompt('Date sold (YYYY-MM-DD):',new Date().toISOString().slice(0,10))||'';
  const priceEach=parseFloat(prompt('Price each ($):','')||'');
  if(!model||!isFinite(priceEach)){toast('Need at least a model and price.');return}
  const notes=prompt('Notes (optional):','')||'';
  sales.unshift({category:category.trim(),brand:brand.trim(),model:model.trim(),dateSold:dateSold.trim(),priceEach,notes:notes.trim()});
  save();renderAll();toast('Sale added.');
}

function exportCsv(){
  const rows=sales.map(s=>({Category:s.category,Brand:s.brand,Model:s.model,'Date Sold':s.dateSold,'Price Each':s.priceEach,Notes:s.notes}));
  const ws=XLSX.utils.json_to_sheet(rows);const csv=XLSX.utils.sheet_to_csv(ws);
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='auction-price-research.csv';a.click();
  toast('CSV exported.');
}

function applyTheme(){document.documentElement.dataset.theme=prefs.theme;$('#themeToggle').textContent=prefs.theme==='dark'?'☀ Light':'☾ Dark';renderCharts()}

function boot(){
  load();applyTheme();renderAll();
  $('#sortBy').onchange=renderRaw;
  $('#addSale').onclick=addSale;
  $('#exportCsv').onclick=exportCsv;
  $('#themeToggle').onclick=()=>{prefs.theme=prefs.theme==='dark'?'light':'dark';savePrefs();applyTheme()};
}
document.addEventListener('DOMContentLoaded',boot);
})();
</script>
</body>
</html>
