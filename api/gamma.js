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

    const mockPutCallRatioMap = {
      SPY: 0.92,
      QQQ: 0.88,
      IWM: 1.12,
      TSLA: 1.35,
      NVDA: 0.76,
      AAPL: 0.84,
      AMD: 1.05,
      PLTR: 1.22
    };

    const price = mockPriceMap[ticker] || 100;
    const putCallRatio = mockPutCallRatioMap[ticker] || 1.00;

    const callWall = Math.ceil(price / 5) * 5 + 5;
    const putWall = Math.floor(price / 5) * 5 - 5;
    const gammaFlip = Math.round(price);

    const squeezeRisk =
      ticker === "IWM" ||
      ticker === "TSLA" ||
      putCallRatio > 1.2
        ? "High"
        : "Moderate";

    const dealerPositioning =
      price >= gammaFlip ? "Long Gamma" : "Short Gamma";

    return res.status(200).json({
      ticker,
      bias: price >= gammaFlip
        ? "Neutral / Positive"
        : "Neutral",
      squeezeRisk,
      callWall,
      putWall,
      gammaFlip,
      maxPain: Math.round((callWall + putWall) / 2),
      dealerPositioning,
      putCallRatio: putCallRatio.toFixed(2)
    });

  } catch (error) {
    return res.status(500).json({
      error: "Gamma API failed",
      message: error.message
    });
  }
}
