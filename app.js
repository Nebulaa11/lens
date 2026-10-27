'use strict';

// All fixtures are illustrative. No exchange or broker request is made by this preview.
// Preview fixtures are isolated from the authenticated provider stream.
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icons = {
  chart: '<path d="M4 17V7m5 13V4m5 13V8m5 12V4"/><rect x="2" y="9" width="4" height="5" rx="1"/><rect x="7" y="7" width="4" height="8" rx="1"/><rect x="12" y="10" width="4" height="4" rx="1"/><rect x="17" y="7" width="4" height="7" rx="1"/>',
  star: '<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9a2.6 2.6 0 0 1 5 .9c0 1.7-2.4 1.9-2.4 3.6M12 17h.01"/>',
  moon: '<path d="M20.7 13.1A9 9 0 0 1 10.9 3.3a9 9 0 1 0 9.8 9.8Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3"/>',
  play: '<path d="m8 5 10 7-10 7Z"/>', pause: '<path d="M8 5v14m8-14v14"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.chart}</svg>`;
const format = (n, places = 2) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: places, maximumFractionDigits: places });
const roundedMove=n=>Math.round((Number(n)||0)*100)/100;
const directionOf=n=>roundedMove(n)>0?'bull':roundedMove(n)<0?'bear':'neutral';
const pct=n=>{const value=roundedMove(n);return `${value>0?'+':value<0?'−':''}${Math.abs(value).toFixed(2)}%`;};
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seed = str => [...str].reduce((h,c) => (h*31+c.charCodeAt(0))>>>0, 7);
function random(seedValue) { let a = seedValue; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Keep nodes and animation timelines alive across quote updates.
function patchMarkup(parent,markup){
 if(parent._lastMarkup===markup)return;
 parent._lastMarkup=markup;
 const holder=parent.namespaceURI==='http://www.w3.org/2000/svg'?document.createElementNS(parent.namespaceURI,'g'):document.createElement('div');holder.innerHTML=markup;
 const key=node=>node.nodeType===1?(node.dataset.key?'key:'+node.dataset.key:node.dataset.open?'stock:'+node.dataset.open:node.dataset.sector?'sector:'+node.dataset.sector:node.dataset.flowSymbol?'flow:'+node.dataset.flowSymbol+':'+(node.dataset.flowRole||'history')+':'+(node.classList.contains('flow-stream')?'stream':'path'):null):null;
 function sync(target,source){
  const incoming=new Set([...source.childNodes].map(key).filter(Boolean));
  for(const old of [...target.childNodes])if(key(old)&&!incoming.has(key(old)))old.remove();
  const saved=new Map([...target.childNodes].map(n=>[key(n),n]).filter(([k])=>k));
  let cursor=target.firstChild;
  for(const fresh of [...source.childNodes]){
   const k=key(fresh);let old=k?saved.get(k):cursor;
   if(!old||old.nodeType!==fresh.nodeType||old.nodeName!==fresh.nodeName||(!k&&key(old))){old=fresh.cloneNode(true);target.insertBefore(old,cursor);}
   else{
    if(old!==cursor)target.insertBefore(old,cursor);
    if(old.nodeType===3){if(old.nodeValue!==fresh.nodeValue)old.nodeValue=fresh.nodeValue;}
    else if(old.nodeType===1){
     for(const a of [...old.attributes])if(!fresh.hasAttribute(a.name)&&!['aria-describedby'].includes(a.name))old.removeAttribute(a.name);
     for(const a of [...fresh.attributes])if(old.getAttribute(a.name)!==a.value)old.setAttribute(a.name,a.value);
     sync(old,fresh);
    }
   }
   cursor=old.nextSibling;
  }
  while(cursor){const next=cursor.nextSibling;cursor.remove();cursor=next;}
 }
 sync(parent,holder);
}
function sessionCandles(rows,quoteTime){
 const day=Math.floor((Date.parse(quoteTime)+19800000)/86400000),unique=new Map();
 for(const row of rows||[]){const time=Number(row.time),local=time+19800000,minute=Math.floor((local%86400000)/60000);if(!Number.isFinite(time)||!Number.isFinite(row.close)||row.close<=0)continue;
  if(Math.floor(local/86400000)===day&&minute>=555&&minute<=930)unique.set(time,{...row,time});
 }
 return [...unique.values()].sort((a,b)=>a.time-b.time);
}
const sectors = [
  ['IT',2.87],['LOGISTICS',2.47],['CEMENT',2.21],['FMCG',1.97],['NBFC',1.88],['INSURANCE',1.69],['METAL',1.67],['POWER',1.65],['PSU BANK',1.59],['BANK',1.38],['PHARMA',1.34],['NEW-AGE',1.31],['CHEMICALS',1.26],['TELECOM',1.23],['REALTY',1.17],['DEFENCE',1.16],['AUTO',1.15],['CAP GOODS',.77],['CONSUMER',.71],['CAP MARKETS',.52],['OIL & GAS',.03],['OTHERS',-2.84]
].map(([name,move]) => ({name,move}));
const symbolGroups = {
  IT: 'TCS INFY HCLTECH WIPRO TECHM LTIM PERSISTENT OFSS TATAELXSI KPITTECH COFORGE MPHASIS CYIENT SONATSOFTW BSOFT LTECHNOLOGY',
  LOGISTICS: 'ADANIPORTS CONCOR DELHIVERY BLUEDART GMRINFRA',
  CEMENT: 'ULTRACEMCO SHREECEM AMBUJACEM ACC DALBHARAT RAMCOCEM JK cement',
  FMCG: 'ITC HINDUNILVR NESTLEIND BRITANNIA DABUR MARICO GODREJCP COLPAL TATACONSUM VBL PATANJALI',
  NBFC: 'BAJFINANCE BAJAJFINSRV SHRIRAMFIN CHOLAFIN MUTHOOTFIN MANAPPURAM LTF PFC RECLTD IREDA IRFC ABCAPITAL LIC HSGFIN PEL',
  INSURANCE: 'LICI SBILIFE HDFCLIFE ICICIPRULI ICICIGI GICRE',
  METAL: 'TATASTEEL JSWSTEEL JINDALSTEL SAIL HINDALCO VEDL NMDC NATIONALUM HINDZINC APLAPOLLO JSL RATNAMANI',
  POWER: 'NTPC POWERGRID TATAPOWER ADANIPOWER ADANIGREEN NHPC SJVN JSWENERGY TORNTPOWER CESC NLCINDIA SUZLON INOXWIND',
  'PSU BANK': 'SBIN BANKBARODA CANBK PNB UNIONBANK BANKINDIA INDIANB IOB MAHABANK CENTRALBK',
  BANK: 'HDFCBANK ICICIBANK AXISBANK KOTAKBANK INDUSINDBK FEDERALBNK IDFCFIRSTB AUBANK BANDHANBNK RBLBANK YESBANK IDBI',
  PHARMA: 'SUNPHARMA DRREDDY CIPLA DIVISLAB LUPIN AUROPHARMA ZYDUSLIFE BIOCON ALKEM TORNTPHARM ABBOTINDIA LAURUSLABS GLENMARK GRANULES IPCA LABS JBCHEPHARM',
  'NEW-AGE': 'PAYTM NAUKRI POLICYBZR NYKAA ZOMATO SWIGGY IEX IRCTC',
  CHEMICALS: 'SRF PIDILITIND DEEPAKNTR AARTIIND UPL PIIND ATUL TATACHEM NAVINFLUOR FLUOROCHEM CHAMBLFERT COROMANDEL GNFC GUJGASLTD',
  TELECOM: 'BHARTIARTL INDUSTOWER IDEA TATACOMM HFCL',
  REALTY: 'DLF GODREJPROP OBEROIRLTY PRESTIGE PHOENIXLTD BRIGADE LODHA NBCC',
  DEFENCE: 'HAL BEL BDL MAZDOCK COCHINSHIP GRSE BEML',
  AUTO: 'EICHERMOT TVSMOTOR MARUTI M&M BAJAJ-AUTO HEROMOTOCO TATAMOTORS ASHOKLEY BHARATFORG MOTHERSON BOSCHLTD TIINDIA EXIDEIND AMARA RAJA BALKRISIND APOLLOTYRE MRF CEATLTD',
  'CAP GOODS': 'LT SIEMENS ABB BHEL CUMMINSIND CGPOWER HAVELLS POLYCAB KEI SCHAEFFLER AIAENG THERMAX VOLTAS DIXON',
  CONSUMER: 'TITAN TRENT DMART RELAXO BATAINDIA PAGEIND KALYANKJIL JUBLFOOD INDIANHOTEL EIHOTEL BDL MULTIPLEX',
  'CAP MARKETS': 'ANANDRATHI BSE CDSL MCX ANGELONE KFINTECH CAMS NUVAMA MOTILALOFS 360ONE',
  'OIL & GAS': 'RELIANCE ONGC OIL IOC BPCL HINDPETRO GAIL PETRONET IGL MGL ATGL',
  OTHERS: 'ADANIENT ADANIENSOL GRASIM IRB NCC HINDCOPPER NATIONALUM SUPREMEIND ASTRAL AMBER LODHA LICHSGFIN LALPATHLAB METROPOLIS MAXHEALTH FORTIS APOLLOHOSP SYNGENE PVRINOX CHOLAHLD FINPIPE ZFCVINDIA KAYNES CROMPTON WHIRLPOOL OLECTRA SOLARINDS ELGIEQUIP RAILTEL RVNL JINDALSAW KEC SONACOMS ESCORTS SUNDARMFIN ABFRL AB FASHION VGUARD',
};
// Explicit symbol corrections keep sample labels realistic, without asserting current F&O eligibility.
symbolGroups.CEMENT = 'ULTRACEMCO SHREECEM AMBUJACEM ACC DALBHARAT RAMCOCEM JKCEMENT';
symbolGroups.NBFC = symbolGroups.NBFC.replace('LIC HSGFIN','LICHSGFIN');
symbolGroups.PHARMA = symbolGroups.PHARMA.replace('IPCA LABS','IPCALAB');
symbolGroups.AUTO = symbolGroups.AUTO.replace('AMARA RAJA','ARE&M');
symbolGroups.CONSUMER = symbolGroups.CONSUMER.replace(' BDL MULTIPLEX',' SAREGAMA');
symbolGroups.OTHERS = symbolGroups.OTHERS.replace(' AB FASHION',' ABFRL');
const fixtures = [
  {symbol:'EICHERMOT',name:'Eicher Motors',sector:'AUTO',price:7050,move:4.17,conviction:97,oi:13.4,delta:90.3,rank:1,direction:'bull',zone:[7010,7020.18],ob:[7003.5,7010],support:7001.45,r1:7055,r2:7078,rr:4.6},
  {symbol:'TVSMOTOR',name:'TVS Motor Company',sector:'AUTO',price:3866.8,move:.71,conviction:96,oi:6.5,delta:24.3,rank:2,direction:'bull',zone:[3857.4,3861.66],support:3845.55,r1:3875.7,r2:3890.2,rr:3.2},
  {symbol:'INOXWIND',name:'Inox Wind',sector:'POWER',price:66.65,move:6.76,conviction:94,oi:13.8,delta:1120,rank:3,direction:'bull',zone:[66.22,66.51],support:65.95,r1:67.1,r2:67.55,rr:2.8},
  {symbol:'ANANDRATHI',name:'Anand Rathi Wealth',sector:'CAP MARKETS',price:2038.7,move:-4.68,conviction:97,oi:13,delta:-75.1,rank:1,direction:'bear',zone:[2038.7,2042],support:2007.15,r1:2061.3,r2:2084,rr:3.9},
  {symbol:'MPHASIS',name:'Mphasis',sector:'IT',price:2360,move:-2.46,conviction:96,oi:11.7,delta:-58.9,rank:2,direction:'bear',zone:[2360,2361.9],support:2342,r1:2371.75,r2:2390.1,rr:2.4},
  {symbol:'COFORGE',name:'Coforge',sector:'IT',price:1867.9,move:-2.95,conviction:94,oi:11.7,delta:-63.4,rank:3,direction:'bear',zone:[1867.9,1874.7],support:1857,r1:1881.3,r2:1898.2,rr:3.1},
];
const used = new Set(fixtures.map(s=>s.symbol));
const extraSymbols = [];
for (const [sector, list] of Object.entries(symbolGroups)) for (const symbol of list.split(' ')) if (!used.has(symbol)) { used.add(symbol); extraSymbols.push({symbol,sector}); }
const stocks = [...fixtures];
const sampleBuckets=sectors.map(sector=>extraSymbols.filter(s=>s.sector===sector.name));
const balancedSymbols=[];
while(sampleBuckets.some(bucket=>bucket.length))sampleBuckets.forEach(bucket=>{if(bucket.length)balancedSymbols.push(bucket.shift());});
balancedSymbols.slice(0,207).forEach((item,i) => {
  const rng=random(seed(item.symbol)); const bear=i>=169; const price=Number((60+rng()*4300).toFixed(2));
  const move=Number(((bear?-1:1)*(.15+rng()*(bear?3.5:4.3))).toFixed(2));
  stocks.push({...item,name:item.symbol,price,move,conviction:Math.round(38+rng()*53),oi:Number((2+rng()*14).toFixed(1)),delta:Math.round((bear?-1:1)*(10+rng()*350)),rank:i+4,direction:bear?'bear':'bull'});
});
if (stocks.length !== 213) throw new Error(`Fixture universe must contain 213 stocks, received ${stocks.length}`);
for (const s of stocks) {
  const rng=random(seed(s.symbol)); s.open=s.price/(1+s.move/100); s.previousClose=s.open;
  s.zone ||= s.direction==='bull'?[s.price*.989,s.price*.993]:[s.price*1.003,s.price*1.007];
  s.support ||= s.price*.984; s.r1 ||= s.price*1.009; s.r2 ||= s.price*1.017; s.rr ||= Number((1.5+rng()*3).toFixed(1));
  s.ob ||= [s.zone[0]*.999,s.zone[0]]; s.vwap=Number(((s.zone[0]+s.zone[1])/2*.999).toFixed(2));
  s.profile = Array.from({length:30},(_,i) => .08+rng()*.25+Math.exp(-(((i-10)/4)**2))*.65+Math.exp(-(((i-23)/3)**2))*.34);
  s.points=Array.from({length:76},(_,i) => {
    const t=i/75; const shape=(1-Math.exp(-t*(s.symbol==='EICHERMOT'?9:3.2)))/(1-Math.exp(-(s.symbol==='EICHERMOT'?9:3.2)));
    const wave=Math.sin(t*(8+rng()*2)+rng())*.2*Math.sin(Math.PI*t);
    return s.move*shape+wave+(rng()-.5)*.18*Math.sin(Math.PI*t);
  }); s.points[0]=0; s.points[75]=s.move;
  s.candles=s.points.slice(1).map((move,i) => {const o=s.open*(1+s.points[i]/100),c=s.open*(1+move/100),spread=s.open*(.0002+rng()*.0006);return {open:o,high:Math.max(o,c)+spread,low:Math.min(o,c)-spread,close:c,volume:Math.round(1000+rng()*24000)};});
}


// The demo publishes only the 20 shortlisted candidates; it has no network feed.
const candidateSymbols = {
 bull: ['EICHERMOT','TVSMOTOR','INOXWIND','INFY','TATASTEEL','HDFCBANK','SBIN','LT','BHARTIARTL','TCS'],
 bear: ['ANANDRATHI','MPHASIS','COFORGE','BSE','DIXON','TRENT','DMART','MRF','VOLTAS','POLYCAB']
};
const candidateNames={INFY:'Infosys',TATASTEEL:'Tata Steel',HDFCBANK:'HDFC Bank',SBIN:'State Bank of India',LT:'Larsen & Toubro',BHARTIARTL:'Bharti Airtel',TCS:'Tata Consultancy Services',BSE:'BSE Limited',DIXON:'Dixon Technologies',TRENT:'Trent',DMART:'Avenue Supermarts',MRF:'MRF Limited',VOLTAS:'Voltas',POLYCAB:'Polycab India'};
const candidateStocks=[];
for(const [direction,symbols] of Object.entries(candidateSymbols))symbols.forEach((symbol,i)=>{
 let s=stocks.find(x=>x.symbol===symbol);
 if(!s){const rng=random(seed(symbol)),price=500+rng()*8000,move=.6+rng()*3;
  s={symbol,name:symbol,sector:extraSymbols.find(x=>x.symbol===symbol)?.sector||'OTHERS',open:price/(1+move/100),price,move,oi:4+rng()*10,delta:25+rng()*80,rr:2+rng()*2,profile:Array.from({length:30},()=>.1+rng()),points:Array.from({length:76},(_,j)=>move*(1-Math.exp(-j/22))/(1-Math.exp(-75/22)))};stocks.push(s);
 }
 if(!fixtures.includes(s)){s.zone=[s.price*.988,s.price*.994];s.ob=[s.price*.986,s.price*.99];s.support=s.price*.98;s.r1=s.price*1.012;s.r2=s.price*1.025;s.vwap=s.price*.994;}

 s.name=candidateNames[symbol]||s.name;
 const sign=direction==='bull'?1:-1;s.direction=direction;s.move=sign*Math.abs(s.move);s.points=s.points.map(v=>sign*Math.abs(v));s.price=s.open*(1+s.move/100);s.rank=i+1;s.conviction=[97,96,94,91,89,86,83,80,77,73][i];
 s.candles=s.points.slice(1).map((v,j)=>{const o=s.open*(1+s.points[j]/100),c=s.open*(1+v/100),pad=s.open*.0004;return{open:o,close:c,high:Math.max(o,c)+pad,low:Math.min(o,c)-pad,volume:2000+(seed(s.symbol+j)%20000)};});
 s.basePoints=[...s.points];candidateStocks.push(s);
});
// Scan the full configured universe; only the strongest 20 per side become profiles.
for (const stock of stocks) if (!candidateStocks.includes(stock)) candidateStocks.push(stock);
for (const dir of ['bull','bear']) candidateStocks.filter(s=>s.direction===dir).sort((a,b)=>b.conviction-a.conviction).forEach((s,i)=>s.rank=i+1);
let snapshotCycle=0,nextSnapshotAt=Date.now()+300000,scanInProgress=false,lastSnapshotAt=Date.now();

let storedWatchlist = [], storedTheme = '',storedDesign='';
try { storedWatchlist=JSON.parse(localStorage.getItem('stocklens-watchlist')||'[]'); storedTheme=localStorage.getItem('stocklens-theme')||'';storedDesign=localStorage.getItem('stocklens-design-version')||''; } catch (_) {}
const state={direction:'all',sector:'all',query:'',progress:75,selected:null,watchlist:new Set(Array.isArray(storedWatchlist)?storedWatchlist:[]),watchOnly:false,radarLimit:20,playing:false,detail:null,timeframe:5};
let replayTimer, toastTimer, lastFocus;
let feedModeChosen=false;
let feedMode='preview',providerState={configured:false,state:'unconfigured'},liveSource;
const previewCandidates=new Map(candidateStocks.map(s=>[s.symbol,structuredClone(s)]));
const colors=()=>({green:getComputedStyle(document.body).getPropertyValue('--green').trim()||'#168a70',pink:getComputedStyle(document.body).getPropertyValue('--pink').trim()||'#c9637c',grid:getComputedStyle(document.body).getPropertyValue('--grid').trim()||'#edf1ef',muted:getComputedStyle(document.body).getPropertyValue('--muted').trim()||'#88928e',blue:'#7196bd'});
const moveNow=s=>s.live?s.live.dayChange:s.points[state.progress];
const priceNow=s=>s.live?s.live.price:s.open*(1+moveNow(s)/100);
const timeNow=()=>{const minutes=9*60+15+state.progress*5;return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;};
let hoveredSector=null;
const activeSector=()=>hoveredSector||state.sector;
const filtered=()=>candidateStocks.filter(s=>(feedMode!=='live'||Boolean(s.live))&&(state.direction==='all'||s.direction===state.direction)&&(activeSector()==='all'||s.sector===activeSector())&&(!state.query||`${s.symbol} ${s.name}`.toLowerCase().includes(state.query))&&(!state.watchOnly||state.watchlist.has(s.symbol)));
const stockColor=s=>s.direction==='bull'?colors().green:s.direction==='bear'?colors().pink:colors().muted;
const saveWatchlist=()=>{try{localStorage.setItem('stocklens-watchlist',JSON.stringify([...state.watchlist]));}catch(_){}};
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2600);}
function toggleWatch(symbol){state.watchlist.has(symbol)?state.watchlist.delete(symbol):state.watchlist.add(symbol);saveWatchlist();renderRadar();updateWatchCounts();if(state.watchOnly)render();if(state.detail)renderDetail(false);}
function updateWatchCounts(){$('#watchlist-count').textContent=state.watchlist.size;$('#watchlist-toggle').classList.toggle('selected',state.watchOnly);$('[data-action="watchlist"]').classList.toggle('active',state.watchOnly);}
try{localStorage.setItem('stocklens-design-version','3');}catch(_){}
function renderSectors(){
 const matches=candidateStocks.filter(s=>feedMode!=='live'||s.live);
 const shown=sectors.map(x=>{const members=matches.filter(s=>s.sector===x.name);return {...x,count:members.length,move:members.length?members.reduce((n,s)=>n+moveNow(s),0)/members.length:0};}).filter(x=>x.count);
 patchMarkup($('#sector-list'),shown.map(s=>`<button class="sector-button ${state.sector===s.name?'selected':''}" data-sector="${esc(s.name)}" aria-pressed="${state.sector===s.name}" title="${s.count} ${s.count===1?'stock':'stocks'} · overall sector day change"><span class="sector-name">${esc(s.name)}<span class="sector-value ${directionOf(s.move)==='bear'?'down':directionOf(s.move)==='bull'?'up':'neutral'}">${pct(s.move)}</span></span><span class="sector-track">${Array.from({length:17},()=>`<i class="${s.move<0?'pink':''}"></i>`).join('')}</span></button>`).join('')||'<p class="history-empty">No matching sectors</p>');
 $('#clear-sector').hidden=state.sector==='all';
}
function emptyMessage(){return state.query?`No stocks match “${esc(state.query)}”.`:candidateStocks.some(s=>s.live)||feedMode==='preview'?'No stocks match these filters.':providerState.configured?'Waiting for provider quotes.':'Connect Upstox to receive market quotes.';}
function renderBreadth(list){
 const up=list.filter(s=>directionOf(moveNow(s))==='bull').length,down=list.filter(s=>directionOf(moveNow(s))==='bear').length,flat=list.length-up-down,total=list.length||1,c=colors();
 $('#breadth-svg').setAttribute('viewBox','0 0 800 24');$('#breadth-svg').setAttribute('preserveAspectRatio','none');
 patchMarkup($('#breadth-svg'),`<rect x="0" y="0" width="${800*up/total}" height="24" fill="${c.green}"/><rect x="${800*up/total}" y="0" width="${800*flat/total}" height="24" fill="${c.muted}"/><rect x="${800*(up+flat)/total}" y="0" width="${800*down/total}" height="24" fill="${c.pink}"/>`);
 $('#bull-count').textContent=up;$('#bear-count').textContent=down;$('#lagging').textContent=`${list.length} ${list.length===1?'stock':'stocks'} · ${flat} unchanged`;$('#leading').textContent='Day change';
}
function renderMarket(list){
 $('#plot-count').textContent=`${list.length} ${list.length===1?'stock':'stocks'}`;$('#chart-empty').hidden=list.length>0;$('#clear-selection').hidden=!state.selected;
 requestAnimationFrame(drawFlow);
}
// Symbol identity, not rank or array position, determines animation phase and membership.
const symbolHash=s=>{let hash=2166136261;for(const char of s)hash=Math.imul(hash^char.charCodeAt(0),16777619);return hash>>>0;};
const flowDelay=symbol=>-((symbolHash(symbol)%1200)/1000);
const istMinute=time=>{const d=new Date(time+19800000);return d.getUTCHours()*60+d.getUTCMinutes()+d.getUTCSeconds()/60;};
const clockLabel=minute=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(Math.floor(minute%60)).padStart(2,'0')}`;
function flowEndMinute(concepts,live,marketStatus,now=Date.now()){
 if(!live)return 930;
 let latest=0;for(const s of concepts)for(const c of s.live?.candles||[])latest=Math.max(latest,c.time);
 if(!latest)return 930;
 const sameSession=new Date(latest+19800000).toISOString().slice(0,10)===new Date(now+19800000).toISOString().slice(0,10);
 const minute=marketStatus==='NORMAL_OPEN'&&sameSession?Math.max(istMinute(now),istMinute(latest)):istMinute(latest);
 return Math.min(930,Math.max(570,Math.ceil(minute)));
}
function flowTickStep(maximum){
 const target=Math.max(.01,maximum/4),power=10**Math.floor(Math.log10(target));
 return [1,2,2.5,5,10].find(n=>n*power>=target)*power;
}
let lastFlowLayout="";
function drawFlow(){
 const board=$('.lens-canvas');if(!board)return;const rect=board.getBoundingClientRect(),svg=$('#flow-svg'),region=$('.flow-region').getBoundingClientRect();
 if(innerWidth<1200){svg.innerHTML='';lastFlowLayout='';syncFlowParticles(svg,rect);return;}
 const shownSymbols=new Set($$('.candidate-card,.setup-card').map(el=>el.dataset.open));
 const concepts=filtered().filter(s=>shownSymbols.has(s.symbol)).sort((a,b)=>a.symbol.localeCompare(b.symbol)),endMinute=flowEndMinute(concepts,feedMode==='live',providerState.market_status);
 const layoutKey=[endMinute,rect.width,rect.height,state.direction,activeSector(),state.query,state.watchOnly,feedMode,feedMode==='live'?concepts.map(s=>s.symbol+':'+s.live.open+':'+s.direction+':'+s.live.candles.map(c=>c.time+','+c.close).join(';')).join('|'):'',document.body.classList.contains('dark'),...$$('.candidate-card,.setup-card').map(el=>{const r=el.getBoundingClientRect();return [el.dataset.open,r.x-rect.x,r.y-rect.y,r.width,r.height].join(':');})].join('|');
 if(layoutKey===lastFlowLayout)return;lastFlowLayout=layoutKey;
 const viewBox=`0 0 ${rect.width} ${rect.height}`;if(svg.getAttribute('viewBox')!==viewBox)svg.setAttribute('viewBox',viewBox);if(svg.getAttribute('preserveAspectRatio')!=='none')svg.setAttribute('preserveAspectRatio','none');
 const c=colors(),left=region.left-rect.left,start=left+4,cx=region.right-rect.left-44,top=36,bottom=rect.height-30,base=(top+bottom)/2,stackW=40;
 const maximum=feedMode==='live'?Math.max(0,...concepts.flatMap(s=>(s.live.candles||[]).map(v=>Math.abs(100*(v.close/s.live.open-1))))):8,step=flowTickStep(maximum),range=step*4;
 const xAt=minute=>start+(cx-start)*Math.max(0,Math.min(1,(minute-555)/(endMinute-555)));
 let out=`<defs><linearGradient id="flowfade"><stop stop-color="${c.green}" stop-opacity=".08"/><stop offset="1" stop-color="${c.green}" stop-opacity=".45"/></linearGradient><filter id="terminalglow"><feGaussianBlur stdDeviation="2"/></filter></defs>`;
 for(let i=0;i<9;i++){const y=top+(bottom-top)*i/8;out+=`<path d="M${start} ${y}H${cx+stackW}" stroke="${c.grid}" opacity=".35" stroke-dasharray="2 5"/><text x="${start}" y="${y-4}" fill="${c.muted}" font-size="11" font-family="monospace">${Number((range-i*step).toFixed(3))}%</text>`;}
 for(let i=0;i<=4;i++){const minute=Math.round(555+(endMinute-555)*i/4),x=xAt(minute);out+=`<path d="M${x} ${top}V${bottom}" stroke="${c.grid}" opacity=".25"/>`;if(i%2===0)out+=`<text x="${x}" y="16" fill="${c.muted}" font-size="11" text-anchor="${i===0?'start':i===4?'end':'middle'}">${clockLabel(minute)}</text>`;}
 out+=`<path d="M${start} ${base}H${rect.width}" stroke="#9bb3cb" opacity=".28"/><circle cx="${start}" cy="${base}" r="3" fill="#cce8eb"/>`;
 // From-open return starts at zero. Dashed gaps are visual links, not observed history.
 if(feedMode==='live'){
  const first=concepts.filter(s=>s.live.candles?.length).map(s=>istMinute(s.live.candles[0].time));
  if(first.length&&Math.min(...first)>556)out+=`<text data-key="history-coverage" x="${start+3}" y="${top+17}" fill="${c.muted}" font-size="10">Dashed = missing history</text>`;
 }
 // Price paths use only sorted, current-session provider candles in Live mode.
 out+=`<g data-key="history-lines">`;
 for(const [n,s] of concepts.entries()){
  if(feedMode==='live'&&(s.live.candles||[]).length<2)continue;
  const points=feedMode==='live'?s.live.candles.map(v=>100*(v.close/s.live.open-1)):previewCandidates.get(s.symbol).points,col=stockColor(s);
  const amp=(base-top)/range,path=points.map((v,i)=>{const candle=s.live?.candles[i],x=candle?xAt(istMinute(candle.time)):start+(cx-start)*i/(points.length-1);return `${i?'L':'M'}${x},${base-v*amp}`;}).join(' ');
  out+=`<g data-key="history:${esc(s.symbol)}">`;
  if(feedMode==='live'){
   const first=s.live.candles[0],gap=istMinute(first.time)>556;
   out+=`<path data-key="opening-link" d="M${start},${base} L${xAt(istMinute(first.time))},${base-points[0]*amp}" fill="none" stroke="${col}" opacity="${gap?.4:.48}" ${gap?'stroke-dasharray="3 6"':''}><title>${gap?'Missing intraday history — visual connection only':'From session open'}</title></path>`;
  }
  out+=`<path data-particle="history:${esc(s.symbol)}" d="${path}" fill="none" stroke="${col}" data-flow-symbol="${esc(s.symbol)}" stroke-width="${s.rank<=3?1.1:.65}" opacity="${state.selected&&state.selected!==s.symbol?.09:.48}"/>`;

  for(let j=18;feedMode!=='live'&&n%4===0&&j<76;j+=18){const x=start+(cx-start)*j/75,y=base-points[j]*amp,len=cx-x;out+=`<path d="M${x} ${y}H${cx}" stroke="${col}" opacity=".11" stroke-dasharray="2 2"/><rect x="${x}" y="${y-2}" width="4" height="4" fill="none" stroke="${col}" stroke-width=".5" opacity=".25"/>`;}
  out+='</g>';
 }
 out+='</g>';
 for(let i=0;feedMode!=='live'&&i<180;i++){const y=top+(bottom-top)*i/180,col=y<base?c.green:c.pink,w=stackW*(.2+.8*Math.abs(Math.sin(i*.09)));out+=`<rect x="${cx}" y="${y}" width="${w}" height="2.6" fill="${col}" opacity=".25"/>`;}
 for(const [y,col] of [[base-145,c.green,'bull'],[base+49,c.pink,'bear']].filter(([, ,dir])=>state.direction==='all'||state.direction===dir)){out+=`<rect x="${cx-3}" y="${y}" width="${stackW+6}" height="96" fill="${col}" fill-opacity=".045" stroke="${col}" stroke-opacity=".8"/><path d="M${cx-5} ${y+7}V${y-3}H${cx+4}M${cx+stackW-4} ${y-3}H${cx+stackW+5}V${y+7}" stroke="${col}" fill="none"/>`;}
 const tiles=new Map($$('.candidate-card').map(el=>[el.dataset.open,el])),cards=new Map($$('.setup-card').map(el=>[el.dataset.open,el]));
 out+='<g data-key="connections">';
 for(const s of concepts){
  const tile=tiles.get(s.symbol);if(!tile)continue;const b=tile.getBoundingClientRect(),tx=b.left-rect.left,ty=b.top-rect.top+b.height/2,col=stockColor(s),sy=s.direction==='bull'?base-97:base+97,dim=state.selected&&state.selected!==s.symbol;
  out+=`<g data-key="connection:${esc(s.symbol)}">`;
  const d=`M${cx+stackW} ${sy}C${cx+stackW+35} ${sy} ${tx-35} ${ty} ${tx} ${ty}`;
  out+=`<path data-particle="connector:${esc(s.symbol)}" data-flow-symbol="${esc(s.symbol)}" data-flow-role="connector" d="${d}" fill="none" stroke="${col}" stroke-width=".7" opacity="${dim?.06:.3}"/>`;
  const card=cards.get(s.symbol);if(card){const cr=card.getBoundingClientRect(),x1=b.right-rect.left,x2=cr.left-rect.left,y2=cr.top-rect.top+cr.height/2;out+=`<path d="M${x1} ${ty}C${x1+22} ${ty} ${x2-22} ${y2} ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="${s.rank<=3?1.3:.7}" opacity="${dim?.05:.55}"/>`;}
  out+='</g>';
 }
 out+='</g>';
 if(feedMode==='live'&&!concepts.some(s=>s.live.candles?.length>1))out+=`<text x="${start+15}" y="${top+35}" fill="${c.muted}" font-size="12">Intraday history unavailable</text><text x="${start+15}" y="${top+55}" fill="${c.muted}" font-size="11">No simulated price paths shown</text>`;
 patchMarkup(svg,out);
 syncFlowParticles(svg,rect);

}
const chartTimeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'});
const sparkCache=new WeakMap();
function candleSpark(s,rows,preview=false){
 if(!rows||rows.length<2)return '<div class="history-empty">Intraday history unavailable<br><small>Not enough provider candles</small></div>';
 const cacheKey=s.symbol+':'+s.direction+':'+preview+':'+document.body.classList.contains('dark'),cached=sparkCache.get(rows);if(cached?.key===cacheKey)return cached.markup;
 const bars=rows.filter((_,i)=>i%Math.max(1,Math.ceil(rows.length/75))===0||i===rows.length-1),lo=Math.min(...bars.map(v=>v.low)),hi=Math.max(...bars.map(v=>v.high)),range=hi-lo||1,y=v=>74-(v-lo)/range*65,x=i=>4+i*210/bars.length,col=stockColor(s);
 let out=`<svg viewBox="0 0 220 90" class="mini-chart" role="img" aria-label="${esc(s.symbol)} ${preview?'sample':'provider'} candlesticks">`;
 for(let i=0;i<5;i++)out+=`<path d="M0 ${10+i*16}H220" stroke="${col}" opacity=".13" stroke-dasharray="2 3"/>`;
 if(preview)out+=`<rect x="58" y="${s.direction==='bull'?58:23}" width="155" height="10" fill="${col}" fill-opacity=".08" stroke="#d9b74b" stroke-opacity=".6" stroke-width=".6"/><path d="M70 15H214" stroke="${col}" opacity=".6"/><text x="182" y="12" fill="${col}" font-size="10">R1</text><text x="185" y="${s.direction==='bull'?80:46}" fill="#d9b74b" font-size="10">S1 / Z</text>`;
 bars.forEach((v,i)=>{const color=v.close>=v.open?colors().green:colors().pink;out+=`<path d="M${x(i)} ${y(v.high)}V${y(v.low)}" stroke="${color}" stroke-width=".7"/><rect x="${x(i)-1.1}" y="${Math.min(y(v.open),y(v.close))}" width="2.2" height="${Math.max(1,Math.abs(y(v.open)-y(v.close)))}" fill="${color}"/>`;});
 out+=`<circle cx="${x(bars.length-1)}" cy="${y(bars.at(-1).close)}" r="2" fill="${col}"/><text x="4" y="87" fill="${colors().muted}" font-size="9">${preview?'09:15':chartTimeFormat.format(new Date(bars[0].time))}</text><text x="178" y="87" fill="${colors().muted}" font-size="9">LATEST</text></svg>`;const markup=out+`<div class="spark-times"><span>${preview?'09:15':chartTimeFormat.format(new Date(rows[0].time))}</span><span>${preview?'15:30':chartTimeFormat.format(new Date(rows.at(-1).time))} IST</span></div>`;sparkCache.set(rows,{key:cacheKey,markup});return markup;
}
function miniChart(s){return candleSpark(s,s.live?s.live.candles:s.candles,!s.live);}
function logo(s){const labels={EICHERMOT:'E',TVSMOTOR:'TVS',INOXWIND:'IW',ANANDRATHI:'AR',MPHASIS:'m',COFORGE:'C'};return `<span class="stock-logo ${s.symbol==='EICHERMOT'?'eicher':s.symbol.toLowerCase()}">${labels[s.symbol]||esc(s.symbol.slice(0,2))}</span>`;}
function profileChart(s){
 if(s.live)return s.live.candles?.length>1?candleSpark(s,s.live.candles):'<span class="unavailable-profile">History unavailable</span>';
 const c=stockColor(s),max=Math.max(...s.profile);
 return `<svg viewBox="0 0 100 90" preserveAspectRatio="none" class="candidate-profile" aria-hidden="true">${s.profile.map((v,i)=>`<rect x="0" y="${i*3}" width="${v/max*86}" height="2" fill="${c}" opacity="${.3+v/max*.5}"/>`).join('')}<line x1="0" x2="100" y1="23" y2="23" stroke="${c}" opacity=".5"/></svg>`;
}
function stockCard(s,index){
 if(s.live)return liveStockCard(s,index);
 const bull=s.direction==='bull',change=moveNow(s),price=priceNow(s),featured=index<3;
 return `<button class="setup-card ${s.direction} ${featured?'featured':'compact'} ${index===0?'hero-pick':''}" data-open="${esc(s.symbol)}" aria-label="Inspect ${esc(s.symbol)} chart and levels" style="--card-order:${index}">
 ${featured?`<div class="priority-ribbon"><span>${index===0?'◆ STRONGEST PICK':'◆ TOP 3 HIGHLIGHT'}</span><span>PREVIEW</span></div>`:''}
 <div class="setup-top"><div class="stock-id">${logo(s)}<div><strong>${esc(s.symbol)}</strong><small>${esc(s.name===s.symbol?s.sector:s.name)} · ${esc(s.sector)}</small></div></div><span class="rank-pill">#${String(index+1).padStart(2,'0')}<b class="rank-score" title="Demo conviction score">${s.conviction}</b></span></div>
 <div class="setup-body"><div><div class="setup-change ${bull?'up':'down'}">${pct(change)}</div><div class="setup-price">₹${format(price)} <small>${price>=s.open?'+':'−'}${format(Math.abs(price-s.open))}</small></div><div class="setup-tag"><span class="direction-badge">${bull?'BULLISH':'BEARISH'}</span></div></div><div class="card-chart"><div class="buildup">${bull?'LONG':'SHORT'} BUILD-UP <span>OI +${(s.oi*state.progress/75).toFixed(1)}%</span></div>${miniChart(s)}</div></div>
 ${featured?`<div class="setup-levels"><div><span>${bull?'SUPPORT 1':'RESISTANCE 1'}</span><b>${format(bull?s.support:s.r1)}</b></div><div><span>ZONE</span><b>${format(s.zone[0])}–${format(s.zone[1])}</b></div><div><span>${bull?'RESISTANCE 1':'SUPPORT 1'}</span><b>${format(bull?s.r1:s.support)}</b></div><div><span>RISK / REWARD</span><b>1:${s.rr.toFixed(1)}</b></div></div><div class="setup-progress"><i></i><i></i><i></i></div>`:`<span class="compact-caption">Next in focus <span>Explore →</span></span>`}</button>`;
}
function renderCards(list){
 const picks=dir=>list.filter(s=>s.direction===dir).sort((a,b)=>b.conviction-a.conviction||a.rank-b.rank).slice(0,3);
 const bull=picks('bull'),bear=picks('bear');
 patchMarkup($('#stock-cards'),[['bull',bull],['bear',bear]].filter(([dir])=>state.direction==='all'||state.direction===dir).map(([dir,arr])=>`<section class="picks-column ${dir}"><div class="group-heading ${dir} ${dir==='bull'?'up':'down'}"><span>${dir==='bull'?'↗ TOP BUYING':'↘ TOP SELLING'}</span><span>${arr.length} ${arr.length===1?'STOCK':'STOCKS'}</span></div><div class="picks-group">${Array.from({length:3},(_,i)=>arr[i]?stockCard(arr[i],i):'<div class="output-slot empty-slot" aria-hidden="true"></div>').join('')}</div></section>`).join('')||`<div class="picks-empty">${emptyMessage()}</div>`);
 if(!list.length)patchMarkup($('#stock-cards'),`<div class="picks-empty">${emptyMessage()}</div>`);
 $('#picks-number').textContent=String(bull.length+bear.length).padStart(2,'0');
}
function renderRadar(){
 const matches=filtered();
 const list=['bull','bear'].flatMap(dir=>matches.filter(s=>s.direction===dir).sort((a,b)=>b.conviction-a.conviction||a.rank-b.rank).map((s,i)=>({...s,rank:i+1})));
 $('.board-column-headings>span:nth-child(3)').textContent=`${Math.min(20,list.filter(s=>s.direction==='bull').length)+Math.min(20,list.filter(s=>s.direction==='bear').length)} STOCK PROFILE${list.length===1?'':'S'}`;
 $('#radar-subtitle').textContent=`${list.length} candidates · Profile & momentum`;
 const tile=s=>`<div class="radar-card candidate-card ${s.direction} ${s.rank<=3?'candidate-highlight':''}" role="button" tabindex="0" data-open="${esc(s.symbol)}" aria-label="Inspect ${esc(s.symbol)}"><div class="candidate-top" title="${esc(s.symbol)} · ${esc(s.name)}"><strong>${esc(s.symbol)}</strong><span class="candidate-rank" title="Rank within ${s.direction==='bull'?'buying':'selling'} results">${s.direction==='bull'?'B':'S'}${String(s.rank).padStart(2,'0')}</span></div><small class="${s.direction==='bull'?'up':'down'}">${pct(moveNow(s))}</small><span class="candidate-buildup">${s.live?'PRICE MOMENTUM':(s.direction==='bull'?'LONG':'SHORT')+' BUILD-UP'} <i></i><i></i><i></i></span>${profileChart(s)}<span class="candidate-price">₹${format(priceNow(s))}</span><button class="star-button ${state.watchlist.has(s.symbol)?'saved':''}" data-watch="${esc(s.symbol)}" aria-label="${state.watchlist.has(s.symbol)?'Remove':'Add'} ${esc(s.symbol)} ${state.watchlist.has(s.symbol)?'from':'to'} watchlist" aria-pressed="${state.watchlist.has(s.symbol)}">${icon('star')}</button></div>`;
 const tiers=[[13,20],[8,12],[4,7],[1,3]];
 patchMarkup($('#radar-grid'),['bull','bear'].filter(dir=>state.direction==='all'||state.direction===dir).map(dir=>`<div class="profile-half ${dir}">${tiers.map(([lo,hi],i)=>`<div class="profile-tier tier-${i}">${Array.from({length:hi-lo+1},(_,offset)=>{const rank=lo+offset,stock=list.find(s=>s.direction===dir&&s.rank===rank);return stock?tile(stock):`<div class="profile-slot empty-slot" aria-hidden="true"></div>`;}).join('')}</div>`).join('')}</div>`).join(''));
 if(!list.length)patchMarkup($('#radar-grid'),`<div class="radar-empty">${emptyMessage()}</div>`);
 $('#load-more').hidden=true;
}
let boardRevision=0;
function render(skipSectors=false){
  boardRevision++;
  const list=filtered();$('.lens-canvas').classList.toggle('single-direction',state.direction!=='all');$('.lens-canvas').classList.remove('few-results'); $$('.segmented button').forEach(b=>{b.querySelector('span').textContent=candidateStocks.filter(s=>(feedMode!=='live'||s.live)&&(b.dataset.filter==='all'||s.direction===b.dataset.filter)).length;}); if(state.selected&&!list.some(s=>s.symbol===state.selected))state.selected=null;
  if(!skipSectors)renderSectors();updateSectorAppearance();renderBreadth(list);renderMarket(list);renderCards(list);renderRadar();updateWatchCounts();
  $$('.segmented button').forEach(b=>{b.classList.toggle('selected',b.dataset.filter===state.direction);b.setAttribute('aria-pressed',String(b.dataset.filter===state.direction));});
  $('#sector-filter').value=state.sector;$('#session-time').textContent=timeNow();$('#replay-time').textContent=timeNow();$('#replay-range').value=state.progress;
  if(state.detail)renderDetail(false);
}

