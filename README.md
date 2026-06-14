# TRQX AI Market Terminal v20.2 — Market Status Fix

## Fixed

The top strip no longer hard-codes:

```text
Market Open
```

It now calculates U.S. regular market hours using Eastern Time:

```text
Monday-Friday
9:30 AM ET - 4:00 PM ET
```

It displays:

```text
Market Open · HH:MM ET
```

or:

```text
Market Closed · HH:MM ET
```

## Note

This checks regular weekday hours. It does not yet include the full U.S. market holiday calendar or early-close schedule. That can be added later if needed.

## Upload

Upload all files/folders to GitHub root, redeploy in Vercel, then hard refresh with Ctrl+Shift+R.
