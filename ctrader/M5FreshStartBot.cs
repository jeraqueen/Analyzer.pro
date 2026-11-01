// -----------------------------------------------------------------------------
// Analyzer.pro - Fresh Start M5 Cloud Demo Bot
// Version 1.0 - single-timeframe, no strategy filters
// Runs as a cTrader Cloud cBot; manage the Cloud instance from supported cTrader apps.
// -----------------------------------------------------------------------------
// SIMPLE RULES ONLY:
// 1. M5 candles only. Direction = previous completed M5 candle (up = Buy, down = Sell).
// 2. Risk budget = 0.25% of account balance per trade.
// 3. Stop-loss sits beyond the previous completed candle's opposite extreme.
// 4. Close after a 25% retracement from the peak favourable pips, or at the end
//    of the M5 candle in which the position opened, whichever happens first.
// 5. Scan broker-listed symbols progressively; no multi-timeframe, ATR, spread,
//    confidence, ranking, trend, or asset-family filters.
// 6. Demo account only. A trade can still lose; broker execution is not guaranteed.
// -----------------------------------------------------------------------------
// NOTE: Source is newly written but must be built in cTrader before use.
// -----------------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Linq;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.None)]
    public class M5FreshStartBot : Robot
    {
        private const string BotLabel = "ANALYZERPRO_M5_FRESH_V1";
        private const double RiskPercent = 0.25;
        private const int CandleMinutes = 5;
        private const double RetainFavourableFraction = 0.75;
        private const int SymbolsPerScanStep = 10;
        private const int MaximumConcurrentPositions = 8;

        private readonly Dictionary<string, Bars> _barsBySymbol =
            new Dictionary<string, Bars>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, DateTime> _lastCandleBySymbol =
            new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<long, DateTime> _positionCandleEnd =
            new Dictionary<long, DateTime>();
        private readonly Dictionary<long, double> _peakFavourablePips =
            new Dictionary<long, double>();

        private string[] _brokerSymbols = new string[0];
        private int _nextSymbolIndex;
        private DateTime _lastHeartbeat = DateTime.MinValue;
        private int _symbolsInitialized;

        protected override void OnStart()
        {
            if (Account.IsLive)
            {
                Print("START BLOCKED | M5FreshStartBot is DEMO ONLY. No orders placed.");
                Stop();
                return;
            }

            _brokerSymbols = Symbols.Select(s => s.Name).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            Positions.Closed += OnPositionClosed;

            Print("ANALYZER.PRO BUILD ID: M5 FRESH START V1 | cBot=M5FreshStartBot");
            Print("RULES | timeframe=M5 only | risk=0.25% balance | direction=previous closed M5 candle");
            Print("EXITS | close at 25% retracement from peak favourable pips OR at originating M5 candle end");
            Print("FILTERS | no ATR/spread/trend/multi-timeframe/ranking/asset-family filters");
            Print("SCAN | broker-listed symbols={0} | progressive batch={1} symbols per second",
                _brokerSymbols.Length, SymbolsPerScanStep);
            Print("SAFETY | demo account required | max concurrent positions={0} | broker execution can reject orders",
                MaximumConcurrentPositions);

            // Restore minimal management state for this bot's existing positions.
            foreach (var position in Positions.FindAll(BotLabel))
            {
                DateTime candleOpen = FloorToM5(position.EntryTime);
                _positionCandleEnd[position.Id] = candleOpen.AddMinutes(CandleMinutes);
                _peakFavourablePips[position.Id] = Math.Max(0, position.Pips);
            }

            Timer.Start(TimeSpan.FromSeconds(1));
        }

        protected override void OnTimer()
        {
            try
            {
                ManageBotPositions();

                // Progressively load M5 data so startup does not request history for
                // every broker symbol in one burst.
                int loadedThisStep = 0;
                while (_nextSymbolIndex < _brokerSymbols.Length && loadedThisStep < SymbolsPerScanStep)
                {
                    string name = _brokerSymbols[_nextSymbolIndex++];
                    loadedThisStep++;

                    try
                    {
                        Bars bars = MarketData.GetBars(TimeFrame.Minute5, name);
                        if (bars == null || bars.Count < 3)
                        {
                            Print("DATA NOT READY | {0} | waiting for at least 3 M5 bars", name);
                            continue;
                        }

                        _barsBySymbol[name] = bars;
                        _lastCandleBySymbol[name] = bars.LastBar.OpenTime;
                        _symbolsInitialized++;
                        Print("M5 SYMBOL READY | {0} | initialized={1}/{2}", name, _symbolsInitialized, _brokerSymbols.Length);
                    }
                    catch (Exception ex)
                    {
                        Print("M5 DATA ERROR | {0} | {1}", name, ex.Message);
                    }
                }

                // Evaluate every loaded symbol each second. No technical filters are used.
                foreach (var item in _barsBySymbol.ToArray())
                    ProcessSymbol(item.Key, item.Value);

                if (_lastHeartbeat == DateTime.MinValue || (Server.Time - _lastHeartbeat).TotalSeconds >= 30)
                {
                    _lastHeartbeat = Server.Time;
                    Print("M5 HEARTBEAT | ready={0}/{1} | scan-index={2}/{3} | bot-positions={4}/{5}",
                        _symbolsInitialized, _brokerSymbols.Length, _nextSymbolIndex, _brokerSymbols.Length,
                        Positions.FindAll(BotLabel).Length, MaximumConcurrentPositions);
                }
            }
            catch (Exception ex)
            {
                Print("TIMER ERROR | {0}", ex.Message);
            }
        }

        private void ProcessSymbol(string symbolName, Bars bars)
        {
            if (bars == null || bars.Count < 3)
                return;

            DateTime currentCandleOpen = bars.LastBar.OpenTime;
            DateTime previousSeenCandle;
            if (!_lastCandleBySymbol.TryGetValue(symbolName, out previousSeenCandle))
            {
                _lastCandleBySymbol[symbolName] = currentCandleOpen;
                return;
            }

            if (currentCandleOpen <= previousSeenCandle)
                return;

            _lastCandleBySymbol[symbolName] = currentCandleOpen;

            // If this symbol has a position, do not add another position on it.
            if (Positions.Any(p => string.Equals(p.SymbolName, symbolName, StringComparison.OrdinalIgnoreCase)))
                return;

            if (Positions.FindAll(BotLabel).Length >= MaximumConcurrentPositions)
                return;

            // The last completed candle is Last(1); the current forming candle is Last(0).
            var signalCandle = bars.Last(1);
            TradeType direction;
            if (signalCandle.Close > signalCandle.Open)
                direction = TradeType.Buy;
            else if (signalCandle.Close < signalCandle.Open)
                direction = TradeType.Sell;
            else
            {
                Print("ENTRY SKIPPED | {0} | previous M5 candle was flat", symbolName);
                return;
            }

            Symbol symbol;
            try
            {
                symbol = Symbols.GetSymbol(symbolName);
            }
            catch (Exception ex)
            {
                Print("ENTRY SKIPPED | {0} | symbol unavailable: {1}", symbolName, ex.Message);
                return;
            }

            double entryPrice = direction == TradeType.Buy ? symbol.Ask : symbol.Bid;
            double stopPrice = direction == TradeType.Buy ? signalCandle.Low : signalCandle.High;
            double stopPips = Math.Abs(entryPrice - stopPrice) / symbol.PipSize;

            if (double.IsNaN(stopPips) || double.IsInfinity(stopPips) || stopPips <= 0)
            {
                Print("ENTRY SKIPPED | {0} | previous candle does not provide a valid stop distance", symbolName);
                return;
            }

            double riskMoney = Account.Balance * RiskPercent / 100.0;
            double volume;
            try
            {
                volume = symbol.VolumeForFixedRisk(riskMoney, stopPips, RoundingMode.Down);
                volume = symbol.NormalizeVolumeInUnits(volume, RoundingMode.Down);
            }
            catch (Exception ex)
            {
                Print("ENTRY SKIPPED | {0} | risk sizing failed: {1}", symbolName, ex.Message);
                return;
            }

            // Never round volume up past the calculated risk budget.
            if (volume < symbol.VolumeInUnitsMin || volume > symbol.VolumeInUnitsMax)
            {
                Print("ENTRY SKIPPED | {0} | risk-sized volume {1} is outside broker limits (min={2}, max={3})",
                    symbolName, volume, symbol.VolumeInUnitsMin, symbol.VolumeInUnitsMax);
                return;
            }

            TradeResult result = ExecuteMarketOrder(direction, symbolName, volume, BotLabel, stopPips, null);
            if (!result.IsSuccessful || result.Position == null)
            {
                Print("ENTRY REJECTED | {0} | {1}", symbolName, result.Error);
                return;
            }

            DateTime candleEnd = currentCandleOpen.AddMinutes(CandleMinutes);
            _positionCandleEnd[result.Position.Id] = candleEnd;
            _peakFavourablePips[result.Position.Id] = Math.Max(0, result.Position.Pips);

            Print("M5 ENTRY OPENED | {0} | side={1} | volume={2} | stopPips={3:F1} | riskBudget={4:F2} {5} | candleEndUTC={6:HH:mm:ss}",
                symbolName, direction, volume, stopPips, riskMoney, Account.Asset.Name, candleEnd);
        }

        private void ManageBotPositions()
        {
            foreach (var position in Positions.FindAll(BotLabel).ToArray())
            {
                double currentFavourablePips = Math.Max(0, position.Pips);
                double peak;
                if (!_peakFavourablePips.TryGetValue(position.Id, out peak))
                    peak = currentFavourablePips;

                if (currentFavourablePips > peak)
                    peak = currentFavourablePips;

                _peakFavourablePips[position.Id] = peak;

                DateTime candleEnd;
                if (!_positionCandleEnd.TryGetValue(position.Id, out candleEnd))
                {
                    candleEnd = FloorToM5(position.EntryTime).AddMinutes(CandleMinutes);
                    _positionCandleEnd[position.Id] = candleEnd;
                }

                bool retraced = peak > 0 && currentFavourablePips <= peak * RetainFavourableFraction;
                bool candleEnded = Server.Time >= candleEnd;

                if (retraced || candleEnded)
                {
                    string reason = retraced ? "25% retracement from peak favourable pips" : "originating M5 candle ended";
                    TradeResult closeResult = ClosePosition(position);
                    if (closeResult.IsSuccessful)
                        Print("M5 EXIT | {0} | reason={1} | pips={2:F1} | peakFavourable={3:F1}",
                            position.SymbolName, reason, position.Pips, peak);
                    else
                        Print("M5 EXIT RETRY | {0} | reason={1} | brokerError={2}",
                            position.SymbolName, reason, closeResult.Error);
                }
            }
        }

        private DateTime FloorToM5(DateTime time)
        {
            int minute = (time.Minute / CandleMinutes) * CandleMinutes;
            return new DateTime(time.Year, time.Month, time.Day, time.Hour, minute, 0, DateTimeKind.Utc);
        }

        private void OnPositionClosed(PositionClosedEventArgs args)
        {
            _positionCandleEnd.Remove(args.Position.Id);
            _peakFavourablePips.Remove(args.Position.Id);
        }

        protected override void OnStop()
        {
            Positions.Closed -= OnPositionClosed;
            Timer.Stop();
            Print("M5 FRESH START V1 stopped. Open positions are not automatically closed by stopping the cBot.");
        }
    }
}