function renderDetail(show=true){
  const s=stocks.find(s=>s.symbol===state.detail);if(!s)return;
  if(s.live){renderLiveDetail(s,show);return;}
  const bull=s.direction==='bull',price=priceNow(s);
  $('#detail-content').className=`detail-content ${s.direction}`;
  $('#detail-content').innerHTML=`<div class="detail-header"><div class="stock-id">${logo(s)}<div><strong id="detail-title">${esc(s.symbol)}</strong><small>${esc(s.name)} · ${esc(s.sector)}</small></div></div><button class="dialog-close icon-button" data-close="stock-dialog" aria-label="Close stock details">×</button></div><div class="detail-price-row"><div><div class="detail-price">₹${format(price)}</div><div class="detail-change ${bull?'up':'down'}">${pct(moveNow(s))} <span style="font-size:10px;color:var(--muted);margin-left:6px">${price>=s.open?'+':'−'}₹${format(Math.abs(price-s.open))}</span></div></div><div class="detail-badge"><span class="direction-badge">${bull?'BULLISH':'BEARISH'}</span><strong>${s.conviction}</strong><span style="font-size:7px;color:var(--muted)">CONV</span></div></div><div class="detail-stats"><div><span>OPEN INTEREST</span><strong class="${bull?'up':'down'}">+${(s.oi*state.progress/75).toFixed(1)}% · ${bull?'Long':'Short'} build-up</strong><small class="detail-delta">Sample Δ ${s.delta>=0?'+':'−'}${format(Math.abs(s.delta)*state.progress/75,1)}K</small></div><div><span>VWAP</span><strong>${format(s.vwap)}</strong></div><div><span>ORDER BLOCK</span><strong>${format(s.ob[0])}–${format(s.ob[1])}</strong></div><div><span>RISK / REWARD</span><strong>1:${s.rr.toFixed(1)}</strong></div><div><span>ZONE</span><strong>${format(s.zone[0])}–${format(s.zone[1])}</strong></div><div><span>SUPPORT S1</span><strong>${format(s.support)}</strong></div><div><span>RESISTANCE R1 / R2</span><strong>${format(s.r1)} / ${format(s.r2)}</strong></div><div><span>SAMPLE RANK</span><strong>#${s.rank} · ${bull?'Bullish':'Bearish'} board</strong></div></div><div class="detail-chart-bar"><span><i class="${bull?'green-dot':'pink-dot'}"></i>CANDLES <span>— VWAP</span><span>▧ ORDER BLOCK</span></span><div class="timeframes">${[5,15,30].map(t=>`<button data-timeframe="${t}" class="${state.timeframe===t?'active':''}" aria-pressed="${state.timeframe===t}">${t}m</button>`).join('')}</div></div><div class="detail-chart-wrapper"><svg id="detail-chart" viewBox="0 0 740 335" preserveAspectRatio="none" role="img" aria-label="${esc(s.symbol)} illustrative candlestick chart, order block, VWAP and price levels"></svg><div class="detail-chart-tooltip" hidden></div></div><div class="detail-bottom"><span>Illustrative ${state.timeframe}-minute candles · ${timeNow()} IST · Sample signals</span><div><button data-highlight="${esc(s.symbol)}">Locate on market chart ↗</button><button data-watch="${esc(s.symbol)}" class="${state.watchlist.has(s.symbol)?'saved':''}">${state.watchlist.has(s.symbol)?'★ Saved':'☆ Watchlist'}</button></div></div>`;
  renderCandles(s);
  if(show){lastFocus=document.activeElement;$('#stock-dialog').showModal();}
}
function renderCandles(s){
  const c=colors(),color=stockColor(s),raw=s.candles.slice(0,state.progress),step=state.timeframe/5,candles=[];
  for(let i=0;i<raw.length;i+=step){const group=raw.slice(i,i+step);candles.push({open:group[0].open,high:Math.max(...group.map(c=>c.high)),low:Math.min(...group.map(c=>c.low)),close:group.at(-1).close,volume:group.reduce((sum,c)=>sum+c.volume,0),index:i});}
  const values=[...candles.flatMap(c=>[c.low,c.high]),s.support,s.r1,s.r2,...s.zone,...s.ob,s.vwap];
  const min=Math.min(...values)*.997,max=Math.max(...values)*1.003,left=12,right=649,top=17,bottom=271,y=v=>top+(max-v)/(max-min)*(bottom-top),x=i=>left+(i+.5)/75*(right-left);
  const annotations=[{price:s.r2,label:'R2',color:c.green},{price:s.r1,label:'R1',color:c.green},{price:s.support,label:'S1',color:c.pink},{price:s.vwap,label:'VWAP',color:c.blue}].sort((a,b)=>b.price-a.price);
  let lastLabel=-10;annotations.forEach(a=>{a.labelY=Math.max(y(a.price),lastLabel+15);lastLabel=a.labelY;});
  const horizontal=(a)=>`<line x1="150" x2="${right}" y1="${y(a.price)}" y2="${y(a.price)}" stroke="${a.color}" opacity=".55" stroke-dasharray="3 4" stroke-width=".8"/><path d="M${right},${y(a.price)} L${right+5},${a.labelY}" fill="none" stroke="${a.color}" opacity=".4" stroke-width=".5"/><text x="${right+7}" y="${a.labelY+3}" font-family="IBM Plex Mono,monospace" font-size="8" fill="${a.color}">${a.label} ${format(a.price)}</text>`;
  let out='';
  for(let i=0;i<5;i++){const v=min+(max-min)*i/4;out+=`<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="${c.grid}"/>`;if(annotations.every(a=>Math.abs(a.labelY-y(v))>14))out+=`<text x="${right+7}" y="${y(v)+3}" fill="${c.muted}" font-family="IBM Plex Mono,monospace" font-size="8">${format(v)}</text>`;}
  out+=`<rect x="${x(18)}" y="${y(s.zone[1])}" width="${right-x(18)}" height="${Math.max(5,y(s.zone[0])-y(s.zone[1]))}" fill="${color}" opacity=".08" stroke="${color}" stroke-width=".7"/><rect x="${x(8)}" y="${y(s.ob[1])}" width="${right-x(8)}" height="${Math.max(5,y(s.ob[0])-y(s.ob[1]))}" fill="${color}" opacity=".17" stroke="${color}" stroke-width=".7"/><text x="${right-5}" y="${y(s.ob[0])+12}" text-anchor="end" fill="${color}" font-size="8">ORDER BLOCK</text>`;
  out+=annotations.map(horizontal).join('');
  const maxVolume=Math.max(...candles.map(c=>c.volume));
  candles.forEach((bar,i)=>{const cx=x(bar.index+step/2),barColor=bar.close>=bar.open?c.green:c.pink,w=Math.max(2,(right-left)/75*step*.6),volH=bar.volume/maxVolume*24;
    out+=`<rect x="${cx-w/2}" y="${305-volH}" width="${w}" height="${volH}" fill="${barColor}" opacity=".15"/><line x1="${cx}" x2="${cx}" y1="${y(bar.high)}" y2="${y(bar.low)}" stroke="${barColor}" stroke-width=".8"/><rect x="${cx-w/2}" y="${Math.min(y(bar.open),y(bar.close))}" width="${w}" height="${Math.max(1.2,Math.abs(y(bar.open)-y(bar.close)))}" fill="${barColor}"/><rect class="candle-hit" data-candle="${i}" x="${cx-(right-left)/75*step/2}" y="0" width="${(right-left)/75*step}" height="310" fill="transparent"><title>O ${format(bar.open)} H ${format(bar.high)} L ${format(bar.low)} C ${format(bar.close)}</title></rect>`;
  });
  [0,15,27,39,51,63,75].forEach(i=>{const minutes=555+i*5;out+=`<text x="${x(i)}" y="326" text-anchor="middle" fill="${c.muted}" font-size="8" font-family="IBM Plex Mono,monospace">${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}</text>`;});
  $('#detail-chart').innerHTML=out;$('#detail-chart')._candles=candles;
}
function stopReplay(){clearInterval(replayTimer);state.playing=false;$('#replay-toggle').innerHTML=icon('play');$('#replay-toggle').setAttribute('aria-label','Play sample session replay');}
function setSector(sector){hoveredSector=null;state.sector=sector;state.radarLimit=20;render();}
function reset(){hoveredSector=null;stopReplay();state.direction='all';state.sector='all';state.query='';state.selected=null;state.progress=75;state.watchOnly=false;state.radarLimit=20;$('#stock-search').value='';render();}
function toggleTheme(){document.body.classList.toggle('dark');try{localStorage.setItem('stocklens-theme',document.body.classList.contains('dark')?'dark':'light');}catch(_){}$('[data-action="theme"]').innerHTML=icon(document.body.classList.contains('dark')?'sun':'moon');render();}

