const MAX_BODY_BYTES = 9 * 1024 * 1024;
const ALLOWED_PAIRS = new Set(["XAUUSD", "BTCUSD", "NAS100", "US30"]);

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
  const validTfs = ["M5", "M1"];
  const present = validTfs.filter(tf => typeof charts[tf] === "string");
  const missing = validTfs.filter(tf => typeof charts[tf] !== "string");
  if (missing.length) return json({ error: "Upload both screenshots. Missing: " + missing.join(", ") + "." }, 400, cors);

  const prompt = `You are Analyzer Pro, a careful AI multi-timeframe chart analyst. Analyze selected instrument ${pair} using exactly two user screenshots: M5 and M1. The AI chart analyzer MUST remain active and must inspect both screenshots. Use only visible chart evidence. Never invent prices, candles, indicators, volume, spread, news, or live market data. If a price or candle is unreadable, say NOT READABLE.

SUPPORTED MARKETS: XAUUSD (Gold), BTCUSD (Bitcoin), NAS100 (Nasdaq 100), US30 (Dow Jones 30). Use only the selected instrument and its own broker feed.

ACTIVE TRADING METHOD — STRATEGY 1 ONLY: M5 RANGE BREAKOUT + M1 FVG CONFIRMATION. There is no second strategy. Do not use, mention, or recommend FVG-tap/engulfing-bounce or any other strategy.

1. M5 RANGE: Identify the selected five-minute candle/range and mark its high and low. If the user-selected candle/range cannot be identified clearly, state that and WAIT; do not choose arbitrary boundaries.
2. BREAKOUT: BUY only after an M5 candle BODY CLOSES clearly above the range high. SELL only after an M5 candle BODY CLOSES clearly below the range low. A wick-only breach is invalid. Require decisive displacement, not a weak close or immediate rejection.
3. FVG: Confirm a valid Fair Value Gap in the breakout direction. The gap must be supported by visible candles. No valid supporting FVG means no confirmed trade.
4. M1 ENTRY: Use the M1 screenshot to verify the confirmation sequence. Enter only at the close of the THIRD candle in that valid M1 confirmation sequence. Count and describe the three candles. If the sequence is incomplete, candles are still forming, or the screenshots do not show enough history, report WAITING FOR M1 CONFIRMATION. Never enter early.
5. STOP LOSS: BUY = the lowest wick of the M5 breakout candle. SELL = the highest wick of the M5 breakout candle. Use the actual visible extreme; if unreadable, do not fabricate a stop.
6. SUPPORT/RESISTANCE AND TARGETS: Map the nearest meaningful support and resistance levels visible on BOTH supplied timeframes. Use M5 structure for the broader intraday levels and M1 structure for nearby execution obstacles. For BUY, place TP1 at the next meaningful resistance/structure barrier before it; for SELL, place TP1 at the next meaningful support/structure barrier before it. TP2 and TP3 may be farther opposing structure/liquidity levels only if they are clearly visible and reasonably reachable within the time limit. Do not use arbitrary fixed pip/point distances or force 1:2/1:3 ratios. Show the exact visible level and explain which timeframe/structure supports each TP. If there is not enough room to the next opposing level after the stop and trading costs, say WAIT — POOR REWARD/RISK.
7. TIME LIMIT: This is an intraday setup intended to be completed within 90 minutes maximum from entry. Estimate whether the visible structure and recent candle movement make the target plausible within 90 minutes; only give an estimate when the screenshot provides enough evidence. Do not promise that TP will be reached. State: planned maximum holding time = 90 minutes; if neither SL nor TP has been reached by 90 minutes after entry, the trader should close the position manually rather than keep it open. Do not claim the website or AI will automatically close a broker position.
8. QUALITY CONTROL: State whether the M5 and M1 screenshots are aligned in time and whether chart history/price scale are readable. If not, WAIT. Consider nearby support/resistance that may block the trade. Never fabricate confidence percentages, win rates, price levels, volatility, event checks, or exact time-to-target.

ACCOUNT CONTEXT: Balance ${Number(payload.balance)||0}; risk setting ${Number(payload.risk)||0}% is context only. Do not invent lot size, pip value, contract size, or broker specifications.

REPORT FORMAT (use this exact single-strategy structure):
INSTRUMENT:
OVERALL VERDICT: BUY / SELL / WAIT — NO TRADE
STRATEGY: M5 RANGE BREAKOUT + M1 FVG CONFIRMATION ONLY
M5 selected candle/range:
Range high:
Range low:
Breakout candle and body-close price:
Breakout direction and displacement quality:
Supporting FVG and price zone:
M1 confirmation sequence (identify candles 1, 2 and 3):
Entry at third-candle close:
Stop-loss (M5 breakout candle extreme):
M5 support levels:
M5 resistance levels:
M1 nearby support levels:
M1 nearby resistance levels:
TP1 (nearest opposing structure level + timeframe):
TP2 (next structure level + timeframe, if valid):
TP3 (further structure level + timeframe, if valid):
Reward:risk for each TP (only if all prices readable):
Estimated holding time (only if supportable):
90-minute exit rule:
Setup status: CONFIRMED / WAITING FOR M1 CONFIRMATION / INVALID
Invalidation condition:
Why this setup is or is not suitable for a maximum 90-minute trade:
LIMITATIONS:

If no valid setup exists, clearly say WAIT — NO VALID STRATEGY 1 SETUP and list the exact missing condition. Do not output a second strategy. Do not claim an order was placed.`;

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
        generationConfig: { temperature: 0.2, maxOutputTokens: 3000 }
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
