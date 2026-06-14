# TRQX AI Market Terminal v19.5 — AI Route Fix

## What caused the error

The AI route was hard-coded to:

```text
claude-3-5-sonnet-20241022
```

If the Anthropic account, key, or current model access does not support that exact model, the browser shows the connection error.

Anthropic's current model docs list newer model IDs such as:

```text
claude-sonnet-4-6
claude-sonnet-4-5
```

## What changed

- Updated `/api/chat.js`
- Updated `/api/ai.js`
- Removed dependency on only `claude-3-5-sonnet-20241022`
- Added support for optional Vercel variable:

```text
ANTHROPIC_MODEL=claude-sonnet-4-6
```

- Added fallback model attempts:
  - `claude-sonnet-4-6`
  - `claude-sonnet-4-5`
  - `claude-3-5-sonnet-latest`
  - `claude-3-5-sonnet-20241022`

- If the key is missing or the provider fails, the site no longer breaks. It returns a clean TRQX fallback message instead of a hard connection error.

## Required Vercel Environment Variable

```text
ANTHROPIC_API_KEY
```

## Optional Vercel Environment Variable

```text
ANTHROPIC_MODEL=claude-sonnet-4-6
```

## Required action

After uploading these files:

1. Go to Vercel.
2. Open your project.
3. Go to Settings → Environment Variables.
4. Confirm `ANTHROPIC_API_KEY` exists under Production.
5. Optional: add `ANTHROPIC_MODEL` with value `claude-sonnet-4-6`.
6. Redeploy Production.
7. Hard refresh the browser with Ctrl+Shift+R.