document.addEventListener('click',event=>{
  const watch=event.target.closest('[data-watch]');if(watch){event.stopPropagation();toggleWatch(watch.dataset.watch);return;}
  const close=event.target.closest('[data-close]');if(close){document.getElementById(close.dataset.close).close();return;}
  const frame=event.target.closest('[data-timeframe]');if(frame){state.timeframe=Number(frame.dataset.timeframe);renderDetail(false);return;}
  const highlighted=event.target.closest('[data-highlight]');if(highlighted){state.selected=highlighted.dataset.highlight;$('#stock-dialog').close();render();$('.lens-canvas').scrollIntoView({behavior:'smooth',block:'center'});return;}
  const open=event.target.closest('[data-open]');if(open){state.detail=open.dataset.open;state.timeframe=5;stopReplay();renderDetail();return;}
  const filter=event.target.closest('[data-filter]');if(filter){state.direction=filter.dataset.filter;state.radarLimit=20;render();return;}
  const sector=event.target.closest('[data-sector]');if(sector){setSector(state.sector===sector.dataset.sector?'all':sector.dataset.sector);return;}
  const action=event.target.closest('[data-action]');if(action){switch(action.dataset.action){case'reset':reset();break;case'watchlist':state.watchOnly=!state.watchOnly;render();$('#stocks-title').scrollIntoView({behavior:'smooth',block:'center'});break;case'help':$('#help-dialog').showModal();break;case'theme':toggleTheme();break;}return;}
});
document.addEventListener('keydown',event=>{
  if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();$('#stock-search').focus();}
  const card=event.target.closest('.radar-card');if(card&&event.target===card&&(event.key==='Enter'||event.key===' ')){event.preventDefault();state.detail=card.dataset.open;stopReplay();renderDetail();}
});
$('#stock-search').addEventListener('input',event=>{state.query=event.target.value.trim().toLowerCase();state.radarLimit=20;render();});
$('#sector-filter').addEventListener('change',event=>setSector(event.target.value));
$('#clear-sector').addEventListener('click',()=>setSector('all'));
$('#clear-selection').addEventListener('click',()=>{state.selected=null;render();});
$('#refresh').addEventListener('click',()=>{reset();toast('Sample session reset to 15:30 IST');});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(_){toast('Fullscreen is unavailable in this preview.');}});
$('#watchlist-toggle').addEventListener('click',()=>{state.watchOnly=!state.watchOnly;state.radarLimit=20;render();});
$('#load-more').addEventListener('click',()=>{state.radarLimit+=24;renderRadar();});
$('#replay-range').addEventListener('input',event=>{stopReplay();state.progress=Number(event.target.value);render();});
$('#replay-toggle').addEventListener('click',()=>{
  if(state.playing){stopReplay();return;}if(state.progress>=75)state.progress=1;state.playing=true;$('#replay-toggle').innerHTML=icon('pause');$('#replay-toggle').setAttribute('aria-label','Pause sample session replay');render();
  replayTimer=setInterval(()=>{state.progress=Math.min(75,state.progress+1);render();if(state.progress===75)stopReplay();},500);
});
$('#market-svg').addEventListener('click',event=>{const path=event.target.closest('[data-symbol]');if(path){state.selected=state.selected===path.dataset.symbol?null:path.dataset.symbol;render();}});
$('#market-svg').addEventListener('pointermove',event=>{
  const path=event.target.closest('[data-symbol]');const tip=$('#chart-tooltip');if(!path){tip.hidden=true;return;}const s=stocks.find(s=>s.symbol===path.dataset.symbol);const rect=$('.flow-region').getBoundingClientRect();tip.innerHTML=`<strong>${esc(s.symbol)}</strong><span class="${s.direction==='bull'?'up':'down'}">${pct(moveNow(s))}</span> <span style="color:var(--muted)">· ₹${format(priceNow(s))}</span>`;tip.style.left=Math.max(0,Math.min(event.clientX-rect.left+12,rect.width-180))+'px';tip.style.top=Math.max(24,event.clientY-rect.top-56)+'px';tip.hidden=false;
});
$('#market-svg').addEventListener('pointerleave',()=>$('#chart-tooltip').hidden=true);
$('#detail-content').addEventListener('pointermove',event=>{
  const hit=event.target.closest('[data-candle]'),tip=$('.detail-chart-tooltip');if(!tip)return;if(!hit){tip.hidden=true;return;}const bar=$('#detail-chart')._candles[Number(hit.dataset.candle)],rect=$('.detail-chart-wrapper').getBoundingClientRect();tip.textContent=`O ${format(bar.open)} · H ${format(bar.high)} · L ${format(bar.low)} · C ${format(bar.close)}`;tip.style.left=Math.max(0,Math.min(event.clientX-rect.left-100,rect.width-260))+'px';tip.style.top=Math.max(0,event.clientY-rect.top-40)+'px';tip.hidden=false;
});
$$('dialog').forEach(dialog=>{dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});dialog.addEventListener('close',()=>{if(dialog.id==='stock-dialog'){state.detail=null;lastFocus?.focus();}});});

