const MAX_BODY_BYTES = 9 * 1024 * 1024;
const ALLOWED_PAIRS = new Set(["XAUUSD", "BTCUSD", "USDJPY", "GBPUSD", "EURUSD", "US30"]);
const APP_HTML ="<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><meta name=\"theme-color\" content=\"#08111d\"><title>Analyzer Pro | Market Terminal</title>\n<style>\n:root{color-scheme:dark;--bg:#08111d;--panel:#111e2f;--panel2:#0d1928;--border:#25374c;--text:#e8f1fc;--muted:#91a6bd;--blue:#55a4f6;--green:#47d3a0;--red:#ff777d}\n*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 Inter,system-ui,Segoe UI,sans-serif;padding-bottom:86px}button,input,select{font:inherit}button{cursor:pointer;color:var(--text);border:1px solid var(--border);background:#14253a;border-radius:12px;padding:11px 13px;font-weight:700}button:active{transform:scale(.98)}button.active{background:#194c79;border-color:#4c9eea}header{height:64px;position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:10px 15px;background:#08111df0;backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}.brand{display:flex;gap:10px;align-items:center}.logo{width:38px;height:38px;border-radius:12px;background:linear-gradient(145deg,#5ba9f8,#214e8e);display:grid;place-items:center;font-weight:950;font-size:20px;color:white}.brand h1{font-size:16px;margin:0}.brand small{color:var(--muted);font-size:11px}.livepill{color:#77e2b6;background:#153729;border:1px solid #275b47;padding:5px 9px;border-radius:99px;font-size:10px;font-weight:800}main{max-width:1100px;margin:auto;padding:14px}.view{display:none}.view.active{display:block}.section-title{font-size:20px;font-weight:850;margin:5px 0 3px}.sub{color:var(--muted);font-size:12px;margin:0 0 14px}.panel{background:linear-gradient(160deg,#142239,#101b2b);border:1px solid var(--border);border-radius:17px;padding:15px;margin-bottom:13px}.market-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.market{background:#0e1b2b;border:1px solid #25394f;border-radius:14px;padding:13px;text-align:left;width:100%;display:flex;align-items:center;gap:10px}.market .coin{width:38px;height:38px;border-radius:12px;background:#1b3047;display:grid;place-items:center;font-size:13px;font-weight:900;color:#9dcaff;flex-shrink:0}.market .marketname{font-weight:800}.market .ticker{font-size:11px;color:var(--muted)}.market .arrow{margin-left:auto;color:#8aa6c2}.market.selected{border-color:#3d88d3;background:#122b45}.market-list{display:grid;gap:8px}.chart-head{display:flex;justify-content:space-between;align-items:center;gap:9px;flex-wrap:wrap}.chart-title{font-weight:900;font-size:17px}.chart-price{font-size:20px;font-weight:900}.chart-wrap{height:370px;width:100%;margin-top:10px;background:#091321;border-radius:12px;overflow:hidden}.timeframes{display:flex;gap:6px;overflow-x:auto;padding:10px 0 4px}.timeframes button{flex:0 0 auto;padding:9px 11px;font-size:12px}.statrow{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:9px}.stat{border:1px solid var(--border);background:#0c1827;border-radius:11px;padding:9px;min-width:0}.stat label{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.09em}.stat strong{font-size:13px;display:block;overflow-wrap:anywhere}.message{font-size:12px;color:var(--muted);padding:9px 3px;min-height:24px}.message.error{color:#ffaaa9}.message.good{color:var(--green)}.upload-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.upload{border:1px solid var(--border);background:#0c1827;border-radius:13px;padding:11px}.upload label{font-weight:800;display:block;margin-bottom:7px}.upload input{width:100%;font-size:11px;color:var(--muted)}.preview{display:none;width:100%;max-height:160px;object-fit:contain;margin-top:8px;border-radius:8px;background:#070d16}.preview.show{display:block}.btn-main{background:linear-gradient(135deg,#2175ca,#185392);border:0;width:100%;margin-top:12px;padding:14px}.btn-clear{width:100%;margin-top:8px}.result{display:none;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;background:#0b1726;border:1px solid var(--border);border-radius:13px;padding:13px}.result.show{display:block}.settings input{width:100%;padding:12px;border:1px solid var(--border);border-radius:11px;background:#0a1725;color:var(--text);margin:8px 0}.settings button{width:100%}.bottomnav{position:fixed;bottom:0;left:0;right:0;z-index:20;background:#091320f5;backdrop-filter:blur(15px);border-top:1px solid #26374b;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:8px 8px calc(8px + env(safe-area-inset-bottom));}.navbtn{border:0;background:transparent;border-radius:11px;padding:8px 4px;color:#8195ad;font-size:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:0;min-height:52px;touch-action:manipulation;pointer-events:auto}.navbtn .ico{font-size:19px;line-height:1}.navbtn.active{color:#78baff;background:#112a43}.homehero{padding:19px;background:linear-gradient(130deg,#183452,#0e1b2b 65%);border:1px solid #2a4969;border-radius:18px;margin-bottom:14px}.homehero h2{font-size:23px;margin:0}.homehero p{color:#a9c1d9;font-size:12px;margin:6px 0 0}.quick{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.quick button{height:80px;text-align:left}.muted{color:var(--muted)}.photo-modal{display:none;position:fixed;inset:0;z-index:99;background:#050a11f5;padding:12px;align-items:center;justify-content:center}.photo-modal.open{display:flex}.photo-sheet{width:100%;height:100%;max-width:900px;display:flex;flex-direction:column;background:#101c2c;border:1px solid #2b4058;border-radius:18px;padding:14px;overflow:hidden}.photo-title{font-size:19px;font-weight:900}.photo-sheet p{font-size:12px;color:var(--muted);margin:5px 0 12px}.photo-sheet img{flex:1;width:100%;min-height:0;object-fit:contain;background:#050a12;border-radius:12px}.photo-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.photo-actions button{min-height:48px}.photo-actions .done{background:#1b6caa;border-color:#287fbe}.chart-panel-full{position:fixed!important;inset:0!important;z-index:100!important;margin:0!important;border-radius:0!important;padding:12px!important;display:flex!important;flex-direction:column!important;background:#08111d!important;overflow:auto!important}.chart-panel-full .chart-wrap{height:calc(100dvh - 245px)!important;min-height:240px!important}.chart-panel-full .chart-head{flex-shrink:0}.chart-panel-full .timeframes{flex-shrink:0}.chart-panel-full .statrow{flex-shrink:0}.chart-panel-full .message{flex-shrink:0}@media(min-width:760px){main{padding:22px}.market-grid{grid-template-columns:repeat(5,minmax(0,1fr))}.market-list{grid-template-columns:repeat(2,minmax(0,1fr))}.chart-wrap{height:480px}.upload-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:420px){main{padding:10px}.panel{padding:12px}.chart-wrap{height:300px}.market{padding:10px;gap:8px}.market .coin{width:34px;height:34px}.upload-grid{grid-template-columns:1fr 1fr}.timeframes button{padding:9px 10px}}\n.signal-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.signal-status{font-weight:850;color:#8dc4ff}.signal-summary{color:#c7d8ea;font-size:13px;margin-top:10px}.signal-cards{display:grid;gap:12px}.signal-card{background:linear-gradient(155deg,#14243a,#0d1928);border:1px solid var(--border);border-radius:16px;padding:14px}.signal-card.best{border-color:#3d8bce}.signal-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.signal-name{font-weight:900;font-size:16px}.signal-pill{font-size:11px;font-weight:850;padding:5px 9px;border-radius:99px;background:#20334a;color:#a9c7e8}.signal-pill.buy{background:#153c31;color:#69e0ae}.signal-pill.sell{background:#45252c;color:#ff9ba0}.signal-pill.wait{background:#3b3421;color:#f0d28a}.signal-score{font-size:24px;font-weight:950}.signal-grid,.signal-levels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.signal-metric,.signal-level{background:#0a1625;border-radius:10px;padding:9px}.signal-metric small,.signal-level small{display:block;color:var(--muted);font-size:10px}.signal-metric strong,.signal-level strong{display:block;font-size:13px;margin-top:3px;overflow-wrap:anywhere}.signal-reason{color:#b8c9db;font-size:12px;margin-top:11px;line-height:1.55}.strategy-list{color:#d3dfec;font-size:12px;line-height:1.8}@media(min-width:760px){.signal-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}\n/* Analyzer Pro: restrained monochrome terminal + compact mobile signals */\n:root{color-scheme:dark;--bg:#080808;--panel:#141414;--panel2:#101010;--border:#303030;--text:#f5f5f5;--muted:#a0a0a0;--blue:#d7d7d7;--green:#b8e2c5;--red:#f0b5b5}\nbody{background:#080808;color:#f5f5f5}header,.bottomnav{background:#090909f5;border-color:#303030}\n.logo{background:#f1f1f1;color:#080808}.livepill{color:#ddd;background:#191919;border-color:#444}\n.panel,.signal-card{background:#141414;border-color:#303030;box-shadow:none}button{background:#1b1b1b;border-color:#3a3a3a;color:#f5f5f5}\nbutton.active,.navbtn.active{background:#292929;border-color:#777;color:#fff}.homehero{background:#151515;border-color:#393939}\n.homehero p,.sub,.muted{color:#aaa}.market,.market.selected{background:#151515;border-color:#363636}.market .coin{background:#262626;color:#eee}\n.chart-wrap,.stat,.upload,.result{background:#0d0d0d;border-color:#303030}.btn-main,.photo-actions .done{background:#ededed;color:#090909;border:0}\n.signal-cards{gap:8px}.signal-card{padding:10px;border-radius:12px}.signal-card.best{border-color:#777}.signal-card-head{gap:7px}\n.signal-name{font-size:14px}.signal-pill{background:#292929;color:#eee;border:1px solid #444}\n.signal-pill.buy{background:#17251c;color:#b8e2c5;border-color:#395344}.signal-pill.sell{background:#2a1919;color:#f0b5b5;border-color:#654040}\n.signal-pill.wait{background:#252525;color:#ddd;border-color:#444}.signal-score{font-size:20px;color:#eee}\n.signal-score.buy{color:#b8e2c5}.signal-score.sell{color:#f0b5b5}.signal-score.wait{color:#eee}\n.signal-grid,.signal-levels{gap:6px;margin-top:8px}.signal-metric,.signal-level{background:#0e0e0e;border:1px solid #292929;padding:7px;border-radius:8px}\n.signal-metric small,.signal-level small{font-size:9px;color:#aaa}.signal-metric strong,.signal-level strong{font-size:12px;margin-top:2px}\n.signal-reason{font-size:11px;color:#bbb;margin-top:8px}.signal-more{margin-top:8px;border-top:1px solid #303030;padding-top:7px}\n.signal-more summary{font-size:11px;font-weight:800;color:#ddd;cursor:pointer}.signal-more .signal-reason{margin-top:7px}\n@media(max-width:420px){.signal-card{padding:9px}.signal-grid,.signal-levels{gap:5px}.signal-metric,.signal-level{padding:6px}.signal-score{font-size:18px}}\n</style><script src=\"https://unpkg.com/lightweight-charts@5.0.8/dist/lightweight-charts.standalone.production.js\"></script><script src=\"https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.0/signalr.min.js\"></script></head>\n<body>\n<header><div class=\"brand\"><div class=\"logo\">A</div><div><h1>Analyzer Pro</h1><small>Clean market terminal · AI chart analyst</small></div></div><span class=\"livepill\">● MARKET VIEW</span></header>\n<main>\n<section class=\"view active\" id=\"homeView\"><div class=\"homehero\"><h2>Market intelligence</h2><p>Select an instrument to open its chart. Upload your chart screenshots for Gemini AI analysis.</p></div><div class=\"panel\"><div class=\"section-title\">Watchlist</div><p class=\"sub\">Your 6 selected markets — no extra instruments.</p><div class=\"market-grid\" id=\"homeMarkets\"></div></div><div class=\"quick\"><button onclick=\"navigate('trade')\">📊 Open trade charts</button><button onclick=\"navigate('ai')\">✨ Gemini screenshot analysis</button></div></section>\n<section class=\"view\" id=\"tradeView\"><div class=\"section-title\">Trade · Markets</div><p class=\"sub\">Tap any symbol to open its chart.</p><div class=\"panel\"><div class=\"market-list\" id=\"tradeMarkets\"></div></div><div class=\"panel\" id=\"chartPanel\"><div class=\"chart-head\"><div><div class=\"chart-title\" id=\"chartSymbolTitle\">XAU/USD · Gold</div><div class=\"sub\" id=\"chartFeedStatus\">Connecting to market feed…</div></div><div style=\"display:flex;align-items:center;gap:8px\"><div class=\"chart-price\" id=\"chartPrice\">—</div><button id=\"chartFullPageBtn\" title=\"Open full-page chart\">⛶ Full page</button></div></div><div class=\"timeframes\" id=\"tfButtons\"></div><div class=\"chart-wrap\" id=\"chartContainer\"></div><div class=\"statrow\"><div class=\"stat\"><label>Last close</label><strong id=\"lastClose\">—</strong></div><div class=\"stat\"><label>Change</label><strong id=\"change\">—</strong></div><div class=\"stat\"><label>Candles</label><strong id=\"barsCount\">—</strong></div></div><div class=\"message\" id=\"chartMessage\">Choose a market.</div></div></section>\n<section class=\"view\" id=\"signalsView\"><div class=\"section-title\">Signals · Market scanner</div><p class=\"sub\">Scans 1m through 1D candle structure and ranks complete entry plans. Scores measure technical confluence, not guaranteed win probability.</p><div class=\"panel\"><div class=\"signal-top\"><div><div class=\"signal-status\" id=\"signalStatus\">Scanner ready</div><div class=\"sub\" id=\"signalUpdated\">Not scanned yet</div></div><button id=\"scanNowBtn\">↻ Scan markets</button></div><div class=\"signal-summary\" id=\"signalSummary\">Scan your markets to find the strongest available setup.</div></div><div id=\"signalCards\" class=\"signal-cards\"><div class=\"panel muted\">No scan results yet.</div></div><div class=\"panel\"><div class=\"section-title\">Strategies checked</div><div class=\"strategy-list\">EMA trend/pullback · RSI · MACD · breakout · FVG · liquidity sweeps · session levels · ATR · tick-volume profile (when supplied).</div><p class=\"sub\" style=\"margin-top:10px\">Forex/CFD feeds may provide tick volume rather than exchange-traded volume. Profile levels are indicative, not centralized traded volume. No trade is placed automatically.</p></div></section><section class=\"view\" id=\"chartsView\"><div class=\"section-title\">Charts</div><p class=\"sub\">Choose the chart timeframe to use as screenshot evidence for Gemini.</p><div class=\"panel\"><div class=\"upload-grid\" id=\"uploadGrid\"></div><button class=\"btn-main\" id=\"analyzeBtn\">Analyze screenshots with Gemini</button><button class=\"btn-clear\" id=\"clearBtn\">Clear screenshots and start fresh</button><div class=\"message\" id=\"aiMessage\"></div></div><div class=\"panel\"><div class=\"section-title\">Gemini analysis</div><div class=\"sub\">Analysis based only on screenshots you upload.</div><div class=\"result\" id=\"aiResult\"></div></div></section>\n\n</main>\n<nav class=\"bottomnav\" aria-label=\"Main navigation\"><button class=\"navbtn active\" data-view=\"home\"><span class=\"ico\">⌂</span>Home</button><button class=\"navbtn\" data-view=\"trade\"><span class=\"ico\">▥</span>Trade</button><button class=\"navbtn\" data-view=\"signals\"><span class=\"ico\">⌁</span>Signals</button><button class=\"navbtn\" data-view=\"charts\"><span class=\"ico\">▧</span>Charts</button></nav>\n<div id=\"photoModal\" class=\"photo-modal\"><div class=\"photo-sheet\"><div class=\"photo-title\">Confirm screenshot</div><p>Check this chart image before adding it to your analysis.</p><img id=\"confirmPhoto\" alt=\"Selected chart image\"><div class=\"photo-actions\"><button id=\"confirmPhotoCancel\">Choose another</button><button id=\"confirmPhotoDone\" class=\"done\">Done · Add screenshot</button></div></div></div>\n<script>\nconst symbols=[{id:'XAUUSD',title:'Gold · XAU/USD',short:'XAU/USD',icon:'Au'},{id:'BTCUSD',title:'Bitcoin · BTC/USD',short:'BTC/USD',icon:'₿'},{id:'USDJPY',title:'USD/JPY',short:'USD/JPY',icon:'¥'},{id:'GBPUSD',title:'GBP/USD',short:'GBP/USD',icon:'£'},{id:'EURUSD',title:'EUR/USD',short:'EUR/USD',icon:'€'},{id:'US30',title:'Dow Jones · US30',short:'US30',icon:'30'}];\nconst timeframes=['1m','5m','15m','30m','1h','4h','1d'];let selectedSymbol='XAUUSD',selectedTf='5m',chartHasData=false,pendingFile=null,pendingTf=null,chart=null,series=null,resizeObserver=null,chartStarted=false,requestCounter=0,uploads={},liveConnection=null,liveConnected=false,lastLiveBar=null;\nconst $=id=>document.getElementById(id);\nfunction navIcon(view){return {home:'⌂',trade:'▥',charts:'⌁',ai:'✧',settings:'⚙'}[view]||'•'}\nfunction navigate(view){if(view==='ai')view='charts';const target=$(view+'View');if(!target)return;document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));target.classList.add('active');document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if(view==='trade'&&chart){setTimeout(()=>{chart.applyOptions({width:$('chartContainer').clientWidth,height:$('chartContainer').clientHeight});chart.timeScale().scrollToRealTime()},70)}}\ndocument.querySelectorAll('.navbtn').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));\nfunction marketButton(s,selected=false){return '<button class=\"market '+(selected?'selected':'')+'\" data-symbol=\"'+s.id+'\"><span class=\"coin\">'+s.icon+'</span><span><span class=\"marketname\">'+s.title+'</span><span class=\"ticker\">'+s.short+'</span></span><span class=\"arrow\">›</span></button>'}\nfunction renderMarkets(){ $('homeMarkets').innerHTML=symbols.map(s=>marketButton(s,s.id===selectedSymbol)).join('');$('tradeMarkets').innerHTML=symbols.map(s=>marketButton(s,s.id===selectedSymbol)).join('');document.querySelectorAll('.market[data-symbol]').forEach(b=>b.addEventListener('click',()=>selectSymbol(b.dataset.symbol)))}\nfunction selectSymbol(symbol){const previous=selectedSymbol;selectedSymbol=symbol;renderMarkets();$('chartSymbolTitle').textContent=symbols.find(s=>s.id===symbol).title;navigate('trade');if(liveConnection&&liveConnected){liveConnection.invoke('Unsubscribe',[previous]).catch(()=>{});liveConnection.invoke('Subscribe',[symbol]).catch(()=>{});}loadCandles()}\nfunction buildTfButtons(target,active,handler){$(target).innerHTML=timeframes.map(t=>'<button class=\"'+(t===active?'active':'')+'\" data-tf=\"'+t+'\">'+t.toUpperCase()+'</button>').join('');$(target).querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>handler(b.dataset.tf)))}\nfunction setChartTf(t){selectedTf=t;lastLiveBar=null;buildTfButtons('tfButtons',selectedTf,setChartTf);loadCandles()}buildTfButtons('tfButtons',selectedTf,setChartTf);\n\nfunction renderUpload(){$('uploadGrid').innerHTML=timeframes.map(t=>'<div class=\"upload\"><label>'+t.toUpperCase()+' chart screenshot</label><input type=\"file\" accept=\"image/*\" data-tf=\"'+t+'\"><img class=\"preview\" id=\"preview_'+t+'\" alt=\"preview\"><div class=\"muted\" id=\"filename_'+t+'\"></div></div>').join('');$('uploadGrid').querySelectorAll('input').forEach(inp=>inp.addEventListener('change',()=>{const file=inp.files[0];if(!file)return;pendingFile=file;pendingTf=inp.dataset.tf;$('confirmPhoto').src=URL.createObjectURL(file);$('photoModal').classList.add('open');document.body.style.overflow='hidden'}))}\nrenderUpload();renderMarkets();\nfunction parseCandleData(raw){let arr=Array.isArray(raw)?raw:(raw?.candles||raw?.data||raw?.result||raw?.ohlc||raw?.bars||[]);return arr.map(x=>{let t=x.time??x.timestamp??x.date??x.t??x.openTime,o=Number(x.open??x.o),h=Number(x.high??x.h),l=Number(x.low??x.l),c=Number(x.close??x.c);if(!t||![o,h,l,c].every(Number.isFinite))return null;let time=typeof t==='number'?t:Math.floor(Date.parse(t)/1000);if(time>1e12)time=Math.floor(time/1000);return Number.isFinite(time)?{time,open:o,high:h,low:l,close:c}:null}).filter(Boolean).sort((a,b)=>a.time-b.time)}\nfunction tfInterval(t){return t}\nasync function loadCandles(){if(!chartStarted)return;const rid=++requestCounter,symbol=selectedSymbol,tf=selectedTf;lastLiveBar=null;$('chartFeedStatus').textContent='Loading feed…';$('chartMessage').textContent='Requesting live candle data…';try{const url='/api/candles?symbol='+encodeURIComponent(symbol)+'&interval='+encodeURIComponent(tfInterval(tf))+'&limit=250';const res=await fetch(url,{cache:'no-store'});if(!res.ok){const detail=await res.text().catch(()=> '');throw Error('Feed status '+res.status+(detail?' · '+detail.slice(0,120):''))}const raw=await res.json();if(rid!==requestCounter)return;const bars=parseCandleData(raw);if(!bars.length)throw Error('The provider returned no usable candles for '+symbol+' ('+tf+').');series.setData(bars);if(!chartHasData){chart.timeScale().fitContent();chartHasData=true}else{chart.timeScale().scrollToRealTime()}lastLiveBar=bars[bars.length-1];const last=bars[bars.length-1],change=(last.close-bars[0].open)/bars[0].open*100;$('chartPrice').textContent=last.close.toLocaleString(undefined,{maximumFractionDigits:5});$('lastClose').textContent=last.close.toLocaleString(undefined,{maximumFractionDigits:5});$('change').textContent=(change>=0?'+':'')+change.toFixed(2)+'%';$('barsCount').textContent=bars.length;$('chartFeedStatus').textContent=liveConnected?'Live market stream · connected':'Historical candles loaded · connecting live stream';$('chartMessage').textContent='Historical candles loaded. Waiting for live market ticks.';$chartFeedStatusColor(change)}catch(e){if(rid!==requestCounter)return;$('chartFeedStatus').textContent='Feed unavailable';$('chartMessage').textContent=e.message+' · No simulated prices are shown.';$('chartMessage').className='message error';$('chartPrice').textContent='—'}}\nfunction $chartFeedStatusColor(change){$('change').style.color=change>=0?'var(--green)':'var(--red)'}\nfunction toggleChartFullPage(){const panel=$('chartPanel');const on=panel.classList.toggle('chart-panel-full');$('chartFullPageBtn').textContent=on?'✕ Exit full page':'⛶ Full page';document.body.style.overflow=on?'hidden':'';if(chart)setTimeout(()=>chart.applyOptions({width:$('chartContainer').clientWidth,height:$('chartContainer').clientHeight}),80)}$('chartFullPageBtn').addEventListener('click',toggleChartFullPage);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('chartPanel').classList.contains('chart-panel-full'))toggleChartFullPage()});\nfunction liveBarSeconds(){return ({'1m':60,'5m':300,'15m':900,'30m':1800,'1h':3600,'4h':14400,'1d':86400})[selectedTf]||300}\nfunction handleLiveTick(tick){\n  if(!tick||String(tick.symbol||'').toUpperCase()!==selectedSymbol)return;\n  const price=Number(tick.mid??tick.price??tick.bid);\n  if(!Number.isFinite(price)||price<=0)return;\n  const stamp=tick.timestamp?Math.floor(new Date(tick.timestamp).getTime()/1000):Math.floor(Date.now()/1000);\n  if(!Number.isFinite(stamp))return;\n  const step=liveBarSeconds(),bucket=Math.floor(stamp/step)*step;\n  if(!lastLiveBar||lastLiveBar.time!==bucket){\n    const open=lastLiveBar&&lastLiveBar.time<bucket?lastLiveBar.close:price;\n    lastLiveBar={time:bucket,open,high:Math.max(open,price),low:Math.min(open,price),close:price};\n  }else{\n    lastLiveBar={...lastLiveBar,high:Math.max(lastLiveBar.high,price),low:Math.min(lastLiveBar.low,price),close:price};\n  }\n  if(series){try{series.update(lastLiveBar)}catch(e){}}\n  $('chartPrice').textContent=price.toLocaleString(undefined,{maximumFractionDigits:5});\n  $('lastClose').textContent=price.toLocaleString(undefined,{maximumFractionDigits:5});\n  $('chartFeedStatus').textContent='Live market stream · '+(liveConnected?'connected':'reconnecting');\n  $('chartMessage').textContent='Live price updates are arriving as the market moves.';\n}\nasync function connectLiveFeed(){\n  if(liveConnection||!window.signalR)return;\n  liveConnection=new signalR.HubConnectionBuilder().withUrl('https://biquote.io/hubs/tick').withAutomaticReconnect().build();\n  liveConnection.on('ReceiveTick',handleLiveTick);\n  liveConnection.onreconnected(async()=>{liveConnected=true;try{await liveConnection.invoke('Subscribe',[selectedSymbol]);$('chartFeedStatus').textContent='Live market stream · connected'}catch(e){$('chartFeedStatus').textContent='Live stream reconnecting…'}});\n  liveConnection.onclose(()=>{liveConnected=false;$('chartFeedStatus').textContent='Live stream disconnected · retrying'});\n  try{\n    await liveConnection.start();\n    liveConnected=true;\n    await liveConnection.invoke('Subscribe',[selectedSymbol]);\n    $('chartFeedStatus').textContent='Live market stream · connected';\n  }catch(e){\n    liveConnected=false;\n    $('chartFeedStatus').textContent='Live stream unavailable · historical candles remain visible';\n  }\n}\nfunction initChart(){if(!window.LightweightCharts||chartStarted)return;chart=LightweightCharts.createChart($('chartContainer'),{width:$('chartContainer').clientWidth,height:$('chartContainer').clientHeight,layout:{background:{color:'#091321'},textColor:'#94a9c0'},grid:{vertLines:{color:'#152336'},horzLines:{color:'#152336'}},rightPriceScale:{borderColor:'#203248'},timeScale:{borderColor:'#203248',timeVisible:true},crosshair:{mode:1}});series=chart.addSeries(LightweightCharts.CandlestickSeries,{upColor:'#35c992',downColor:'#fa727b',borderUpColor:'#35c992',borderDownColor:'#fa727b',wickUpColor:'#35c992',wickDownColor:'#fa727b'});chartStarted=true;loadCandles();connectLiveFeed();resizeObserver=new ResizeObserver(()=>chart.applyOptions({width:$('chartContainer').clientWidth,height:$('chartContainer').clientHeight}));resizeObserver.observe($('chartContainer'))}\nconst chartNavObserver=new MutationObserver(()=>{if($('tradeView').classList.contains('active')&&!chartStarted)initChart()});chartNavObserver.observe($('tradeView'),{attributes:true,attributeFilter:['class']});if($('tradeView').classList.contains('active'))initChart();\n\nlet signalScanBusy=false,signalScanTimer=null;\nfunction sigEsc(v){return String(v??'—').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]))}\nfunction sigRender(data){\n const rows=(data.results||[]).slice().sort((a,b)=>(b.score||0)-(a.score||0));\n $('signalCards').innerHTML=rows.map((r,i)=>{const d=r.direction||'WAIT',cl=d.toLowerCase(),noData=r.status==='FEED UNAVAILABLE',score=noData?'—':String(r.score??0);return '<article class=\"signal-card '+(i===0&&r.score>=65?'best':'')+'\"><div class=\"signal-card-head\"><div><div class=\"signal-name\">'+sigEsc(r.name||r.symbol)+'</div><div class=\"sub\">'+sigEsc(r.symbol)+'</div></div><div style=\"text-align:right\"><div class=\"signal-pill '+(noData?'wait':cl)+'\">'+sigEsc(noData?'NO DATA':d)+' · '+sigEsc(r.status||'WAIT')+'</div><div class=\"signal-score '+cl+'\">'+sigEsc(score)+'<span style=\"font-size:10px;color:var(--muted)\"> '+(noData?'':'/100')+'</span></div></div></div><div class=\"signal-grid\"><div class=\"signal-metric\"><small>Execution</small><strong>'+sigEsc(r.orderType||'WAIT')+'</strong></div><div class=\"signal-metric\"><small>Entry</small><strong>'+sigEsc(r.entry||'—')+'</strong></div><div class=\"signal-metric\"><small>Stop loss</small><strong>'+sigEsc(r.stopLoss||'—')+'</strong></div><div class=\"signal-metric\"><small>Risk / reward</small><strong>'+sigEsc(r.riskReward||'—')+'</strong></div></div><div class=\"signal-levels\"><div class=\"signal-level\"><small>TP1</small><strong>'+sigEsc(r.tp1||'—')+'</strong></div><div class=\"signal-level\"><small>TP2</small><strong>'+sigEsc(r.tp2||'—')+'</strong></div><div class=\"signal-level\"><small>TP3</small><strong>'+sigEsc(r.tp3||'—')+'</strong></div><div class=\"signal-level\"><small>Trend · 5m / 15m / 1h</small><strong>'+sigEsc(r.trend||'—')+'</strong></div></div><details class=\"signal-more\"><summary>POI and strategy details · '+sigEsc((r.strategies||[]).length)+' strategies detected</summary><div class=\"signal-reason\"><b>Next point of interest:</b> '+sigEsc(r.poi||'—')+'<br><b>TP1 target:</b> '+sigEsc(r.targetPoi||'—')+'<br><b>TP1 buffer:</b> '+sigEsc(r.targetBuffer||'—')+'<br><b>Entry plan:</b> '+sigEsc(r.entryType||'Wait')+'<br><b>ATR:</b> '+sigEsc(r.atr||'—')+'<br><b>Volume Profile:</b> '+sigEsc(r.volumeProfile||'Not available from feed')+'<br><b>Asian range:</b> '+sigEsc(r.asianRange?.text||'Not available')+'<br><b>Opening range:</b> '+sigEsc(r.openingRange?.text||'Not available')+'<br><b>Liquidity:</b> '+sigEsc(r.liquiditySweep||'Not confirmed')+'<br><b>Strategies:</b> '+sigEsc((r.strategies||[]).join(' · ')||'No confirmed trigger')+'<br><b>Invalidation:</b> '+sigEsc(r.invalidation||'Reassess structure')+'<br>'+sigEsc(r.reason||'Insufficient evidence')+'</div></details><button style=\"width:100%;margin-top:8px;padding:9px\" data-open-signal=\"'+sigEsc(r.symbol)+'\">Open chart</button></article>'}).join('');\n $('signalCards').querySelectorAll('[data-open-signal]').forEach(b=>b.addEventListener('click',()=>selectSymbol(b.dataset.openSignal)));\n const best=rows.find(r=>r.direction!=='WAIT'&&r.score>=65);\n const next=rows.find(r=>r.direction!=='WAIT');$('signalSummary').textContent=next?'Next opportunity: '+next.symbol+' · '+next.orderType+' '+next.entry+' · TP1 '+(next.tp1||'—')+' · '+(next.poi||'nearby POI')+'. Check spread and broker stop-distance.':'No nearby POI has a valid next target. Scanner will keep watching rather than invent a trade.';\n}\nasync function runSignalScan(){if(signalScanBusy)return;signalScanBusy=true;$('scanNowBtn').disabled=true;$('signalStatus').textContent='Scanning all watchlist markets…';$('signalSummary').textContent='Comparing 5m, 15m and 1h candle structure…';try{const r=await fetch('/api/signals',{cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Market scan failed ('+r.status+')');sigRender(d);$('signalStatus').textContent='Scan complete · '+d.available+' / '+d.total+' markets available';$('signalUpdated').textContent='Updated '+new Date(d.timestamp||Date.now()).toLocaleTimeString()+' · rescans every 60 seconds while open'}catch(e){$('signalStatus').textContent='Scanner unavailable';$('signalSummary').textContent=e.message+' No trade levels have been fabricated.'}finally{signalScanBusy=false;$('scanNowBtn').disabled=false}}\n$('scanNowBtn').addEventListener('click',runSignalScan);\ndocument.querySelectorAll('.navbtn').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.view==='signals'){runSignalScan();if(signalScanTimer)clearInterval(signalScanTimer);signalScanTimer=setInterval(()=>{if($('signalsView').classList.contains('active'))runSignalScan()},60000)}}));\n\nasync function imageData(file){return new Promise((resolve,reject)=>{const rd=new FileReader();rd.onerror=()=>reject(Error('Cannot read screenshot'));rd.onload=()=>{const im=new Image();im.onerror=()=>reject(Error('Screenshot could not be decoded'));im.onload=()=>{const max=1450,sc=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*sc));c.height=Math.max(1,Math.round(im.height*sc));c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82).split(',')[1])};im.src=rd.result};rd.readAsDataURL(file)})}\n$('confirmPhotoCancel').addEventListener('click',()=>{pendingFile=null;pendingTf=null;$('photoModal').classList.remove('open');document.body.style.overflow=''});$('confirmPhotoDone').addEventListener('click',()=>{if(!pendingFile||!pendingTf)return;uploads[pendingTf]=pendingFile;const preview=$('preview_'+pendingTf);preview.src=URL.createObjectURL(pendingFile);preview.classList.add('show');$('filename_'+pendingTf).textContent=pendingFile.name+' · confirmed';pendingFile=null;pendingTf=null;$('photoModal').classList.remove('open');document.body.style.overflow=''});$('clearBtn').addEventListener('click',()=>{uploads={};renderUpload();$('aiResult').textContent='';$('aiResult').classList.remove('show');$('aiMessage').textContent='Cleared. Upload screenshots for a fresh analysis.'});\n$('analyzeBtn').addEventListener('click',async()=>{const btn=$('analyzeBtn');if(btn.disabled)return;btn.disabled=true;btn.textContent='Sending screenshots to Gemini…';$('aiMessage').textContent='Preparing chart images…';$('aiResult').textContent='';$('aiResult').classList.remove('show');try{if(!Object.keys(uploads).length)throw Error('Upload at least one screenshot from the timeframe buttons.');const charts={};for(const [tf,file] of Object.entries(uploads))charts[tf]=await imageData(file);const payload={version:'multi-timeframe-v2',stage:'multi',pair:selectedSymbol,charts,context:{analysisTimeUTC:new Date().toISOString(),userTimeZone:'Africa/Nairobi',uploadedTimeframes:Object.keys(charts)}};const body=JSON.stringify(payload);if(body.length>9*1024*1024)throw Error('Images are too large. Please use smaller screenshots.');const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(90000)});const out=await res.json().catch(()=>({}));if(!res.ok)throw Error(out.error||'AI request failed ('+res.status+')');if(!out.text)throw Error('Gemini returned an empty response.');$('aiResult').textContent=out.text;$('aiResult').classList.add('show');$('aiMessage').textContent='Gemini analysis completed. Review evidence and risk before trading.';$('aiMessage').className='message good';}catch(e){$('aiMessage').textContent=e.message;$('aiMessage').className='message error'}finally{btn.disabled=false;btn.textContent='Analyze screenshots with Gemini'}});\n</script></body></html>";

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
    const ready = Boolean(env.GEMINI_API_KEY);
    return json({
      status: ready ? "ready" : "not_ready",
      provider: "Google Gemini",
      error: ready ? undefined : "Configure GEMINI_API_KEY as an encrypted secret on the Analyzer Pro Worker."
    }, ready ? 200 : 503, cors);
  }
  if (request.method !== "POST") return json({ error: "Use POST for chart analysis." }, 405, cors);
  if (!env.GEMINI_API_KEY) return json({ error: "The server is not configured. Add GEMINI_API_KEY as a Cloudflare Worker secret." }, 503, cors);
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
    "SUPPORTED MARKETS ONLY: XAUUSD (Gold), BTCUSD (Bitcoin), USDJPY, GBPUSD, EURUSD, US30 (Dow Jones 30). Use the selected instrument's own chart prices. Do not compare or mix symbols.",
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
    "You are Analyzer Pro, a professional multi-timeframe technical market analyst. Analyze ONLY uploaded screenshots of " + submitted[0].pair + " and identify which timeframe each image shows. Current Kenya time: " + eatNow + ".",
    "TIMEFRAME HIERARCHY: D1 for macro direction; H4/H1 for structure, supply/demand and key levels; M30/M15 for intraday context; M5/M1 for execution. Analyze only supplied timeframes. If D1 is supplied, it has priority unless clearly contradicted by lower timeframe evidence; describe countertrend trades as such.",
    "MARKET STRUCTURE: Identify trend and HH/HL or LH/LL, swings, ranges, BOS, CHoCH/MSS, consolidation and candle-close confirmation only when visibly supported. Distinguish wick breaks from candle body closes. Quote exact price levels only if readable.",
    "LIQUIDITY: Identify equal highs/lows, buy-side/sell-side liquidity, likely stop pools, sweeps/grabs and inducement only when visible. Label a sweep confirmed or possible, and explain what price must do next.",
    "VOLUME PROFILE: If volume bars or profile are visible, assess tick/real volume limitations, POC, VAH/VAL, HVN/LVN and acceptance/rejection. If no volume profile is shown, say it is not available from these images. Do not fabricate profile levels or volume.",
    "CONFLUENCE: Assess trend, structure, zone, liquidity, displacement, FVG, retest and lower-timeframe trigger only where evidence exists. Give an honest confluence checklist. Do not manufacture a confidence percentage.",
    "SIGNAL: Final verdict BUY, SELL or WAIT; status WATCH / SETUP FORMING / ENTRY CONFIRMED / INVALID. Only label ENTRY CONFIRMED when visible trigger evidence exists. Give entry zone, structural SL, TP1/TP2/TP3 at visible opposing structure and R:R only when exact levels can be calculated. Include invalidation and whether this is a good time. If the move already ran without a retest, state MISSED ENTRY — DO NOT CHASE.",
    "REPORT: Market and screenshots/timeframes; HTF direction; structure per uploaded timeframe; support/resistance; liquidity; supply/demand and FVG; volume profile status; bullish and bearish scenario; signal and setup status; entry/confirmation; SL and invalidation; TP1/TP2/TP3; R:R if calculable; missing evidence; final BUY/SELL/WAIT. No automatic trading or profit guarantees. Never invent unseen chart details."
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


