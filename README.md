# TRQX AI Market Terminal v7

## What changed in v7

- Removed the developer-facing Institutional Universe Controls panel
- Removed customer-facing backend language
- Rebranded fully as **TRQX AI Market Terminal**
- Added TRQX AI Insights panel:
  - Bullish Opportunities
  - Elite AI Ratings
  - High Probability count
  - Market Regime indicator
- Renamed 100-Share Capital to **100-Share Portfolio Value**
- Retains:
  - Growth / Double-Up Scanner
  - Portfolio Builder
  - AI Rating
  - Probability engine
  - Stock risk meter
  - Watchlist
  - CSV export
  - Finnhub refresh API

## Required GitHub structure

Upload extracted files at the repository root:

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

## Vercel

- Framework Preset: Other
- Root Directory: `./`
- Build Command: blank
- Output Directory: blank

Environment variable:

```text
FINNHUB_API_KEY=your_key_here
```

## Stock Universe Expansion

The current dataset is still controlled by:

```text
data/stocks.json
```

To expand to 2,000+ stocks, replace that file with a larger JSON universe using the same structure.

Education only. Not financial advice.
