let stocks = [];
let watchlist = JSON.parse(localStorage.getItem("trqxWatchlist") || "[]");
let autoTimer = null;
let lastUpdated = null;

const fmtUSD = (n) =>
  n == null || Number.isNaN(Number(n))
    ? "—"
    : Number(n).toLocaleString(undefined, { style: "currency", currency: "USD" });

const fmtPct = (n) =>
  n == null || Number.isNaN(Number(n)) ? "—" : `${Number(n).toFixed(2)}%`;

async function load() {
  stocks = await fetch("data/stocks.json").then((r) => r.json());
  setupFilters();
  render();
  calcIncome();
  renderGrowthScanner();
  renderPortfolioBuilder();
  setStatus("Saved stock universe loaded. Click Refresh Market Data for live prices.");
}

function setStatus(message) {
  const el = document.getElementById("status");
  if (el) el.textContent = message || "";
}

function bindControl(id, callback) {
  const el = document.getElementById(id);
  if (!el) return;

  const handler = () => {
    // Delay one frame so select/input value is fully committed before recalculation.
    requestAnimationFrame(() => callback());
  };

  el.addEventListener("input", handler);
  el.addEventListener("change", handler);
  el.addEventListener("keyup", handler);
}

function setupFilters() {
  const sectors = [...new Set(stocks.map((s) => s.sector).filter(Boolean))].sort();
  const sel = document.getElementById("sector");

  sectors.forEach((s) => {
    if (![...sel.options].some((o) => o.value === s)) {
      sel.insertAdjacentHTML("beforeend", `<option>${s}</option>`);
    }
  });

  ["search", "sector", "signal", "viewMode"].forEach((id) => {
    bindControl(id, render);
  });

  ["growthCapital", "growthGoal", "maxPrice", "minPrice", "riskMode", "qualityMode"].forEach((id) => {
    bindControl(id, renderGrowthScanner);
  });

  ["portfolioCapital", "portfolioGoal", "portfolioRisk"].forEach((id) => {
    bindControl(id, renderPortfolioBuilder);
  });
}

function signalClass(s) {
  s = (s || "WATCH").toUpperCase();
  if (s.includes("BUY")) return "buy";
  if (s.includes("AVOID") || s.includes("NO")) return "avoid";
  return "watch";
}

function opportunityLabel(score) {
  score = Number(score) || 0;
  if (score >= 95) return "Elite";
  if (score >= 85) return "Strong";
  if (score >= 70) return "Watch";
  return "Avoid";
}

function opportunityClass(score) {
  score = Number(score) || 0;
  if (score >= 95) return "elite";
  if (score >= 85) return "strong";
  if (score >= 70) return "watch";
  return "avoid";
}

function getAIRating(score) {
  score = Number(score) || 0;
  if (score >= 95) return { label: "A+ Elite", cls: "elite" };
  if (score >= 85) return { label: "A Strong", cls: "strong" };
  if (score >= 70) return { label: "B Watch", cls: "watch" };
  if (score >= 50) return { label: "C Spec", cls: "medium" };
  return { label: "D Avoid", cls: "low" };
}

function confidenceForStock(s) {
  const price = Number(s.price) || 0;
  const score = Number(s.trqxScore) || 0;
  const exchange = String(s.exchange || "").toUpperCase();
  const sector = String(s.sector || "").toLowerCase();
  const high52 = Number(s.high52) || 0;
  const low52 = Number(s.low52) || 0;

  let points = 0;
  let warnings = [];

  if (price >= 10) points += 25;
  else if (price >= 5) points += 18;
  else if (price >= 2) points += 10;
  else warnings.push("penny-stock risk");

  if (["NYSE", "NASDAQ"].includes(exchange)) points += 25;
  else warnings.push("non-major exchange");

  if (score >= 85) points += 25;
  else if (score >= 70) points += 15;
  else warnings.push("low TRQX score");

  if (high52 > low52 && price > 0) {
    const spread = ((high52 - low52) / price) * 100;
    if (spread < 150) points += 25;
    else if (spread < 300) points += 15;
    else warnings.push("extreme volatility");
  }

  if (sector.includes("real estate") || sector.includes("utilities") || sector.includes("consumer staples")) points += 5;

  if (points >= 85) return { label: "High", cls: "high", warnings };
  if (points >= 60) return { label: "Medium", cls: "medium", warnings };
  return { label: "Low", cls: "low", warnings };
}

