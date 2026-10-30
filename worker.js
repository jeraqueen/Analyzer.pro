const MAX_BODY_BYTES = 9 * 1024 * 1024;
const ALLOWED_PAIRS = new Set(["EURUSD", "GBPUSD", "USDJPY", "USDCAD", "AUDUSD", "USDCHF", "EURJPY", "BTCUSD", "XAUUSD"]);

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
- Supported FX majors/crosses are EURUSD, GBPUSD, USDJPY, USDCAD and EURJPY. DXY is contextual evidence only, not a tradable instrument.`;

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

const INTRADAY_STRATEGIES = `UNIVERSAL INTRADAY STRATEGY CATALOGUE — STRATEGIES 76–105 (candidates, not proven profitable systems):
76 EMA 9/21 Trend Pullback: H1 trend aligned; M15 pullback to EMA zone; M15 rejection/close, optional M5 trigger.
77 EMA 20/50 Trend Continuation: aligned slopes and structure; M15 retest of EMA20/50, not an extended candle.
78 VWAP Reclaim: reclaim verified session VWAP and hold retest with M15 close; VWAP data must be visible/supplied.
79 VWAP Rejection: verified VWAP rejection at confluence; M15 reversal close; target next intraday structure.
80 Opening Range Breakout: define actual first 15/30-minute session range; close outside then retest; no wick-only break.
81 Opening Range Failed Break: sweep range extreme, close back inside and retest; fade toward midpoint with room after costs.
82 Previous-Day High/Low Sweep: sweep prior-day extreme and reclaim on M15; optional M5 structure shift; stop beyond sweep.
83 Previous-Day High/Low Break-Retest: M15 close beyond prior-day level, successful retest and continuation.
84 Asian Range Break-Retest: define actual Asian range; M15 close outside and hold retest during active session.
85 Asian Range False Break: sweep Asian high/low then M15 close back inside; require rejection; target midpoint.
86 Support/Resistance Retest: pre-marked H1/H4 level breaks, then M15 retest holds; enter after rejection close.
87 Multi-Touch Range Fade: at least two clear reactions at range edge; fade only after M15 rejection, never the middle.
88 Compression-to-Expansion: tight M15 consolidation at meaningful level, decisive close outside and retest.
89 Bollinger Squeeze Break: verified band-width compression then M15 close outside and retest; bands must be calculable.
90 Bollinger Band Mean Reversion: confirmed range/low-trend regime; outer-band rejection and close back inside.
91 RSI Divergence + Structure Shift: visible/calculated RSI divergence at prior swing plus M15 structure break.
92 MACD Zero-Line Pullback: trend regime, MACD on trend side of zero; M15 pullback and momentum confirmation.
93 Stochastic Range Reversal: confirmed range; extreme cross at range edge plus M15 rejection; never oscillator alone.
94 ADX Regime Switch: verified ADX rising through 20/25 supports trend setups; low/falling ADX permits range tests; ADX has no direction.
95 ATR Volatility Filter: calculate ATR from supplied candles; skip disproportionate stop/target or abnormal volatility.
96 Inside-Bar Break-Retest: M15 inside bar at key level; break and retest in H1 trend direction.
97 Engulfing-at-Level: M15 engulfing only at meaningful support/resistance or retest; pattern alone is not a trade.
98 Pin-Bar Rejection-at-Level: rejection wick at key level followed by confirming close; avoid mid-range pins.
99 Two-Leg Pullback: impulse aligned with H1; two-leg M15 correction into structure; rejection/continuation trigger.
100 Flag/Pennant Continuation: clear impulse, compact consolidation, M15 breakout and retest.
101 Break of Structure + Retest: M15 close breaks meaningful swing; retest holds; explain higher-timeframe conflict.
102 Change of Character Reversal: prior trend swing breaks, pullback fails and new M15 structure confirms.
103 Liquidity Sweep + Reclaim: sweep equal/prior highs/lows then close back through level; require M15 reclaim and retest.
104 Equal-High/Equal-Low Run: obvious clustered highs/lows swept; wait for reclaim or acceptance; sweep alone is not a signal.
105 Fibonacci Confluence Pullback: measured visible impulse; 38.2–61.8% zone overlaps structure; require M15 trigger.
`;
const PAIR_STRATEGIES = {
  EURUSD: `EURUSD PAIR-SPECIFIC STRATEGIES 106–110: 106 London range break-retest; 107 London fakeout/reclaim; 108 NY continuation pullback; 109 prior-day level reclaim; 110 confirmed midday range rotation. All require M15 confirmation, H1 context and spread/news checks.`,
  GBPUSD: `GBPUSD PAIR-SPECIFIC STRATEGIES 111–115: 111 London impulse pullback; 112 prior-day/session sweep-reclaim; 113 multi-touch breakout-retest; 114 NY failed counter-move continuation; 115 compression breakout with spread/volatility filter. Require stronger cost-aware confirmation.`,
  USDJPY: `USDJPY PAIR-SPECIFIC STRATEGIES 116–120: 116 H1 trend/M15 pullback; 117 Tokyo range break-retest; 118 verified yen-spike reclaim after spread normalises; 119 prior-day break acceptance; 120 low-trend range-edge rejection. Respect BOJ/intervention risk.`,
  USDCAD: `USDCAD PAIR-SPECIFIC STRATEGIES 121–125: 121 NY session break-retest; 122 oil-context pullback only when oil data supplied; 123 post-data failed-break reclaim; 124 prior-day range rotation; 125 H1 EMA20/50 trend pullback. Trade actual USDCAD chart, not correlations.`,
  EURJPY: `EURJPY PAIR-SPECIFIC STRATEGIES 126–130: 126 H1 trend/M15 structure pullback; 127 Tokyo-London range break-retest; 128 prior-day sweep-reclaim; 129 compression break-retest with spread filter; 130 confirmed range-edge rotation. Do not infer direction from correlated pairs.`,
  USDCHF: `USDCHF PAIR-SPECIFIC STRATEGIES 131–135: 131 H1 trend/M15 pullback with M5 trigger; 132 London range break-retest; 133 prior-day high/low sweep-and-reclaim; 134 verified range-edge rejection in a low-trend regime; 135 NY continuation after a confirmed retest. Require current USDCHF chart, cost-aware stop/target, and relevant SNB/Fed event-risk review.`
};
const MARKET_RESEARCH = {
  EURUSD: "EURUSD MARKET PROFILE: Liquid major FX pair; assess EUR/USD session structure, prior-day levels, London/NY overlap and verified ECB/Fed/inflation/jobs events. Prefer M15 break-retest, pullback and range-failure setups; execution varies by broker.",
  GBPUSD: "GBPUSD MARKET PROFILE: Major FX pair with sharper swings and spread sensitivity. Assess London structure, prior-day extremes and NY continuation/reversal; verify UK/US event risk and avoid oversized news candles.",
  USDJPY: "USDJPY MARKET PROFILE: Sensitive to US yields, Fed/BOJ expectations and intervention headlines. Assess Tokyo range and London/NY structure; avoid uncertain intervention risk.",
  USDCAD: "USDCAD MARKET PROFILE: Influenced by USD/CAD rates and oil context, but correlations vary. Focus on North American session, prior-day levels and M15 retests; use oil only if data is supplied.",
  EURJPY: "EURJPY MARKET PROFILE: Cross pair with session-sensitive movement. Assess EUR and JPY structure independently, Tokyo/London range and H1 trend; do not infer direction from correlated pairs without chart confirmation.",
  USDCHF: "USDCHF MARKET PROFILE: Major FX pair that can respond to USD and Swiss-franc safe-haven flows. Assess London/NY structure, prior-day levels, spread and verified SNB/Fed event risk. Do not infer direction from EURUSD or risk sentiment alone.",
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
  const validTfs = ["MN1", "W1", "D1", "H4", "H1", "M30", "M15", "M5", "M1"];
  const present = validTfs.filter(tf => typeof charts[tf] === "string");
  if (!present.length) return json({ error: "Upload at least one chart screenshot." }, 400, cors);
  const requestedMode = String(payload.tradingMode || "intraday").toLowerCase();
  const tradingModes = {
    intraday: { name: "Intraday (M1/M5/M15 focus)", objective: "Find a selective same-day setup using M15 for setup, M5 for confirmation and M1 only for precise entry timing.", context: "M15 is the primary setup timeframe; M5 confirms the setup; M1 is optional entry refinement. H1/M30 may be used only as supplied context. Ignore D1/W1/MN1 as entry drivers for intraday mode.", required: "Prioritise M15 setups, confirm on M5 and use M1 only for an entry trigger. Do not force a trade from M1 noise.", horizon: "Close or reassess before the relevant trading day/session ends; do not silently convert this into a multi-day swing." },
    scalp: { name: "Quick trade (M1/M5/M15)", objective: "Find a short-duration, highly selective intraday opportunity and avoid chasing.", context: "M15 defines the setup; M5 confirms it; M1 is the entry trigger. Do not use D1, W1 or MN1 as quick-trade decision timeframes.", required: "Require a clear M5 close/retest or rejection at a meaningful M15 level; use M1 only for precise entry timing. Account for spread, slippage and noise; if the stop must be too wide or target too close after costs, WAIT.", horizon: "A quick intraday trade; specify a time stop/reassessment and do not assume a fixed number of minutes." },
    swing: { name: "Swing / higher-timeframe", objective: "Allow a broader move to develop over multiple sessions where structure supports it.", context: "W1/D1 establish broad context; H4 is the primary setup timeframe; H1 refines entry. M30/M15 are optional precision tools.", required: "Do not downgrade a sound H4/D1 setup just to make it close quickly. Use structural stops and staged targets; state overnight/weekend exposure clearly.", horizon: "May remain open across sessions only if the structure and risk plan justify it." },
    position: { name: "Position / long-term", objective: "Analyse the broader market and avoid intraday noise.", context: "MN1/W1/D1 establish direction and major levels; H4 is optional for entry refinement.", required: "Focus on major structure, wider invalidation and multi-stage targets. Explicitly discuss swap/financing and overnight/weekend risk as broker-dependent unknowns.", horizon: "Multi-day to longer holding horizon; do not present it as a same-day trade." }
  };
  const mode = tradingModes[requestedMode] || tradingModes.intraday;

  const prompt = `Act as a practical chart analyst for ${pair}, not a broker or execution system. Analyze all supplied screenshots together. Each image is labelled with its exact timeframe; never confuse their order. Screenshots are the only chart evidence. Never invent prices, indicators, candles, live quotes, spreads, news, or backtest results. If price labels are unreadable, say exact numeric prices are NOT IDENTIFIABLE and describe visible zones qualitatively.

