# Analyzer.pro — Three-Market Research Playbook
Updated: 30 October 2026

## Mission and evidence standard
Analyzer.pro focuses exclusively on BTCUSD, AUDUSD and XAUUSD. The aim is not to predict every candle or promise daily profits. It is to identify repeatable, testable conditions with positive expectancy after trading costs, preserve capital during poor conditions, and continually measure whether an apparent edge survives new data.

Every output must distinguish:
- **Observed:** visible candles, swing points, levels, timeframe and supplied prices.
- **Inferred:** likely structure, candidate setup, possible macro influence.
- **Verified external context:** data supplied by a trustworthy current source, with its timestamp.
- **Unknown:** missing chart labels, unverified news/calendar, unavailable funding/open-interest/volume, unknown spread or broker-specific quote.

Do not state that live research, backtesting, a calendar check or market-data fetch happened unless the relevant tool/data actually ran. A chart screenshot alone is not live market data.

## Shared chart method
1. **Regime:** trend, range, compression, volatility expansion or disorderly/event-driven conditions.
2. **Structure:** swing highs/lows, higher highs/lows or lower highs/lows, range boundaries, prior-day/week extremes, obvious support/resistance.
3. **Location:** is price at a meaningful level or in the middle of noise? Avoid chasing a move already extended from its logical invalidation.
4. **Setup hypothesis:** continuation pullback, break-and-retest, rejection, range fade, or failed breakout. Do not force a pattern where evidence is absent.
5. **Trigger:** a specific candle close, reclaim/rejection, or retest on a named execution timeframe. A forecast is not a trigger.
6. **Invalidation and risk:** place stop beyond the structure that disproves the thesis, allowing for volatility and the instrument's tick/price conventions. Never invent a price from an unreadable screenshot.
7. **Targets:** use separately justified structure/liquidity levels. Calculate reward:risk only from readable levels and include likely spread, commission, swap/funding and slippage where known.
8. **Multi-timeframe check:** D1 context, H4 swing regime, H1 setup, M30/M15 refinement, M5 trigger. The user prefers display order H4, H1, M15, M5, M30, D1; analysis may still review D1 to M5 to preserve context.
9. **Alternative:** state the clearest opposing scenario and the price behavior that activates it.
10. **No-trade conditions:** genuinely conflicting evidence, unreadable chart, no defensible stop, poor reward-to-risk, unusually wide spread/slippage, major event risk not understood, or a setup already invalidated. If one side is reasonably supported but not triggered, show conditional BUY/SELL + WAITING FOR TRIGGER rather than hiding direction.

## BTCUSD profile
- Venue discipline: BTC trades 24/7 across exchanges. There is no single consolidated spot price. Use the user's chart/execution venue for exact levels; never silently blend venues.
- Regime/context: trend/range, volatility, weekday/weekend differences, Asia/Europe/US sessions, US equity hours and ETF valuation windows.
- Structure: prior-day/week high-low, range edges, equal highs/lows, breakout-and-retest, failed breakout, impulse and pullback quality. A liquidity sweep is not itself proof of reversal.
- Derivatives context only if live verified data is supplied: funding, open interest, futures basis, liquidation levels and spot/futures volume. Never fabricate them.
- Event risks: major US macro releases, regulatory decisions, exchange/operational events, ETF flow reports and crypto-specific shocks.
- Research caution: intraday volatility/volume patterns can change as market structure and institutional participation evolve. A time-of-day effect can help estimate activity; it does not establish BUY/SELL direction.

## AUDUSD profile
- Quote logic: AUDUSD is USD per AUD; rising price means AUD appreciation against USD.
- Macro context: relative RBA/Fed rate expectations, Australian/US inflation and jobs, China growth/trade demand, commodities/terms of trade, broad USD trend and global risk sentiment.
- Session/event context: Asian trading; London/US overlap; RBA and Fed decisions, CPI, employment, GDP, and major Chinese data.
- Rules: do not assume commodities or equities always predict AUDUSD. Correlations and rate differentials change by regime. A headline is context, not a trade trigger; require price confirmation and a defined invalidation.

