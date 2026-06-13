// TRQX Vercel serverless API route using Finnhub.
// Required Vercel Environment Variable: FINNHUB_API_KEY
// Endpoint: /api/symbols
// Pulls a broad U.S. stock universe from Finnhub and filters common/ETF listings.

export default async function handler(req, res) {
  const key = process.env.FINNHUB_API_KEY;

  if (!key) {
    return res.status(500).json({
      error: "Missing FINNHUB_API_KEY environment variable"
    });
  }

  try {
    const url = `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${key}`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Finnhub symbol request failed with ${response.status}`
      });
    }

    const raw = await response.json();

    const blockedPatterns = [
      /\bWARRANT\b/i,
      /\bRIGHT\b/i,
      /\bUNIT\b/i,
      /\bPREFERRED\b/i,
      /\bPFD\b/i,
      /\bNOTE\b/i,
      /\bBOND\b/i
    ];

    const cleaned = raw
      .filter((s) => s && s.symbol && s.description)
      .filter((s) => !s.symbol.includes(".WS"))
      .filter((s) => !s.symbol.includes(".U"))
      .filter((s) => !s.symbol.includes("^"))
      .filter((s) => !blockedPatterns.some((p) => p.test(s.description)))
      .map((s) => ({
        sector: "Unclassified",
        name: s.description,
        ticker: s.symbol,
        exchange: "US",
        symbol: s.symbol,
        low52: null,
        high52: null,
        price: null,
        previousClose: null,
        from52LowPct: null,
        below52HighPct: null,
        signal: "WATCH",
        cost25: null,
        cost100: null,
        trqxScore: 50,
        source: "Finnhub US Symbol Universe"
      }));

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json(cleaned);
  } catch (error) {
    console.error("Finnhub symbol request failed:", error);
    return res.status(500).json({ error: "Finnhub symbol request failed" });
  }
}
