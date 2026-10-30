const MAX_BODY_BYTES = 9 * 1024 * 1024;
const ALLOWED_PAIRS = new Set(["BTCUSD", "AUDUSD", "XAUUSD"]);

const STRATEGY_LIBRARY = {
  XAUUSD: `XAUUSD CANDIDATE STRATEGIES (screen all; only select those supported by uploaded charts and verified data):
1 Asian Range Fade (MR): ADX(H4)<20, fade range edge toward midpoint; stop beyond edge.
2 Bollinger Extreme Fade (MR): H1 close outside 2.2σ band + ADX<20; target middle band; stop 1×ATR(H1).
3 London Fakeout Fade (VS): London breaks Asian high/low then returns inside within 3 candles; fade; stop beyond spike, target opposite edge.
4 London Breakout (BO): Asian-range break and successful retest; stop structural opposite side; target 1.5× range.
5 Opening Range Break (BO): break 11:00–12:00 EAT candle; stop opposite end; target 1.5× height.
6 VWAP Magnet (MR): >$8 from verified session VWAP around 14:00 EAT; fade only with rejection; stop 1.5× deviation.
7 CPI Spike Fade (VS): wait 15 minutes; fade only after reversal retraces 70% of measured spike; target pre-release price.
8 NFP Fade (VS): same measured-reversal logic, no entry before 15 minutes after release.
9 Trend Pullback (PB): above rising H1 EMA50; pullback to EMA20 with confirmation; stop below EMA50, target prior swing high.
10 Daily RSI-2 Extreme (MR): D1 RSI(2)<10 buy / >90 sell; stop 1×ATR(D1), target EMA10; one trade/day.
11 $25 Round-Number Rejection (MR): first 30m rejection after $15+ run; stop $4 beyond level; target VWAP.
12 Overnight Stretch Fade (MR): >$12 from 22:00 EAT by 09:00, no catalyst; fade toward 22:00 price; stop $5 beyond extreme.
13 Double-Touch Ranger (MR): H1 level rejected twice within 6h; trade away; stop $3 beyond level, target VWAP.
14 Failed 5-Day High (VS): new 5-day high closes back below; sell; stop $3 above high, target 5-day midrange.
15 NY Open Momentum (BO): 15:30 EAT break of London range with rising ADX; stop London midpoint; target 1× range.
16 Late NY Fade (MR): at 19:00 EAT, move >$8 without news; fade toward 15:30 price; stop 1×ATR(H1).
17 Keltner Compression Revert (MR): multi-week Bollinger squeeze and first outer-band tag, ADX<20; target midline, stop 1×ATR.
18 Consecutive-Close Stretch (MR): 6+ H1 closes one way; fade only on reversal confirmation; stop beyond run, target SMA20.
19 EMA200 Gravity (MR): >$25 from H1 EMA200, ADX<25; target EMA200, stop 1.5×ATR.
20 Yesterday Range Fade (MR): yesterday range >1.5× 20-day average; fade first failed break; target yesterday midpoint, stop 1×ATR(H1).
21 Weekly Open Fade (MR): by Wednesday >$35 from weekly open, ADX<20; target weekly open only after H4 confirmation; stop 1×ATR(D1).
22 Prior-Day Break Retest (BO): yesterday high breaks and holds 4 H1 candles; buy retest; stop $3 below, target 1×ATR(D1).
23 H4 Inside Bar at Extreme (MR): break toward range interior; stop beyond mother bar, target range midpoint.
24 FOMC Fade (VS): wait 15 minutes after release, fade only a 70% retracement of measured spike; half risk.
25 Friday Reversal (MR): Friday 17:00 EAT weekly move >$30; fade toward verified weekly VWAP; stop $5 beyond extreme; flat by 23:00.
`,
  BTCUSD: `BTCUSD CANDIDATE STRATEGIES (screen all; only select those supported by uploaded charts and verified data):
26 2σ VWAP Fade (MR): price ≥2σ from verified intraday VWAP; wait for rejection; target VWAP, stop 1.5× deviation.
27 Asian Range Fade (MR): fade range edge toward center only in tested low-volatility range; stop 0.6% beyond edge.
28 Bollinger Extreme (MR): H1 close outside 2.2σ band + ADX<20; target mid-band, stop 1×ATR(H1).
29 Daily RSI-2 Extreme (MR): D1 RSI(2)<10 buy / >90 sell; stop 1×ATR(D1), target EMA10.
30 Consecutive-Candle Fade (MR): 7+ H1 candles same direction; require reversal confirmation; stop beyond run, target SMA20.
31 Overnight Stretch Fade (MR): >4% from 22:00 EAT by 09:00 with no verified headline; fade toward 22:00 price; stop 1.5% beyond extreme.
32 Failed Prior-Day Break (VS): yesterday high/low breaks then returns inside within 4 candles; fade; stop 0.5% beyond spike, target range midpoint.
33 London Momentum (BO): Asian-range break with rising ADX and retest/close confirmation; stop opposite edge, target 1.5× range.
34 NY Momentum (BO): London-range break at NY open with verified volume expansion; stop London midpoint, target 1× range.
35 CME Gap Fill (MR): only if actual CME futures close/gap is supplied and gap >0.5%; target gap fill; stop 1× gap beyond; Monday timing is not a guarantee.
36 Round-Number Fade (MR): first H1 rejection at $1,000/$5,000 level after 3% run; stop 0.7% beyond level, target VWAP.
37 ETF-Flow Spike Fade (VS): verified ETF headline spike ≥2%, retraces 70% within 2h; target pre-headline price, stop beyond extreme.
38 Trend Pullback (PB): above rising H1 EMA50; confirmed pullback to EMA20; stop below EMA50, target prior swing high.
39 Weekend Range Fade (MR): only within confirmed 24h range and adequate spread; fade edge to center, stop 0.8% beyond edge.
40 Weekly Open Fade (MR): by Wednesday >8% from weekly open, ADX<20; H4 confirmation; stop 2% beyond extreme.
41 Volatility Squeeze Break (BO): verified 10-day Bollinger squeeze; expansion close and retest; stop squeeze midline, target 2× squeeze height.
42 RSI Divergence (MR): new 3-day low with higher H4 RSI(14) low; buy only after reclaim; stop under divergence low, target prior swing high.
43 H4 Inside Bar at Multi-Day Extreme (MR): break toward interior; stop beyond mother bar, target midrange.
44 Yesterday Range Fade (MR): yesterday range >1.6× 20-day average; fade failed first break; stop 1×ATR(H1), target midpoint.
45 EMA200 Gravity (MR): >3.5% above H1 EMA200 and ADX<25; target EMA, stop 1.5×ATR.
46 FOMC Spike Fade (VS): 15 minutes after release, measured 70% retracement; stop beyond spike; half risk.
47 Sunday Open Fade (MR): Sunday move >2% without verified headline; require failed move; target Friday close, stop 1.2% beyond extreme.
48 7-Day Box Break Retest (BO): confirmed break and retest of 7-day consolidation; stop box center, target 1× box height.
49 14-Day Range Break (BO): break and retest of 14-day range; stop range midpoint, target 1× height.
50 Gold Confirmation (BO): XAUUSD and BTC break same direction in same NY hour; only contextual confirmation, require BTC trigger; stop 0.7%, target 1.5R.
`,
  AUDUSD: `AUDUSD CANDIDATE STRATEGIES (screen all; only select those supported by uploaded charts and verified data):
51 Asian Range Fade (MR): ADX<20; fade box edge to midline; stop 10 pips beyond edge.
52 Bollinger Extreme (MR): H1 close outside 2.2σ band + ADX<20; target mid-band, stop 1×ATR(H1).
53 Daily RSI-2 Extreme (MR): D1 RSI(2)<10 buy / >90 sell; stop 1×ATR(D1), target EMA10.
54 London Breakout (BO): Asian-range break with retest hold; stop opposite range side, target 1.5× range.
55 Opening Range Break (BO): break 11:00–12:00 EAT candle; stop opposite end, target 1.5× height.
56 London Fakeout Fade (VS): break Asian extreme then close back inside within 3 candles; fade; stop 6 pips beyond spike, target opposite edge.
57 VWAP Magnet (MR): >25 pips from verified session VWAP around 14:00 EAT; fade only with rejection; stop 1.5× deviation.
58 Gold Confirmation (BO): gold and AUDUSD break same direction at same session open; confirmation only, require AUDUSD trigger; stop 10 pips, target 1.5R.
59 RBA Spike Fade (VS): wait 15 minutes after verified RBA release; fade only >20-pip spike retracing 70%; stop beyond extreme.
60 Trend Pullback (PB): above rising H1 EMA50 from London; confirmed EMA20 pullback; stop below EMA50, target prior high.
61 Round-Number Rejection (MR): first H1 rejection at 25-pip level after 40-pip run; stop 8 pips beyond, target VWAP.
62 Consecutive-Close Stretch (MR): 6+ H1 closes same direction; fade 7th only on reversal confirmation; stop 12 pips beyond run, target SMA20.
63 Double-Touch Ranger (MR): level rejected twice within 6h; trade away; stop 8 pips beyond, target VWAP.
64 NY Open Momentum (BO): 15:30 EAT London-range break with rising ADX; stop London midpoint, target 1× range.
65 Failed 5-Day High (VS): new 5-day high closes back below; sell; stop 8 pips above high, target 5-day midrange.
66 Late NY Fade (MR): at 19:00 EAT move >25 pips without news; fade toward 15:30 price; stop 1×ATR(H1).
67 H4 Inside Bar at Extreme (MR): break toward range interior; stop beyond mother bar, target range midpoint.
68 Yesterday Range Fade (MR): range >1.5× 20-day average; fade failed first break; stop 1×ATR(H1), target midpoint.
69 EMA200 Gravity (MR): >60 pips from H1 EMA200, ADX<25; target EMA, stop 1.5×ATR.
70 Weekly Open Fade (MR): by Wednesday >80 pips from weekly open, ADX<20; H4 confirmation; stop 1×ATR(D1).
71 Prior-Day Break Retest (BO): yesterday high breaks and holds 4 H1 candles; buy retest; stop 8 pips below, target 1×ATR(D1).
72 China Data Spike Fade (VS): verified China-data move ≥25 pips reverses 70% within 1h; target pre-release price, stop beyond spike.
73 AUDNZD Cross-Check (MR): do not assume shared AUD strength means USD-driven stretch; require independent AUDUSD extreme/reversal and actual AUDNZD chart before using cross-confirmation.
74 Friday Reversal (MR): Friday 17:00 EAT weekly move >120 pips; fade toward verified weekly VWAP; stop 15 pips beyond extreme, flat by 23:00.
75 10-Day Box Break (BO): confirmed break and retest of 10-day consolidation; stop box center, target 1× box height.
`
};

