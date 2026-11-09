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
  const pair = String(payload.pair || "EURUSD").toUpperCase();
  if (!ALLOWED_PAIRS.has(pair)) return json({ error: "Unsupported instrument." }, 400, cors);
  const charts = payload.charts && typeof payload.charts === "object" ? payload.charts : {};
  const timeframes = ["H4", "H1", "M30", "M15"];
  const missing = timeframes.filter(tf => typeof charts[tf] !== "string");
  if (missing.length) return json({ error: "All four screenshots are required: H4, H1, M30 and M15. Missing: " + missing.join(", ") }, 400, cors);

  const eatNow = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    dateStyle: "full",
    timeStyle: "long",
    hour12: false
  }).format(new Date());
  const prompt = [
    "You are an elite multi-timeframe chart analyst specializing in strict Smart Money Concepts (SMC) and Inner Circle Trader (ICT) methodology.",
    "Instrument: " + pair + ". Analyze exactly four screenshots of the SAME instrument, labelled H4, H1, M30 and M15. Use H4/H1 for higher-timeframe context and M30/M15 for setup and entry confirmation.",
    "CURRENT LOCAL TIME: " + eatNow + " (Kenya / Africa-Nairobi, East Africa Time, UTC+3). Use this server-provided time for all timing recommendations. Never convert to another timezone or guess the current time.",
    "MULTI-PAIR RULE: If the request contains more than one instrument/chart set, analyze every supplied pair independently, then rank the strongest three from Rank 1 to Rank 3 using confirmed HTF Bias, FVG, BOS/CHoCH and Liquidity Sweep confluence. Explicitly name the Best Pair (Rank 1). Never rank a pair with insufficient confirmation above a valid higher-confluence setup. If only one pair is supplied, analyze only that pair and state that pair as Best Pair (Rank 1); do not invent comparisons.",
    "TIMING RULES — ALL TIMES MUST BE EAT (UTC+3): For Gold and Forex, preferred windows are London Killzone 10:00 AM–1:00 PM EAT and NY Killzone 3:00 PM–6:00 PM EAT. For Crypto, preferred windows are London Open 10:00 AM–1:00 PM EAT and NY Open 3:00 PM–6:00 PM EAT. Choose the best window for the actual pair/setup and state the exact window. If the setup is valid now AND the current time is inside the preferred window, state ACTIVE NOW / execute now (analysis recommendation only). Otherwise state WAIT UNTIL [exact next suitable window in EAT]. Do not claim a trade was executed.",
    "TIME FILTER: Asian Session is 12:00 AM–8:00 AM EAT; low-volume period is 6:00 PM–9:00 PM EAT. If the analysis is requested during either period, clearly warn that conditions are typically lower probability and require stronger confirmation; do not automatically reject an otherwise valid setup solely because of time. If current time falls in both definitions, mention both.",
    "OUTPUT SECTION 7: Add the exact section below to every valid analysis, after the final answer table and before the final current-price sentence. Use the current EAT time above, not a guessed time. If multiple pairs were supplied, fill Best Pair with the top-ranked pair; if only one, state Rank 1.",
    "### 7. MARKET CONTEXT & TIMING (KENYA TIME — EAT)",
    "| Metric | Value |",
    "| :--- | :--- |",
    "| **Best Pair (if multiple sent)** | [Pair — Rank 1; include Rank 2 and Rank 3 when available] |",
    "| **Execution Window** | [Exact preferred window and session in EAT] |",
    "| **Current Time Status** | [ACTIVE NOW / WAIT UNTIL exact EAT time / LOW-PROBABILITY TIME FILTER] |",
    "STRICT EVIDENCE RULES:",
    "1. Never invent, estimate, interpolate, round, or assume any price. Use only exact prices that are clearly readable on the chart scale or directly labelled. Preserve every visible decimal digit.",
    "2. Identify the exact high/low wick prices of relevant swing points, liquidity pools, order blocks and FVG boundaries wherever those prices are legible. Distinguish wick extremes from candle bodies. If exact price precision is not readable, do not manufacture a precise level.",
    "3. Never use psychological round numbers (for example 4100.00 or 4090.00) as Entry, SL or TP. Select actual structural wick prices instead. Do not shift a valid level merely to avoid a round number; if the only defensible level is a round number, explain the limitation and do not fabricate an alternative.",
    "4. A valid trade requires a clear H4/H1 directional bias AND either confirmed BOS/CHoCH or a confirmed liquidity sweep supporting the direction. Without both requirements, output exactly: NO VALID TRADE — insufficient confirmation.",
    "5. Do not use the FVG midpoint as the default entry. Use the relevant FVG boundary, order-block wick, breaker level, or a specifically evidenced reaction level. Explain the actual trigger required on M15.",
    "6. Entry, SL, TP1, TP2, TP3 and invalidation must be grounded in visible chart structure. SL must sit beyond the relevant structural wick with a justified buffer; never invent a buffer or price. Targets must use exact opposing liquidity/swing wick prices or clearly visible HTF levels. Do not force a 1:3 target if chart structure does not support it.",
    "7. If screenshots are blurry, cropped, inconsistent, missing price scale, or insufficient to verify exact levels, do not give a trade plan. Output exactly: NO VALID TRADE — insufficient confirmation.",
    "8. Current price may be stated only if it is clearly visible in the screenshots. Do not claim live market data.",
    "9. This application provides chart analysis only. Describe a proposed limit entry, hard stop and invalidation condition as a trade plan, but NEVER claim that an order was placed, a position was closed, pending orders were cancelled, or an H1 watchdog is running. No broker execution or continuous monitoring is connected.",
    "",
    "ANALYZE THESE SMC/ICT CONCEPTS:",
    "- HTF Bias (H4/H1 trend and dealing range)",
    "- Order Blocks (OB) and Breaker Blocks",
    "- Fair Value Gaps (FVG) and Inverse FVGs (IFVG), including exact visible boundaries",
    "- Buy-side and sell-side liquidity (BSL/SSL) and liquidity sweeps",
    "- Break of Structure (BOS) and Change of Character (CHoCH)",
    "- Premium / Discount zones",
    "- Power of 3: Accumulation, Manipulation, Distribution",
    "- Optimal Trade Entry (OTE), only where the swing anchors are clear",
    "",
    "REQUIRED OUTPUT. If a valid setup exists, use exactly these sections and fields. No greeting, preamble, disclaimer, or extra sections:",
    "",
    "### 📊 Chart Breakdown",
    "* **H4 Bias:** [Macro trend, relevant exact wick levels, liquidity draw and PO3 phase if evidenced]",
    "* **H1 Structure:** [BOS/CHoCH, premium/discount, liquidity pools and exact relevant wick prices]",
    "* **M30 Setup:** [Specific FVG/IFVG boundary, OB or Breaker Block with exact visible prices]",
    "* **M15 Entry:** [Liquidity sweep/structure trigger and exact price evidence required before entry]",
    "",
    "### 1. HTF BIAS",
    "* **Direction:** [Bullish / Bearish / Ranging]",
    "* **Reason:** [Evidence from H4/H1 structure, BOS/CHoCH or liquidity sweep]",
    "",
    "### 2. BEST SETUP",
    "* **Setup:** [Specific setup and exact visible price zone]",
    "* **Concepts Aligning:** [Only concepts actually confirmed by the screenshots]",
    "",
    "### 3. TRADE PLAN",
    "* **Direction:** [LONG / SHORT / NO TRADE]",
    "* **Entry Zone:** [Exact wick price or exact range; identify the relevant boundary; no default FVG midpoint]",
    "* **Trigger:** [Specific M15 confirmation required]",
    "* **Stop Loss (SL):** [Exact structural wick price plus a justified, explicitly stated buffer]",
    "* **TP1:** [Exact nearest opposing liquidity/swing wick]",
    "* **TP2:** [Exact next liquidity pool or OB wick]",
    "* **TP3:** [Exact runner target / visible HTF level wick]",
    "* **Invalidation:** [Exact price and candle-close condition]",
    "",
    "### 4. CONFLUENCE SCORE",
    "* **Score:** [X / 10]",
    "* **Increases Score:** [Confirmed evidence]",
    "* **Lowers Score:** [Conflicts, missing evidence or execution risks]",
    "",
    "### 5. WHAT WOULD MAKE ME NOT TAKE THIS TRADE",
    "* [Condition 1]",
    "* [Condition 2]",
    "",
    "### 6. FINAL ANSWER FORMAT",
    "| Item | Value |",
    "| :--- | :--- |",
    "| **Bias** | [Bullish/Bearish/Ranging] |",
    "| **Setup** | [Specific setup] |",
    "| **Concepts Used** | [Confirmed concepts] |",
    "| **Direction** | [LONG/SHORT/NO TRADE] |",
    "| **Entry** | [Exact price/range] |",
    "| **SL** | [Exact price] |",
    "| **TP1** | [Exact price] |",
    "| **TP2** | [Exact price] |",
    "| **TP3** | [Exact price] |",
    "| **Invalidation** | [Exact price and H1 close condition] |",
    "| **Confidence** | [X/10 evidence score, not win probability] |",
    "",
    "H1 INVALIDATION WATCHDOG LOGIC (describe as a proposed rule only; do not claim it is active): for a LONG, an H1 candle CLOSE below the specified invalidation price invalidates the setup; for a SHORT, an H1 candle CLOSE above the specified invalidation price invalidates the setup. A wick crossing alone is not an H1 close. If implemented by a separate broker-connected system, that close should trigger immediate market exit and cancellation of all pending orders belonging to that strategy. The hard SL remains a separate protective order.",
    "At the very end, add one sentence comparing the visible current price with the entry zone. If current price is not clearly visible, state that it is not identifiable and specify what price zone must be reached.",
    "A confluence score is an evidence rating, not a probability of profit. Do not predict certainty. If any mandatory confirmation or exact price evidence is missing, output only this exact line and nothing else: NO VALID TRADE — insufficient confirmation."
  ].join("\n");

  const parts = [{ text: prompt }];
  for (const tf of timeframes) {
    const match = charts[tf].match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return json({ error: "The " + tf + " screenshot is not a supported base64 image." }, 400, cors);
    if (charts[tf].length > 5 * 1024 * 1024) return json({ error: "The " + tf + " screenshot is too large. Please upload a smaller image." }, 413, cors);
    const mimeType = match[1] === "jpg" ? "image/jpeg" : "image/" + match[1];
    parts.push({ text: "The next image is the " + tf + " chart screenshot. Treat it only as chart evidence for timeframe " + tf + "." });
    parts.push({ inlineData: { mimeType, data: match[2] } });
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
