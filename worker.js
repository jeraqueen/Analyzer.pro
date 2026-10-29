const MAX_BODY_BYTES = 9 * 1024 * 1024;
const ALLOWED_PAIRS = new Set(["AUDUSD", "XAUUSD", "EURUSD", "GBPUSD", "USDJPY"]);

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
      error: ready ? undefined : "Configure GEMINI_API_KEY and ANALYZER_ACCESS_TOKEN as encrypted secrets on the analyzer-pro Worker. Use the Gemini API free tier and do not enable paid billing."
    }, ready ? 200 : 503, cors);
  }
  if (request.method !== "POST") return json({ error: "Use POST for chart analysis." }, 405, cors);
  if (!env.GEMINI_API_KEY) return json({ error: "The server is not configured yet. Add the GEMINI_API_KEY secret in the analyzer-pro Worker's Settings → Variables and Secrets." }, 503, cors);
  if (!env.ANALYZER_ACCESS_TOKEN) return json({ error: "The server is not protected yet. Add the ANALYZER_ACCESS_TOKEN secret in the analyzer-pro Worker's Settings → Variables and Secrets." }, 503, cors);
  const suppliedToken = request.headers.get("X-Analyzer-Token") || "";
  if (suppliedToken.length !== env.ANALYZER_ACCESS_TOKEN.length || suppliedToken !== env.ANALYZER_ACCESS_TOKEN) {
    return json({ error: "Unauthorized. Check the private analysis access token saved in this browser." }, 401, cors);
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

  const pair = String(payload.pair || "").toUpperCase();
  if (!ALLOWED_PAIRS.has(pair)) return json({ error: "Unsupported instrument. Select a supported pair." }, 400, cors);
  const charts = payload.charts && typeof payload.charts === "object" ? payload.charts : {};
  const validTfs = ["H4", "H1", "M15", "M5"];
  const present = validTfs.filter(tf => typeof charts[tf] === "string");
  if (!present.length) return json({ error: "Upload at least one chart screenshot." }, 400, cors);

  const prompt = `Act as a practical XAUUSD/forex chart analyst. Analyze only what is visible in the uploaded screenshots for ${pair}. Evaluate LONG and SHORT setups, not just reversals. A strong bearish trend can offer a SHORT on a pullback to resistance, bearish rejection, or a confirmed support break and retest; a strong bullish trend can offer LONGs on pullbacks or confirmed breakouts. Never assume a reversal is required to trade with the trend.

The user wants the scan to rank the best one or two timeframes to watch. Always identify:
- BEST TIMEFRAME TO WATCH: choose the most suitable uploaded timeframe for the clearest current structure and explain why.
- SECOND-BEST TIMEFRAME: choose a second uploaded timeframe if it adds useful confirmation; if not, say why.
- SETUP TYPE: trend pullback, support/resistance bounce, breakout, break-and-retest, range trade, liquidity sweep/structure shift, or reversal only if evidenced.
- TRADE PLAN: direction LONG/SHORT/WAIT; entry zone; stop placement; TP1/TP2/TP3; reward:risk if prices can be read; exact entry trigger; invalidation; and checklist of what must be true before entry.
- IF NO TRIGGER NOW: still give the best CONDITIONAL setup and the exact chart event to wait for, when visible structure supports one. Do not return blank levels merely because price has not triggered yet.
- If numeric prices are legible, use them. If not, give a clearly described structural zone and explicitly mark exact numeric price NOT IDENTIFIABLE. Never fabricate prices.
- Evaluate H4/H1/M15/M5 separately; mention only timeframes actually uploaded. Use higher timeframes for directional context and lower ones for timing. A sensible default for intraday XAUUSD is H1/M15 for context/setup and M5 for trigger, but select based on the actual screenshots rather than blindly using a default.
- Look for trend structure (higher highs/lows or lower highs/lows), support/resistance zones, pullbacks, range breakouts, retests, false breaks, engulfing/pin bars only if actually visible, triangles/flags/wedges/double tops/bottoms/head-and-shoulders only if supported, and liquidity sweeps / market structure shifts only when identifiable. These are candidate frameworks, not guaranteed signals.
- Consider session volatility and economic news only if data is provided. News has not been checked unless explicitly supplied.
- A strong trend is not enough on its own to enter immediately: avoid chasing extended candles; plan pullback/retest if appropriate.
- Use the nearest defensible swing high/low or opposing structure for invalidation and targets. Calculate reward:risk only when entry, stop and target prices are clear. State what must be checked on the broker chart.
- Provide a SETUP QUALITY SCORE from 0-100 based on visible evidence, confluence, timeframe agreement, risk definition and trigger status. This is NOT win probability.
- Do not force an immediate trade if no coherent risk-defined setup exists, but make the analysis useful by giving the best conditional scenario and requirements whenever chart structure supports it. Never promise profit or claim any strategy guarantees success.

Use these exact headings and concise lines:
EXECUTIVE VERDICT:
DIRECTION:
BEST TIMEFRAME TO WATCH:
SECOND-BEST TIMEFRAME:
MARKET STRUCTURE:
SETUP TYPE:
ENTRY ZONE:
STOP LOSS:
TP1:
TP2:
TP3:
REWARD:RISK:
ENTRY TRIGGER / REQUIREMENTS:
INVALIDATION:
SETUP QUALITY SCORE (NOT WIN PROBABILITY):
TIMEFRAME-BY-TIMEFRAME REVIEW:
CONFLUENCE:
ALTERNATIVE SCENARIO:
RISK AND PRE-TRADE CHECKLIST:
LIMITATIONS:

Context supplied by user: direction ${payload.direction || "Undecided"}. User-entered levels: ${JSON.stringify(payload.levels || {})}. Thesis: ${String(payload.thesis || "")}. Invalidation: ${String(payload.invalidation || "")}. Notes: ${JSON.stringify(payload.timeframeNotes || {})}. Uploaded timeframes: ${present.join(", ")}. Screenshots are the only chart evidence. Never invent prices, indicators, live quotes, spreads, or backtest results. No trade execution.`;

  const parts = [{ text: prompt }];
  for (const tf of present) {
    const match = charts[tf].match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return json({ error: `The ${tf} screenshot is not a supported base64 image.` }, 400, cors);
    if (charts[tf].length > 5 * 1024 * 1024) return json({ error: `The ${tf} screenshot is too large. Please upload a smaller image.` }, 413, cors);
    const mimeType = match[1] === "jpg" ? "image/jpeg" : `image/${match[1]}`;
    parts.push({ text: `Next image is the ${tf} chart. Use it only as evidence for that timeframe.` });
    parts.push({ inlineData: { mimeType, data: match[2] } });
  }

  try {
    const model = env.GEMINI_MODEL || "gemini-3.1-flash-lite";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2200 }
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = result?.error?.message || `Gemini API returned HTTP ${response.status}`;
      return json({ error: message }, 502, cors);
    }
    const text = (result.candidates?.[0]?.content?.parts || [])
      .map(part => typeof part.text === "string" ? part.text : "")
      .filter(Boolean)
      .join("\n").trim();
    if (!text) return json({ error: "The AI service returned no readable analysis. You may have reached the free-tier limit; wait and try again." }, 502, cors);
    return json({ text, model, provider: "Google Gemini" }, 200, cors);
  } catch {
    return json({ error: "Could not reach the AI service. Check the Cloudflare Worker and try again." }, 502, cors);
  }
}


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/analyze") {
      return handleAnalyze(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
