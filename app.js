let stocks = [];
let baseStocks = [];
let universeMode = localStorage.getItem("trqxUniverseMode") || "scored";
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
  stocks = normalizeUniverse(stocks);
  baseStocks = [...stocks];
  const universeSelect = document.getElementById("universeMode");
  if (universeSelect) universeSelect.value = universeMode;
  if (universeMode === "live") {
    await loadExpandedUniverse(false);
  }
  setupFilters();
  render();
  calcIncome();
  renderGrowthScanner();
  renderPortfolioBuilder();
  setStatus("TRQX AI Market Terminal loaded. Click Refresh Market Data for live prices.");
}

function setStatus(message) {
  const el = document.getElementById("status");
  if (el) el.textContent = message || "";
}


function normalizeUniverse(raw) {
  const seen = new Set();

  return raw
    .filter((s) => s && s.ticker)
    .map((s) => {
      const ticker = String(s.ticker).trim().toUpperCase();
      const exchange = String(s.exchange || guessExchange(ticker)).toUpperCase();
      const price = Number(s.price) || null;
      const low52 = Number(s.low52) || null;
      const high52 = Number(s.high52) || null;

      return {
        sector: s.sector || "Unclassified",
        name: s.name || ticker,
        ticker,
        exchange,
        symbol: s.symbol || `${exchange}:${ticker}`,
        low52,
        high52,
        price,
        previousClose: Number(s.previousClose) || null,
        from52LowPct: Number(s.from52LowPct) || (price && low52 ? ((price - low52) / low52) * 100 : null),
        below52HighPct: Number(s.below52HighPct) || (price && high52 ? ((high52 - price) / high52) * 100 : null),
        signal: s.signal || "WATCH",
        cost25: Number(s.cost25) || (price ? price * 25 : null),
        cost100: Number(s.cost100) || (price ? price * 100 : null),
        trqxScore: Number(s.trqxScore) || baseScoreFromRange(price, low52, high52)
      };
    })
    .filter((s) => {
      if (seen.has(s.ticker)) return false;
      seen.add(s.ticker);
      return true;
    });
}

function guessExchange(ticker) {
  // Default to NASDAQ for symbols without exchange data.
  // Finnhub still accepts bare U.S. tickers in most cases.
  return "NASDAQ";
}

function baseScoreFromRange(price, low52, high52) {
  if (!price || !low52 || !high52 || high52 <= low52) return 50;

  const fromLow = ((price - low52) / low52) * 100;
  const belowHigh = ((high52 - price) / high52) * 100;

  let score = 50;
  if (fromLow <= 5) score += 35;
  else if (fromLow <= 15) score += 25;
  else if (fromLow <= 30) score += 15;

  if (belowHigh >= 25) score += 15;
  else if (belowHigh >= 10) score += 8;

  return Math.max(1, Math.min(100, Math.round(score)));
}

function updateUniverseMeta() {
  // Customer-facing UI hides internal universe count.
}


function mergeUniverses(primary, secondary) {
  const map = new Map();

  [...secondary, ...primary].forEach((s) => {
    if (!s || !s.ticker) return;
    map.set(String(s.ticker).toUpperCase(), s);
  });

  return [...map.values()];
}

async function changeUniverseMode() {
  const el = document.getElementById("universeMode");
  universeMode = el ? el.value : "scored";
  localStorage.setItem("trqxUniverseMode", universeMode);

  if (universeMode === "live") {
    await loadExpandedUniverse();
  } else {
    stocks = [...baseStocks];
    refreshAllViews();
    setStatus("TRQX scored universe loaded.");
  }
}

