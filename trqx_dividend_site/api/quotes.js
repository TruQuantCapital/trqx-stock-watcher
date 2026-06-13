// Vercel serverless API route using Finnhub.
// Add FINNHUB_API_KEY in Vercel Environment Variables.
// Endpoint: /api/quotes?symbols=AAPL,MSFT,PLD

export default async function handler(req, res) {
  const symbols = (req.query.symbols || "")
    .split(",")
    .map(s => s.trim().toUpperCase())
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
    const results = await Promise.all(
      symbols.map(async symbol => {
        const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`;
        const r = await fetch(url);

        if (!r.ok) {
          return null;
        }

        const q = await r.json();

        return {
          symbol,
          price: q.c,
          previousClose: q.pc,
          change: q.d,
          changesPercentage: q.dp
        };
      })
    );

    const cleaned = results.filter(Boolean);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(cleaned);
  } catch (error) {
    return res.status(500).json({
      error: "Finnhub quote request failed"
    });
  }
}