function getProbability(stock, confidence) {
  const score = Number(stock.trqxScore) || 0;
  const price = Number(stock.price) || 0;
  const high52 = Number(stock.high52) || 0;
  const upside = price > 0 && high52 > price ? ((high52 - price) / price) * 100 : 0;

  let probability = 35;
  probability += score * 0.35;
  probability += Math.min(upside, 200) * 0.08;

  if (confidence.label === "High") probability += 8;
  if (confidence.label === "Medium") probability += 2;
  if (confidence.label === "Low") probability -= 12;

  if (price < 2) probability -= 20;
  if (price < 5) probability -= 8;

  return Math.max(5, Math.min(95, Math.round(probability)));
}

function probabilityClass(prob) {
  if (prob >= 80) return "high";
  if (prob >= 60) return "medium";
  return "low";
}

function getRisk(stock) {
  const price = Number(stock.price) || 0;
  const high52 = Number(stock.high52) || 0;
  const low52 = Number(stock.low52) || 0;
  const exchange = String(stock.exchange || "").toUpperCase();
  const score = Number(stock.trqxScore) || 0;

  const volatility = price > 0 && high52 > low52 ? ((high52 - low52) / price) * 100 : 0;

  if (price < 5 || volatility > 250 || !["NYSE", "NASDAQ"].includes(exchange)) {
    return { label: "Aggressive", icon: "🔴", cls: "low" };
  }

  if (price < 25 || volatility > 125 || score < 70) {
    return { label: "Moderate", icon: "🟡", cls: "medium" };
  }

  return { label: "Conservative", icon: "🟢", cls: "high" };
}

function getTimeToGoal(stock, goal = 2) {
  const price = Number(stock.price) || 0;
  const high52 = Number(stock.high52) || 0;
  const changePct = Number(stock.changesPercentage) || 0;
  const target = price * goal;

  if (!price || !high52) return "Unknown";

  if (high52 >= target && changePct > 2) return "6–18 mo";
  if (high52 >= target) return "12–36 mo";
  if (high52 >= price * 1.5) return "24–48 mo";
  return "48+ mo";
}

function whyThisStock(stock) {
  const price = Number(stock.price) || 0;
  const high52 = Number(stock.high52) || 0;
  const upside = price > 0 && high52 > price ? ((high52 - price) / price) * 100 : 0;
  const conf = confidenceForStock(stock);
  const risk = getRisk(stock);
  const rating = getAIRating(stock.trqxScore);

  return [
    `${rating.label} TRQX rating`,
    `${fmtPct(upside)} upside to 52-week high`,
    `${conf.label} confidence setup`,
    `${risk.icon} ${risk.label} risk profile`,
    `${fmtUSD(price)} current price`
  ];
}

function filtered() {
  const q = document.getElementById("search").value.toLowerCase();
  const sec = document.getElementById("sector").value;
  const sig = document.getElementById("signal").value;
  const viewMode = document.getElementById("viewMode").value;

  return stocks.filter(
    (s) =>
      (!q || s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) &&
      (!sec || s.sector === sec) &&
      (!sig || (s.signal || "").toUpperCase().includes(sig)) &&
      (viewMode !== "watchlist" || watchlist.includes(s.ticker))
  );
}

