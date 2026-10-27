(async () => {
const loadText = async path => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.text();
};

function parseCSV(text){
  const rows=[]; let row=[], field='', quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"' && text[i+1]==='"'){field+='"';i++;}
      else if(c==='"'){quoted=false;}
      else field+=c;
    }else{
      if(c==='"') quoted=true;
      else if(c===','){row.push(field);field='';}
      else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}
      else if(c!=='\r') field+=c;
    }
  }
  if(field.length || row.length){row.push(field);rows.push(row);}
  const header=(rows.shift()||[]).map((x,i)=>i===0?x.replace(/^\uFEFF/,''):x);
  return rows.filter(r=>r.some(x=>x!=='')).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]??''])));
}

const [characterRows,supportRows,growthRows,classRows,recruitmentRows,abilityRows,giftRows,preferenceRows] = await Promise.all([
  loadText('./data/characters.csv').then(parseCSV),
  loadText('./data/supports.csv').then(parseCSV),
  loadText('./data/growths.csv').then(parseCSV),
  loadText('./data/classes.csv').then(parseCSV),
  loadText('./data/recruitment.csv').then(parseCSV),
  loadText('./data/abilities.csv').then(parseCSV),
  loadText('./data/gifts.csv').then(parseCSV),
  loadText('./data/preferences.csv').then(parseCSV)
]);

const STAT_NAMES=["HP","Str","Mag","Spd","Dex","Def","Res","Lck","Cha"];

characterRows.sort((a,b)=>Number(a.Order)-Number(b.Order));
const names=characterRows.map(r=>r.Character);
const ASSET_ALIAS=Object.fromEntries(characterRows.filter(r=>r.AssetAlias).map(r=>[r.Character,r.AssetAlias]));
const PORTRAIT_FILE_OVERRIDE=Object.fromEntries(characterRows.filter(r=>r.PortraitOverride).map(r=>[r.Character,r.PortraitOverride]));

const supports=Object.fromEntries(names.map(n=>[n,[]]));
supportRows.forEach(r=>{
  (supports[r.Character]??=[]).push({name:r.Partner,rank:r.MaxRank,levels:r.Levels?r.Levels.split('|').filter(Boolean):[]});
});
const DATA={names,supports};

const GROWTH={}; let MU_ENHANCED=null;
growthRows.forEach(r=>{
  const vals=STAT_NAMES.map(s=>Number(r[s]));
  if(r.Character==='Mu' && r.Variant==='Signs of Growth') MU_ENHANCED=vals;
  else if(r.Variant==='Base') GROWTH[r.Character]=vals;
});

classRows.sort((a,b)=>Number(a.Order)-Number(b.Order));
const CLASS_DATA=classRows.map(r=>{
  const hasGrowth=STAT_NAMES.some(s=>r[s]!=='');
  return {tier:r.Tier,name:r.Class,growth:hasGrowth?STAT_NAMES.map(s=>Number(r[s]||0)):null};
});
const CLASS_TIERS=[...new Set(classRows.map(r=>r.Tier))];

const RECRUITMENT={};
recruitmentRows.sort((a,b)=>Number(a.Order)-Number(b.Order));
recruitmentRows.forEach(r=>(RECRUITMENT[r.Character]??={items:[]}).items.push({label:r.Label,text:r.Text}));

const PERSONAL_ABILITIES={};
abilityRows.sort((a,b)=>Number(a.Order)-Number(b.Order));
abilityRows.forEach(r=>(PERSONAL_ABILITIES[r.Character]??=[]).push([r.Ability,r.Unlock,r.Description]));

const GIFT_PREFS={};
names.forEach(n=>GIFT_PREFS[n]={loved:[],reallyLiked:[],likes:[],interests:[]});
giftRows.forEach(r=>{
  const p=GIFT_PREFS[r.Character]??={loved:[],reallyLiked:[],likes:[],interests:[]};
  if(r.Preference==='Loved') p.loved.push(r.Gift);
  else if(r.Preference==='Really Liked') p.reallyLiked.push(r.Gift);
});
preferenceRows.forEach(r=>{
  const p=GIFT_PREFS[r.Character]??={loved:[],reallyLiked:[],likes:[],interests:[]};
  if(r.Type==='Like') p.likes.push(r.Preference);
  else if(r.Type==='Interest') p.interests.push(r.Preference);
});











