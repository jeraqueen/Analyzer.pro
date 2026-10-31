# Deriv MT5 Demo Bot — V0.1

This is the first testable prototype for the automated Deriv MT5 bot. It is separate from the live Analyzer.pro website files; it does not modify the website's frontend or Worker.

## What V0.1 does
- Requires a **Deriv MT5 demo account** when `DemoOnly=true`.
- Scans symbols currently visible in MT5 Market Watch.
- Checks M15 EMA 9/21 alignment with H1 and H4 EMA trend alignment.
- Uses M15 ATR to calculate a stop distance and a 1.5R take-profit.
- Calculates volume from equity risk, stop distance, broker tick value/size, minimum/step/max volume and available margin.
- Skips a trade when broker minimum volume would exceed the calculated risk budget.
- Limits the EA to one open position per symbol and three positions total by default.
- Blocks new entries after configured daily-loss or peak-equity drawdown limits.
- Uses broker-server time if the optional trading-hours filter is enabled.
- Prints order decisions and errors to the MT5 Experts log.

## Important limitations
This is a **prototype, not a proven profitable strategy**. It does not yet implement a DST-aware London/New York session calendar, news filter, correlation portfolio model, adaptive exit engine, recovery ledger, dashboard, or persistent database. It does not guarantee profitability. The current trend rules are deliberately simple so they can be backtested and reviewed before complexity is added.

The EA scans only symbols enabled in Market Watch. In MT5, show the Deriv instruments you want included there. Deriv symbol names and contract settings can vary by account type.

## Install and test (demo only)
1. On a Windows computer with Deriv MT5 installed, open MetaTrader 5.
2. Open **File → Open Data Folder → MQL5 → Experts**.
3. Copy `Deriv_Demo_Bot.mq5` into that folder.
4. Open MetaEditor, open the file, and press **Compile**.
5. In MT5, log into your Deriv **demo** account and open Strategy Tester.
6. Test one symbol at a time first, then run a multi-symbol demo forward test. Verify contract sizes, volume steps, tick values, spread, stops and margin in the symbol specifications.
7. Attach the EA to one chart and enable Algo Trading. Keep `DemoOnly=true`.
8. Check the Experts and Journal tabs for every entry, skipped trade and error.

## Default safeguards
- Risk per trade: 0.50% of equity (configurable).
- Daily loss limit: 3% from the day's starting equity (blocks new entries; does not force-close positions).
- Peak-equity drawdown limit: 10% (blocks new entries; does not force-close positions).
- Maximum open positions: 3.
- One position per symbol.
- No martingale, no automatic lot doubling, and no adding to losing positions.

These settings are initial test defaults, not a promise of safety. Even a demo prototype can behave differently from backtests due to spreads, slippage, data quality and execution.

## Development plan
1. Compile fixes and Strategy Tester validation on Deriv demo.
2. Confirm correct lot calculations for Forex, Gold, indices and other supported instruments.
3. Add session scheduling with DST-aware London/New York windows and per-symbol trading hours.
4. Add stronger entry validation, spread/news/volatility filters, trade management and correlation-aware portfolio limits.
5. Add controlled recovery tracking and a phone-friendly dashboard only after the execution core is verified.