function render() {
  const data = filtered().sort((a, b) => (b.trqxScore || 0) - (a.trqxScore || 0));

  document.getElementById("rows").innerHTML = data.length
    ? data.map((s) => {
      const isWatched = watchlist.includes(s.ticker);
      const change = Number(s.change);
      const changeClass = Number.isNaN(change) ? "" : change >= 0 ? "pos" : "neg";
      const conf = confidenceForStock(s);
      const prob = getProbability(s, conf);
      const risk = getRisk(s);
      const rating = getAIRating(s.trqxScore);

      return `<tr>
        <td><button class="star ${isWatched ? "active" : ""}" onclick="toggleWatch('${s.ticker}')">${isWatched ? "★" : "☆"}</button></td>
        <td><button class="tickerBtn" onclick="openStockModal('${s.ticker}')"><b>${s.ticker}</b></button><div class="small">${s.exchange || ""}</div></td>
        <td>${s.name}</td>
        <td>${s.sector}</td>
        <td>${fmtUSD(s.price)}</td>
        <td class="${changeClass}">${s.change == null ? "—" : fmtUSD(s.change)}</td>
        <td class="${changeClass}">${s.changesPercentage == null ? "—" : fmtPct(s.changesPercentage)}</td>
        <td>${fmtUSD(s.low52)}</td>
        <td>${fmtUSD(s.high52)}</td>
        <td>${fmtPct(s.from52LowPct)}</td>
        <td>${fmtPct(s.below52HighPct)}</td>
        <td><span class="pill ${signalClass(s.signal)}">${s.signal || "WATCH"}</span></td>
        <td><span class="meter ${rating.cls}">${rating.label}</span></td>
        <td><span class="confidence ${risk.cls}">${risk.icon} ${risk.label}</span></td>
        <td><span class="confidence ${probabilityClass(prob)}">${prob}%</span></td>
        <td class="score">${s.trqxScore ?? "—"}</td>
      </tr>`;
    })
    .join("")
    : `<tr><td colspan="16" class="emptyState">No stocks match the selected filters.</td></tr>`;

  document.getElementById("kpiStocks").textContent = stocks.length;
  document.getElementById("kpiBuys").textContent = stocks.filter((s) => (s.signal || "").toUpperCase().includes("BUY")).length;
  document.getElementById("kpiWatchlist").textContent = watchlist.length;

  const avgScore = stocks.reduce((a, b) => a + (Number(b.trqxScore) || 0), 0) / stocks.length;
  document.getElementById("kpiScore").textContent = Math.round(avgScore);
  document.getElementById("kpiCost").textContent = fmtUSD(stocks.reduce((a, b) => a + (Number(b.cost100) || 0), 0));

  const top = stocks.slice().sort((a, b) => (b.trqxScore || 0) - (a.trqxScore || 0)).slice(0, 10);
  document.getElementById("topList").innerHTML = top
    .map((s) => `<div><b>${s.ticker}</b> <span class="small">${s.name}</span><div class="bar"><span style="width:${Math.min(s.trqxScore || 0, 100)}%"></span></div></div>`)
    .join("");

  updateLastUpdated();
}

function growthScore(stock, maxPrice, riskMode) {
  const price = Number(stock.price);
  const high52 = Number(stock.high52);
  const score = Number(stock.trqxScore) || 0;
  if (!price || !high52 || price <= 0 || high52 <= price) return null;

  const upsideToHighPct = ((high52 - price) / price) * 100;
  const affordabilityScore = Math.max(0, (maxPrice - price) / maxPrice) * 20;
  const upsideScore = Math.min(upsideToHighPct, 200) / 200 * 40;
  const trqxComponent = score / 100 * 25;
  const conf = confidenceForStock(stock);

  let confidenceComponent = conf.label === "High" ? 15 : conf.label === "Medium" ? 8 : -10;
  let riskBonus = 0;

  if (riskMode === "aggressive" && price <= 25) riskBonus = 8;
  if (riskMode === "moderate" && price <= 75 && score >= 70) riskBonus = 5;
  if (riskMode === "conservative" && score >= 85 && conf.label !== "Low") riskBonus = 8;

  return {
    upsideToHighPct,
    growthRank: Math.max(0, Math.round(affordabilityScore + upsideScore + trqxComponent + confidenceComponent + riskBonus)),
    confidence: conf
  };
}

function passesQuality(s, minPrice, maxPrice, riskMode, qualityMode) {
  const price = Number(s.price);
  const exchange = String(s.exchange || "").toUpperCase();
  const score = Number(s.trqxScore) || 0;
  const conf = confidenceForStock(s);

  if (!price || price < minPrice || price > maxPrice) return false;
  if (qualityMode === "majorOnly" && !["NYSE", "NASDAQ"].includes(exchange)) return false;
  if (qualityMode === "excludePenny" && price < 2) return false;
  if (qualityMode === "qualityOnly" && (conf.label === "Low" || score < 70 || !["NYSE", "NASDAQ"].includes(exchange))) return false;
  if (qualityMode === "moonshot" && !(price <= 20 && score >= 80 && ["NYSE", "NASDAQ"].includes(exchange))) return false;

  if (riskMode === "conservative") return score >= 75 && conf.label !== "Low";
  if (riskMode === "moderate") return score >= 60;
  return true;
}