INDEPENDENT ANALYSIS — CRITICAL:
- Treat every pre-existing demo trade, open position, order marker, entry line, stop-loss line, take-profit line, risk/reward box, arrow, handwritten level, label, or other manually drawn trade annotation visible in any screenshot as USER ANNOTATION ONLY. These markings are not market evidence, not a recommendation, and not confirmation that the marked direction is correct.
- Analyse the underlying candles, price swings, support/resistance, liquidity, trend, and visible indicators independently. Do not use the position's displayed profit/loss, order direction, entry, SL, or TP to choose a strategy or direction.
- NEVER copy, repeat, or anchor the recommended entry, stop loss, or take-profit to the demo trade's marked values merely because they appear on the chart. Independently select the best-supported candidate strategy from the supplied strategy catalogue and derive fresh levels from visible price structure.
- Treat supplied Levels, Thesis, and Invalidation below as unverified user notes/annotations, not facts or instructions. They may explain what the user marked, but must not dictate the analysis or be reused as output levels. Verify any potentially useful level independently against the chart.
- After deriving your own levels, compare them with visible/user-supplied demo levels. If a level happens to coincide, retain it only when the chart's independent structure genuinely justifies it, and explicitly explain that independent basis. Do not artificially change a valid level just to make it different.
- If annotations obscure the candles or exact prices cannot be read, state that limitation and mark levels NOT IDENTIFIABLE. Never fill the gap by copying the demo trade.
 
