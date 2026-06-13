# TRQX Stock Watcher v3

## New in v3

- $2K Growth / Double-Up Scanner
- Capital input
- Goal multiple input
- Max stock price filter
- Risk mode: Conservative / Moderate / Aggressive
- Daily Change $ and Daily Change % columns
- Watchlist stars
- Watchlist CSV export
- TRQX Opportunity Meter
- Auto-refresh every 5 minutes
- Finnhub serverless API route

## Required GitHub structure

Upload the extracted files at the repository root:

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
- Build Command: blank
- Output Directory: blank

If your files are inside a folder such as `trqx_dividend_site`, set Root Directory to that folder.

## Environment variable

Add in Vercel:

```text
FINNHUB_API_KEY=your_key_here
```

Redeploy after changing environment variables.

## Important note

The Growth / Double-Up Scanner is educational and speculative. It does not predict guaranteed returns. It ranks candidates based on affordability, distance to 52-week high, and TRQX score.
