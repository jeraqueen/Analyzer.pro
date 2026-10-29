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

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request);
  if (!cors) return json({ error: "Cross-origin requests are not allowed." }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method === "GET") {
    const ready = Boolean(env.GEMINI_API_KEY && env.ANALYZER_ACCESS_TOKEN);
    return json({
      status: ready ? "ready" : "not_ready",
      provider: "Google Gemini",
      error: ready ? undefined : "Configure GEMINI_API_KEY and ANALYZER_ACCESS_TOKEN as Cloudflare Pages secrets. Use the Gemini API free tier and do not enable paid billing."
    }, ready ? 200 : 503, cors);
  }
  if (request.method !== "POST") return json({ error: "Use POST for chart analysis." }, 405, cors);
  if (!env.GEMINI_API_KEY) return json({ error: "The server is not configured yet. Add the GEMINI_API_KEY secret in Cloudflare Pages settings." }, 503, cors);
  if (!env.ANALYZER_ACCESS_TOKEN) return json({ error: "The server is not protected yet. Add the ANALYZER_ACCESS_TOKEN secret in Cloudflare Pages settings." }, 503, cors);
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

  const prompt = `You are a careful, practical trading research assistant—not a broker or execution system. Analyze the user's chart screenshots for ${pair}. The screenshots are provided together and each is explicitly labelled with its timeframe. Treat only visible chart evidence as fact. Never invent prices, indicators, candles, news, spread, or live market data. If exact price labels are unreadable, mark numeric prices as NOT IDENTIFIABLE and describe the visible structure qualitatively.

PRIMARY GOAL: make the scan useful and decisive. Compare plausible BUY and SELL scenarios, then select the best-supported directional scenario when the screenshots show a reasonably coherent structure. Do NOT default to WAIT / NO TRADE merely because the entry candle has not triggered yet. In that case, return BUY or SELL with status WAITING FOR TRIGGER and state the exact condition required. Use WAIT / NO TRADE only when the screenshots are unreadable, evidence is genuinely contradictory, neither direction has a defensible structure, or no sensible invalidation can be identified. Never label an untriggered setup READY.

Uploaded timeframes, in review order: ${present.join(", ")}. Preferred full set: D1, H4, H1, M30, M15, M5. Missing timeframes must be identified rather than imagined. User-selected direction: ${payload.direction || "Undecided"}. User-entered levels: ${JSON.stringify(payload.levels || {})}. Thesis: ${String(payload.thesis || "")}. Invalidation: ${String(payload.invalidation || "")}. Timeframe notes: ${JSON.stringify(payload.timeframeNotes || {})}. Current verified live price/news data was NOT supplied; do not claim to have checked it.

TIMEFRAME METHOD: D1 = major market context and major support/resistance; H4 = dominant swing/trend and key structure; H1 = intraday directional alignment and setup structure; M30 = intermediate confirmation; M15 = setup/entry zone refinement; M5 = precise trigger only when its screenshot supports it. Adapt to actual evidence, do not mechanically force this hierarchy. Review every uploaded timeframe individually, explicitly note alignment/conflict, and distinguish observations from interpretation.

CHOOSE ONE MAIN PLAN: BUY, SELL, or WAIT / NO TRADE. Prefer trend continuation/pullback, rejection at a visible level, or a confirmed break-and-retest when supported. Do not force a reversal. A conditional directional plan is still useful before the trigger happens.

Return concise, actionable lines with these exact headings in this order:
EXECUTIVE VERDICT:
DIRECTION: (exactly BUY, SELL, or WAIT / NO TRADE, followed by READY or WAITING FOR TRIGGER where applicable)
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

Evidence rules: cite the actual visible candle/swing/level and the timeframe supporting each conclusion. Name the basis timeframe and structural reason for the stop and each target (for example, H1 swing high, M15 structure low, H4 resistance). Do not reuse the same unexplained target for all TPs. If a level is not legible, say so rather than guessing. Calculate reward:risk only if entry, stop and target are readable; otherwise mark it not calculable. If a BUY/SELL setup is plausible but needs confirmation, give its conditional entry and invalidation, not blank fields and not an automatic NO TRADE. If both sides are similarly plausible or a defensible stop cannot be derived, use WAIT / NO TRADE and specify what evidence would resolve it. A quality score reflects visible evidence/confluence/risk definition/trigger status and is NOT a win probability. Never guarantee profit, invent live/news data, or execute a trade.`;

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
    return json({ error: "Could not reach the AI service. Check the Cloudflare Function and try again." }, 502, cors);
  }
}