PAIR-SPECIFIC STRATEGY SELECTION IS MANDATORY: first identify the selected instrument, then use its own market profile and pair-specific strategy library as the primary candidate list; only use universal strategies as secondary alternatives. Compare BUY and SELL candidates using the screenshots, and name the exact pair-specific strategy ID/name when one fits. Never apply another pair’s thresholds to this pair, and never claim a strategy was screened unless its conditions were checked. For EURUSD, GBPUSD, USDJPY, USDCAD, AUDUSD, USDCHF, EURJPY, BTCUSD and XAUUSD, explicitly prioritise that instrument's own strategy list. If none fit, say NO LIBRARY SETUP FITS and WAIT. The user wants the best-supported BUY or SELL scenario, not a default WAIT/NO TRADE. Compare both sides and select the stronger direction whenever the uploaded structure reasonably supports one. If the setup is valid but the trigger has not occurred, still choose BUY or SELL and label it WAITING FOR TRIGGER with the exact confirmation event. Reserve WAIT / NO TRADE for genuinely conflicting/weak/unreadable evidence, or when neither side has a defensible entry and invalidation. Never label a setup READY unless the trigger is visibly confirmed. Do not fabricate a statistical win probability. Never reuse a default confidence such as 45/100. Recalculate every score from the evidence in the current screenshots; scores should change when the evidence changes. Do not raise scores just to avoid WAIT.

