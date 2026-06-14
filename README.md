# TRQX AI Market Terminal v17.1 — RSS + Layout Merge Fix

## What changed

This version keeps the newer v17 layout fixes but restores the better RSS/live market strip structure from your current uploaded files.

## Fixed

- Top RSS/live strip labels restored:
  - S&P 500
  - NASDAQ
  - DOW
  - GOLD
  - BTC
- RSS strip IDs match the JavaScript updater:
  - strip-price-spx / strip-pct-spx
  - strip-price-ndx / strip-pct-ndx
  - strip-price-dji / strip-pct-dji
  - strip-price-gold / strip-pct-gold
  - strip-price-btc / strip-pct-btc
- Live strip now refreshes every 60 seconds
- Top AI Picks table now matches the v17 layout
- Flow Scanner image uses `object-fit: contain` so it no longer gets cut off
- Restored the richer background stage from your uploaded version

## Upload

Upload everything to GitHub root, redeploy in Vercel, then hard refresh with Ctrl+F5.
