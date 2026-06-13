# TRQX AI Market Terminal v6

## Branding Update

- Product name changed to **TRQX AI Market Terminal**
- Removed developer-looking Stock Universe bars
- Added clean terminal metadata line in the hero section
- Retains Growth Scanner, Portfolio Builder, Watchlist, Finnhub refresh, AI Rating, Probability, Risk, and Time-to-Target

## 2,000+ Stock Expansion

This version is built to support institutional-scale stock universes.

To expand beyond the current universe, replace:

```text
data/stocks.json
```

with a larger JSON list using this structure:

```json
{
  "sector": "Technology",
  "name": "Apple Inc",
  "ticker": "AAPL",
  "exchange": "NASDAQ",
  "symbol": "NASDAQ:AAPL",
  "low52": 169.21,
  "high52": 288.62,
  "price": 248.8,
  "previousClose": 252.89,
  "signal": "WATCH",
  "trqxScore": 74
}
```

The app now normalizes missing fields and calculates fallback values when possible.

## Required GitHub Structure

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

## Important

For 2,000+ tickers, Finnhub free tier may rate-limit live refresh. The app batches quote requests, but a paid market-data plan or cached backend will eventually be needed for heavy usage.

Education only. Not financial advice.