const CLASS_ICON_DIR="class-icons";
const CLASS_COOKIE="fwClassPrefs";
function readCookie(name){
  const p=name+"=";
  const hit=document.cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith(p));
  if(!hit)return null;
  try{return decodeURIComponent(hit.slice(p.length));}catch{return hit.slice(p.length);}
}
function loadClassPrefs(){
  let v=null, raw=readCookie(CLASS_COOKIE);
  if(raw){try{v=JSON.parse(raw);}catch{}}
  if(!v){try{v=JSON.parse(localStorage.getItem("fwClassPrefsFallback")||"null");}catch{}}
  if(!v){try{const legacy=JSON.parse(localStorage.getItem("fwSelectedClasses")||"null");if(legacy)v={classes:legacy,enabled:{}};}catch{}}
  return v||{classes:{},enabled:{}};
}
const classPrefs=loadClassPrefs();
const selectedClasses=classPrefs.classes||{};
const classEnabled=classPrefs.enabled||{};
Object.keys(selectedClasses).forEach(n=>{if(classEnabled[n]===undefined)classEnabled[n]=true;});
function saveSelectedClasses(){
  const state={classes:selectedClasses,enabled:classEnabled};
  document.cookie=`${CLASS_COOKIE}=${encodeURIComponent(JSON.stringify(state))}; Max-Age=31536000; Path=/; SameSite=Lax`;
  try{localStorage.setItem("fwClassPrefsFallback",JSON.stringify(state));}catch{}
}
const TOTAL_STATS_COOKIE="fwGrowthTotalStats";
function loadTotalStats(){
  let raw=readCookie(TOTAL_STATS_COOKIE), parsed=null;
  if(raw){try{parsed=JSON.parse(raw);}catch{}}
  if(!parsed){try{parsed=JSON.parse(localStorage.getItem("fwGrowthTotalStatsFallback")||"null");}catch{}}
  const result={};
  STAT_NAMES.forEach(s=>result[s]=parsed && typeof parsed[s]==='boolean' ? parsed[s] : true);
  return result;
}
const totalStatEnabled=loadTotalStats();
function saveTotalStats(){
  const payload=encodeURIComponent(JSON.stringify(totalStatEnabled));
  document.cookie=`${TOTAL_STATS_COOKIE}=${payload}; Max-Age=31536000; Path=/; SameSite=Lax`;
  try{localStorage.setItem("fwGrowthTotalStatsFallback",JSON.stringify(totalStatEnabled));}catch{}
}
function includedStatCount(){ return STAT_NAMES.filter(s=>totalStatEnabled[s]).length; }
function growthTotal(values){ return values.reduce((sum,v,i)=>sum+(totalStatEnabled[STAT_NAMES[i]]?v:0),0); }
function totalFilterMarkup(compact=false){
  const count=includedStatCount();
  return `<div class="total-filter-panel ${compact?'compact':''}">
    <div class="total-filter-head">
      <div>
        <div class="total-filter-title">✦ Stats counted in Total</div>
        <div class="total-filter-count">${count} of ${STAT_NAMES.length} stats included</div>
      </div>
      <div class="total-filter-actions">
        <button class="total-filter-action" type="button" data-total-action="all">Include all</button>
        <button class="total-filter-action" type="button" data-total-action="none">Exclude all</button>
      </div>
    </div>
    <div class="total-stat-chips">
      ${STAT_NAMES.map(s=>`<button type="button" class="total-stat-chip" data-total-stat="${s}" aria-pressed="${totalStatEnabled[s]}">${s}</button>`).join('')}
    </div>
  </div>`;
}
function bindTotalStatControls(scope=document){
  scope.querySelectorAll('[data-total-stat]').forEach(btn=>btn.onclick=()=>{
    const stat=btn.dataset.totalStat;
    totalStatEnabled[stat]=!totalStatEnabled[stat];
    saveTotalStats();
    refreshGrowthDisplays();
  });
  scope.querySelectorAll('[data-total-action]').forEach(btn=>btn.onclick=()=>{
    const on=btn.dataset.totalAction==='all';
    STAT_NAMES.forEach(s=>totalStatEnabled[s]=on);
    saveTotalStats();
    refreshGrowthDisplays();
  });
}
function refreshGrowthDisplays(){
  if(growths && growths.classList.contains('active')) renderGrowthTable();
  if(detail && detail.classList.contains('active') && current) showDetail(current);
}
let muPassive=true, growthSort='roster', growthSortAsc=true, growthSortClicks={};

