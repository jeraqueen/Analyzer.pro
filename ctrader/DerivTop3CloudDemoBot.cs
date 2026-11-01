// -----------------------------------------------------------------------------
// Analyzer.pro - Deriv cTrader Cloud Demo Bot
// Version 3.5.0 - full catalogue progress, candle-start entries and net-positive MFE exits
// -----------------------------------------------------------------------------
// Strategy:
// - Discovers the full broker-listed supported catalogue, ranking open/moving markets before selecting up to 25 by default.
// - Scores all supported candidates using current/recent M5 movement, ATR and spread; subscribes to the strongest open/tradable markets.
// - Also checks every subscribed symbol on each one-second timer cycle; no rotating scan queue.
// - Attempts entry on the first available tick of each new M5 candle, using the previous completed M5 candle direction as the initial direction.
// - If the new candle direction reverses during the first 30 seconds, closes the provisional trade and attempts the opposite direction, subject to safety filters.
// - Allows up to 8 distinct symbols per M5 cycle and 8 concurrent positions by default.
// - Tracks executable-side peak MFE; closes on a 25% retracement, retaining approximately 75%.
// - Otherwise attempts to close at the originating M5 candle boundary; retries failed closes. Exact execution is subject to ticks, broker availability and order acceptance.
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

        [Parameter("Maximum symbols to subscribe", DefaultValue = 25, MinValue = 1, MaxValue = 386)]
        public int MaximumSymbolsToScan { get; set; }

        [Parameter("Symbol name filter (comma-separated; blank = all)", DefaultValue = "")]
        public string SymbolNameFilter { get; set; }

        [Parameter("Crypto slots", DefaultValue = 6, MinValue = 0, MaxValue = 386)]
        public int CryptoSlots { get; set; }

        [Parameter("Risk percent of balance", DefaultValue = 0.25, MinValue = 0.01, MaxValue = 5.0, Step = 0.01)]
        public double RiskPercent { get; set; }

        [Parameter("Minimum move in ATR", DefaultValue = 0.05, MinValue = 0.0, MaxValue = 2.0, Step = 0.01)]
        public double MinMoveAtr { get; set; }

        [Parameter("Maximum spread in ATR", DefaultValue = 0.20, MinValue = 0.01, MaxValue = 2.0, Step = 0.01)]
        public double MaxSpreadToAtr { get; set; }

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
        private readonly Dictionary<long, double> _entryExecutablePriceByPosition = new Dictionary<long, double>();
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
        private int _supportedCatalogueCount;
        private int _movingMarketsCount;
        private DateTime _lastCatalogueRefresh = DateTime.MinValue;
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
            _lastCatalogueRefresh = Server.Time;
            Print("Analyzer.pro cTrader Cloud Demo Bot v3.5 started.");
            Print("ENTRY: attempts an entry on the first tick of each new M5 candle, using the previous completed candle direction; eligible setups are ranked before entry.");
            Print("CYCLE: up to {0} distinct symbols per UTC M5 cycle; maximum {1} concurrent positions.", MaximumEntriesPerM5Cycle, MaximumConcurrentPositions);
            Print("REVERSAL: during first 30 seconds, close provisional trade and attempt the opposite direction when candle direction changes and safety filters pass.");
            Print("EXIT: after confirmation, close on 25% retracement from peak favourable movement; otherwise close at originating M5 boundary.");
            Print("MARKETS: supported catalogue={0} | selected scan list={1} | active subscriptions={2}; markets are checked for live hours before entries.",
                _supportedCatalogueCount, _symbols.Length, _m5Bars.Count);
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

                if (_lastCatalogueRefresh == DateTime.MinValue || (now - _lastCatalogueRefresh).TotalMinutes >= 10)
                {
                    RefreshSymbolCatalogue();
                    InitializeMarketSubscriptions();
                    _lastCatalogueRefresh = now;
                }

                foreach (Bars bars in _m5Bars.Values.ToArray())
                    ProcessLiveBar(bars, now);

                if (_lastHeartbeat == DateTime.MinValue || (now - _lastHeartbeat).TotalSeconds >= 30)
                {
                    _lastHeartbeat = now;
                    Print("M5 HEARTBEAT | {0:yyyy-MM-dd HH:mm:ss} UTC | selected={1} | moving candidates={2} | subscribed={3} | distinct symbols entered={4}/{5} | open positions={6}/{7}.",
                        now, _symbols.Length, _movingMarketsCount, _m5Bars.Count, _enteredSymbolsThisCycle.Count, MaximumEntriesPerM5Cycle, Positions.FindAll(BotLabel).Length, MaximumConcurrentPositions);
                }
            }
            catch (Exception ex)
            {
                Print("TIMER ERROR | {0}: {1}", ex.GetType().Name, ex.Message);
            }
        }

        private void RefreshSymbolCatalogue()
        {
            // First inspect the complete broker catalogue. The scan cap applies only
            // after every supported candidate has been checked for open hours,
            // current M5 movement, ATR and spread.
            var found = new List<string>();
            for (int i = 0; i < Symbols.Count; i++)
            {
                string name = Symbols[i];
                // Discover all broker-listed symbols. Data, spread and trading checks
                // later determine eligibility; avoid excluding unfamiliar broker names.
                if (!string.IsNullOrWhiteSpace(name) && MatchesSymbolFilter(name))
                    found.Add(name);
                if ((i + 1) % 5 == 0 || i + 1 == Symbols.Count)
                    Print("CATALOGUE SCAN PROGRESS | checked={0}/{1} broker symbols | names accepted by filter={2}.", i + 1, Symbols.Count, found.Count);
            }

            string[] catalogue = found.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            _supportedCatalogueCount = catalogue.Length;

            var heldNames = new HashSet<string>(
                Positions.FindAll(BotLabel).Select(p => p.SymbolName),
                StringComparer.OrdinalIgnoreCase);

            var scores = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
            var openAndTradable = new List<string>();
            var movingAndTradable = new List<string>();

            foreach (string name in catalogue)
            {
                if (heldNames.Contains(name))
                {
                    scores[name] = double.MaxValue;
                    openAndTradable.Add(name);
                    continue;
                }

                Symbol symbol = Symbols.GetSymbol(name);
                if (symbol == null || !IsMarketOpen(name))
                    continue;

                Bars bars;
                try
                {
                    bars = MarketData.GetBars(TimeFrame.Minute5, name);
                }
                catch (Exception ex)
                {
                    Print("SCAN DATA UNAVAILABLE | {0} | {1}: {2}", name, ex.GetType().Name, ex.Message);
                    continue;
                }

                if (bars == null || bars.Count < 16 || symbol.PipSize <= 0 || symbol.Ask <= 0 || symbol.Bid <= 0)
                    continue;

                double atr = CalculateM5Atr(bars, 14);
                if (atr <= 0 || double.IsNaN(atr) || double.IsInfinity(atr))
                    continue;

                double spread = symbol.Ask - symbol.Bid;
                double spreadAtr = spread / atr;
                if (spreadAtr > MaxSpreadToAtr)
                    continue;

                double liveMove = Math.Abs(bars.ClosePrices.Last(0) - bars.OpenPrices.Last(0));
                double moveAtr = liveMove / atr;
                // Add recent candle activity so a market with a quiet current candle
                // but strong recent movement remains ranked behind currently moving ones.
                double priorMove = Math.Abs(bars.ClosePrices.Last(1) - bars.OpenPrices.Last(1)) / atr;
                double priorRange = (bars.HighPrices.Last(1) - bars.LowPrices.Last(1)) / atr;
                double score = (moveAtr * 3.0) + (priorMove * 0.75) + (priorRange * 0.25) - (spreadAtr * 2.0);
                scores[name] = score;
                openAndTradable.Add(name);
                if (moveAtr >= MinMoveAtr)
                    movingAndTradable.Add(name);
            }

            _movingMarketsCount = movingAndTradable.Count;

            Func<string, double> scoreOf = name => scores.ContainsKey(name) ? scores[name] : double.MinValue;
            var held = catalogue.Where(heldNames.Contains)
                .OrderBy(n => n, StringComparer.OrdinalIgnoreCase).ToList();

            var rankedMovingCrypto = movingAndTradable.Where(IsCryptoName)
                .OrderByDescending(scoreOf)
                .ThenBy(n => n, StringComparer.OrdinalIgnoreCase)
                .Take(Math.Max(0, CryptoSlots)).ToList();

            var rankedMovingRest = movingAndTradable.Where(n => !IsCryptoName(n))
                .OrderByDescending(scoreOf)
                .ThenByDescending(IsSyntheticName)
                .ThenBy(n => n, StringComparer.OrdinalIgnoreCase).ToList();

            // Fill any remaining slots with other open, tradable markets ranked by
            // live movement/spread score, so the bot can monitor a market before it
            // crosses the minimum entry-movement threshold.
            var fallbackCrypto = openAndTradable.Where(n => !heldNames.Contains(n) &&
                    IsCryptoName(n) && !rankedMovingCrypto.Contains(n, StringComparer.OrdinalIgnoreCase))
                .OrderByDescending(scoreOf).ThenBy(n => n, StringComparer.OrdinalIgnoreCase).ToList();
            var fallbackRest = openAndTradable.Where(n => !heldNames.Contains(n) &&
                    !IsCryptoName(n) && !rankedMovingRest.Contains(n, StringComparer.OrdinalIgnoreCase))
                .OrderByDescending(scoreOf).ThenByDescending(IsSyntheticName)
                .ThenBy(n => n, StringComparer.OrdinalIgnoreCase).ToList();

            var ordered = held.Concat(rankedMovingCrypto).Concat(rankedMovingRest)
                .Concat(fallbackCrypto).Concat(fallbackRest)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(Math.Max(1, MaximumSymbolsToScan))
                .ToArray();

            _symbols = ordered;
            Print("FULL CATALOGUE SCAN | broker symbols={0} | supported candidates={1} | open/tradable={2} | currently moving above {3:F2} ATR={4} | selected subscriptions={5}.",
                Symbols.Count, _supportedCatalogueCount, openAndTradable.Count, MinMoveAtr, _movingMarketsCount, _symbols.Length);
            Print("SCANNING: {0}", _symbols.Length == 0 ? "(no open supported markets passed the spread/data checks)" : string.Join(", ", _symbols));
            if (movingAndTradable.Count == 0)
                Print("SCAN NOTE | No open market currently passes the minimum movement threshold; subscribing to the best open/spread-eligible markets to keep monitoring.");
        }

        private bool MatchesSymbolFilter(string name)
        {
            if (string.IsNullOrWhiteSpace(SymbolNameFilter))
                return true;

            string[] requested = SymbolNameFilter.Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim())
                .Where(x => x.Length > 0)
                .ToArray();
            return requested.Length == 0 || requested.Any(x => string.Equals(x, name, StringComparison.OrdinalIgnoreCase));
        }

        private bool IsMarketOpen(string name)
        {
            try
            {
                Symbol symbol = Symbols.GetSymbol(name);
                return symbol != null && symbol.MarketHours.IsOpened() && symbol.IsTradingEnabled &&
                    symbol.TradingMode == SymbolTradingMode.FullAccess;
            }
            catch
            {
                return false;
            }
        }

        private bool IsSyntheticName(string rawName)
        {
            string name = new string((rawName ?? string.Empty).Where(char.IsLetter).ToArray()).ToUpperInvariant();
            return name.Contains("VOLATILITY") || name.Contains("BOOM") || name.Contains("CRASH") ||
                name.Contains("STEP") || name.Contains("JUMP") || name.Contains("RANGEBREAK") ||
                name.Contains("DRIFT") || name.Contains("VOLSWITCH") || name.Contains("MULTIPLIER") ||
                name.Contains("DEX") || name.Contains("TREK") || name.Contains("HYBRID") ||
                name.Contains("SYNTHETIC");
        }

        private void InitializeMarketSubscriptions()
        {
            var desired = new HashSet<string>(_symbols, StringComparer.OrdinalIgnoreCase);
            foreach (Position position in Positions.FindAll(BotLabel))
                desired.Add(position.SymbolName);

            foreach (string existingName in _m5Bars.Keys.ToArray())
            {
                if (desired.Contains(existingName))
                    continue;

                Bars oldBars = _m5Bars[existingName];
                oldBars.Tick -= OnBarsTick;
                _m5Bars.Remove(existingName);
                Print("M5 UNSUBSCRIBED | {0} | no longer selected and no open bot position.", existingName);
            }

            int loaded = 0;
            int failed = 0;
            foreach (string name in desired)
            {
                if (_m5Bars.ContainsKey(name))
                    continue;

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
                        bars.LoadMoreHistoryAsync(args => Print("M5 HISTORY LOAD | {0} | added={1} | total={2}.", name, args.Count, args.Bars.Count));
                    loaded++;
                }
                catch (Exception ex)
                {
                    failed++;
                    Print("M5 SUBSCRIPTION FAILED | {0} | {1}: {2}", name, ex.GetType().Name, ex.Message);
                }
            }

            Print("M5 SUBSCRIPTIONS READY | selected scan symbols={0} | active subscriptions={1} | newly subscribed={2} | failed={3}.",
                _symbols.Length, _m5Bars.Count, loaded, failed);
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
            double atrForSignal = CalculateM5Atr(bars, 14);
            double spread = symbol.Ask - symbol.Bid;
            bool spreadAllowed = atrForSignal > 0 && spread <= MaxSpreadToAtr * atrForSignal;
            double currentMove = Math.Abs(livePrice - candleOpenPrice);
            double priorBodyMove = Math.Abs(bars.ClosePrices.Last(1) - bars.OpenPrices.Last(1));
            bool moveAllowed = atrForSignal > 0 && Math.Max(currentMove, priorBodyMove) >= MinMoveAtr * atrForSignal;
            TradeType? liveDirection = livePrice > candleOpenPrice ? TradeType.Buy
                : livePrice < candleOpenPrice ? TradeType.Sell
                : (TradeType?)null;
            // On the first tick, the current candle has no direction yet. Use the
            // previous completed candle direction so an entry can be attempted at
            // the start rather than waiting for the current candle to develop.
            if (!liveDirection.HasValue)
            {
                double previousOpen = bars.OpenPrices.Last(1);
                double previousClose = bars.ClosePrices.Last(1);
                if (previousClose > previousOpen) liveDirection = TradeType.Buy;
                else if (previousClose < previousOpen) liveDirection = TradeType.Sell;
            }

            Position existing = Positions.FindAll(BotLabel)
                .FirstOrDefault(p => string.Equals(p.SymbolName, name, StringComparison.OrdinalIgnoreCase));

            // A position from an earlier M5 candle must never be treated as a provisional
            // position in the new candle. Close it first; only then may the new candle
            // be evaluated for a fresh entry.
            if (existing != null)
            {
                DateTime existingOrigin;
                if (!_originCandleByPosition.TryGetValue(existing.Id, out existingOrigin))
                    existingOrigin = FloorToM5(existing.EntryTime);

                if (existingOrigin < candleOpen)
                {
                    TradeResult staleClose = ClosePosition(existing);
                    if (!staleClose.IsSuccessful)
                    {
                        Print("PREVIOUS CANDLE POSITION STILL OPEN | {0} #{1} | close failed: {2}.",
                            name, existing.Id, staleClose.Error);
                        return;
                    }

                    _lastDecisionCandle[name] = existingOrigin;
                    Print("STALE M5 POSITION CLOSED AT NEW BAR | {0} | old candle={1:HH:mm:ss} | new candle={2:HH:mm:ss} UTC.",
                        name, existingOrigin, candleOpen);
                    existing = null;
                }
            }

            if (existing != null)
            {
                // Only the initial 30-second window permits a direction flip.
                // A successful close is followed immediately by a market entry in the
                // newly observed candle direction. This is not treated as a new symbol slot.
                if (now < confirmationTime && liveDirection.HasValue && liveDirection.Value != existing.TradeType)
                {
                    if (!spreadAllowed || !moveAllowed)
                    {
                        Print("REVERSAL SKIPPED | {0} | spread={1} ATR={2} move={3} | spread limit={4} ATR, move minimum={5} ATR.",
                            name, spread, atrForSignal, Math.Abs(livePrice - candleOpenPrice), MaxSpreadToAtr, MinMoveAtr);
                        return;
                    }
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

            // Initial entries should not wait for the new candle to build movement.
            // Use the previous completed candle for direction; retain spread protection.
            if (!spreadAllowed)
            {
                Print("ENTRY SKIPPED | {0} | spread={1} exceeds {2} x M5 ATR={3}.", name, spread, MaxSpreadToAtr, atrForSignal);
                return;
            }

            if (!_enteredSymbolsThisCycle.Contains(name) && _enteredSymbolsThisCycle.Count >= MaximumEntriesPerM5Cycle)
            {
                _lastDecisionCandle[name] = candleOpen;
                return;
            }

            if (Positions.FindAll(BotLabel).Length >= MaximumConcurrentPositions)
                return;

            if (!IsAmongBestCurrentCandidates(name, candleOpen, now))
                return;

            if (OpenPosition(symbol, bars, liveDirection.Value, candleOpen))
            {
                _enteredSymbolsThisCycle.Add(name);
                _entriesThisCycle = _enteredSymbolsThisCycle.Count;
            }
        }

        private bool IsAmongBestCurrentCandidates(string requestedName, DateTime candleOpen, DateTime now)
        {
            int enteredSlotsRemaining = MaximumEntriesPerM5Cycle - _enteredSymbolsThisCycle.Count;
            int positionSlotsRemaining = MaximumConcurrentPositions - Positions.FindAll(BotLabel).Length;
            int slots = Math.Min(enteredSlotsRemaining, positionSlotsRemaining);
            if (slots <= 0)
                return false;

            var candidates = new List<KeyValuePair<string, double>>();
            foreach (KeyValuePair<string, Bars> item in _m5Bars)
            {
                string name = item.Key;
                Bars candidateBars = item.Value;
                if (candidateBars == null || candidateBars.Count < 16 || _enteredSymbolsThisCycle.Contains(name))
                    continue;
                if (Positions.FindAll(BotLabel).Any(p => string.Equals(p.SymbolName, name, StringComparison.OrdinalIgnoreCase)))
                    continue;
                DateTime lastDecision;
                if (_lastDecisionCandle.TryGetValue(name, out lastDecision) && lastDecision == candleOpen)
                    continue;
                if (candidateBars.LastBar.OpenTime != candleOpen || now < candleOpen || now >= candleOpen.AddSeconds(ConfirmationWindowSeconds))
                    continue;

                Symbol candidateSymbol = Symbols.GetSymbol(name);
                if (candidateSymbol == null || candidateSymbol.PipSize <= 0 || candidateSymbol.Ask <= 0 || candidateSymbol.Bid <= 0)
                    continue;
                if (!candidateSymbol.MarketHours.IsOpened() || !candidateSymbol.IsTradingEnabled || candidateSymbol.TradingMode != SymbolTradingMode.FullAccess)
                    continue;

                double atr = CalculateM5Atr(candidateBars, 14);
                if (atr <= 0 || double.IsNaN(atr) || double.IsInfinity(atr))
                    continue;
                double spreadAtr = (candidateSymbol.Ask - candidateSymbol.Bid) / atr;
                if (spreadAtr > MaxSpreadToAtr)
                    continue;
                double liveMove = Math.Abs(candidateBars.ClosePrices.Last(0) - candidateBars.OpenPrices.Last(0));
                double priorBodyMove = Math.Abs(candidateBars.ClosePrices.Last(1) - candidateBars.OpenPrices.Last(1));
                double moveAtr = Math.Max(liveMove, priorBodyMove) / atr;
                // A candle-start candidate can qualify from the previous completed candle.
                if (priorBodyMove <= candidateSymbol.TickSize && liveMove <= candidateSymbol.TickSize)
                    continue;

                double priorBodyAtr = Math.Abs(candidateBars.ClosePrices.Last(1) - candidateBars.OpenPrices.Last(1)) / atr;
                double priorRangeAtr = (candidateBars.HighPrices.Last(1) - candidateBars.LowPrices.Last(1)) / atr;
                double score = moveAtr * 3.0 + priorBodyAtr * 0.75 + priorRangeAtr * 0.25 - spreadAtr * 2.0;
                candidates.Add(new KeyValuePair<string, double>(name, score));
            }

            List<KeyValuePair<string, double>> ranked = candidates
                .OrderByDescending(x => x.Value)
                .ThenBy(x => x.Key, StringComparer.OrdinalIgnoreCase)
                .ToList();
            int rank = ranked.FindIndex(x => string.Equals(x.Key, requestedName, StringComparison.OrdinalIgnoreCase));
            if (rank < 0)
                return false;

            Print("M5 CANDIDATE RANK | candle={0:HH:mm:ss} UTC | {1} rank={2}/{3} | score={4:F3} | available entry slots={5}.",
                candleOpen, requestedName, rank + 1, ranked.Count, ranked[rank].Value, slots);
            if (rank >= slots)
            {
                Print("ENTRY DEFERRED BY RANK | {0} | current rank {1} is outside the {2} currently available slot(s); it may qualify on a later tick within the first 30 seconds.",
                    requestedName, rank + 1, slots);
                return false;
            }
            return true;
        }
        private bool OpenPosition(Symbol symbol, Bars bars, TradeType direction, DateTime candleOpen)
        {
            try
            {
                double atr = CalculateM5Atr(bars, 14);
                if (atr <= 0 || double.IsNaN(atr) || double.IsInfinity(atr))
                {
                    Print("ENTRY SKIPPED | {0} | insufficient/invalid M5 ATR data.", symbol.Name);
                    return false;
                }

                double stopDistance = Math.Max(atr * StopAtrMultiple, MinimumEmergencyStopPips * symbol.PipSize);
                double stopPips = Math.Max(MinimumEmergencyStopPips, stopDistance / symbol.PipSize);
                double riskCash = Math.Max(0.0, Account.Balance * RiskPercent / 100.0);
                double pipValue = symbol.PipValue;
                double calculatedVolume = pipValue > 0 && stopPips > 0 ? riskCash / (stopPips * pipValue) : 0.0;
                double maxVolume = Math.Min(symbol.VolumeInUnitsMax, symbol.VolumeInUnitsMin * 50.0);
                double volume = Math.Max(symbol.VolumeInUnitsMin, Math.Min(maxVolume, calculatedVolume));
                volume = symbol.NormalizeVolumeInUnits(volume, RoundingMode.Down);
                if (volume < symbol.VolumeInUnitsMin)
                    volume = symbol.VolumeInUnitsMin;
                if (volume > maxVolume)
                    volume = symbol.NormalizeVolumeInUnits(maxVolume, RoundingMode.Down);
                if (double.IsNaN(volume) || double.IsInfinity(volume) || volume < symbol.VolumeInUnitsMin)
                {
                    Print("ENTRY SKIPPED | {0} | risk-based volume invalid; minimum={1}, calculated={2}.",
                        symbol.Name, symbol.VolumeInUnitsMin, calculatedVolume);
                    return false;
                }

                TradeResult result = ExecuteMarketOrder(direction, symbol.Name, volume, BotLabel, stopPips, (double?)null,
                    "ANALYZERPRO_M5_EARLY | " + candleOpen.ToString("yyyyMMddHHmm", CultureInfo.InvariantCulture));

                if (!result.IsSuccessful)
                {
                    Print("ORDER REJECTED | {0} {1} | {2}.", direction, symbol.Name, result.Error);
                    return false;
                }

                Position position = result.Position;
                _originCandleByPosition[position.Id] = candleOpen;
                double entryExecutable = direction == TradeType.Buy ? symbol.Bid : symbol.Ask;
                _entryExecutablePriceByPosition[position.Id] = entryExecutable;
                _peakPriceByPosition[position.Id] = entryExecutable;
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
                            DateTime lossOrigin;
                            if (!_originCandleByPosition.TryGetValue(position.Id, out lossOrigin))
                                lossOrigin = FloorToM5(position.EntryTime);
                            _lastDecisionCandle[position.SymbolName] = lossOrigin;
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
                        double recoveredExecutable = position.TradeType == TradeType.Buy ? symbol.Bid : symbol.Ask;
                        _entryExecutablePriceByPosition[position.Id] = recoveredExecutable;
                        _peakPriceByPosition[position.Id] = recoveredExecutable;
                        _restartStateRecovered.Add(position.Id);
                        Print("POSITION STATE RECOVERED | {0} {1} | origin candle={2:HH:mm} UTC | MFE tracking resumed from current quote; pre-restart peak is unavailable.",
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

                    double entryExecutablePrice;
                    if (!_entryExecutablePriceByPosition.TryGetValue(position.Id, out entryExecutablePrice))
                    {
                        entryExecutablePrice = position.TradeType == TradeType.Buy ? symbol.Bid : symbol.Ask;
                        _entryExecutablePriceByPosition[position.Id] = entryExecutablePrice;
                    }
                    double maxFavourable = position.TradeType == TradeType.Buy
                        ? peak - entryExecutablePrice
                        : entryExecutablePrice - peak;
                    double currentFavourable = position.TradeType == TradeType.Buy
                        ? executable - entryExecutablePrice
                        : entryExecutablePrice - executable;
                    double spreadNow = Math.Max(0, symbol.Ask - symbol.Bid);

                    // Do not treat a one-tick move inside the spread as profit-taking.
                    // Require enough favourable movement to clear the current spread,
                    // and only close on the retracement rule when net P/L is positive.
                    if (now >= origin.AddSeconds(ConfirmationWindowSeconds) && maxFavourable > spreadNow + symbol.TickSize)
                    {
                        double lockLevel = position.TradeType == TradeType.Buy
                            ? entryExecutablePrice + maxFavourable * RetainedMfeFraction
                            : entryExecutablePrice - maxFavourable * RetainedMfeFraction;
                        bool retraced = position.TradeType == TradeType.Buy
                            ? executable <= lockLevel
                            : executable >= lockLevel;

                        if (retraced && currentFavourable > 0 && position.NetProfit > 0)
                        {
                            TradeResult close = ClosePosition(position);
                            if (close.IsSuccessful)
                            {
                                _lastDecisionCandle[position.SymbolName] = origin;
                                Print("75% MFE PROFIT EXIT | {0} {1} | executable entry={2} | peak={3} | exit={4} | retained target=75% of favourable excursion | net P/L={5:F2} {6}.",
                                    position.TradeType, position.SymbolName, entryExecutablePrice, peak, executable, position.NetProfit, Account.Asset.Name);
                                continue;
                            }
                            Print("75% MFE EXIT RETRY | {0} #{1} | close rejected: {2}. Will retry on next management cycle.", position.SymbolName, position.Id, close.Error);
                        }
                    }

                    Bars positionBars;
                    bool newBarObserved = _m5Bars.TryGetValue(position.SymbolName, out positionBars) && positionBars != null && positionBars.Count > 0 && positionBars.LastBar.OpenTime > origin;
                    if (now >= origin.AddMinutes(CandleMinutes) || newBarObserved)
                    {
                        TradeResult close = ClosePosition(position);
                        if (close.IsSuccessful)
                        {
                            _lastDecisionCandle[position.SymbolName] = origin;
                            Print("M5 CANDLE-END EXIT | {0} {1} | origin={2:HH:mm} UTC | P/L={3:F2} {4}.",
                                position.TradeType, position.SymbolName, origin, position.NetProfit, Account.Asset.Name);
                        }
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

            if (IsSyntheticName(name))
                return true;

            if (name.StartsWith("XAU") || IsCryptoName(name))
                return true;

            if (name.Length < 6)
                return false;
            string baseCurrency = name.Substring(0, 3);
            string quoteCurrency = name.Substring(3, 3);
            return _currencies.Contains(baseCurrency) && _currencies.Contains(quoteCurrency) && baseCurrency != quoteCurrency;
        }

        private bool IsCryptoName(string rawName)
        {
            string name = new string((rawName ?? string.Empty).Where(char.IsLetter).ToArray()).ToUpperInvariant();
            string[] prefixes = { "BTC", "ETH", "LTC", "XRP", "BCH", "ADA", "DOT", "SOL", "DOGE", "BNB", "TRX", "LINK", "XLM", "EOS", "XMR" };
            return prefixes.Any(prefix => name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
        }

        private void OnPositionClosed(PositionClosedEventArgs args)
        {
            DateTime closedOrigin;
            bool wasReversal = _reversalCloseInProgress.Remove(args.Position.Id);
            if (!wasReversal && _originCandleByPosition.TryGetValue(args.Position.Id, out closedOrigin))
                _lastDecisionCandle[args.Position.SymbolName] = closedOrigin;
            _originCandleByPosition.Remove(args.Position.Id);
            _peakPriceByPosition.Remove(args.Position.Id);
            _entryExecutablePriceByPosition.Remove(args.Position.Id);
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
            Print("Analyzer.pro cTrader Cloud Demo Bot v3.5 stopped. Broker-side emergency stops remain attached to open positions.");
        }

        protected override void OnException(Exception exception)
        {
            Print("UNHANDLED CBOT EXCEPTION | {0}: {1}", exception.GetType().Name, exception.Message);
            Print("STACK TRACE | {0}", exception.StackTrace);
        }
    }
}