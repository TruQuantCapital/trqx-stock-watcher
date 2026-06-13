// TRQX Vercel serverless API route using Finnhub.
// Required Vercel Environment Variable: FINNHUB_API_KEY
// Endpoint: /api/quotes?symbols=AAPL,MSFT,PLD

export default async function handler(req, res) {
  const symbols = (req.query.symbols || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50);

  if (!symbols.length) {
    return res.status(400).json({ error: "Missing symbols" });
  }

  const key = process.env.FINNHUB_API_KEY;

  if (!key) {
    return res.status(500).json({
      error: "Missing FINNHUB_API_KEY environment variable"
    });
  }

  try {
    const results = [];

    for (const symbol of symbols) {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`;
      const response = await fetch(url);

      if (!response.ok) {
        results.push({ symbol, error: `Provider returned ${response.status}` });
        continue;
      }

      const q = await response.json();

      if (!q || typeof q.c !== "number" || q.c === 0) {
        results.push({ symbol, error: "No quote returned" });
        continue;
      }

      results.push({
        symbol,
        price: q.c,
        previousClose: q.pc,
        change: q.d,
        changesPercentage: q.dp
      });
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(results);
  } catch (error) {
    console.error("Finnhub quote request failed:", error);
    return res.status(500).json({ error: "Finnhub quote request failed" });
  }
}