const $ = s => document.querySelector(s);
const home=$('#home'), detail=$('#detail'), growths=$('#growths'), grid=$('#grid'), search=$('#search'), detailContent=$('#detailContent');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sortMode='roster', rankFilter='all', homeScroll=0, current=null;

const initials = n => { const p=n.trim().split(/\s+/); return p.length>1 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : n[0].toUpperCase(); };
const slug = n => ASSET_ALIAS[n] || n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const cls = r => r==='?' ? 'Q' : r;
const portraitFile = n => `portraits/${PORTRAIT_FILE_OVERRIDE[n] || `${slug(n)}.webp`}`;
const portrait = (n, c='') => `<span class="portrait ${c}"><span class="fallback">${initials(n)}</span><img src="${portraitFile(n)}" alt="${esc(n)}" loading="lazy" onerror="this.remove()"></span>`;
const badge = (x, dim) => `<span class="badge ${cls(x)}${dim?' dim':''}" title="${x==='?'?'Unknown rank':'Rank '+x}">${x}</span>`;
const rankSeq = m => m==='A'?['C','B','A'] : m==='B'?['C','B'] : m==='C'?['C'] : [m];
const tally = n => DATA.supports[n].reduce((t,s)=>(t[s.rank]=(t[s.rank]||0)+1,t),{});
const dots = n => { const t=tally(n); return ['A','B','C','?'].filter(r=>t[r]).map(r=>`<span class="dot ${cls(r)}">${t[r]}${r}</span>`).join(''); };

// Header stats
const bonds = Object.values(DATA.supports).reduce((a,l)=>a+l.length,0)/2;
$('#stats').innerHTML = `<span class="chip"><b>${DATA.names.length}</b> characters</span><span class="chip"><b>${Math.round(bonds)}</b> support bonds</span><span class="chip"><b>${Object.values(DATA.supports).reduce((a,l)=>a+l.filter(s=>s.rank==='A').length,0)/2}</b> A-rank pairs</span>`;

function renderGrid() {
  const q = search.value.trim().toLowerCase();
  $('#searchWrap').classList.toggle('has-text', !!q);
  let names = DATA.names.filter(n => n.toLowerCase().includes(q));
  if (sortMode==='az') names.sort((a,b)=>a.localeCompare(b));
  if (sortMode==='most') names.sort((a,b)=>DATA.supports[b].length-DATA.supports[a].length || a.localeCompare(b));
  $('#resultCount').textContent = q ? `${names.length} of ${DATA.names.length} characters` : `${names.length} characters`;
  if (!names.length) { grid.innerHTML = `<div class="empty">No one by that name…<small>Try a shorter search.</small></div>`; return; }
  grid.innerHTML = names.map((n,i) => `
    <a class="unit" href="#/${encodeURIComponent(n)}" style="--i:${Math.min(i,24)};text-decoration:none">
      ${portrait(n)}
      <span><span class="name" style="display:block">${esc(n)}</span>
      <span class="count" style="display:block">${DATA.supports[n].length} support${DATA.supports[n].length===1?'':'s'}</span>
      <span class="dots">${dots(n)}</span></span>
    </a>`).join('');
}