function sigCandles(raw){const a=Array.isArray(raw)?raw:(raw?.candles||raw?.data||raw?.result||raw?.ohlc||raw?.bars||[]);return a.map(x=>{const o=Number(x.open??x.o),h=Number(x.high??x.h),l=Number(x.low??x.l),c=Number(x.close??x.c);const rv=Number(x.volume??x.vol),tv=Number(x.tickVolume??x.tick_volume);const v=Number.isFinite(rv)&&rv>0?rv:(Number.isFinite(tv)&&tv>0?tv:null);const rawTime=x.timestamp??x.time??x.openTime??x.open_time;const numericTime=typeof rawTime==="number"||(typeof rawTime==="string"&&rawTime.trim()!==""&&Number.isFinite(Number(rawTime)));let t=numericTime?Number(rawTime):Date.parse(rawTime)/1000;if(Number.isFinite(t)&&t>1e12)t=Math.floor(t/1000);return [o,h,l,c].every(Number.isFinite)?{open:o,high:h,low:l,close:c,volume:v,volumeKind:Number.isFinite(rv)&&rv>0?"real":"tick",time:Number.isFinite(t)?Math.floor(t):null}:null}).filter(Boolean).sort((x,y)=>(x.time??0)-(y.time??0))}
function sigEma(a,p){if(a.length<p)return null;const k=2/(p+1);let e=a.slice(0,p).reduce((x,y)=>x+y,0)/p;for(let i=p;i<a.length;i++)e=a[i]*k+e*(1-k);return e}
function sigRsi(a){if(a.length<15)return null;let g=0,l=0;for(let i=a.length-14;i<a.length;i++){const d=a[i]-a[i-1];if(d>0)g+=d;else l-=d}return l===0?100:100-100/(1+g/l)}
function sigAtr(a){if(a.length<15)return null;let t=0;for(let i=a.length-14;i<a.length;i++){const p=a[i-1].close;t+=Math.max(a[i].high-a[i].low,Math.abs(a[i].high-p),Math.abs(a[i].low-p))}return t/14}
function sigFmt(n){return Number.isFinite(n)?Number(n).toPrecision(7):"Unavailable"}
function sigVP(a){
 const v=a.filter(x=>x.volume!==null);
 if(v.length<20)return {available:false,text:"Unavailable — provider has no reliable volume",poc:null,vah:null,val:null,kind:"none"};
 const lo=Math.min(...v.map(x=>x.low)),hi=Math.max(...v.map(x=>x.high));if(hi<=lo)return {available:false,text:"Unavailable",poc:null,vah:null,val:null,kind:"none"};
 const bins=Array(48).fill(0),step=(hi-lo)/bins.length;
 for(const x of v){const typical=(x.high+x.low+x.close)/3,i=Math.min(47,Math.max(0,Math.floor((typical-lo)/step)));bins[i]+=x.volume}
 const total=bins.reduce((s,x)=>s+x,0),pocIdx=bins.indexOf(Math.max(...bins));let left=pocIdx,right=pocIdx,covered=bins[pocIdx];
 while(total>0&&covered<total*.70){const lv=left>0?bins[left-1]:-1,rv=right<47?bins[right+1]:-1;if(lv<0&&rv<0)break;if(rv>lv){right++;covered+=bins[right]}else{left--;covered+=bins[left]}}
 const poc=lo+(pocIdx+.5)*step,val=lo+left*step,vah=lo+(right+1)*step;
 return {available:true,text:"POC "+sigFmt(poc)+" · VAH "+sigFmt(vah)+" · VAL "+sigFmt(val)+" · 70% value area · tick-volume proxy (not centralized exchange volume)",poc,vah,val,kind:"tick-volume-proxy"};
}
function sigBuild(sym,d){
 const a=d["5m"],m1=d["1m"],b=d["15m"],m30=d["30m"],c=d["1h"],h4=d["4h"],d1=d["1d"];
 if(!a||!b||!c||a.length<55||b.length<55||c.length<55)return {symbol:sym,direction:"WAIT",orderType:"WAIT",status:"FEED UNAVAILABLE",score:0,reason:"Insufficient candle history for 5m, 15m and 1h.",strategies:[],volumeProfile:"Unavailable"};
 const closes=a.map(x=>x.close),last=a.at(-1),prev=a.at(-2),e20=sigEma(closes,20),e50=sigEma(closes,50),rsi=sigRsi(closes),atr=sigAtr(a);
 const emaTrend=(arr)=>{const z=arr.map(x=>x.close),e=sigEma(z,20),f=sigEma(z,50);return e===null||f===null?"UNKNOWN":z.at(-1)>e&&e>f?"BULLISH":z.at(-1)<e&&e<f?"BEARISH":"MIXED"};
 const trends={"5m":emaTrend(a),"15m":emaTrend(b),"30m":m30?.length>=55?emaTrend(m30):"UNKNOWN","1h":emaTrend(c),"4h":h4?.length>=55?emaTrend(h4):"UNKNOWN","1d":d1?.length>=55?emaTrend(d1):"UNKNOWN"};
 const higher=[trends["15m"],trends["1h"],trends["4h"],trends["1d"]].filter(x=>x!=="UNKNOWN"),bullHigher=higher.filter(x=>x==="BULLISH").length,bearHigher=higher.filter(x=>x==="BEARISH").length;
 let buy=0,sell=0;const strategies=[],details=[];
 if(trends["5m"]==="BULLISH"&&trends["15m"]==="BULLISH"){buy+=16;strategies.push("5m/15m EMA 20/50 trend")}
 if(trends["5m"]==="BEARISH"&&trends["15m"]==="BEARISH"){sell+=16;strategies.push("5m/15m EMA 20/50 trend")}
 if(bullHigher>=Math.ceil(higher.length*.66)){buy+=14;strategies.push("Higher-timeframe trend alignment")}
 if(bearHigher>=Math.ceil(higher.length*.66)){sell+=14;strategies.push("Higher-timeframe trend alignment")}
 if(rsi>=52&&rsi<=68){buy+=7;strategies.push("RSI bullish momentum")}if(rsi<=48&&rsi>=32){sell+=7;strategies.push("RSI bearish momentum")}
 const macd=sigEma(closes,12)-sigEma(closes,26),prior=sigEma(closes.slice(0,-1),12)-sigEma(closes.slice(0,-1),26);
 if(macd>0&&macd>prior){buy+=7;strategies.push("MACD bullish momentum")}if(macd<0&&macd<prior){sell+=7;strategies.push("MACD bearish momentum")}
 const recent=a.slice(-21,-1),rangeHigh=Math.max(...recent.map(x=>x.high)),rangeLow=Math.min(...recent.map(x=>x.low));
 const bullBreak=last.close>rangeHigh&&last.close>last.open,bearBreak=last.close<rangeLow&&last.close<last.open;
 if(bullBreak){buy+=12;strategies.push("20-candle breakout")}if(bearBreak){sell+=12;strategies.push("20-candle breakdown")}
 const near=Math.abs(last.close-e20)<Math.max(atr||0,Math.abs(last.close)*.0005);
 if(near&&trends["5m"]==="BULLISH"&&last.close>last.open){buy+=9;strategies.push("EMA20 trend pullback")}
 if(near&&trends["5m"]==="BEARISH"&&last.close<last.open){sell+=9;strategies.push("EMA20 trend pullback")}
 if(a.at(-1).low>a.at(-3).high&&trends["5m"]==="BULLISH"){buy+=6;strategies.push("Bullish fair value gap")}
 if(a.at(-1).high<a.at(-3).low&&trends["5m"]==="BEARISH"){sell+=6;strategies.push("Bearish fair value gap")}
 const priorLow=Math.min(...a.slice(-21,-1).map(x=>x.low)),priorHigh=Math.max(...a.slice(-21,-1).map(x=>x.high));
 const sweepLow=last.low<priorLow&&last.close>priorLow&&last.close>last.open,sweepHigh=last.high>priorHigh&&last.close<priorHigh&&last.close<last.open;
 if(sweepLow){buy+=8;strategies.push("Sell-side liquidity sweep")}
 if(sweepHigh){sell+=8;strategies.push("Buy-side liquidity sweep")}
 const vp=sigVP(a);if(vp.available){if(last.close>vp.poc&&last.close<vp.vah&&trends["5m"]==="BULLISH"){buy+=4;strategies.push("Volume profile POC/value-area support")}if(last.close<vp.poc&&last.close>vp.val&&trends["5m"]==="BEARISH"){sell+=4;strategies.push("Volume profile POC/value-area resistance")}}
 // Asian range is computed only when candle timestamps are present; use UTC session boundaries and label as proxy.
 let asian={available:false,text:"Unavailable — candle timestamps missing"};
 if(a.some(x=>x.time)){const day=new Date(last.time*1000).toISOString().slice(0,10),today=a.filter(x=>x.time&&new Date(x.time*1000).toISOString().slice(0,10)===day),asia=today.filter(x=>{const dt=new Date(x.time*1000);const hr=dt.getUTCHours();return hr>=0&&hr<6});if(asia.length>=3){asian={available:true,high:Math.max(...asia.map(x=>x.high)),low:Math.min(...asia.map(x=>x.low)),text:"UTC 00:00–06:00 range (session proxy)"};if(last.close>asian.high&&trends["5m"]==="BULLISH"){buy+=6;strategies.push("Asian range breakout proxy")}if(last.close<asian.low&&trends["5m"]==="BEARISH"){sell+=6;strategies.push("Asian range breakdown proxy")}}}
 // M5 opening range and M1 FVG are included only when minute candles are available.
 let openingRange={available:false,text:"Unavailable — no M1 history"};
 if(m1?.length>=30){const latest=m1.at(-1),sameDay=m1.filter(x=>x.time&&latest.time&&new Date(x.time*1000).toISOString().slice(0,10)===new Date(latest.time*1000).toISOString().slice(0,10));const opening=sameDay.slice(0,5);if(opening.length>=3){openingRange={available:true,high:Math.max(...opening.map(x=>x.high)),low:Math.min(...opening.map(x=>x.low)),text:"First five M1 candles of UTC day (opening-range proxy)"}}}
 // Find nearby swing points of interest and stage a pending order beyond the level.
 const bars=a.slice(-120),pivotHighs=[],pivotLows=[];
 for(let i=2;i<bars.length-2;i++){const x=bars[i];if(x.high>bars[i-1].high&&x.high>bars[i-2].high&&x.high>=bars[i+1].high&&x.high>=bars[i+2].high)pivotHighs.push(x.high);if(x.low<bars[i-1].low&&x.low<bars[i-2].low&&x.low<=bars[i+1].low&&x.low<=bars[i+2].low)pivotLows.push(x.low)}
 const pad=Math.max((atr||0)*.10,Math.abs(last.close)*.00005);
 const above=[...new Set(pivotHighs.filter(x=>x>last.close+pad).sort((x,y)=>x-y))],below=[...new Set(pivotLows.filter(x=>x<last.close-pad).sort((x,y)=>y-x))];
 const nearHigh=above[0]??rangeHigh,nearLow=below[0]??rangeLow;
 const bullBias=bullHigher>bearHigher||(bullHigher===bearHigher&&trends["5m"]==="BULLISH"),bearBias=bearHigher>bullHigher||(bullHigher===bearHigher&&trends["5m"]==="BEARISH");
 const distUp=Math.max(0,nearHigh-last.close),distDown=Math.max(0,last.close-nearLow),body=Math.abs(last.close-last.open),lowerWick=Math.min(last.open,last.close)-last.low,upperWick=last.high-Math.max(last.open,last.close);
 const atSupport=distDown<=Math.max((atr||0)*.45,pad*2),atResistance=distUp<=Math.max((atr||0)*.45,pad*2);
 let direction="WAIT",orderType="WAIT",entry=null,entryLabel="No nearby tradeable point of interest",stop=null,tp1=null,targetLevel=null,poiText="No clean nearby point of interest",targetText="No confirmed target beyond entry";
 if(atSupport&&last.close>last.open&&lowerWick>=body*.7){direction="BUY";orderType="BUY LIMIT";entry=nearLow+pad;entryLabel="Buy Limit at nearby demand / swing support";poiText="Support / demand swing "+sigFmt(nearLow)}
 else if(atResistance&&last.close<last.open&&upperWick>=body*.7){direction="SELL";orderType="SELL LIMIT";entry=nearHigh-pad;entryLabel="Sell Limit at nearby supply / swing resistance";poiText="Resistance / supply swing "+sigFmt(nearHigh)}
 else if(bullBreak){direction="BUY";orderType="MARKET BUY";entry=last.close;entryLabel="Market buy after confirmed 5m breakout";poiText="Breakout continuation above "+sigFmt(rangeHigh)}
 else if(bearBreak){direction="SELL";orderType="MARKET SELL";entry=last.close;entryLabel="Market sell after confirmed 5m breakdown";poiText="Breakdown continuation below "+sigFmt(rangeLow)}
 else if((bullBias&&!bearBias)||(bullBias===bearBias&&distUp<=distDown)){direction="BUY";orderType="BUY STOP";entry=nearHigh+pad;entryLabel="Buy Stop above nearest swing resistance";poiText="Breakout trigger above swing high "+sigFmt(nearHigh)}
 else{direction="SELL";orderType="SELL STOP";entry=nearLow-pad;entryLabel="Sell Stop below nearest swing support";poiText="Breakdown trigger below swing low "+sigFmt(nearLow)}
 // Tighten stops to recent structure and enforce a minimum 1:2 reward-to-risk.
 let tp2=null,tp3=null;
 if(direction==="BUY"){
   const stopBase=Math.min(...bars.slice(-12).map(x=>x.low));
   stop=stopBase-pad;
   const risk=entry-stop;
   const targets=[...new Set(pivotHighs.filter(x=>x>entry+pad))].sort((x,y)=>x-y);
   const qualifying=targets.filter(x=>((x-pad-entry)/risk)>=2);
   targetLevel=qualifying[0]??null;tp1=targetLevel===null?null:targetLevel-pad;
   const farther=targets.filter(x=>targetLevel!==null&&x>targetLevel);
   const t3=farther.find(x=>((x-pad-entry)/risk)>=3),t4=farther.find(x=>((x-pad-entry)/risk)>=4);
   tp2=t3?sigFmt(t3-pad):null;tp3=t4?sigFmt(t4-pad):null;
   targetText=targetLevel?"Nearest resistance that qualifies for at least 1:2 R:R":"No target offers minimum 1:2 R:R";
 }
 if(direction==="SELL"){
   const stopBase=Math.max(...bars.slice(-12).map(x=>x.high));
   stop=stopBase+pad;
   const risk=stop-entry;
   const targets=[...new Set(pivotLows.filter(x=>x<entry-pad))].sort((x,y)=>y-x);
   const qualifying=targets.filter(x=>((entry-(x+pad))/risk)>=2);
   targetLevel=qualifying[0]??null;tp1=targetLevel===null?null:targetLevel+pad;
   const farther=targets.filter(x=>targetLevel!==null&&x<targetLevel);
   const t3=farther.find(x=>((entry-(x+pad))/risk)>=3),t4=farther.find(x=>((entry-(x+pad))/risk)>=4);
   tp2=t3?sigFmt(t3+pad):null;tp3=t4?sigFmt(t4+pad):null;
   targetText=targetLevel?"Nearest support that qualifies for at least 1:2 R:R":"No target offers minimum 1:2 R:R";
 }
 const validTarget=direction==="BUY"?Number.isFinite(tp1)&&tp1>entry&&((tp1-entry)/(entry-stop))>=2:direction==="SELL"?Number.isFinite(tp1)&&tp1<entry&&((entry-tp1)/(stop-entry))>=2:false;
 if(!validTarget||!Number.isFinite(stop)||(direction==="BUY"&&stop>=entry)||(direction==="SELL"&&stop<=entry)){direction="WAIT";orderType="WAIT";entry=null;stop=null;tp1=null;tp2=null;tp3=null;entryLabel="Rejected: no target with minimum 1:2 R:R";poiText="No nearby setup meets the risk/reward rule";targetText="Trade rejected — minimum 1:2 R:R not achieved"}
 const entryRisk=stop===null?null:Math.abs(entry-stop),rr=entryRisk>0&&tp1!==null?Math.abs(tp1-entry)/entryRisk:null;
 const score=Math.min(100,Math.max(direction==="BUY"?buy:direction==="SELL"?sell:0,direction==="WAIT"?0:35));

 const status=direction==="WAIT"?"NO VALID NEARBY POI":orderType.includes("STOP")?"PENDING BREAKOUT / BREAKDOWN":"PENDING LEVEL REACTION";
 const setupReason=strategies.length?strategies.join(" + "):"Swing POI and directional bias"; const reason="Trade rationale: "+setupReason+". Structure: 5m "+trends["5m"]+", 15m "+trends["15m"]+", 1h "+trends["1h"]+". Next POI: "+poiText+". Target: "+targetText+". Minimum R:R is 1:2; score is not a win probability.";
 return {symbol:sym,name:({XAUUSD:"Gold · XAU/USD",BTCUSD:"Bitcoin · BTC/USD",USDJPY:"USD/JPY",GBPUSD:"GBP/USD",EURUSD:"EUR/USD",US30:"Dow Jones · US30"})[sym],direction,orderType,entryType:entryLabel,entry:entry===null?"No valid POI":sigFmt(entry),entryPrice:entry,stopLoss:stop===null?"Not confirmed":sigFmt(stop),stopPrice:stop,tp1:tp1!==null?sigFmt(tp1):null,tp2:tp2??null,tp3:tp3??null,riskReward:rr?("1:"+rr.toFixed(2)):"Unavailable",poi:poiText,targetPoi:targetText,targetBuffer:pad,trend:trends["5m"]+" / "+trends["15m"]+" / "+trends["1h"],timeframes:trends,atr:atr?sigFmt(atr):"Unavailable",volumeProfile:vp.text,volumeProfileAvailable:vp.available,asianRange:asian,openingRange,score,status,reason,strategies,liquiditySweep:sweepLow?"Sell-side swept":sweepHigh?"Buy-side swept":"No confirmed sweep",invalidation:direction==="BUY"?"5m close below "+sigFmt(stop):direction==="SELL"?"5m close above "+sigFmt(stop):"No valid POI — remain flat."};
}
async function handleSignals(){const syms=[...ALLOWED_PAIRS],tfs=["1m","5m","15m","30m","1h","4h","1d"];const results=await Promise.all(syms.map(async sym=>{const pairs=await Promise.all(tfs.map(async tf=>{try{const r=await fetch("https://biquote.io/api/"+sym+"/ohlc?interval="+tf+"&limit=160",{headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error("provider");return [tf,sigCandles(await r.json())]}catch{return [tf,[]]}}));return sigBuild(sym,Object.fromEntries(pairs))}));return Response.json({timestamp:new Date().toISOString(),total:syms.length,available:results.filter(x=>x.status!=="FEED UNAVAILABLE").length,results},{headers:{"Cache-Control":"no-store"}})}

async function handleCandles(request) { const u=new URL(request.url); const symbol=u.searchParams.get('symbol')||''; const interval=u.searchParams.get('interval')||'5m'; const limit=Math.min(500,Math.max(10,Number(u.searchParams.get('limit')||250))); if(!ALLOWED_PAIRS.has(symbol)) return new Response(JSON.stringify({error:'Symbol not supported'}),{status:400,headers:{'Content-Type':'application/json'}}); const allowedIntervals=new Set(['1m','5m','15m','30m','1h','4h','1d']); if(!allowedIntervals.has(interval)) return new Response(JSON.stringify({error:'Timeframe not supported'}),{status:400,headers:{'Content-Type':'application/json'}}); try { const upstream=await fetch('https://biquote.io/api/'+encodeURIComponent(symbol)+'/ohlc?interval='+encodeURIComponent(interval)+'&limit='+limit,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(12000)}); const body=await upstream.text(); return new Response(body,{status:upstream.status,headers:{'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store'}}); } catch(e) {return new Response(JSON.stringify({error:'Candle data provider could not be reached',detail:String(e.message||e)}),{status:502,headers:{'Content-Type':'application/json'}})} }
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/candles" && request.method === "GET") return handleCandles(request);
    if (url.pathname === "/api/signals" && request.method === "GET") return handleSignals();
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
