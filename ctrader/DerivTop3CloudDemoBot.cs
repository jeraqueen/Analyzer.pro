// -----------------------------------------------------------------------------
// Analyzer.pro - Deriv cTrader Cloud Demo Bot
// Version 2.3.0 - synchronized M5 scanner with provisional reversals
// -----------------------------------------------------------------------------
// Strategy:
// - Preloads broker-listed supported FX, XAU, BTC and Deriv synthetic symbols.
// - Preloads supported symbols and subscribes to every symbol's M5 tick events.
// - Also checks every subscribed symbol on each one-second timer cycle; no rotating scan queue.
// - Opens on the first directional candle movement in the first 30 seconds of the shared UTC M5 cycle.
// - If direction reverses during those 30 seconds, closes the provisional trade and opens the opposite direction.
// - Allows up to 8 distinct symbols per M5 cycle and 8 concurrent positions by default.
// - Tracks executable-side peak MFE; closes on a 25% retracement, retaining approximately 75%.
// - Otherwise closes at the originating M5 candle boundary; retries failed closes.
// - Broker market hours and trading-enabled state are checked before entry.
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

        [Parameter("Maximum entries per M5 cycle", DefaultValue = 8, MinValue = 1, MaxValue = 50)]
        public int MaximumEntriesPerM5Cycle { get; set; }

        [Parameter("Maximum concurrent bot positions", DefaultValue = 8, MinValue = 1, MaxValue = 50)]
        public int MaximumConcurrentPositions { get; set; }

        private readonly Dictionary<string, Bars> _m5Bars = new Dictionary<string, Bars>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, DateTime> _lastDecisionCandle = new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<long, DateTime> _originCandleByPosition = new Dictionary<long, DateTime>();
        private readonly Dictionary<long, double> _peakPriceByPosition = new Dictionary<long, double>();
        private readonly HashSet<long> _restartStateRecovered = new HashSet<long>();
        private readonly HashSet<long> _reversalCloseInProgress = new HashSet<long>();
        private readonly HashSet<string> _enteredSymbolsThisCycle = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<string> _reportedDataErrors = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<string> _currencies = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "SEK", "NOK", "DKK",
            "SGD", "HKD", "MXN", "ZAR", "TRY", "PLN", "HUF", "CZK"
        };

        private string[] _symbols = new string[0];
        private int _entriesThisCycle;
        private DateTime _currentCycleOpen = DateTime.MinValue;
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
            InitializeMarketSubscriptions();
            Print("Analyzer.pro cTrader Cloud Demo Bot v2.3 started.");
            Print("ENTRY: every subscribed symbol checked on ticks AND on each one-second timer cycle.");
            Print("CYCLE: up to {0} distinct symbols per UTC M5 cycle; maximum {1} concurrent positions.", MaximumEntriesPerM5Cycle, MaximumConcurrentPositions);
            Print("REVERSAL: during first 30 seconds, close provisional trade and immediately enter the new candle direction.");
            Print("EXIT: after confirmation, close on 25% retracement from peak favourable movement; otherwise close at originating M5 boundary.");
            Print("MARKETS: subscribed to {0} supported broker-listed symbols; live market hours and trading mode checked per tick.", _m5Bars.Count);
            Print("SAFETY: demo-only guard, cash-loss limit and broker-side emergency stop active.");
            Timer.Start(TimeSpan.FromSeconds(1));
        }

        protected override void OnTimer()
        {
            try
            {
                DateTime now = Server.Time;
                ManagePositions(now);
                EnsureCycle(now);

                // Full pass over every preloaded symbol each second. This is deliberately
                // not a 25-symbol rotating batch, so a busy symbol cannot starve the rest.
                foreach (Bars bars in _m5Bars.Values.ToArray())
                    ProcessLiveBar(bars, now);

                if (_lastHeartbeat == DateTime.MinValue || (now - _lastHeartbeat).TotalSeconds >= 30)
                {
                    _lastHeartbeat = now;
                    Print("M5 HEARTBEAT | {0:yyyy-MM-dd HH:mm:ss} UTC | catalogue={1} | subscribed={2} | distinct symbols entered={3}/{4} | open positions={5}/{6}.",
                        now, _symbols.Length, _m5Bars.Count, _enteredSymbolsThisCycle.Count, MaximumEntriesPerM5Cycle, Positions.FindAll(BotLabel).Length, MaximumConcurrentPositions);
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
            Print("MARKET CATALOGUE REFRESHED | broker symbols={0} | supported symbols={1}.", Symbols.Count, _symbols.Length);
        }

        private void InitializeMarketSubscriptions()
        {
            int loaded = 0;
            int failed = 0;
            foreach (string name in _symbols)
            {
                try
                {
                    Bars bars = MarketData.GetBars(TimeFrame.Minute5, name);
                    if (bars == null)
                    {
                        failed++;
                        Print("M5 SUBSCRIPTION FAILED | {0} | GetBars returned null.", name);
                        continue;
                    }

                    _m5Bars[name] = bars;
                    bars.Tick += OnBarsTick;
                    if (bars.Count < 16)
                    {
                        bars.LoadMoreHistoryAsync(args => Print("M5 HISTORY LOAD | {0} | added={1} | total={2}.", name, args.Count, args.Bars.Count));
                    }
                    loaded++;
                }
                catch (Exception ex)
                {
                    failed++;
                    Print("M5 SUBSCRIPTION FAILED | {0} | {1}: {2}", name, ex.GetType().Name, ex.Message);
                }
            }

            Print("M5 SUBSCRIPTIONS READY | catalogue={0} | subscribed={1} | failed={2}.", _symbols.Length, loaded, failed);
        }

        private void OnBarsTick(BarsTickEventArgs args)
        {
            try
            {
                Bars bars = args.Bars;
                if (bars == null || bars.Count < 16)
                    return;

                DateTime now = Server.Time;
                if (args.IsBarOpened)
                    Print("M5 BAR OPEN EVENT | {0} | candle={1:HH:mm:ss} UTC | first tick received.", bars.SymbolName, bars.LastBar.OpenTime);

                // Tick callbacks manage positions and detect entries immediately for that symbol.
                ManagePositions(now);
                ProcessLiveBar(bars, now);
            }
            catch (Exception ex)
            {
                Print("M5 TICK HANDLER ERROR | {0}: {1}", ex.GetType().Name, ex.Message);
            }
        }

        private void EnsureCycle(DateTime now)
        {
            DateTime cycleOpen = FloorToM5(now);
            if (_currentCycleOpen == cycleOpen)
                return;

            _currentCycleOpen = cycleOpen;
            _entriesThisCycle = 0;
            _enteredSymbolsThisCycle.Clear();
            Print("NEW SHARED UTC M5 CYCLE | {0:HH:mm:ss} | prepared symbols={1} | new-symbol entry allowance={2}.",
                cycleOpen, _m5Bars.Count, MaximumEntriesPerM5Cycle);
        }

        private void ProcessLiveBar(Bars bars, DateTime now)
        {
            if (bars == null || bars.Count < 16)
                return;

            string name = bars.SymbolName;
            Symbol symbol = Symbols.GetSymbol(name);
            if (symbol == null || symbol.PipSize <= 0 || symbol.Ask <= 0 || symbol.Bid <= 0)
                return;

            if (!symbol.MarketHours.IsOpened() || !symbol.IsTradingEnabled || symbol.TradingMode != SymbolTradingMode.FullAccess)
                return;

            EnsureCycle(now);
            DateTime candleOpen = bars.LastBar.OpenTime;
            DateTime confirmationTime = candleOpen.AddSeconds(ConfirmationWindowSeconds);
            DateTime candleEnd = candleOpen.AddMinutes(CandleMinutes);
            if (now < candleOpen || now >= candleEnd)
                return;

            double candleOpenPrice = bars.OpenPrices.Last(0);
            double livePrice = bars.ClosePrices.Last(0);
            TradeType? liveDirection = livePrice > candleOpenPrice ? TradeType.Buy
                : livePrice < candleOpenPrice ? TradeType.Sell
                : (TradeType?)null;

            Position existing = Positions.FindAll(BotLabel)
                .FirstOrDefault(p => string.Equals(p.SymbolName, name, StringComparison.OrdinalIgnoreCase));

            if (existing != null)
            {
                // Only the initial 30-second window permits a direction flip.
                // A successful close is followed immediately by a market entry in the
                // newly observed candle direction. This is not treated as a new symbol slot.
                if (now < confirmationTime && liveDirection.HasValue && liveDirection.Value != existing.TradeType)
                {
                    _reversalCloseInProgress.Add(existing.Id);
                    TradeResult reversalClose = ClosePosition(existing);
                    if (!reversalClose.IsSuccessful)
                    {
                        _reversalCloseInProgress.Remove(existing.Id);
                        Print("DIRECTION REVERSAL CLOSE FAILED | {0} #{1} | {2}.", name, existing.Id, reversalClose.Error);
                        return;
                    }

                    Print("M5 PROVISIONAL REVERSAL | {0} | closed {1}; entering {2} | candle={3:HH:mm:ss} UTC.",
                        name, existing.TradeType, liveDirection.Value, candleOpen);

                    if (OpenPosition(symbol, bars, liveDirection.Value, candleOpen))
                    {
                        _enteredSymbolsThisCycle.Add(name);
                        _entriesThisCycle = _enteredSymbolsThisCycle.Count;
                    }
                }
                return;
            }

            DateTime lastDecision;
            if (_lastDecisionCandle.TryGetValue(name, out lastDecision) && lastDecision == candleOpen)
                return;

            if (now >= confirmationTime)
            {
                _lastDecisionCandle[name] = candleOpen;
                Print("M5 NO ENTRY | {0} | first 30-second entry window elapsed without a position | candle={1:HH:mm:ss} UTC.",
                    name, candleOpen);
                return;
            }

            if (!liveDirection.HasValue)
                return;

            if (!_enteredSymbolsThisCycle.Contains(name) && _enteredSymbolsThisCycle.Count >= MaximumEntriesPerM5Cycle)
            {
                _lastDecisionCandle[name] = candleOpen;
                return;
            }

            if (Positions.FindAll(BotLabel).Length >= MaximumConcurrentPositions)
                return;

            if (OpenPosition(symbol, bars, liveDirection.Value, candleOpen))
            {
                _enteredSymbolsThisCycle.Add(name);
                _entriesThisCycle = _enteredSymbolsThisCycle.Count;
            }
        }

        private bool OpenPosition(Symbol symbol, Bars bars, TradeType direction, DateTime candleOpen)
        {
            try
            {
                double volume = symbol.NormalizeVolumeInUnits(symbol.VolumeInUnitsMin, RoundingMode.Down);
                if (volume < symbol.VolumeInUnitsMin || volume > symbol.VolumeInUnitsMax || double.IsNaN(volume))
                {
                    Print("ENTRY SKIPPED | {0} | invalid broker minimum volume.", symbol.Name);
                    return false;
                }

                double atr = CalculateM5Atr(bars, 14);
                if (atr <= 0 || double.IsNaN(atr) || double.IsInfinity(atr))
                {
                    Print("ENTRY SKIPPED | {0} | insufficient/invalid M5 ATR data.", symbol.Name);
                    return false;
                }

                double stopDistance = Math.Max(atr * StopAtrMultiple, MinimumEmergencyStopPips * symbol.PipSize);
                double stopPips = Math.Max(MinimumEmergencyStopPips, stopDistance / symbol.PipSize);
                TradeResult result = ExecuteMarketOrder(direction, symbol.Name, volume, BotLabel, stopPips, (double?)null,
                    "ANALYZERPRO_M5_EARLY | " + candleOpen.ToString("yyyyMMddHHmm", CultureInfo.InvariantCulture));

                if (!result.IsSuccessful)
                {
                    Print("ORDER REJECTED | {0} {1} | {2}.", direction, symbol.Name, result.Error);
                    return false;
                }

                Position position = result.Position;
                _originCandleByPosition[position.Id] = candleOpen;
                _peakPriceByPosition[position.Id] = direction == TradeType.Buy ? symbol.Bid : symbol.Ask;
                Print("M5 TRADE OPENED | {0} {1} | entry={2} | volume={3} | candle={4:HH:mm} UTC | emergency SL={5:F1} pips.",
                    direction, symbol.Name, position.EntryPrice, volume, candleOpen, stopPips);
                return true;
            }
            catch (Exception ex)
            {
                Print("ENTRY ERROR | {0}: {1}", symbol.Name, ex.Message);
                return false;
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
// Reversal handling is centralized in ProcessLiveBar so a successful close
                    // can be followed by an immediate opposite-direction entry.

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

                    Bars positionBars;
                    bool newBarObserved = _m5Bars.TryGetValue(position.SymbolName, out positionBars) && positionBars != null && positionBars.Count > 0 && positionBars.LastBar.OpenTime > origin;
                    if (now >= origin.AddMinutes(CandleMinutes) || newBarObserved)
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
            DateTime closedOrigin;
            bool wasReversal = _reversalCloseInProgress.Remove(args.Position.Id);
            if (!wasReversal && _originCandleByPosition.TryGetValue(args.Position.Id, out closedOrigin))
                _lastDecisionCandle[args.Position.SymbolName] = closedOrigin;
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
            foreach (Bars bars in _m5Bars.Values)
                bars.Tick -= OnBarsTick;
            Print("Analyzer.pro event-driven M5 cBot stopped. Broker-side emergency stops remain attached to open positions.");
        }

        protected override void OnException(Exception exception)
        {
            Print("UNHANDLED CBOT EXCEPTION | {0}: {1}", exception.GetType().Name, exception.Message);
            Print("STACK TRACE | {0}", exception.StackTrace);
        }
    }
}