function giftChips(items,type){
  if(!items || !items.length) return `<span class="gift-empty">None listed</span>`;
  const limit=8, visible=items.slice(0,limit), hidden=items.slice(limit);
  return `${visible.map(x=>`<span class="gift-chip ${type}">${esc(x)}</span>`).join('')}
    ${hidden.map(x=>`<span class="gift-chip ${type} gift-hidden">${esc(x)}</span>`).join('')}
    ${hidden.length?`<button class="gift-more" type="button" data-gift-more>+${hidden.length} more</button>`:''}`;
}
function giftCard(name){
  const p=GIFT_PREFS[name];
  if(!p) return '';
  const loved=p.loved||[], really=p.reallyLiked||[], likes=p.likes||[], interests=p.interests||[];
  const giftCount=loved.length+really.length, prefText=arr=>arr&&arr.length?esc(arr.join(', ')):'None listed';
  return `<section class="gift-card">
    <div class="gift-head"><div class="gift-title"><span class="gift-title-icon">✦</span> Gifts & Preferences</div>
      <div class="gift-counts">${loved.length?`<span class="gift-count loved">♥ ${loved.length} loved</span>`:''}${really.length?`<span class="gift-count liked">★ ${really.length} really liked</span>`:''}${!giftCount?'<span class="gift-count">No preferred gifts listed</span>':''}</div></div>
    <div class="gift-body">
      ${loved.length?`<div class="gift-tier"><div class="gift-tier-label loved"><span class="heart">♥</span> Loved Gifts</div><div class="gift-chips">${giftChips(loved,'loved')}</div></div>`:''}
      ${really.length?`<div class="gift-tier"><div class="gift-tier-label really"><span class="heart">★</span> Really Liked</div><div class="gift-chips">${giftChips(really,'really')}</div></div>`:''}
      ${!giftCount?'<div class="gift-empty">No loved or really liked gifts are listed.</div>':''}
      <div class="preference-row"><div class="preference-box"><div class="preference-label">Likes</div><div class="preference-text">${prefText(likes)}</div></div><div class="preference-box"><div class="preference-label">Interests</div><div class="preference-text">${prefText(interests)}</div></div></div>
    </div>
  </section>`;
}
function bindGiftControls(scope=document){
  scope.querySelectorAll('[data-gift-more]').forEach(btn=>btn.onclick=()=>{
    const wrap=btn.closest('.gift-chips'); wrap.querySelectorAll('.gift-hidden').forEach(x=>x.classList.remove('gift-hidden')); btn.remove();
  });
}