## XAUUSD profile
- Quote/venue discipline: most retail charts quote USD per troy ounce, but broker CFD, spot and futures prices can differ. Use the supplied broker chart for levels.
- Macro context: US real yields and nominal yields, USD direction, inflation/rate expectations, geopolitical risk, investment/ETF flows, central-bank demand and momentum/positioning when verified.
- Session/event context: Asian and US sessions; CPI, PCE, NFP, FOMC and major geopolitical headlines. Volatility, spreads and slippage can jump around news.
- Rules: gold's relationship with the USD and yields is not a fixed inverse rule. Both can rise together or diverge. Separate macro bias from the actual chart trigger.

## Research reading list
These are reference frameworks, not endorsements or guaranteed-profit recipes:
- Adam Grimes, *The Art and Science of Technical Analysis* (Wiley): price structure, conditional patterns, market randomness and the need for statistical validation. https://onlinelibrary.wiley.com/doi/book/10.1002/9781119202837
- Mark Douglas, *Trading in the Zone* (Prentice Hall Press): probabilistic thinking, process discipline and accepting uncertainty. https://www.harvard.com/book/9780735201446
- Laurence A. Connors and Linda Bradford Raschke, *Street Smarts* (1995): short-term setup hypotheses that must be retested on today's instruments and costs. https://books.google.com/books/about/Street_Smarts.html?id=P8R2swEACAAJ
- Reserve Bank of Australia, “Drivers of the Australian Dollar Exchange Rate”: interest-rate differentials, terms of trade/commodities, trade, and short-term risk sentiment. https://www.rba.gov.au/education/resources/explainers/drivers-of-the-aud-exchange-rate.html
- BIS Quarterly Review, December 2025, “Global FX markets when hedging takes centre stage”: current institutional FX market structure and turnover context. https://www.bis.org/publ/qtrpdf/r_qt2512.pdf
- World Gold Council, “Gold Mid-Year Outlook 2026”: gold return drivers include economic expansion, risk/uncertainty, opportunity cost and momentum; these vary over time. https://www.gold.org/goldhub/research/gold-mid-year-outlook-2026
- Federal Reserve Bank of Chicago, “What Drives Gold Prices?”: research on inflation expectations, real interest rates and economic pessimism. https://www.chicagofed.org/publications/chicago-fed-letter/2021/464
- CME Group, “Through the lens of gold”: examples of USD/gold and real-yield relationships, including periods of divergence. https://www.cmegroup.com/articles/2024/through-the-lens-of-gold.html
- CFTC, “Eight Things You Should Know Before Trading Forex”: leverage, counterparty, dealer and loss risks; its historical customer-loss statistic is specific to the disclosed period, not a universal current estimate. https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/CustomerAdvisory_MustKnowForex.html
- Bitcoin intraday research (2017–2021 data) found activity/volatility patterns around the London–New York overlap; newer research finds institutional US-hours concentration can change over time. These findings concern activity/volatility, not directional profitability. https://www.sciencedirect.com/science/article/abs/pii/S0275531922000137

## Backtest and journal requirements before calling anything an edge
For each market, timeframe, setup and session, log:
- exact setup rules and timestamp; price data source/venue; entry, stop, target and exit;
- spread, commissions, financing/funding, slippage and missed fills;
- outcome in R, win rate, average win, average loss, expectancy, profit factor, maximum drawdown, losing streak, trade count and exposure;
- performance by market regime, session and calendar-event state;
- in-sample development, out-of-sample test, walk-forward checks and a final untouched holdout;
- realistic fills, no look-ahead bias, no use of future candles, and no tuning to a tiny sample.

Expectancy = (win rate × average win in R) − (loss rate × average loss in R) − average costs in R. A high win rate alone is not enough; a strategy can win often and still lose money if losses are much larger. Track paper/live-forward performance after backtesting.

## Data and automation roadmap
1. Current phase: instrument-specific chart prompts and a curated research playbook.
2. Next: add trustworthy market-data/news/calendar connectors with timestamps and visible source labels; do not use screenshots as a substitute for current prices.
3. Then: build candle-history storage and a reproducible backtest engine per instrument and timeframe.
4. Add a trade journal that compares forecast vs. actual outcome and reports errors without silently rewriting history.
5. Schedule regular scans only where a reliable data source and background runtime are configured. A webpage cannot monitor markets “almost all the time” while closed; continuous monitoring requires a deployed scheduled job, data provider and alert channel.

## Safety rules
No guarantee of profit, no fabricated confidence/win probability, no fabricated historical performance, no auto-execution. Use small, predefined risk; never increase size to recover a loss. Retail leveraged FX/CFDs and crypto derivatives can lose money rapidly.
