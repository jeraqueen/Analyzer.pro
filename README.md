# Analyzer.pro — Market Compass FX Lab

## Current architecture

- `index.html`: screenshot workspace, risk calculator, CSV research backtest, and local journal.
- `functions/api/analyze.js`: Cloudflare Pages Function at `/api/analyze`. It forwards H4/H1/M15/M5 screenshots to the OpenAI Responses API using a server-side secret. The browser never receives the provider API key.
- The app supports AUD/USD and XAU/USD research. Gold contract/pip specifications must be confirmed with your broker.

## Required Cloudflare setup before AI analysis can work

1. Confirm this repository is deployed as a **Cloudflare Pages project connected to GitHub**, with the repository root as the build output directory and no build command required for this plain HTML project. Pages Functions are deployed from the root `functions/` directory.
2. In Cloudflare Dashboard → **Workers & Pages** → your Pages project → **Settings → Variables and Secrets**, add an encrypted secret named `OPENAI_API_KEY`. Use an API key from your OpenAI API account. ChatGPT subscriptions and API billing are separate.
3. Add a second encrypted secret named `ANALYZER_ACCESS_TOKEN`. Create a long, unique random token (at least 32 random characters) using a password manager or secure random generator. Do not reuse your OpenAI key or a normal password.
4. Optionally add a non-secret variable `OPENAI_MODEL` with a vision-capable model available in your API account (default: `gpt-4.1-mini`).
5. Redeploy the Pages project after setting the secrets.
6. Open the deployed website → **Settings & Backup**. The endpoint defaults to `/api/analyze`. Paste the same `ANALYZER_ACCESS_TOKEN` value into **Private analysis access token**, then tap **Save connection**.
7. Tap **Check backend readiness**. It should report that the backend is ready. This check does not spend AI credits. Then upload readable screenshots for H4, H1, M15 and M5 (at least one is required) and tap **Ask configured AI backend**. This real analysis request uses your OpenAI API account and may incur API charges.
8. Keep the website and token private. The access token is stored in this browser's local storage so the website can send it with requests. Do not share the browser profile, export files containing settings, or paste the token into public places. If you think it has leaked, replace the `ANALYZER_ACCESS_TOKEN` secret in Cloudflare and update the token in the website settings.

The endpoint checks its own origin and requires the private access token for AI analysis. This is an extra safeguard, not a replacement for Cloudflare Access if you want to restrict who can open the website. Do not put `OPENAI_API_KEY` in HTML, GitHub, or the website settings.

## Important safety and research notes

- Screenshot interpretation is fallible. Verify every proposed price against the live broker chart; the analyzer does not execute trades or guarantee outcomes.
- Live news, spreads, and prices are not checked by the screenshot endpoint. Check an economic calendar and the broker's live market data separately.
- Risk sizing needs the broker's correct contract size, pip/point value, account currency conversion, spread, commission, and slippage. XAU/USD must not use a forex pair's pip assumptions.
- The CSV backtester is a simplified EMA crossover example, not a validation of the screenshot-based discretionary strategy. It omits several live-market details and should not be treated as proof of profitability.
- The journal and settings are browser-local unless you export a backup; clearing browser storage can erase them.