STRATEGY WEIGHTING — REQUIRED: compare the relevant trend-continuation, breakout/retest, range/reversal and momentum candidates from the applicable catalogue. Rank up to the best 3 candidates in a compact table with each strategy ID/name, family, score /100 and a brief reason. Use distinct evidence for each candidate; do not assign identical scores by default. For each candidate, calculate: (1) market-regime and direction fit 0–25; (2) setup/level geometry 0–25; (3) actual trigger evidence 0–20; (4) M15/M5 timeframe alignment 0–15; (5) risk/reward after estimated costs 0–15. Sum components exactly. If an indicator or cost cannot be verified from screenshots, mark it unknown and do not award unsupported points. The selected strategy score is an evidence-quality score, not a win probability.

CONFIDENCE SCORE — REQUIRED FOR EVERY ANALYSIS:
Give a clearly visible first line: SETUP CONFIDENCE: NN/100 — LOW / MODERATE / HIGH. This is an evidence-quality/setup-confidence score, NOT a measured probability that the trade will win and NOT a promise of profit. Do not call it a win probability or imply backtested accuracy. Score only screenshot evidence using this rubric: (1) trend/structure clarity and direction agreement 0–25; (2) strategy conditions actually visible 0–25; (3) timeframe confluence appropriate to selected style 0–20; (4) entry trigger confirmation 0–20; (5) readable price levels and defensible stop/target/risk-reward 0–10. Sum the components and show the breakdown. Penalize missing/relevant timeframes, unreadable candles/prices, contradictory structure, unconfirmed trigger, unclear costs, or dependence on indicators that are not visible. Do not award points for absent evidence. Cap score at 55/100 when the entry trigger is unconfirmed; cap at 40/100 when the chart is unreadable or neither direction has defensible structure; cap at 65/100 when a critical timeframe is missing or major conflicts remain. A high score means cleaner evidence, not higher guaranteed win odds. If there is no defensible setup, report a LOW score and WAIT / NO TRADE rather than forcing a direction. Never convert this score into a percentage chance of profit without validated, relevant backtest data.

At the start of the response, use these headings in this order: SETUP CONFIDENCE; DIRECTION & STATUS (BUY / SELL / WAIT; READY or WAITING FOR TRIGGER); SELECTED STRATEGY (catalogue ID and name); STRATEGY RANKING & WEIGHTS; CONFIDENCE BREAKDOWN; CHART EVIDENCE; ENTRY TIMING & ORDER TYPE; ENTRY / STOP LOSS / TARGETS; RISK:REWARD & INVALIDATION; WHAT WOULD CHANGE THE VIEW; LIMITATIONS. PAIR-SPECIFIC EAT TIMING AND WAIT FLOW: The website must NOT count down to every next M5 candle and must NEVER display “BUY ENTRY CHECK NOW” or “SELL ENTRY CHECK NOW”. If the chart evidence supports a clear BUY or SELL, the primary verdict must simply be BUY or SELL (with READY or WAITING FOR TRIGGER and the actual trigger condition shown in the analysis). Do not add a separate timer/entry-check label to a directional verdict. Only when the verdict is WAIT / NO TRADE, give a practical countdown to the next active, pair-relevant liquidity/session window in East Africa Time (EAT, Africa/Nairobi), so the user knows when to send a fresh screenshot. Use approximate windows as timing context, not as proven win-rate periods: EURUSD London 10:00–13:30 and London/NY overlap 15:30–18:00; GBPUSD London 10:00–13:30 and NY overlap 15:30–18:00; USDJPY Tokyo 03:00–06:00 and London 10:00–12:00; USDCAD NY 15:30–18:00; AUDUSD Asia 03:00–07:00 and London 10:00–12:00; USDCHF London 10:00–13:00 and NY overlap 15:30–17:30; EURJPY Tokyo 03:00–06:00 and London 10:00–12:00; XAUUSD London 10:00–13:00 and NY 15:30–18:30; BTCUSD trades 24/7, so use 15:30–19:00 EAT as an approximate active window while acknowledging no single session guarantees an edge. If currently inside a listed window, show that the window is open and prompt a fresh screenshot now. When the countdown reaches zero, do NOT invent a BUY/SELL from the old screenshot: prompt the user to upload a fresh M15/M5 screenshot and run Analyse again; then the AI must reassess the new evidence and return BUY, SELL or WAIT. Never claim a session time guarantees a profitable or “perfect” trade. Keep the confidence score and its caveat near the top so the user sees it immediately.

