# TRQX Stock Watcher / Dividend Wealth Dashboard

This is the updated GitHub/Vercel-ready version.

## Required structure

```text
index.html
app.js
styles.css
favicon.svg
api/
  quotes.js
data/
  stocks.json
```

## Vercel settings

- Framework Preset: Other
- Root Directory: ./
- Build Command: leave blank
- Output Directory: leave blank

## Environment variable

Add this in Vercel:

```text
FINNHUB_API_KEY=your_finnhub_key
```

Apply it to Production, Preview, and Development if available.

After adding the variable, redeploy.

## Live refresh

The button calls:

```text
/api/quotes?symbols=AAPL,MSFT,PLD
```

The serverless route calls Finnhub securely from Vercel, so your API key is not exposed in browser JavaScript.

## Notes

- The frontend refreshes symbols in batches to reduce rate-limit issues.
- The saved data in `data/stocks.json` loads immediately even if the live API is unavailable.
- This is educational software, not financial advice.
