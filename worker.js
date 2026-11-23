const MAX_BODY_BYTES = 9 * 1024 * 1024;
const ALLOWED_PAIRS = new Set(["XAUUSD", "NAS100", "GBPUSD", "USDJPY", "BTCUSD"]);
const APP_HTML = "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><meta name=\"theme-color\" content=\"#08111d\"><title>Analyzer Pro | Market Terminal</title>\n<style>\n:root{color-scheme:dark;--bg:#08111d;--panel:#111e2f;--panel2:#0d1928;--border:#25374c;--text:#e8f1fc;--muted:#91a6bd;--blue:#55a4f6;--green:#47d3a0;--red:#ff777d}\n*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 Inter,system-ui,Segoe UI,sans-serif;padding-bottom:86px}button,input,select{font:inherit}button{cursor:pointer;color:var(--text);border:1px solid var(--border);background:#14253a;border-radius:12px;padding:11px 13px;font-weight:700}button:active{transform:scale(.98)}button.active{background:#194c79;border-color:#4c9eea}header{height:64px;position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:10px 15px;background:#08111df0;backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}.brand{display:flex;gap:10px;align-items:center}.logo{width:38px;height:38px;border-radius:12px;background:linear-gradient(145deg,#5ba9f8,#214e8e);display:grid;place-items:center;font-weight:950;font-size:20px;color:white}.brand h1{font-size:16px;margin:0}.brand small{color:var(--muted);font-size:11px}.livepill{color:#77e2b6;background:#153729;border:1px solid #275b47;padding:5px 9px;border-radius:99px;font-size:10px;font-weight:800}main{max-width:1100px;margin:auto;padding:14px}.view{display:none}.view.active{display:block}.section-title{font-size:20px;font-weight:850;margin:5px 0 3px}.sub{color:var(--muted);font-size:12px;margin:0 0 14px}.panel{background:linear-gradient(160deg,#142239,#101b2b);border:1px solid var(--border);border-radius:17px;padding:15px;margin-bottom:13px}.market-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.market{background:#0e1b2b;border:1px solid #25394f;border-radius:14px;padding:13px;text-align:left;width:100%;display:flex;align-items:center;gap:10px}.market .coin{width:38px;height:38px;border-radius:12px;background:#1b3047;display:grid;place-items:center;font-size:13px;font-weight:900;color:#9dcaff;flex-shrink:0}.market .marketname{font-weight:800}.market .ticker{font-size:11px;color:var(--muted)}.market .arrow{margin-left:auto;color:#8aa6c2}.market.selected{border-color:#3d88d3;background:#122b45}.market-list{display:grid;gap:8px}.chart-head{display:flex;justify-content:space-between;align-items:center;gap:9px;flex-wrap:wrap}.chart-title{font-weight:900;font-size:17px}.chart-price{font-size:20px;font-weight:900}.chart-wrap{height:370px;width:100%;margin-top:10px;background:#091321;border-radius:12px;overflow:hidden}.timeframes{display:flex;gap:6px;overflow-x:auto;padding:10px 0 4px}.timeframes button{flex:0 0 auto;padding:9px 11px;font-size:12px}.statrow{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:9px}.stat{border:1px solid var(--border);background:#0c1827;border-radius:11px;padding:9px;min-width:0}.stat label{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.09em}.stat strong{font-size:13px;display:block;overflow-wrap:anywhere}.message{font-size:12px;color:var(--muted);padding:9px 3px;min-height:24px}.message.error{color:#ffaaa9}.message.good{color:var(--green)}.upload-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.upload{border:1px solid var(--border);background:#0c1827;border-radius:13px;padding:11px}.upload label{font-weight:800;display:block;margin-bottom:7px}.upload input{width:100%;font-size:11px;color:var(--muted)}.preview{display:none;width:100%;max-height:160px;object-fit:contain;margin-top:8px;border-radius:8px;background:#070d16}.preview.show{display:block}.btn-main{background:linear-gradient(135deg,#2175ca,#185392);border:0;width:100%;margin-top:12px;padding:14px}.btn-clear{width:100%;margin-top:8px}.result{display:none;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;background:#0b1726;border:1px solid var(--border);border-radius:13px;padding:13px}.result.show{display:block}.settings input{width:100%;padding:12px;border:1px solid var(--border);border-radius:11px;background:#0a1725;color:var(--text);margin:8px 0}.settings button{width:100%}.bottomnav{position:fixed;bottom:0;left:0;right:0;z-index:20;background:#091320f5;backdrop-filter:blur(15px);border-top:1px solid #26374b;display:grid;grid-template-columns:repeat(5,1fr);padding:7px 4px calc(7px + env(safe-area-inset-bottom));}.navbtn{border:0;background:transparent;border-radius:11px;padding:7px 2px;color:#8195ad;font-size:10px;display:flex;flex-direction:column;align-items:center;gap:4px}.navbtn .ico{font-size:19px;line-height:1}.navbtn.active{color:#78baff;background:#112a43}.homehero{padding:19px;background:linear-gradient(130deg,#183452,#0e1b2b 65%);border:1px solid #2a4969;border-radius:18px;margin-bottom:14px}.homehero h2{font-size:23px;margin:0}.homehero p{color:#a9c1d9;font-size:12px;margin:6px 0 0}.quick{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.quick button{height:80px;text-align:left}.muted{color:var(--muted)}@media(min-width:760px){main{padding:22px}.market-grid{grid-template-columns:repeat(5,minmax(0,1fr))}.market-list{grid-template-columns:repeat(2,minmax(0,1fr))}.chart-wrap{height:480px}.upload-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:420px){main{padding:10px}.panel{padding:12px}.chart-wrap{height:300px}.market{padding:10px;gap:8px}.market .coin{width:34px;height:34px}.upload-grid{grid-template-columns:1fr 1fr}.timeframes button{padding:9px 10px}}\n</style><script src=\"https://unpkg.com/lightweight-charts@5.0.8/dist/lightweight-charts.standalone.production.js\"></script></head>\n<body>\n<header><div class=\"brand\"><div class=\"logo\">A</div><div><h1>Analyzer Pro</h1><small>Clean market terminal · AI chart analyst</small></div></div><span class=\"livepill\">● MARKET VIEW</span></header>\n<main>\n<section class=\"view active\" id=\"homeView\"><div class=\"homehero\"><h2>Market intelligence</h2><p>Select an instrument to open its chart. Upload your chart screenshots for Gemini AI analysis.</p></div><div class=\"panel\"><div class=\"section-title\">Watchlist</div><p class=\"sub\">Your 5 selected markets — no extra instruments.</p><div class=\"market-grid\" id=\"homeMarkets\"></div></div><div class=\"quick\"><button onclick=\"navigate('trade')\">📊 Open trade charts</button><button onclick=\"navigate('ai')\">✨ Gemini screenshot analysis</button></div></section>\n<section class=\"view\" id=\"tradeView\"><div class=\"section-title\">Trade · Markets</div><p class=\"sub\">Tap any symbol to open its chart.</p><div class=\"panel\"><div class=\"market-list\" id=\"tradeMarkets\"></div></div><div class=\"panel\" id=\"chartPanel\"><div class=\"chart-head\"><div><div class=\"chart-title\" id=\"chartSymbolTitle\">XAU/USD · Gold</div><div class=\"sub\" id=\"chartFeedStatus\">Connecting to market feed…</div></div><div class=\"chart-price\" id=\"chartPrice\">—</div></div><div class=\"timeframes\" id=\"tfButtons\"></div><div class=\"chart-wrap\" id=\"chartContainer\"></div><div class=\"statrow\"><div class=\"stat\"><label>Last close</label><strong id=\"lastClose\">—</strong></div><div class=\"stat\"><label>Change</label><strong id=\"change\">—</strong></div><div class=\"stat\"><label>Candles</label><strong id=\"barsCount\">—</strong></div></div><div class=\"message\" id=\"chartMessage\">Choose a market.</div></div></section>\n<section class=\"view\" id=\"chartsView\"><div class=\"section-title\">Charts</div><p class=\"sub\">Choose the chart timeframe to use as screenshot evidence for Gemini.</p><div class=\"panel\"><div class=\"upload-grid\" id=\"uploadGrid\"></div><button class=\"btn-main\" id=\"analyzeBtn\">Analyze screenshots with Gemini</button><button class=\"btn-clear\" id=\"clearBtn\">Clear screenshots and start fresh</button><div class=\"message\" id=\"aiMessage\"></div></div><div class=\"panel\"><div class=\"section-title\">Gemini analysis</div><div class=\"sub\">Analysis based only on screenshots you upload.</div><div class=\"result\" id=\"aiResult\"></div></div></section>\n\n<section class=\"view\" id=\"settingsView\"><div class=\"section-title\">Settings</div><p class=\"sub\">Clean reset · Gemini API is kept securely on Cloudflare.</p><div class=\"panel settings\"><label for=\"accessToken\">Analyzer private access token</label><input type=\"password\" id=\"accessToken\" autocomplete=\"off\" placeholder=\"Paste your private Analyzer token\"><button id=\"saveTokenBtn\">Save access token on this device</button><div class=\"message\" id=\"settingsMessage\"></div><p class=\"sub\">Gemini API key is not displayed here. It remains in the server secret and is used only for screenshot analysis.</p></div></section>\n</main>\n<nav class=\"bottomnav\" aria-label=\"Main navigation\"><button class=\"navbtn active\" data-view=\"home\"><span class=\"ico\">⌂</span>Home</button><button class=\"navbtn\" data-view=\"trade\"><span class=\"ico\">▥</span>Trade</button><button class=\"navbtn\" data-view=\"charts\"><span class=\"ico\">⌁</span>Charts</button><button class=\"navbtn\" data-view=\"settings\"><span class=\"ico\">⚙</span>Settings</button></nav>\n<script>\nconst symbols=[{id:'XAUUSD',title:'Gold · XAU/USD',short:'XAU/USD',icon:'Au'},{id:'NAS100',title:'Nasdaq · NAS100',short:'NAS100',icon:'NQ'},{id:'GBPUSD',title:'GBP/USD',short:'GBP/USD',icon:'£'},{id:'USDJPY',title:'USD/JPY',short:'USD/JPY',icon:'¥'},{id:'BTCUSD',title:'Bitcoin · BTC/USD',short:'BTC/USD',icon:'₿'}];\nconst timeframes=['1m','5m','15m','30m','1h','4h','1d'];let selectedSymbol='XAUUSD',selectedTf='5m',chart=null,series=null,refreshTimer=null,resizeObserver=null,chartStarted=false,requestCounter=0,uploads={},tokenKey='analyzerAccessToken';\nconst $=id=>document.getElementById(id);\nfunction navIcon(view){return {home:'⌂',trade:'▥',charts:'⌁',ai:'✧',settings:'⚙'}[view]||'•'}\nfunction navigate(view){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$(view+'View').classList.add('active');document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if(view==='trade'&&chart){setTimeout(()=>{chart.applyOptions({width:$('chartContainer').clientWidth,height:$('chartContainer').clientHeight});chart.timeScale().fitContent()},70)}}\ndocument.querySelectorAll('.navbtn').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));\nfunction marketButton(s,selected=false){return '<button class=\"market '+(selected?'selected':'')+'\" data-symbol=\"'+s.id+'\"><span class=\"coin\">'+s.icon+'</span><span><span class=\"marketname\">'+s.title+'</span><span class=\"ticker\">'+s.short+'</span></span><span class=\"arrow\">›</span></button>'}\nfunction renderMarkets(){ $('homeMarkets').innerHTML=symbols.map(s=>marketButton(s,s.id===selectedSymbol)).join('');$('tradeMarkets').innerHTML=symbols.map(s=>marketButton(s,s.id===selectedSymbol)).join('');document.querySelectorAll('.market[data-symbol]').forEach(b=>b.addEventListener('click',()=>selectSymbol(b.dataset.symbol)))}\nfunction selectSymbol(symbol){selectedSymbol=symbol;renderMarkets();$('chartSymbolTitle').textContent=symbols.find(s=>s.id===symbol).title;loadCandles()}\nfunction buildTfButtons(target,active,handler){$(target).innerHTML=timeframes.map(t=>'<button class=\"'+(t===active?'active':'')+'\" data-tf=\"'+t+'\">'+t.toUpperCase()+'</button>').join('');$(target).querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>handler(b.dataset.tf)))}\nbuildTfButtons('tfButtons',selectedTf,t=>{selectedTf=t;buildTfButtons('tfButtons',selectedTf,x=>{selectedTf=x;loadCandles()});loadCandles()});\n\nfunction renderUpload(){$('uploadGrid').innerHTML=timeframes.map(t=>'<div class=\"upload\"><label>'+t.toUpperCase()+' chart screenshot</label><input type=\"file\" accept=\"image/*\" capture=\"environment\" data-tf=\"'+t+'\"><img class=\"preview\" id=\"preview_'+t+'\" alt=\"preview\"><div class=\"muted\" id=\"filename_'+t+'\"></div></div>').join('');$('uploadGrid').querySelectorAll('input').forEach(inp=>inp.addEventListener('change',()=>{const file=inp.files[0];if(!file)return;uploads[inp.dataset.tf]=file;const preview=$('preview_'+inp.dataset.tf);preview.src=URL.createObjectURL(file);preview.classList.add('show');$('filename_'+inp.dataset.tf).textContent=file.name+' · selected'}))}\nrenderUpload();renderMarkets();\nfunction loadSavedToken(){return localStorage.getItem(tokenKey)||''}\n$('accessToken').value=loadSavedToken();\n$('saveTokenBtn').addEventListener('click',()=>{const t=$('accessToken').value.trim();localStorage.setItem(tokenKey,t);$('settingsMessage').textContent=t?'Access token saved on this device.':'Token cleared.'});\nfunction parseCandleData(raw){let arr=Array.isArray(raw)?raw:(raw?.candles||raw?.data||raw?.result||raw?.ohlc||raw?.bars||[]);return arr.map(x=>{let t=x.time??x.timestamp??x.date??x.t,o=Number(x.open??x.o),h=Number(x.high??x.h),l=Number(x.low??x.l),c=Number(x.close??x.c);if(!t||![o,h,l,c].every(Number.isFinite))return null;let time=typeof t==='number'?t:Math.floor(Date.parse(t)/1000);if(time>1e12)time=Math.floor(time/1000);return Number.isFinite(time)?{time,open:o,high:h,low:l,close:c}:null}).filter(Boolean).sort((a,b)=>a.time-b.time)}\nfunction tfInterval(t){return t}\nasync function loadCandles(){if(!chartStarted)return;const rid=++requestCounter,symbol=selectedSymbol,tf=selectedTf;$('chartFeedStatus').textContent='Loading feed…';$('chartMessage').textContent='Requesting live candle data…';try{const url='https://biquote.io/api/'+encodeURIComponent(symbol)+'/ohlc?interval='+tfInterval(tf)+'&limit=250';const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw Error('Feed status '+res.status);const raw=await res.json();if(rid!==requestCounter)return;const bars=parseCandleData(raw);if(!bars.length)throw Error('No candles returned or candle format unsupported');series.setData(bars);chart.timeScale().fitContent();const last=bars[bars.length-1],change=(last.close-bars[0].open)/bars[0].open*100;$('chartPrice').textContent=last.close.toLocaleString(undefined,{maximumFractionDigits:5});$('lastClose').textContent=last.close.toLocaleString(undefined,{maximumFractionDigits:5});$('change').textContent=(change>=0?'+':'')+change.toFixed(2)+'%';$('barsCount').textContent=bars.length;$('chartFeedStatus').textContent='Candle feed · refresh 30s';$('chartMessage').textContent='Chart loaded from candle feed. Price data is not fabricated.';$chartFeedStatusColor(change)}catch(e){if(rid!==requestCounter)return;$('chartFeedStatus').textContent='Feed unavailable';$('chartMessage').textContent=e.message+' · No simulated prices are shown.';$('chartMessage').className='message error';$('chartPrice').textContent='—'}}\nfunction $chartFeedStatusColor(change){$('change').style.color=change>=0?'var(--green)':'var(--red)'}\nfunction initChart(){if(!window.LightweightCharts||chartStarted)return;chart=LightweightCharts.createChart($('chartContainer'),{width:$('chartContainer').clientWidth,height:$('chartContainer').clientHeight,layout:{background:{color:'#091321'},textColor:'#94a9c0'},grid:{vertLines:{color:'#152336'},horzLines:{color:'#152336'}},rightPriceScale:{borderColor:'#203248'},timeScale:{borderColor:'#203248,timeVisible:true},crosshair:{mode:1}});series=chart.addSeries(LightweightCharts.CandlestickSeries,{upColor:'#35c992',downColor:'#fa727b',borderUpColor:'#35c992',borderDownColor:'#fa727b',wickUpColor:'#35c992',wickDownColor:'#fa727b'});chartStarted=true;loadCandles();refreshTimer=setInterval(loadCandles,30000);resizeObserver=new ResizeObserver(()=>chart.applyOptions({width:$('chartContainer').clientWidth,height:$('chartContainer').clientHeight}));resizeObserver.observe($('chartContainer'))}\nconst chartNavObserver=new MutationObserver(()=>{if($('tradeView').classList.contains('active')&&!chartStarted)initChart()});chartNavObserver.observe($('tradeView'),{attributes:true,attributeFilter:['class']});if($('tradeView').classList.contains('active'))initChart();\nasync function imageData(file){return new Promise((resolve,reject)=>{const rd=new FileReader();rd.onerror=()=>reject(Error('Cannot read screenshot'));rd.onload=()=>{const im=new Image();im.onerror=()=>reject(Error('Screenshot could not be decoded'));im.onload=()=>{const max=1450,sc=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*sc));c.height=Math.max(1,Math.round(im.height*sc));c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82).split(',')[1])};im.src=rd.result};rd.readAsDataURL(file)})}\n$('clearBtn').addEventListener('click',()=>{uploads={};renderUpload();$('aiResult').textContent='';$('aiResult').classList.remove('show');$('aiMessage').textContent='Cleared. Upload screenshots for a fresh analysis.'});\n$('analyzeBtn').addEventListener('click',async()=>{const btn=$('analyzeBtn');if(btn.disabled)return;btn.disabled=true;btn.textContent='Sending screenshots to Gemini…';$('aiMessage').textContent='Preparing chart images…';$('aiResult').textContent='';$('aiResult').classList.remove('show');try{const token=loadSavedToken();if(!token)throw Error('Open Settings and enter your private Analyzer access token.');if(!Object.keys(uploads).length)throw Error('Upload at least one screenshot from the timeframe buttons.');const charts={};for(const [tf,file] of Object.entries(uploads))charts[tf]=await imageData(file);const payload={version:'multi-timeframe-v2',stage:'multi',pair:selectedSymbol,charts,context:{analysisTimeUTC:new Date().toISOString(),userTimeZone:'Africa/Nairobi',uploadedTimeframes:Object.keys(charts)}};const body=JSON.stringify(payload);if(body.length>9*1024*1024)throw Error('Images are too large. Please use smaller screenshots.');const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json','X-Analyzer-Token':token},body,signal:AbortSignal.timeout(90000)});const out=await res.json().catch(()=>({}));if(!res.ok)throw Error(out.error||'AI request failed ('+res.status+')');if(!out.text)throw Error('Gemini returned an empty response.');$('aiResult').textContent=out.text;$('aiResult').classList.add('show');$('aiMessage').textContent='Gemini analysis completed. Review evidence and risk before trading.';$('aiMessage').className='message good';}catch(e){$('aiMessage').textContent=e.message;$('aiMessage').className='message error'}finally{btn.disabled=false;btn.textContent='Analyze screenshots with Gemini'}});\n</script></body></html>";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const ownOrigin = new URL(request.url).origin;
  if (origin && origin !== ownOrigin) return null;
  return {
    "Access-Control-Allow-Origin": ownOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Analyzer-Token",
    "Vary": "Origin"
  };
}