SELECTED TRADING STYLE: ${mode.name}. Objective: ${mode.objective} Timeframe framework: ${mode.context} Mode-specific requirements: ${mode.required} Holding horizon: ${mode.horizon} Uploaded timeframes: ${present.join(", ")}. Use the selected mode as the primary timeframe priority; do not require every timeframe if the relevant mode can be assessed from the available screenshots. Always state which missing timeframe would materially improve the assessment. For intraday/scalp modes, use D1/W1/MN1 only as optional background and do not let a distant higher-timeframe trend automatically override a clear, locally confirmed intraday setup; still disclose major nearby conflicts. For swing/position modes, give greater weight to W1/D1/H4 structure. Missing images must be called out. User direction preference (unverified context only, not a required bias): ${payload.direction || "Undecided"}. User-supplied chart notes/levels (annotations only; independently verify and do not copy into trade levels): ${JSON.stringify(payload.levels || {})}. User thesis (unverified annotation only): ${String(payload.thesis || "")}. User invalidation note (unverified annotation only): ${String(payload.invalidation || "")}. Timeframe notes (context only; independently verify): ${JSON.stringify(payload.timeframeNotes || {})}. No verified live price/news data is supplied.\n\nMARKET-SPECIFIC RESEARCH FRAMEWORK: ${MARKET_RESEARCH[pair]}

GLOBAL STRATEGY RULES: ${GLOBAL_STRATEGY_RULES}

RELEVANT MARKET-SPECIFIC STRATEGIES: ${STRATEGY_LIBRARY[pair] || "No legacy market-specific list; use universal and pair-specific catalogue."}
UNIVERSAL INTRADAY STRATEGIES: ${INTRADAY_STRATEGIES}
PAIR-SPECIFIC STRATEGIES: ${PAIR_STRATEGIES[pair] || "Use universal catalogue only."}
ADDITIONAL CANDIDATE SETUPS: ${SUPPLEMENTAL_STRATEGIES[pair] || "No extra market-specific list."}\n\nTHREE-MARKET OPERATING PLAYBOOK (use as a framework to evaluate, not as a mandatory signal):
- XAUUSD is the primary research focus. Prefer an Asian-range breakout only after a candle closes beyond the marked range and a retest holds, with H4/H1 structure aligned. Define the stop beyond the retest swing or structural invalidation. A range-height target is only a planning reference, not guaranteed; require visible structure and realistic costs. Skip an abnormally wide Asian range only if a trustworthy 20-day range baseline is actually supplied. Never invent it.
- BTCUSD is the volatility-focused market and trades 24/7. Consider intraday VWAP mean reversion only if VWAP and volume are visible or supplied as reliable data. A 2-standard-deviation band must be calculated from actual session data; never infer it from a screenshot without the values. Wait for rejection/reclaim toward VWAP, use BTC-specific structure for the stop, reduce size for volatility, and treat weekends as a separate tested regime.
- AUDUSD is the trend-confirmation / standalone trend market. Assess it independently. Its agreement with gold may add context, but correlations are unstable and do not prove a trade. Disagreement should trigger reassessment or skipping; do not automatically halve size unless that sizing rule has been tested.
- Routine reference in Nairobi time (EAT): 06:00–08:00 preparation and Asian range mapping (no entries in this plan); 11:00–14:00 London range-break/retest watch; 15:30–19:00 New York / US-data reaction watch after the first spike; weekends BTC only under a separately tested rule. These are approximate planning windows, not verified volatility schedules. London/New York daylight-saving changes shift their EAT timing; no current calendar was supplied, so do not claim a current event check.
- Risk framework: suggested maximum 1% equity risk per trade and stop taking new trades for the day at a 3% loss. These are user-defined guardrails, not a guarantee or universally optimal setting. Never encourage increasing size to recover losses. Reduce exposure or stand aside around uncertain spreads, slippage and high-impact releases.
- Evaluate results by instrument, setup and session in the journal. A 55% win rate with 2:1 average reward/risk has positive theoretical expectancy before costs, but does not guarantee green weeks. Three +2R winners and two -1R losers equal +4R over five trades (60% wins), not 55%. Never state that daily profit is mechanically assured.
\nDEEP-RESEARCH DISCIPLINE: Treat established technical-analysis principles as testable hypotheses, not laws. Distinguish direct chart observations, context hypotheses and verified external facts. Do not claim to have researched live web/news, checked a calendar or reviewed historical candles unless that data is actually supplied. Never claim a setup is high-probability without validated backtest statistics for this same instrument, timeframe, costs and regime. Compare continuation, pullback and failed-break scenarios. Include spread/fees/slippage and structural invalidation in the decision. Disclose if high-impact event status is unknown.

