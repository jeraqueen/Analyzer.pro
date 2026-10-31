//+------------------------------------------------------------------+
//| Deriv MT5 Demo Bot - V0.1                                        |
//| Demo-only research prototype. Review and test before any live use. |
//+------------------------------------------------------------------+
#property strict
#property version "0.10"
#property description "Multi-symbol, multi-timeframe demo EA with ATR stops and risk-based lot sizing."

#include <Trade/Trade.mqh>
CTrade trade;

input bool   DemoOnly                 = true;
input double RiskPercentPerTrade      = 0.50;
input double MaxDailyLossPercent      = 3.00;
input double MaxEquityDrawdownPercent = 10.00;
input int    MaxOpenPositions         = 3;
input int    ScanEverySeconds         = 10;
input int    FastEMA                  = 9;
input int    SlowEMA                  = 21;
input int    TrendEMA                 = 50;
input int    ATRPeriod                = 14;
input double StopATRMultiplier        = 2.0;
input double TakeProfitRMultiple      = 1.5;
input int    MaxSpreadPoints          = 0; // 0 disables generic points filter; broker-specific spread checks still apply.
input int    SlippagePoints           = 20;
input bool   UseTradingHours          = false;
input int    StartHourServer          = 8;  // broker server time
input int    EndHourServer            = 22; // broker server time, exclusive
input ulong  MagicNumber              = 3101026;

datetime g_dayStart = 0;
double   g_dayStartEquity = 0.0;
double   g_peakEquity = 0.0;
datetime g_lastScan = 0;