async function loadExpandedUniverse(showStatus = true) {
  try {
    if (showStatus) setStatus("Loading expanded U.S. market universe from Finnhub...");

    const res = await fetch("/api/symbols");

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Symbol API failed: ${res.status} ${text}`);
    }

    const liveSymbols = normalizeUniverse(await res.json());

    stocks = mergeUniverses(baseStocks, liveSymbols);
    localStorage.setItem("trqxUniverseMode", "live");
    universeMode = "live";

    const el = document.getElementById("universeMode");
    if (el) el.value = "live";

    refreshAllViews();

    if (showStatus) {
      setStatus(`Expanded universe loaded: ${stocks.length.toLocaleString()} symbols. Use filters/search, then refresh market data for live pricing.`);
    }
  } catch (error) {
    console.error(error);
    setStatus("Expanded universe failed to load. Confirm FINNHUB_API_KEY exists and redeploy.");
    alert("Expanded universe failed to load. Confirm FINNHUB_API_KEY exists in Vercel and redeploy.");
  }
}

function refreshAllViews() {
  setupFilters();
  render();
  calcIncome();
  renderGrowthScanner();
  renderPortfolioBuilder();
  updateInsights();
}


function updateInsights() {
  const bullish = stocks.filter((s) => String(s.signal || "").toUpperCase().includes("BUY")).length;
  const elite = stocks.filter((s) => Number(s.trqxScore) >= 95).length;
  const highProb = stocks.filter((s) => {
    const conf = confidenceForStock(s);
    return getProbability(s, conf) >= 80;
  }).length;

  const bullishEl = document.getElementById("bullishCount");
  const eliteEl = document.getElementById("eliteCount");
  const highProbEl = document.getElementById("highProbCount");
  const regimeEl = document.getElementById("marketRegime");

  if (bullishEl) bullishEl.textContent = bullish.toLocaleString();
  if (eliteEl) eliteEl.textContent = elite.toLocaleString();
  if (highProbEl) highProbEl.textContent = highProb.toLocaleString();

  if (regimeEl) {
    const ratio = stocks.length ? bullish / stocks.length : 0;
    let label = "Neutral";
    let cls = "neutral";
    if (ratio >= 0.58) {
      label = "Bullish";
      cls = "bullish";
    } else if (ratio <= 0.38) {
      label = "Bearish";
      cls = "bearish";
    }

    regimeEl.textContent = `Market Regime: ${label}`;
    regimeEl.className = `marketBadge ${cls}`;
  }
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

  if (sel) {
    const current = sel.value;
    sel.innerHTML = `<option value="">All sectors</option>`;
    sectors.forEach((s) => sel.insertAdjacentHTML("beforeend", `<option>${s}</option>`));
    if ([...sel.options].some((o) => o.value === current)) sel.value = current;
  }

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

function getScannerMode(mode) {
  if (mode === "aggressive") return { label: "Aggressive", icon: "🔴", cls: "low" };
  if (mode === "conservative") return { label: "Conservative", icon: "🟢", cls: "high" };
  return { label: "Moderate", icon: "🟡", cls: "medium" };
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


function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}


function dataQualityForStock(stock) {
  const hasPrice = Number(stock.price) > 0;
  const hasRange = Number(stock.low52) > 0 && Number(stock.high52) > 0;
  const isLikelyOTC = String(stock.ticker || "").length >= 5 || String(stock.name || "").toUpperCase().includes("OTC");

  if (hasPrice && hasRange) {
    return {
      label: "Live Data Available",
      cls: "high",
      icon: "🟢",
      note: "Live price and 52-week range are available."
    };
  }

  if (hasPrice && !hasRange) {
    return {
      label: "Limited Data",
      cls: "medium",
      icon: "🟡",
      note: "Live price is available, but 52-week range data is limited."
    };
  }

  if (isLikelyOTC) {
    return {
      label: "Limited OTC Coverage",
      cls: "low",
      icon: "🔴",
      note: "This appears to be a micro-cap, OTC, warrant, ADR, or thinly covered security. Live data may be unavailable."
    };
  }

  return {
    label: "No Live Coverage",
    cls: "low",
    icon: "🔴",
    note: "Live quote coverage is unavailable from the current data provider."
  };
}

async function fetchLiveQuoteForLookup(stock) {
  if (!stock || !stock.ticker) return stock;

  try {
    const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(stock.ticker)}`);
    if (!res.ok) return stock;

    const data = await res.json();
    const q = Array.isArray(data) ? data.find((x) => String(x.symbol).toUpperCase() === stock.ticker) : null;

    if (!q || !q.price) return stock;

    const updated = {
      ...stock,
      price: Number(q.price) || stock.price,
      previousClose: Number(q.previousClose) || stock.previousClose,
      change: q.change,
      changesPercentage: q.changesPercentage
    };

    // Update master universe so other modules benefit too.
    stocks = stocks.map((s) => String(s.ticker).toUpperCase() === stock.ticker ? updated : s);

    return updated;
  } catch (error) {
    console.warn("Lookup quote refresh failed:", error);
    return stock;
  }
}