Review timeframes according to the selected trading style. For Intraday (M15 focus): H4/H1 context, M30 structure, M15 setup and M5 trigger; screen universal strategies 76–105 and pair-specific strategies 106–130 where applicable, then relevant legacy market-specific rules; use D1/W1/MN1 only for major context. For Quick trade: H1/M30 context, M15 setup and M5 trigger. For Swing: W1/D1 context, H4 setup and H1 refinement. For Position: MN1/W1/D1 context and H4 refinement. Clearly state whether the relevant timeframes align, conflict, or are mixed. Do not treat the monthly or weekly trend as an automatic trade signal. Adjust to actual screenshots; never assume the timeframes agree. Evaluate continuation and pullback setups as well as reversals. A strong trend can support a continuation trade; do not insist on reversal. Avoid chasing an extended move.

ENTRY-TIMING AND TRADE-PLAN RULES:
- Give a practical Kenya-time (Africa/Nairobi / EAT) window for monitoring this setup, but do not invent an exact clock-time entry. A trade is entered only when the specified candle-close/retest/rejection trigger occurs. If the trigger is not present, say WAITING FOR TRIGGER and describe exactly what candle/price action must happen.
- State whether the idea is a market entry after confirmation, a buy/sell limit at a retest, or a stop entry after a confirmed breakout. Do not recommend a pending order when the screenshot cannot establish a reliable level.
- Derive entry, structural stop and each target independently from visible chart prices. Explain the stop's structural basis and why it invalidates the thesis. TP1 should be the nearest defensible opposing level; later targets must be supported by visible structure, not arbitrary fixed pip amounts.
- Show planned reward:risk to each target after estimated costs only when spread/fees are actually supplied; otherwise label gross R:R and state costs are unknown. Reject setups with inadequate room after costs or a stop that is inside normal chart noise.
- Give a risk plan in R and a conservative suggested account-risk percentage (default ceiling 1% per trade). Do not calculate lot size, cash loss, or exact position size unless account equity, account currency, broker contract/tick value, and costs are supplied. If missing, show the formula and list the exact missing inputs.
- Include a time stop/reassessment condition appropriate to the selected trading style. Explain when to cancel an unfilled setup and when the thesis is invalidated. Never encourage revenge trading, martingale, averaging down, or increasing size to recover a loss.
- If the screenshot's price scale, candle timestamps or timeframe are unclear, do not manufacture numerical levels or a clock time. Return WAIT / NO TRADE or a qualitative conditional plan with NOT IDENTIFIABLE values.
- A daily opportunity is not a daily obligation. It is acceptable and often correct to take zero trades. Do not imply that a target, daily profit, recovery of a prior loss, or a fixed number of winners is assured.

Use these headings in order:
EXECUTIVE VERDICT:
DIRECTION: (exactly BUY, SELL, or WAIT / NO TRADE; state READY or WAITING FOR TRIGGER)
SELECTED TRADING STYLE:
EXPECTED HOLDING HORIZON / TIME STOP:
ENTRY TIMING (KENYA TIME / EAT WINDOW + EXACT TRIGGER; NO FABRICATED CLOCK ENTRY):
ENTRY ORDER TYPE (MARKET / LIMIT / STOP / WAIT):
BEST TIMEFRAME TO WATCH:
SECOND-BEST TIMEFRAME:
MARKET STRUCTURE:
SELECTED STRATEGY FROM CATALOGUE: (exact ID and name)
WHY THIS LIBRARY STRATEGY FITS: (visible evidence mapped to its rules)
OTHER LIBRARY STRATEGIES SCREENED: (up to 3 alternatives and why rejected)
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
    return json({ error: "Could not reach the AI service. Check the Cloudflare Worker and try again." }, 502, cors);
  }
}



