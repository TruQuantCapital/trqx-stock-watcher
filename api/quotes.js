// TRQX Vercel serverless API route using Finnhub.
// Required Vercel Environment Variable: FINNHUB_API_KEY
// Endpoint: /api/quotes?symbols=AAPL,MSFT,SPY,COINBASE:BTC-USD
//
// Supports both stock quotes and Finnhub crypto symbols (e.g. COINBASE:BTC-USD).
// Crypto symbols contain a colon — they are routed to /crypto/candle for price.

export default async function handler(req, res) {
  const raw = (req.query.symbols || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 50);

  if (!raw.length) return res.status(400).json({ error: "Missing symbols" });

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing FINNHUB_API_KEY environment variable" });

  try {
    const results = [];

    for (const symbol of raw) {
      const isCrypto = symbol.includes(":");

      if (isCrypto) {
        // Finnhub crypto candle — 1-minute resolution, last 2 minutes
        const now   = Math.floor(Date.now() / 1000);
        const from  = now - 120;
        const url   = `https://finnhub.io/api/v1/crypto/candle?symbol=${encodeURIComponent(symbol)}&resolution=1&from=${from}&to=${now}&token=${key}`;
        const response = await fetch(url);

        if (!response.ok) { results.push({ symbol, error: `Provider ${response.status}` }); continue; }

        const d = await response.json();
        if (!d || d.s !== "ok" || !d.c || !d.c.length) { results.push({ symbol, error: "No crypto data" }); continue; }

        const price = d.c[d.c.length - 1];
        const prev  = d.c.length > 1 ? d.c[0] : price;
        const chg   = price - prev;
        const chgPct = prev > 0 ? (chg / prev) * 100 : 0;

        results.push({ symbol, price, previousClose: prev, change: chg, changesPercentage: chgPct });

      } else {
        // Standard stock/ETF quote
        const sym = symbol.toUpperCase();
        const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`;
        const response = await fetch(url);

        if (!response.ok) { results.push({ symbol: sym, error: `Provider ${response.status}` }); continue; }

        const q = await response.json();
        if (!q || typeof q.c !== "number" || q.c === 0) { results.push({ symbol: sym, error: "No quote" }); continue; }

        results.push({ symbol: sym, price: q.c, previousClose: q.pc, change: q.d, changesPercentage: q.dp });
      }
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(results);

  } catch (error) {
    console.error("Finnhub quote request failed:", error);
    return res.status(500).json({ error: "Finnhub quote request failed" });
  }
}
