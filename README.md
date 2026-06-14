# TRQX AI Market Terminal v17.3 — Live Strip Corrected

## Fixed

- Top strip now displays:
  - SPY
  - QQQ
  - DIA
  - GLD
  - BTC
- Removed misleading S&P 500 label while using SPY data.
- BTC now requests `BINANCE:BTCUSDT` instead of a stock proxy.
- Increased live strip font size.

## Note

If BTC still shows blank, your current `/api/quotes` route or Finnhub plan may not support crypto symbols. It will now show `—` instead of an incorrect stock/proxy price.

Upload all files/folders to GitHub root, redeploy in Vercel, then hard refresh with Ctrl+F5.
