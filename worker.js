const MAX_BODY_BYTES = 9 * 1024 * 1024;
const ALLOWED_PAIRS = new Set(["EURUSD", "GBPUSD", "USDJPY", "USDCAD", "AUDUSD", "USDCHF", "EURJPY", "XAUUSD", "BTCUSD"]);

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

  // Enforce the EAT trading time lock on the server at screenshot submission time.
  const now = new Date();
  const eatParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(now);
  const eatHour = Number(eatParts.find(part => part.type === "hour")?.value);
  const eatMinute = Number(eatParts.find(part => part.type === "minute")?.value);
  const eatMinutes = eatHour * 60 + eatMinute;
  const eatNow = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi", dateStyle: "full", timeStyle: "long", hour12: false
  }).format(now);

  // Only 10:00–13:00 and 15:00–18:00 EAT are approved.
  if (eatMinutes >= 18 * 60 && eatMinutes < 21 * 60) {
    return json({
      text: "WARNING: NY PM TRAP ZONE. NO TRADE. CLOSE ALL POSITIONS.",
      timeLocked: true,
      serverTimeEAT: eatNow
    }, 200, cors);
  }
  if (eatMinutes >= 21 * 60 || eatMinutes < 10 * 60) {
    return json({
      text: "WARNING: ASIAN SESSION. LOW VOLUME. NO TRADE.",
      timeLocked: true,
      serverTimeEAT: eatNow
    }, 200, cors);
  }
  if (!((eatMinutes >= 10 * 60 && eatMinutes < 13 * 60) ||
        (eatMinutes >= 15 * 60 && eatMinutes < 18 * 60))) {
    return json({
      text: "NO TRADE. OUTSIDE APPROVED EAT WINDOWS. APPROVED WINDOWS: 10:00 AM–1:00 PM AND 3:00 PM–6:00 PM EAT.",
      timeLocked: true,
      serverTimeEAT: eatNow
    }, 200, cors);
  }
  const multi = submitted.length > 1;
  const prompt = [
    "You are an elite multi-timeframe chart analyst specializing in strict Smart Money Concepts (SMC) and Inner Circle Trader (ICT) methodology.",
    "Analyze " + submitted.length + " submitted market(s). Each market has its own H4, H1, M30 and M15 screenshots. Never mix evidence or prices between instruments.",
    "Submitted instruments, in upload order: " + submitted.map(x => x.pair).join(", ") + ".",
    "CURRENT LOCAL TIME: " + eatNow + " (Kenya / Africa-Nairobi, East Africa Time, UTC+3). Use this server-provided time for all timing recommendations.",
    "MULTI-PAIR RANKING: " + (multi ? "Analyze every submitted pair independently. Rank all valid candidates and highlight the strongest three (or fewer if fewer valid candidates exist), using confirmed HTF Bias, FVG, BOS/CHoCH and Liquidity Sweep confluence. Name Best Pair (Rank 1). Never promote an invalid setup above a valid one. If none qualifies, say NO VALID TRADE for that pair." : "Only one pair was submitted. Analyze it alone as Best Pair (Rank 1); do not invent comparisons or imply other pairs were scanned."),
    "HARD TIME LOCK: The server has already blocked every screenshot submission outside 10:00 AM–1:00 PM EAT and 3:00 PM–6:00 PM EAT. Never recommend, validate, or label a trade outside those exact windows. These windows apply to every instrument.",
    "TIME LOCK WARNINGS: 6:00 PM–9:00 PM EAT must output exactly: WARNING: NY PM TRAP ZONE. NO TRADE. CLOSE ALL POSITIONS. 9:00 PM–10:00 AM EAT must output exactly: WARNING: ASIAN SESSION. LOW VOLUME. NO TRADE. 1:00 PM–3:00 PM EAT is also NO TRADE because it is outside the approved windows.",
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
    "LONG SETUPS: The user has specified exact anchoring rules for SHORT setups only. Do not mirror, invent, or assume LONG anchor rules. If a LONG setup is detected, do not issue a fully priced trade plan unless its LONG SL/TP anchors are explicitly defined by the user; report that LONG anchoring rules are not configured.",
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/analyze") return handleAnalyze(request, env);
    return env.ASSETS.fetch(request);
  }
};
