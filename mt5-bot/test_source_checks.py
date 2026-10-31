#!/usr/bin/env python3
"""Static safety regression checks for Deriv_Demo_Bot.mq5.

These checks do not replace MetaEditor compilation or MT5 Strategy Tester.
Run: python test_source_checks.py
"""
from pathlib import Path
import sys

SOURCE = Path(__file__).with_name("Deriv_Demo_Bot.mq5")
if not SOURCE.exists():
    print(f"FAIL: source file not found: {SOURCE}")
    sys.exit(2)

code = SOURCE.read_text(encoding="utf-8")
checks = {
    "demo account guard exists": "ACCOUNT_TRADE_MODE_DEMO" in code,
    "per-trade risk is capped at 1%": "RiskPercentPerTrade > 1.0" in code,
    "daily loss gate exists": "MaxDailyLossPercent" in code,
    "peak-equity drawdown gate exists": "MaxEquityDrawdownPercent" in code,
    "position cap exists": "CountOurPositions() >= MaxOpenPositions" in code,
    "one position per symbol exists": "HasOurPositionOnSymbol(symbol)" in code,
    "minimum lot is never forced upward": "if(lots<minLot || lots>maxLot) return 0;" in code,
    "contract-aware stop-loss estimate exists": "OrderCalcProfit(type,symbol,1.0,entry,sl,estimatedProfit)" in code,
    "margin check exists": "OrderCalcMargin(type,symbol,lots,entry,margin)" in code,
    "disabled/close-only symbols are skipped": "SYMBOL_TRADE_MODE_CLOSEONLY" in code,
    "long-only/short-only modes are respected": (
        "SYMBOL_TRADE_MODE_SHORTONLY" in code and "SYMBOL_TRADE_MODE_LONGONLY" in code
    ),
    "BUY and SELL orders include SL/TP": (
        "trade.Buy(lots,symbol,0.0,sl,tp" in code
        and "trade.Sell(lots,symbol,0.0,sl,tp" in code
    ),
    "no recovery/lot multiplier variables": not any(
        term in code for term in ("RecoveryMultiplier", "LotMultiplier", "LossRecoveryFactor")
    ),
}

for name, passed in checks.items():
    print(f"{'PASS' if passed else 'FAIL'}  {name}")

print(f"\n{sum(checks.values())}/{len(checks)} static checks passed.")
print("Reminder: static checks are not a compiler test, backtest, or profitability proof.")
sys.exit(0 if all(checks.values()) else 1)