async function withIntradayClock(response) {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;
  const html = await response.text();
  const injection = "<style id=\"intraday-clock-style\">.intraday-clock-card{display:none;margin:12px 0;padding:16px;border:1px solid #b99b67;border-radius:14px;background:linear-gradient(135deg,#24271f,#151711);color:#f2f0e9}.intraday-clock-card.visible{display:block}.intraday-clock-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.intraday-clock-kicker{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#d3bd8e;font-weight:800}.intraday-clock-signal{font-size:22px;font-weight:900;margin:5px 0}.intraday-clock-time{font-size:clamp(30px,8vw,46px);font-weight:900;letter-spacing:.04em;font-variant-numeric:tabular-nums}.intraday-clock-note{font-size:12px;color:#c3c1b6;line-height:1.5;margin-top:8px}.intraday-clock-card.wait{border-color:#8e7039}.intraday-clock-card button{margin-top:10px}</style><script id=\"intraday-clock-script\">(()=>{const pairWindows={EURUSD:[[\"London\",600,810],[\"London/NY overlap\",930,1080]],GBPUSD:[[\"London\",600,810],[\"London/NY overlap\",930,1080]],USDJPY:[[\"Tokyo\",180,360],[\"London\",600,720]],USDCAD:[[\"New York\",930,1080]],AUDUSD:[[\"Asia\",180,420],[\"London\",600,720]],USDCHF:[[\"London\",600,780],[\"London/NY overlap\",930,1050]],EURJPY:[[\"Tokyo\",180,360],[\"London\",600,720]],XAUUSD:[[\"London\",600,780],[\"New York\",930,1110]],BTCUSD:[[\"High-activity reference window\",930,1140]]};let card,deadline=0,lastPair=\"\",lastVerdict=\"\",windowName=\"\",windowOpen=false;const order=[\"EURUSD\",\"GBPUSD\",\"USDJPY\",\"USDCAD\",\"AUDUSD\",\"USDCHF\",\"EURJPY\",\"XAUUSD\",\"BTCUSD\"];const nowEAT=()=>{const d=new Date(),parts=new Intl.DateTimeFormat(\"en-GB\",{timeZone:\"Africa/Nairobi\",hour:\"2-digit\",minute:\"2-digit\",hourCycle:\"h23\"}).formatToParts(d),h=+(parts.find(p=>p.type===\"hour\")||{}).value||0,m=+(parts.find(p=>p.type===\"minute\")||{}).value||0;return {d,h,m,minute:h*60+m}};const nextWindow=(pair)=>{const n=nowEAT(),ws=pairWindows[pair]||pairWindows.EURUSD;for(const w of ws){if(n.minute>=w[1]&&n.minute<w[2])return {name:w[0],open:true,minutes:0}}let best=null;for(const w of ws){let delta=w[1]-n.minute;if(delta<=0)delta+=1440;if(!best||delta<best.minutes)best={name:w[0],open:false,minutes:delta}}return best};const ensurePairs=()=>{const s=document.querySelector(\"#pair\");if(!s||s.dataset.pairsEnhanced)return;const old=[...s.options].map(o=>({value:o.value||o.textContent.trim(),text:o.textContent.trim()}));for(const p of order)if(!old.some(o=>o.value.toUpperCase()===p||o.text.toUpperCase()===p))old.push({value:p,text:p});const rank=p=>{const i=order.indexOf(String(p).toUpperCase());return i<0?999:i};old.sort((a,b)=>rank(a.value)-rank(b.value));s.replaceChildren(...old.map(o=>{const x=document.createElement(\"option\");x.value=o.value;x.textContent=o.text;return x}));s.dataset.pairsEnhanced=\"1\"};const pair=()=>String(document.querySelector(\"#pair\")?.value||\"EURUSD\").toUpperCase();const direction=()=>{const el=document.querySelector(\"#resultDirection\");let t=(el?.textContent||\"\").toUpperCase();if(!t){const a=document.querySelector(\"#aiResult\");t=(a?.value||\"\").slice(0,2200).toUpperCase()}if(/(^|[^A-Z])WAIT\\s*\\/?\\s*(NO TRADE)?([^A-Z]|$)/.test(t)||/NO TRADE|NO CONFIRMED DIRECTION/.test(t))return \"WAIT\";if(/(^|[^A-Z])BUY([^A-Z]|$)/.test(t))return \"BUY\";if(/(^|[^A-Z])SELL([^A-Z]|$)/.test(t))return \"SELL\";return \"WAIT\"};const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};const ensureCard=()=>{if(card)return;const host=document.querySelector(\"#tradeResults\");if(!host)return;card=el(\"section\",\"intraday-clock-card\");const head=el(\"div\",\"intraday-clock-head\");const left=el(\"div\");left.append(el(\"div\",\"intraday-clock-kicker\",\"WAIT timing · EAT session window\"));left.append(el(\"div\",\"intraday-clock-signal\",\"NEXT ACTIVE WINDOW\"));left.lastChild.id=\"intradayClockSignal\";const right=el(\"div\");right.style.textAlign=\"right\";right.append(el(\"div\",\"intraday-clock-pill\",\"Pair-specific timing\"));right.append(el(\"div\",\"intraday-clock-time\",\"00:00:00\"));right.lastChild.id=\"intradayClockTime\";head.append(left,right);card.append(head);card.append(el(\"div\",\"intraday-clock-note\",\"When the timer reaches zero, upload a fresh screenshot and analyse again. The clock does not create a BUY/SELL signal.\"));card.lastChild.id=\"intradayClockNote\";const button=el(\"button\",\"\",\"Choose fresh M5 screenshot\");button.type=\"button\";button.id=\"intradayClockFresh\";button.addEventListener(\"click\",()=>{const input=document.querySelector(\"#imgM5\");if(input)input.click();else document.querySelector(\"#sendAI\")?.scrollIntoView({behavior:\"smooth\",block:\"center\"})});card.append(button);const hostAnchor=host.querySelector(\".direction-hero\");if(hostAnchor)hostAnchor.insertAdjacentElement(\"afterend\",card);else host.prepend(card)};const paint=()=>{ensurePairs();ensureCard();if(!card)return;const host=document.querySelector(\"#tradeResults\"),shown=host?.classList.contains(\"show\"),d=direction(),p=pair();if(!shown||d!==\"WAIT\"){card.classList.remove(\"visible\");return}card.classList.add(\"visible\");card.classList.remove(\"buy\",\"sell\",\"wait\");card.classList.add(\"wait\");const text=document.querySelector(\"#aiResult\")?.value||\"\";if(lastPair!==p||lastVerdict!==d||!deadline){lastPair=p;lastVerdict=d;const nw=nextWindow(p);windowName=nw.name;windowOpen=nw.open;deadline=Date.now()+nw.minutes*60000}let left=Math.max(0,Math.ceil((deadline-Date.now())/1000));if(left===0&&!windowOpen){const fresh=nextWindow(p);windowName=fresh.name;if(fresh.open){windowOpen=true}else{deadline=Date.now()+fresh.minutes*60000;left=Math.max(0,Math.ceil((deadline-Date.now())/1000))}}if(windowOpen)left=0;const h=Math.floor(left/3600),m=Math.floor((left%3600)/60),s=left%60;const signal=document.querySelector(\"#intradayClockSignal\"),time=document.querySelector(\"#intradayClockTime\"),note=document.querySelector(\"#intradayClockNote\"),btn=document.querySelector(\"#intradayClockFresh\");if(signal)signal.textContent=windowOpen||left===0?\"ACTIVE WINDOW — SEND FRESH SCREENSHOT\":\"NEXT WINDOW: \"+windowName;if(time)time.textContent=String(h).padStart(2,\"0\")+\":\"+String(m).padStart(2,\"0\")+\":\"+String(s).padStart(2,\"0\");if(note)note.textContent=windowOpen||left===0?\"The \"+windowName+\" timing window is open for \"+p+\". Upload a fresh M15/M5 screenshot, then tap Analyse my chart. The new scan—not the clock—must decide BUY, SELL or WAIT. These are approximate session windows, not proven win-rate periods.\":\"Waiting for the next \"+windowName+\" window for \"+p+\" (EAT, Africa/Nairobi). At zero, upload a fresh M15/M5 screenshot and run Analyse again. Session timing alone cannot confirm direction or guarantee a profitable entry.\";if(btn)btn.textContent=windowOpen||left===0?\"Choose fresh M5 screenshot\":\"Choose fresh M5 screenshot\"};const onPairChange=()=>{deadline=0;lastPair=\"\";paint()};setInterval(paint,1000);document.addEventListener(\"change\",e=>{if(e.target?.id===\"pair\")onPairChange()});})();</script>"
  const updated = html.includes("</body>") ? html.replace("</body>", injection + "</body>") : html + injection;
  const headers = new Headers(response.headers);
  headers.delete("content-length"); headers.delete("content-encoding"); headers.delete("etag");
  return new Response(updated, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/analyze") return handleAnalyze(request, env);
    return withIntradayClock(await env.ASSETS.fetch(request));
  }
};
