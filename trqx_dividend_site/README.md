# TRQX Dividend Wealth Dashboard

This package converts your stock sheet into a website-ready dashboard.

## Files
- `index.html` — main dashboard page
- `styles.css` — black/gold TRQX styling
- `app.js` — filters, scoring, calculator, refresh logic
- `data/stocks.json` — your cleaned stock universe
- `api/quotes.js` — Vercel API proxy for live market prices

## Fast local test
Open `index.html` in a browser. The dashboard works with the saved stock data immediately.

## Live market updates
Do not place paid API keys directly in browser JavaScript. Deploy this folder to Vercel and add an environment variable:

`FMP_API_KEY=your_key_here`

Then the Refresh Market Data button calls `/api/quotes` and updates prices.

## WordPress / GoDaddy option
Upload this folder to your hosting account as a custom page/app, or embed it in an iframe from Vercel.

## Next upgrades
- Add dividend yield and ex-dividend dates
- Add user watchlists
- Add member login / Whop gating
- Add portfolio holdings and dividend income tracking