const GLOBAL_STRATEGY_RULES = `GLOBAL STRATEGY RULES (internal decision logic):
- Risk budget: default maximum 1% equity risk per trade; stop new trades at -3% daily and -6% weekly. These are configurable guardrails, not guarantees. Do not imply the site can automatically close trading accounts unless it actually has broker execution integration.
- News blackout: no new entries from 30 minutes before to 30 minutes after a verified high-impact release relevant to the instrument: Fed/CPI/NFP for USD and gold, RBA for AUDUSD, major verified crypto-regulation headlines for BTCUSD. If calendar/headline data is unavailable, clearly say blackout status cannot be verified; do not claim a calendar check.
- Regime filter: use actual H4 ADX(14) only if readable/calculable from supplied candle data. ADX<20 permits testing MR/VS; ADX>25 permits BO/PB; 20–25 reduce planned risk by half. ADX is not directional. If ADX cannot be verified, label regime filter unknown rather than inventing a value.
- EAT reference windows: Asia 03:00–10:00; London 11:00–14:00; New York 15:30–19:00. BTCUSD trades 24/7. These are approximate and shift with daylight saving; use them as context, not proof of an edge.
- Strategy selection: treat library entries as hypotheses, not proven profitable systems. Screen the applicable library and return the best-supported setup(s), preferably 1–3, only when required inputs are visible. Identify strategy number/name, family (MR/BO/PB/VS), market regime, observed trigger, entry zone, stop, target(s), timeframe, risk in R, invalidation and no-trade/news/data limitations. Never invent ADX, ATR, VWAP, Bollinger standard deviations, volume, event times, ETF flows, CME gaps, historical averages, price levels or correlations when not visible/verified. For unavailable indicators, state the missing input and use chart-visible alternatives or WAIT.
- Direction: explicitly select BUY or SELL when evidence supports a direction; otherwise WAIT/NO TRADE. An untriggered setup must be labeled WAITING FOR TRIGGER, not READY. Compare opposite-side scenarios and avoid forced signals.
- No claimed win-rate bands: the supplied 65–78%, 60–70%, etc. are unverified user-provided estimates, not established facts. Never display them as proven probabilities. Require at least 200 historical trades per setup, realistic spread/slippage/fees, out-of-sample and walk-forward testing before estimating expectancy; demo forward-test before live use. Do not bench a strategy based on an arbitrary win-rate threshold alone; assess expectancy, drawdown and sample uncertainty.
- USD-major strategies 76–100 are outside the platform's supported trade instruments. Do not recommend EURUSD, USDJPY, GBPUSD or DXY trades; DXY may only be contextual evidence if actually supplied. `;

