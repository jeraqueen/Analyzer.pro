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

  const prompt = `You are a careful forex chart research assistant, not a broker or execution system. Analyze screenshots for ${pair}. Screenshots are the only chart evidence. Do not invent prices, candles, indicators, live quotes, spreads, news, or backtest results. If a price is unreadable or unsupported, say NOT IDENTIFIABLE rather than guessing. Missing timeframes must be identified. Live news and live prices were not supplied. User direction: ${payload.direction || "Undecided / no trade"}. User-entered levels: ${JSON.stringify(payload.levels || {})}. Thesis: ${String(payload.thesis || "")}. Invalidation: ${String(payload.invalidation || "")}. Notes: ${JSON.stringify(payload.timeframeNotes || {})}. Uploaded timeframes: ${present.join(", ")}.

Use these exact headings and put each trade level on its own clearly labelled line so the website can display it separately:
1. EXECUTIVE VERDICT: LONG SETUP / SHORT SETUP / WAIT FOR CONFIRMATION / NO TRADE. State clearly whether a valid trigger is visible now.
2. DIRECTION: LONG / SHORT / NONE.
3. ENTRY ZONE: exact price or zone only if readable and justified; otherwise NOT IDENTIFIABLE. If conditional, label it CONDITIONAL.
4. STOP LOSS: exact price and structural reason only if justified; otherwise NOT IDENTIFIABLE.
5. TP1: target price and chart reason, or NOT IDENTIFIABLE.
6. TP2: target price and chart reason, or NOT IDENTIFIABLE.
7. TP3: target price and chart reason, or NOT IDENTIFIABLE.
8. REWARD:RISK: TP1 reward:risk only if entry, SL and TP1 can be read and calculated; otherwise NOT CALCULATED.
9. PATTERN: observed candidate structure or NONE IDENTIFIABLE. Explain confirmation status.
10. ENTRY CONDITION: specific observable trigger or why it is not confirmed.
11. INVALIDATION: what would disprove the setup; never invent a level.
12. SETUP QUALITY SCORE: 0–100 based on image clarity, timeframe coverage, confluence and confirmed trigger. This is evidence completeness, NOT a probability of winning.
13. TIMEFRAME EVIDENCE: H4, H1, M15 and M5 individually; state missing images, structure, key levels and conflicts.
14. CONFLUENCE AND ALTERNATIVE: agreement/conflict, strongest candidate setup, and alternative scenario.
15. RISK NOTES: sizing needs broker-verified pip/point value, contract size, account currency and costs. Never assume XAUUSD specifications.
16. LIMITATIONS AND CHECKLIST: news was not checked; independently verify prices, spread, news, and the setup on the broker chart.

Prefer WAIT or NO TRADE if evidence is weak. Never promise profit, describe a score as win probability, claim thousands of patterns were automatically detected, or execute trades.`;

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
