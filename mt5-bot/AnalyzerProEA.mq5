//+------------------------------------------------------------------+
//| AnalyzerProEA.mq5                                                |
//| Analyzer Pro - 16-market SMC/ICT signal receiver                 |
//| Demo-first EA. Uses the Analyzer Pro read-only signal API.       |
//+------------------------------------------------------------------+
#property strict
#property version   "1.00"
#property description "Receives Analyzer Pro SMC/ICT signals for 16 markets. Demo-only protection."

#include <Trade/Trade.mqh>
CTrade trade;

input string SignalURL = "https://analyzer-pro.fx77.workers.dev/api/mt5/signals";
input bool   DemoOnly = true;
input bool   EnableAutoTrading = false; // Change to true only after demo testing.
input double RiskPercentPerTrade = 0.25;
input double MaxDailyLossPercent = 2.0;
input double MaxEquityDrawdownPercent = 8.0;
input int    MaxOpenPositions = 3;
input int    PollEverySeconds = 60;
input int    MaxSignalAgeSeconds = 900;
input int    PendingOrderExpiryMinutes = 15;
input int    MaxSpreadPoints = 0; // 0 = no generic spread cap.
input int    SlippagePoints = 20;
input ulong  MagicNumber = 25112026;

string g_symbols[16] = {"EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD",
                        "US30","US500","DXY","XAUUSD","XAGUSD","USOIL","BTCUSD","ETHUSD","XRPUSD"};
datetime g_dayStart=0;
double g_dayEquity=0.0;
double g_peakEquity=0.0;
datetime g_lastPoll=0;

int OnInit()
{
   if(DemoOnly && AccountInfoInteger(ACCOUNT_TRADE_MODE)!=ACCOUNT_TRADE_MODE_DEMO)
   {
      Print("AnalyzerProEA: DEMO-ONLY protection blocked this non-demo account.");
      return INIT_FAILED;
   }
   if(RiskPercentPerTrade<=0.0 || RiskPercentPerTrade>1.0 ||
      MaxDailyLossPercent<=0.0 || MaxEquityDrawdownPercent<=0.0 ||
      PollEverySeconds<15 || MaxOpenPositions<1)
      return INIT_PARAMETERS_INCORRECT;

   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(SlippagePoints);
   ResetDailyBaseline();
   g_peakEquity=AccountInfoDouble(ACCOUNT_EQUITY);
   EventSetTimer(MathMax(15,PollEverySeconds));
   Print("AnalyzerProEA initialized. 16 markets available in feed; broker symbols are matched where listed.");
   Print("Auto trading is ",EnableAutoTrading ? "ON" : "OFF",". Add https://analyzer-pro.fx77.workers.dev to MT5 WebRequest allowed URLs.");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason){ EventKillTimer(); }
void OnTick(){ UpdatePeakEquity(); }
void OnTimer()
{
   if(DemoOnly && AccountInfoInteger(ACCOUNT_TRADE_MODE)!=ACCOUNT_TRADE_MODE_DEMO)
   {
      Print("Demo-only guard: trading account is no longer demo.");
      return;
   }
   ResetDailyBaseline();
   UpdatePeakEquity();
   ExpireOldPendingOrders();
   if(TimeCurrent()-g_lastPoll<PollEverySeconds) return;
   g_lastPoll=TimeCurrent();
   PollAnalyzerPro();
}

void ResetDailyBaseline()
{
   MqlDateTime now; TimeToStruct(TimeCurrent(),now);
   now.hour=0; now.min=0; now.sec=0;
   datetime midnight=StructToTime(now);
   if(midnight!=g_dayStart)
   {
      g_dayStart=midnight;
      g_dayEquity=AccountInfoDouble(ACCOUNT_EQUITY);
      Print("AnalyzerProEA daily equity baseline: ",DoubleToString(g_dayEquity,2));
   }
}
void UpdatePeakEquity()
{
   double e=AccountInfoDouble(ACCOUNT_EQUITY);
   if(e>g_peakEquity) g_peakEquity=e;
}
bool RiskGate()
{
   double e=AccountInfoDouble(ACCOUNT_EQUITY);
   if(g_dayEquity>0 && e<=g_dayEquity*(1.0-MaxDailyLossPercent/100.0))
   { Print("Daily loss guard reached; no new orders."); return false; }
   if(g_peakEquity>0 && e<=g_peakEquity*(1.0-MaxEquityDrawdownPercent/100.0))
   { Print("Equity drawdown guard reached; no new orders."); return false; }
   if(AccountInfoDouble(ACCOUNT_MARGIN_FREE)<=0) return false;
   return true;
}

