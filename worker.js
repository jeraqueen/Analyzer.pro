const MAX_BODY_BYTES = 9 * 1024 * 1024;
const ALLOWED_PAIRS = new Set(["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD"]);

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
  const balance = Number(payload.balance ?? 100);
  const risk = Number(payload.risk ?? 1);
  if (!Number.isFinite(balance) || balance <= 0) return json({ error: "Account balance must be a number greater than zero." }, 400, cors);
  if (!Number.isFinite(risk) || risk <= 0 || risk > 100) return json({ error: "Risk per trade must be greater than 0 and no more than 100 percent." }, 400, cors);
  const timeframes = ["H4", "H1", "M30", "M15"];
  // Accept the new multi-pair format and the previous single-pair format.
  const submitted = Array.isArray(payload.pairs) ? payload.pairs : [{ pair: payload.pair || "EURUSD", charts: payload.charts || {} }];
  if (!submitted.length || submitted.length > 3) return json({ error: "Submit between one and three markets per scan." }, 400, cors);
  const seen = new Set();
  for (const item of submitted) {
    item.pair = String(item.pair || "").toUpperCase();
    if (!ALLOWED_PAIRS.has(item.pair)) return json({ error: "Unsupported instrument: " + item.pair }, 400, cors);
    if (seen.has(item.pair)) return json({ error: "Choose each instrument only once per scan." }, 400, cors);
    seen.add(item.pair);
    item.charts = item.charts && typeof item.charts === "object" ? item.charts : {};
    const missing = timeframes.filter(tf => typeof item.charts[tf] !== "string");
    if (missing.length) return json({ error: item.pair + " is missing screenshots: " + missing.join(", ") }, 400, cors);
  }

  // Evaluate each killzone directly in its own market timezone.
  // Never compare London hours directly with Kenya hours.
  // Intl/IANA timezone data applies UK and US daylight-saving changes automatically.
  const getZonedParts = (timeZone, date = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(date);
    return {
      hour: Number(parts.find(part => part.type === "hour")?.value),
      minute: Number(parts.find(part => part.type === "minute")?.value)
    };
  };
  const toMinutes = clock => clock.hour * 60 + clock.minute;
  const now = new Date();
  const londonClock = getZonedParts("Europe/London", now);
  const nyClock = getZonedParts("America/New_York", now);
  const eatClock = getZonedParts("Africa/Nairobi", now);
  const londonMinutes = toMinutes(londonClock);
  const nyMinutes = toMinutes(nyClock);
  const eatMinutes = toMinutes(eatClock);
  const londonHour = londonClock.hour;
  const nyHour = nyClock.hour;
  const eatHour = eatClock.hour;
  const eatNow = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi", dateStyle: "full", timeStyle: "long", hour12: false
  }).format(now);
  const clockText = clock => String(clock.hour).padStart(2, "0") + ":" + String(clock.minute).padStart(2, "0");
  const inWindow = (minute, start, end) => minute >= start && minute < end;

  // Check each source-market 08:00–11:00 window independently.
  // Either active killzone permits analysis (logical OR).
  const isLondonKillzone = inWindow(londonMinutes, 8 * 60, 11 * 60);
  const isNYKillzone = inWindow(nyMinutes, 8 * 60, 11 * 60);

  // Calculate the equivalent EAT windows for diagnostics and display only.
  const londonToEatOffset = (eatMinutes - londonMinutes + 1440) % 1440;
  const nyToEatOffset = (eatMinutes - nyMinutes + 1440) % 1440;
  const formatMinute = minute => String(Math.floor(minute / 60) % 24).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0");
  const londonStartEAT = (8 * 60 + londonToEatOffset) % 1440;
  const londonEndEAT = (11 * 60 + londonToEatOffset) % 1440;
  const nyStartEAT = (8 * 60 + nyToEatOffset) % 1440;
  const nyEndEAT = (11 * 60 + nyToEatOffset) % 1440;
  const londonWindowEAT = formatMinute(londonStartEAT) + "–" + formatMinute(londonEndEAT) + " EAT";
  const nyWindowEAT = formatMinute(nyStartEAT) + "–" + formatMinute(nyEndEAT) + " EAT";

  // Retained as false compatibility flags for the existing analysis prompt.
  // No extra NY-evening or Asian session is enabled by these flags.
  const isNYPmTrap = false;
  const isAsianSession = false;

  // Only block when BOTH approved market-local killzones are closed.
  if (!isLondonKillzone && !isNYKillzone) {
    return json({
      text: "NO TRADE. OUTSIDE APPROVED KILLZONES. APPROVED WINDOWS: 8:00 AM–11:00 AM LONDON LOCAL TIME (" + londonWindowEAT + ") OR 8:00 AM–11:00 AM NEW YORK LOCAL TIME (" + nyWindowEAT + "). London now: " + clockText(londonClock) + "; New York now: " + clockText(nyClock) + "; Kenya now: " + clockText(eatClock) + " EAT. Session times adjust automatically for daylight saving time. Server time: " + eatNow + " (EAT).",
      timeLocked: true,
      serverTimeEAT: eatNow,
      sessionStatus: {
        london: "CLOSED", newYork: "CLOSED",
        londonTime: clockText(londonClock), newYorkTime: clockText(nyClock),
        kenyaTime: clockText(eatClock), londonWindowEAT, newYorkWindowEAT: nyWindowEAT
      }
    }, 200, cors);
  }
  const multi = submitted.length > 1;
  const prompt = [
    `EXECUTION DATA CONTRACT: Only when a setup is fully CONFIRMED and exact numeric values are readable for Entry, SL, TP1, TP2 and TP3, append one single-line JSON record at the very end in this exact format: EXECUTION_DATA: {"confirmed":true,"symbol":"EURUSD","direction":"LONG","entry":1.1,"sl":1.09,"tp1":1.11,"tp2":1.12,"tp3":1.13}. Use the exact submitted symbol code without a slash. Use numeric prices, not strings. Direction must be LONG or SHORT. If the setup is not confirmed, any price is unreadable, or any of the three targets is unavailable, do not output EXECUTION_DATA.`,
  
    "TRADE MANAGEMENT DISABLED: Do not attempt to tell the user to HOLD or CLOSE an active trade. You do not have live tick data. Simply analyze the new screenshots as a fresh setup and provide new Entry, SL, and TP levels.",
    "You are an elite multi-timeframe chart analyst specializing in strict Smart Money Concepts (SMC) and Inner Circle Trader (ICT) methodology.",
    "Analyze " + submitted.length + " submitted market(s). Each market has its own H4, H1, M30 and M15 screenshots. Never mix evidence or prices between instruments.",
    "Submitted instruments, in upload order: " + submitted.map(x => x.pair).join(", ") + ".",
    "CURRENT LOCAL TIME: " + eatNow + " (Kenya / Africa-Nairobi, East Africa Time, UTC+3). Use this server-provided time for all timing recommendations.",
    "AUTHORITATIVE SESSION DECISION (SERVER-CALCULATED): London local hour is " + londonHour + ", New York local hour is " + nyHour + ", and Kenya local hour is " + eatHour + ". isLondonKillzone=" + isLondonKillzone + "; isNYKillzone=" + isNYKillzone + "; isNYPmTrap=" + isNYPmTrap + "; isAsianSession=" + isAsianSession + ". These booleans are calculated by converting London and New York local windows into their equivalent Kenya EAT windows; all entry time-lock decisions are evaluated using the current Kenya EAT minutes. If isLondonKillzone or isNYKillzone is true, explicitly report the corresponding killzone ACTIVE and NEVER say it is outside the killzone. Always display both the source-market local window and its converted Kenya EAT window. Do not tell the user to close an existing position solely because a session window is ending; assess the actual chart structure and risk evidence. The server has already blocked submissions when the time lock is genuinely closed.",
    "MANDATORY TABLE CONSISTENCY: Populate the MARKET RANKING & CONTEXT table from the server values above, not from chart interpretation. If isLondonKillzone=true, every pair row must show Execution Window=8:00 AM–11:00 AM London local time and Current Time Status=ACTIVE (London); if isNYKillzone=true, show 8:00 AM–11:00 AM New York local time and ACTIVE (New York). If both are true, report both. Only show OUTSIDE WINDOW when BOTH booleans are false. Pair validity (VALID TRADE / NO VALID TRADE) is a separate chart-setup decision and must never change the session status. At the report time 12:05 PM EAT with London local time 9:05 AM, London is ACTIVE. Do not label pairs OUTSIDE WINDOW in that situation.",
    "MULTI-PAIR RANKING: " + (multi ? "Analyze every submitted pair independently. Rank all valid candidates and highlight the strongest three (or fewer if fewer valid candidates exist), using confirmed HTF Bias, FVG, BOS/CHoCH and Liquidity Sweep confluence. Name Best Pair (Rank 1). Never promote an invalid setup above a valid one. If none qualifies, say NO VALID TRADE for that pair." : "Only one pair was submitted. Analyze it alone as Best Pair (Rank 1); do not invent comparisons or imply other pairs were scanned."),
    "HARD TIME LOCK: The server has already blocked every screenshot submission outside the 8:00 AM–11:00 AM London local-time killzone or the 8:00 AM–11:00 AM New York local-time killzone. The server converts both windows into their current Kenya EAT equivalents using live Europe/London, America/New_York and Africa/Nairobi timezone data. During UK winter, London 8:00–11:00 AM is 11:00 AM–2:00 PM EAT. During US winter, New York 8:00–11:00 AM is 4:00–7:00 PM EAT. The offsets shift automatically when either country changes daylight-saving time. All entry time-lock decisions use Kenya EAT minutes. Never recommend, validate, or label a trade outside these converted windows.",
    "TIME LOCK WARNINGS: When New York local time is 11:00 AM–2:00 PM, the server returns the NY PM Trap warning and blocks the submission. During US winter this trap is 7:00–10:00 PM EAT; its Kenya equivalent shifts automatically with US daylight-saving time. When London local time is 11:00 PM–7:00 AM, the server returns the Asian Session warning and blocks the submission. All other times outside the approved London or New York 8:00–11:00 AM local killzones are NO TRADE.",
    "The time lock is evaluated by the server using Africa/Nairobi local time at the moment screenshots are submitted, after converting the London and New York source-market windows into Kenya EAT using live IANA timezone offsets. In US winter the New York entry window is 4:00–7:00 PM EAT, with the 8:30 AM New York screenshot at 4:30 PM EAT. Never trust the device clock or a timestamp inside the screenshot.",
    "For each pair, report H4/H1 bias, M30 setup, M15 trigger, entry, SL, TP1/TP2/TP3, invalidation, evidence score and reasons not to take it. Use exact section headings and clearly label each pair.",
    "STRICT EVIDENCE: Never invent, estimate, interpolate, round or assume prices. Use only exact prices clearly readable on chart scale or directly labelled; preserve every visible decimal. Distinguish wick extremes from candle bodies. If prices or screenshots are blurry, cropped, inconsistent or lack a readable scale, do not produce a trade plan.",
    "Never use psychological round numbers as Entry, SL or TP unless the exact chart evidence itself makes that level defensible. Do not use FVG midpoint by default. Use an evidenced FVG boundary, order-block wick, breaker or reaction level.",
    "A valid trade requires clear H4/H1 directional bias AND either confirmed BOS/CHoCH or a confirmed supporting liquidity sweep. If mandatory evidence is missing, state exactly: NO VALID TRADE — insufficient confirmation.",
    "ENTRY EXECUTION: You must ONLY provide a Pending Limit Order price at a Fair Value Gap (FVG) or Order Block boundary. NEVER recommend a market entry. The price must pull back into the zone before entry.",
    "TRIGGER CONFIRMATION: The user must not enter the trade immediately when the price touches the limit order. The user must wait for an M15 candle to close inside the FVG before the trade is considered valid.",
    "Set targets at visible opposing liquidity pools such as recent swing highs/lows or equal highs/lows. Do not require every target to be an exact pre-labelled wick price; if a level cannot be read, label that target unavailable rather than rejecting an otherwise valid setup solely for that reason.",
    "REPEATABILITY / NO GUESSING: Analyze the same uploaded chart pixels consistently. If the same screenshots are submitted again, reproduce the same price readings and levels; do not choose a new swing, reinterpret the setup, or change a price without new chart evidence. Use temperature 0. Never invent, estimate, interpolate between axis labels, round, normalize, or silently alter a price. Read prices from the right-side price axis and preserve the exact displayed precision. If the exact wick price cannot be read unambiguously from the visible axis/price label, state that it is unreadable and reject the trade plan rather than guessing.",
    "STRUCTURAL STOP LOSS: The Stop Loss MUST be placed exactly 1-2 pips outside the true structural swing wick (M30 or H1) that created the setup. Do not artificially tighten the Stop Loss. If the structural stop loss is wide (e.g., 100 pips), keep it wide. To protect a small account, the bot must calculate a micro lot size (e.g., 0.01 or 0.001). If the account is too small to afford the structural Stop Loss even at minimum lot size, output: 'WARNING: Stop Loss is too wide for your balance. Do not trade. Wait for a tighter setup.' State the structural timeframe, swing wick, buffer and exact entry-to-stop distance. For instruments whose broker point/pip convention is not known, do not invent a pip conversion; report the raw price distance and state that pip distance is not verifiable.",
    "TAKE PROFITS: Select TP1, TP2 and TP3 from successive visible opposing liquidity pools, prioritizing the nearest reasonable pool first. Identify the timeframe and type of liquidity for each target. If a target is not clearly visible, mark it unavailable; do not substitute a guessed price.",
    "PRICE PRECISION: Preserve every clearly readable decimal from the chart. Never round, interpolate, invent or infer hidden precision. If a required entry or stop price is unreadable, state that clearly and withhold the numeric order level while still explaining the setup evidence and missing data.",
    "ATR(14) may be used as supporting volatility context only when visible/readable or reliably calculable from clearly readable candle OHLC data. Never invent an ATR value. Missing ATR does not invalidate an otherwise confirmed market-structure setup.",
    "LONG/SHORT SYMMETRY: Apply the same evidence standard to both directions. For longs, use bullish structure and opposing buy-side liquidity targets; for shorts, use bearish structure and opposing sell-side liquidity targets. Stop placement must be beyond the relevant structural invalidation point.",
    "RISK CHECK: Show risk/reward only when entry, stop and target prices are sufficiently clear. Separate setup validity from price-measurement quality: a chart may show a valid developing/confirmed setup while exact prices remain unavailable.",
    "NO-ENTRY DIAGNOSTICS (MANDATORY): Never return only NONE or a generic NO VALID TRADE. For EVERY submitted pair, include a compact diagnostic row with: Pair; Setup Stage (NO SETUP / DEVELOPING / WATCH / CONFIRMED); Confirmed Evidence; Missing Confirmation(s); Timeframe where each missing item is needed; and the specific observable event that would change the stage. Name the actual evidence found or missing (H4/H1 bias, BOS, CHoCH, liquidity sweep, displacement, FVG, order block, retracement, or M15 trigger). Do not list an item as missing if it is visibly confirmed. A pair may be in an ACTIVE session while its setup stage is NO SETUP or DEVELOPING. Keep WAIT — NO ENTRY when the required confirmation is absent; never manufacture a trade to avoid a no-trade result.",
    "TRADE MANAGEMENT DISABLED: Do not assess existing positions and do not issue HOLD, CLOSE, EXIT, or position-management instructions. Analyze only the newly submitted screenshots as a fresh setup. Never claim to see broker positions or execute/close orders.",
    "Current price only if visible in screenshots. No live market data claims. No broker execution, continuous monitoring, watchdog, order placement, position closure or pending-order cancellation claims.",
    "REQUIRED REPORT COMPLETENESS — OVERRIDES ANY SHORT SUMMARY: You MUST analyze and name EVERY instrument in the submitted list, even when there is no trade. Never output only the ranking table. Output in this exact order: (1) MARKET RANKING & CONTEXT table with one row per submitted pair and its exact instrument name; (2) PAIR-BY-PAIR DIAGNOSTICS table with one row per submitted pair and columns Pair, H4 Bias, H1 Bias, M30 Structure, M15 Trigger, Confirmed Evidence, Missing Confirmation, Required Timeframe, Setup Stage, Next Observable Trigger; (3) a separate short analysis section for EACH submitted pair explaining the chart evidence and why it is or is not tradable. If a chart feature or price cannot be read, write NOT READABLE and say which screenshot/timeframe is unclear; do not replace the whole analysis with NONE. If there are zero valid trades, Best Pair must be NONE, but every submitted pair still needs its own diagnostic row and explanation. Never omit a pair. Never say only generic NO VALID TRADE without naming the missing evidence. Do not fabricate pair names or chart observations.",
    "For every valid pair include: Chart Breakdown (H4/H1/M30/M15), HTF Bias, Best Setup, Trade Plan (Direction, Entry Zone, Trigger, SL, TP1, TP2, TP3, Invalidation), Confluence Score /10, What Would Make Me Not Take This Trade, and Final Answer table.",
    "H1 invalidation is a proposed rule only: LONG invalidates on H1 close below invalidation price; SHORT invalidates on H1 close above. Wick alone is not a close. Do not claim a watchdog is active.",
    "At the very end, compare visible current price with entry zone for the Best Pair. If not visible, say so and identify the required zone. A confluence score is evidence rating, not win probability. Do not promise profit.",
    `RISK MANAGEMENT ENGINE: 
  The user has an account balance of ${balance} and a risk tolerance of ${risk}%.
  Calculate the exact Stop Loss distance in pips.
  Calculate the Risk Amount = Balance * (Risk / 100).
  Calculate Recommended Lot Size = Risk Amount / (Stop Loss Distance * Pip Value).

  OUTPUT RULES:
  - Provide a trade plan only when the setup is confirmed and exact structural Entry/SL levels are readable. Do not reject a valid setup merely because the stop is wide; size the position down to a broker-supported micro lot.
  - Add a new row to the Final Table: 'Recommended Lot Size' (e.g., 0.001, 0.01, 0.10).
  - Add a new row to the Final Table: 'Max Allowed Loss ($)'.
  - If the calculated risk cannot be kept within the selected risk amount at the broker's minimum supported lot size, output exactly: 'WARNING: Stop Loss is too wide for your balance. Do not trade. Wait for a tighter setup.'
  - This risk engine must NEVER turn an unconfirmed or invalid chart into a trade. If chart evidence does not confirm a valid setup or exact Entry/SL cannot be read, retain NO VALID TRADE / WAIT — NO ENTRY and explain why; account size is not a reason to reject a valid setup.
  - Risk Amount is the maximum planned loss before fees, slippage and gaps; display it as Max Allowed Loss ($).
  - Determine pip size and pip value for the exact submitted instrument and the broker's contract convention. For non-FX instruments such as XAUUSD and BTCUSD, do not assume a forex pip or a universal contract size. If the broker's contract size, tick value or pip value is not supplied or cannot be reliably derived from chart metadata, state PIP VALUE / LOT SIZE NOT VERIFIABLE and do not invent a lot size.
  - For USD-quoted FX pairs, use the appropriate standard-lot pip value only when the account currency and contract convention support it. For cross-currency pairs, convert pip value to USD using a supported conversion rate; if unavailable, state that exact sizing cannot be verified.
  - Respect the broker's lot step and minimum volume when known. Do not round a calculated size upward; round down to the valid lot step so the planned loss does not exceed the selected risk amount. Never assume a Cent Account contract specification or minimum lot size; use only the broker's verified contract specifications.
  - Show the calculation: balance, risk %, risk amount, stop distance in pips, pip value per standard lot, raw lot size and rounded executable lot size. If any input is unavailable, label it unavailable instead of fabricating a precise result.
  
  STRUCTURAL STOP LOSS: The Stop Loss MUST be placed exactly 1-2 pips outside the true structural swing wick (M30 or H1) that created the setup. Do not artificially tighten the Stop Loss. If the structural stop loss is wide (e.g., 100 pips), keep it wide. To protect a small account, the bot must calculate a micro lot size (e.g., 0.01 or 0.001). If the account is too small to afford the structural Stop Loss even at minimum lot size, output: 'WARNING: Stop Loss is too wide for your balance. Do not trade. Wait for a tighter setup.'`
  ].join("\n");

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
  const models = [...new Set([primaryModel, "gemini-3.5-flash-lite", "gemini-3.8-flash"])];
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

