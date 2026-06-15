// api/futures.js
// Vercel serverless function — proxies Yahoo Finance futures data
// Avoids browser CORS restrictions by fetching server-side

const FUTURES = [
  { key: "ES=F",  label: "/ES"  },
  { key: "NQ=F",  label: "/NQ"  },
  { key: "RTY=F", label: "/RTY" },
  { key: "YM=F",  label: "/YM"  },
  ];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=14, stale-while-revalidate=30");

  const result = {};

  for (const f of FUTURES) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(f.key)}?interval=1m&range=1d`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      });
      if (!response.ok) {
        console.warn(`[futures] ${f.key} HTTP ${response.status}`);
        continue;
      }
      const data = await response.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) continue;

      const last     = meta.regularMarketPrice ?? null;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
      const change   = last && prevClose ? +(last - prevClose).toFixed(2) : null;
      const changePct = last && prevClose ? +((change / prevClose) * 100).toFixed(2) : null;

      result[f.key] = { last, change, changePct, label: f.label };
    } catch (e) {
      console.warn(`[futures] ${f.key} error:`, e.message);
    }
  }

  res.status(200).json(result);
}