const SUPPLEMENTAL_STRATEGIES = {
  XAUUSD: `ADDITIONAL XAUUSD SETUPS (candidate filters; NOT verified >75% win-rate systems):
XAU-26 Liquidity Sweep + Reclaim (MR/VS): price sweeps a clearly marked prior-day/session high or low, then closes back inside and retests/rejects it. Enter after reclaim confirmation; stop beyond sweep extreme; target range midpoint first, opposite liquidity only if structure supports it.
XAU-27 H4 Trend + H1 Higher-Low Pullback (PB): H4 trend has clear HH/HL (or LH/LL); H1 pullback reaches prior structure/EMA20–50 zone and prints rejection. Enter after trigger close; stop beyond swing; target next H4 swing, minimum planned 1.5R.
XAU-28 Breakout Acceptance (BO): H1 closes beyond a multi-touch level, next candle holds outside and retest succeeds. Avoid wick-only breaks; stop behind retest; target measured range/next HTF level.
XAU-29 Failed Breakdown Reclaim (MR): price trades below a well-defined range low, closes back above, then holds a retest. Buy only after reclaim; stop below sweep low; target range midpoint then high if momentum persists.
XAU-30 Inside-Bar Compression + HTF Alignment (BO): H4 inside bar forms near a defined level; take only a confirmed break in H4 trend direction with follow-through/retest; stop beyond mother-bar opposite side; target next HTF level.
XAU-31 Two-Leg Pullback Continuation (PB): strong H1 impulse aligned with H4; two-leg corrective move reaches broken structure, then a clear rejection/engulfing close. Stop beyond correction; target impulse high/next resistance.
XAU-32 Range Failure at Value (MR): in verified low-ADX range, price rejects an outer boundary and re-enters; require room to midpoint greater than costs and risk. Stop beyond rejection; target midpoint.
XAU-33 Post-News Structure Reset (VS/PB): do not fade news by clock alone. After blackout, wait for initial range, then trade only a confirmed reclaim/retest or continuation with spread normalised; stop beyond post-news swing.
`,
  BTCUSD: `ADDITIONAL BTCUSD SETUPS (candidate filters; NOT verified >75% win-rate systems):
BTC-51 Prior-Day Sweep + Reclaim (MR/VS): sweep prior-day high/low and close back inside; require retest rejection and venue-consistent candles. Stop beyond sweep; target day-range midpoint.
BTC-52 H4 Trend + H1 Pullback (PB): clear H4 HH/HL or LH/LL; H1 pullback to prior breakout level/EMA zone with rejection. Stop beyond swing; target next H4 swing; reduce size in high volatility.
BTC-53 Consolidation Acceptance Break (BO): multi-session box with repeated tests; H1 close outside, successful retest, and expansion supported by actual volume if available. Stop back inside box; target box height/next HTF level.
BTC-54 Failed Breakdown Reclaim (MR): price sweeps range low then closes and holds back above it; enter on retest, stop below sweep, target midpoint then range high.
BTC-55 Funding/OI Divergence Filter (MR/VS): only when reliable same-venue funding and open-interest data exist; crowded positioning is context, never a standalone signal. Require price sweep/reclaim; structural stop; target VWAP/range midpoint.
BTC-56 Weekend Range Rejection (MR): define actual rolling 24h range and verify spread/liquidity; fade boundary only after rejection/re-entry, never because it is weekend alone. Stop beyond extreme; target center.
BTC-57 Impulse Base Retest (PB): strong displacement breaks structure, then price retests the impulse base/old level and holds. Stop beyond retest swing; target continuation swing; avoid late entries with poor R.
BTC-58 Volatility Expansion After Squeeze (BO): verified low-range compression followed by close outside box and successful retest. Stop inside box; target measured box height; no trade if stop distance makes reward/risk poor.
`,
  AUDUSD: `ADDITIONAL AUDUSD SETUPS (candidate filters; NOT verified >75% win-rate systems):
AUD-76 Prior-Day Sweep + Reclaim (MR/VS): sweep prior-day high/low, close back inside and reject retest. Stop beyond sweep; target daily range midpoint; avoid nearby scheduled AUD/USD news.
AUD-77 H4 Trend + H1 Pullback (PB): H4 HH/HL or LH/LL; H1 pullback to prior structure/EMA20–50 with rejection. Stop beyond swing; target next H4 swing; require enough room after spread.
AUD-78 Asian Box Acceptance Break (BO): mark 03:00–10:00 EAT range; H1/M15 close outside and retest holds with London participation. Stop back inside range; target 1–1.5× range only if structure supports.
AUD-79 Failed Range Break (MR): break Asian/prior-day boundary fails and closes back inside; enter after retest rejection. Stop beyond false-break extreme; target midpoint/opposite edge.
AUD-80 AUD/USD Relative-Strength Check (filter): compare only with actual AUDNZD/AUDJPY or verified broad-USD data if available. Use as confirmation, never as a standalone trade; correlations vary.
AUD-81 Post-RBA Structure Reset (VS/PB): wait at least 30-minute blackout, then wait for spread normalisation and a confirmed break/retest or reclaim. No automatic spike fade.
AUD-82 Multi-Timeframe Level Confluence (MR/PB): H4 support/resistance overlaps prior-day level and H1 rejection; enter only after trigger candle; stop beyond confluence swing; target next opposing level with positive net R.
AUD-83 Compression-to-Expansion Retest (BO): narrow multi-session range breaks, closes outside and retests successfully; stop inside range; target range-height projection/next daily level.
`
};

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

