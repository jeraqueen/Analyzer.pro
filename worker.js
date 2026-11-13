const MAX_BODY_BYTES = 9 * 1024 * 1024;
const ALLOWED_PAIRS = new Set(["XAUUSD", "BTCUSD", "NAS100", "US30"]);

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const ownOrigin = new URL(request.url).origin;
  if (origin && origin !== ownOrigin) return null;
  return {
    "Access-Control-Allow-Origin": ownOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Analyzer-Token",
    "Vary": "Origin"
  };
}


async function handleExecuteTrade(request, env) {
  const cors = corsHeaders(request);
  if (!cors) return json({ error: "Cross-origin requests are not allowed." }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "Use POST to forward a trade." }, 405, cors);
  if (!env.ANALYZER_ACCESS_TOKEN) return json({ error: "The execution endpoint is not protected. Configure ANALYZER_ACCESS_TOKEN." }, 503, cors);
  const suppliedToken = request.headers.get("X-Analyzer-Token") || "";
  if (suppliedToken.length !== env.ANALYZER_ACCESS_TOKEN.length || suppliedToken !== env.ANALYZER_ACCESS_TOKEN) {
    return json({ error: "Unauthorized. Check the private Analyzer access token." }, 401, cors);
  }
  if (!env.MT5_WEBHOOK_URL || !env.MT5_WEBHOOK_API_KEY) {
    return json({ error: "MT5 bridge is not configured. Set MT5_WEBHOOK_URL and MT5_WEBHOOK_API_KEY as encrypted Worker secrets." }, 503, cors);
  }
  let webhookUrl;
  try {
    webhookUrl = new URL(env.MT5_WEBHOOK_URL);
    if (webhookUrl.protocol !== "https:") throw new Error("HTTPS required");
  } catch {
    return json({ error: "MT5_WEBHOOK_URL must be a valid HTTPS URL." }, 503, cors);
  }
  let data;
  try { data = await request.json(); }
  catch { return json({ error: "Request body must be valid JSON." }, 400, cors); }
  const symbol = String(data.symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const direction = String(data.direction || "").toUpperCase();
  if (!ALLOWED_PAIRS.has(symbol)) return json({ error: "Unsupported instrument." }, 400, cors);
  if (!["LONG", "SHORT"].includes(direction)) return json({ error: "Direction must be LONG or SHORT." }, 400, cors);
  const prices = {};
  for (const key of ["entry", "sl", "tp1", "tp2", "tp3"]) {
    prices[key] = Number(data[key]);
    if (!Number.isFinite(prices[key]) || prices[key] <= 0) return json({ error: "Invalid " + key + " price." }, 400, cors);
  }
  const { entry, sl, tp1, tp2, tp3 } = prices;
  if (direction === "LONG" && !(sl < entry && entry < tp1 && tp1 <= tp2 && tp2 <= tp3)) return json({ error: "LONG prices must satisfy SL < Entry < TP1 <= TP2 <= TP3." }, 400, cors);
  if (direction === "SHORT" && !(sl > entry && entry > tp1 && tp1 >= tp2 && tp2 >= tp3)) return json({ error: "SHORT prices must satisfy SL > Entry > TP1 >= TP2 >= TP3." }, 400, cors);
  const balance = Number(data.balance), risk = Number(data.risk);
  const positionCount = Number(data.positionCount);
  const lotSize = data.lotSize === "auto" ? "auto" : Number(data.lotSize);
  if (!Number.isFinite(balance) || balance <= 0) return json({ error: "Balance must be greater than zero." }, 400, cors);
  if (!Number.isFinite(risk) || risk <= 0 || risk > 5) return json({ error: "Risk per trade must be between 0 and 5%." }, 400, cors);
  if (!Number.isInteger(positionCount) || positionCount < 1 || positionCount > 10) return json({ error: "Number of positions must be between 1 and 10." }, 400, cors);
  if (lotSize !== "auto" && (!Number.isFinite(lotSize) || lotSize <= 0 || lotSize > 100)) return json({ error: "Lot size must be Auto or a valid number no greater than 100." }, 400, cors);
  const payload = { symbol, direction, ...prices, lotSize, positionCount, balance, risk };
  const requestId = crypto.randomUUID();
  let upstream;
  try {
    upstream = await fetch(webhookUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": env.MT5_WEBHOOK_API_KEY,
        "Idempotency-Key": requestId
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    return json({ error: "Could not reach the configured MT5 Python webhook. No execution confirmation was received." }, 502, cors);
  }
  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok || result.error) {
    return json({ error: result.error || "MT5 webhook returned HTTP " + upstream.status + ".", webhookStatus: upstream.status }, 502, cors);
  }
  return json({ status: "forwarded", requestId, webhook: result, orders_placed: result.orders_placed || undefined, message: result.status || "Webhook accepted the request." }, 200, cors);
}

