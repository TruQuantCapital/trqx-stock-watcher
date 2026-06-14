# TRQX AI Market Terminal v17.4 — SPY Strip Force Fix

## Fixed

- Forces top strip labels to:
  - SPY
  - QQQ
  - DIA
  - GLD
  - BTC/USD
- Adds JavaScript label override so old cached labels cannot remain visible.
- Adds cache busting: `app.js?v=17.4`
- BTC now requests `BINANCE:BTCUSDT`.
- Increased top strip font size.

## Important

After upload, redeploy in Vercel and hard refresh:

```text
Ctrl + Shift + R
```

If Vercel still shows S&P 500 after this, the production deployment is serving an older file.
