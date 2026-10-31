// -----------------------------------------------------------------------------
// Analyzer.pro - Deriv cTrader Cloud Demo Bot
// Version 2.1.0 - M5 early-direction confirmation strategy
// -----------------------------------------------------------------------------
// Strategy:
// - Scans all broker-listed supported FX, XAU, BTC and Deriv synthetic symbols.
// - Enters as soon as the live M5 candle first shows a clear green/red direction.
// - During the first 30 seconds, an opposite colour closes the provisional trade.
// - At +30 seconds, the surviving direction is confirmed; a still-flat candle is skipped.
// - Tracks price-based maximum favourable excursion (MFE).
// - Closes after a 25% retracement from peak MFE, retaining approximately 75%.
// - If no retracement occurs, closes at the end of the originating M5 candle.
// - One bot position per symbol; no portfolio-wide position cap.
// - Demo-account guard and broker-side emergency stop remain enabled.
// - No M1/M15/H1/H4/D1/W1 data, indicators, filters or strategy logic.
// -----------------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Linq;
using System.Globalization;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.None)]
    public class DerivTop3CloudDemoBot : Robot
    {
        private const string BotLabel = "ANALYZERPRO_CTRADER_DEMO_V1";
        private const int CandleMinutes = 5;
        private const int ConfirmationWindowSeconds = 30;
        private const double RetainedMfeFraction = 0.75;

        [Parameter("Demo only (mandatory)", DefaultValue = true)]
        public bool DemoOnly { get; set; }

        [Parameter("Maximum floating loss per trade (account currency)", DefaultValue = 0.95, MinValue = 0.10, MaxValue = 1000.0, Step = 0.05)]
        public double MaximumFloatingLossPerTrade { get; set; }

        [Parameter("Emergency stop ATR multiple (M5)", DefaultValue = 2.0, MinValue = 1.0, MaxValue = 5.0, Step = 0.25)]
        public double StopAtrMultiple { get; set; }

        [Parameter("Emergency stop minimum (pips)", DefaultValue = 10.0, MinValue = 1.0, MaxValue = 1000.0)]
        public double MinimumEmergencyStopPips { get; set; }

        [Parameter("Symbols per timer cycle", DefaultValue = 25, MinValue = 1, MaxValue = 250)]
        public int SymbolsPerCycle { get; set; }

        private readonly Dictionary<string, Bars> _m5Bars = new Dictionary<string, Bars>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, DateTime> _lastDecisionCandle = new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<long, DateTime> _originCandleByPosition = new Dictionary<long, DateTime>();
        private readonly Dictionary<long, double> _peakPriceByPosition = new Dictionary<long, double>();
        private readonly HashSet<long> _restartStateRecovered = new HashSet<long>();
        private readonly HashSet<string> _reportedDataErrors = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<string> _currencies = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "SEK", "NOK", "DKK",
            "SGD", "HKD", "MXN", "ZAR", "TRY", "PLN", "HUF", "CZK"
        };

        private string[] _symbols = new string[0];
        private int _symbolCursor;
        private DateTime _lastHeartbeat = DateTime.MinValue;

        protected override void OnStart()
        {
            if (!DemoOnly || Account.IsLive)
            {
                Print("START BLOCKED: This cBot is restricted to DEMO accounts. No orders were placed.");
                Stop();
                return;
            }

            Positions.Closed += OnPositionClosed;
            RefreshSymbolCatalogue();
            Print("Analyzer.pro cTrader Cloud Demo Bot v2.1 started.");
            Print("MODE: M5 ONLY | enter on first clear candle colour | opposite colour during first 30 seconds closes trade | flat at +30s skips.");
            Print("EXIT: opposite-colour reversal closes provisional entry; then 75% MFE lock after 25% retracement; otherwise close at M5 candle end.");
            Print("MARKETS: broker-listed FX, XAU, BTC and supported Deriv synthetic symbols.");
            Print("POSITION LIMIT: no global cap; one active position per symbol.");
            Print("SAFETY: demo-only guard and broker-side emergency stop active.");
            Timer.Start(TimeSpan.FromSeconds(1));
        }

        protected override void OnTimer()
        {
            try
            {
                DateTime now = Server.Time;
                ManagePositions(now);
                if (_symbols.Length == 0 || _symbolCursor >= _symbols.Length)
                    RefreshSymbolCatalogue();

                int processed = 0;
                while (_symbolCursor < _symbols.Length && processed < SymbolsPerCycle)
                {
                    string name = _symbols[_symbolCursor++];
                    processed++;
                    ProcessSymbol(name, now);
                }

                if (_lastHeartbeat == DateTime.MinValue || (now - _lastHeartbeat).TotalSeconds >= 30)
                {
                    _lastHeartbeat = now;
                    Print("M5 HEARTBEAT | {0:yyyy-MM-dd HH:mm:ss} UTC | symbols={1} | cursor={2} | bot positions={3}.",
                        now, _symbols.Length, _symbolCursor, Positions.FindAll(BotLabel).Length);
                }
            }
            catch (Exception ex)
            {
                Print("TIMER ERROR | {0}: {1}", ex.GetType().Name, ex.Message);
            }
        }

        private void RefreshSymbolCatalogue()
        {
            var found = new List<string>();
            for (int i = 0; i < Symbols.Count; i++)
            {
                string name = Symbols[i];
                if (!string.IsNullOrWhiteSpace(name) && IsTargetMarket(name))
                    found.Add(name);
            }
            _symbols = found.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            _symbolCursor = 0;
            Print("MARKET CATALOGUE REFRESHED | broker symbols={0} | supported symbols={1}.", Symbols.Count, _symbols.Length);
        }

        private void ProcessSymbol(string name, DateTime now)
        {
            Symbol symbol = Symbols.GetSymbol(name);
            if (symbol == null || symbol.PipSize <= 0 || symbol.Ask <= 0 || symbol.Bid <= 0 || !symbol.MarketHours.IsOpened())
                return;

            Bars bars;
            if (!_m5Bars.TryGetValue(name, out bars))
            {
                try
                {
                    bars = MarketData.GetBars(TimeFrame.Minute5, name);
                    if (bars == null)
                        return;
                    _m5Bars[name] = bars;
                }
                catch (Exception ex)
                {
                    if (_reportedDataErrors.Add(name))
                        Print("M5 DATA LOAD FAILED | {0}: {1}", name, ex.Message);
                    return;
                }
            }

            if (bars.Count < 16)
                return;

            DateTime candleOpen = bars.OpenTimes.Last(0);
            DateTime confirmationTime = candleOpen.AddSeconds(ConfirmationWindowSeconds);
            DateTime candleEnd = candleOpen.AddMinutes(CandleMinutes);
            if (now >= candleEnd)
                return;

            DateTime lastDecision;
            if (_lastDecisionCandle.TryGetValue(name, out lastDecision) && lastDecision == candleOpen)
                return;

            if (Positions.FindAll(BotLabel).Any(p => string.Equals(p.SymbolName, name, StringComparison.OrdinalIgnoreCase)))
            {
                _lastDecisionCandle[name] = candleOpen;
                return;
            }

            double open = bars.OpenPrices.Last(0);
            double live = bars.ClosePrices.Last(0);
            if (live > open)
                OpenPosition(symbol, bars, TradeType.Buy, candleOpen);
            else if (live < open)
                OpenPosition(symbol, bars, TradeType.Sell, candleOpen);
            else if (now >= confirmationTime)
            {
                Print("M5 FLAT AT 30-SECOND CONFIRMATION - NO ENTRY | {0} | candle={1:HH:mm} UTC.", name, candleOpen);
                _lastDecisionCandle[name] = candleOpen;
            }
        }

        private void OpenPosition(Symbol symbol, Bars bars, TradeType direction, DateTime candleOpen)
        {
            _lastDecisionCandle[symbol.Name] = candleOpen;
            try
            {
                double volume = symbol.NormalizeVolumeInUnits(symbol.VolumeInUnitsMin, RoundingMode.Down);
                if (volume < symbol.VolumeInUnitsMin || volume > symbol.VolumeInUnitsMax || double.IsNaN(volume))
                {
                    Print("ENTRY SKIPPED | {0} | invalid broker minimum volume.", symbol.Name);
                    return;
                }

                double atr = CalculateM5Atr(bars, 14);
                if (atr <= 0 || double.IsNaN(atr) || double.IsInfinity(atr))
                {
                    Print("ENTRY SKIPPED | {0} | insufficient/invalid M5 ATR data.", symbol.Name);
                    return;
                }

                double stopDistance = Math.Max(atr * StopAtrMultiple, MinimumEmergencyStopPips * symbol.PipSize);
                double stopPips = Math.Max(MinimumEmergencyStopPips, stopDistance / symbol.PipSize);
                TradeResult result = ExecuteMarketOrder(direction, symbol.Name, volume, BotLabel, stopPips, (double?)null,
                    "ANALYZERPRO_M5_EARLY | " + candleOpen.ToString("yyyyMMddHHmm", CultureInfo.InvariantCulture));

                if (!result.IsSuccessful)
                {
                    Print("ORDER REJECTED | {0} {1} | {2}.", direction, symbol.Name, result.Error);
                    return;
                }

                Position position = result.Position;
                _originCandleByPosition[position.Id] = candleOpen;
                _peakPriceByPosition[position.Id] = direction == TradeType.Buy ? symbol.Bid : symbol.Ask;
                Print("M5 TRADE OPENED | {0} {1} | entry={2} | volume={3} | candle={4:HH:mm} UTC | emergency SL={5:F1} pips.",
                    direction, symbol.Name, position.EntryPrice, volume, candleOpen, stopPips);
            }
            catch (Exception ex)
            {
                Print("ENTRY ERROR | {0}: {1}", symbol.Name, ex.Message);
            }
        }

        private double CalculateM5Atr(Bars bars, int period)
        {
            if (bars == null || bars.Count < period + 2)
                return 0;
            double total = 0;
            for (int i = 1; i <= period; i++)
            {
                double high = bars.HighPrices.Last(i);
                double low = bars.LowPrices.Last(i);
                double previousClose = bars.ClosePrices.Last(i + 1);
                double trueRange = Math.Max(high - low,
                    Math.Max(Math.Abs(high - previousClose), Math.Abs(low - previousClose)));
                total += trueRange;
            }
            return total / period;
        }

        private void ManagePositions(DateTime now)
        {
            foreach (Position position in Positions.FindAll(BotLabel))
            {
                try
                {
                    if (position.NetProfit <= -Math.Abs(MaximumFloatingLossPerTrade))
                    {
                        TradeResult lossClose = ClosePosition(position);
                        if (lossClose.IsSuccessful)
                        {
                            Print("HARD CASH LOSS EXIT | {0} {1} | P/L={2:F2} {3}.",
                                position.TradeType, position.SymbolName, position.NetProfit, Account.Asset.Name);
                            continue;
                        }
                        Print("HARD LOSS EXIT FAILED | {0} #{1} | {2}.", position.SymbolName, position.Id, lossClose.Error);
                    }

                    Symbol symbol = Symbols.GetSymbol(position.SymbolName);
                    if (symbol == null || symbol.PipSize <= 0)
                        continue;

                    DateTime origin;
                    if (!_originCandleByPosition.TryGetValue(position.Id, out origin))
                    {
                        // Recover the originating M5 candle from the position's entry timestamp
                        // after a Cloud restart. The peak begins at the first observed quote.
                        origin = FloorToM5(position.EntryTime);
                        _originCandleByPosition[position.Id] = origin;
                        _peakPriceByPosition[position.Id] = position.TradeType == TradeType.Buy ? symbol.Bid : symbol.Ask;
                        _restartStateRecovered.Add(position.Id);
                        Print("POSITION STATE RECOVERED | {0} {1} | origin candle={2:HH:mm} UTC | MFE tracking resumed from current quote.",
                            position.TradeType, position.SymbolName, origin);
                    }

                    // First 30 seconds are a direction-confirmation window. If the live
                    // candle changes to the opposite colour, close immediately and do not re-enter.
                    if (now < origin.AddSeconds(ConfirmationWindowSeconds))
                    {
                        Bars confirmBars;
                        if (_m5Bars.TryGetValue(position.SymbolName, out confirmBars) && confirmBars != null && confirmBars.Count > 0)
                        {
                            double candleOpen = confirmBars.OpenPrices.Last(0);
                            double candleLive = confirmBars.ClosePrices.Last(0);
                            bool reversed = position.TradeType == TradeType.Buy
                                ? candleLive < candleOpen
                                : candleLive > candleOpen;
                            if (reversed)
                            {
                                TradeResult reversalClose = ClosePosition(position);
                                if (reversalClose.IsSuccessful)
                                    Print("30-SECOND DIRECTION REVERSAL EXIT | {0} {1} | candle={2:HH:mm} UTC | trade closed; no re-entry this candle.",
                                        position.TradeType, position.SymbolName, origin);
                                else
                                    Print("DIRECTION REVERSAL EXIT FAILED | {0} #{1} | {2}.", position.SymbolName, position.Id, reversalClose.Error);
                                continue;
                            }
                        }
                    }

                    double executable = position.TradeType == TradeType.Buy ? symbol.Bid : symbol.Ask;
                    double peak;
                    if (!_peakPriceByPosition.TryGetValue(position.Id, out peak))
                        peak = executable;
                    peak = position.TradeType == TradeType.Buy ? Math.Max(peak, executable) : Math.Min(peak, executable);
                    _peakPriceByPosition[position.Id] = peak;

                    double maxFavourable = position.TradeType == TradeType.Buy
                        ? peak - position.EntryPrice
                        : position.EntryPrice - peak;

                    if (now >= origin.AddSeconds(ConfirmationWindowSeconds) && maxFavourable > symbol.TickSize)
                    {
                        double lockLevel = position.TradeType == TradeType.Buy
                            ? position.EntryPrice + maxFavourable * RetainedMfeFraction
                            : position.EntryPrice - maxFavourable * RetainedMfeFraction;
                        bool retraced = position.TradeType == TradeType.Buy
                            ? executable <= lockLevel
                            : executable >= lockLevel;

                        if (retraced)
                        {
                            TradeResult close = ClosePosition(position);
                            if (close.IsSuccessful)
                            {
                                Print("75% MFE EXIT | {0} {1} | entry={2} | peak={3} | exit={4} | retracement=25%.",
                                    position.TradeType, position.SymbolName, position.EntryPrice, peak, executable);
                                continue;
                            }
                            Print("MFE EXIT FAILED | {0} #{1} | {2}.", position.SymbolName, position.Id, close.Error);
                        }
                    }

                    if (now >= origin.AddMinutes(CandleMinutes))
                    {
                        TradeResult close = ClosePosition(position);
                        if (close.IsSuccessful)
                            Print("M5 CANDLE-END EXIT | {0} {1} | origin={2:HH:mm} UTC | P/L={3:F2} {4}.",
                                position.TradeType, position.SymbolName, origin, position.NetProfit, Account.Asset.Name);
                        else
                            Print("CANDLE-END EXIT FAILED | {0} #{1} | {2}.", position.SymbolName, position.Id, close.Error);
                    }
                }
                catch (Exception ex)
                {
                    Print("POSITION MANAGEMENT ERROR | {0} #{1}: {2}", position.SymbolName, position.Id, ex.Message);
                }
            }
        }

        private DateTime FloorToM5(DateTime value)
        {
            int minute = value.Minute - value.Minute % CandleMinutes;
            return new DateTime(value.Year, value.Month, value.Day, value.Hour, minute, 0, value.Kind);
        }

        private bool IsTargetMarket(string rawName)
        {
            if (string.IsNullOrWhiteSpace(rawName))
                return false;
            string name = new string(rawName.Where(char.IsLetter).ToArray()).ToUpperInvariant();

            if (name.Contains("VOLATILITY") || name.Contains("BOOM") || name.Contains("CRASH") ||
                name.Contains("STEP") || name.Contains("JUMP") || name.Contains("RANGEBREAK") ||
                name.Contains("DRIFT") || name.Contains("VOLSWITCH") || name.Contains("MULTIPLIER") ||
                name.Contains("DEX") || name.Contains("TREK") || name.Contains("HYBRID") ||
                name.Contains("SYNTHETIC"))
                return true;

            if (name.StartsWith("XAU") || name.StartsWith("BTC"))
                return true;

            if (name.Length < 6)
                return false;
            string baseCurrency = name.Substring(0, 3);
            string quoteCurrency = name.Substring(3, 3);
            return _currencies.Contains(baseCurrency) && _currencies.Contains(quoteCurrency) && baseCurrency != quoteCurrency;
        }

        private void OnPositionClosed(PositionClosedEventArgs args)
        {
            _originCandleByPosition.Remove(args.Position.Id);
            _peakPriceByPosition.Remove(args.Position.Id);
            _restartStateRecovered.Remove(args.Position.Id);
            Print("POSITION CLOSED | {0} {1} | final P/L={2:F2} {3}.",
                args.Position.TradeType, args.Position.SymbolName, args.Position.NetProfit, Account.Asset.Name);

            var history = History.FindAll(BotLabel);
            if (history.Length > 0)
            {
                int wins = history.Count(t => t.NetProfit > 0);
                int losses = history.Count(t => t.NetProfit < 0);
                double net = history.Sum(t => t.NetProfit);
                double grossWins = history.Where(t => t.NetProfit > 0).Sum(t => t.NetProfit);
                double grossLosses = Math.Abs(history.Where(t => t.NetProfit < 0).Sum(t => t.NetProfit));
                string pf = grossLosses > 0 ? (grossWins / grossLosses).ToString("F2") : "N/A";
                Print("BOT PERFORMANCE | trades={0} | wins={1} | losses={2} | win rate={3:F1}% | net={4:F2} {5} | profit factor={6}.",
                    history.Length, wins, losses, (double)wins / history.Length * 100.0, net, Account.Asset.Name, pf);
            }
        }

        protected override void OnStop()
        {
            Timer.Stop();
            Positions.Closed -= OnPositionClosed;
            Print("Analyzer.pro M5-only cBot stopped. Broker-side emergency stops remain attached to open positions.");
        }

        protected override void OnException(Exception exception)
        {
            Print("UNHANDLED CBOT EXCEPTION | {0}: {1}", exception.GetType().Name, exception.Message);
            Print("STACK TRACE | {0}", exception.StackTrace);
        }
    }
}