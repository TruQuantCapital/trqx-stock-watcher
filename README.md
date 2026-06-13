# TRQX Stock Watcher v2

Updated Vercel/GitHub-ready dashboard.

## Features

- Finnhub live quote refresh
- 5-minute auto-refresh toggle
- Local watchlist with star buttons
- Watchlist CSV export
- TRQX Opportunity Meter
- Wider dashboard layout
- Correct FINNHUB_API_KEY messaging

## Required GitHub structure

Upload these files at the repository root:

```text
index.html
app.js
styles.css
favicon.svg
README.md
api/
  quotes.js
data/
  stocks.json
```

Do not upload the zip file itself as the live site.

## Vercel settings

- Framework Preset: Other
- Root Directory: `./` if files are at repo root
- Root Directory: `trqx_dividend_site` only if files are inside that folder
- Build Command: blank
- Output Directory: blank

## Environment variable

Add in Vercel:

```text
FINNHUB_API_KEY=your_key_here
```

Redeploy after adding or changing environment variables.

## Test route

After deploy, test:

```text
https://your-site.vercel.app/api/quotes?symbols=AAPL,MSFT
```

You should see JSON quote data.