int OnInit()
{
   if(DemoOnly && AccountInfoInteger(ACCOUNT_TRADE_MODE) != ACCOUNT_TRADE_MODE_DEMO)
   {
      Print("DEMO-ONLY protection: this EA will not run on a non-demo account.");
      return INIT_FAILED;
   }
   if(RiskPercentPerTrade <= 0 || RiskPercentPerTrade > 1.0)
   {
      Print("RiskPercentPerTrade must be > 0 and <= 1.0 for this prototype.");
      return INIT_PARAMETERS_INCORRECT;
   }
   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(SlippagePoints);
   ResetDailyEquityIfNeeded();
   g_peakEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   EventSetTimer(MathMax(1, ScanEverySeconds));
   Print("Deriv MT5 Demo Bot V0.1 initialized. Symbols scanned are those in Market Watch.");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { EventKillTimer(); }
void OnTick() { ManagePositions(); }
void OnTimer()
{
   ResetDailyEquityIfNeeded();
   ManagePositions();
   if(!RiskGateAllowsNewTrades()) return;
   if(!IsTradingHour()) return;
   if(TimeCurrent() - g_lastScan < ScanEverySeconds) return;
   g_lastScan = TimeCurrent();

   int total = SymbolsTotal(true);
   for(int i=0; i<total; i++)
   {
      string symbol = SymbolName(i, true);
      if(symbol == "") continue;
      if(!SymbolSelect(symbol, true)) continue;
      if(HasOurPositionOnSymbol(symbol)) continue;
      if(CountOurPositions() >= MaxOpenPositions) break;
      EvaluateSymbol(symbol);
   }
}

void ResetDailyEquityIfNeeded()
{
   MqlDateTime now; TimeToStruct(TimeCurrent(), now);
   now.hour=0; now.min=0; now.sec=0;
   datetime midnight=StructToTime(now);
   if(g_dayStart != midnight)
   {
      g_dayStart=midnight;
      g_dayStartEquity=AccountInfoDouble(ACCOUNT_EQUITY);
      Print("Daily equity baseline reset: ", DoubleToString(g_dayStartEquity,2));
   }
}

bool RiskGateAllowsNewTrades()
{
   double equity=AccountInfoDouble(ACCOUNT_EQUITY);
   if(g_dayStartEquity > 0 && equity <= g_dayStartEquity*(1.0-MaxDailyLossPercent/100.0))
   {
      Print("Daily loss limit reached; blocking new entries.");
      return false;
   }
   if(g_peakEquity > 0 && equity <= g_peakEquity*(1.0-MaxEquityDrawdownPercent/100.0))
   {
      Print("Equity drawdown limit reached; blocking new entries.");
      return false;
   }
   if(AccountInfoDouble(ACCOUNT_MARGIN_FREE) <= 0) return false;
   return true;
}

bool IsTradingHour()
{
   if(!UseTradingHours) return true;
   MqlDateTime t; TimeToStruct(TimeCurrent(), t);
   if(StartHourServer < EndHourServer)
      return (t.hour >= StartHourServer && t.hour < EndHourServer);
   return (t.hour >= StartHourServer || t.hour < EndHourServer);
}

bool ReadIndicator(const string symbol, ENUM_TIMEFRAMES tf, ENUM_MA_METHOD method,
                   int period, int shift, double &value)
{
   int handle=iMA(symbol, tf, period, 0, method, PRICE_CLOSE);
   if(handle==INVALID_HANDLE) return false;
   double buffer[];
   ArraySetAsSeries(buffer,true);
   bool ok=(CopyBuffer(handle,0,shift,1,buffer)==1);
   if(ok) value=buffer[0];
   IndicatorRelease(handle);
   return ok;
}

bool ReadATR(const string symbol, ENUM_TIMEFRAMES tf, int period, double &value)
{
   int handle=iATR(symbol,tf,period);
   if(handle==INVALID_HANDLE) return false;
   double buffer[];
   ArraySetAsSeries(buffer,true);
   bool ok=(CopyBuffer(handle,0,1,1,buffer)==1);
   if(ok) value=buffer[0];
   IndicatorRelease(handle);
   return ok;
}

void EvaluateSymbol(const string symbol)
{
   // Require enough closed candles for all selected timeframes.
   if(Bars(symbol,PERIOD_M15)<SlowEMA+10 || Bars(symbol,PERIOD_H1)<TrendEMA+10 ||
      Bars(symbol,PERIOD_H4)<TrendEMA+10) return;

   double m15Fast=0,m15Slow=0,h1Fast=0,h1Slow=0,h4Fast=0,h4Slow=0,atr=0;
   if(!ReadIndicator(symbol,PERIOD_M15,MODE_EMA,FastEMA,1,m15Fast)) return;
   if(!ReadIndicator(symbol,PERIOD_M15,MODE_EMA,SlowEMA,1,m15Slow)) return;
   if(!ReadIndicator(symbol,PERIOD_H1,MODE_EMA,FastEMA,1,h1Fast)) return;
   if(!ReadIndicator(symbol,PERIOD_H1,MODE_EMA,TrendEMA,1,h1Slow)) return;
   if(!ReadIndicator(symbol,PERIOD_H4,MODE_EMA,FastEMA,1,h4Fast)) return;
   if(!ReadIndicator(symbol,PERIOD_H4,MODE_EMA,TrendEMA,1,h4Slow)) return;
   if(!ReadATR(symbol,PERIOD_M15,ATRPeriod,atr) || atr<=0) return;

   MqlTick tick;
   if(!SymbolInfoTick(symbol,tick) || tick.ask<=0 || tick.bid<=0) return;
   double point=SymbolInfoDouble(symbol,SYMBOL_POINT);
   if(point<=0) return;
   long spreadPoints=(long)MathRound((tick.ask-tick.bid)/point);
   if(MaxSpreadPoints>0 && spreadPoints>MaxSpreadPoints) return;

   bool buy=(m15Fast>m15Slow && h1Fast>h1Slow && h4Fast>h4Slow);
   bool sell=(m15Fast<m15Slow && h1Fast<h1Slow && h4Fast<h4Slow);
   if(!buy && !sell) return;

   double stopDistance=atr*StopATRMultiplier;
   double entry=buy ? tick.ask : tick.bid;
   double sl=buy ? entry-stopDistance : entry+stopDistance;
   double tp=buy ? entry+stopDistance*TakeProfitRMultiple : entry-stopDistance*TakeProfitRMultiple;
   int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
   sl=NormalizeDouble(sl,digits); tp=NormalizeDouble(tp,digits);

   double minStop=(double)SymbolInfoInteger(symbol,SYMBOL_TRADE_STOPS_LEVEL)*point;
   if(minStop>0 && MathAbs(entry-sl)<minStop) return;
   double lots=CalculateLots(symbol,entry,sl);
   if(lots<=0) { Print("Skipping ",symbol,": minimum volume exceeds risk budget or sizing unavailable."); return; }

   bool ok=false;
   if(buy) ok=trade.Buy(lots,symbol,0.0,sl,tp,"DemoBot MTF trend BUY");
   if(sell) ok=trade.Sell(lots,symbol,0.0,sl,tp,"DemoBot MTF trend SELL");
   if(!ok)
      Print("Order failed for ",symbol," retcode=",trade.ResultRetcode()," ",trade.ResultRetcodeDescription());
   else
      Print("Opened ",(buy?"BUY ":"SELL "),symbol," lots=",DoubleToString(lots,8),
            " SL=",DoubleToString(sl,digits)," TP=",DoubleToString(tp,digits));
}

double CalculateLots(const string symbol, double entry, double sl)
{
   double equity=AccountInfoDouble(ACCOUNT_EQUITY);
   double riskMoney=equity*RiskPercentPerTrade/100.0;
   if(riskMoney<=0) return 0;

   double tickSize=SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_SIZE);
   double tickValue=SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_VALUE_LOSS);
   if(tickValue<=0) tickValue=SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_VALUE);
   if(tickSize<=0 || tickValue<=0) return 0;
   double lossPerLot=(MathAbs(entry-sl)/tickSize)*tickValue;
   if(lossPerLot<=0) return 0;

   double rawLots=riskMoney/lossPerLot;
   double minLot=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN);
   double maxLot=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP);
   if(minLot<=0 || maxLot<=0 || step<=0) return 0;

   // Round DOWN to broker volume step; never round upward to meet minimum.
   double lots=MathFloor(rawLots/step)*step;
   lots=NormalizeDouble(lots,8);
   if(lots<minLot || lots>maxLot) return 0;

   double margin=0;
   ENUM_ORDER_TYPE type=(entry>sl ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);
   if(!OrderCalcMargin(type,symbol,lots,entry,margin)) return 0;
   if(margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE)*0.8) return 0;
   return lots;
}

bool HasOurPositionOnSymbol(const string symbol)
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0) continue;
      if(PositionGetString(POSITION_SYMBOL)==symbol &&
         (ulong)PositionGetInteger(POSITION_MAGIC)==MagicNumber) return true;
   }
   return false;
}

int CountOurPositions()
{
   int count=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC)==MagicNumber) count++;
   }
   return count;
}

void ManagePositions()
{
   double equity=AccountInfoDouble(ACCOUNT_EQUITY);
   if(equity>g_peakEquity) g_peakEquity=equity;
   // Broker-side SL/TP remain active even if terminal disconnects.
   // V0.1 intentionally does not widen stops or add to losing positions.
}