$('[data-action="reset"]').innerHTML=icon('chart');$('[data-action="watchlist"]').innerHTML=icon('star');$('[data-action="help"]').innerHTML=icon('help');$('[data-action="theme"]').innerHTML=icon('moon');
$('#search-icon').innerHTML=icon('search');$('#refresh').innerHTML=icon('refresh');$('#fullscreen').innerHTML=icon('expand');$('.calendar-icon').innerHTML=icon('calendar');$('#replay-toggle').innerHTML=icon('play');
$('#sector-filter').innerHTML+=[...sectors.filter(x=>candidateStocks.some(s=>s.sector===x.name))].map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
if(storedTheme!=='light'||storedDesign!=='3'){document.body.classList.add('dark');$('[data-action="theme"]').innerHTML=icon('sun');}
render();


// Conceptual flow animation is independent of the authenticated real quote stream.
const openFeedHelp=()=>{const denied=candidateStocks.filter(s=>s.live?.historyStatus==='authorization_required'),error=denied.find(s=>s.live.historyError)?.live.historyError;$('#provider-status').textContent=(providerState.message||'Waiting for an Upstox account and Analytics Token.')+(denied.length?` History authorization failed for ${denied.length} stocks${error?` (HTTP ${error.httpStatus}${error.code?', '+error.code:''})`:''}. Streaming quotes remain available; earlier candles have not been recovered.`:'');$('#connect-dialog').showModal();};
$('#connect-feed').addEventListener('click',openFeedHelp);$('#feed-help').addEventListener('click',openFeedHelp);
$('#motion-toggle').addEventListener('click',()=>{const paused=document.body.classList.toggle('motion-paused');$('#motion-toggle').setAttribute('aria-pressed',String(paused));$('#motion-toggle').setAttribute('aria-label',paused?'Resume decorative motion':'Pause decorative motion');$('#motion-toggle').textContent=paused?'▷':'Ⅱ';});
function setFeedMode(mode){
 if(quoteWorker){quoteWorker.terminate();quoteWorker=null;}workerBusy=false;pendingPacket=null;clearTimeout(chartUpdateTimer);chartUpdateTimer=null;boardRevision++;
 feedMode=mode;lastQuotePayload="";$('.indices').hidden=mode==='live';state.progress=75;stopReplay();$('#preview-mode').classList.toggle('active',mode==='preview');$('#live-mode').classList.toggle('active',mode==='live');
 if(mode==='preview')candidateStocks.forEach(s=>Object.assign(s,structuredClone(previewCandidates.get(s.symbol)),{live:undefined}));
 else candidateStocks.forEach(s=>{s.live=undefined;});
 updateFeedNotice();render();if(mode==='live')connectStream();else{liveSource?.close();liveSource=null;}
}
function updateFeedNotice(){
 const preview=feedMode==='preview',message=preview?'Preview quotes · Connecting paths are illustrative. Select Live data once your Upstox token is configured.':providerState.message||'Waiting for the live provider. No sample quotes are shown in Live data mode.';
 $('#connect-feed').textContent=providerState.state==='connected'?'Connected ✓':'Connect Upstox ↗';$('.visual-label').textContent=preview?'Illustrative preview':'Provider history · day change';const outdated=feedMode==='live'&&providerState.configured&&!providerState.universe_count;$('.diagram-key small').textContent=preview?'Illustrative preview paths':'Flow: from open · Cards: day change';$('#feed-notice').classList.toggle('needs-attention',!preview&&providerState.state!=='connected');$('#feed-message').textContent=message+(outdated?' Restart the backend to activate the expanded stock universe and history recovery.':'');patchMarkup($('.sample-status'),`<span class="status-dot"></span>${preview?'Preview quotes':providerState.state==='connected'?'Provider connected':'Live feed pending'}`);$('#data-footer').textContent=preview?'Preview quotes · Illustrative connecting flow':'Provider quotes · Change vs previous close';
 $('.board-column-headings>span:nth-child(2)').firstChild.textContent=preview?'PREVIEW MOMENTUM FLOW':'FLOW · CHANGE FROM OPEN';$('#snapshot-stamp').textContent=preview?'Layout preview':providerState.last_trade_time?`Last trade ${new Date(providerState.last_trade_time).toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata'})} IST`:'Waiting for authenticated data';
}
function liveSpark(s){const candles=s.live.candles||[];if(candles.length<2)return '<div class="history-empty">Intraday history unavailable. Quotes are connected, but fewer than two candles have been received.</div>';const values=candles.map(c=>c.close),min=Math.min(...values),max=Math.max(...values),d=values.map((v,i)=>`${i?'L':'M'}${i/Math.max(1,values.length-1)*190},${46-(v-min)/(max-min||1)*40}`).join(' ');return `<svg viewBox="0 0 195 53" class="mini-chart" aria-label="Actual provider price history" role="img"><path d="${d}" stroke="${stockColor(s)}" fill="none" stroke-width="1.4"/></svg>`;}
function liveStockCard(s,index){const q=s.live,bull=s.direction==='bull',date=new Date(q.timestamp).toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata'});return `<button class="setup-card ${s.direction} ${index<3?'featured':'compact'} ${index===0?'hero-pick':''}" data-open="${esc(s.symbol)}" aria-label="Inspect ${esc(s.symbol)} chart and levels">${index<3?'<div class="priority-ribbon">◆ TOP 3 · PRICE MOMENTUM <span>UPSTOX DATA</span></div>':''}<div class="setup-top"><div class="stock-id">${logo(s)}<div><strong>${esc(s.symbol)}</strong><small>${esc(s.name)} · ${esc(s.sector)}</small></div></div><span class="rank-pill">#${index+1}</span></div><div class="setup-body"><div><div class="setup-change ${bull?'up':'down'}">${pct(q.dayChange)}</div><div class="setup-price">₹${format(q.price)}</div><div class="setup-tag"><span class="direction-badge">${bull?'BULLISH':'BEARISH'}</span></div></div><div class="card-chart"><div class="buildup">PRICE HISTORY <span>FROM PROVIDER</span></div>${candleSpark(s,q.candles)}</div></div><div class="live-metrics"><div><span>FROM OPEN</span><b>${pct(q.moveFromOpen)}</b></div><div><span>VOLUME</span><b>${q.volume==null?'—':format(q.volume,0)}</b></div><div><span>LAST TRADE · IST</span><b>${date}</b></div></div></button>`;}
function renderLiveDetail(s,show){const q=s.live;$('#detail-content').className='detail-content '+s.direction;$('#detail-content').innerHTML=`<div class="detail-header"><div class="stock-id">${logo(s)}<div><strong id="detail-title">${esc(s.symbol)}</strong><small>Actual Upstox quote · ${esc(s.sector)}</small></div></div><button class="dialog-close icon-button" data-close="stock-dialog" aria-label="Close stock details">×</button></div><div class="detail-price-row"><div class="detail-price">₹${format(q.price)}</div><div class="detail-change">${pct(q.dayChange)}</div></div><div class="detail-stats">${[['OPEN',q.open],['PREVIOUS CLOSE',q.previousClose],['DAY HIGH',q.high],['DAY LOW',q.low],['AVERAGE TRADED PRICE',q.atp],['VOLUME',q.volume]].map(([label,v])=>`<div><span>${label}</span><strong>${v==null?'—':format(v,label==='VOLUME'?0:2)}</strong></div>`).join('')}</div><div class="provider-history">${candleSpark(s,q.candles)}</div><p class="live-note">Provider intraday candles are shown when available. Day change is measured against the previous close; unavailable analytics are omitted.</p><div class="detail-bottom"><span>Last trade ${new Date(q.timestamp).toLocaleString('en-GB',{timeZone:'Asia/Kolkata'})} IST</span><button data-watch="${esc(s.symbol)}">☆ Watchlist</button></div>`;if(show){lastFocus=document.activeElement;$('#stock-dialog').showModal();}}
let lastQuotePayload="",quoteWorker=null,workerBusy=false,pendingPacket=null,chartUpdateTimer=null,lastChartUpdate=0;
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
function quoteWorkerMain(){
 const history=new Map(),sentHistory=new Map();let lastHistoryPush=0;
 self.onmessage=event=>{
  try{
   const payload=JSON.parse(event.data);if(!Array.isArray(payload.quotes))throw new Error('Missing quote list');
   const now=Date.now(),pushHistory=now-lastHistoryPush>=5000;
   const quotes=payload.quotes.map(q=>{
    if(!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(q.open)||q.open<=0||!Number.isFinite(q.previousClose)||q.previousClose<=0||!Number.isFinite(q.dayChange)||!Number.isFinite(Date.parse(q.timestamp)))throw new Error('Invalid market quote');
    const session=Math.floor((Date.parse(q.timestamp)+19800000)/86400000),unique=new Map();
    for(const c of q.candles||[]){const t=Number(c.time),local=t+19800000,minute=Math.floor((local%86400000)/60000);if(Number.isFinite(t)&&Number.isFinite(c.close)&&c.close>0&&Math.floor(local/86400000)===session&&minute>=555&&minute<=930)unique.set(t,c);}
    const rows=[...unique.values()].sort((a,b)=>a.time-b.time),signature=rows.map(c=>[c.time,c.open,c.high,c.low,c.close,c.volume].join(',')).join(';');
    const previous=history.get(q.symbol);history.set(q.symbol,{session,signature});
    const {candles,...quote}=q;
    if(pushHistory||!previous||previous.session!==session){if(sentHistory.get(q.symbol)!==signature){quote.candles=rows;sentHistory.set(q.symbol,signature);}}
    return quote;
   });
   if(pushHistory)lastHistoryPush=now;
   self.postMessage({quotes,status:payload.status});
  }catch(error){self.postMessage({error:error.message});}
 };
}
function createQuoteWorker(){
 const url=URL.createObjectURL(new Blob(['('+quoteWorkerMain.toString()+')()'],{type:'application/javascript'}));
 const worker=new Worker(url);URL.revokeObjectURL(url);return worker;
}
function reportUpdateError(message){providerState.state='error';providerState.message=message;updateFeedNotice();}
function queuePacket(raw){
 pendingPacket=raw;if(workerBusy)return;
 workerBusy=true;const packet=pendingPacket;pendingPacket=null;quoteWorker.postMessage(packet);
}
function updateVisiblePrices(){
 const text=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};
 for(const card of $$('.candidate-card,.setup-card')){
  const s=candidateStocks.find(s=>s.symbol===card.dataset.open);if(!s?.live)continue;
  if(card.classList.contains('candidate-card')){text(card.querySelector(':scope>small'),pct(s.live.dayChange));text(card.querySelector('.candidate-price'),'₹'+format(s.live.price));}
  else{text(card.querySelector('.setup-change'),pct(s.live.dayChange));text(card.querySelector('.setup-price'),'₹'+format(s.live.price));const metrics=card.querySelectorAll('.live-metrics b');text(metrics[0],pct(s.live.moveFromOpen));text(metrics[1],s.live.volume==null?'—':format(s.live.volume,0));text(metrics[2],quoteTimeFormat.format(new Date(s.live.timestamp)));}
 }
 refreshStockHover();
 if(state.detail)renderDetail(false);
}
async function updateBoardInStages(){
 chartUpdateTimer=null;if(feedMode!=='live')return;
 const revision=++boardRevision;lastChartUpdate=performance.now();
 renderCards(filtered());await yieldUI();if(revision!==boardRevision||feedMode!=='live')return;
 renderRadar();await yieldUI();if(revision!==boardRevision||feedMode!=='live')return;
 renderSectors();updateSectorAppearance();renderBreadth(filtered());updateWatchCounts();
 $$('.segmented button').forEach(b=>b.querySelector('span').textContent=candidateStocks.filter(s=>s.live&&(b.dataset.filter==='all'||s.direction===b.dataset.filter)).length);
 await yieldUI();if(revision!==boardRevision||feedMode!=='live')return;
 renderMarket(filtered());refreshStockHover();
}
function applyProviderSnapshot(payload){
 if(feedMode!=='live')return;
 if(payload.error){reportUpdateError('A market update was rejected. Last valid quotes are retained.');return;}
 providerState={...providerState,...payload.status};let first=!candidateStocks.some(s=>s.live);
 for(const q of payload.quotes){const s=candidateStocks.find(s=>s.symbol===q.symbol);if(!s)continue;s.live={...q,candles:q.candles||s.live?.candles||[]};s.direction=directionOf(q.dayChange);s.conviction=Math.abs(q.dayChange);}
 for(const dir of ['bull','bear'])candidateStocks.filter(s=>s.live&&s.direction===dir).sort((a,b)=>b.conviction-a.conviction).forEach((s,i)=>s.rank=i+1);
 updateFeedNotice();updateVisiblePrices();
 if(first){render();lastChartUpdate=performance.now();}
 else if(!chartUpdateTimer)chartUpdateTimer=setTimeout(updateBoardInStages,Math.max(0,5000-(performance.now()-lastChartUpdate)));
}
function connectStream(){
 if(liveSource)return;
 if(!quoteWorker){
  try{quoteWorker=createQuoteWorker();}catch(error){reportUpdateError('Background market processing could not start. Reload this page in a browser with Web Worker support.');return;}
  quoteWorker.onmessage=event=>{workerBusy=false;try{applyProviderSnapshot(event.data);}catch(error){reportUpdateError('A market update could not be displayed. Last valid quotes are retained.');console.error(error);}if(pendingPacket){const next=pendingPacket;pendingPacket=null;queuePacket(next);}};
  quoteWorker.onerror=()=>{workerBusy=false;pendingPacket=null;reportUpdateError('Background market processing failed. Reload to reconnect.');};
 }
 liveSource=new EventSource('/api/stream');liveSource.onmessage=event=>queuePacket(event.data);
 liveSource.onerror=()=>{providerState.state='disconnected';providerState.message='Connection interrupted. Waiting to reconnect; no demo values are substituted.';updateFeedNotice();};
}
const quoteTimeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit'});
$('#preview-mode').addEventListener('click',()=>{feedModeChosen=true;setFeedMode('preview');});$('#live-mode').addEventListener('click',()=>{feedModeChosen=true;setFeedMode('live');});
fetch('/api/status').then(r=>r.ok?r.json():Promise.reject()).then(status=>{providerState=status;updateFeedNotice();if(status.configured&&!feedModeChosen)setFeedMode('live');}).catch(()=>{providerState={state:'unconfigured',message:'Start server.py and configure your Upstox Analytics Token to activate real quotes.'};updateFeedNotice();});
new ResizeObserver(()=>requestAnimationFrame(drawFlow)).observe($('.lens-canvas'));
window.addEventListener('resize',drawFlow);document.fonts?.ready.then(drawFlow);updateFeedNotice();
$('#flow-svg').addEventListener('click',event=>{const path=event.target.closest('[data-symbol]');if(path){state.selected=state.selected===path.dataset.symbol?null:path.dataset.symbol;drawFlow();}});