function renderGrowthScanner() {
  const capital = +document.getElementById("growthCapital").value || 0;
  const goal = +document.getElementById("growthGoal").value || 2;
  const maxPrice = +document.getElementById("maxPrice").value || 25;
  const minPrice = +document.getElementById("minPrice").value || 0;
  const riskMode = document.getElementById("riskMode").value;
  const qualityMode = document.getElementById("qualityMode").value;

  const title = document.getElementById("growthTitle");
  if (title) {
    title.textContent = capital >= 1000 ? `$${Math.round(capital / 1000)}K` : fmtUSD(capital);
  }

  const targetValue = capital * goal;
  document.getElementById("growthTarget").textContent = fmtUSD(targetValue);

  const candidates = stocks
    .map((s) => {
      if (!passesQuality(s, minPrice, maxPrice, riskMode, qualityMode)) return null;

      const price = Number(s.price);
      const shares = Math.floor(capital / price);
      if (shares <= 0) return null;

      const g = growthScore(s, maxPrice, riskMode);
      if (!g) return null;

      const valueAtHigh = shares * Number(s.high52);
      const gainAtHigh = valueAtHigh - capital;
      const returnAtHighPct = (gainAtHigh / capital) * 100;
      const doublePrice = price * goal;
      const doublePossible = Number(s.high52) >= Number(doublePrice);
      const prob = getProbability(s, g.confidence);
      const risk = getRisk(s);

      let adjustedRank = g.growthRank;

      // Make dropdown changes materially affect ranking.
      if (riskMode === "conservative" && risk.label === "Conservative") adjustedRank += 12;
      if (riskMode === "conservative" && risk.label === "Aggressive") adjustedRank -= 20;
      if (riskMode === "aggressive" && doublePossible) adjustedRank += 10;
      if (riskMode === "aggressive" && price <= 10) adjustedRank += 6;
      if (qualityMode === "qualityOnly" && g.confidence.label === "High") adjustedRank += 12;
      if (qualityMode === "moonshot" && doublePossible && price <= 20) adjustedRank += 15;
      if (qualityMode === "majorOnly" && ["NYSE", "NASDAQ"].includes(String(s.exchange || "").toUpperCase())) adjustedRank += 6;

      return {
        ...s,
        shares,
        invested: shares * price,
        doublePrice,
        valueAtHigh,
        gainAtHigh,
        returnAtHighPct,
        upsideToHighPct: g.upsideToHighPct,
        growthRank: Math.max(0, Math.round(adjustedRank)),
        confidence: g.confidence,
        doublePossible,
        probability: prob,
        risk
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      // Each mode sorts differently so the visible list changes.
      if (riskMode === "conservative") {
        const riskOrder = { Conservative: 3, Moderate: 2, Aggressive: 1 };
        return (riskOrder[b.risk.label] || 0) - (riskOrder[a.risk.label] || 0) || b.growthRank - a.growthRank;
      }

      if (qualityMode === "qualityOnly") {
        const confOrder = { High: 3, Medium: 2, Low: 1 };
        return (confOrder[b.confidence.label] || 0) - (confOrder[a.confidence.label] || 0) || b.growthRank - a.growthRank;
      }

      if (qualityMode === "moonshot" || riskMode === "aggressive") {
        return b.upsideToHighPct - a.upsideToHighPct || b.growthRank - a.growthRank;
      }

      return b.growthRank - a.growthRank;
    })
    .slice(0, 12);

  document.getElementById("growthRows").innerHTML = candidates.length
    ? candidates.map((s) => {
      const warnings = s.confidence.warnings.length ? s.confidence.warnings.join(", ") : "clean setup";
      return `<tr>
        <td><b>${s.ticker}</b><div class="small">${s.name}</div></td>
        <td>${fmtUSD(s.price)}</td>
        <td>${s.shares}</td>
        <td>${fmtUSD(s.invested)}</td>
        <td>${fmtUSD(s.doublePrice)}</td>
        <td>${fmtUSD(s.high52)}</td>
        <td>${fmtPct(s.upsideToHighPct)}</td>
        <td>${fmtUSD(s.valueAtHigh)}</td>
        <td>${fmtPct(s.returnAtHighPct)}</td>
        <td><span class="meter ${s.doublePossible ? "strong" : "watch"}">${s.doublePossible ? "2x setup" : "upside play"}</span></td>
        <td><span class="confidence ${s.risk.cls}">${s.risk.icon} ${s.risk.label}</span></td>
        <td><span class="confidence ${probabilityClass(s.probability)}">${s.probability}%</span></td>
        <td>${getTimeToGoal(s, goal)}</td>
        <td class="score">${s.growthRank}</td>
      </tr>`;
    })
    .join("")
    : `<tr><td colspan="14" class="emptyState">No growth candidates match these settings. Try lowering Min Price, raising Max Price, or changing Quality to All Candidates.</td></tr>`;

  const summary = document.getElementById("growthSummary");
  if (summary) {
    const riskLabel = document.getElementById("riskMode").selectedOptions[0].textContent;
    const qualityLabel = document.getElementById("qualityMode").selectedOptions[0].textContent;
    summary.textContent = `${candidates.length} candidates shown for ${fmtUSD(capital)} capital, ${goal}x goal, ${riskLabel} risk, ${qualityLabel} quality filter.`;
  }
}
function updateLastUpdated() {
  const el = document.getElementById("lastUpdated");
  if (!el) return;
  el.textContent = lastUpdated ? `Last live refresh: ${lastUpdated}` : "Last live refresh: not yet refreshed";
}

function toggleWatch(ticker) {
  if (watchlist.includes(ticker)) watchlist = watchlist.filter((t) => t !== ticker);
  else watchlist.push(ticker);
  localStorage.setItem("trqxWatchlist", JSON.stringify(watchlist));
  render();
}

function calcIncome() {
  const p = +document.getElementById("portfolio").value || 0;
  const y = (+document.getElementById("yield").value || 0) / 100;
  document.getElementById("annualIncome").textContent = fmtUSD(p * y);
  document.getElementById("monthlyIncome").textContent = fmtUSD((p * y) / 12);
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function refreshQuotes() {
  const button = document.querySelector(".refresh");

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Refreshing...";
    }

    setStatus("Requesting live quotes from Finnhub...");

    const symbols = [...new Set(stocks.map((s) => s.ticker).filter(Boolean))];
    const chunks = chunkArray(symbols, 25);
    const allQuotes = [];

    for (let i = 0; i < chunks.length; i++) {
      setStatus(`Refreshing live data batch ${i + 1} of ${chunks.length}...`);
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(chunks[i].join(","))}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API failed: ${res.status} ${text}`);
      }
      const quotes = await res.json();
      allQuotes.push(...quotes);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    const map = Object.fromEntries(allQuotes.filter((q) => q && q.symbol && q.price).map((q) => [q.symbol, q]));
    let updated = 0;

    stocks = stocks.map((s) => {
      const q = map[s.ticker];
      if (!q) return s;
      const price = Number(q.price) || s.price;
      updated++;
      return {
        ...s,
        price,
        previousClose: q.previousClose || s.previousClose,
        change: q.change,
        changesPercentage: q.changesPercentage,
        from52LowPct: s.low52 ? ((price - s.low52) / s.low52) * 100 : s.from52LowPct,
        below52HighPct: s.high52 ? ((s.high52 - price) / s.high52) * 100 : s.below52HighPct,
        cost25: price * 25,
        cost100: price * 100
      };
    });

    lastUpdated = new Date().toLocaleTimeString();
    render();
    renderGrowthScanner();
    renderPortfolioBuilder();
    setStatus(`Live refresh complete at ${lastUpdated}. Updated ${updated} of ${stocks.length} stocks.`);
  } catch (e) {
    console.error(e);
    setStatus("Live API refresh failed. Check Vercel logs and confirm FINNHUB_API_KEY exists.");
    alert("Live API refresh failed. Confirm FINNHUB_API_KEY is added in Vercel and redeploy.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Refresh Market Data";
    }
  }
}

function toggleAutoRefresh() {
  const enabled = document.getElementById("autoRefresh").checked;
  if (enabled) {
    setStatus("Auto-refresh enabled. Refreshing every 5 minutes.");
    refreshQuotes();
    autoTimer = setInterval(refreshQuotes, 300000);
  } else {
    clearInterval(autoTimer);
    autoTimer = null;
    setStatus("Auto-refresh disabled.");
  }
}

function exportWatchlist() {
  const rows = stocks
    .filter((s) => watchlist.includes(s.ticker))
    .map((s) => ({
      ticker: s.ticker,
      company: s.name,
      sector: s.sector,
      price: s.price,
      trqxScore: s.trqxScore,
      signal: s.signal
    }));

  const csv = [
    "Ticker,Company,Sector,Price,TRQX Score,Signal",
    ...rows.map((r) => `${r.ticker},"${String(r.company).replaceAll('"', '""')}",${r.sector},${r.price},${r.trqxScore},${r.signal}`)
  ].join("\\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "trqx-watchlist.csv";
  a.click();
  URL.revokeObjectURL(url);
}

load();
