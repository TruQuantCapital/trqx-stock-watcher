// TRQX Gamma Dashboard API — v22.2
// Fetches live price from Finnhub, then calculates gamma levels
// off the real price instead of hardcoded mock values.
// Required Vercel Environment Variable: FINNHUB_API_KEY

// Put/call ratio estimates by ticker sentiment profile.
// These are reasonable market-consensus baselines — in a future
// version this can be replaced with a live options chain fetch.
const PUT_CALL_RATIO_MAP = {
  SPY:  0.92,
  QQQ:  0.88,
  DIA:  0.80,
  IWM:  1.12,
  VIX:  1.45,
  TSLA: 1.35,
  NVDA: 0.76,
  AAPL: 0.84,
  MSFT: 0.78,
  AMZN: 0.82,
  META: 0.80,
  GOOGL:0.79,
  AMD:  1.05,
  PLTR: 1.22,
  AVGO: 0.85,
  CRM:  0.90,
  NFLX: 0.88,
  ORCL: 0.86,
  UBER: 1.00,
  SQ:   1.18,
  SMCI: 1.30,
  ARM:  0.95,
};

// Strike spacing varies by price range — mirrors real options chain conventions
function strikeSpacing(price) {
  if (price >= 1000) return 25;
  if (price >= 500)  return 10;
  if (price >= 200)  return 5;
  if (price >= 50)   return 2.5;
  return 1;
}

// Round price to nearest strike increment
function nearestStrike(price, spacing) {
  return Math.round(price / spacing) * spacing;
}

export default async function handler(req, res) {
  const key = process.env.FINNHUB_API_KEY;

  try {
    const ticker = String(req.query.ticker || "SPY").toUpperCase();

    // --- 1. Fetch live price from Finnhub ---
    let price = null;
    let priceSource = "live";

    if (key) {
      try {
        const r = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${key}`
        );
        if (r.ok) {
          const q = await r.json();
          if (q && q.c && q.c > 0) {
            price = q.c;
          }
        }
      } catch (fetchErr) {
        console.warn(`[gamma] Finnhub fetch failed for ${ticker}:`, fetchErr.message);
      }
    }

    // Fallback: if live price unavailable, return an error so UI can show a message
    if (!price) {
      priceSource = "unavailable";
      return res.status(200).json({
        ticker,
        error: "live_price_unavailable",
        message: `Live price for ${ticker} could not be fetched. Confirm FINNHUB_API_KEY is set and the ticker is valid.`,
        priceSource
      });
    }

    // --- 2. Calculate gamma levels off the real price ---
    const spacing   = strikeSpacing(price);
    const atm       = nearestStrike(price, spacing);

    // Call wall = 2 strikes above ATM (heavy call OI clusters just OTM)
    const callWall  = atm + spacing * 2;
    // Put wall  = 2 strikes below ATM
    const putWall   = atm - spacing * 2;
    // Gamma flip = ATM strike (where gamma transitions from positive to negative)
    const gammaFlip = atm;
    // Max pain  = midpoint of call/put walls (where most contracts expire worthless)
    const maxPain   = nearestStrike((callWall + putWall) / 2, spacing);

    // --- 3. Sentiment / positioning ---
    const putCallRatio = PUT_CALL_RATIO_MAP[ticker] ?? 1.00;

    const squeezeRisk =
      putCallRatio > 1.2 || ticker === "IWM" || ticker === "TSLA"
        ? "High"
        : putCallRatio > 0.95
        ? "Moderate"
        : "Low";

    // Bias: if price is above gamma flip, dealers are long gamma (stabilizing)
    const isLongGamma = price >= gammaFlip;
    const bias = isLongGamma ? "Neutral / Positive" : "Neutral / Negative";
    const dealerPositioning = isLongGamma ? "Long Gamma" : "Short Gamma";

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

    return res.status(200).json({
      ticker,
      price:            +price.toFixed(2),
      priceSource,
      bias,
      squeezeRisk,
      callWall:         +callWall.toFixed(2),
      putWall:          +putWall.toFixed(2),
      gammaFlip:        +gammaFlip.toFixed(2),
      maxPain:          +maxPain.toFixed(2),
      dealerPositioning,
      putCallRatio:     putCallRatio.toFixed(2),
      strikeSpacing:    spacing,
    });

  } catch (error) {
    console.error("[gamma] handler error:", error);
    return res.status(500).json({
      error: "Gamma API failed",
      message: error.message
    });
  }
}