function focusFlow(symbol){
 const svg=$('#flow-svg');svg.classList.toggle('has-focus',Boolean(symbol));const stock=candidateStocks.find(s=>s.symbol===symbol);$$('[data-sector]').forEach(el=>el.classList.toggle('flow-sector-focus',el.dataset.sector===stock?.sector));
 svg.querySelectorAll('[data-flow-symbol]').forEach(p=>p.classList.toggle('focused-flow',p.dataset.flowSymbol===symbol));
}
$('.stock-strip').addEventListener('pointerover',e=>{const card=e.target.closest('[data-open]');if(card)focusFlow(card.dataset.open);});
$('.stock-strip').addEventListener('pointerleave',()=>focusFlow(null));
$('.stock-strip').addEventListener('focusin',e=>focusFlow(e.target.closest('[data-open]')?.dataset.open));
$('.stock-strip').addEventListener('focusout',()=>focusFlow(null));

// Hover is transient; state.sector stores only an explicitly pinned selection.
let sectorHoverTimer;
function updateSectorAppearance(){
 $$('#sector-list [data-sector]').forEach(button=>{
  button.classList.toggle('selected',button.dataset.sector===activeSector());
  button.classList.toggle('pinned-sector',button.dataset.sector===state.sector);
  button.setAttribute('aria-pressed',String(button.dataset.sector===state.sector));
 });
}
function clearSectorHover(){clearTimeout(sectorHoverTimer);if(hoveredSector!==null){hoveredSector=null;render(true);}}
$('#sector-list').addEventListener('pointerover',event=>{
 if(event.pointerType==='touch')return;
 const button=event.target.closest('[data-sector]');if(!button||button.contains(event.relatedTarget))return;
 clearTimeout(sectorHoverTimer);const sector=button.dataset.sector;
 hoveredSector=sector;render(true);
});
$('#sector-list').addEventListener('pointerout',event=>{
 const button=event.target.closest('[data-sector]');if(button&&!button.contains(event.relatedTarget))clearSectorHover();
});
$('#sector-list').addEventListener('pointerleave',clearSectorHover);
// Give scrolling priority over decorative painting.
let scrollIdle;
addEventListener('scroll',()=>{document.body.classList.add('scrolling');clearTimeout(scrollIdle);scrollIdle=setTimeout(()=>document.body.classList.remove('scrolling'),120);},{passive:true});