async function handleAnalyze(request, env) {
  const cors = corsHeaders(request);
  if (!cors) return json({ error: "Cross-origin requests are not allowed." }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method === "GET") {
    const ready = Boolean(env.GEMINI_API_KEY && env.ANALYZER_ACCESS_TOKEN);
    return json({
      status: ready ? "ready" : "not_ready",
      provider: "Google Gemini",
      error: ready ? undefined : "Configure GEMINI_API_KEY and ANALYZER_ACCESS_TOKEN as encrypted secrets on the Analyzer Pro Worker."
    }, ready ? 200 : 503, cors);
  }
  if (request.method !== "POST") return json({ error: "Use POST for chart analysis." }, 405, cors);
  if (!env.GEMINI_API_KEY) return json({ error: "The server is not configured. Add GEMINI_API_KEY as a Cloudflare Worker secret." }, 503, cors);
  if (!env.ANALYZER_ACCESS_TOKEN) return json({ error: "The server is not protected. Add ANALYZER_ACCESS_TOKEN as a Cloudflare Worker secret." }, 503, cors);
  const suppliedToken = request.headers.get("X-Analyzer-Token") || "";
  if (suppliedToken.length !== env.ANALYZER_ACCESS_TOKEN.length || suppliedToken !== env.ANALYZER_ACCESS_TOKEN) {
    return json({ error: "Unauthorized. Check the private Analyzer access token saved on this device." }, 401, cors);
  }
  const declaredSize = Number(request.headers.get("Content-Length") || 0);
  if (declaredSize > MAX_BODY_BYTES) return json({ error: "Request is too large. Upload smaller screenshots." }, 413, cors);
  let payload;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "Request is too large. Upload smaller screenshots." }, 413, cors);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400, cors);
  }
  const balance = Number(payload.balance ?? 100);
  const risk = Number(payload.risk ?? 1);
  if (!Number.isFinite(balance) || balance <= 0) return json({ error: "Account balance must be a number greater than zero." }, 400, cors);
  if (!Number.isFinite(risk) || risk <= 0 || risk > 100) return json({ error: "Risk per trade must be greater than 0 and no more than 100 percent." }, 400, cors);
  const timeframes = ["M5", "M1"];
  // Accept the new multi-pair format and the previous single-pair format.
  const submitted = Array.isArray(payload.pairs) ? payload.pairs : [{ pair: payload.pair || "EURUSD", charts: payload.charts || {} }];
  if (!submitted.length || submitted.length > 1) return json({ error: "Select one market per scan. Upload its M5 and M1 screenshots." }, 400, cors);
  const seen = new Set();
  for (const item of submitted) {
    item.pair = String(item.pair || "").toUpperCase();
    if (!ALLOWED_PAIRS.has(item.pair)) return json({ error: "Unsupported instrument: " + item.pair }, 400, cors);
    if (seen.has(item.pair)) return json({ error: "Choose each instrument only once per scan." }, 400, cors);
    seen.add(item.pair);
    item.charts = item.charts && typeof item.charts === "object" ? item.charts : {};
    const missing = timeframes.filter(tf => typeof item.charts[tf] !== "string");
    if (missing.length) return json({ error: item.pair + " is missing screenshots: " + missing.join(", ") }, 400, cors);
  }

  const now = new Date();
  const eatNow = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi", dateStyle: "full", timeStyle: "long", hour12: false
  }).format(now);
  const multi = false;

  const prompt = [
    "You are Analyzer Pro, an expert AI multi-timeframe chart analyst. You MUST actively inspect the uploaded screenshots and produce a careful chart scan. Analyze only the one selected instrument " + submitted[0].pair + " using its M5 and M1 screenshots. Current Kenya time: " + eatNow + ".",
    "SUPPORTED MARKETS ONLY: XAUUSD (Gold), BTCUSD (Bitcoin), NAS100 (Nasdaq 100), US30 (Dow Jones 30). Use the selected instrument's own chart prices. Do not compare or mix symbols.",
    "ONLY ACTIVE SETUP: M5 RANGE BREAKOUT + M1 FVG CONFIRMATION. No other setup is permitted.",
    "M5 RANGE: Identify the specific five-minute candle/range marked or selected by the user. Record its exact high and low. If the selected candle/range is unclear, state NOT IDENTIFIABLE and WAIT. Do not invent range boundaries.",
    "BREAKOUT: BUY only after an M5 candle body closes decisively above the range high. SELL only after an M5 candle body closes decisively below the range low. Wick-only breaks are invalid. Require clear displacement and no immediate rejection back inside the range.",
    "FVG CONFIRMATION: A valid visible Fair Value Gap must support the breakout direction. Describe the three-candle imbalance and its price zone only when readable. No valid directional FVG means no trade.",
    "M1 ENTRY: Confirm the entry using M1. Count the valid confirmation sequence and enter only at the close of its THIRD candle. State candle 1, candle 2 and candle 3. If candle 3 has not closed or the screenshots do not show enough history, say WAITING FOR M1 THIRD-CANDLE CLOSE. Never enter early.",
    "STOP LOSS: For BUY, use the lowest wick of the M5 breakout candle. For SELL, use the highest wick of the M5 breakout candle. Do not substitute an M1 swing or arbitrary ATR stop. If the exact breakout wick is unreadable, withhold the numeric trade plan.",
    "SUPPORT AND RESISTANCE: Map meaningful support and resistance visible on both supplied timeframes. M5 defines broader intraday structure and the breakout context. M1 identifies nearby execution obstacles and minor structure. Clearly label each level with its timeframe and whether it is support or resistance. Never fabricate or interpolate prices.",
    "TAKE PROFITS: For BUY, TP1 is the nearest meaningful resistance/overhead supply or opposing liquidity level in the trade direction; for SELL, TP1 is the nearest meaningful support/demand or opposing liquidity below. TP2 and TP3 are the next successive visible structure levels only if they exist. Explain the chart evidence/timeframe for every TP. Do not use fixed pip/point distances or force an R:R ratio. If the next support/resistance barrier leaves insufficient reward after the structural stop and costs, say WAIT — INSUFFICIENT ROOM.",
    "90-MINUTE LIMIT: Every proposed setup is intended to be completed within a maximum of 90 minutes from entry. Use only visible recent M1/M5 candle pace and distance to the target to judge whether the nearest TP is plausibly reachable within 90 minutes. If the chart does not provide enough evidence to estimate this, say TIME ESTIMATE NOT RELIABLE and do not pretend otherwise. State a hard planned maximum holding time of 90 minutes: if neither SL nor TP is reached by 90 minutes after entry, the user should close manually. The AI/site does not monitor live prices or automatically close broker positions. Never guarantee a TP or profit.",
    "STRICT EVIDENCE: Read exact prices from visible chart labels/axis. Preserve displayed decimal precision. Do not invent volume, indicators, ATR, live prices, news, spreads, win rates, confidence percentages, or pip/contract values. If screenshot timing, price scale or candles are unclear or M5/M1 do not align, report the limitation and WAIT.",
    "RISK CONTEXT: Account balance " + balance + "; user risk setting " + risk + "%. Do not calculate lot size unless broker contract/tick value data is actually provided. Separate chart setup validity from position sizing.",
    "OUTPUT EXACTLY THIS REPORT STRUCTURE:",
    "INSTRUMENT:",
    "OVERALL VERDICT: BUY / SELL / WAIT — NO TRADE",
    "ACTIVE STRATEGY: STRATEGY 1 — M5 RANGE BREAKOUT + M1 FVG CONFIRMATION ONLY",
    "M5 SELECTED RANGE: high / low / how identified",
    "M5 BREAKOUT: direction / candle body-close price / displacement evidence",
    "SUPPORTING FVG: direction / three-candle evidence / price zone",
    "M1 ENTRY CONFIRMATION: candle 1 / candle 2 / candle 3 / confirmation close",
    "ENTRY:",
    "STOP LOSS: M5 breakout candle extreme",
    "M5 SUPPORT:",
    "M5 RESISTANCE:",
    "M1 SUPPORT:",
    "M1 RESISTANCE:",
    "TP1: nearest opposing structure level + timeframe + reason",
    "TP2: next structure level + timeframe + reason (or unavailable)",
    "TP3: next structure level + timeframe + reason (or unavailable)",
    "R:R TO EACH TARGET: only when exact prices are readable",
    "ESTIMATED TIME TO TP1: only if supported by visible candle pace",
    "MAXIMUM HOLDING TIME: 90 minutes; manual close if still open",
    "STATUS: CONFIRMED / WAITING FOR M1 THIRD-CANDLE CLOSE / INVALID",
    "INVALIDATION:",
    "WHY THE SETUP DOES OR DOES NOT FIT THE 90-MINUTE LIMIT:",
    "LIMITATIONS:",
    "If the setup is not confirmed, say WAIT — NO VALID STRATEGY 1 SETUP and name the exact missing condition. Do not output a second strategy. Do not claim an order was placed.",
    "EXECUTION_DATA CONTRACT: Append one single-line EXECUTION_DATA JSON record only when Strategy 1 is fully confirmed and exact numeric Entry, SL, TP1, TP2 and TP3 are all visible and correctly ordered. Format: EXECUTION_DATA: {\"confirmed\":true,\"symbol\":\"" + submitted[0].pair + "\",\"direction\":\"LONG\",\"entry\":1.1,\"sl\":1.09,\"tp1\":1.11,\"tp2\":1.12,\"tp3\":1.13}. Use LONG for BUY and SHORT for SELL. Never append it if any required level is missing or unconfirmed."
  ].join("\n");

  const parts = [{ text: prompt }];
  for (const item of submitted) {
    for (const tf of timeframes) {
      const match = item.charts[tf].match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return json({ error: item.pair + " " + tf + " screenshot is not a supported base64 image." }, 400, cors);
      if (item.charts[tf].length > 5 * 1024 * 1024) return json({ error: item.pair + " " + tf + " screenshot is too large." }, 413, cors);
      const mimeType = match[1] === "jpg" ? "image/jpeg" : "image/" + match[1];
      parts.push({ text: "Instrument " + item.pair + " — next image is its " + tf + " chart screenshot. Treat only as evidence for this instrument and timeframe." });
      parts.push({ inlineData: { mimeType, data: match[2] } });
    }
  }

  const primaryModel = env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  // Keep the configured model first, then use official stable multimodal fallbacks
  // when Google reports temporary overload or rate limiting.
  const models = [...new Set([primaryModel, "gemini-3.5-flash-lite", "gemini-3.8-flash"])];
  const aiRequestBody = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0, maxOutputTokens: 5000 }
  });
  let lastStatus = 0;
  let lastError = "The AI service could not complete the request.";
  let lastCode = "GEMINI_TEMPORARILY_UNAVAILABLE";
  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
    let moveToFallback = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      let response;
      let result = {};
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: aiRequestBody
        });
        result = await response.json().catch(() => ({}));
      } catch {
        lastStatus = 0;
        lastError = "Could not reach Google's Gemini service (network error).";
        lastCode = "UPSTREAM_NETWORK_ERROR";
        console.error("Gemini request failed", JSON.stringify({ model, attempt, status: 0, reason: "network_error" }));
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        moveToFallback = true;
        break;
      }
      if (!response.ok) {
        lastStatus = response.status;
        lastError = result?.error?.message || `Gemini API returned HTTP ${response.status}`;
        const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
        console.error("Gemini API returned an error", JSON.stringify({ model, attempt, status: response.status, retryable, message: String(lastError).slice(0, 300) }));
        if (!retryable) {
          const status = response.status === 401 || response.status === 403 ? response.status : 502;
          const code = response.status === 401 || response.status === 403 ? "GEMINI_AUTH_ERROR" : `GEMINI_HTTP_${response.status}`;
          return json({ error: lastError, code, upstreamStatus: response.status, retryable: false }, status, cors);
        }
        lastCode = response.status === 429 ? "GEMINI_RATE_LIMIT" : response.status === 503 ? "GEMINI_OVERLOADED" : `GEMINI_HTTP_${response.status}`;
        if (attempt < 2) {
          const retryAfter = Number(response.headers.get("Retry-After") || 0);
          const delayMs = retryAfter > 0 ? Math.min(retryAfter * 1000, 8000) : 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        moveToFallback = true;
        break;
      }
      const analysis = (result.candidates?.[0]?.content?.parts || [])
        .map(part => typeof part.text === "string" ? part.text : "")
        .filter(Boolean)
        .join("\n").trim();
      if (!analysis) {
        const finishReason = result?.candidates?.[0]?.finishReason || "UNKNOWN";
        lastStatus = response.status;
        lastError = "Gemini returned no readable analysis.";
        lastCode = "EMPTY_AI_RESPONSE";
        console.error("Gemini returned no readable analysis", JSON.stringify({ model, attempt, status: response.status, finishReason }));
        moveToFallback = true;
        break;
      }
      return json({ text: analysis, model, provider: "Google Gemini" }, 200, cors);
    }
    if (moveToFallback) {
      console.warn("Switching Gemini model after temporary failure", JSON.stringify({ failedModel: model, nextModel: models[models.indexOf(model) + 1] || null, upstreamStatus: lastStatus, code: lastCode }));
      continue;
    }
  }
  console.error("All Gemini models exhausted", JSON.stringify({ models, upstreamStatus: lastStatus, code: lastCode, reason: String(lastError).slice(0, 300) }));
  return json({
    error: "All available Gemini models are temporarily unavailable. No trade plan was produced. Please retry shortly.",
    code: "GEMINI_ALL_MODELS_UNAVAILABLE",
    upstreamStatus: lastStatus || undefined,
    lastError: String(lastError).slice(0, 300),
    retryable: true
  }, 502, cors);
}