string JsonString(string obj,string key)
{
   string token="\""+key+"\":";
   int p=StringFind(obj,token);
   if(p<0) return "";
   p+=StringLen(token);
   while(p<StringLen(obj) && (StringGetCharacter(obj,p)==' ' || StringGetCharacter(obj,p)==9)) p++;
   if(p>=StringLen(obj) || StringGetCharacter(obj,p)!='"') return "";
   p++;
   int e=StringFind(obj,"\"",p);
   if(e<0) return "";
   return StringSubstr(obj,p,e-p);
}
bool JsonBool(string obj,string key)
{
   string token="\""+key+"\":";
   int p=StringFind(obj,token);
   if(p<0) return false;
   p+=StringLen(token);
   while(p<StringLen(obj) && StringGetCharacter(obj,p)==' ') p++;
   return StringSubstr(obj,p,4)=="true";
}
double JsonNumber(string obj,string key)
{
   string token="\""+key+"\":";
   int p=StringFind(obj,token);
   if(p<0) return 0.0;
   p+=StringLen(token);
   while(p<StringLen(obj) && (StringGetCharacter(obj,p)==' ' || StringGetCharacter(obj,p)=='\"')) p++;
   int e=p;
   while(e<StringLen(obj))
   {
      ushort c=StringGetCharacter(obj,e);
      if((c>='0' && c<='9') || c=='.' || c=='-' || c=='+') e++;
      else break;
   }
   if(e<=p) return 0.0;
   return StringToDouble(StringSubstr(obj,p,e-p));
}

bool FetchSignalFeed(string &body)
{
   char data[],result[];
   string responseHeaders;
   ArrayResize(data,0);
   ResetLastError();
   int status=WebRequest("GET",SignalURL,"Accept: application/json\r\n",12000,data,result,responseHeaders);
   if(status==-1)
   {
      Print("Analyzer Pro WebRequest failed. MT5 error ",GetLastError(),
            ". Add https://analyzer-pro.fx77.workers.dev under Tools > Options > Expert Advisors > Allow WebRequest.");
      return false;
   }
   if(status!=200)
   {
      Print("Analyzer Pro API returned HTTP ",status);
      return false;
   }
   body=CharArrayToString(result,0,-1,CP_UTF8);
   return StringLen(body)>20;
}

string ExtractSignalObject(string body,string symbol)
{
   string token="\"symbol\":\""+symbol+"\"";
   int p=StringFind(body,token);
   if(p<0) return "";
   int start=p;
   while(start>0 && StringGetCharacter(body,start)!='{') start--;
   int next=StringFind(body,"{\"symbol\":\"",p+StringLen(token));
   int end=(next>=0 ? next : StringFind(body,"]}",p));
   if(end<0) end=StringLen(body);
   if(end<=start) return "";
   return StringSubstr(body,start,end-start);
}

string ResolveBrokerSymbol(string canonical)
{
   if(SymbolSelect(canonical,true)) return canonical;
   int total=SymbolsTotal(true);
   for(int i=0;i<total;i++)
   {
      string candidate=SymbolName(i,true);
      if(StringFind(candidate,canonical)==0)
      {
         SymbolSelect(candidate,true);
         return candidate;
      }
   }
   return "";
}

int CountOurPositionsAndOrders()
{
   int count=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket>0 && (ulong)PositionGetInteger(POSITION_MAGIC)==MagicNumber) count++;
   }
   for(int j=OrdersTotal()-1;j>=0;j--)
   {
      ulong ticket=OrderGetTicket(j);
      if(ticket>0 && (ulong)OrderGetInteger(ORDER_MAGIC)==MagicNumber) count++;
   }
   return count;
}
bool HasOurExposure(string symbol)
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket>0 && PositionGetString(POSITION_SYMBOL)==symbol &&
         (ulong)PositionGetInteger(POSITION_MAGIC)==MagicNumber) return true;
   }
   for(int j=OrdersTotal()-1;j>=0;j--)
   {
      ulong ticket=OrderGetTicket(j);
      if(ticket>0 && OrderGetString(ORDER_SYMBOL)==symbol &&
         (ulong)OrderGetInteger(ORDER_MAGIC)==MagicNumber) return true;
   }
   return false;
}

double CalculateLots(string symbol,ENUM_ORDER_TYPE type,double entry,double sl)
{
   double riskMoney=AccountInfoDouble(ACCOUNT_EQUITY)*RiskPercentPerTrade/100.0;
   double pnl=0.0;
   if(riskMoney<=0 || !OrderCalcProfit(type,symbol,1.0,entry,sl,pnl)) return 0.0;
   double loss=MathAbs(pnl);
   if(loss<=0 || !MathIsValidNumber(loss)) return 0.0;
   double raw=riskMoney/loss;
   double minLot=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN);
   double maxLot=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP);
   if(minLot<=0 || maxLot<=0 || step<=0) return 0.0;
   double lots=NormalizeDouble(MathFloor(raw/step)*step,8);
   if(lots<minLot || lots>maxLot) return 0.0;
   double margin=0.0;
   if(!OrderCalcMargin(type,symbol,lots,entry,margin)) return 0.0;
   if(margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE)*0.8) return 0.0;
   return lots;
}

