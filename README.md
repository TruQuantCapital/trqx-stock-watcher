# TRQX AI Market Terminal v17.5 — Nuclear Strip Fix

## What was wrong

If the live site still showed S&P 500 / NASDAQ / DOW, it means the production page was still serving old HTML or old app.js.

## What this version does

This version fixes it in three places:

1. `index.html` labels are hard-coded as:
   - SPY
   - QQQ
   - DIA
   - GLD
   - IBIT

2. An inline script inside `index.html` force-overwrites the labels immediately, even before `app.js` loads.

3. `app.js` also force-overwrites the labels every 60 seconds.

## BTC Fix

The prior BTC price was wrong because it was pulling a proxy/security price, not Bitcoin spot.

To avoid misleading users, this version labels the fifth ticker as:

```text
IBIT
```

That price will match the Bitcoin ETF/proxy price being pulled.

## After Upload

Redeploy in Vercel and hard refresh:

```text
Ctrl + Shift + R
```

If it still says S&P 500 after this, the production site is not using the files you uploaded.
