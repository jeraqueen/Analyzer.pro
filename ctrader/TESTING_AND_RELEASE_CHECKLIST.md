# Analyzer.pro cTrader Demo Bot — Test and Release Gate

## Current status
Development source only. Do not deploy for trading until the compile, backtest, and demo-forward-test gates below pass.

## Build and compatibility
- Open `ctrader/DerivTop3CloudDemoBot.cs` in cTrader Windows or Mac Automate.
- Build with the current cTrader Automate API.
- Resolve every compiler error and review every warning before proceeding.
- Confirm the compiled cBot uses only Cloud-compatible APIs and no external Windows-only dependencies.

## Instrument verification (Deriv cTrader demo)
Record the exact broker symbol names and specifications for:
- At least the major FX pairs enabled on the account.
- Gold (XAUUSD or the exact broker alias).
- Bitcoin (BTCUSD or the exact broker alias).
- Confirm tick size, pip size, minimum/maximum volume, volume step, trading hours, and typical spread.
- Confirm synthetic indices are never selected.
- Confirm weekend scans can select BTCUSD only while the broker reports that market open.

## Safety tests
- Confirm `DemoOnly = false` blocks startup.
- Confirm the `Account.IsLive` guard stops the cBot on a live account (verify by code review; do not place live trades).
- Confirm calculated volume is rounded down and never exceeds the configured risk budget by rounding up.
- Confirm broker-side stop loss and take profit are attached to every successful entry.
- Confirm no more than three positions with this bot label can be open.
- Confirm duplicate symbol entries are blocked.
- Confirm daily loss and historical peak-balance locks block new entries.
- Restart the cBot and verify the daily opening-balance reference and historical closed-balance high-water mark are reconstructed from account history.
- Confirm no martingale, grid, averaging down, or forced-entry behaviour.

## Backtesting protocol
Use cTrader's server tick data where available, with realistic commission and variable spread. Run separate tests for:
1. Trending market conditions.
2. Sideways/ranging conditions.
3. High-volatility conditions.
4. FX instruments.
5. Gold.
6. Bitcoin, including weekend periods.

Use a chronological split:
- Development/in-sample period for strategy refinement.
- Separate out-of-sample period that is not used to tune parameters.
- A final unseen holdout period for the release decision.

Save the HTML report for every run. Record symbol, date range, data mode, spread/commission settings, parameters, net profit, profit factor, maximum equity drawdown, total trades, win rate, average trade, and consecutive losses.

## Confidence and predicted performance
- The on-screen technical confidence score is a weighted technical-evidence score: 50% timeframe alignment, 20% RSI quality, 15% EMA trend strength, and 15% spread efficiency.
- It is not a calibrated probability of winning.
- Historical bot win rate, net P/L, and profit factor are reported separately from the technical score.
- Do not relabel the technical score as a win probability until score bands have been validated on a sufficiently large, untouched out-of-sample sample and calibration is measured.
- Do not make an entry decision from an unsupported performance estimate or from a small sample.

## Demo-forward-test gate
After backtests pass, run on Deriv demo only with the smallest permitted risk setting. Monitor order placement, spreads, slippage, stop/target attachment, market closures, restarts, and daily risk locks. Review the trade log and performance report before increasing activity.

## Release decision
No Cloud deployment for trading until:
- Build succeeds cleanly.
- Symbol names/specifications are verified on the actual Deriv demo account.
- Safety tests pass.
- Out-of-sample results are positive after costs and drawdown is within the configured risk limit.
- Demo-forward-test behaviour matches the backtest assumptions.

A profitable backtest is not a guarantee of future performance. This checklist is a quality gate, not a promise of returns.
