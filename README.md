# TRQX Stock Watcher v5 — Decision Engine

## New in v5

- AI Rating column: A+ Elite, A Strong, B Watch, C Speculative, D Avoid
- Probability estimate column
- Risk Meter: Conservative, Moderate, Aggressive
- Estimated time to target
- Moonshot Mode filter
- Clickable ticker detail modal
- "Why This Stock?" explanation
- TRQX Portfolio Builder
- Existing watchlist, auto-refresh, Finnhub API route, and Growth Scanner retained

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

Do not upload the ZIP itself as the website.

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

## Disclaimer

Education only. Not financial advice. Probability and time estimates are model-based approximations, not guarantees.


## v5.1 Dropdown Fix

- Dropdowns now listen for both `input` and `change` events.
- Growth Scanner, Portfolio Builder, and main table update immediately when filters change.
- Blank tables now show clear “No matches found” messages.


## v5.2 Live Controls Fix

- Scanner title now updates from the Capital input.
  - Example: 1000 displays `$1K Growth / Double-Up Scanner`.
- Risk and Quality dropdowns now force a recalculation on input, change, and keyup.
- Risk and Quality settings now materially affect ranking and sorting.
- Growth summary now shows current capital, goal, risk, and quality settings.