function getZonedClock(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date).reduce((out, part) => (out[part.type] = part.value, out), {});
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) };
}

async function sendSessionReminder(env, scheduledTime) {
  if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_REST_API_KEY) {
    console.error("Session reminder skipped: OneSignal app ID or REST API key is not configured.");
    return;
  }
  const now = new Date(scheduledTime || Date.now());
  const london = getZonedClock("Europe/London", now);
  const newYork = getZonedClock("America/New_York", now);
  const candidates = [
    { local: london, market: "London" },
    { local: newYork, market: "New York" }
  ];
  const due = [];
  for (const item of candidates) {
    if (item.local.hour === 8 && item.local.minute === 25) {
      due.push({ title: "Analyzer Pro · " + item.market + " reminder", message: "Five minutes until the 8:30 AM " + item.market + " screenshot session. Prepare your charts now." });
    }
    if (item.local.hour === 8 && item.local.minute === 30) {
      due.push({ title: "Analyzer Pro · " + item.market + " screenshot time", message: "It is 8:30 AM " + item.market + " local time. Capture your charts now. Kenya time is adjusted automatically for daylight saving." });
    }
  }
  if (!due.length) return;
  const appUrl = env.PUBLIC_APP_URL || "https://analyzer-pro.fx77.workers.dev";
  for (const alert of due) {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Authorization": "Key " + env.ONESIGNAL_REST_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        app_id: env.ONESIGNAL_APP_ID,
        included_segments: ["All"],
        headings: { en: alert.title },
        contents: { en: alert.message },
        web_url: appUrl + "/#timers"
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("OneSignal reminder send failed", JSON.stringify({ market: alert.title, status: response.status, response: JSON.stringify(result).slice(0, 500) }));
      throw new Error("OneSignal reminder failed with HTTP " + response.status);
    }
    console.log("OneSignal reminder sent", JSON.stringify({ market: alert.title, notificationId: result.id || null }));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/analyze") return handleAnalyze(request, env);
    if (url.pathname === "/api/execute-trade") return handleExecuteTrade(request, env);
    if (url.pathname === "/api/push-config" && request.method === "GET") {
      return json({ appId: env.ONESIGNAL_APP_ID || null, ready: Boolean(env.ONESIGNAL_APP_ID && env.ONESIGNAL_REST_API_KEY) });
    }
    const assetResponse = await env.ASSETS.fetch(request);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname.endsWith(".html"))) {
      const headers = new Headers(assetResponse.headers);
      headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
      return new Response(assetResponse.body, { status: assetResponse.status, statusText: assetResponse.statusText, headers });
    }
    return assetResponse;
  },
  async scheduled(controller, env) {
    await sendSessionReminder(env, controller.scheduledTime);
  }
};