function growthClass(x){ return x>=50?'hi':x<=25?'lo':''; }
function growthTone(x){ return x>=50?'high':x>=35?'mid':'low'; }
function personalGrowth(name){ return name==='Mu' && muPassive ? MU_ENHANCED : GROWTH[name]; }
function classByName(name){ return CLASS_DATA.find(c=>c.name===name); }
function classSlug(name){ return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function classIconPath(name, ext='webp'){ return `${CLASS_ICON_DIR}/${classSlug(name)}.${ext}`; }
function classIcon(name, cls='class-icon'){
  const slug=classSlug(name);
  return `<img class="${cls}" src="${CLASS_ICON_DIR}/${slug}.webp" alt="${esc(name)} icon" loading="lazy" data-icon-slug="${slug}" data-icon-try="0" onerror="classIconFallback(this)">`;
}
function classIconFallback(img){
  const tries=['png','jpg','jpeg'];
  const i=Number(img.dataset.iconTry||0);
  if(i<tries.length){img.dataset.iconTry=String(i+1);img.src=`${CLASS_ICON_DIR}/${img.dataset.iconSlug}.${tries[i]}`;return;}
  const wrap=img.parentElement; img.remove(); if(wrap && !wrap.querySelector('.class-icon-fallback')) wrap.insertAdjacentHTML('beforeend',`<span class="class-icon-fallback">${(wrap.dataset.initial||'?')}</span>`);
}
function selectedClass(name){ return selectedClasses[name] ? classByName(selectedClasses[name]) : null; }
function classIsEnabled(name){return !selectedClasses[name]||classEnabled[name]!==false;}
function displayedGrowth(name){
  const base=personalGrowth(name); if(!base) return null;
  const c=selectedClass(name); if(!c||!c.growth||!classIsEnabled(name)) return [...base];
  return base.map((v,i)=>v+c.growth[i]);
}
function growthCard(name) {
  const base=personalGrowth(name), c=selectedClass(name), active=classIsEnabled(name), v=displayedGrowth(name);
  if (!v) return `<div class="info-card"><h3>Growth Rates</h3><div class="info-note">No growth-rate entry found.</div></div>`;
  const rows = v.map((x,i)=>{
    const mod=c&&c.growth&&active?c.growth[i]:0;
    const delta=mod?`<span class="gdelta ${mod<0?'neg':''}">${mod>0?'+':''}${mod}</span>`:'';
    const included=totalStatEnabled[STAT_NAMES[i]];
    return `<div class="gbar ${included?'':'stat-excluded'}"><span class="gname">${STAT_NAMES[i]}</span><div class="track"><div class="fill ${growthClass(x)}" data-w="${Math.min(100,x/90*100)}"></div></div><span class="gval">${x}%${delta}</span></div>`;
  }).join('');
  const toggle = name==='Mu' ? `<label class="mu-toggle" title="Signs of Growth is active by default"><input id="muGrowthToggle" type="checkbox" ${muPassive?'checked':''}><span></span> Signs of Growth</label>` : '';
  const mu = name==='Mu' ? `<div class="info-note">${muPassive?'<strong>Passive applied:</strong> showing Mu’s effective personal growths with Signs of Growth.':'Showing Mu’s base growths without Signs of Growth.'}</div>` : '';
  const slotIcon=c ? classIcon(c.name,'class-icon') : '<span class="class-slot-empty">?</span>';
  const classPanel=`<div class="class-panel${c?' has-class':''}">
      <div class="class-panel-main">
        <div class="class-slot ${c&&!active?'off':''}"><span class="class-slot-icon" data-initial="${c?esc(c.name[0]):'?'}">${slotIcon}</span><span class="class-slot-text"><small>Class</small><strong>${c?esc(c.name):'None selected'}</strong></span></div>
        <div class="class-panel-actions"><button class="class-btn" id="chooseClassBtn">${c?'Change':'Set Class'}</button>${c?'<button class="class-clear" id="clearClassBtn" title="Remove class">Clear</button>':''}</div>
      </div>
      ${c?`<div class="class-panel-foot"><label class="class-toggle"><input id="classGrowthToggle" type="checkbox" ${active?'checked':''}><span></span> Include class growths</label></div>`:''}
    </div>`;
  const classNote=c&&c.growth ? `<div class="info-note"><strong>${esc(c.name)}</strong> growth modifiers are ${active?'included in':'currently excluded from'} the totals above.</div>` : '';
  const total=growthTotal(v), includedCount=includedStatCount();
  return `<div class="info-card"><h3>Growth Rates <small>Total ${total}% · ${includedCount}/${STAT_NAMES.length} stats</small></h3>${toggle}
    ${classPanel}
    ${totalFilterMarkup(true)}
    ${rows}
    <div class="legend"><span><i style="background:var(--green)"></i>50%+ high</span><span><i style="background:var(--gold-deep)"></i>Average</span><span><i style="background:#7b818c"></i>25% or less</span></div>
    <div class="info-note">Character growth + selected class growth = displayed growth. Only highlighted stats are counted in <strong>Total</strong>.</div>${classNote}${mu}
    <a class="source-link" href="https://serenesforest.net/fortunes-weave/characters/growth-rates/" target="_blank" rel="noopener">Character growths: Serenes Forest ↗</a><br>
    <a class="source-link" href="https://serenesforest.net/fortunes-weave/classes/growth-rates/" target="_blank" rel="noopener">Class growths: Serenes Forest ↗</a></div>`;
}

function renderClassModal(character){
  const body=$('#classModalBody');
  body.innerHTML=CLASS_TIERS.map(tier=>{
    const rows=CLASS_DATA.filter(c=>c.tier===tier);
    return `<section class="class-tier"><h4 class="class-tier-title">${tier}</h4><div class="class-grid">${rows.map(c=>{
      const active=selectedClasses[character]===c.name;
      const summary=c.growth?c.growth.map((v,i)=>v?`${STAT_NAMES[i]} ${v>0?'+':''}${v}`:'').filter(Boolean).slice(0,2).join(' · '):'';
      return `<button class="class-option ${active?'selected':''}" data-class="${esc(c.name)}" ${c.growth===null?'disabled':''} title="${c.growth===null?'Growth rates not yet listed by Serenes Forest':esc(c.name)}"><span class="class-icon-wrap" data-initial="${esc(c.name[0])}">${classIcon(c.name)}</span><span class="class-option-name">${esc(c.name)}</span>${c.growth===null?'<span class="class-no-data">Growth data unavailable</span>':summary?`<span class="class-growth-summary">${esc(summary)}</span>`:''}</button>`;
    }).join('')}</div></section>`;
  }).join('');
  body.querySelectorAll('.class-option:not(:disabled)').forEach(btn=>btn.onclick=()=>{
    selectedClasses[character]=btn.dataset.class; classEnabled[character]=true; saveSelectedClasses(); closeClassModal(); showDetail(character);
  });
}
function openClassModal(character){ renderClassModal(character); $('#classModal').classList.add('open'); document.body.style.overflow='hidden'; }
function closeClassModal(){ $('#classModal').classList.remove('open'); document.body.style.overflow=''; }

function abilityCard(name){
  const skills=PERSONAL_ABILITIES[name]||[];
  const src=`<a class="source-link" href="https://serenesforest.net/fortunes-weave/characters/personal-abilities/" target="_blank" rel="noopener">Source: Serenes Forest ↗</a>`;
  if(!skills.length) return `<div class="info-card"><h3>Personal Abilities</h3><div class="info-note">No personal ability entry found.</div>${src}</div>`;
  return `<div class="info-card"><h3>Personal Abilities <small>${skills.length}</small></h3><div class="ability-list">${skills.map(a=>`<div class="ability-item"><div class="ability-top"><span class="ability-name">${esc(a[0])}</span><span class="ability-unlock">${esc(a[1])}</span></div><div class="ability-desc">${esc(a[2])}</div></div>`).join('')}</div>${src}</div>`;
}

function updateAllClassGrowthsToggle(){
  const toggle=$('#allClassGrowthsToggle'), wrap=$('#allClassGrowthsWrap'), label=$('#allClassGrowthsLabel');
  if(!toggle || !wrap || !label) return;
  const withClass=DATA.names.filter(n=>selectedClass(n));
  if(!withClass.length){
    toggle.checked=false; toggle.indeterminate=false; toggle.disabled=true;
    wrap.classList.remove('mixed'); wrap.classList.add('disabled');
    label.textContent='No classes selected';
    return;
  }
  const enabledCount=withClass.filter(n=>classIsEnabled(n)).length;
  const allOn=enabledCount===withClass.length;
  const allOff=enabledCount===0;
  toggle.disabled=false;
  toggle.checked=allOn;
  toggle.indeterminate=!allOn&&!allOff;
  wrap.classList.toggle('mixed',!allOn&&!allOff);
  wrap.classList.remove('disabled');
  label.textContent=allOn?'All class growths on':allOff?'All class growths off':`${enabledCount}/${withClass.length} class growths on`;
}

function renderGrowthTable(){
  const toggle=$('#growthMuToggle'); if(toggle) toggle.checked=muPassive;
  const filterMount=$('#growthTotalFilters');
  if(filterMount){ filterMount.innerHTML=totalFilterMarkup(false); bindTotalStatControls(filterMount); }

  let names=[...DATA.names];
  const idx=STAT_NAMES.indexOf(growthSort);
  if(growthSort==='name') names.sort((a,b)=>a.localeCompare(b));
  else if(growthSort==='total') names.sort((a,b)=>growthTotal(displayedGrowth(b))-growthTotal(displayedGrowth(a)) || a.localeCompare(b));
  else if(idx>=0) names.sort((a,b)=>displayedGrowth(b)[idx]-displayedGrowth(a)[idx] || a.localeCompare(b));
  if(growthSortAsc && growthSort!=='roster') names.reverse();

  const head=[
    ['name','Character'],
    ['class','Class'],
    ...STAT_NAMES.map(s=>[s,s]),
    ['total',`Total (${includedStatCount()}/${STAT_NAMES.length})`]
  ].map(([key,label])=>{
    const sortable=key!=='class';
    const excluded=STAT_NAMES.includes(key) && !totalStatEnabled[key];
    return `<th ${sortable?`data-gsort="${key}"`:''} class="${growthSort===key?'active-sort ':''}${key==='class'?'class-col ':''}${excluded?'stat-excluded-col':''}">${label}${growthSort===key?(growthSortAsc?' ↑':' ↓'):''}</th>`;
  }).join('');

  const body=names.map(n=>{
    const v=displayedGrowth(n);
    const c=selectedClass(n);
    const active=c?classIsEnabled(n):false;
    const classUi=c
      ? `<div class="row-class-wrap">
          <span class="row-class-meta">
            <span class="row-class-icon" data-initial="${esc(c.name[0])}">${classIcon(c.name)}</span>
            <span class="row-class-name" title="${esc(c.name)}">${esc(c.name)}</span>
          </span>
          <label class="row-class-toggle" title="${active?'Disable':'Enable'} ${esc(c.name)} growth modifiers">
            <input type="checkbox" data-class-row-toggle="${esc(n)}" ${active?'checked':''}>
            <span class="row-switch"></span>
          </label>
        </div>`
      : `<div class="row-class-wrap">
          <span class="row-class-meta"><span class="row-class-name none">No class selected</span></span>
          <label class="row-class-toggle disabled" title="Choose a class from this character's profile first">
            <input type="checkbox" disabled><span class="row-switch"></span>
          </label>
        </div>`;

    const total=growthTotal(v);
    const avgCount=Math.max(1,includedStatCount());
    const avg=Math.round(total/avgCount);

    return `<tr class="${c&&!active?'class-off':''}">
      <td class="char-cell"><a class="growth-char" href="#/${encodeURIComponent(n)}">${portrait(n)}<span class="growth-char-name">${esc(n)}${n==='Mu'&&muPassive?' ✦':''}</span></a></td>
      <td class="class-cell">${classUi}</td>
      ${v.map((x,i)=>{
        const excluded=!totalStatEnabled[STAT_NAMES[i]];
        return `<td class="${excluded?'stat-excluded-col':''}"><span class="growth-val ${growthTone(x)}">${x}%</span></td>`;
      }).join('')}
      <td><span class="growth-val ${growthTone(avg)}">${total}</span></td>
    </tr>`;
  }).join('');

  $('#growthTable').innerHTML=`<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;

  document.querySelectorAll('[data-class-row-toggle]').forEach(input=>input.onchange=e=>{
    const name=e.currentTarget.dataset.classRowToggle;
    classEnabled[name]=e.currentTarget.checked;
    saveSelectedClasses();
    renderGrowthTable();
  });

  document.querySelectorAll('[data-gsort]').forEach(th=>th.onclick=()=>{
    const key=th.dataset.gsort;
    if (growthSort === key) {
      if (!growthSortAsc) growthSortAsc = true;
      else { growthSort = 'roster'; growthSortAsc = true; }
    } else {
      growthSort = key;
      growthSortAsc = false;
    }
    renderGrowthTable();
  });

  updateAllClassGrowthsToggle();
}
function recruitmentCard(name) {
  const src = `<a class="source-link" href="https://serenesforest.net/fortunes-weave/characters/recruitment/" target="_blank" rel="noopener">Source: Serenes Forest ↗</a>`;
  const r = RECRUITMENT[name];
  if (!r) return `<div class="info-card"><h3>Recruitment</h3><div class="info-note">No recruitment entry was found for this character on the Serenes Forest page.</div>${src}</div>`;
  const items = r.items.map(x=>`<div class="recruit-item"><span class="recruit-label">${esc(x.label)}</span><div>${esc(x.text)}</div></div>`).join('');
  return `<div class="info-card"><h3>Recruitment</h3><div class="recruit-list">${items}</div>${r.note?`<div class="info-note">${esc(r.note)}</div>`:''}${src}</div>`;
}

function renderSupports() {
  const list = DATA.supports[current].filter(s => rankFilter==='all' || s.rank===rankFilter);
  $('#supportList').innerHTML = list.length ? list.map(s => `
    <div class="support-row">
      <a class="person-link" href="#/${encodeURIComponent(s.name)}">${portrait(s.name,'small')}<span class="person-name">${esc(s.name)}</span></a>
      <div class="badges">${rankSeq(s.levels[s.levels.length-1]).map(b=>badge(b)).join('')}</div>
    </div>`).join('') : `<div class="none">No ${rankFilter}-rank supports.</div>`;
  document.querySelectorAll('.filters button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.f===rankFilter));
}

function showDetail(name) {
  current = name; rankFilter = 'all';
  const list = DATA.supports[name], t = tally(name);
  const filters = ['all',...['A','B','C','?'].filter(r=>t[r])].map(f=>`<button data-f="${f}" aria-pressed="${f==='all'}">${f==='all'?'All':f==='?'?'Unknown':f+' rank'}</button>`).join('');
  detailContent.innerHTML = `
    <div class="hero-card">
      ${portrait(name,'hero')}
      <div><h2>${esc(name)}</h2>
        <div class="sub">${list.length} support relationship${list.length===1?'':'s'}</div>
        <div class="dots">${dots(name)}</div></div>
    </div>
    ${giftCard(name)}
    <div class="profile-info">${growthCard(name)}${abilityCard(name)}${recruitmentCard(name)}</div>
    <div class="section-head"><h3 class="section-heading">Supports</h3>${list.length?`<div class="filters" role="group" aria-label="Filter by rank">${filters}</div>`:''}</div>
    <div class="support-list" id="supportList"></div>
    <div class="note-panel"><strong>Reading the chart:</strong> each badge shows a rank the pair can reach — ${badge('C')}${badge('B')}${badge('A')} means the bond climbs all the way to A. Click any name to jump to that character.</div>`;
  bindGiftControls(detailContent);
  bindTotalStatControls(detailContent);
  const muToggle=$('#muGrowthToggle');
  if(muToggle) muToggle.onchange=()=>{muPassive=muToggle.checked;showDetail(name);};
  const chooseClass=$('#chooseClassBtn'); if(chooseClass) chooseClass.onclick=()=>openClassModal(name);
  const classGrowthToggle=$('#classGrowthToggle'); if(classGrowthToggle) classGrowthToggle.onchange=()=>{classEnabled[name]=classGrowthToggle.checked;saveSelectedClasses();showDetail(name);};
  const clearClass=$('#clearClassBtn'); if(clearClass) clearClass.onclick=()=>{delete selectedClasses[name];delete classEnabled[name];saveSelectedClasses();showDetail(name);};
  if (list.length) renderSupports(); else $('#supportList').innerHTML = `<div class="none">${esc(name)} has no listed supports.</div>`;
  detailContent.querySelectorAll('.filters button').forEach(b=>b.onclick=()=>{rankFilter=b.dataset.f;renderSupports();});
  requestAnimationFrame(()=>requestAnimationFrame(()=>detailContent.querySelectorAll('.fill').forEach(f=>f.style.width=f.dataset.w+'%')));
}

function route() {
  const raw=location.hash.replace(/^#/,'');
  if(raw==='growths'){
    if(home.classList.contains('active')) homeScroll=scrollY;
    home.classList.remove('active'); detail.classList.remove('active'); growths.classList.add('active'); current=null;
    renderGrowthTable(); scrollTo({top:0,behavior:'instant'});
    document.title="Growth Rates · Fortune's Weave Support Archive";
    return;
  }
  const h = decodeURIComponent(raw.replace(/^\/?/,''));
  if (h && DATA.supports[h]) {
    if (home.classList.contains('active')) homeScroll = scrollY;
    home.classList.remove('active'); growths.classList.remove('active'); detail.classList.add('active');
    showDetail(h); scrollTo({top:0,behavior:'instant'});
    document.title = `${h} · Fortune's Weave Support Archive`;
  } else {
    const wasOther = detail.classList.contains('active') || growths.classList.contains('active');
    detail.classList.remove('active'); growths.classList.remove('active'); home.classList.add('active'); current=null;
    document.title = "Fortune's Weave Support Archive";
    if (wasOther) scrollTo({top:homeScroll,behavior:'instant'});
  }
}

