export default async function handler(req, res) {
  try {
    const ticker = String(req.query.ticker || "SPY").toUpperCase();

    const mockPriceMap = {
      SPY: 625,
      QQQ: 545,
      IWM: 215,
      TSLA: 180,
      NVDA: 145,
      AAPL: 200,
      AMD: 160,
      PLTR: 125
    };

    const price = mockPriceMap[ticker] || 100;

    const callWall = Math.ceil(price / 5) * 5 + 5;
    const putWall = Math.floor(price / 5) * 5 - 5;
    const gammaFlip = Math.round(price);
    const squeezeRisk =
      ticker === "IWM" || ticker === "TSLA" ? "High" : "Moderate";

    const dealerPositioning =
      price >= gammaFlip ? "Long Gamma" : "Short Gamma";

    return res.status(200).json({
      ticker,
      bias: price >= gammaFlip ? "Neutral / Positive" : "Neutral",
      squeezeRisk,
      callWall,
      putWall,
      gammaFlip,
      maxPain: Math.round((callWall + putWall) / 2),
      dealerPositioning
    });
  } catch (error) {
    return res.status(500).json({
      error: "Gamma API failed",
      message: error.message
    });
  }
}
