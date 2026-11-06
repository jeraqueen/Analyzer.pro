(()=>{'use strict';
const $=id=>document.getElementById(id);
const EVENTS={
 NFP:{name:'US Non-Farm Payrolls',filter:'Headline payrolls vs consensus and prior revisions; unemployment rate and average hourly earnings; distinguish a broad USD repricing from a headline-only surprise.'},
 CPI:{name:'US Consumer Price Index',filter:'Headline CPI vs consensus and prior; core CPI vs consensus and prior; monthly and annual rates; services/shelter components only if shown. Core can outweigh headline for rate expectations.'},
 FOMC:{name:'Federal Reserve rate decision / FOMC',filter:'Rate decision vs consensus; statement wording; dot plot/SEP if released; press-conference guidance. Do not infer the full reaction from the rate decision alone.'},
 PCE:{name:'US PCE inflation',filter:'Core PCE and headline PCE vs consensus/prior; monthly and annual rates; distinguish the Fed-preferred core measure from headline.'},
 GDP:{name:'US GDP',filter:'Advance/second/final estimate vs consensus and prior; inspect consumption, investment and price index details only when supplied.'},
 PMI:{name:'Major PMI release',filter:'Manufacturing/services/composite; actual vs consensus/prior; 50 expansion/contraction threshold is context, not a trade trigger.'},
 CLAIMS:{name:'US Initial Jobless Claims',filter:'Actual vs consensus and prior/revisions; assess trend across several releases rather than overreacting to one weekly print.'},
 RETAIL:{name:'US Retail Sales',filter:'Headline and control-group sales vs consensus/prior; assess revisions and real-vs-nominal context only when supplied.'},
 OTHER:{name:'Other major event',filter:'Identify the exact release and source from the supplied screenshot/notes before forming an event-specific thesis.'}
};
const STRATEGIES={
 NFP:[
 ['Wait-and-trade / first-15m breakout','Do not trade the first impulse. Let the first 5–15 minutes form; mark the first completed 15-minute candle high/low; consider a close and retest outside the range, with stop beyond the opposite/invalidating structure and 1.5–2R only if chart structure allows.'],
 ['Measured spike fade','Only consider after an unusually large move (e.g. >1.5× verified ATR) stalls and reverses; require a completed reclaim/reversal and 50–61.8% retracement evidence. Stop beyond spike extreme. Never fade a strong trend without confirmation.'],
 ['Data-surprise bias','Compare headline payrolls with consensus and prior revisions, unemployment rate and average hourly earnings. Trade only if the combined surprise and post-release price/yield reaction are coherent. A single headline is insufficient.'],
 ['Bracket / straddle (research-only)','A buy-stop/sell-stop bracket 10–20 pips/ticks around price before release has gap, spread, slippage and whipsaw risk. Do not place both orders automatically; this app does not execute orders. Prefer simulation only unless broker execution and risk controls are separately verified.'],
 ['Options implied-volatility crush (informational only)','Requires listed options, implied-volatility and options-chain data. Mark NOT AVAILABLE for spot FX/CFD/MT5 analysis without those data; never present as executable here.']
 ],
 CPI:[
 ['Core vs headline filter','Compare headline and core CPI against consensus and prior values, including monthly and annual rates where available. Do not trade headline alone if core tells a materially different story.'],
 ['Post-release confirmation / VWAP-EMA pullback','Avoid the first 1–2 minutes. Let 5–10 minutes of structure form; require a pullback/retest to verified VWAP or visible/calculable 9/21 EMA and a completed rejection/continuation candle.'],
 ['Rates-led confirmation','Use the US 2-year yield only if its current move and timestamp are supplied by a verified source/chart. Check whether USD and yields confirm the same macro interpretation; never invent yield data.'],
 ['Overreaction fade','Consider only after a clear failed extension, reclaim and reversal confirmation; target a defensible pre-release/structure level. Do not fade a sustained repricing.'],
 ['Options volatility strategy (informational only)','IV crush/straddles require actual options-chain and implied-volatility data. Mark NOT AVAILABLE for a spot FX/CFD account without these data.']
 ],
 FOMC:[
 ['Decision + statement repricing','Compare the actual rate decision with consensus, then assess statement changes and guidance. The rate decision alone does not determine direction.'],
 ['Press-conference second move','Avoid the first 1–2 minutes; wait for the press conference and a 5–15 minute structure/level confirmation. Statements can reverse the initial move.'],
 ['Yield-confirmed trend continuation','Use verified US 2-year/10-year yield reaction only when supplied; require USD/price structure to confirm, not merely a yield spike.'],
 ['Failed-break / spike fade','Fade only a completed failed breakout and reclaim after volatility/spread normalises; stop beyond the event extreme.']
 ],
 OTHER:[
 ['Consensus surprise + revision filter','Compare actual vs consensus vs previous and revisions; identify whether the surprise is broad or concentrated in one component.'],
 ['Post-release range breakout','Wait for the first 5–15 minute range, then require a completed close and retest; avoid the first impulse candle.'],
 ['Failed-break / overreaction fade','Require a clear failed extension, reclaim and confirmation after spreads normalise.'],
 ['Cross-market confirmation','Use rates, USD index or related market only when the live chart/data is actually supplied and timestamped; do not infer unavailable correlations.']
 ]
};
function safe(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function mount(){
 if(!$('overview')||$('eventStrategyPage'))return;
 const nav=document.querySelector('.bottom-nav');
 const btn=document.createElement('button');btn.dataset.page='eventStrategy';btn.innerHTML='<span class="nav-ico">◷</span>Events';nav?.append(btn);
 const page=document.createElement('section');page.className='page';page.id='eventStrategyPage';
 page.innerHTML=`
 <div class="grid">
  <div class="card s12">
   <div class="eyebrow">Macro event desk · AI strategy screening</div>
   <h2>Economic-event strategy workspace</h2>
   <p class="muted small">Choose the release, add the calendar values/screenshots and upload current chart screenshots. The AI will screen the event-specific strategies against your evidence. This is not a live economic calendar or live price feed; dates and actual/forecast values must come from your supplied source.</p>
   <div class="f2">
    <div class="field"><label>Choose event</label><select id="eventType"><option value="NFP">US Non-Farm Payrolls (NFP)</option><option value="CPI">US CPI</option><option value="FOMC">Federal Reserve / FOMC</option><option value="PCE">US PCE inflation</option><option value="GDP">US GDP</option><option value="PMI">PMI</option><option value="CLAIMS">Initial jobless claims</option><option value="RETAIL">US Retail Sales</option><option value="OTHER">Other major event</option></select></div>
    <div class="field"><label>Market to analyse</label><select id="eventPair"><option value="EURUSD">EUR/USD</option><option value="GBPUSD">GBP/USD</option><option value="USDJPY">USD/JPY</option><option value="USDCAD">USD/CAD</option><option value="AUDUSD">AUD/USD</option><option value="USDCHF">USD/CHF</option><option value="EURJPY">EUR/JPY</option><option value="XAUUSD">Gold · XAU/USD</option><option value="BTCUSD">Bitcoin · BTC/USD</option></select></div>
    <div class="field"><label>Release date</label><input id="eventDate" type="date"></div>
    <div class="field"><label>Release time (Kenya / EAT)</label><input id="eventTime" type="time"></div><div class="notice" id="eventCountdown" style="grid-column:1/-1">Enter the event date and time to start the EAT countdown. This date is user-supplied, not fetched from a live calendar.</div>
    <div class="field"><label>Actual result (if released)</label><input id="eventActual" placeholder="Leave blank before release"></div>
    <div class="field"><label>Consensus / forecast</label><input id="eventForecast" placeholder="Enter calendar forecast"></div>
    <div class="field"><label>Previous value / revision</label><input id="eventPrevious" placeholder="Enter previous value"></div>
    <div class="field"><label>Core / secondary component</label><input id="eventCore" placeholder="e.g. Core CPI, wages, unemployment"></div>
   </div>
   <div class="field" style="margin-top:10px"><label>Source / notes (include the calendar source and timestamp)</label><textarea id="eventNotes" placeholder="Paste the event details shown by your calendar. Do not enter guesses."></textarea></div>
   <div class="notice" id="eventStrategySummary" style="margin-top:10px"></div>
  </div>
  <div class="card s12">
   <div class="eyebrow">Chart evidence</div><h3>Upload event-day chart screenshots</h3>
   <p class="muted small">Add one or more readable charts. Use H1/H4 for context and M15/M5/M1 for post-release confirmation. Also upload the economic-calendar screenshot so the AI can read the event values; screenshots are evidence, not an automatic live feed.</p>
   <div class="f2">
    ${[['H4','Higher-timeframe context'],['H1','Hourly structure'],['M15','15-minute event range'],['M5','5-minute confirmation'],['M1','1-minute trigger']].map(([tf,label])=>`<div class="field"><label>${tf} · ${label}</label><label class="file-pick" for="eventChart${tf}">＋ Choose ${tf} chart</label><input class="file-input-hidden" type="file" id="eventChart${tf}" accept="image/*"><div class="file-selected hidden" id="eventChartName${tf}"></div></div>`).join('')}
    <div class="field"><label>Economic calendar / release screenshot</label><label class="file-pick" for="eventEvidence">＋ Choose calendar or release screenshot</label><input class="file-input-hidden" type="file" id="eventEvidence" accept="image/*"><div class="file-selected hidden" id="eventEvidenceName"></div></div>
   </div>
   <div class="f2" style="margin-top:10px">
    <div class="field"><label>Account balance (USD)</label><input id="eventBalance" type="number" min="0" placeholder="Enter balance"></div>
    <div class="field"><label>Account currency</label><select id="eventCurrency"><option value="USD">USD</option><option value="KES">KES</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></div>
    <div class="field"><label>Maximum risk (%)</label><input id="eventRisk" type="number" min="0.1" max="10" step="0.1" value="0.5"></div>
    <div class="field"><label>Estimated round-trip costs</label><input id="eventCosts" type="number" min="0" step="0.01" value="0"></div>
   </div>
   <div class="row" style="margin-top:12px"><button class="primary" id="runEventAnalysis">Analyse this event</button><button id="clearEventForm">Clear event uploads</button></div>
   <div id="eventAnalysisMsg" class="notice" style="margin-top:10px">Select an event and upload at least one chart screenshot. Add a calendar screenshot or source notes for event-specific screening.</div>
   <div id="eventAnalysisResult" class="result-copy hidden" style="margin-top:12px;max-height:none"></div>
  </div>
  <div class="card s12"><div class="eyebrow">Strategy catalogue</div><h3 id="eventStrategyTitle">NFP strategies</h3><div id="eventStrategyCards"></div></div>
  <div class="card s12"><div class="notice">Risk notice: high-impact releases can cause gaps, spread widening and slippage. The app does not place orders. It must be acceptable to return NO TRADE. Options strategies are informational only unless options-chain data and a supported venue are available.</div></div>
 </div>`;
 $('settings').parentElement.insertBefore(page,$('settings'));
 function renderStrategies(){const type=$('eventType').value,entry=EVENTS[type],items=STRATEGIES[type==='PCE'||type==='GDP'||type==='PMI'||type==='CLAIMS'||type==='RETAIL'?'OTHER':type]||STRATEGIES.OTHER;$('eventStrategySummary').innerHTML='<b>'+safe(entry.name)+'</b><br>'+safe(entry.filter);$('eventStrategyTitle').textContent=entry.name+' · strategies to screen';$('eventStrategyCards').innerHTML=items.map((x,i)=>'<div style="padding:10px 0;border-bottom:1px solid var(--line)"><b>'+(i+1)+'. '+safe(x[0])+'</b><p class="muted small">'+safe(x[1])+'</p></div>').join('')}
 $('eventType').onchange=renderStrategies;renderStrategies();
 const updateEventCountdown=()=>{const date=$('eventDate').value,time=$('eventTime').value,box=$('eventCountdown');if(!date||!time){box.textContent='Enter the event date and time to start the EAT countdown. This date is user-supplied, not fetched from a live calendar.';return}const target=new Date(date+'T'+time+':00+03:00'),ms=target.getTime()-Date.now();if(!Number.isFinite(ms)){box.textContent='Check the release date and time.';return}if(ms<=0){box.textContent='RELEASE TIME REACHED / PASSED · '+date+' '+time+' EAT. Upload post-release screenshots and actual values for reaction analysis.';return}const total=Math.floor(ms/1000),days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60),seconds=total%60;box.textContent='TIME TO RELEASE · '+days+'d '+String(hours).padStart(2,'0')+':'+String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0')+' EAT';};$('eventDate').addEventListener('change',updateEventCountdown);$('eventTime').addEventListener('change',updateEventCountdown);setInterval(updateEventCountdown,1000);updateEventCountdown();
 const setMsg=(s,type='')=>{const e=$('eventAnalysisMsg');e.className='notice'+(type?' '+type:'');e.textContent=s};
 const readFile=async f=>{if(!f)return null;if(!f.type.startsWith('image/'))throw Error('Please choose an image file.');try{const bmp=await createImageBitmap(f);let scale=Math.min(1,1600/Math.max(bmp.width,bmp.height));for(let attempt=0;attempt<5;attempt++){const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bmp.width*scale));canvas.height=Math.max(1,Math.round(bmp.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bmp,0,0,canvas.width,canvas.height);for(const quality of [0.84,0.76,0.68,0.60]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=1.2*1024*1024){bmp.close?.();return data}}scale*=0.82}bmp.close?.();throw Error('Screenshot is too detailed to compress safely. Crop it to the chart/event details and upload again.')}catch(e){if(String(e.message||'').includes('compress safely'))throw e;return await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>{const data=String(rd.result);if(data.length>1.2*1024*1024)reject(Error('This browser cannot compress the image. Please crop or reduce the screenshot size and retry.'));else resolve(data)};rd.onerror=()=>reject(Error('Could not read screenshot.'));rd.readAsDataURL(f)})}};
 for(const tf of ['H4','H1','M15','M5','M1'])$('eventChart'+tf).onchange=()=>{const f=$('eventChart'+tf).files?.[0],n=$('eventChartName'+tf);if(n){n.textContent=f?'✓ '+f.name:'No file selected';n.classList.toggle('hidden',!f)}};
 $('eventEvidence').onchange=()=>{const f=$('eventEvidence').files?.[0],n=$('eventEvidenceName');n.textContent=f?'✓ '+f.name:'No file selected';n.classList.toggle('hidden',!f)};
 $('clearEventForm').onclick=()=>{document.querySelectorAll('#eventStrategyPage input[type=file]').forEach(i=>i.value='');document.querySelectorAll('#eventStrategyPage .file-selected').forEach(n=>{n.textContent='';n.classList.add('hidden')});$('eventAnalysisResult').classList.add('hidden');setMsg('Uploads cleared. Your event selection and notes were kept.')};
 $('runEventAnalysis').onclick=async()=>{
  const btn=$('runEventAnalysis');btn.disabled=true;btn.textContent='Analysing…';$('eventAnalysisResult').classList.add('hidden');
  try{
   const store=JSON.parse(localStorage.getItem('fxResearchDesk_v2')||'{}'),settings=store.settings||{},token=settings.accessToken||'',url=settings.backendUrl||'/api/analyze';
   if(!token)throw Error('Save your private analysis access token in Settings first.');
   const balance=Number($('eventBalance').value),risk=Number($('eventRisk').value),costs=Number($('eventCosts').value);
   if(!(balance>0)||!(risk>=0.1&&risk<=10)||!(costs>=0))throw Error('Enter a valid balance, risk percentage (0.1–10%) and estimated costs.');
   const charts={};for(const tf of ['H4','H1','M15','M5','M1']){const f=$('eventChart'+tf).files?.[0];if(f)charts[tf]=await readFile(f)}
   if(!Object.keys(charts).length)throw Error('Upload at least one chart screenshot.');
   const evidence=await readFile($('eventEvidence').files?.[0]);
   const type=$('eventType').value,meta={type,name:EVENTS[type].name,releaseDate:$('eventDate').value,releaseTimeEAT:$('eventTime').value,actual:$('eventActual').value,forecast:$('eventForecast').value,previous:$('eventPrevious').value,coreOrSecondary:$('eventCore').value,sourceNotes:$('eventNotes').value,selectedAtUTC:new Date().toISOString(),timeZone:'Africa/Nairobi'};
   setMsg('Sending screenshots securely to the configured AI backend. This uses your Gemini quota…');
   const payload={version:'fx-event-analysis-v1',pair:$('eventPair').value,tradingMode:'auto',accountRisk:{balance,currency:$('eventCurrency').value,riskPercent:risk,estimatedRoundTripCosts:costs},direction:'Undecided / no trade',levels:{},thesis:'Event: '+EVENTS[type].name,invalidation:'Cancel if the event thesis is contradicted, spread/slippage is abnormal, or the trigger fails.',timeframeNotes:{},failedSetups:[],charts,eventTrading:meta,eventEvidence:evidence,context:{analysisTimeUTC:new Date().toISOString(),userTimeZone:'Africa/Nairobi'}};
   const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Analyzer-Token':token},body:JSON.stringify(payload)});
   const out=await res.json().catch(()=>({}));if(!res.ok)throw Error((out.error||'AI backend error')+' (HTTP '+res.status+')');
   const raw=String(out.text||JSON.stringify(out,null,2));$('eventAnalysisResult').textContent=raw;$('eventAnalysisResult').classList.remove('hidden');setMsg('Event analysis complete. Review the conditions, levels and limitations; verify current prices and spreads with your broker.','good');
  }catch(e){setMsg('Analysis failed: '+e.message,'bad')}
  finally{btn.disabled=false;btn.textContent='Analyse this event'}
 };
 document.querySelectorAll('.bottom-nav [data-page]').forEach(b=>{if(b.dataset.page==='eventStrategy')b.onclick=()=>{document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='eventStrategyPage'));document.querySelectorAll('.bottom-nav [data-page]').forEach(x=>x.classList.toggle('active',x===b));window.scrollTo({top:0,behavior:'smooth'})}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();