void ProcessOneSignal(string canonical,string obj)
{
   if(obj=="") return;
   if(!JsonBool(obj,"planReady")) return;
   string direction=JsonString(obj,"direction");
   string orderType=JsonString(obj,"orderType");
   string signalId=JsonString(obj,"signalId");
   double entry=JsonNumber(obj,"entry");
   double sl=JsonNumber(obj,"stopLoss");
   double tp=JsonNumber(obj,"tp1");
   double lastEpoch=JsonNumber(obj,"lastCandleEpoch");
   if(signalId=="" || entry<=0 || sl<=0 || tp<=0 || lastEpoch<=0) return;
   if((TimeCurrent()-(datetime)lastEpoch)>MaxSignalAgeSeconds || (datetime)lastEpoch>TimeCurrent()+120)
   { Print(canonical,": ignored stale signal."); return; }

   string symbol=ResolveBrokerSymbol(canonical);
   if(symbol=="") return; // This instrument is not offered in this broker's Market Watch.
   if(HasOurExposure(symbol)) return;
   if(!EnableAutoTrading)
   { Print(canonical," signal ready: ",direction," ",orderType," entry=",DoubleToString(entry,(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS)),
           " SL=",DoubleToString(sl,(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS))," TP1=",DoubleToString(tp,(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS)),
           ". Auto trading is OFF."); return; }
   if(!RiskGate() || CountOurPositionsAndOrders()>=MaxOpenPositions) return;

   MqlTick tick;
   if(!SymbolInfoTick(symbol,tick) || tick.ask<=0 || tick.bid<=0) return;
   double point=SymbolInfoDouble(symbol,SYMBOL_POINT);
   int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
   if(point<=0) return;
   if(MaxSpreadPoints>0 && (tick.ask-tick.bid)/point>MaxSpreadPoints) return;

   ENUM_ORDER_TYPE calcType;
   bool sent=false;
   double minStop=(double)SymbolInfoInteger(symbol,SYMBOL_TRADE_STOPS_LEVEL)*point;
   entry=NormalizeDouble(entry,digits); sl=NormalizeDouble(sl,digits); tp=NormalizeDouble(tp,digits);
   if(direction=="BUY" && orderType=="BUY LIMIT")
   {
      if(entry>=tick.ask || sl>=entry || tp<=entry) return;
      if((entry-sl)<minStop || (tp-entry)<minStop) return;
      calcType=ORDER_TYPE_BUY;
      double lots=CalculateLots(symbol,calcType,entry,sl);
      if(lots<=0) { Print(canonical,": skipped; minimum lot exceeds risk budget or sizing unavailable."); return; }
      trade.SetTypeFillingBySymbol(symbol);
      sent=trade.BuyLimit(lots,entry,symbol,sl,tp,ORDER_TIME_GTC,0,"AnalyzerPro SMC BUY");
   }
   else if(direction=="SELL" && orderType=="SELL LIMIT")
   {
      if(entry<=tick.bid || sl<=entry || tp>=entry) return;
      if((sl-entry)<minStop || (entry-tp)<minStop) return;
      calcType=ORDER_TYPE_SELL;
      double lots=CalculateLots(symbol,calcType,entry,sl);
      if(lots<=0) { Print(canonical,": skipped; minimum lot exceeds risk budget or sizing unavailable."); return; }
      trade.SetTypeFillingBySymbol(symbol);
      sent=trade.SellLimit(lots,entry,symbol,sl,tp,ORDER_TIME_GTC,0,"AnalyzerPro SMC SELL");
   }
   if(sent)
      Print("Analyzer Pro pending order placed: ",direction," ",symbol," entry=",DoubleToString(entry,digits)," signal=",signalId);
   else
      Print("Analyzer Pro order rejected for ",symbol,": ",trade.ResultRetcode()," ",trade.ResultRetcodeDescription());
}

void ExpireOldPendingOrders()
{
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      ulong ticket=OrderGetTicket(i);
      if(ticket==0 || (ulong)OrderGetInteger(ORDER_MAGIC)!=MagicNumber) continue;
      datetime setup=(datetime)OrderGetInteger(ORDER_TIME_SETUP);
      if(setup>0 && TimeCurrent()-setup>PendingOrderExpiryMinutes*60)
      {
         if(trade.OrderDelete(ticket)) Print("Expired Analyzer Pro pending order removed: ",ticket);
      }
   }
}

void PollAnalyzerPro()
{
   string body;
   if(!FetchSignalFeed(body)) return;
   if(StringFind(body,"\"results\":[")<0)
   { Print("Analyzer Pro feed response format was not recognized."); return; }
   int ready=0,available=0;
   for(int i=0;i<ArraySize(g_symbols);i++)
   {
      string obj=ExtractSignalObject(body,g_symbols[i]);
      if(obj=="") continue;
      if(JsonString(obj,"status")!="FEED UNAVAILABLE") available++;
      if(JsonBool(obj,"planReady")) ready++;
      ProcessOneSignal(g_symbols[i],obj);
   }
   Print("Analyzer Pro feed checked: ",available," markets with data; ",ready," ready setups. Auto trading ",EnableAutoTrading?"ON":"OFF",".");
}
