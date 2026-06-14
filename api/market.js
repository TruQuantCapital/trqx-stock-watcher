// TRQX Market Strip API
// Fetches S&P 500 (via SPY), NASDAQ (via QQQ), DOW (via DIA),
// GOLD (via GLD), and BTC/USD (via Binance public API — no auth needed).
// All use FINNHUB_API_KEY except BTC which calls Binance directly.

export default async function handler(req, res) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "Missing FINNHUB_API_KEY" });
  }

  // ETFs via Finnhub /quote (free tier supports these)
  const etfs = [
    { id: "spx",  sym: "SPY",  label: "S&P 500", mult: 10   },
    { id: "ndx",  sym: "QQQ",  label: "NASDAQ",  mult: 40   },
    { id: "dji",  sym: "DIA",  label: "DOW",     mult: 100  },
    { id: "gold", sym: "GLD",  label: "GOLD",    mult: 9.5  },
  ];

  const results = {};

  // Fetch ETFs from Finnhub in parallel
  await Promise.all(etfs.map(async ({ id, sym, label, mult }) => {
    try {
      const r = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`
      );
      if (!r.ok) return;
      const q = await r.json();
      if (!q || !q.c) return;

      results[id] = {
        id, label,
        price:  +(q.c * mult).toFixed(2),
        change: +(q.d * mult).toFixed(2),
        pct:    +q.dp.toFixed(2),
      };
    } catch (e) {
      console.warn(`Finnhub fetch failed for ${sym}:`, e.message);
    }
  }));

  // BTC from Binance public REST (no API key, no CORS issue server-side)
  try {
    const [tickerRes, prevRes] = await Promise.all([
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"),
      fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"),
    ]);

    if (tickerRes.ok && prevRes.ok) {
      const [{ price }, stats] = await Promise.all([tickerRes.json(), prevRes.json()]);
      const p   = parseFloat(price);
      const pct = parseFloat(stats.priceChangePercent);
      const chg = parseFloat(stats.priceChange);
      results.btc = {
        id: "btc", label: "BTC/USD",
        price: +p.toFixed(2),
        change: +chg.toFixed(2),
        pct:    +pct.toFixed(2),
      };
    }
  } catch (e) {
    console.warn("Binance BTC fetch failed:", e.message);
  }

  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  return res.status(200).json(results);
}