function findStockByQuery(query) {
  const q = String(query || "").trim().toUpperCase();
  if (!q) return null;

  return stocks.find((s) => String(s.ticker || "").toUpperCase() === q)
    || stocks.find((s) => String(s.name || "").toUpperCase().includes(q))
    || null;
}

function explainStock(stock) {
  const price = Number(stock.price) || 0;
  const low52 = Number(stock.low52) || 0;
  const high52 = Number(stock.high52) || 0;
  const score = Number(stock.trqxScore) || 0;
  const conf = confidenceForStock(stock);
  const prob = getProbability(stock, conf);
  const risk = getRisk(stock);
  const rating = getAIRating(score);
  const quality = dataQualityForStock(stock);

  const upside = price && high52 ? ((high52 - price) / price) * 100 : null;
  const fromLow = price && low52 ? ((price - low52) / low52) * 100 : null;

  const reasons = [];

  if (score >= 90) reasons.push("Strong TRQX AI score compared with the current universe.");
  else if (score >= 70) reasons.push("Healthy TRQX AI score with a watchable setup.");
  else reasons.push("Lower TRQX AI score, so this should be treated cautiously.");

  if (quality.cls === "low") {
    reasons.push("Live market-data coverage is limited, so the analysis should be treated as preliminary.");
  }

  if (upside != null && upside >= 30) reasons.push(`Meaningful upside to the 52-week high: ${fmtPct(upside)}.`);
  else if (upside != null && upside >= 10) reasons.push(`Moderate upside to the 52-week high: ${fmtPct(upside)}.`);
  else if (upside != null) reasons.push("Limited upside to the 52-week high based on current range.");
  else reasons.push("52-week range data is not available yet, so upside-to-high cannot be calculated.");

  if (fromLow != null && fromLow <= 15) reasons.push("Price is near the 52-week low, which may appeal to value/reversal traders.");
  else if (fromLow != null && fromLow >= 75) reasons.push("Price is extended from the 52-week low, which can increase pullback risk.");
  else if (fromLow != null) reasons.push("Price is trading in a middle range versus its 52-week low/high structure.");

  if (risk.label === "Aggressive") {
    reasons.push("Risk profile is aggressive. Position sizing and stop discipline matter more for this type of setup.");
  }

  return { rating, prob, risk, conf, upside, fromLow, reasons, quality };
}

async function runStockLookup() {
  const input = document.getElementById("stockLookupInput");
  const result = document.getElementById("stockLookupResult");
  if (!input || !result) return;

  const q = input.value.trim();
  if (!q) {
    result.innerHTML = `<div class="emptyState">Enter a ticker symbol or company name first.</div>`;
    return;
  }

  let stock = findStockByQuery(q);

  if (!stock) {
    result.innerHTML = `<div class="emptyState">No match found for "${q}". Try the ticker symbol, switch to Expanded Live U.S. Universe, or load the expanded universe first.</div>`;
    return;
  }

  result.innerHTML = `<div class="emptyState">Analyzing ${stock.ticker} and checking live market data...</div>`;

  stock = await fetchLiveQuoteForLookup(stock);

  const analysis = explainStock(stock);
  const signal = stock.signal || "WATCH";
  const quality = analysis.quality;

  result.innerHTML = `
    <div class="lookupCard">
      <div class="lookupTitleRow">
        <div>
          <div class="eyebrow">TRQX AI STOCK ANALYSIS</div>
          <h3>${stock.ticker} — ${stock.name}</h3>
          <p class="small">${stock.sector || "Unclassified"} • ${stock.exchange || "US"}</p>
        </div>
        <div class="dataQuality ${quality.cls}">
          <b>${quality.icon} ${quality.label}</b>
          <span>${quality.note}</span>
        </div>
      </div>

      <div class="lookupStats">
        <div><span>Price</span><b>${fmtUSD(stock.price)}</b></div>
        <div><span>TRQX Rating</span><b>${analysis.rating.label}</b></div>
        <div><span>Signal</span><b>${signal}</b></div>
        <div><span>Risk</span><b>${analysis.risk.icon} ${analysis.risk.label}</b></div>
        <div><span>Probability</span><b>${analysis.prob}%</b></div>
        <div><span>52W Upside</span><b>${analysis.upside == null ? "—" : fmtPct(analysis.upside)}</b></div>
      </div>

      <div class="whyBox">
        <h4>Why this stock?</h4>
        <ul>${analysis.reasons.map((r) => `<li>${r}</li>`).join("")}</ul>
      </div>

      <div class="disclaimerBox">
        Educational research only. This is not financial advice or a guaranteed investment outcome.
      </div>
    </div>
  `;

  render();
  renderGrowthScanner();
  renderPortfolioBuilder();
}


