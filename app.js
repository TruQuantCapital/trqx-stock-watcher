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
  renderTopAIPicks();
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

function isMajorExchange(exchange) {
  const e = String(exchange || "").toUpperCase();
  return ["NYSE", "NASDAQ", "NYSE AMERICAN", "AMEX", "NYSEARCA", "ARCA", "BATS", "CBOE"].includes(e);
}

function guessExchange(ticker) {
  return "UNKNOWN";
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
  renderTopAIPicks();
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

  if (isMajorExchange(exchange)) points += 25;
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

  if (price < 5 || volatility > 250 || !isMajorExchange(exchange)) {
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
  const q = (document.getElementById("search")?.value || "").toLowerCase();
  const sec = document.getElementById("sector")?.value || "";
  const sig = document.getElementById("signal")?.value || "";
  const viewMode = document.getElementById("viewMode")?.value || "all";

  return stocks.filter(
    (s) =>
      (!q || s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) &&
      (!sec || s.sector === sec) &&
      (!sig || (s.signal || "").toUpperCase().includes(sig)) &&
      (viewMode !== "watchlist" || watchlist.includes(s.ticker))
  );
}


function navTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollTo(id) { navTo(id); }
function scrollToSection(id) { navTo(id); }



function dataQualityForStock(stock) {
  const hasPrice = Number(stock.price) > 0;
  const hasRange = Number(stock.low52) > 0 && Number(stock.high52) > 0;
  const symbol = String(stock.ticker || "").toUpperCase();
  const name = String(stock.name || "").toUpperCase();
  const isLikelyOTC = symbol.length >= 5 || name.includes("OTC") || name.includes("WARRANT") || name.includes("ADR");

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

function aiVerdict(score, risk, probability, quality) {
  if (quality.cls === "low") return { label: "WATCH ONLY", cls: "watch", note: "Limited live data coverage." };
  if (score >= 90 && probability >= 85 && risk.label !== "Aggressive") return { label: "STRONG BUY WATCH", cls: "buy", note: "High-quality setup with strong model alignment." };
  if (score >= 75 && probability >= 70) return { label: "BUY WATCH", cls: "buy", note: "Positive setup, but confirmation is still required." };
  if (score >= 55) return { label: "WATCH", cls: "watch", note: "Neutral setup. Needs stronger confirmation." };
  return { label: "AVOID / HIGH CAUTION", cls: "avoid", note: "Weak score or insufficient data." };
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
  const verdict = aiVerdict(score, risk, prob, quality);

  const upside = price && high52 ? ((high52 - price) / price) * 100 : null;
  const fromLow = price && low52 ? ((price - low52) / low52) * 100 : null;

  const reasons = [];
  const risks = [];
  const confirmations = [];

  if (score >= 90) reasons.push("Strong TRQX AI score compared with the current universe.");
  else if (score >= 70) reasons.push("Healthy TRQX AI score with a watchable setup.");
  else reasons.push("Lower TRQX AI score, so this should be treated cautiously.");

  if (quality.cls === "low") {
    reasons.push("Live market-data coverage is limited, so the analysis should be treated as preliminary.");
    risks.push("Limited data coverage can reduce reliability of the rating.");
  }

  if (upside != null && upside >= 30) reasons.push(`Meaningful upside to the 52-week high: ${fmtPct(upside)}.`);
  else if (upside != null && upside >= 10) reasons.push(`Moderate upside to the 52-week high: ${fmtPct(upside)}.`);
  else if (upside != null) risks.push("Limited upside to the 52-week high based on current range.");
  else risks.push("52-week range data is unavailable, so upside-to-high cannot be calculated.");

  if (fromLow != null && fromLow <= 15) reasons.push("Price is near the 52-week low, which may appeal to value/reversal traders.");
  else if (fromLow != null && fromLow >= 75) risks.push("Price is extended from the 52-week low, which can increase pullback risk.");
  else if (fromLow != null) confirmations.push("Price is trading in a middle range versus its 52-week low/high structure.");

  if (risk.label === "Aggressive") risks.push("Aggressive risk profile. Position sizing and stop discipline matter more.");
  if (prob >= 80) confirmations.push("Probability model is showing above-average confidence.");
  if (score >= 80) confirmations.push("TRQX score supports a higher-quality watchlist candidate.");
  if (!confirmations.length) confirmations.push("Wait for stronger price action, volume, and trend confirmation.");

  const horizon = risk.label === "Aggressive" ? "3–12 months" : score >= 80 ? "12–24 months" : "24+ months";

  return { rating, prob, risk, conf, upside, fromLow, reasons, risks, confirmations, quality, verdict, horizon };
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
  const change = Number(stock.changesPercentage);
  const changeTxt = Number.isFinite(change) ? `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(2)}%` : "—";

  result.innerHTML = `
    <div class="lookupCard premiumReport">
      <div class="lookupTitleRow">
        <div>
          <div class="eyebrow">TRQX AI STOCK REPORT</div>
          <h3>${stock.ticker} — ${stock.name}</h3>
          <p class="small">${stock.sector || "Unclassified"} • ${stock.exchange || "US"}</p>
          <div class="reportPrice">${fmtUSD(stock.price)} <span class="${change >= 0 ? "positive" : "negative"}">${changeTxt}</span></div>
        </div>
        <div class="verdictBox ${analysis.verdict.cls}">
          <span>TRQX AI Verdict</span>
          <b>${analysis.verdict.label}</b>
          <small>${analysis.verdict.note}</small>
        </div>
      </div>

      <div class="lookupStats">
        <div><span>TRQX Rating</span><b>${analysis.rating.label}</b></div>
        <div><span>Signal</span><b>${signal}</b></div>
        <div><span>Risk</span><b>${analysis.risk.icon} ${analysis.risk.label}</b></div>
        <div><span>Probability</span><b>${analysis.prob}%</b></div>
        <div><span>52W Upside</span><b>${analysis.upside == null ? "—" : fmtPct(analysis.upside)}</b></div>
        <div><span>Time Horizon</span><b>${analysis.horizon}</b></div>
      </div>

      <div class="reportGrid">
        <div class="whyBox">
          <h4>Why TRQX is watching it</h4>
          <ul>${analysis.reasons.map((r) => `<li>${r}</li>`).join("")}</ul>
        </div>

        <div class="riskBox">
          <h4>Risk Notes</h4>
          <ul>${analysis.risks.map((r) => `<li>${r}</li>`).join("")}</ul>
        </div>

        <div class="confirmBox">
          <h4>Confirmation Checklist</h4>
          <ul>${analysis.confirmations.map((r) => `<li>${r}</li>`).join("")}</ul>
        </div>
      </div>

      <div class="dataQuality ${quality.cls}">
        <b>${quality.icon} ${quality.label}</b>
        <span>${quality.note}</span>
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
  
  

  const topListEl = document.getElementById("topList");
  if (topListEl) {
    const top = stocks.slice().sort((a, b) => (b.trqxScore || 0) - (a.trqxScore || 0)).slice(0, 10);
    topListEl.innerHTML = top
      .map((s) => `<div><b>${s.ticker}</b> <span class="small">${s.name}</span><div class="bar"><span style="width:${Math.min(s.trqxScore || 0, 100)}%"></span></div></div>`)
      .join("");
  }

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
  if (qualityMode === "majorOnly" && !isMajorExchange(exchange)) return false;
  if (qualityMode === "excludePenny" && price < 2) return false;
  if (qualityMode === "qualityOnly" && (conf.label === "Low" || score < 70 || !isMajorExchange(exchange))) return false;
  if (qualityMode === "moonshot" && !(price <= 20 && score >= 80 && isMajorExchange(exchange))) return false;

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
      if (qualityMode === "majorOnly" && isMajorExchange(s.exchange)) adjustedRank += 6;

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
    ? candidates.map((s, idx) => {
      return `<tr>
        <td><b>${s.ticker}</b><div class="small">${s.name.slice(0,22)}</div></td>
        <td>${fmtUSD(s.price)}</td>
        <td>${s.shares}</td>
        <td>${fmtUSD(s.invested)}</td>
        <td>${fmtUSD(s.doublePrice)}</td>
        <td>${fmtUSD(s.high52)}</td>
        <td>${fmtPct(s.upsideToHighPct)}</td>
        <td class="score">${s.growthRank}</td>
        <td><span class="confidence ${s.risk.cls}">${s.risk.icon} ${s.risk.label}</span></td>
        <td><span class="meter ${s.doublePossible ? "strong" : "watch"}">${s.doublePossible ? "2x Setup" : "Upside"}</span></td>
        <td><span class="confidence ${probabilityClass(s.probability)}">${s.probability}%</span></td>
        <td>${getTimeToGoal(s, goal)}</td>
        <td class="score">${idx + 1}</td>
      </tr>`;
    })
    .join("")
    : `<tr><td colspan="13" class="emptyState">No growth candidates match these settings. Try lowering Min Price, raising Max Price, or changing Quality to All Candidates.</td></tr>`;

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
  const portfolioEl = document.getElementById("portfolio");
  const yieldEl = document.getElementById("yield");
  const annualEl = document.getElementById("annualIncome");
  const monthlyEl = document.getElementById("monthlyIncome");
  if (!portfolioEl || !yieldEl || !annualEl || !monthlyEl) return;

  const p = +portfolioEl.value || 0;
  const y = (+yieldEl.value || 0) / 100;
  annualEl.textContent = fmtUSD(p * y);
  monthlyEl.textContent = fmtUSD((p * y) / 12);
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
    renderTopAIPicks();
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
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "trqx-watchlist.csv";
  a.click();
  URL.revokeObjectURL(url);
}

load();
fetchMarketStrip();

function openStockModal(ticker) {
  const stock = stocks.find((s) => s.ticker === ticker);
  const modal = document.getElementById("modal");
  const content = document.getElementById("modalContent");
  if (!stock || !modal || !content) return;

  const conf = confidenceForStock(stock);
  const prob = getProbability(stock, conf);
  const risk = getRisk(stock);
  const rating = getAIRating(stock.trqxScore);
  const reasons = whyThisStock(stock);

  content.innerHTML = `
    <div class="eyebrow" style="margin-bottom:10px">TRQX AI STOCK REPORT</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:14px">
      <div>
        <h2 style="font-size:22px;margin-bottom:4px">${stock.ticker} — ${stock.name}</h2>
        <p style="color:var(--muted);margin-bottom:8px">${stock.sector || "—"} • ${stock.exchange || "US"}</p>
        <div style="font-size:30px;font-weight:900">${fmtUSD(stock.price)}</div>
      </div>
      <div class="verdictBox ${rating.cls === 'elite' || rating.cls === 'strong' ? 'buy' : rating.cls === 'medium' ? 'watch' : 'avoid'}">
        <span>TRQX AI VERDICT</span>
        <b>${rating.label}</b>
        <small>Score: ${stock.trqxScore ?? "—"}</small>
      </div>
    </div>
    <div class="lookupStats" style="grid-template-columns:repeat(4,1fr)">
      <div><span>Signal</span><b>${stock.signal || "WATCH"}</b></div>
      <div><span>Risk</span><b>${risk.icon} ${risk.label}</b></div>
      <div><span>Probability</span><b>${prob}%</b></div>
      <div><span>52W Upside</span><b>${stock.high52 && stock.price ? fmtPct(((stock.high52 - stock.price) / stock.price) * 100) : "—"}</b></div>
    </div>
    <div class="whyBox" style="margin-top:14px">
      <h4>Why TRQX is watching it</h4>
      <ul>${reasons.map((r) => `<li>${r}</li>`).join("")}</ul>
    </div>
    <p class="disclaimerBox" style="margin-top:12px">Educational research only. Not financial advice or a guaranteed outcome.</p>
  `;

  modal.classList.remove("hidden");
}

function closeStockModal() {
  const modal = document.getElementById("modal");
  if (modal) modal.classList.add("hidden");
}

// Close modal on overlay click
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("modal");
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeStockModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeStockModal(); });
});

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



// ============================================================
// TRQX AI MARKET ANALYST — Claude-powered chat backend
// ============================================================

function buildStockContext() {
  const summary = stocks.slice().sort((a, b) => (Number(b.trqxScore) || 0) - (Number(a.trqxScore) || 0)).slice(0, 250).map((s) => {
    const conf = confidenceForStock(s);
    const prob = getProbability(s, conf);
    const risk = getRisk(s);
    return {
      ticker: s.ticker,
      name: s.name,
      sector: s.sector,
      exchange: s.exchange,
      price: s.price,
      low52: s.low52,
      high52: s.high52,
      from52LowPct: s.from52LowPct != null ? +Number(s.from52LowPct).toFixed(1) : null,
      below52HighPct: s.below52HighPct != null ? +Number(s.below52HighPct).toFixed(1) : null,
      signal: s.signal,
      trqxScore: s.trqxScore,
      probability: prob,
      risk: risk.label,
    };
  });
  return JSON.stringify(summary);
}

function buildSystemPrompt() {
  const ctx = buildStockContext();
  return `You are the TRQX AI Market Analyst — an expert financial research assistant embedded in the TRQX AI Market Terminal. You help traders and investors understand the stocks in the TRQX universe, find opportunities, and interpret market data.

You have full access to the current TRQX stock universe data below. Use this data to give specific, data-driven answers. Always refer to real tickers from the universe when relevant.

TRQX Universe Data (JSON):
${ctx}

Key scoring context:
- TRQX Score: 0-100. 95+ = Elite, 85-94 = Strong, 70-84 = Watch, 50-69 = Speculative, <50 = Avoid
- Signal: BUY = strong setup, WATCH = monitor, AVOID/NO = do not enter
- Probability: model-based likelihood of upside to 52-week high (not guaranteed)
- Risk: Conservative = low volatility large cap, Moderate = mid range, Aggressive = high volatility/small cap

When referencing stocks, use ticker symbols in backticks like \`AAPL\`. Be specific — cite actual tickers, scores, prices, and setups from the data. Keep answers focused and practical for a trader audience.

IMPORTANT: This is educational analysis only. Always note this is not financial advice and past performance does not guarantee future results. Keep responses concise but thorough — use bullet points for lists of stocks.`;
}

let chatHistory = [];

async function sendAIMessage() {
  const input = document.getElementById("aiChatInput");
  const btn = document.getElementById("aiSendBtn");
  if (!input || !btn) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  addChatMessage("user", text);
  chatHistory.push({ role: "user", content: text });

  btn.disabled = true;
  btn.textContent = "Thinking...";

  const typingId = showTyping();

  try {
    // Route through /api/chat Vercel serverless proxy to avoid CORS.
    // Set ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables.
    const response = await fetch("/api/chat?v=19.5", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: buildSystemPrompt(),
        messages: chatHistory,
        max_tokens: 1000
      })
    });

    removeTyping(typingId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "API error " + response.status);
    }

    const data = await response.json();
    const reply = (data.content && data.content[0] && data.content[0].text) || "I could not generate a response. Please try again.";

    chatHistory.push({ role: "assistant", content: reply });
    if (chatHistory.length > 24) chatHistory = chatHistory.slice(-24);

    addChatMessage("ai", reply);

  } catch (err) {
    removeTyping(typingId);
    console.error("AI chat error:", err);
    addChatMessage(
      "ai",
      "TRQX AI could not reach the live AI route. Backend message: " +
        err.message +
        ". Check Vercel → Project → Settings → Environment Variables. Required: ANTHROPIC_API_KEY. Optional: ANTHROPIC_MODEL=claude-sonnet-4-6. Then redeploy Production."
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Ask AI \u2746";
  }
}

