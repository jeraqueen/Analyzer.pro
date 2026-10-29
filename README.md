# Analyzer.pro — Market Compass FX Lab

## Current architecture

- `index.html`: screenshot workspace, risk calculator, CSV research backtest, and local journal.
- `worker.js`: Cloudflare Worker route for `/api/analyze`. It forwards H4/H1/M15/M5 screenshots to Google Gemini using a server-side secret. The browser never receives the provider API key.
- `public/index.html`: static site served by the Worker assets binding. This is the live frontend for the current `wrangler.jsonc` configuration.
- `functions/api/analyze.js`: legacy Cloudflare Pages Function copy; it is not used by the current Worker deployment and should not be used to configure the live `workers.dev` site.
- The app supports AUD/USD and XAU/USD research. Gold contract/pip specifications must be confirmed with your broker.

## Free-only AI setup

This project is configured to use the **Google Gemini API free tier** for testing instead of OpenAI. Free access has usage limits and model availability can change. Do not enable paid billing or upgrade the project if you want to spend nothing. When a free limit is reached, wait for the limit to reset rather than upgrading.

1. The current live address (`analyzer-pro.fx77.workers.dev`) is a **Cloudflare Worker deployment**, not a Pages Functions deployment. The repository's `wrangler.jsonc` sets `main` to `worker.js` and static assets to `public/`. Configure secrets on the `analyzer-pro` Worker itself, not on a separate Pages project.
2. Open Google AI Studio and create a Gemini API key: https://aistudio.google.com/app/apikey . Choose the free option. Do **not** set up Cloud Billing or upgrade to a paid tier.
3. In Cloudflare Dashboard → **Workers & Pages** → **analyzer-pro** Worker → **Settings → Variables and Secrets**, add an encrypted secret named `GEMINI_API_KEY` and paste the key from AI Studio.
4. Add a second encrypted secret named `ANALYZER_ACCESS_TOKEN`. Create a long, unique random token (at least 32 random characters) using a password manager or secure random generator. Do not reuse your Gemini key or a normal password. If a token was previously shared in a chat or public place, generate a new one.
5. Optionally add a non-secret variable named `GEMINI_MODEL` to override the default `gemini-3.1-flash-lite`. Leave it unset for the default model.
6. Save the secrets and deploy the Worker changes if Cloudflare prompts you.
7. Open the deployed website → **Settings & Backup**. The endpoint defaults to `/api/analyze`. Paste the same `ANALYZER_ACCESS_TOKEN` value into **Private analysis access token**, then tap **Save connection**.
8. Tap **Check backend readiness**. It should report that the backend is ready. This check does not send chart images or use AI quota. Then upload readable screenshots for H4, H1, M15 and M5 (at least one is required) and tap **Ask configured AI backend**.
9. If Gemini says a quota or rate limit has been reached, stop testing and wait for it to reset. Do not enable billing; the endpoint should return an error instead of switching to a paid provider.

The endpoint checks its own origin and requires the private access token for AI analysis. This is an extra safeguard, not a replacement for Cloudflare Access if you want to restrict who can open the website. Do not put `GEMINI_API_KEY` in HTML, GitHub, or the website settings.

## Important safety and research notes

- On the Gemini free tier, Google may use submitted content to improve its products; avoid uploading personal or confidential information. Check the current Google AI Studio terms and limits before use.
- Screenshot interpretation is fallible. Verify every proposed price against the live broker chart; the analyzer does not execute trades or guarantee outcomes.
- Live news, spreads, and prices are not checked by the screenshot endpoint. Check an economic calendar and the broker's live market data separately.
- Risk sizing needs the broker's correct contract size, pip/point value, account currency conversion, spread, commission, and slippage. XAU/USD must not use a forex pair's pip assumptions.
- The CSV backtester is a simplified EMA crossover example, not a validation of the screenshot-based discretionary strategy. It omits several live-market details and should not be treated as proof of profitability.
- The journal and settings are browser-local unless you export a backup; clearing browser storage can erase them.
