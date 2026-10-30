const MAX_BODY_BYTES = 9 * 1024 * 1024;
const ALLOWED_PAIRS = new Set(["BTCUSD", "AUDUSD", "XAUUSD"]);

const MARKET_RESEARCH = {
  BTCUSD: "BTCUSD MARKET PROFILE: Bitcoin is a 24/7 market and has no single official global spot price. Treat the user's broker/exchange feed as execution truth; never combine levels from different venues as if identical. Analyze regime first: directional trend, balanced range, high-volatility expansion, or compression. Look for prior-day/week highs and lows, equal highs/lows, range edges, break-and-retest, failed breakouts, impulse/displacement and pullback quality. Consider Asia/Europe/US activity and US equity/ETF benchmark windows as volatility/liquidity context only, never as a directional signal by itself. If supplied by verified data, consider spot volume, futures basis, funding, open interest and liquidation events; do not invent these. Treat weekends, thin liquidity, exchange outages, major crypto regulatory/macro news, ETF flows and large scheduled US data as risk context. Do not assume a liquidity sweep must reverse; require a reclaim/rejection or follow-through candle on a stated timeframe.",
  AUDUSD: "AUDUSD MARKET PROFILE: AUDUSD is quoted as USD per AUD; a rising quote means AUD strength versus USD. Evaluate relative RBA versus Federal Reserve rate expectations, Australian/US inflation and employment, China/commodity-sensitive risk appetite, broad USD direction, iron ore/commodity context and equity-risk sentiment when verified data is available. These are context, not mechanical signals: correlations change by regime. Mark Asian-session structure and London/US overlap, and account for scheduled RBA/Fed decisions, CPI, jobs, GDP and major China releases. Prefer price confirmation (trend/swing structure, break-retest, pullback, rejection) over assuming a macro headline dictates the next candle. If no current calendar/news feed is available, explicitly say the event check was not performed.",
  XAUUSD: "XAUUSD MARKET PROFILE: Gold is quoted in USD per troy ounce on most retail feeds, but broker CFDs may differ from spot/futures. Use the uploaded broker chart for execution levels. Consider US real yields, nominal yields, USD direction, inflation/rate expectations, central-bank and ETF demand, geopolitical risk, and momentum/positioning only when current trustworthy data is supplied. The gold–USD and gold–yield relationships are regime-dependent and can diverge; never apply them as fixed inverse rules. Examine Asian and US-session structure, prior-day/week extremes, opening-range behavior, impulse/pullback, failed breaks and event-driven volatility. Around CPI, PCE, NFP, FOMC/Fed speakers and geopolitical shocks, note spread/slippage risk and avoid inventing a news explanation. Separate macro bias from chart trigger and invalidate a trade if price structure breaks the thesis."
};

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

Uploaded timeframes, in review order: ${present.join(", ")}. Preferred full set: H4, H1, M15, M5, M30, D1. Missing timeframes must be identified rather than imagined. User-selected direction: ${payload.direction || "Undecided"}. User-entered levels: ${JSON.stringify(payload.levels || {})}. Thesis: ${String(payload.thesis || "")}. Invalidation: ${String(payload.invalidation || "")}. Timeframe notes: ${JSON.stringify(payload.timeframeNotes || {})}. Current verified live price/news data was NOT supplied; do not claim to have checked it.\n\nMARKET-SPECIFIC RESEARCH FRAMEWORK: ${MARKET_RESEARCH[pair]}\n\nTHREE-MARKET OPERATING PLAYBOOK (use as a framework to evaluate, not as a mandatory signal):
- XAUUSD is the primary research focus. Prefer an Asian-range breakout only after a candle closes beyond the marked range and a retest holds, with H4/H1 structure aligned. Define the stop beyond the retest swing or structural invalidation. A range-height target is only a planning reference, not guaranteed; require visible structure and realistic costs. Skip an abnormally wide Asian range only if a trustworthy 20-day range baseline is actually supplied. Never invent it.
- BTCUSD is the volatility-focused market and trades 24/7. Consider intraday VWAP mean reversion only if VWAP and volume are visible or supplied as reliable data. A 2-standard-deviation band must be calculated from actual session data; never infer it from a screenshot without the values. Wait for rejection/reclaim toward VWAP, use BTC-specific structure for the stop, reduce size for volatility, and treat weekends as a separate tested regime.
- AUDUSD is the trend-confirmation / standalone trend market. Assess it independently. Its agreement with gold may add context, but correlations are unstable and do not prove a trade. Disagreement should trigger reassessment or skipping; do not automatically halve size unless that sizing rule has been tested.
- Routine reference in Nairobi time (EAT): 06:00–08:00 preparation and Asian range mapping (no entries in this plan); 11:00–14:00 London range-break/retest watch; 15:30–19:00 New York / US-data reaction watch after the first spike; weekends BTC only under a separately tested rule. These are approximate planning windows, not verified volatility schedules. London/New York daylight-saving changes shift their EAT timing; no current calendar was supplied, so do not claim a current event check.
- Risk framework: suggested maximum 1% equity risk per trade and stop taking new trades for the day at a 3% loss. These are user-defined guardrails, not a guarantee or universally optimal setting. Never encourage increasing size to recover losses. Reduce exposure or stand aside around uncertain spreads, slippage and high-impact releases.
- Evaluate results by instrument, setup and session in the journal. A 55% win rate with 2:1 average reward/risk has positive theoretical expectancy before costs, but does not guarantee green weeks. Three +2R winners and two -1R losers equal +4R over five trades (60% wins), not 55%. Never state that daily profit is mechanically assured.
\nDEEP-RESEARCH DISCIPLINE: Use established technical-analysis principles as hypotheses, not laws. Distinguish direct chart observations, market-context hypotheses, and verified external facts. Do not claim you have researched the live web, consulted a current calendar, or reviewed actual historical candles unless that data is provided to this request. Never call a pattern "high probability" without validated backtest statistics for the same instrument, timeframe, costs and market regime. Compare trend-continuation, pullback and failed-break scenarios. Check whether the setup offers enough reward relative to a structurally defensible stop after spread/fees/slippage. If a scheduled high-impact event is unknown, disclose that limitation.

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