function askAI(prompt) {
  const input = document.getElementById("aiChatInput");
  if (input) { input.value = prompt; }
  sendAIMessage();
}

function addChatMessage(role, text) {
  const container = document.getElementById("aiChatMessages");
  if (!container) return;

  const div = document.createElement("div");
  div.className = "msg " + role;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "ai" ? "\u265b" : "\ud83d\udc64";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = formatAIMessage(text);

  div.appendChild(avatar);
  div.appendChild(bubble);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function formatAIMessage(text) {
  return text
    .replace(/`([A-Z]{1,6})`/g, '<span class="ticker-tag">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-\u2022]\s+(.+)/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, function(m){ return '<ul>' + m + '</ul>'; })
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

let typingCounter = 0;

function showTyping() {
  const id = "typing-" + (++typingCounter);
  const container = document.getElementById("aiChatMessages");
  if (!container) return id;

  const div = document.createElement("div");
  div.className = "msg ai";
  div.id = id;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "\u265b";

  const typing = document.createElement("div");
  typing.className = "ai-typing";
  typing.innerHTML = "<span></span><span></span><span></span>";

  div.appendChild(avatar);
  div.appendChild(typing);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ============================================================
// LIVE MARKET STRIP — ETF proxies via Finnhub (free tier)
// SPY ≈ S&P 500, QQQ ≈ NASDAQ 100, DIA ≈ DOW, GLD ≈ Gold, IWM via Finnhub crypto
// ============================================================

// Market strip — dedicated /api/market route handles ETFs + IWM


function bindAutoRefreshControl() {
  const auto = document.getElementById("autoRefresh");
  if (auto && !auto.dataset.bound) {
    auto.dataset.bound = "true";
    auto.addEventListener("change", toggleAutoRefresh);
  }
}

document.addEventListener("DOMContentLoaded", bindAutoRefreshControl);


// Keep top market strip fresh.





function renderTopAIPicks() {
  const el = document.getElementById("topAIPicks");
  if (!el || !Array.isArray(stocks)) return;
  const picks = stocks
    .filter((s) => Number(s.price) > 0 || Number(s.trqxScore) > 0)
    .slice()
    .sort((a, b) => ((Number(b.trqxScore) || 0) + (Number(b.price) > 0 ? 5 : 0)) - ((Number(a.trqxScore) || 0) + (Number(a.price) > 0 ? 5 : 0)))
    .slice(0, 5);
  if (!picks.length) {
    el.innerHTML = `<div class="emptyState">Refresh market data to load top AI picks.</div>`;
    return;
  }
  el.innerHTML = picks.map((s, i) => {
    const score = Number(s.trqxScore) || 0;
    const signal = s.signal || (score >= 85 ? "BUY" : score >= 70 ? "WATCH" : "REVIEW");
    const conf = typeof confidenceForStock === "function" ? confidenceForStock(s) : { label: "Medium" };
    const prob = typeof getProbability === "function" ? getProbability(s, conf) : Math.min(95, Math.max(45, score));
    const rating = typeof getAIRating === "function" ? getAIRating(score) : { label: score >= 85 ? "A Strong" : "B Watch" };
    return `<div class="topPick"><div class="rank">${i + 1}</div><b>${s.ticker}</b><span>${s.name || "Unknown Company"}</span><span class="aiRatingText">${rating.label}</span><span class="biasPill">${signal}</span><span class="probPill">${prob}%</span></div>`;
  }).join("");
}
document.addEventListener("DOMContentLoaded", () => setTimeout(renderTopAIPicks, 500));


function openInfoModal(title, html) {
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modalContent");
  if (!modal || !modalContent) return;

  modalContent.innerHTML = `
    <div class="modalInfo">
      <div class="panel-head">
        <h2>${title}</h2>
        <button class="dark-btn" onclick="closeStockModal()">Close</button>
      </div>
      ${html}
    </div>
  `;

  modal.classList.remove("hidden");
}

function openProbabilityDetails() {
  const panel = document.getElementById("probabilityDetailsPanel");
  if (!panel) return;

  openInfoModal("AI Probability Distribution", panel.innerHTML);
}

function openOptionsFlowDetails() {
  const panel = document.getElementById("optionsFlowDetailsPanel");
  if (!panel) return;

  openInfoModal("TRQX Options Flow Scanner", panel.innerHTML);
}




/* === TRQX v17.4 Live Strip Force Fix ===
   Display labels: SPY / QQQ / DIA / GLD / IWM
   Data symbols:   SPY / QQQ / DIA / GLD / BINANCE:IWMT
*/


function renderTopAIPickMetric() {
  const tickerEl = document.getElementById("topPickTicker");
  const metaEl = document.getElementById("topPickMeta");
  if (!tickerEl || !metaEl || !Array.isArray(stocks)) return;

  const ranked = stocks
    .filter((s) => Number(s.price) > 0 || Number(s.trqxScore) > 0)
    .slice()
    .sort((a, b) => {
      const aScore = (Number(a.trqxScore) || 0) + (Number(a.price) > 0 ? 5 : 0);
      const bScore = (Number(b.trqxScore) || 0) + (Number(b.price) > 0 ? 5 : 0);
      return bScore - aScore;
    });

  const pick = ranked[0];
  if (!pick) {
    tickerEl.textContent = "Top Pick";
    metaEl.textContent = "Refresh data to rank";
    return;
  }

  const score = Number(pick.trqxScore) || 0;
  const conf = typeof confidenceForStock === "function" ? confidenceForStock(pick) : { label: "Medium" };
  const prob = typeof getProbability === "function" ? getProbability(pick, conf) : Math.min(95, Math.max(45, score));
  tickerEl.textContent = pick.ticker || "Top Pick";
  metaEl.textContent = `${prob}% confidence`;
}

function renderGammaDashboard() {
  const spy = Array.isArray(stocks) ? stocks.find(s => String(s.ticker || "").toUpperCase() === "SPY") : null;
  const qqq = Array.isArray(stocks) ? stocks.find(s => String(s.ticker || "").toUpperCase() === "QQQ") : null;
  const ref = spy || qqq;

  const price = ref ? Number(ref.price) : 0;
  const change = ref ? Number(ref.changesPercentage || ref.changePercent || 0) : 0;

  const gammaBiasEl = document.getElementById("gammaBias");
  const squeezeRiskEl = document.getElementById("squeezeRisk");
  const callWallEl = document.getElementById("callWall");
  const putWallEl = document.getElementById("putWall");

  if (gammaBiasEl) {
    gammaBiasEl.textContent = change > 0.35 ? "Positive" : change < -0.35 ? "Negative" : "Neutral";
    gammaBiasEl.className = change > 0.35 ? "gamma-positive" : change < -0.35 ? "gamma-negative" : "";
  }

  if (squeezeRiskEl) {
    const abs = Math.abs(change);
    squeezeRiskEl.textContent = abs >= 1 ? "High" : abs >= 0.35 ? "Moderate" : "Low";
  }

  if (callWallEl) {
    callWallEl.textContent = price ? `$${Math.ceil(price / 5) * 5}` : "—";
  }

  if (putWallEl) {
    putWallEl.textContent = price ? `$${Math.floor(price / 5) * 5}` : "—";
  }
}

if (!window.__trqxCommandStripPatched) {
  window.__trqxCommandStripPatched = true;
  const originalRenderCommandStrip = typeof render === "function" ? render : null;
  if (originalRenderCommandStrip) {
    render = function() {
      originalRenderCommandStrip();
      renderTopAIPickMetric();
      renderGammaDashboard();
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      renderTopAIPickMetric();
      renderGammaDashboard();
    }, 500);
  });
}


/* === TRQX v20 Live Strip ===
   Display: SPY | QQQ | DIA | IWM | VIX | Market Open
   Data: SPY / QQQ / DIA / IWM / ^VIX with VIXY fallback
*/

async function fetchQuoteBatch(symbols) {
  const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}&v=20`);
  if (!response.ok) throw new Error("Quote request failed");
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}



/* === TRQX v20.1 Final Live Strip Fix ===
   Display: SPY | QQQ | DIA | IWM | VIX | Market Open
   Removed IWM permanently from the strip.
*/

async function fetchQuoteBatch(symbols) {
  const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}&v=20.1`);
  if (!response.ok) throw new Error("Quote request failed");
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}


function getEasternMarketTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const result = {};
  parts.forEach((p) => {
    if (p.type !== "literal") result[p.type] = p.value;
  });

  return {
    weekday: result.weekday,
    hour: Number(result.hour),
    minute: Number(result.minute)
  };
}

function isRegularMarketOpenNow(date = new Date()) {
  const { weekday, hour, minute } = getEasternMarketTimeParts(date);
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  if (isWeekend) return false;

  const minutes = hour * 60 + minute;
  const open = 9 * 60 + 30;
  const close = 16 * 60;

  return minutes >= open && minutes < close;
}

function updateMarketStatus() {
  const el = document.getElementById("marketStatus") || document.querySelector(".market-open") || document.querySelector(".market-status");
  if (!el) return;

  const open = isRegularMarketOpenNow();
  const { hour, minute } = getEasternMarketTimeParts();

  el.classList.remove("market-open", "market-closed", "market-status");
  el.classList.add("market-status");
  el.classList.add(open ? "market-open" : "market-closed");

  const timeLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ET`;
  el.textContent = open ? `● Market Open · ${timeLabel}` : `● Market Closed · ${timeLabel}`;
}


/* === END TRQX Market Status Fix === */



/* === TRQX v21 Production Live Strip + Status === */
function forceLiveStripLabels() {
  const labels = { spx: "SPY", ndx: "QQQ", dji: "DIA", iwm: "IWM", vix: "VIX" };
  Object.entries(labels).forEach(([key, value]) => {
    const el = document.getElementById(`label-${key}`);
    if (el) el.textContent = value;
  });

  const strip = document.querySelector(".live-strip");
  if (strip) {
    const spans = strip.querySelectorAll("div span");
    ["SPY", "QQQ", "DIA", "IWM", "VIX"].forEach((label, idx) => {
      if (spans[idx]) spans[idx].textContent = label;
    });
  }
}

async function fetchQuoteBatch(symbols) {
  const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}&v=21`);
  if (!response.ok) throw new Error("Quote request failed");
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function fetchMarketStrip() {
  forceLiveStripLabels();

  const map = [
    { key: "spx", symbol: "SPY" },
    { key: "ndx", symbol: "QQQ" },
    { key: "dji", symbol: "DIA" },
    { key: "iwm", symbol: "IWM" },
    { key: "vix", symbol: "^VIX", fallback: "VIXY" }
  ];

  try {
    let quotes = await fetchQuoteBatch(map.map((m) => m.symbol));

    const hasVix = quotes.some((q) => String(q.symbol || "").toUpperCase() === "^VIX" && Number.isFinite(Number(q.price)));
    if (!hasVix) {
      try {
        const fallbackQuotes = await fetchQuoteBatch(["VIXY"]);
        const fb = fallbackQuotes.find((q) => String(q.symbol || "").toUpperCase() === "VIXY");
        if (fb && Number.isFinite(Number(fb.price))) quotes.push({ ...fb, symbol: "^VIX" });
      } catch (e) {
        console.warn("VIX fallback failed:", e);
      }
    }

    map.forEach((item) => {
      const priceEl = document.getElementById(`strip-price-${item.key}`);
      const pctEl = document.getElementById(`strip-pct-${item.key}`);
      if (!priceEl || !pctEl) return;

      const quote = quotes.find((q) => String(q.symbol || "").toUpperCase() === item.symbol.toUpperCase());

      if (!quote || !Number.isFinite(Number(quote.price))) {
        priceEl.textContent = "—";
        pctEl.textContent = "—";
        pctEl.className = "";
        return;
      }

      const price = Number(quote.price);
      const pct = Number(quote.changesPercentage);
      const up = Number.isFinite(pct) ? pct >= 0 : true;

      priceEl.textContent = price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      pctEl.textContent = Number.isFinite(pct) ? `${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(2)}%` : "—";
      pctEl.className = Number.isFinite(pct) ? (up ? "positive" : "negative") : "";
    });
  } catch (err) {
    console.warn("Market strip failed:", err);
  }
}

function getEasternMarketTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const out = {};
  parts.forEach((p) => {
    if (p.type !== "literal") out[p.type] = p.value;
  });

  return { weekday: out.weekday, hour: Number(out.hour), minute: Number(out.minute) };
}

function isRegularMarketOpenNow(date = new Date()) {
  const { weekday, hour, minute } = getEasternMarketTimeParts(date);
  if (weekday === "Sat" || weekday === "Sun") return false;
  const mins = hour * 60 + minute;
  return mins >= 570 && mins < 960; // 9:30 AM to 4:00 PM ET
}

function updateMarketStatus() {
  const el = document.getElementById("marketStatus") || document.querySelector(".market-status");
  if (!el) return;

  const open = isRegularMarketOpenNow();
  const { hour, minute } = getEasternMarketTimeParts();
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ET`;

  el.classList.remove("market-open", "market-closed");
  el.classList.add(open ? "market-open" : "market-closed");
  el.textContent = open ? `● Market Open · ${time}` : `● Market Closed · ${time}`;
}

document.addEventListener("DOMContentLoaded", () => {
  forceLiveStripLabels();
  fetchMarketStrip();
  updateMarketStatus();
});

setInterval(fetchMarketStrip, 60000);
setInterval(updateMarketStatus, 60000);