function getZonedClock(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date).reduce((out, part) => (out[part.type] = part.value, out), {});
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) };
}

async function sendSessionReminder(env, scheduledTime) {
  if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_REST_API_KEY) {
    console.error("Session reminder skipped: OneSignal app ID or REST API key is not configured.");
    return;
  }
  const now = new Date(scheduledTime || Date.now());
  const london = getZonedClock("Europe/London", now);
  const newYork = getZonedClock("America/New_York", now);
  const candidates = [
    { local: london, market: "London" },
    { local: newYork, market: "New York" }
  ];
  const due = [];
  for (const item of candidates) {
    if (item.local.hour === 8 && item.local.minute === 25) {
      due.push({ title: "Analyzer Pro · " + item.market + " reminder", message: "Five minutes until the 8:30 AM " + item.market + " screenshot session. Prepare your charts now." });
    }
    if (item.local.hour === 8 && item.local.minute === 30) {
      due.push({ title: "Analyzer Pro · " + item.market + " screenshot time", message: "It is 8:30 AM " + item.market + " local time. Capture your charts now. Kenya time is adjusted automatically for daylight saving." });
    }
  }
  if (!due.length) return;
  const appUrl = env.PUBLIC_APP_URL || "https://analyzer-pro.fx77.workers.dev";
  for (const alert of due) {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Authorization": "Key " + env.ONESIGNAL_REST_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        app_id: env.ONESIGNAL_APP_ID,
        included_segments: ["All"],
        headings: { en: alert.title },
        contents: { en: alert.message },
        web_url: appUrl + "/#timers"
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("OneSignal reminder send failed", JSON.stringify({ market: alert.title, status: response.status, response: JSON.stringify(result).slice(0, 500) }));
      throw new Error("OneSignal reminder failed with HTTP " + response.status);
    }
    console.log("OneSignal reminder sent", JSON.stringify({ market: alert.title, notificationId: result.id || null }));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/analyze") return handleAnalyze(request, env);
    if (url.pathname === "/api/execute-trade") return handleExecuteTrade(request, env);
    if (url.pathname === "/api/push-config" && request.method === "GET") {
      return json({ appId: env.ONESIGNAL_APP_ID || null, ready: Boolean(env.ONESIGNAL_APP_ID && env.ONESIGNAL_REST_API_KEY) });
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(controller, env) {
    await sendSessionReminder(env, controller.scheduledTime);
  }
};
