# Analyzer.pro — Market Compass FX Lab

## Current architecture

- `index.html`: screenshot workspace, risk calculator, CSV research backtest, and local journal.
- `functions/api/analyze.js`: Cloudflare Pages Function at `/api/analyze`. It forwards H4/H1/M15/M5 screenshots to the OpenAI Responses API using a server-side secret. The browser never receives the provider API key.
- The app supports AUD/USD and XAU/USD research. Gold contract/pip specifications must be confirmed with your broker.

## Required Cloudflare setup before AI analysis can work

1. Confirm this repository is deployed as a **Cloudflare Pages project connected to GitHub**, with the repository root as the build output directory (the site currently has a root `index.html`). Pages Functions are deployed from the root `functions/` directory.
2. In Cloudflare Dashboard → **Workers & Pages** → your Pages project → **Settings → Variables and Secrets**, add an encrypted secret named `OPENAI_API_KEY`. Use an API key from your OpenAI API account. ChatGPT subscriptions and API billing are separate.
3. Optionally add a non-secret variable `OPENAI_MODEL` with a vision-capable model available in your API account (default: `gpt-4.1-mini`).
4. Redeploy the Pages project after adding the secret.
5. Protect the site and `/api/analyze` with Cloudflare Access or another proper authentication/rate-limit control before using it privately. The function restricts cross-origin browser requests, but CORS alone is **not authentication** and does not stop direct requests. Do not leave a paid AI endpoint open to the public.
6. Open the website → Settings & Backup. The backend endpoint defaults to `/api/analyze`. Use **Test backend** to check reachability; then upload screenshots and test an analysis. An OPTIONS check confirms reachability only, not that the API key, billing, model, or vision request is valid.

## Important safety and research notes

- Screenshot interpretation is fallible. Verify every proposed price against the live broker chart; the analyzer does not execute trades or guarantee outcomes.
- Live news, spreads, and prices are not checked by the screenshot endpoint. Check an economic calendar and the broker's live market data separately.
- Risk sizing needs the broker's correct contract size, pip/point value, account currency conversion, spread, commission, and slippage. XAU/USD must not use a forex pair's pip assumptions.
- The CSV backtester is a simplified EMA crossover example, not a validation of the screenshot-based discretionary strategy. It omits several live-market details and should not be treated as proof of profitability.
- The journal and settings are browser-local unless you export a backup; clearing browser storage can erase them.
