# Deriv MT5 Bot — Test Status

Last source review: 2026-10-31

## Checks completed in this workspace

These are static source checks only; they are not a MetaEditor compile or a trading backtest.

- [x] Demo-account guard is present when `DemoOnly=true`.
- [x] Per-trade risk input is limited to at most 1% of equity.
- [x] Daily-loss and peak-equity drawdown gates block new entries.
- [x] Maximum total open positions and one-position-per-symbol rules are present.
- [x] Lot sizing rounds down to the broker's volume step and skips if the minimum lot would exceed the calculated risk budget.
- [x] Lot sizing uses MT5 `OrderCalcProfit` to estimate one-lot stop loss using the symbol's contract rules.
- [x] Disabled/close-only instruments and directions prohibited by the symbol's trade mode are skipped.
- [x] Orders are submitted with stop-loss and take-profit prices.
- [x] No Martingale or automatic lot-doubling logic is implemented.

## Not yet tested

- [ ] Compile in MetaEditor and resolve any compiler warnings/errors.
- [ ] Run Strategy Tester on each intended Deriv demo instrument.
- [ ] Confirm contract-aware lot sizing, stop distances, spreads, volume steps, margin and order filling on the actual account.
- [ ] Run a demo forward test and inspect Experts/Journal logs.
- [ ] Verify restart behavior, daily-loss baseline, drawdown protection and open-position handling.

## Current decision

**Do not use on a real-money account yet.** The source has not been compiled or run in MT5 in this workspace. Static checks cannot establish that the EA compiles, places orders successfully, or has a profitable strategy. Keep `DemoOnly=true` for the first MT5 tests.
