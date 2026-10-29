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
  const validTfs = ["H4", "H1", "M15", "M5"];
  const present = validTfs.filter(tf => typeof charts[tf] === "string");
  if (!present.length) return json({ error: "Upload at least one chart screenshot." }, 400, cors);

  const prompt = `You are a careful trading research assistant, not a broker and not an execution system. Analyze the user's screenshots for ${pair}. Treat screenshots as the only chart evidence; do not invent prices, indicators, candles, news, spreads, or market data. If price labels are unreadable, describe zones qualitatively and state that exact prices cannot be confirmed. Missing timeframes must be called out. Distinguish observations from interpretation. Never promise profit or present a qualitative confidence label as a probability. Prefer WAIT or NO TRADE when evidence is weak.

Uploaded timeframes: ${present.join(", ")}. User-selected direction: ${payload.direction || "Undecided / no trade"}.
User-entered levels: ${JSON.stringify(payload.levels || {})}.
Thesis: ${String(payload.thesis || "")}
Invalidation: ${String(payload.invalidation || "")}
Timeframe notes: ${JSON.stringify(payload.timeframeNotes || {})}
Primary session requested: New York. Current verified live market/news data was NOT supplied, so do not claim news or live prices were checked.

Return these headings:
1. EXECUTIVE VERDICT — LONG SETUP / SHORT SETUP / WAIT FOR CONFIRMATION / NO TRADE; say whether an entry trigger is visibly confirmed.
2. TIMEFRAME EVIDENCE — H4, H1, M15 and M5 individually; identify missing images.
3. CONFLUENCE AND CONFLICTS — explain agreement/disagreement.
4. VISIBLE KEY LEVELS — separate readable exact prices from approximate zones.
5. TRADE PLAN — only if supported: conditional entry/entry zone, confirmation required, stop-loss at structural invalidation, defensible TP1/TP2/TP3 if present, reward:risk when prices are readable, and setup cancellation rules. Otherwise explicitly do not force levels.
6. ALTERNATIVE SCENARIO.
7. RISK CHECK — position size requires broker-verified contract/pip value, account currency and costs. Do not assume XAUUSD contract specifications.
8. SESSION AND NEWS LIMITATIONS.
9. EVIDENCE QUALITY AND LIMITATIONS.
10. PRE-TRADE CHECKLIST.

Do not execute trades, issue guaranteed predictions, or pretend screenshots provide future information.`;

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
