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

  const prompt = [
    "You are an elite professional multi-timeframe chart analyst using the full Smart Money Concepts (SMC) and Inner Circle Trader (ICT) toolkit.",
    "Instrument: " + pair + ". The user supplied exactly four screenshots of this same instrument: H4, H1, M30 and M15. Each image is labelled with its exact timeframe. Analyze all four together.",
    "Do not write introductory fluff. Do not deviate from the required template. Use exact numbers only when clearly readable in the screenshots. Never invent prices, candles, indicators, live quotes, news, spreads or chart events. If the screenshots lack enough data, output exactly: NO VALID TRADE — insufficient confirmation.",
    "",
    "CONCEPTS TO IDENTIFY:",
    "- HTF Bias (H4/H1 trend)",
    "- Order Blocks (OB) and Breaker Blocks",
    "- Fair Value Gaps (FVG) and Inverse FVGs (IFVG)",
    "- Liquidity Sweeps (BSL/SSL)",
    "- Break of Structure (BOS) and Change of Character (CHoCH)",
    "- Premium / Discount zones",
    "- Power of 3 (Accumulation, Manipulation, Distribution)",
    "- Optimal Trade Entry (OTE)",
    "",
    "OUTPUT MUST EXACTLY MATCH THIS TEMPLATE:",
    "",
    "### 📊 Chart Breakdown",
    "* **H4 (Bias):** [Describe macro trend, recent sweep, Power of 3 phase, and key HTF levels]",
    "* **H1 (Structure):** [Describe recent BOS/CHoCH, premium/discount, and liquidity pools]",
    "* **M30 (Setup):** [Identify the specific FVG, OB, or Breaker Block being targeted]",
    "* **M15 (Entry):** [Describe the current price action, recent liquidity sweeps, and the trigger needed to enter]",
    "",
    "### 1. HTF BIAS",
    "* **Direction:** [Bullish / Bearish / Ranging]",
    "* **Reason:** [Explain why using BOS, CHoCH, PO3, or liquidity draws]",
    "",
    "### 2. BEST SETUP",
    "* **Setup:** [Name the setup, e.g., Bearish M30 FVG / Order Block]",
    "* **Concepts Aligning:**",
    "  * [List the concepts that align here, e.g., HTF Bias, FVG, Liquidity Sweep, OTE, etc.]",
    "",
    "### 3. TRADE PLAN",
    "* **Direction:** LONG / SHORT / NO TRADE",
    "* **Entry Zone:** [Exact price or range]",
    "* **Trigger:** [What needs to happen, e.g., M15 CHoCH or candle close]",
    "* **Stop Loss (SL):** [Structural level + buffer]",
    "* **TP1:** [Nearest opposing liquidity / swing]",
    "* **TP2:** [Next liquidity pool or OB]",
    "* **TP3:** [Runner target / HTF level / 1:3 RR]",
    "* **Invalidation:** [Exact price close that cancels the setup]",
    "",
    "### 4. CONFLUENCE SCORE",
    "* **Score:** [X / 10]",
    "* **Increases Score:** [List factors that make this a good trade]",
    "* **Lowers Score:** [List factors that make this risky]",
    "",
    "### 5. WHAT WOULD MAKE ME NOT TAKE THIS TRADE",
    "* [Condition 1]",
    "* [Condition 2]",
    "",
    "### 6. FINAL ANSWER FORMAT",
    "| Item | Value |",
    "| :--- | :--- |",
    "| **Bias** | [Value] |",
    "| **Setup** | [Value] |",
    "| **Concepts Used** | [List] |",
    "| **Direction** | [LONG/SHORT/NO TRADE] |",
    "| **Entry** | [Value] |",
    "| **SL** | [Value] |",
    "| **TP1** | [Value] |",
    "| **TP2** | [Value] |",
    "| **TP3** | [Value] |",
    "| **Invalidation** | [Value] |",
    "| **Confidence** | [Score/10] |",
    "",
    "At the very end, add one sentence evaluating the current price versus the entry zone, using the current price only if it is visible in the screenshots. Otherwise say the current price is not identifiable and explain what price zone must be reached.",
    "Use NO TRADE whenever confirmation is missing or price levels cannot be read reliably. Do not turn uncertainty into a trade signal. A confluence score is a qualitative evidence score, not a probability of winning. Do not claim the AI can predict future prices."
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