Uploaded timeframes: ${present.join(", ")}. Preferred complete set: H4, H1, M15, M5, M30, D1. Missing images must be called out. User direction preference: ${payload.direction || "Undecided"}. Levels: ${JSON.stringify(payload.levels || {})}. Thesis: ${String(payload.thesis || "")}. Invalidation: ${String(payload.invalidation || "")}. Notes: ${JSON.stringify(payload.timeframeNotes || {})}. No verified live price/news data is supplied.\n\nMARKET-SPECIFIC RESEARCH FRAMEWORK: ${MARKET_RESEARCH[pair]}

GLOBAL STRATEGY RULES: ${GLOBAL_STRATEGY_RULES}

RELEVANT STRATEGY CATALOG: ${STRATEGY_LIBRARY[pair]}

ADDITIONAL CANDIDATE SETUPS: ${SUPPLEMENTAL_STRATEGIES[pair]}\n\nTHREE-MARKET OPERATING PLAYBOOK (use as a framework to evaluate, not as a mandatory signal):
- XAUUSD is the primary research focus. Prefer an Asian-range breakout only after a candle closes beyond the marked range and a retest holds, with H4/H1 structure aligned. Define the stop beyond the retest swing or structural invalidation. A range-height target is only a planning reference, not guaranteed; require visible structure and realistic costs. Skip an abnormally wide Asian range only if a trustworthy 20-day range baseline is actually supplied. Never invent it.
- BTCUSD is the volatility-focused market and trades 24/7. Consider intraday VWAP mean reversion only if VWAP and volume are visible or supplied as reliable data. A 2-standard-deviation band must be calculated from actual session data; never infer it from a screenshot without the values. Wait for rejection/reclaim toward VWAP, use BTC-specific structure for the stop, reduce size for volatility, and treat weekends as a separate tested regime.
- AUDUSD is the trend-confirmation / standalone trend market. Assess it independently. Its agreement with gold may add context, but correlations are unstable and do not prove a trade. Disagreement should trigger reassessment or skipping; do not automatically halve size unless that sizing rule has been tested.
- Routine reference in Nairobi time (EAT): 06:00–08:00 preparation and Asian range mapping (no entries in this plan); 11:00–14:00 London range-break/retest watch; 15:30–19:00 New York / US-data reaction watch after the first spike; weekends BTC only under a separately tested rule. These are approximate planning windows, not verified volatility schedules. London/New York daylight-saving changes shift their EAT timing; no current calendar was supplied, so do not claim a current event check.
- Risk framework: suggested maximum 1% equity risk per trade and stop taking new trades for the day at a 3% loss. These are user-defined guardrails, not a guarantee or universally optimal setting. Never encourage increasing size to recover losses. Reduce exposure or stand aside around uncertain spreads, slippage and high-impact releases.
- Evaluate results by instrument, setup and session in the journal. A 55% win rate with 2:1 average reward/risk has positive theoretical expectancy before costs, but does not guarantee green weeks. Three +2R winners and two -1R losers equal +4R over five trades (60% wins), not 55%. Never state that daily profit is mechanically assured.
\nDEEP-RESEARCH DISCIPLINE: Treat established technical-analysis principles as testable hypotheses, not laws. Distinguish direct chart observations, context hypotheses and verified external facts. Do not claim to have researched live web/news, checked a calendar or reviewed historical candles unless that data is actually supplied. Never claim a setup is high-probability without validated backtest statistics for this same instrument, timeframe, costs and regime. Compare continuation, pullback and failed-break scenarios. Include spread/fees/slippage and structural invalidation in the decision. Disclose if high-impact event status is unknown.

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