async function handleExecuteTrade(request, env) {
  const cors = corsHeaders(request);
  if (!cors) return json({ error: "Cross-origin requests are not allowed." }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "Use POST to forward a trade." }, 405, cors);
  if (!env.ANALYZER_ACCESS_TOKEN) return json({ error: "The execution endpoint is not protected. Configure ANALYZER_ACCESS_TOKEN." }, 503, cors);
  const suppliedToken = request.headers.get("X-Analyzer-Token") || "";
  if (suppliedToken.length !== env.ANALYZER_ACCESS_TOKEN.length || suppliedToken !== env.ANALYZER_ACCESS_TOKEN) {
    return json({ error: "Unauthorized. Check the private Analyzer access token." }, 401, cors);
  }
  if (!env.MT5_WEBHOOK_URL || !env.MT5_WEBHOOK_API_KEY) {
    return json({ error: "MT5 bridge is not configured. Set MT5_WEBHOOK_URL and MT5_WEBHOOK_API_KEY as encrypted Worker secrets." }, 503, cors);
  }
  let webhookUrl;
  try {
    webhookUrl = new URL(env.MT5_WEBHOOK_URL);
    if (webhookUrl.protocol !== "https:") throw new Error("HTTPS required");
  } catch {
    return json({ error: "MT5_WEBHOOK_URL must be a valid HTTPS URL." }, 503, cors);
  }
  let data;
  try { data = await request.json(); }
  catch { return json({ error: "Request body must be valid JSON." }, 400, cors); }
  const symbol = String(data.symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const direction = String(data.direction || "").toUpperCase();
  if (!ALLOWED_PAIRS.has(symbol)) return json({ error: "Unsupported instrument." }, 400, cors);
  if (!["LONG", "SHORT"].includes(direction)) return json({ error: "Direction must be LONG or SHORT." }, 400, cors);
  const prices = {};
  for (const key of ["entry", "sl", "tp1", "tp2", "tp3"]) {
    prices[key] = Number(data[key]);
    if (!Number.isFinite(prices[key]) || prices[key] <= 0) return json({ error: "Invalid " + key + " price." }, 400, cors);
  }
  const { entry, sl, tp1, tp2, tp3 } = prices;
  if (direction === "LONG" && !(sl < entry && entry < tp1 && tp1 <= tp2 && tp2 <= tp3)) return json({ error: "LONG prices must satisfy SL < Entry < TP1 <= TP2 <= TP3." }, 400, cors);
  if (direction === "SHORT" && !(sl > entry && entry > tp1 && tp1 >= tp2 && tp2 >= tp3)) return json({ error: "SHORT prices must satisfy SL > Entry > TP1 >= TP2 >= TP3." }, 400, cors);
  const balance = Number(data.balance), risk = Number(data.risk);
  const positionCount = Number(data.positionCount);
  const lotSize = data.lotSize === "auto" ? "auto" : Number(data.lotSize);
  if (!Number.isFinite(balance) || balance <= 0) return json({ error: "Balance must be greater than zero." }, 400, cors);
  if (!Number.isFinite(risk) || risk <= 0 || risk > 5) return json({ error: "Risk per trade must be between 0 and 5%." }, 400, cors);
  if (!Number.isInteger(positionCount) || positionCount < 1 || positionCount > 10) return json({ error: "Number of positions must be between 1 and 10." }, 400, cors);
  if (lotSize !== "auto" && (!Number.isFinite(lotSize) || lotSize <= 0 || lotSize > 100)) return json({ error: "Lot size must be Auto or a valid number no greater than 100." }, 400, cors);
  const payload = { symbol, direction, ...prices, lotSize, positionCount, balance, risk };
  const requestId = crypto.randomUUID();
  let upstream;
  try {
    upstream = await fetch(webhookUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": env.MT5_WEBHOOK_API_KEY,
        "Idempotency-Key": requestId
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    return json({ error: "Could not reach the configured MT5 Python webhook. No execution confirmation was received." }, 502, cors);
  }
  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok || result.error) {
    return json({ error: result.error || "MT5 webhook returned HTTP " + upstream.status + ".", webhookStatus: upstream.status }, 502, cors);
  }
  return json({ status: "forwarded", requestId, webhook: result, orders_placed: result.orders_placed || undefined, message: result.status || "Webhook accepted the request." }, 200, cors);
}