$('.picks-panel').addEventListener('pointerover',e=>focusFlow(e.target.closest('[data-open]')?.dataset.open));
$('.picks-panel').addEventListener('pointerleave',()=>focusFlow(null));

// Non-modal stock inspector: anchored to a hovered card, never captures the pointer.
const stockHover=document.createElement('aside');stockHover.id='stock-hover';stockHover.hidden=true;stockHover.setAttribute('role','tooltip');document.body.append(stockHover);
let stockHoverTimer,hoveredCard=null,hoverStockSymbol=null,lastPointer=null,latestHoverRenderMs=0;
function hideStockHover(){clearTimeout(stockHoverTimer);hoveredCard?.removeAttribute('aria-describedby');hoveredCard=null;hoverStockSymbol=null;stockHover.hidden=true;focusFlow(null);}
function showStockHover(card){
 const hoverStarted=performance.now();
 const s=candidateStocks.find(s=>s.symbol===card.dataset.open);if(!s||!card.isConnected||$('#stock-dialog').open)return;
 if(hoveredCard!==card)hoveredCard?.removeAttribute('aria-describedby');hoveredCard=card;hoverStockSymbol=s.symbol;const q=s.live,bull=s.direction==='bull';
 const metrics=q?[['OPEN',q.open],['PREVIOUS CLOSE',q.previousClose],['DAY HIGH',q.high],['DAY LOW',q.low],['AVERAGE PRICE',q.atp],['VOLUME',q.volume]]:[['VWAP',s.vwap],['SUPPORT',s.support],['RESISTANCE 1',s.r1],['RESISTANCE 2',s.r2],['ZONE LOW',s.zone[0]],['ZONE HIGH',s.zone[1]]];
 stockHover.className=s.direction;
 patchMarkup(stockHover,`<div class="hover-heading">${logo(s)}<div><strong>${esc(s.symbol)}</strong><span>${esc(s.name)} · ${esc(s.sector)}</span></div><b>${bull?'BUYING':'SELLING'} #${s.rank}</b></div><div class="hover-price"><strong>₹${format(priceNow(s))}</strong><span class="${bull?'up':'down'}">${pct(moveNow(s))}<small>${q?'vs previous close':'preview change'}</small></span></div><div class="hover-metrics">${metrics.map(([label,value])=>`<div><span>${label}</span><strong>${value==null?'—':format(value,label==='VOLUME'?0:2)}</strong></div>`).join('')}</div><div class="hover-chart">${candleSpark(s,q?q.candles:s.candles,!q)}</div><div class="hover-footer">${q?`Provider quote · ${new Date(q.timestamp).toLocaleString('en-GB',{timeZone:'Asia/Kolkata'})} IST`:'Illustrative preview · Not market data'}<span>Click for full details · Esc to dismiss</span></div>`);
 stockHover.hidden=false;card.setAttribute('aria-describedby','stock-hover');
 const r=card.getBoundingClientRect();stockHover.style.width=Math.min(490,innerWidth-20,r.left>=330?r.left-22:490)+'px';const w=stockHover.offsetWidth,h=stockHover.offsetHeight;
 const right=r.right+12,left=r.left-w-12;
 stockHover.style.left=Math.max(10,Math.min(left>=10?left:right,innerWidth-w-10))+'px';
 stockHover.style.top=Math.max(10,Math.min(r.top,innerHeight-h-10))+'px';focusFlow(s.symbol);latestHoverRenderMs=performance.now()-hoverStarted;
}
$('.lens-canvas').addEventListener('pointerover',event=>{
 if(event.pointerType==='touch'||!matchMedia('(hover: hover)').matches)return;
 const card=event.target.closest('.candidate-card,.setup-card');if(!card||card.contains(event.relatedTarget))return;
 if(!stockHover.hidden){showStockHover(card);return;}clearTimeout(stockHoverTimer);showStockHover(card);
});
$('.lens-canvas').addEventListener('pointerout',event=>{const card=event.target.closest('.candidate-card,.setup-card');if(card&&!card.contains(event.relatedTarget)){clearTimeout(stockHoverTimer);lastPointer={x:event.clientX,y:event.clientY};requestAnimationFrame(refreshStockHover);}});
$('.lens-canvas').addEventListener('click',hideStockHover);
addEventListener('scroll',hideStockHover,{passive:true});addEventListener('resize',hideStockHover);
document.addEventListener('keydown',event=>{if(event.key==='Escape')hideStockHover();});
$('.lens-canvas').addEventListener('focusin',event=>{const card=event.target.closest('.candidate-card,.setup-card');if(card){lastPointer=null;showStockHover(card);}});
$('.lens-canvas').addEventListener('focusout',event=>{const card=event.target.closest('.candidate-card,.setup-card');if(card&&!card.contains(event.relatedTarget))hideStockHover();});

