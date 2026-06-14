async function fetchMarketStrip() {
  const map = [
    { key: "spx", symbol: "SPY" },
    { key: "ndx", symbol: "QQQ" },
    { key: "dji", symbol: "DIA" },
    { key: "gold", symbol: "GLD" },
    { key: "btc", symbol: "BTC-USD" } // or "MSTR" if BTC fails
  ];

  try {
    const symbols = map.map(m => m.symbol).join(",");

    const response = await fetch(
      `/api/quotes?symbols=${encodeURIComponent(symbols)}`
    );

    if (!response.ok) {
      throw new Error("Failed to load market strip");
    }

    const data = await response.json();
    const quotes = Array.isArray(data) ? data : [];

    map.forEach(item => {
      const quote = quotes.find(
        q => (q.symbol || "").toUpperCase() === item.symbol
      );

      const priceEl = document.getElementById(
        `strip-price-${item.key}`
      );

      const pctEl = document.getElementById(
        `strip-pct-${item.key}`
      );

      if (!priceEl || !pctEl) return;

      if (!quote || !quote.price) {
        priceEl.textContent = "—";
        pctEl.textContent = "—";
        return;
      }

      const price = Number(quote.price);
      const pct = Number(quote.changesPercentage);

      priceEl.textContent = price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      if (Number.isFinite(pct)) {
        const up = pct >= 0;

        pctEl.textContent =
          `${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(2)}%`;

        pctEl.className = up
          ? "positive"
          : "negative";
      } else {
        pctEl.textContent = "—";
        pctEl.className = "";
      }
    });
  } catch (err) {
    console.error("Market strip error:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetchMarketStrip();
});

setInterval(fetchMarketStrip, 60000);
