# TRQX AI Market Terminal v8.7 — Portfolio Function Restored

## Fix

The page error was:

```text
ReferenceError: renderPortfolioBuilder is not defined
```

This version restores `renderPortfolioBuilder()` and keeps the KPI row removed without using aggressive cleanup scripts.

## Upload Structure

```text
index.html
app.js
styles.css
favicon.svg
README.md
api/
  quotes.js
  symbols.js
data/
  stocks.json
  expanded_universe_template.json
```

After upload, redeploy in Vercel and hard refresh with Ctrl+F5.
