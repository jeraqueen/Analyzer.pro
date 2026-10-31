// -----------------------------------------------------------------------------
// JENZY? No. Analyzer.pro - Deriv cTrader Cloud Demo Bot
// Version: 1.1.0 (development source; compile and validate in cTrader before use)
// Purpose: multi-symbol, multi-timeframe demo automation for FX, Gold, Bitcoin and Deriv synthetic indices.
// Safety: hard demo-account guard. This cBot refuses to start on a live account.
// -----------------------------------------------------------------------------
// Strategy notes:
// - Scans broker-enabled FX, Gold (XAU*), Bitcoin (BTC*) and recognized Deriv synthetic indices.
// - Uses closed candles on M1/M5/M15/M30/H1/H4/D1/W1.
// - Scores trend alignment, then applies M15 RSI, ATR and spread filters.
// - Ranks all eligible opportunities and opens only the best qualifying trades.
// - Uses ATR-based SL, fixed-risk volume sizing and broker-side SL/TP.
// - No forced entries. No averaging down, grid, martingale or position stacking.
// - This is not a guarantee of profitability. Backtest and demo-forward-test first.
// -----------------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Linq;
using cAlgo.API;
using cAlgo.API.Indicators;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.None)]
    public class DerivTop3CloudDemoBot : Robot
    {
        private const string BotLabel = "ANALYZERPRO_CTRADER_DEMO_V1";

        [Parameter("Demo only (mandatory)", DefaultValue = true)]
        public bool DemoOnly { get; set; }

        [Parameter("Risk per trade (%)", DefaultValue = 0.25, MinValue = 0.05, MaxValue = 1.0, Step = 0.05)]
        public double RiskPercent { get; set; }

        [Parameter("Daily loss limit (%)", DefaultValue = 2.5, MinValue = 0.5, MaxValue = 5.0, Step = 0.25)]
        public double DailyLossLimitPercent { get; set; }

        [Parameter("Maximum loss per position (% equity)", DefaultValue = 1.0, MinValue = 0.25, MaxValue = 2.0, Step = 0.25)]
        public double MaximumPositionLossPercent { get; set; }

        [Parameter("Profit trailing activation (% equity)", DefaultValue = 0.5, MinValue = 0.25, MaxValue = 2.0, Step = 0.25)]
        public double ProfitTrailActivationPercent { get; set; }

        [Parameter("Profit trailing distance (ATR multiple)", DefaultValue = 1.5, MinValue = 0.5, MaxValue = 3.0, Step = 0.25)]
        public double ProfitTrailAtrMultiple { get; set; }

        [Parameter("Peak balance drawdown lock (%)", DefaultValue = 8.0, MinValue = 2.0, MaxValue = 15.0, Step = 0.5)]
        public double PeakDrawdownLimitPercent { get; set; }

        [Parameter("Scan interval (seconds)", DefaultValue = 60, MinValue = 15, MaxValue = 300)]
        public int ScanIntervalSeconds { get; set; }

        [Parameter("Symbols per batch", DefaultValue = 3, MinValue = 1, MaxValue = 10)]
        public int SymbolsPerBatch { get; set; }

        [Parameter("Batch interval (seconds)", DefaultValue = 5, MinValue = 1, MaxValue = 30)]
        public int BatchIntervalSeconds { get; set; }

        [Parameter("Minimum technical score (%)", DefaultValue = 80, MinValue = 80, MaxValue = 95)]
        public double MinimumScore { get; set; }

                [Parameter("Fast EMA", DefaultValue = 9, MinValue = 3, MaxValue = 30)]
        public int FastEmaPeriod { get; set; }

        [Parameter("Middle EMA", DefaultValue = 21, MinValue = 5, MaxValue = 60)]
        public int MiddleEmaPeriod { get; set; }

        [Parameter("Trend EMA", DefaultValue = 50, MinValue = 20, MaxValue = 200)]
        public int TrendEmaPeriod { get; set; }

        [Parameter("RSI period", DefaultValue = 14, MinValue = 5, MaxValue = 30)]
        public int RsiPeriod { get; set; }

        [Parameter("ATR period", DefaultValue = 14, MinValue = 5, MaxValue = 30)]
        public int AtrPeriod { get; set; }

        [Parameter("Stop Loss ATR multiple", DefaultValue = 2.0, MinValue = 1.0, MaxValue = 4.0, Step = 0.25)]
        public double StopAtrMultiple { get; set; }

        [Parameter("Take Profit (R multiple)", DefaultValue = 1.5, MinValue = 1.0, MaxValue = 3.0, Step = 0.25)]
        public double TakeProfitR { get; set; }

        [Parameter("Maximum spread / ATR", DefaultValue = 0.20, MinValue = 0.05, MaxValue = 0.5, Step = 0.05)]
        public double MaximumSpreadToAtr { get; set; }

        [Parameter("Avoid duplicate symbol positions", DefaultValue = false)]
        public bool AvoidDuplicateSymbols { get; set; }

        [Parameter("Limit correlated FX exposure", DefaultValue = false)]
        public bool UseCurrencyExposureGuard { get; set; }

        private readonly Dictionary<string, SymbolContext> _contexts = new Dictionary<string, SymbolContext>(StringComparer.OrdinalIgnoreCase);
        private DateTime _riskDay;
        private double _dayStartBalance;
        private double _peakBalance;
        private bool _riskLockLogged;
        private readonly List<string> _scanQueue = new List<string>();
        private readonly List<TradeCandidate> _scanCandidates = new List<TradeCandidate>();
        private int _scanIndex;
        private int _openedThisScan;
        private DateTime _lastScanCompleted = DateTime.MinValue;

        private static readonly TimeFrame[] ScanTimeFrames =
        {
            TimeFrame.Minute,
            TimeFrame.Minute5,
            TimeFrame.Minute15,
            TimeFrame.Minute30,
            TimeFrame.Hour,
            TimeFrame.Hour4,
            TimeFrame.Daily,
            TimeFrame.Weekly
        };

        // Larger weights are assigned to higher timeframes.
        private static readonly double[] TimeFrameWeights = { 1.0, 1.0, 1.0, 1.0, 1.25, 1.5, 1.5, 1.75 };

        private static readonly HashSet<string> Currencies = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "SEK", "NOK", "DKK", "SGD", "HKD", "MXN", "ZAR", "TRY", "PLN", "HUF", "CZK"
        };

        protected override void OnStart()
        {
            if (!DemoOnly)
            {
                Print("START BLOCKED: Demo-only mode must remain enabled.");
                Stop();
                return;
            }

            if (Account.IsLive)
            {
                Print("START BLOCKED: This cBot is demo-only and cannot run on a LIVE account.");
                Stop();
                return;
            }

            if (RiskPercent <= 0 || RiskPercent > 1.0)
            {
                Print("START BLOCKED: Risk parameters are outside the permitted safety range.");
                Stop();
                return;
            }

            // Rebuild risk references from account history so a Cloud restart
            // cannot silently reset the daily-loss or historical peak-balance guard.
            _riskDay = DateTime.MinValue;
            _dayStartBalance = 0;
            _peakBalance = 0;
            RefreshRiskBaselines();

            Positions.Closed += OnPositionClosed;
            PrintHistoricalPerformance();

            Timer.Start(TimeSpan.FromSeconds(BatchIntervalSeconds));
            Print("Analyzer.pro Deriv Top-3 Cloud Demo Bot v1.0 started.");
            Print("Account: DEMO | Equity: {0} {1} | Risk/trade: {2}% | No fixed bot-wide position cap | Multiple positions per instrument allowed by default.",
                Account.Equity, Account.Asset.Name, RiskPercent);
            Print("Markets: dynamically scans supported FX, Gold (XAU), Bitcoin (BTC), and Deriv synthetic-market families whenever the broker reports them open. Closed markets are skipped automatically; reopened markets are included on the next scan.");
            Print("Timeframes: M1, M5, M15, M30, H1, H4, D1, W1. Only closed candles are evaluated.");

            StartScanCycle();
        }

        protected override void OnTimer()
        {
            ManageOpenPositions();
            ProcessScanBatch();
        }

        // Manage exits continuously, independently of the entry scan. Broker-side SL/TP
        // remain the hard protection; an opposite qualifying signal closes the position
        // so the bot can consider a fresh entry on a later scan.
        private void ManageOpenPositions()
        {
            Position[] openPositions = Positions.FindAll(BotLabel);
            foreach (Position position in openPositions)
            {
                try
                {
                    Symbol symbol = Symbols.GetSymbol(position.SymbolName);
                    if (symbol == null || !symbol.MarketHours.IsOpened())
                        continue;

                    // Hard per-position cash-risk guard: size the limit from current equity,
                    // not from a fixed dollar amount, so it scales with the account.
                    double maxLossCash = Account.Equity * MaximumPositionLossPercent / 100.0;
                    if (position.NetProfit <= -maxLossCash)
                    {
                        Print("POSITION LOSS LIMIT: {0} {1} | net P/L={2:F2} {3} <= -{4:F2} ({5:F2}% of current equity). Closing.",
                            position.SymbolName, position.Id, position.NetProfit, Account.Asset.Name,
                            maxLossCash, MaximumPositionLossPercent);
                        TradeResult lossClose = ClosePosition(position);
                        if (lossClose.IsSuccessful)
                            Print("LOSS-LIMIT AUTO-CLOSED {0} {1}.", position.SymbolName, position.Id);
                        else
                            Print("LOSS-LIMIT CLOSE FAILED {0} {1}: {2}", position.SymbolName, position.Id, lossClose.Error);
                        continue;
                    }

                    // Once open profit reaches a threshold based on current account equity,
                    // trail a stop using the instrument's ATR. Only tighten the stop; never
                    // move it farther away. This lets winners run while protecting gains.
                    SymbolContext positionContext = GetContext(symbol);
                    double atrNow = positionContext?.Atr?.Result.Last(1) ?? 0;
                    double activationCash = Account.Equity * ProfitTrailActivationPercent / 100.0;
                    if (position.NetProfit >= activationCash && atrNow > 0)
                    {
                        double trailDistance = atrNow * ProfitTrailAtrMultiple;
                        double? proposedStop = null;
                        if (position.TradeType == TradeType.Buy)
                        {
                            double candidateStop = symbol.Bid - trailDistance;
                            if (candidateStop > 0 && (!position.StopLoss.HasValue || candidateStop > position.StopLoss.Value + symbol.TickSize))
                                proposedStop = candidateStop;
                        }
                        else
                        {
                            double candidateStop = symbol.Ask + trailDistance;
                            if (candidateStop > 0 && (!position.StopLoss.HasValue || candidateStop < position.StopLoss.Value - symbol.TickSize))
                                proposedStop = candidateStop;
                        }

                        if (proposedStop.HasValue)
                        {
                            TradeResult trailResult = ModifyPosition(position, proposedStop, position.TakeProfit);
                            if (trailResult.IsSuccessful)
                                Print("PROFIT TRAIL UPDATED {0} {1} | net P/L={2:F2} {3} | stop={4}.",
                                    position.SymbolName, position.Id, position.NetProfit, Account.Asset.Name, proposedStop.Value);
                            else
                                Print("PROFIT TRAIL UPDATE FAILED {0} {1}: {2}", position.SymbolName, position.Id, trailResult.Error);
                        }
                    }

                    TradeCandidate signal = EvaluateSymbol(symbol);
                    if (signal == null || signal.Score <= MinimumScore || signal.Direction == position.TradeType)
                        continue;

                    Print("EXIT SIGNAL {0} {1} | open direction={2} | opposite technical score={3:F1}% > {4:F1}%. Closing position to limit reversal exposure.",
                        position.SymbolName, position.Id, position.TradeType, signal.Score, MinimumScore);
                    TradeResult closeResult = ClosePosition(position);
                    if (closeResult.IsSuccessful)
                        Print("AUTO-CLOSED {0} {1} | gross P/L={2:F2} {3}.", position.TradeType, position.SymbolName, position.GrossProfit, Account.Asset.Name);
                    else
                        Print("AUTO-CLOSE FAILED {0} {1}: {2}", position.SymbolName, position.Id, closeResult.Error);
                }
                catch (Exception ex)
                {
                    Print("POSITION MANAGEMENT ERROR {0} {1}: {2}", position.SymbolName, position.Id, ex.Message);
                }
            }
        }

        protected override void OnStop()
        {
            Timer.Stop();
            Positions.Closed -= OnPositionClosed;
            Print("Analyzer.pro cBot stopped. Existing broker-side SL/TP remain with their positions.");
        }

        private void OnPositionClosed(PositionClosedEventArgs args)
        {
            PrintHistoricalPerformance();
        }

        private void PrintHistoricalPerformance()
        {
            var trades = History.FindAll(BotLabel);
            int total = trades.Length;
            if (total == 0)
            {
                Print("BOT PERFORMANCE: no closed trades yet; win rate and profit factor are not available.");
                return;
            }

            int wins = trades.Count(t => t.NetProfit > 0);
            int losses = trades.Count(t => t.NetProfit < 0);
            double net = trades.Sum(t => t.NetProfit);
            double grossWins = trades.Where(t => t.NetProfit > 0).Sum(t => t.NetProfit);
            double grossLosses = Math.Abs(trades.Where(t => t.NetProfit < 0).Sum(t => t.NetProfit));
            string profitFactor = grossLosses > 0 ? (grossWins / grossLosses).ToString("F2") : "N/A (no losing trades)";

            Print("BOT HISTORICAL PERFORMANCE | Closed trades: {0} | Wins: {1} | Losses: {2} | Win rate: {3:F1}% | Net P/L: {4:F2} {5} | Profit factor: {6}",
                total, wins, losses, (double)wins / total * 100.0, net, Account.Asset.Name, profitFactor);
            Print("Performance figures describe this bot's closed trades only; they are historical results, not a guaranteed future win probability.");
        }

        private void StartScanCycle()
        {
            _scanQueue.Clear();
            _scanCandidates.Clear();
            _scanIndex = 0;
            _openedThisScan = 0;
            RefreshRiskBaselines();
            if (!RiskGateAllowsEntries()) return;
            for (int i = 0; i < Symbols.Count; i++)
            {
                string name = Symbols[i];
                if (!string.IsNullOrWhiteSpace(name) && IsTargetMarket(name)) _scanQueue.Add(name);
            }
            Print("SCAN START | host={0} | broker symbols={1} | target markets={2} | batch size={3}.", SymbolName, Symbols.Count, _scanQueue.Count, SymbolsPerBatch);
            if (_scanQueue.Count == 0) Print("SCAN DIAGNOSTIC: no supported symbols found in broker catalogue.");
        }

        private void ProcessScanBatch()
        {
            try
            {
                if (_scanQueue.Count == 0)
                {
                    if (_lastScanCompleted == DateTime.MinValue || (Server.Time - _lastScanCompleted).TotalSeconds >= ScanIntervalSeconds) StartScanCycle();
                    if (_scanQueue.Count == 0) return;
                }
                int processed = 0;
                while (_scanIndex < _scanQueue.Count && processed < SymbolsPerBatch)
                {
                    string name = _scanQueue[_scanIndex++]; processed++;
                    Symbol symbol = Symbols.GetSymbol(name);
                    if (symbol == null || !symbol.MarketHours.IsOpened()) continue;
                    if (AvoidDuplicateSymbols && Positions.FindAll(BotLabel, symbol.Name).Length > 0) continue;
                    TradeCandidate candidate = EvaluateSymbol(symbol);
                    if (candidate != null && candidate.Score > MinimumScore)
                    {
                        _scanCandidates.Add(candidate);
                        Print("QUALIFIED {0} {1} | technical score={2:F1}% (not a statistically validated win probability).", candidate.Direction, name, candidate.Score);
                        TryOpenQualifiedCandidate(candidate);
                    }
                }
                Print("SCAN PROGRESS: {0}/{1} symbols processed; candidates={2}.", _scanIndex, _scanQueue.Count, _scanCandidates.Count);
                if (_scanIndex >= _scanQueue.Count) CompleteScanCycle();
            }
            catch (Exception ex) { Print("BATCH SCAN ERROR: {0}", ex.Message); }
        }


        private void TryOpenQualifiedCandidate(TradeCandidate candidate)
        {
            if (!RiskGateAllowsEntries())
            {
                Print("ENTRY SKIPPED {0}: account risk gate is active.", candidate.Symbol.Name);
                return;
            }
            if (AvoidDuplicateSymbols && Positions.FindAll(BotLabel, candidate.Symbol.Name).Length > 0)
            {
                Print("ENTRY SKIPPED {0}: bot already has a position on this symbol.", candidate.Symbol.Name);
                return;
            }
            var exposure = BuildCurrentCurrencyExposure();
            if (UseCurrencyExposureGuard && candidate.IsForex && WouldIncreaseConcentratedExposure(candidate, exposure))
            {
                Print("ENTRY SKIPPED {0}: correlated FX exposure guard blocked this candidate.", candidate.Symbol.Name);
                return;
            }
            Print("ENTRY ATTEMPT {0} {1} | score={2:F1}% | qualifying threshold > {3:F1}%.",
                candidate.Direction, candidate.Symbol.Name, candidate.Score, MinimumScore);
            if (PlaceTrade(candidate))
            {
                _openedThisScan++;
                if (UseCurrencyExposureGuard && candidate.IsForex)
                    ApplyExposure(candidate, exposure);
            }
        }

        private void CompleteScanCycle()
        {
            var ranked = _scanCandidates.OrderByDescending(c => c.Score).ThenByDescending(c => c.RewardRisk).ThenBy(c => c.SpreadToAtr).ToList();
            Print("SCAN COMPLETE | broker symbols={0} | supported markets={1} | qualifying={2} | opened during scan={3}.", Symbols.Count, _scanQueue.Count, ranked.Count, _openedThisScan);
            // Candidates are attempted as soon as they qualify during scanning.
            // This completion pass is diagnostic only; it does not place duplicate orders.
            if (ranked.Count == 0) Print("NO TRADE: no market scored above the strict threshold and passed all entry filters; no forced trades.");
            else if (_openedThisScan == 0) Print("QUALIFIED CANDIDATES WERE FOUND, BUT NO ORDER OPENED: check entry-skip and broker-rejection messages above.");
            _lastScanCompleted = Server.Time;
            _scanQueue.Clear(); _scanIndex = 0; _scanCandidates.Clear();
        }
        private void RefreshRiskBaselines()
        {
            DateTime today = Server.Time.Date;
            var accountHistory = History.ToArray();
            double todayClosedNet = accountHistory
                .Where(t => t.ClosingTime.Date == today)
                .Sum(t => t.NetProfit);

            // Reconstruct today's opening balance from current balance and all
            // account trades closed today. Floating P/L remains included through Equity.
            double reconstructedStartBalance = Account.Balance - todayClosedNet;
            if (reconstructedStartBalance > 0)
                _dayStartBalance = reconstructedStartBalance;

            if (today != _riskDay)
            {
                _riskDay = today;
                _riskLockLogged = false;
                Print("Daily opening-balance reference reconstructed from account history: {0:F2} {1}.",
                    _dayStartBalance, Account.Asset.Name);
            }

            // Use the account's historical closed-balance high-water mark. Unlike
            // LocalStorage, History is available after a cTrader Cloud restart.
            double historicalPeakBalance = accountHistory.Length > 0
                ? accountHistory.Max(t => t.Balance)
                : Account.Balance;
            _peakBalance = Math.Max(_peakBalance, Math.Max(Account.Balance, historicalPeakBalance));
        }

        private bool RiskGateAllowsEntries()
        {
            if (Account.IsLive)
            {
                Print("EMERGENCY ENTRY BLOCK: account is live; demo-only cBot cannot trade.");
                Stop();
                return false;
            }

            double dailyFloor = _dayStartBalance * (1.0 - DailyLossLimitPercent / 100.0);
            double drawdownFloor = _peakBalance * (1.0 - PeakDrawdownLimitPercent / 100.0);

            if (Account.Equity <= dailyFloor || Account.Equity <= drawdownFloor)
            {
                if (!_riskLockLogged)
                {
                    Print("RISK LOCK ACTIVE. Equity={0}; daily-loss floor={1}; historical peak-balance floor={2}. New entries disabled.",
                        Account.Equity, dailyFloor, drawdownFloor);
                    _riskLockLogged = true;
                }
                return false;
            }

            if (Account.FreeMargin <= 0)
                return false;

            return true;
        }

        private bool IsTargetMarket(string rawName)
        {
            if (string.IsNullOrWhiteSpace(rawName))
                return false;

            string name = new string(rawName.Where(char.IsLetter).ToArray()).ToUpperInvariant();

            // Deriv synthetic indices are identified by their broker-listed symbol names.
            // This keeps the scan dynamic: newly listed variants with these families
            // are included automatically without hard-coding every volatility level.
            if (name.Contains("VOLATILITY") ||
                name.Contains("BOOM") ||
                name.Contains("CRASH") ||
                name.Contains("STEP") ||
                name.Contains("JUMP") ||
                name.Contains("RANGEBREAK") ||
                name.Contains("DRIFT") ||
                name.Contains("VOLSWITCH") ||
                name.Contains("MULTIPLIER") ||
                name.Contains("DEX") ||
                name.Contains("TREK") ||
                name.Contains("HYBRID") ||
                name.Contains("SYNTHETIC"))
                return true;

            if (name.StartsWith("XAU") || name.StartsWith("BTC"))
                return true;

            if (name.Length < 6)
                return false;

            string baseCurrency = name.Substring(0, 3);
            string quoteCurrency = name.Substring(3, 3);
            return Currencies.Contains(baseCurrency) && Currencies.Contains(quoteCurrency)
                   && baseCurrency != quoteCurrency;
        }

        private TradeCandidate EvaluateSymbol(Symbol symbol)
        {
            SymbolContext context = GetContext(symbol);
            if (context == null || symbol.PipSize <= 0 || symbol.Ask <= 0 || symbol.Bid <= 0)
                return null;

            double buyWeight = 0;
            double sellWeight = 0;
            double totalWeight = 0;

            for (int i = 0; i < context.TimeFrames.Length; i++)
            {
                TimeFrameData data = context.TimeFrames[i];
                if (data.Bars == null || data.Fast == null || data.Middle == null || data.Trend == null || data.Bars.Count < TrendEmaPeriod + 10)
                    continue;

                totalWeight += TimeFrameWeights[i];

                int closed = 1;
                double fast = data.Fast.Result.Last(closed);
                double middle = data.Middle.Result.Last(closed);
                double trend = data.Trend.Result.Last(closed);
                double close = data.Bars.ClosePrices.Last(closed);

                bool bullish = fast > middle && middle > trend && close > trend;
                bool bearish = fast < middle && middle < trend && close < trend;

                if (bullish)
                    buyWeight += TimeFrameWeights[i];
                else if (bearish)
                    sellWeight += TimeFrameWeights[i];
            }

            if (context.TimeFrames[2].Bars == null || context.TimeFrames[2].Bars.Count < TrendEmaPeriod + 10 || totalWeight <= 0)
                return null;

            TradeType direction;
            double directionalWeight;
            if (buyWeight > sellWeight)
            {
                direction = TradeType.Buy;
                directionalWeight = buyWeight;
            }
            else if (sellWeight > buyWeight)
            {
                direction = TradeType.Sell;
                directionalWeight = sellWeight;
            }
            else
                return null;

            double alignmentScore = directionalWeight / totalWeight * 100.0;
            double rsi = context.Rsi.Result.Last(1);
            if (direction == TradeType.Buy && (rsi < 52 || rsi > 72))
                return null;
            if (direction == TradeType.Sell && (rsi > 48 || rsi < 28))
                return null;

            double rsiScore;
            if (direction == TradeType.Buy)
                rsiScore = rsi <= 60 ? 70.0 + (rsi - 52.0) / 8.0 * 30.0
                                     : 100.0 - (rsi - 60.0) / 12.0 * 30.0;
            else
                rsiScore = rsi >= 40 ? 70.0 + (48.0 - rsi) / 8.0 * 30.0
                                     : 100.0 - (40.0 - rsi) / 12.0 * 30.0;
            rsiScore = Math.Max(0.0, Math.Min(100.0, rsiScore));

            double atr = context.Atr.Result.Last(1);
            if (atr <= 0)
                return null;

            double spread = symbol.Ask - symbol.Bid;
            double spreadToAtr = spread / atr;
            if (spreadToAtr > MaximumSpreadToAtr)
                return null;

            var m15 = context.TimeFrames[2];
            double emaSeparation = Math.Abs(m15.Fast.Result.Last(1) - m15.Middle.Result.Last(1));
            double trendStrengthScore = Math.Max(0.0, Math.Min(100.0, (emaSeparation / atr) * 250.0));
            double spreadEfficiencyScore = Math.Max(0.0, Math.Min(100.0,
                (1.0 - spreadToAtr / MaximumSpreadToAtr) * 100.0));

            // Technical evidence score only; not a statistically calibrated win probability.
            // Historical predictive performance requires out-of-sample backtesting.
            double score = alignmentScore * 0.50
                         + rsiScore * 0.20
                         + trendStrengthScore * 0.15
                         + spreadEfficiencyScore * 0.15;

            double stopDistancePrice = atr * StopAtrMultiple;
            double stopPips = stopDistancePrice / symbol.PipSize;
            if (stopPips <= 0 || double.IsNaN(stopPips) || double.IsInfinity(stopPips))
                return null;

            return new TradeCandidate
            {
                Symbol = symbol,
                Direction = direction,
                Score = score,
                AlignmentScore = alignmentScore,
                RsiScore = rsiScore,
                TrendStrengthScore = trendStrengthScore,
                SpreadEfficiencyScore = spreadEfficiencyScore,
                Rsi = rsi,
                AtrPrice = atr,
                StopPips = stopPips,
                TakeProfitPips = stopPips * TakeProfitR,
                RewardRisk = TakeProfitR,
                SpreadToAtr = spreadToAtr,
                IsForex = IsForexSymbol(symbol.Name)
            };
        }

        private SymbolContext GetContext(Symbol symbol)
        {
            if (_contexts.TryGetValue(symbol.Name, out SymbolContext existing))
                return existing;

            try
            {
                var timeFrameData = new TimeFrameData[ScanTimeFrames.Length];
                for (int i = 0; i < ScanTimeFrames.Length; i++)
                {
                    Bars bars = MarketData.GetBars(ScanTimeFrames[i], symbol.Name);
                    if (bars == null || bars.Count < TrendEmaPeriod + 10)
                    {
                        timeFrameData[i] = new TimeFrameData { Bars = bars };
                        continue;
                    }
                    var fast = Indicators.ExponentialMovingAverage(bars.ClosePrices, FastEmaPeriod);
                    var middle = Indicators.ExponentialMovingAverage(bars.ClosePrices, MiddleEmaPeriod);
                    var trend = Indicators.ExponentialMovingAverage(bars.ClosePrices, TrendEmaPeriod);
                    timeFrameData[i] = new TimeFrameData { Bars = bars, Fast = fast, Middle = middle, Trend = trend };
                }

                Bars m15 = MarketData.GetBars(TimeFrame.Minute15, symbol.Name);
                if (m15 == null || m15.Count < Math.Max(TrendEmaPeriod + 10, RsiPeriod + 10))
                    return null;
                var rsi = Indicators.RelativeStrengthIndex(m15.ClosePrices, RsiPeriod);
                var atr = Indicators.AverageTrueRange(m15, AtrPeriod, MovingAverageType.Exponential);

                var context = new SymbolContext
                {
                    TimeFrames = timeFrameData,
                    Rsi = rsi,
                    Atr = atr
                };
                _contexts[symbol.Name] = context;
                return context;
            }
            catch (Exception ex)
            {
                Print("Could not load data for {0}: {1}", symbol.Name, ex.Message);
                return null;
            }
        }

        private bool PlaceTrade(TradeCandidate candidate)
        {
            Symbol symbol = candidate.Symbol;
            double riskCash = Account.Equity * RiskPercent / 100.0;
            double volume = symbol.VolumeForFixedRisk(riskCash, candidate.StopPips, RoundingMode.Down);
            volume = symbol.NormalizeVolumeInUnits(volume, RoundingMode.Down);

            if (volume < symbol.VolumeInUnitsMin || volume > symbol.VolumeInUnitsMax || double.IsNaN(volume))
            {
                Print("Skipped {0}: calculated volume {1} is outside broker limits; risk budget was not rounded up.",
                    symbol.Name, volume);
                return false;
            }

            var result = ExecuteMarketOrder(
                candidate.Direction,
                symbol.Name,
                volume,
                BotLabel,
                candidate.StopPips,
                candidate.TakeProfitPips,
                "Top-ranked demo signal; calculated technical confidence score " + candidate.Score.ToString("F1") + "%");

            if (!result.IsSuccessful)
            {
                Print("Order rejected for {0}: {1}", symbol.Name, result.Error);
                return false;
            }

            Print("OPENED {0} {1} | CALCULATED TECHNICAL CONFIDENCE {2:F1}% (not a win probability) | RSI {3:F1} | SL {4:F1} pips | TP {5:F1} pips | volume {6}",
                candidate.Direction, symbol.Name, candidate.Score, candidate.Rsi,
                candidate.StopPips, candidate.TakeProfitPips, volume);
            return true;
        }

        private bool IsForexSymbol(string rawName)
        {
            string name = new string(rawName.Where(char.IsLetter).ToArray()).ToUpperInvariant();
            return name.Length >= 6 &&
                   Currencies.Contains(name.Substring(0, 3)) &&
                   Currencies.Contains(name.Substring(3, 3));
        }

        private Dictionary<string, int> BuildCurrentCurrencyExposure()
        {
            var exposure = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (Position position in Positions.FindAll(BotLabel))
            {
                if (!IsForexSymbol(position.SymbolName))
                    continue;

                string clean = new string(position.SymbolName.Where(char.IsLetter).ToArray()).ToUpperInvariant();
                if (clean.Length < 6)
                    continue;

                string baseCurrency = clean.Substring(0, 3);
                string quoteCurrency = clean.Substring(3, 3);
                int sign = position.TradeType == TradeType.Buy ? 1 : -1;
                AddExposure(exposure, baseCurrency, sign);
                AddExposure(exposure, quoteCurrency, -sign);
            }
            return exposure;
        }

        private bool WouldIncreaseConcentratedExposure(TradeCandidate candidate, Dictionary<string, int> exposure)
        {
            string clean = new string(candidate.Symbol.Name.Where(char.IsLetter).ToArray()).ToUpperInvariant();
            if (clean.Length < 6)
                return false;

            string baseCurrency = clean.Substring(0, 3);
            string quoteCurrency = clean.Substring(3, 3);
            int sign = candidate.Direction == TradeType.Buy ? 1 : -1;

            int baseCurrent = exposure.ContainsKey(baseCurrency) ? exposure[baseCurrency] : 0;
            int quoteCurrent = exposure.ContainsKey(quoteCurrency) ? exposure[quoteCurrency] : 0;

            // Do not add a second same-direction net exposure in either currency.
            return (baseCurrent != 0 && Math.Sign(baseCurrent) == sign) ||
                   (quoteCurrent != 0 && Math.Sign(quoteCurrent) == -sign);
        }

        private void ApplyExposure(TradeCandidate candidate, Dictionary<string, int> exposure)
        {
            string clean = new string(candidate.Symbol.Name.Where(char.IsLetter).ToArray()).ToUpperInvariant();
            if (clean.Length < 6)
                return;

            int sign = candidate.Direction == TradeType.Buy ? 1 : -1;
            AddExposure(exposure, clean.Substring(0, 3), sign);
            AddExposure(exposure, clean.Substring(3, 3), -sign);
        }

        private void AddExposure(Dictionary<string, int> exposure, string currency, int amount)
        {
            if (!exposure.ContainsKey(currency))
                exposure[currency] = 0;
            exposure[currency] += amount;
        }

        private sealed class SymbolContext
        {
            public TimeFrameData[] TimeFrames { get; set; }
            public RelativeStrengthIndex Rsi { get; set; }
            public AverageTrueRange Atr { get; set; }
        }

        private sealed class TimeFrameData
        {
            public Bars Bars { get; set; }
            public ExponentialMovingAverage Fast { get; set; }
            public ExponentialMovingAverage Middle { get; set; }
            public ExponentialMovingAverage Trend { get; set; }
        }

        private sealed class TradeCandidate
        {
            public Symbol Symbol { get; set; }
            public TradeType Direction { get; set; }
            public double Score { get; set; }
            public double AlignmentScore { get; set; }
            public double RsiScore { get; set; }
            public double TrendStrengthScore { get; set; }
            public double SpreadEfficiencyScore { get; set; }
            public double Rsi { get; set; }
            public double AtrPrice { get; set; }
            public double StopPips { get; set; }
            public double TakeProfitPips { get; set; }
            public double RewardRisk { get; set; }
            public double SpreadToAtr { get; set; }
            public bool IsForex { get; set; }
        }
    }
}