$('.lens-canvas').addEventListener('pointermove',event=>{if(event.pointerType!=='touch')lastPointer={x:event.clientX,y:event.clientY};},{passive:true});
function refreshStockHover(){
 if(stockHover.hidden)return;
 const under=lastPointer?document.elementFromPoint(lastPointer.x,lastPointer.y)?.closest('.candidate-card,.setup-card'):document.activeElement?.closest('.candidate-card,.setup-card');
 if(under)showStockHover(under);else hideStockHover();
}

const flowParticleCanvas=document.createElement('canvas');flowParticleCanvas.className='flow-particles';flowParticleCanvas.setAttribute('aria-hidden','true');$('#flow-svg').after(flowParticleCanvas);
const flowParticleContext=flowParticleCanvas.getContext('2d');
let particleRoutes=new Map(),particleScale=1,particleClock=0,particleLastTime=0,particleWidth=0,particleHeight=0;
function sampleFlowPath(d){
 const values=(d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)||[]).map(Number);let raw=[];
 if(d.includes('C')){
  const [x0,y0,x1,y1,x2,y2,x3,y3]=values;
  raw=Array.from({length:65},(_,i)=>{const t=i/64,u=1-t;return {x:u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,y:u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3};});
 }else for(let i=0;i<values.length;i+=2)raw.push({x:values[i],y:values[i+1]});
 const distances=[0];for(let i=1;i<raw.length;i++)distances.push(distances[i-1]+Math.hypot(raw[i].x-raw[i-1].x,raw[i].y-raw[i-1].y));
 const length=distances.at(-1)||0;let segment=1;
 const points=Array.from({length:101},(_,i)=>{const target=length*i/100;while(segment<raw.length-1&&distances[segment]<target)segment++;const a=raw[Math.max(0,segment-1)],b=raw[segment]||a,t=(target-distances[segment-1])/(distances[segment]-distances[segment-1]||1);return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};});
 return {length,points};
}
function syncFlowParticles(svg,rect){
 const scale=Math.min(devicePixelRatio||1,1.5);
 if(particleWidth!==rect.width||particleHeight!==rect.height||particleScale!==scale){particleWidth=rect.width;particleHeight=rect.height;particleScale=scale;flowParticleCanvas.width=Math.round(rect.width*scale);flowParticleCanvas.height=Math.round(rect.height*scale);flowParticleCanvas.style.width=rect.width+'px';flowParticleCanvas.style.height=rect.height+'px';flowParticleContext.setTransform(scale,0,0,scale,0,0);}
 const next=new Map(),now=performance.now();
 for(const path of svg.querySelectorAll('[data-particle]')){
  const key=path.dataset.particle,d=path.getAttribute('d'),color=path.getAttribute('stroke'),old=particleRoutes.get(key);
  if(old&&old.d===d){old.color=color;next.set(key,old);continue;}
  const {length,points}=sampleFlowPath(d);if(!length)continue;
  next.set(key,{d,color,length,points,previous:old?.points||points,previousLength:old?.length||length,changed:now,symbol:path.dataset.flowSymbol,phase:symbolHash(key)%60});
 }
 particleRoutes=next;
}
function paintFlowParticles(now){
 const dt=particleLastTime?Math.min(50,now-particleLastTime):0;particleLastTime=now;
 const paused=document.hidden||document.body.classList.contains('motion-paused')||matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!paused)particleClock+=dt;
 flowParticleContext.clearRect(0,0,particleWidth,particleHeight);
 if(!paused){
  for(const route of particleRoutes.values()){
   const blend=Math.min(1,(now-route.changed)/280),length=route.previousLength+(route.length-route.previousLength)*blend;
   flowParticleContext.fillStyle=route.color;flowParticleContext.globalAlpha=hoverStockSymbol&&hoverStockSymbol!==route.symbol?.08:.8;
   for(let distance=(particleClock*.1+route.phase)%60;distance<length;distance+=60){
    const sample=distance/length*100,i=Math.min(99,Math.floor(sample)),fraction=sample-i;
    const current=route.points[i],end=route.points[i+1],previous=route.previous[i],previousEnd=route.previous[i+1];
    const x0=previous.x+(previousEnd.x-previous.x)*fraction,y0=previous.y+(previousEnd.y-previous.y)*fraction;
    const x1=current.x+(end.x-current.x)*fraction,y1=current.y+(end.y-current.y)*fraction;
    flowParticleContext.beginPath();flowParticleContext.arc(x0+(x1-x0)*blend,y0+(y1-y0)*blend,1.5,0,Math.PI*2);flowParticleContext.fill();
   }
  }
 }
 requestAnimationFrame(paintFlowParticles);
}
requestAnimationFrame(paintFlowParticles);

