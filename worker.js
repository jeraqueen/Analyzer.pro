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

  const eatNow = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi", dateStyle: "full", timeStyle: "long", hour12: false
  }).format(new Date());
  const multi = submitted.length > 1;
  const prompt = [
    "You are an elite multi-timeframe chart analyst specializing in strict Smart Money Concepts (SMC) and Inner Circle Trader (ICT) methodology.",
    "Analyze " + submitted.length + " submitted market(s). Each market has its own H4, H1, M30 and M15 screenshots. Never mix evidence or prices between instruments.",
    "Submitted instruments, in upload order: " + submitted.map(x => x.pair).join(", ") + ".",
    "CURRENT LOCAL TIME: " + eatNow + " (Kenya / Africa-Nairobi, East Africa Time, UTC+3). Use this server-provided time for all timing recommendations.",
    "MULTI-PAIR RANKING: " + (multi ? "Analyze every submitted pair independently. Rank all valid candidates and highlight the strongest three (or fewer if fewer valid candidates exist), using confirmed HTF Bias, FVG, BOS/CHoCH and Liquidity Sweep confluence. Name Best Pair (Rank 1). Never promote an invalid setup above a valid one. If none qualifies, say NO VALID TRADE for that pair." : "Only one pair was submitted. Analyze it alone as Best Pair (Rank 1); do not invent comparisons or imply other pairs were scanned."),
    "TIMING RULES — ALL TIMES EAT (UTC+3): Gold/Forex preferred windows: London Killzone 10:00 AM–1:00 PM and NY Killzone 3:00 PM–6:00 PM. Crypto preferred windows: London Open 10:00 AM–1:00 PM and NY Open 3:00 PM–6:00 PM. If a valid setup exists now inside its suitable window, say ACTIVE NOW (analysis recommendation only); otherwise WAIT UNTIL the next exact suitable EAT window. Never claim execution.",
    "TIME FILTER: Asian Session 12:00 AM–8:00 AM EAT and low-volume period 6:00 PM–9:00 PM EAT. Warn about lower probability and demand stronger confirmation during these periods; do not automatically reject a valid setup solely due to time.",
    "For each pair, report H4/H1 bias, M30 setup, M15 trigger, entry, SL, TP1/TP2/TP3, invalidation, evidence score and reasons not to take it. Use exact section headings and clearly label each pair.",
    "STRICT EVIDENCE: Never invent, estimate, interpolate, round or assume prices. Use only exact prices clearly readable on chart scale or directly labelled; preserve every visible decimal. Distinguish wick extremes from candle bodies. If prices or screenshots are blurry, cropped, inconsistent or lack a readable scale, do not produce a trade plan.",
    "Never use psychological round numbers as Entry, SL or TP unless the exact chart evidence itself makes that level defensible. Do not use FVG midpoint by default. Use an evidenced FVG boundary, order-block wick, breaker or reaction level.",
    "A valid trade requires clear H4/H1 directional bias AND either confirmed BOS/CHoCH or a confirmed supporting liquidity sweep. If mandatory evidence is missing, state exactly: NO VALID TRADE — insufficient confirmation.",
    "MANDATORY RISK & TARGET CALCULATION ENGINE — apply these rules independently to every candidate. Do not substitute fixed points, arbitrary pip distances, round numbers, or guessed prices.",
    "1) ATR(14) STOP LOSS: Determine ATR(14) from the latest 14 completed candles on the most relevant execution timeframe (prefer M15; use M30 only if M15 candles are not sufficiently visible). Use true range = max(high-low, abs(high-previous close), abs(low-previous close)); ATR is the 14-period average true range. Identify the structural swing extreme that invalidates the setup. LONG: SL = structural swing low minus (1.5 × ATR14). SHORT: SL = structural swing high plus (1.5 × ATR14). State timeframe, swing price, ATR14, buffer and resulting SL. If 14 candle ranges and exact price scale cannot be read with adequate confidence from screenshots, do not invent ATR or SL; mark the setup NO VALID TRADE — ATR/structure not verifiable.",
    "2) LIQUIDITY TARGETS: TP1 is the nearest clearly evidenced opposing liquidity pool (recent opposing swing high/low, EQH/EQL, or session high/low). TP2 is the next major evidenced liquidity pool (PDH/PDL or higher-timeframe swing). Name the pool and quote its exact visible price. Never choose a target just because it is a round number. If no defensible liquidity level is visible, do not fabricate it.",
    "3) TP3 FIBONACCI PROJECTION: Project the impulse leg using Fibonacci extension levels -1.0 (standard target) and -2.0 (runner target), measured from the identified impulse leg and in the trade direction. State the exact anchor swing points, the extension level used and the calculated price. Treat -1.0 as the standard TP3; show -2.0 only as an optional runner beyond TP3. If impulse anchors cannot be identified precisely, mark TP3 unavailable rather than guessing. Do not describe a Fibonacci extension as a statistical standard-deviation measurement.",
    "4) OTE ENTRY FILTER: Validate an entry only when the proposed entry price is inside the 62%–79% Fibonacci retracement zone of the identified impulse leg, measured in the correct direction. State both OTE boundaries and the entry's position inside that zone. If price is outside the zone or the impulse anchors are unclear, reject the setup; do not move the entry arbitrarily to force a match.",
    "5) RISK/REWARD FILTER: Calculate risk = absolute(entry price - SL); TP1 reward = absolute(TP1 price - entry price); TP1 RR = reward/risk. Reject the setup unless TP1 offers at least 2.00R (1:2). Show the arithmetic and exact RR. Do not round a failing ratio up to 2.00.",
    "6) TRADE MANAGEMENT: Provide a conditional instruction to move SL to the exact entry price (break-even, excluding fees/spread) only after TP1 has actually been reached. Analyzer Pro is screenshot-based and does not monitor live prices or manage broker orders, so state clearly that the user must confirm TP1 and move the stop manually; never claim this action happens automatically.",
    "If any required calculation cannot be grounded in visible chart evidence, explicitly reject the setup with the missing evidence named. A confluence score cannot override the OTE, ATR, liquidity or 1:2 RR filters.",
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
