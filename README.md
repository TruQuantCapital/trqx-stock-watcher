# TRQX AI Market Terminal v17.6 — AI Model Fix

## Fixed

Your AI bot was failing because the backend was using the retired Anthropic model:

```text
claude-3-5-sonnet-20241022
```

This version updates both secure API routes to:

```text
claude-sonnet-4-6
```

## Files Updated

```text
api/ai.js
api/chat.js
app.js
index.html
```

## Required Vercel Environment Variable

```text
ANTHROPIC_API_KEY
```

## Deployment Steps

1. Upload all files to GitHub.
2. Go to Vercel.
3. Redeploy.
4. Uncheck **Use existing Build Cache**.
5. Hard refresh your browser with **Ctrl + Shift + R**.

If it still fails, open:

```text
https://your-domain.vercel.app/api/ai
```

A GET request should show:

```text
Method not allowed
```

That means the route exists.
