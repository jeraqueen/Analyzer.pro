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

  // Evaluate each market session in its own IANA timezone.
  // Intl automatically applies the correct UK/US daylight-saving rules.
  const getHourInTZ = (timeZone) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone,
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());
    return Number(parts.find(part => part.type === "hour")?.value);
  };

  const now = new Date();
  const londonHour = getHourInTZ("Europe/London");
  const nyHour = getHourInTZ("America/New_York");
  const eatHour = getHourInTZ("Africa/Nairobi");
  const eatNow = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi", dateStyle: "full", timeStyle: "long", hour12: false
  }).format(now);

  // Killzones: 8:00 AM–11:00 AM in each market's local timezone.
  const isLondonKillzone = londonHour >= 8 && londonHour < 11;
  const isNYKillzone = nyHour >= 8 && nyHour < 11;

  // No-trade zones, also evaluated using the relevant local timezone.
  const isNYPmTrap = nyHour >= 11 && nyHour < 14;
  const isAsianSession = londonHour >= 23 || londonHour < 7;

  // Only the London and New York morning killzones permit submissions.
  if (isNYPmTrap) {
    return json({
      text: "WARNING: NY PM TRAP ZONE (11:00 AM–2:00 PM New York time). NO TRADE. CLOSE ALL POSITIONS.",
      timeLocked: true,
      serverTimeEAT: eatNow
    }, 200, cors);
  }
  if (isAsianSession) {
    return json({
      text: "WARNING: ASIAN SESSION (11:00 PM–7:00 AM London time). LOW VOLUME. NO TRADE.",
      timeLocked: true,
      serverTimeEAT: eatNow
    }, 200, cors);
  }
  if (!isLondonKillzone && !isNYKillzone) {
    return json({
      text: "NO TRADE. OUTSIDE APPROVED KILLZONES. APPROVED WINDOWS: 8:00 AM–11:00 AM LONDON TIME OR 8:00 AM–11:00 AM NEW YORK TIME. Session times adjust automatically for daylight saving time. Server time: " + eatNow + " (EAT).",
      timeLocked: true,
      serverTimeEAT: eatNow
    }, 200, cors);
  }
  const multi = submitted.length > 1;
  const priorTradeContext = typeof payload.tradeContext === "string" ? payload.tradeContext.trim().slice(0, 30000) : "";
  const prompt = [
    ...(priorTradeContext ? [
      "PREVIOUS ANALYSIS MEMORY: The following text is the prior analysis from the user's previous screenshot scan. Treat it as historical context, not as verified current market evidence.",
      priorTradeContext,
      "Compare the NEW screenshots in this request with the previous analysis. Based on the new chart evidence, clearly tell the user whether to HOLD or CLOSE the active trade. If there is not enough evidence to make that assessment, state what is missing and do not invent an active position."
    ] : []),
    "You are an elite multi-timeframe chart analyst specializing in strict Smart Money Concepts (SMC) and Inner Circle Trader (ICT) methodology.",
    "Analyze " + submitted.length + " submitted market(s). Each market has its own H4, H1, M30 and M15 screenshots. Never mix evidence or prices between instruments.",
    "Submitted instruments, in upload order: " + submitted.map(x => x.pair).join(", ") + ".",
    "CURRENT LOCAL TIME: " + eatNow + " (Kenya / Africa-Nairobi, East Africa Time, UTC+3). Use this server-provided time for all timing recommendations.",
    "AUTHORITATIVE SESSION DECISION (SERVER-CALCULATED): London local hour is " + londonHour + ", New York local hour is " + nyHour + ", and Kenya local hour is " + eatHour + ". isLondonKillzone=" + isLondonKillzone + "; isNYKillzone=" + isNYKillzone + "; isNYPmTrap=" + isNYPmTrap + "; isAsianSession=" + isAsianSession + ". These booleans are the final authority. If isLondonKillzone or isNYKillzone is true, explicitly report the corresponding killzone ACTIVE and NEVER say it is outside the killzone. Do not apply London clock hours directly to EAT. Do not tell the user to close an existing position solely because a session window is ending; assess the actual chart structure and risk evidence. The server has already blocked submissions when the time lock is genuinely closed.",
    "MANDATORY TABLE CONSISTENCY: Populate the MARKET RANKING & CONTEXT table from the server values above, not from chart interpretation. If isLondonKillzone=true, every pair row must show Execution Window=8:00 AM–11:00 AM London local time and Current Time Status=ACTIVE (London); if isNYKillzone=true, show 8:00 AM–11:00 AM New York local time and ACTIVE (New York). If both are true, report both. Only show OUTSIDE WINDOW when BOTH booleans are false. Pair validity (VALID TRADE / NO VALID TRADE) is a separate chart-setup decision and must never change the session status. At the report time 12:05 PM EAT with London local time 9:05 AM, London is ACTIVE. Do not label pairs OUTSIDE WINDOW in that situation.",
    "MULTI-PAIR RANKING: " + (multi ? "Analyze every submitted pair independently. Rank all valid candidates and highlight the strongest three (or fewer if fewer valid candidates exist), using confirmed HTF Bias, FVG, BOS/CHoCH and Liquidity Sweep confluence. Name Best Pair (Rank 1). Never promote an invalid setup above a valid one. If none qualifies, say NO VALID TRADE for that pair." : "Only one pair was submitted. Analyze it alone as Best Pair (Rank 1); do not invent comparisons or imply other pairs were scanned."),
    "HARD TIME LOCK: The server has already blocked every screenshot submission outside the 8:00 AM–11:00 AM London local-time killzone or the 8:00 AM–11:00 AM New York local-time killzone. These are evaluated independently with Europe/London and America/New_York IANA timezones, so UK and US daylight-saving changes are applied automatically even on different dates. Never recommend, validate, or label a trade outside these killzones. Kenya time is displayed for the user but is not used to calculate the trading windows.",
    "TIME LOCK WARNINGS: When New York local time is 11:00 AM–2:00 PM, the server returns the NY PM Trap warning and blocks the submission. When London local time is 11:00 PM–7:00 AM, the server returns the Asian Session warning and blocks the submission. All other times outside either approved 8:00 AM–11:00 AM local killzone are NO TRADE. These windows automatically follow each timezone's daylight-saving calendar.",
    "The time lock is evaluated by the server using Africa/Nairobi time at the moment the screenshots are submitted. Never trust the device clock or a timestamp inside the screenshot.",
    "For each pair, report H4/H1 bias, M30 setup, M15 trigger, entry, SL, TP1/TP2/TP3, invalidation, evidence score and reasons not to take it. Use exact section headings and clearly label each pair.",
    "STRICT EVIDENCE: Never invent, estimate, interpolate, round or assume prices. Use only exact prices clearly readable on chart scale or directly labelled; preserve every visible decimal. Distinguish wick extremes from candle bodies. If prices or screenshots are blurry, cropped, inconsistent or lack a readable scale, do not produce a trade plan.",
    "Never use psychological round numbers as Entry, SL or TP unless the exact chart evidence itself makes that level defensible. Do not use FVG midpoint by default. Use an evidenced FVG boundary, order-block wick, breaker or reaction level.",
    "A valid trade requires clear H4/H1 directional bias AND either confirmed BOS/CHoCH or a confirmed supporting liquidity sweep. If mandatory evidence is missing, state exactly: NO VALID TRADE — insufficient confirmation.",
    "STRICT CONSISTENCY & WICK ANCHORING RULES — THESE RULES REPLACE AND OVERRIDE ALL OLDER ATR, FIBONACCI, STRUCTURAL-BUFFER, OTE-ENTRY AND CALCULATED-TARGET RULES. Do not calculate ATR or Fibonacci. Do not use ATR or Fibonacci to set or adjust any Entry, SL or TP.",
    "REPEATABILITY / NO GUESSING: Analyze the same uploaded chart pixels consistently. If the same screenshots are submitted again, reproduce the same price readings and levels; do not choose a new swing, reinterpret the setup, or change a price without new chart evidence. Use temperature 0. Never invent, estimate, interpolate between axis labels, round, normalize, or silently alter a price. Read prices from the right-side price axis and preserve the exact displayed precision. If the exact wick price cannot be read unambiguously from the visible axis/price label, state that it is unreadable and reject the trade plan rather than guessing.",
    "SHORT STOP-LOSS ANCHOR (MANDATORY): Identify the exact M30 swing high whose wick created the relevant bearish FVG. Find the absolute highest wick of that specific M30 swing high. The SHORT stop loss must be placed exactly 1 to 2 pips/points above that wick, using the instrument's displayed pip/point convention. State the exact M30 wick price, the exact buffer amount and unit, and the resulting SL. Use M30 only for this anchor. Do not use H4 or H1 wicks, candle bodies, ATR, arbitrary buffers, or any other timeframe for the SHORT SL. If the FVG-creating M30 swing high or its highest wick cannot be identified and priced exactly, reject the setup.",
    "SHORT TAKE-PROFIT ANCHORS (MANDATORY): TP1 must equal the exact wick price of the most recent M15 swing low. TP2 must equal the exact wick price of the previous major H1 swing low. Do not use candle-body closes, nearby liquidity estimates, session levels, PDH/PDL, Fibonacci projections, round numbers, or calculated substitutes. State the timeframe and identify each anchored swing. If either exact wick price is not unambiguously readable, mark that target unavailable and reject the complete trade plan; do not substitute another level.",
    "PRICE PRECISION: Read exact values from the right-hand price axis. Preserve every visible decimal/digit. Do not round up or down, add hidden precision, or infer a wick price by interpolating between axis ticks. If the screenshot resolution or axis labels do not support an exact reading, report 'EXACT WICK PRICE UNREADABLE — NO VALID TRADE'.",
    "NO RECALCULATION: Do not calculate, recalculate, or mention ATR(14), Fibonacci retracements/extensions, OTE zones, or derived target projections unless the user explicitly asks for those calculations in a later request. These methods must not override or modify the specified M30/M15/H1 wick anchors.",
    "LONG SETUPS: Mirror the short setup logic perfectly. Identify the exact M30 swing low whose wick created the bullish FVG. The LONG stop loss must be placed exactly 1 to 2 pips/points BELOW that wick. TP1 must equal the exact wick price of the most recent M15 swing HIGH. TP2 must equal the exact wick price of the previous major H1 swing HIGH.",
    "RISK CHECK: You may calculate the displayed risk/reward ratio only after all required exact wick prices and the short SL buffer are unambiguously established. If any required anchor is unreadable or uncertain, reject the setup; a confluence score cannot override missing exact price evidence.",
    "Current price only if visible in screenshots. No live market data claims. No broker execution, continuous monitoring, watchdog, order placement, position closure or pending-order cancellation claims.",
    "Add a final section titled '### MARKET RANKING & CONTEXT (KENYA TIME — EAT)' with a compact table: Best Pair; Pair Ranking; Execution Window; Current Time Status. Then provide per-pair analysis sections.",
    "For every valid pair include: Chart Breakdown (H4/H1/M30/M15), HTF Bias, Best Setup, Trade Plan (Direction, Entry Zone, Trigger, SL, TP1, TP2, TP3, Invalidation), Confluence Score /10, What Would Make Me Not Take This Trade, and Final Answer table.",
    "H1 invalidation is a proposed rule only: LONG invalidates on H1 close below invalidation price; SHORT invalidates on H1 close above. Wick alone is not a close. Do not claim a watchdog is active.",
    "At the very end, compare visible current price with entry zone for the Best Pair. If not visible, say so and identify the required zone. A confluence score is evidence rating, not win probability. Do not promise profit."
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

  const model = env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const aiRequestBody = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0, maxOutputTokens: 5000 }
  });
  const maxAttempts = 3;
  let lastStatus = 0;
  let lastError = "The AI service could not complete the request.";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500 * (2 ** (attempt - 1))));
        continue;
      }
      console.error("Gemini request failed", JSON.stringify({ model, attempt, status: 0, reason: "network_error" }));
      return json({ error: "Gemini could not be reached after 3 attempts. Please try again shortly.", code: "UPSTREAM_NETWORK_ERROR", retryable: true }, 502, cors);
    }
    if (!response.ok) {
      lastStatus = response.status;
      lastError = result?.error?.message || `Gemini API returned HTTP ${response.status}`;
      const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
      console.error("Gemini API returned an error", JSON.stringify({ model, attempt, status: response.status, retryable, message: String(lastError).slice(0, 300) }));
      if (retryable && attempt < maxAttempts) {
        const retryAfter = Number(response.headers.get("Retry-After") || 0);
        const delayMs = retryAfter > 0 ? Math.min(retryAfter * 1000, 8000) : 500 * (2 ** (attempt - 1));
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      const status = response.status === 429 ? 429 : response.status === 401 || response.status === 403 ? response.status : 502;
      const code = response.status === 429 ? "GEMINI_RATE_LIMIT" : response.status === 503 ? "GEMINI_OVERLOADED" : response.status === 401 || response.status === 403 ? "GEMINI_AUTH_ERROR" : `GEMINI_HTTP_${response.status}`;
      return json({ error: lastError, code, upstreamStatus: response.status, retryable }, status, cors);
    }
    const analysis = (result.candidates?.[0]?.content?.parts || [])
      .map(part => typeof part.text === "string" ? part.text : "")
      .filter(Boolean)
      .join("\n").trim();
    if (!analysis) {
      const finishReason = result?.candidates?.[0]?.finishReason || "UNKNOWN";
      console.error("Gemini returned no readable analysis", JSON.stringify({ model, attempt, status: response.status, finishReason }));
      return json({ error: "Gemini returned no readable analysis. Please retry; no trade plan was produced.", code: "EMPTY_AI_RESPONSE", retryable: true }, 502, cors);
    }
    return json({ text: analysis, model, provider: "Google Gemini" }, 200, cors);
  }
  console.error("Gemini request exhausted retries", JSON.stringify({ model, attempts: maxAttempts, upstreamStatus: lastStatus, reason: String(lastError).slice(0, 300) }));
  return json({ error: "Gemini is temporarily unavailable after 3 attempts. No trade plan was produced; please try again shortly.", code: "GEMINI_TEMPORARILY_UNAVAILABLE", upstreamStatus: lastStatus || undefined, retryable: true }, 502, cors);
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
    if (url.pathname === "/api/push-config" && request.method === "GET") {
      return json({ appId: env.ONESIGNAL_APP_ID || null, ready: Boolean(env.ONESIGNAL_APP_ID && env.ONESIGNAL_REST_API_KEY) });
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(controller, env) {
    await sendSessionReminder(env, controller.scheduledTime);
  }
};