function applyPreset(type) {
  const search = document.getElementById("search");
  const sector = document.getElementById("sector");
  const signal = document.getElementById("signal");
  const viewMode = document.getElementById("viewMode");
  const minPrice = document.getElementById("minPrice");
  const maxPrice = document.getElementById("maxPrice");
  const riskMode = document.getElementById("riskMode");
  const qualityMode = document.getElementById("qualityMode");

  if (search) search.value = "";
  if (sector) sector.value = "";
  if (signal) signal.value = "";
  if (viewMode) viewMode.value = "all";

  const configs = {
    growth: { signal: "BUY", quality: "qualityOnly", risk: "moderate", min: 5, max: 350 },
    dividend: { sector: "Real Estate", signal: "BUY", quality: "qualityOnly", risk: "conservative", min: 2, max: 300 },
    undervalued: { signal: "BUY", quality: "qualityOnly", risk: "moderate", min: 2, max: 500 },
    under25: { signal: "BUY", quality: "excludePenny", risk: "moderate", min: 2, max: 25 },
    highProbability: { signal: "BUY", quality: "qualityOnly", risk: "conservative", min: 5, max: 500 },
    aggressive: { signal: "BUY", quality: "all", risk: "aggressive", min: 2, max: 25 }
  };

  const cfg = configs[type];
  if (!cfg) return;

  if (sector && cfg.sector) sector.value = cfg.sector;
  if (signal) signal.value = cfg.signal;
  if (qualityMode) qualityMode.value = cfg.quality;
  if (riskMode) riskMode.value = cfg.risk;
  if (minPrice) minPrice.value = cfg.min;
  if (maxPrice) maxPrice.value = cfg.max;

  render();
  renderGrowthScanner();
  renderPortfolioBuilder();
  scrollToSection("growthScannerPanel");
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

  updateUniverseMeta();
  updateInsights();
  
  

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
  const scannerMode = getScannerMode(riskMode);

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
        <td><span class="confidence ${scannerMode.cls}">${scannerMode.icon} ${scannerMode.label}</span></td>
        <td><span class="confidence ${probabilityClass(s.probability)}">${s.probability}%</span></td>
        <td>${getTimeToGoal(s, goal)}</td>
        <td class="score">${s.growthRank}</td>
      </tr>`;
    })
    .join("")
    : `<tr><td colspan="15" class="emptyState">No growth candidates match these settings. Try lowering Min Price, raising Max Price, or changing Quality to All Candidates.</td></tr>`;

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

    let sourceForRefresh = filtered();

    // Expanded universes can contain thousands of symbols. Refresh visible/filter-matched symbols first
    // to avoid rate limits and slow browser/API performance.
    if (universeMode === "live" && !document.getElementById("search").value && !document.getElementById("sector").value && !document.getElementById("signal").value) {
      sourceForRefresh = stocks.slice(0, 250);
      setStatus("Expanded universe mode: refreshing the first 250 symbols. Use search or filters to refresh specific names.");
    }

    const symbols = [...new Set(sourceForRefresh.map((s) => s.ticker).filter(Boolean))].slice(0, 250);
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

function renderPortfolioBuilder() {
  const capitalEl = document.getElementById("portfolioCapital");
  const goalEl = document.getElementById("portfolioGoal");
  const riskEl = document.getElementById("portfolioRisk");
  const rowsEl = document.getElementById("portfolioRows");
  const summaryEl = document.getElementById("portfolioSummary");

  if (!capitalEl || !goalEl || !riskEl || !rowsEl || !summaryEl) return;

  const capital = +capitalEl.value || 0;
  const goal = goalEl.value;
  const risk = riskEl.value;

  let candidates = stocks.filter((s) => Number(s.price) > 0);

  if (goal === "income") {
    candidates = candidates.filter((s) => {
      const sector = String(s.sector || "").toLowerCase();
      return (
        sector.includes("real estate") ||
        sector.includes("utilities") ||
        sector.includes("consumer staples") ||
        sector.includes("energy") ||
        Number(s.trqxScore) >= 70
      );
    });
  }

  if (goal === "growth") {
    candidates = candidates.filter((s) => Number(s.trqxScore) >= 65);
  }

  if (goal === "balanced") {
    candidates = candidates.filter((s) => Number(s.trqxScore) >= 55);
  }

  if (risk === "conservative") {
    candidates = candidates.filter((s) => {
      const r = getRisk(s).label;
      return r !== "Aggressive" && Number(s.trqxScore) >= 65;
    });
  }

  if (risk === "moderate") {
    candidates = candidates.filter((s) => Number(s.trqxScore) >= 55);
  }

  if (risk === "aggressive") {
    candidates = candidates.filter((s) => {
      const price = Number(s.price);
      const score = Number(s.trqxScore) || 0;
      return price > 0 && price <= 350 && score >= 50;
    });
  }

  let fallbackUsed = false;
  if (!candidates.length) {
    fallbackUsed = true;
    candidates = stocks
      .filter((s) => Number(s.price) > 0)
      .filter((s) => Number(s.trqxScore) >= 50);
  }

  candidates = candidates
    .sort((a, b) => {
      const pa = getProbability(a, confidenceForStock(a));
      const pb = getProbability(b, confidenceForStock(b));
      return pb - pa || (Number(b.trqxScore) || 0) - (Number(a.trqxScore) || 0);
    })
    .slice(0, 5);

  const weights = candidates.length ? candidates.map((_, i) => [30, 25, 20, 15, 10][i] || 10) : [];
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  rowsEl.innerHTML = candidates.length
    ? candidates.map((s, i) => {
      const allocationPct = weights[i] / totalWeight;
      const dollars = capital * allocationPct;
      const shares = Math.floor(dollars / Number(s.price));
      const prob = getProbability(s, confidenceForStock(s));
      const riskObj = getRisk(s);

      return `<tr>
        <td><button class="tickerBtn" onclick="openStockModal('${s.ticker}')"><b>${s.ticker}</b></button><div class="small">${s.name}</div></td>
        <td>${fmtPct(allocationPct * 100)}</td>
        <td>${fmtUSD(dollars)}</td>
        <td>${shares}</td>
        <td><span class="confidence ${riskObj.cls}">${riskObj.icon} ${riskObj.label}</span></td>
        <td><span class="confidence ${probabilityClass(prob)}">${prob}%</span></td>
      </tr>`;
    })
    .join("")
    : `<tr><td colspan="6" class="emptyState">No priced stocks are available yet. Click Refresh Market Data or switch back to TRQX Scored Universe.</td></tr>`;

  const avgProb = candidates.length
    ? Math.round(candidates.reduce((a, s) => a + getProbability(s, confidenceForStock(s)), 0) / candidates.length)
    : 0;

  const goalLabel = goalEl.selectedOptions[0].textContent;
  const riskLabel = riskEl.selectedOptions[0].textContent;

  summaryEl.textContent = candidates.length
    ? `${fallbackUsed ? "Fallback portfolio shown because the selected filters were too restrictive. " : ""}Suggested ${goalLabel} / ${riskLabel} portfolio using ${fmtUSD(capital)}. Average probability score: ${avgProb}%.`
    : "No priced portfolio candidates available. Expanded universe symbols need live price data before portfolio construction.";
}