$('#back').onclick = () => { location.hash = ''; };
$('#growthBack').onclick = () => { location.hash = ''; };
$('#growthMuToggle').onchange = e => { muPassive=e.target.checked; renderGrowthTable(); };
$('#allClassGrowthsToggle').onchange = e => {
  const withClass=DATA.names.filter(n=>selectedClass(n));
  if(!withClass.length) return;
  const allCurrentlyOn=withClass.every(n=>classIsEnabled(n));
  const next=!allCurrentlyOn;
  withClass.forEach(n=>classEnabled[n]=next);
  saveSelectedClasses();
  renderGrowthTable();
};

$('#classModalClose').onclick=closeClassModal;
$('#classModal').addEventListener('click',e=>{if(e.target.id==='classModal')closeClassModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape' && $('#classModal').classList.contains('open')) closeClassModal();});

addEventListener('hashchange', route);
search.oninput = renderGrid;
$('#clear').onclick = () => { search.value=''; renderGrid(); search.focus(); };
document.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => {
  sortMode = b.dataset.sort;
  document.querySelectorAll('[data-sort]').forEach(x=>x.setAttribute('aria-pressed', x===b));
  renderGrid();
});
addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if (e.key==='/' && !typing && home.classList.contains('active')) { e.preventDefault(); search.focus(); }
  if (e.key==='Escape') { if (typing && search.value) { search.value=''; renderGrid(); } else if (current) location.hash=''; }
});
grid.classList.add('intro'); setTimeout(()=>grid.classList.remove('intro'),1500);
renderGrid(); route();
})();