// Opt-in local performance panel; absent from the normal dashboard.
if(new URLSearchParams(location.search).has('perf')){
 const report=document.createElement('output');report.id='performance-report';report.style.cssText='position:fixed;bottom:4px;left:52px;background:#111;color:#fff;padding:8px;z-index:99999;font:12px monospace';document.body.append(report);
 let frames=[],last=0,tasks=[];const started=performance.now();
 if(typeof PerformanceObserver!=='undefined')try{new PerformanceObserver(list=>{for(const entry of list.getEntries())if(entry.startTime>started+2000)tasks.push(entry.duration);}).observe({type:'longtask',buffered:false});}catch(_){}
 function frame(now){if(last&&now>started+2000)frames.push(now-last);last=now;if(frames.length>1800)frames.shift();requestAnimationFrame(frame);}requestAnimationFrame(frame);
 setInterval(()=>{const sorted=[...frames].sort((a,b)=>a-b);report.textContent=JSON.stringify({seconds:Math.round((performance.now()-started)/1000),frames:frames.length,p95FrameMs:Math.round(sorted[Math.floor(sorted.length*.95)]||0),maxFrameMs:Math.round(Math.max(0,...frames)),hoverRenderMs:Math.round(latestHoverRenderMs*10)/10,longTasks:tasks.length,maxLongTaskMs:Math.round(Math.max(0,...tasks))});},1000);
}