async function handleAnalyze(request, env) {
  const cors = corsHeaders(request);
  if (!cors) return json({ error: "Cross-origin requests are not allowed." }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method === "GET") {
    const ready = Boolean(env.GEMINI_API_KEY && env.ANALYZER_ACCESS_TOKEN);
    return json({
      status: ready ? "ready" : "not_ready",
      provider: "Google Gemini",
      error: ready ? undefined : "Configure GEMINI_API_KEY and ANALYZER_ACCESS_TOKEN as encrypted secrets on the Analyzer Pro Worker."
    }, ready ? 200 : 503, cors);
  }
  if (request.method !== "POST") return json({ error: "Use POST for chart analysis." }, 405, cors);
  if (!env.GEMINI_API_KEY) return json({ error: "The server is not configured. Add GEMINI_API_KEY as a Cloudflare Worker secret." }, 503, cors);
  if (!env.ANALYZER_ACCESS_TOKEN) return json({ error: "The server is not protected. Add ANALYZER_ACCESS_TOKEN as a Cloudflare Worker secret." }, 503, cors);
  const suppliedToken = request.headers.get("X-Analyzer-Token") || "";
  if (suppliedToken.length !== env.ANALYZER_ACCESS_TOKEN.length || suppliedToken !== env.ANALYZER_ACCESS_TOKEN) {
    return json({ error: "Unauthorized. Check the private Analyzer access token saved on this device." }, 401, cors);
  }
  const declaredSize = Number(request.headers.get("Content-Length") || 0);
  if (declaredSize > MAX_BODY_BYTES) return json({ error: "Request is too large. Upload smaller screenshots." }, 413, cors);
  let payload;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "Request is too large. Upload smaller screenshots." }, 413, cors);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400, cors);
  }
  const stage = payload.stage === "multi" ? "multi" : (payload.stage === "combined" ? "combined" : (payload.stage === "range" ? "range" : "confirm"));
  // Accept the new multi-pair format and the previous single-pair format.
  const submitted = Array.isArray(payload.pairs) ? payload.pairs : [{ pair: payload.pair || "EURUSD", charts: payload.charts || {} }];
  const timeframes = stage === "multi" ? Object.keys(submitted[0]?.charts || {}) : (stage === "range" ? ["M5"] : ["M5", "M1"]);
  if (!submitted.length || submitted.length > 1) return json({ error: "Select one market per scan. Upload its M5 and M1 screenshots." }, 400, cors);
  const seen = new Set();
  for (const item of submitted) {
    item.pair = String(item.pair || "").toUpperCase();
    if (!ALLOWED_PAIRS.has(item.pair)) return json({ error: "Unsupported instrument: " + item.pair }, 400, cors);
    if (seen.has(item.pair)) return json({ error: "Choose each instrument only once per scan." }, 400, cors);
    seen.add(item.pair);
    item.charts = item.charts && typeof item.charts === "object" ? item.charts : {};
    const missing = timeframes.filter(tf => typeof item.charts[tf] !== "string");
    if (stage === "multi" && !timeframes.length) return json({ error: "Upload at least one timeframe screenshot for Gemini analysis." }, 400, cors);
    if (missing.length) return json({ error: item.pair + " is missing screenshots: " + missing.join(", ") }, 400, cors);
  }

  const now = new Date();
  const eatNow = new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", dateStyle: "full", timeStyle: "long", hour12: false }).format(now);
  const savedRange = payload.range && typeof payload.range === "object" ? payload.range : { high: "not used in combined mode", low: "not used in combined mode", candle_time: "identified from supplied M5 screenshot" };
  if (stage === "confirm" && (!savedRange || savedRange.confirmed_closed !== true || !Number.isFinite(Number(savedRange.high)) || !Number.isFinite(Number(savedRange.low)))) return json({ error: "A verified saved M5 range is required before the M1 confirmation scan." }, 400, cors);

  const rangePrompt = [
    "You are Analyzer Pro. STAGE 1 — M5 RANGE CAPTURE ONLY. Analyze " + submitted[0].pair + ". Current Kenya time: " + eatNow + ". This is a practice-capable M5 screenshot and may be captured at any time. Do not require the New York 9:30 AM opening. Identify the latest fully completed M5 candle visible at the right edge; the user may practise outside the live session.",
    "Identify the LAST FULLY COMPLETED five-minute candle visible at the right edge. Ignore any currently forming candle. Use that candle's wick high and wick low as the opening range boundaries.",
    "Read exact high and low from the visible price scale or candle data. Do not guess, round or infer missing prices. If candle closure or either exact price is unclear, say RANGE NOT VERIFIED and do not output RANGE_DATA.",
    "This stage only captures the M5 range. Do not search for an entry, predict direction, invent a breakout, create TP or SL, or call a trade confirmed. M1 FVG confirmation comes later.",
    "Report instrument, screenshot candle/time if readable, whether this is a practice scan or a live-session scan only if that can be determined, HIGH LINE, LOW LINE and status RANGE SAVED or RANGE NOT VERIFIED. This scan is valid at any time. Tell the user to wait for the M1 screenshot when the FVG appears.",
    "Only if the candle is fully closed and both exact levels are readable, append exactly one single-line JSON record: RANGE_DATA: {\"confirmed_closed\":true,\"symbol\":\"" + submitted[0].pair + "\",\"timeframe\":\"M5\",\"high\":123.45,\"low\":122.45,\"candle_time\":\"09:30\",\"session\":\"America/New_York 09:30\"}. Replace the example prices/time with exact screenshot values. Otherwise omit RANGE_DATA.",
    "Do not claim to draw on the original broker chart; the website will display the saved high and low as range guides. Never claim a trade was placed."
  ].join("\n");
  const combinedPrompt = [
    "You are Analyzer Pro, an expert multi-timeframe chart analyst. Analyze the two supplied screenshots together for " + submitted[0].pair + ". The user's MT5 chart may use broker/server time and may NOT display New York time. Do not require MT5 to display New York time, and do not reject screenshots because of clock labels or upload time. The user captures the M5 screenshot at the END of the first 30 minutes of the New York session (9:30–10:00 AM New York), or later scrolls back so those exact six M5 candles are visible. The M1 screenshot is taken when the FVG setup appears. Both images are uploaded together; there is no saved-stage waiting.",
    "M5 OPENING RANGE: Use the SIX consecutive fully completed M5 candles that make up the first 30 minutes of the New York session, from 9:30 AM through 10:00 AM New York (six 5-minute candles). If the M5 screenshot was captured at 10:00 AM New York, these should be the six most recent fully completed M5 candles at the right edge. If it was captured later, identify the same six opening-window candles in the visible chart history. Do NOT use just one candle and do NOT use the latest six candles if the screenshot clearly shows a later period. Do not infer New York time from MT5 server-time labels. If the correct six candles cannot be identified with confidence, state RANGE NOT VERIFIED and explain what is missing.",
    "RANGE CALCULATION: Opening Range High = the highest wick high among all six M5 candles. Opening Range Low = the lowest wick low among all six M5 candles. Report all six candle highs/lows if readable, and show the exact calculated highest high and lowest low. These two levels define the range. Never guess, average, round or fabricate prices. Clearly label the range date if visible; if date is not visible, say date not readable.",
    "BREAKOUT: BUY only after a fully completed M5 candle body closes decisively above the 30-minute Opening Range High. SELL only after a fully completed M5 candle body closes decisively below the Opening Range Low. A wick-only break is invalid. Use the M5 breakout candle's wick extreme for the stop: BUY = lowest wick of breakout candle; SELL = highest wick of breakout candle. If the breakout candle/wick is not visible or exact price is unreadable, do not invent a numeric stop.",
    "M1 FVG: Identify the directional three-candle Fair Value Gap in the supplied M1 screenshot. State the exact zone only if readable. Confirm the third M1 candle has fully closed in the breakout direction. No entry before the third candle closes. If the M1 screenshot does not show all three candles and the completed third candle, verdict is WAIT.",
    "ENTRY AND RISK: Only propose entry after both the M5 range breakout and M1 FVG confirmation are verified. State entry from visible chart evidence; do not invent a price. Calculate stop distance and risk/reward only when exact entry and stop are readable. Do not add account balance or risk percentage assumptions.",
    "TAKE PROFITS: Map visible support/resistance on M5 and M1. TP1 is the nearest meaningful opposing structure in the trade direction; TP2 and TP3 are successive visible levels only if they exist. Explain timeframe and chart evidence for each. Do not force a fixed R:R or fabricate prices. Maximum intended holding time is 90 minutes; this is a plan, not automatic monitoring or closing. Never guarantee profit.",
    "STRICT EVIDENCE: Both screenshots must show the same instrument. Read prices only from visible scale/labels. Preserve displayed precision. Read chart dates/times where legible, but do not assume the broker's chart timezone is New York. If screenshots conflict, the six opening candles cannot be identified, or any critical level is unreadable, WAIT — NO TRADE and explain precisely why. Still describe the visible chart facts rather than refusing to analyse the screenshots.",
    "REPORT IN THIS ORDER: INSTRUMENT; CHART DATE/TIME AND VISIBLE TIMEZONE (if readable); M5 OPENING WINDOW (first 30 minutes, 9:30–10:00 New York); SIX M5 CANDLE HIGH/LOW VALUES (when readable); OPENING RANGE HIGH; OPENING RANGE LOW; RANGE VERIFICATION; M5 BREAKOUT DIRECTION AND BODY-CLOSE PRICE; M1 FVG DIRECTION AND EXACT ZONE; THIRD-CANDLE CLOSE CONFIRMATION; ENTRY; STOP LOSS; STOP DISTANCE; M5 SUPPORT; M5 RESISTANCE; M1 SUPPORT; M1 RESISTANCE; TP1; TP2; TP3; R:R only if calculable; estimated time to TP1 only if supported; maximum holding time 90 minutes; invalidation; limitations; final BUY/SELL/WAIT verdict.",
    "If and only if the six opening M5 candles are correctly identified and both calculated range boundaries are exact/readable, append one single-line RANGE_DATA JSON: RANGE_DATA: {\"confirmed_closed\":true,\"symbol\":\"" + submitted[0].pair + "\",\"timeframe\":\"M5\",\"range_type\":\"first_30_minutes\",\"candles\":6,\"high\":123.45,\"low\":122.45,\"candle_time\":\"9:30–10:00 New York\"}. Replace example values with exact evidence. Otherwise omit RANGE_DATA. Append EXECUTION_DATA only if the entire setup is confirmed and exact entry, SL, TP1, TP2 and TP3 are all visible and correctly ordered. Never claim an order was placed."
  ].join("\\n");
  const confirmPrompt = [
    "You are Analyzer Pro, an expert AI multi-timeframe chart analyst. Analyze " + submitted[0].pair + " using the saved M5 range screenshot and the new M1 screenshot. Current Kenya time: " + eatNow + ". Saved verified M5 range: high=" + savedRange.high + ", low=" + savedRange.low + ", candle time=" + (savedRange.candle_time || "not readable") + ". Do not change these boundaries.",
    "SUPPORTED MARKETS ONLY: XAUUSD (Gold), BTCUSD (Bitcoin), NAS100 (Nasdaq 100), US30 (Dow Jones 30). Use the selected instrument's own chart prices. Do not compare or mix symbols.",
    "ONLY ACTIVE SETUP: M5 RANGE BREAKOUT + M1 FVG CONFIRMATION. No other setup is permitted.",
    "M5 RANGE: Use the saved range from the LAST COMPLETED M5 candle at the New York 9:30 AM session opening. Stored high=" + savedRange.high + " and low=" + savedRange.low + ". Do not change these boundaries.",
    "BREAKOUT: BUY only after an M5 candle body closes decisively above the range high. SELL only after an M5 candle body closes decisively below the range low. Wick-only breaks are invalid. Require clear displacement and no immediate rejection back inside the range.",
    "FVG CONFIRMATION: A valid visible Fair Value Gap must support the breakout direction. Describe the three-candle imbalance and its price zone only when readable. No valid directional FVG means no trade.",
    "M1 ENTRY: This screenshot is supplied later when a directional FVG appears. Check decisive body-close breakout beyond the saved M5 high/low, then a valid directional FVG and three-candle confirmation. Enter only at the close of the THIRD candle. State candles 1, 2 and 3. If breakout, FVG or third-candle close is missing, WAIT. Never enter early.",
    "STOP LOSS: For BUY, use the lowest wick of the M5 breakout candle. For SELL, use the highest wick of the M5 breakout candle. Do not substitute an M1 swing or arbitrary ATR stop. If the exact breakout wick is unreadable, withhold the numeric trade plan.",
    "SUPPORT AND RESISTANCE: Map meaningful support and resistance visible on both supplied timeframes. M5 defines broader intraday structure and the breakout context. M1 identifies nearby execution obstacles and minor structure. Clearly label each level with its timeframe and whether it is support or resistance. Never fabricate or interpolate prices.",
    "TAKE PROFITS: For BUY, TP1 is the nearest meaningful resistance/overhead supply or opposing liquidity level in the trade direction; for SELL, TP1 is the nearest meaningful support/demand or opposing liquidity below. TP2 and TP3 are the next successive visible structure levels only if they exist. Explain the chart evidence/timeframe for every TP. Do not use fixed pip/point distances or force an R:R ratio. If the next support/resistance barrier leaves insufficient reward after the structural stop and costs, say WAIT — INSUFFICIENT ROOM.",
    "90-MINUTE LIMIT: Every proposed setup is intended to be completed within a maximum of 90 minutes from entry. Use only visible recent M1/M5 candle pace and distance to the target to judge whether the nearest TP is plausibly reachable within 90 minutes. If the chart does not provide enough evidence to estimate this, say TIME ESTIMATE NOT RELIABLE and do not pretend otherwise. State a hard planned maximum holding time of 90 minutes: if neither SL nor TP is reached by 90 minutes after entry, the user should close manually. The AI/site does not monitor live prices or automatically close broker positions. Never guarantee a TP or profit.",
    "STRICT EVIDENCE: Read exact prices from visible chart labels/axis. Preserve displayed decimal precision. Do not invent volume, indicators, ATR, live prices, news, spreads, win rates, confidence percentages, or pip/contract values. If screenshot timing, price scale or candles are unclear or M5/M1 do not align, report the limitation and WAIT.",
    "OUTPUT EXACTLY THIS REPORT STRUCTURE:",
    "INSTRUMENT:",
    "OVERALL VERDICT: BUY / SELL / WAIT — NO TRADE",
    "ACTIVE STRATEGY: STRATEGY 1 — M5 RANGE BREAKOUT + M1 FVG CONFIRMATION ONLY",
    "M5 SELECTED RANGE: high / low / how identified",
    "M5 BREAKOUT: direction / candle body-close price / displacement evidence",
    "SUPPORTING FVG: direction / three-candle evidence / price zone",
    "M1 ENTRY CONFIRMATION: candle 1 / candle 2 / candle 3 / confirmation close",
    "ENTRY:",
    "STOP LOSS: M5 breakout candle extreme",
    "M5 SUPPORT:",
    "M5 RESISTANCE:",
    "M1 SUPPORT:",
    "M1 RESISTANCE:",
    "TP1: nearest opposing structure level + timeframe + reason",
    "TP2: next structure level + timeframe + reason (or unavailable)",
    "TP3: next structure level + timeframe + reason (or unavailable)",
    "R:R TO EACH TARGET: only when exact prices are readable",
    "ESTIMATED TIME TO TP1: only if supported by visible candle pace",
    "MAXIMUM HOLDING TIME: 90 minutes; manual close if still open",
    "STATUS: CONFIRMED / WAITING FOR M1 THIRD-CANDLE CLOSE / INVALID",
    "INVALIDATION:",
    "WHY THE SETUP DOES OR DOES NOT FIT THE 90-MINUTE LIMIT:",
    "LIMITATIONS:",
    "If the setup is not confirmed, say WAIT — NO VALID STRATEGY 1 SETUP and name the exact missing condition. Do not output a second strategy. Do not claim an order was placed.",
    "The saved M5 range is the last fully completed candle captured at New York 9:30 AM. Never change its stored high/low. M1 is a later screenshot; validate breakout, directional FVG and third-candle close against those saved boundaries.",
    "EXECUTION_DATA CONTRACT: Append one single-line EXECUTION_DATA JSON record only when Strategy 1 is fully confirmed and exact numeric Entry, SL, TP1, TP2 and TP3 are all visible and correctly ordered. Format: EXECUTION_DATA: {\"confirmed\":true,\"symbol\":\"" + submitted[0].pair + "\",\"direction\":\"LONG\",\"entry\":1.1,\"sl\":1.09,\"tp1\":1.11,\"tp2\":1.12,\"tp3\":1.13}. Use LONG for BUY and SHORT for SELL. Never append it if any required level is missing or unconfirmed."
  ].join("\n");
  const multiPrompt = [
    "You are Analyzer Pro, an expert technical market analyst working for the user. The user uploaded one or more timeframe screenshots of " + submitted[0].pair + ". Analyze ONLY the uploaded chart evidence and clearly identify which timeframe each image shows. Current Kenya time: " + eatNow + ".",
    "TIMEFRAME CONTEXT: Available chart timeframes are D1 (daily), H4 (4-hour), H1 (1-hour), M30 (30-minute), M15 (15-minute), M5 (5-minute), and M1 (1-minute). Not every timeframe is necessarily uploaded. Do not invent or claim to see any timeframe that was not supplied.",
    "ANALYSIS: Start with the higher timeframe trend and structure (D1/H4/H1 if provided), then intraday context (M30/M15/M5), then execution detail (M1) only if provided. Describe market structure HH/HL or LH/LL, BOS/CHoCH/MSS only when visibly supported; identify supply/demand, support/resistance, equal highs/lows, liquidity sweeps, gaps/FVG, breakout/retest, and visible volume/profile information only when the screenshot actually shows it.",
    "TRADE PLAN: Give BUY/SELL/WAIT bias. Never claim an entry is confirmed unless visible evidence supports it. If lower timeframe execution screenshots are missing, say the bias is directional/context only and entry is not confirmed. Avoid chasing a breakout; prefer a retest when visible. Clearly identify invalidation, structural stop location, and targets at visible levels. If exact prices are unreadable, do not guess.",
    "EVIDENCE AND HONESTY: Do not invent prices, candles, indicators, volume, news, confidence percentages, or unseen timeframe observations. Preserve displayed precision. State image limitations. If conditions conflict or no valid setup is visible, give WAIT — NO TRADE.",
    "REPORT: 1) MARKET + UPLOADED TIMEFRAMES; 2) CURRENT TREND/STRUCTURE BY EACH PROVIDED TF; 3) KEY SUPPORT/RESISTANCE AND LIQUIDITY; 4) SUPPLY/DEMAND OR FVG (if visible); 5) SESSION/CONTEXT (only if readable or inferable from chart time); 6) BULLISH/BEARISH SCENARIOS; 7) ENTRY CONDITIONS AND RETEST; 8) INVALIDATION/STOP; 9) TARGETS; 10) RISK/REWARD only if exact levels are readable; 11) WHAT IS MISSING; 12) FINAL VERDICT: BUY / SELL / WAIT. No trade execution or profit guarantee."
  ].join("\\n");
  const prompt = stage === "multi" ? multiPrompt : (stage === "range" ? rangePrompt : (stage === "combined" ? combinedPrompt : confirmPrompt));

  const parts = [{ text: prompt }];
  for (const item of submitted) {
    for (const tf of timeframes) {
      const match = item.charts[tf].match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return json({ error: item.pair + " " + tf + " screenshot is not a supported base64 image." }, 400, cors);
      if (item.charts[tf].length > 5 * 1024 * 1024) return json({ error: item.pair + " " + tf + " screenshot is too large." }, 413, cors);
      const mimeType = match[1] === "jpg" ? "image/jpeg" : "image/" + match[1];
      parts.push({ text: "Instrument " + item.pair + " — next image is its " + tf + " chart screenshot. Treat only as evidence for this instrument and timeframe." });
      parts.push({ inlineData: { mimeType, data: match[2] } });
    }
  }

  const primaryModel = env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  // Keep the configured model first, then use official stable multimodal fallbacks
  // when Google reports temporary overload or rate limiting.
  const models = [...new Set([primaryModel, "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.7-flash"])];
  const aiRequestBody = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0, maxOutputTokens: 5000 }
  });
  let lastStatus = 0;
  let lastError = "The AI service could not complete the request.";
  let lastCode = "GEMINI_TEMPORARILY_UNAVAILABLE";
  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
    let moveToFallback = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      let response;
      let result = {};
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: aiRequestBody
        });
        result = await response.json().catch(() => ({}));
      } catch {
        lastStatus = 0;
        lastError = "Could not reach Google's Gemini service (network error).";
        lastCode = "UPSTREAM_NETWORK_ERROR";
        console.error("Gemini request failed", JSON.stringify({ model, attempt, status: 0, reason: "network_error" }));
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        moveToFallback = true;
        break;
      }
      if (!response.ok) {
        lastStatus = response.status;
        lastError = result?.error?.message || `Gemini API returned HTTP ${response.status}`;
        const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
        console.error("Gemini API returned an error", JSON.stringify({ model, attempt, status: response.status, retryable, message: String(lastError).slice(0, 300) }));
        if (!retryable) {
          const status = response.status === 401 || response.status === 403 ? response.status : 502;
          const code = response.status === 401 || response.status === 403 ? "GEMINI_AUTH_ERROR" : `GEMINI_HTTP_${response.status}`;
          return json({ error: lastError, code, upstreamStatus: response.status, retryable: false }, status, cors);
        }
        lastCode = response.status === 429 ? "GEMINI_RATE_LIMIT" : response.status === 503 ? "GEMINI_OVERLOADED" : `GEMINI_HTTP_${response.status}`;
        if (attempt < 2) {
          const retryAfter = Number(response.headers.get("Retry-After") || 0);
          const delayMs = retryAfter > 0 ? Math.min(retryAfter * 1000, 8000) : 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        moveToFallback = true;
        break;
      }
      const analysis = (result.candidates?.[0]?.content?.parts || [])
        .map(part => typeof part.text === "string" ? part.text : "")
        .filter(Boolean)
        .join("\n").trim();
      if (!analysis) {
        const finishReason = result?.candidates?.[0]?.finishReason || "UNKNOWN";
        lastStatus = response.status;
        lastError = "Gemini returned no readable analysis.";
        lastCode = "EMPTY_AI_RESPONSE";
        console.error("Gemini returned no readable analysis", JSON.stringify({ model, attempt, status: response.status, finishReason }));
        moveToFallback = true;
        break;
      }
      return json({ text: analysis, model, provider: "Google Gemini" }, 200, cors);
    }
    if (moveToFallback) {
      console.warn("Switching Gemini model after temporary failure", JSON.stringify({ failedModel: model, nextModel: models[models.indexOf(model) + 1] || null, upstreamStatus: lastStatus, code: lastCode }));
      continue;
    }
  }
  console.error("All Gemini models exhausted", JSON.stringify({ models, upstreamStatus: lastStatus, code: lastCode, reason: String(lastError).slice(0, 300) }));
  return json({
    error: "All available Gemini models are temporarily unavailable. No trade plan was produced. Please retry shortly.",
    code: "GEMINI_ALL_MODELS_UNAVAILABLE",
    upstreamStatus: lastStatus || undefined,
    lastError: String(lastError).slice(0, 300),
    retryable: true
  }, 502, cors);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/analyze") return handleAnalyze(request, env);
    if (url.pathname === "/api/execute-trade") return handleExecuteTrade(request, env);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) return new Response(APP_HTML, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, max-age=0, must-revalidate" } });
    const assetResponse = await env.ASSETS.fetch(request);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname.endsWith(".html"))) {
      const headers = new Headers(assetResponse.headers);
      headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
      return new Response(assetResponse.body, { status: assetResponse.status, statusText: assetResponse.statusText, headers });
    }
    return assetResponse;
  }
};
