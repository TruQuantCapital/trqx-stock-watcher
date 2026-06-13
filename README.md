# TRQX Stock Watcher v4

## New in v4

- Growth Scanner quality filters
- Minimum price filter
- Exclude penny stocks default
- Quality Only mode
- NYSE/NASDAQ-only mode
- Confidence Score: High / Medium / Low
- Confidence warnings such as penny-stock risk, non-major exchange, low TRQX score, and extreme volatility
- Improved Growth Rank that factors confidence into the score

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

Do not upload the zip itself as the live website.

## Vercel

- Framework Preset: Other
- Root Directory: `./` if files are at root
- Build Command: blank
- Output Directory: blank

Environment variable:

```text
FINNHUB_API_KEY=your_key_here
```

Redeploy after changing files or variables.
