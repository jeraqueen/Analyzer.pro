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
  const validTfs = ["D1", "H4", "H1", "M30", "M15", "M5"];
  const present = validTfs.filter(tf => typeof charts[tf] === "string");
  if (!present.length) return json({ error: "Upload at least one chart screenshot." }, 400, cors);

  const prompt = `Act as a practical chart analyst for ${pair}, not a broker or execution system. Analyze all supplied screenshots together. Each image is labelled with its exact timeframe; never confuse their order. Screenshots are the only chart evidence. Never invent prices, indicators, candles, live quotes, spreads, news, or backtest results. If price labels are unreadable, say exact numeric prices are NOT IDENTIFIABLE and describe visible zones qualitatively.

The user wants the best-supported BUY or SELL scenario, not a default WAIT/NO TRADE. Compare both sides and select the stronger direction whenever the uploaded structure reasonably supports one. If the setup is valid but the trigger has not occurred, still choose BUY or SELL and label it WAITING FOR TRIGGER with the exact confirmation event. Reserve WAIT / NO TRADE for genuinely conflicting/weak/unreadable evidence, or when neither side has a defensible entry and invalidation. Never label a setup READY unless the trigger is visibly confirmed. Do not fabricate confidence or win probabilities.

Uploaded timeframes: ${present.join(", ")}. Preferred complete set: H4, H1, M15, M5, M30, D1. Missing images must be called out. User direction preference: ${payload.direction || "Undecided"}. Levels: ${JSON.stringify(payload.levels || {})}. Thesis: ${String(payload.thesis || "")}. Invalidation: ${String(payload.invalidation || "")}. Notes: ${JSON.stringify(payload.timeframeNotes || {})}. No verified live price/news data is supplied.

Review D1 for major context/levels, H4 for dominant swing structure, H1 for intraday setup, M30 for intermediate confirmation, M15 for setup zone and M5 for entry trigger. Adjust to actual screenshots; never assume the timeframes agree. Evaluate continuation and pullback setups as well as reversals. A strong trend can support a continuation trade; do not insist on reversal. Avoid chasing an extended move.

Use these headings in order:
EXECUTIVE VERDICT:
DIRECTION: (exactly BUY, SELL, or WAIT / NO TRADE; state READY or WAITING FOR TRIGGER)
BEST TIMEFRAME TO WATCH:
SECOND-BEST TIMEFRAME:
MARKET STRUCTURE:
SETUP TYPE:
SETUP TIMEFRAME:
ENTRY / EXECUTION TIMEFRAME:
ENTRY ZONE:
ENTRY TRIGGER / REQUIREMENTS:
STOP LOSS (PRICE + BASIS TIMEFRAME):
TP1 (PRICE + BASIS TIMEFRAME):
TP2 (PRICE + BASIS TIMEFRAME):
TP3 (PRICE + BASIS TIMEFRAME):
REWARD:RISK:
INVALIDATION:
SETUP QUALITY SCORE (NOT WIN PROBABILITY):
TIMEFRAME-BY-TIMEFRAME REVIEW:
CONFLUENCE AND CONFLICTS:
ALTERNATIVE SCENARIO:
RISK AND PRE-TRADE CHECKLIST:
LIMITATIONS:

Give evidence, not vague labels: identify the visible structure/candle/level and its timeframe. Explicitly name the setup timeframe, entry/execution timeframe, the swing/structure timeframe used for SL, and the basis timeframe plus structural reason for every TP. Use only defensible prices. If exact values cannot be read, mark them NOT IDENTIFIABLE rather than making them up; explain the structural zone instead. Calculate reward:risk only when prices are sufficiently clear. If an untriggered conditional BUY/SELL setup is reasonably supported, do not hide it behind WAIT. If evidence truly conflicts, neither direction is defensible, or risk cannot be defined, use WAIT / NO TRADE and explain the event needed to resolve it. Setup quality score is not win probability. No guaranteed results, fabricated live data, or trade execution.`;

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
