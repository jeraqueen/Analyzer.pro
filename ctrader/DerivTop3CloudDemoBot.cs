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
// - No forced entries. No averaging down, grid or martingale. Controlled multi-position entries are capped by portfolio limits.
// - This is not a guarantee of profitability. Backtest and demo-forward-test first.
// -----------------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Linq;
using System.Globalization;
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

        [Parameter("Daily loss limit (%)", DefaultValue = 50.0, MinValue = 0.5, MaxValue = 50.0, Step = 0.5)]
        public double DailyLossLimitPercent { get; set; }

        [Parameter("Maximum loss per position (% equity)", DefaultValue = 1.0, MinValue = 0.25, MaxValue = 2.0, Step = 0.25)]
        public double MaximumPositionLossPercent { get; set; }

        [Parameter("Maximum floating loss per trade (account currency)", DefaultValue = 0.95, MinValue = 0.10, MaxValue = 1000.0, Step = 0.05)]
        public double MaximumFloatingLossPerTrade { get; set; }

        [Parameter("Profit trailing activation (% equity)", DefaultValue = 1.0, MinValue = 0.25, MaxValue = 2.0, Step = 0.25)]
        public double ProfitTrailActivationPercent { get; set; }

        [Parameter("Peak profit lock activation (account currency)", DefaultValue = 0.5, MinValue = 0.1, MaxValue = 1000.0, Step = 0.1)]
        public double PeakProfitLockActivation { get; set; }

        [Parameter("Close after peak profit gives back (%)", DefaultValue = 25.0, MinValue = 10.0, MaxValue = 75.0, Step = 5.0)]
        public double PeakProfitGivebackPercent { get; set; }

        [Parameter("Profit trailing distance (ATR multiple)", DefaultValue = 2.0, MinValue = 0.5, MaxValue = 3.0, Step = 0.25)]
        public double ProfitTrailAtrMultiple { get; set; }

        [Parameter("Peak balance drawdown lock (%)", DefaultValue = 8.0, MinValue = 2.0, MaxValue = 15.0, Step = 0.5)]
        public double PeakDrawdownLimitPercent { get; set; }

        [Parameter("Scan interval (seconds)", DefaultValue = 15, MinValue = 15, MaxValue = 300)]
        public int ScanIntervalSeconds { get; set; }

        [Parameter("Symbols per batch", DefaultValue = 10, MinValue = 1, MaxValue = 10)]
        public int SymbolsPerBatch { get; set; }

        [Parameter("Batch interval (seconds)", DefaultValue = 2, MinValue = 1, MaxValue = 30)]
        public int BatchIntervalSeconds { get; set; }

        [Parameter("Minimum technical score (%)", DefaultValue = 88, MinValue = 80, MaxValue = 95)]
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

        [Parameter("Take Profit (R multiple)", DefaultValue = 6.0, MinValue = 3.0, MaxValue = 10.0, Step = 0.5)]
        public double TakeProfitR { get; set; }

        [Parameter("Breakeven trigger (R)", DefaultValue = 1.0, MinValue = 0.5, MaxValue = 3.0, Step = 0.25)]
        public double BreakevenR { get; set; }

        [Parameter("Partial profit trigger (R)", DefaultValue = 2.0, MinValue = 1.0, MaxValue = 5.0, Step = 0.25)]
        public double PartialProfitR { get; set; }

        [Parameter("Partial close fraction", DefaultValue = 0.35, MinValue = 0.1, MaxValue = 0.8, Step = 0.05)]
        public double PartialCloseFraction { get; set; }

        [Parameter("Start trailing at (R)", DefaultValue = 2.0, MinValue = 1.0, MaxValue = 5.0, Step = 0.25)]
        public double PositionTrailStartR { get; set; }

        [Parameter("Position trailing ATR multiple", DefaultValue = 2.5, MinValue = 1.0, MaxValue = 5.0, Step = 0.25)]
        public double PositionTrailAtrMultiple { get; set; }

        [Parameter("Reversal exit minimum profit (R)", DefaultValue = 0.75, MinValue = 0.0, MaxValue = 3.0, Step = 0.25)]
        public double ReversalExitMinR { get; set; }

        [Parameter("Position trail lookback bars", DefaultValue = 22, MinValue = 5, MaxValue = 100)]
        public int PositionTrailLookback { get; set; }

        [Parameter("Maximum spread / ATR", DefaultValue = 0.10, MinValue = 0.05, MaxValue = 0.5, Step = 0.05)]
        public double MaximumSpreadToAtr { get; set; }

        [Parameter("Avoid duplicate symbol positions", DefaultValue = true)]
        public bool AvoidDuplicateSymbols { get; set; }

        [Parameter("Limit correlated FX exposure", DefaultValue = true)]
        public bool UseCurrencyExposureGuard { get; set; }

        [Parameter("Maximum positions per symbol", DefaultValue = 2, MinValue = 1, MaxValue = 2)]
        public int MaximumPositionsPerSymbol { get; set; }

        [Parameter("Maximum total open positions", DefaultValue = 8, MinValue = 1, MaxValue = 10)]
        public int MaximumTotalPositions { get; set; }

        [Parameter("Maximum new positions per scan", DefaultValue = 8, MinValue = 1, MaxValue = 8)]
        public int MaximumNewPositionsPerScan { get; set; }

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
        private bool _rescanRequested;
        private DateTime _lastHeartbeatLog = DateTime.MinValue;
        private readonly Dictionary<long, double> _initialRiskPrice = new Dictionary<long, double>();
        private readonly Dictionary<long, double> _peakNetProfit = new Dictionary<long, double>();
        private readonly HashSet<long> _partialProfitTaken = new HashSet<long>();

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

            Print("Analyzer.pro Deriv Top-3 Cloud Demo Bot v1.1 started; initializing scan engine.");
            Print("Account: DEMO | Equity: {0} {1} | Risk/trade: {2}% | Max total positions: {3} | Max new per completed scan: {4}.",
                Account.Equity, Account.Asset.Name, RiskPercent, MaximumTotalPositions, MaximumNewPositionsPerScan);
            Print("Markets: dynamically scans supported FX, Gold (XAU), Bitcoin (BTC), and Deriv synthetic-market families whenever the broker reports them open. Closed markets are skipped automatically; reopened markets are included on the next scan.");
            Print("Timeframes: M1/M5 candle-following exits; M15/H1/H4/D1/W1 trend context; only closed candles are evaluated.");

            StartScanCycle();
            Timer.Start(TimeSpan.FromSeconds(BatchIntervalSeconds));
            _lastHeartbeatLog = Server.Time;
            Print("TIMER STARTED | interval={0}s | cloud heartbeat diagnostics enabled.", BatchIntervalSeconds);
        }

        protected override void OnTimer()
        {
            try
            {
                ManageOpenPositions();
                ProcessScanBatch();
                if (_lastHeartbeatLog == DateTime.MinValue || (Server.Time - _lastHeartbeatLog).TotalSeconds >= 30)
                {
                    _lastHeartbeatLog = Server.Time;
                    Print("BOT HEARTBEAT | {0:yyyy-MM-dd HH:mm:ss} UTC | timer active | open positions={1} | scan queue={2} | scan index={3} | candidates={4} | free margin={5:F2} {6}.",
                        Server.Time, Positions.FindAll(BotLabel).Length, _scanQueue.Count, _scanIndex, _scanCandidates.Count, Account.FreeMargin, Account.Asset.Name);
                }
            }
            catch (Exception ex)
            {
                Print("FATAL TIMER CYCLE ERROR (bot remains under cTrader supervision): {0}: {1}", ex.GetType().Name, ex.Message);
            }
        }

        protected override void OnException(Exception exception)
        {
            Print("UNHANDLED CBOT EXCEPTION: {0}: {1}", exception.GetType().Name, exception.Message);
            Print("STACK TRACE: {0}", exception.StackTrace);
        }

        // Each position is managed independently. A broker-side ATR stop is the
        // emergency protection; closed-candle reversal signals can exit earlier.
        // Peak-profit tracking is adaptive, not a fixed currency profit cap.
        private void ManageOpenPositions()
        {
            foreach (Position position in Positions.FindAll(BotLabel))
            {
                try
                {
                    Symbol symbol = Symbols.GetSymbol(position.SymbolName);
                    if (symbol == null || symbol.PipSize <= 0) continue;

                    double peak;
                    if (!_peakNetProfit.TryGetValue(position.Id, out peak))
                        peak = position.NetProfit;
                    peak = Math.Max(peak, position.NetProfit);
                    _peakNetProfit[position.Id] = peak;

                    // Protect even modest green trades: once the position has reached
                    // the configured peak-profit activation, close this position alone
                    // if it gives back the configured fraction while still profitable.
                    // This is separate from the distant broker-side R-multiple target.
                    double givebackFraction = Math.Max(0.10, Math.Min(0.75, PeakProfitGivebackPercent / 100.0));
                    if (peak >= PeakProfitLockActivation &&
                        position.NetProfit > 0 &&
                        position.NetProfit <= peak * (1.0 - givebackFraction))
                    {
                        TradeResult profitLockClose = ClosePosition(position);
                        if (profitLockClose.IsSuccessful)
                        {
                            Print("PEAK PROFIT LOCK EXIT | {0} {1} | peak={2:F2} {3} | closed P/L={4:F2} {3} | giveback={5:F0}%.",
                                position.TradeType, position.SymbolName, peak, Account.Asset.Name,
                                position.NetProfit, givebackFraction * 100.0);
                            continue;
                        }
                        Print("PEAK PROFIT LOCK EXIT FAILED | {0} {1}: {2}", position.SymbolName, position.Id, profitLockClose.Error);
                    }

                    // Hard cash-loss guard is checked before indicator/context lookups,
                    // so missing market context cannot bypass this protection.
                    if (position.NetProfit <= -Math.Abs(MaximumFloatingLossPerTrade))
                    {
                        TradeResult cashLossClose = ClosePosition(position);
                        if (cashLossClose.IsSuccessful)
                        {
                            Print("HARD CASH LOSS EXIT | {0} {1} | floating P/L={2:F2} {3} | configured limit=-{4:F2} {3}.",
                                position.TradeType, position.SymbolName, position.NetProfit, Account.Asset.Name,
                                Math.Abs(MaximumFloatingLossPerTrade));
                            _rescanRequested = true;
                            continue;
                        }
                        Print("HARD CASH LOSS EXIT FAILED | {0} {1}: {2}", position.SymbolName, position.Id, cashLossClose.Error);
                    }

                    SymbolContext context = GetContext(symbol);
                    if (context == null || context.TimeFrames == null) continue;

                    bool isBuy = position.TradeType == TradeType.Buy;
                    double riskPrice = ReadInitialRiskPrice(position);
                    if (riskPrice <= 0 && position.StopLoss.HasValue)
                        riskPrice = Math.Abs(position.EntryPrice - position.StopLoss.Value);
                    if (riskPrice <= 0)
                        riskPrice = context.Atr.Result.Last(1) * StopAtrMultiple;
                    if (riskPrice <= 0) continue;

                    double marketPrice = isBuy ? symbol.Bid : symbol.Ask;
                    double favorableMove = isBuy ? marketPrice - position.EntryPrice : position.EntryPrice - marketPrice;
                    double rMultiple = favorableMove / riskPrice;

                    // Lock some of the open gain with a price-based trailing stop once
                    // the move has room to breathe. It follows ATR and never loosens.
                    if (rMultiple >= 1.0)
                    {
                        double trailDistance = Math.Max(symbol.TickSize * 2, context.Atr.Result.Last(1) * PositionTrailAtrMultiple);
                        double proposed = isBuy ? marketPrice - trailDistance : marketPrice + trailDistance;
                        TryImprovePositionStop(position, symbol, proposed, marketPrice, isBuy);
                    }
                    else if (favorableMove > 0 && rMultiple >= 0.5)
                    {
                        double proposed = position.EntryPrice;
                        TryImprovePositionStop(position, symbol, proposed, marketPrice, isBuy);
                    }

                    bool fastReversal = FastCandleReversalConfirmed(context, isBuy);
                    bool structuralReversal = ReversalConfirmed(context, isBuy);
                    // Close only this position when price action confirms reversal.
                    // At a small gain, the fast candle signal is enough; at larger gains
                    // either fast reversal or broader structure confirmation can protect it.
                    // A cash-denominated hard loss limit above controls downside.
                    // Fast reversal remains an additional early exit when confirmed.
                    if (fastReversal && (position.NetProfit > 0 || rMultiple < 0))
                    {
                        TradeResult close = ClosePosition(position);
                        if (close.IsSuccessful)
                            Print("ADAPTIVE EXIT | {0} {1} closed on fast reversal | floating P/L={2:F2} {3} | peak P/L={4:F2} {3} | R={5:F2}.",
                                position.TradeType, position.SymbolName, position.NetProfit, Account.Asset.Name, peak, rMultiple);
                        else
                            Print("ADAPTIVE EXIT FAILED | {0} {1}: {2}", position.SymbolName, position.Id, close.Error);
                    }
                    else if (structuralReversal && position.NetProfit > 0 && (rMultiple >= ReversalExitMinR || peak > position.NetProfit))
                    {
                        TradeResult close = ClosePosition(position);
                        if (close.IsSuccessful)
                            Print("PROFIT PROTECTION EXIT | {0} {1} closed on structural reversal | floating P/L={2:F2} {3} | peak P/L={4:F2} {3} | R={5:F2}.",
                                position.TradeType, position.SymbolName, position.NetProfit, Account.Asset.Name, peak, rMultiple);
                        else
                            Print("PROFIT PROTECTION EXIT FAILED | {0} {1}: {2}", position.SymbolName, position.Id, close.Error);
                    }
                }
                catch (Exception ex)
                {
                    Print("POSITION MANAGEMENT ERROR | {0} {1}: {2}", position.SymbolName, position.Id, ex.Message);
                }
            }
        }

        private double ReadInitialRiskPrice(Position position)
        {
            const string marker = "AP_RPIPS=";
            string comment = position.Comment ?? string.Empty;
            int index = comment.IndexOf(marker, StringComparison.Ordinal);
            if (index < 0) return 0;
            string raw = comment.Substring(index + marker.Length).Split('|')[0];
            double pips;
            if (!double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out pips) || pips <= 0)
                return 0;
            Symbol symbol = Symbols.GetSymbol(position.SymbolName);
            return symbol == null ? 0 : pips * symbol.PipSize;
        }

        private void TryImprovePositionStop(Position position, Symbol symbol, double proposedStop, double marketPrice, bool isBuy)
        {
            proposedStop = Math.Round(proposedStop, symbol.Digits);
            if (proposedStop <= 0) return;
            if (isBuy && proposedStop >= marketPrice - symbol.TickSize) return;
            if (!isBuy && proposedStop <= marketPrice + symbol.TickSize) return;
            if (position.StopLoss.HasValue)
            {
                if (isBuy && proposedStop <= position.StopLoss.Value + symbol.TickSize * 0.5) return;
                if (!isBuy && proposedStop >= position.StopLoss.Value - symbol.TickSize * 0.5) return;
            }
            TradeResult result = ModifyPosition(position, proposedStop, position.TakeProfit);
            if (!result.IsSuccessful)
                Print("POSITION STOP UPDATE FAILED {0} {1}: {2}", position.SymbolName, position.Id, result.Error);
        }

        // Fast exit logic: two consecutive closed M1 candles against the position
        // beyond EMA 9, OR a decisive opposite M5 candle beyond EMA 9 confirmed
        // by loss of M15 or H1 EMA direction. Closed bars prevent tick-noise exits.
        private bool FastCandleReversalConfirmed(SymbolContext context, bool isBuy)
        {
            if (context.TimeFrames == null || context.TimeFrames.Length < 5)
                return false;

            var m1 = context.TimeFrames[0];
            var m5 = context.TimeFrames[1];
            var m15 = context.TimeFrames[2];
            var h1 = context.TimeFrames[4];

            bool m1Reversal = false;
            if (m1 != null && m1.Bars != null && m1.Fast != null && m1.Bars.Count >= 5)
            {
                double close1 = m1.Bars.ClosePrices.Last(1);
                double close2 = m1.Bars.ClosePrices.Last(2);
                double ema1 = m1.Fast.Result.Last(1);
                double ema2 = m1.Fast.Result.Last(2);
                bool twoBearish = close1 < m1.Bars.OpenPrices.Last(1) &&
                                  close2 < m1.Bars.OpenPrices.Last(2);
                bool twoBullish = close1 > m1.Bars.OpenPrices.Last(1) &&
                                  close2 > m1.Bars.OpenPrices.Last(2);
                m1Reversal = isBuy
                    ? twoBearish && close1 < ema1 && close2 < ema2
                    : twoBullish && close1 > ema1 && close2 > ema2;
            }

            bool m5Reversal = false;
            if (m5 != null && m5.Bars != null && m5.Fast != null && m5.Bars.Count >= 5 &&
                m15 != null && m15.Fast != null && m15.Middle != null &&
                h1 != null && h1.Fast != null && h1.Middle != null)
            {
                double m5Close = m5.Bars.ClosePrices.Last(1);
                double m5Open = m5.Bars.OpenPrices.Last(1);
                bool decisiveBear = m5Close < m5Open && m5Close < m5.Fast.Result.Last(1);
                bool decisiveBull = m5Close > m5Open && m5Close > m5.Fast.Result.Last(1);
                bool m15LostSupport = isBuy
                    ? m15.Fast.Result.Last(1) < m15.Middle.Result.Last(1)
                    : m15.Fast.Result.Last(1) > m15.Middle.Result.Last(1);
                bool h1LostSupport = isBuy
                    ? h1.Fast.Result.Last(1) < h1.Middle.Result.Last(1)
                    : h1.Fast.Result.Last(1) > h1.Middle.Result.Last(1);
                m5Reversal = isBuy
                    ? decisiveBear && (m15LostSupport || h1LostSupport)
                    : decisiveBull && (m15LostSupport || h1LostSupport);
            }

            return m1Reversal || m5Reversal;
        }

        private bool ReversalConfirmed(SymbolContext context, bool isBuy)
        {
            var m15 = context.TimeFrames[2];
            if (m15 == null || m15.Bars == null || m15.Bars.Count < 15)
                return false;

            int votes = 0;
            double fast = m15.Fast.Result.Last(1);
            double middle = m15.Middle.Result.Last(1);
            if (isBuy ? fast < middle : fast > middle) votes++;

            double rsiNow = context.Rsi.Result.Last(1);
            double extreme = isBuy ? 0.0 : 100.0;
            for (int i = 2; i <= 11; i++)
            {
                double value = context.Rsi.Result.Last(i);
                extreme = isBuy ? Math.Max(extreme, value) : Math.Min(extreme, value);
            }
            if (isBuy ? extreme > 60 && rsiNow < 50 : extreme < 40 && rsiNow > 50) votes++;

            double close = m15.Bars.ClosePrices.Last(1);
            double structure = isBuy ? double.MaxValue : double.MinValue;
            for (int i = 2; i <= 6; i++)
            {
                structure = isBuy
                    ? Math.Min(structure, m15.Bars.LowPrices.Last(i))
                    : Math.Max(structure, m15.Bars.HighPrices.Last(i));
            }
            if (isBuy ? close < structure : close > structure) votes++;
            return votes >= 2;
        }

        protected override void OnStop()
        {
            Timer.Stop();
            Positions.Closed -= OnPositionClosed;
            Print("Analyzer.pro cBot stopped. Existing broker-side SL/TP remain with their positions.");
        }

        private void OnPositionClosed(PositionClosedEventArgs args)
        {
            _initialRiskPrice.Remove(args.Position.Id);
            _peakNetProfit.Remove(args.Position.Id);
            _partialProfitTaken.Remove(args.Position.Id);
            PrintHistoricalPerformance();
            // Do not interrupt an active scan. Remaining open markets are evaluated
            // on schedule and can immediately fill the newly freed portfolio slot.
            // If the scan has already completed, the normal scan interval starts the next cycle.
            Print("POSITION CLOSED: portfolio slot freed; active scan continues and the next qualifying market may fill it.");
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
            // A risk lock must block ORDER PLACEMENT, not the scanner itself.
            // Continue evaluating markets and reporting scores/rejections while locked;
            // TryOpenQualifiedCandidate() checks the same gate immediately before every order.
            bool entriesAllowed = RiskGateAllowsEntries();
            if (!entriesAllowed)
            {
                Print("RISK-LOCKED SCAN MODE | equity={0:F2} | balance={1:F2} | free margin={2:F2} | daily start={3:F2} | peak balance={4:F2} | daily floor={5:F2} | peak floor={6:F2}. Scanning continues; all new orders remain blocked.",
                    Account.Equity, Account.Balance, Account.FreeMargin, _dayStartBalance, _peakBalance,
                    _dayStartBalance * (1.0 - DailyLossLimitPercent / 100.0),
                    _peakBalance * (1.0 - PeakDrawdownLimitPercent / 100.0));
            }
            int supportedOpen = 0;
            int supportedClosed = 0;
            for (int i = 0; i < Symbols.Count; i++)
            {
                string name = Symbols[i];
                if (string.IsNullOrWhiteSpace(name) || !IsTargetMarket(name)) continue;
                Symbol market = Symbols.GetSymbol(name);
                if (market == null) continue;
                if (market.MarketHours.IsOpened())
                {
                    _scanQueue.Add(name);
                    supportedOpen++;
                }
                else supportedClosed++;
            }
            Print("SCAN START | broker symbols={0} | supported OPEN markets queued={1} | supported CLOSED markets skipped={2} | batch size={3}.",
                Symbols.Count, supportedOpen, supportedClosed, SymbolsPerBatch);
            if (_scanQueue.Count == 0) Print("SCAN DIAGNOSTIC: no supported symbols found in broker catalogue.");
        }

        private void ProcessScanBatch()
        {
            try
            {
                if (_rescanRequested)
                {
                    _rescanRequested = false;
                    StartScanCycle();
                }
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
                    int symbolPositionCount = Positions.FindAll(BotLabel, symbol.Name).Length;
                    if (AvoidDuplicateSymbols && symbolPositionCount > 0) continue;
                    if (symbolPositionCount >= MaximumPositionsPerSymbol) continue;
                    TradeCandidate candidate = EvaluateSymbol(symbol);
                    if (candidate != null && candidate.Score > MinimumScore)
                    {
                        _scanCandidates.Add(candidate);
                        Print("QUALIFIED {0} {1} | technical score={2:F1}% (not a statistically validated win probability); attempting immediate entry.",
                            candidate.Direction, name, candidate.Score);
                        if (Positions.FindAll(BotLabel).Length < MaximumTotalPositions)
                            TryOpenQualifiedCandidate(candidate);
                        else
                            Print("PORTFOLIO FULL | {0}/{1} positions; continuing scan without new entries.", Positions.FindAll(BotLabel).Length, MaximumTotalPositions);
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
                Print("ENTRY NOT SENT {0}: account equity/drawdown or free-margin safety check failed. Check the account values printed above.", candidate.Symbol.Name);
                return;
            }
            int totalOpenPositions = Positions.FindAll(BotLabel).Length;
            if (totalOpenPositions >= MaximumTotalPositions)
            {
                Print("ENTRY SKIPPED {0}: portfolio cap reached ({1}/{2} positions).", candidate.Symbol.Name, totalOpenPositions, MaximumTotalPositions);
                return;
            }
            int symbolPositionCount = Positions.FindAll(BotLabel, candidate.Symbol.Name).Length;
            if (AvoidDuplicateSymbols && symbolPositionCount > 0)
            {
                Print("ENTRY SKIPPED {0}: duplicate-symbol setting is enabled.", candidate.Symbol.Name);
                return;
            }
            if (symbolPositionCount >= MaximumPositionsPerSymbol)
            {
                Print("ENTRY SKIPPED {0}: maximum positions per symbol reached ({1}).", candidate.Symbol.Name, MaximumPositionsPerSymbol);
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
            // Entries are attempted immediately as each qualifying market is evaluated.
            // The scan continues so a freed portfolio slot can be filled by a later candidate.
            if (ranked.Count == 0)
                Print("NO TRADE: no market scored above the strict threshold and passed all entry filters; no forced trades.");
            else if (_openedThisScan == 0)
                Print("QUALIFIED CANDIDATES WERE FOUND, BUT NO ORDER OPENED: check entry-skip and broker-rejection messages above.");
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
            // Keep the hard demo-only guard; no account-level percentage locks.
            if (Account.IsLive)
            {
                Print("EMERGENCY ENTRY BLOCK: account is live; demo-only cBot cannot trade.");
                Stop();
                return false;
            }

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
            // Keep demo test sizing at broker minimum. Attach a real ATR-based
            // protective stop; no fixed take-profit cap, so strong trades can run.
            double volume = symbol.NormalizeVolumeInUnits(symbol.VolumeInUnitsMin, RoundingMode.Down);

            if (volume < symbol.VolumeInUnitsMin || volume > symbol.VolumeInUnitsMax || double.IsNaN(volume))
            {
                Print("Skipped {0}: broker minimum volume is outside allowed limits.", symbol.Name);
                return false;
            }

            var result = ExecuteMarketOrder(
                candidate.Direction,
                symbol.Name,
                volume,
                BotLabel,
                candidate.StopPips,
                (double?)null,
                "ANALYZERPRO_DEMO_TEST | AP_RPIPS=" + candidate.StopPips.ToString("F1", CultureInfo.InvariantCulture) +
                " | SCORE=" + candidate.Score.ToString("F1", CultureInfo.InvariantCulture));

            if (!result.IsSuccessful)
            {
                Print("Order rejected for {0}: {1}", symbol.Name, result.Error);
                return false;
            }

            _initialRiskPrice[result.Position.Id] = candidate.StopPips * symbol.PipSize;
            _peakNetProfit[result.Position.Id] = result.Position.NetProfit;
            Print("OPENED {0} {1} | technical score {2:F1}% (not a win probability) | RSI {3:F1} | volume {4} | broker-side ATR stop={5:F1} pips | adaptive exits enabled; no fixed TP cap.",
                candidate.Direction, symbol.Name, candidate.Score, candidate.Rsi, volume, candidate.StopPips);
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
