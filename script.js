const CONTRACT_ADDRESS = "0xfa94473b453baf93df2db8ab8101b9da518a10c0";
const TREASURY_ADDRESS = "0x6d2fA5EE4621BA475346fdb54336481fbbfc3E75";
const TREASURY_API = `https://www.backed.is/api/baskets/${TREASURY_ADDRESS}`;
const DEX_CHAIN_ID = "robinhood";
const DEX_PAIR_ADDRESS = "0xa1766f6cdf47f96d912b77cd08f077f65b53decfe71c670de60c5d812049c71c";
const DEXSCREENER_API = `https://api.dexscreener.com/latest/dex/pairs/${DEX_CHAIN_ID}/${DEX_PAIR_ADDRESS}`;
const EXPLORER_TOKEN_API = `https://robinhoodchain.blockscout.com/api/v2/tokens/${CONTRACT_ADDRESS}`;
const REFRESH_MS = 30000;
const RETRY_DELAY_MS = 3000;
const FETCH_TIMEOUT_MS = 5000;
// Public read-only APIs above don't all send CORS headers for cross-origin
// browser requests. Raced in parallel against the direct request in
// fetchJson() so the dashboard still loads live data instead of freezing,
// without waiting on each relay one at a time.
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

document.getElementById("copyCaBtn").addEventListener("click", async () => {
  const label = document.getElementById("copyCaLabel");
  try {
    await navigator.clipboard.writeText(CONTRACT_ADDRESS);
    label.textContent = "COPIED!";
  } catch (err) {
    label.textContent = "COPY FAILED";
  }
  setTimeout(() => { label.textContent = "COPY CA"; }, 1500);
});

function setStat(id, text) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.classList.remove("loading");
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  // Race the direct request against every CORS proxy at once instead of
  // trying them one at a time -- whichever responds first wins, so total
  // latency is bounded by the fastest working source instead of the sum
  // of every attempt's timeout.
  const candidates = [url, ...CORS_PROXIES.map((build) => build(url))];
  try {
    return await Promise.any(candidates.map((candidate) => fetchWithTimeout(candidate, FETCH_TIMEOUT_MS)));
  } catch (aggregateErr) {
    console.warn(`All sources failed for ${url}:`, aggregateErr.errors ?? aggregateErr);
    throw aggregateErr;
  }
}

async function refreshDashboard(isRetry = false) {
  try {
    const data = await fetchJson(TREASURY_API);

    setStat("feesCollected", `$${data.distributedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    setStat("rounds", data.rounds.toLocaleString());
    setStat("holderCount", data.holdersPaid.toLocaleString());

    const djt = (data.distributed || []).find((d) => d.symbol === "DJT");
    if (djt) {
      setStat("djtDistributed", djt.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setStat("djtDistributedUsd", `$${djt.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    console.info("Treasury stats updated", data);
  } catch (err) {
    console.error("Failed to load treasury stats:", err);
    if (!isRetry) setTimeout(() => refreshDashboard(true), RETRY_DELAY_MS);
  }
}

function formatUsd(amount) {
  return `$${Math.round(amount).toLocaleString()}`;
}

async function refreshMarketDataFromExplorer() {
  try {
    const data = await fetchJson(EXPLORER_TOKEN_API);

    const decimals = Number(data.decimals ?? 18);
    const totalSupply = Number(data.total_supply) / 10 ** decimals;
    const priceUsd = data.exchange_rate != null ? Number(data.exchange_rate) : null;
    if (priceUsd != null && Number.isFinite(totalSupply)) {
      setStat("marketCap", formatUsd(totalSupply * priceUsd));
      console.info("Market cap updated from explorer fallback", { totalSupply, priceUsd });
    }
  } catch (err) {
    console.error("Explorer market data fetch failed:", err);
  }
}

async function refreshMarketData(isRetry = false) {
  try {
    const data = await fetchJson(DEXSCREENER_API);
    const pair = data.pairs && data.pairs[0];
    if (!pair) throw new Error("No pair data returned");

    const marketCap = pair.marketCap ?? pair.fdv;
    const volume24h = pair.volume && pair.volume.h24;
    if (marketCap != null) setStat("marketCap", formatUsd(marketCap));
    if (volume24h != null) setStat("volume24h", formatUsd(volume24h));
    if (marketCap == null) await refreshMarketDataFromExplorer();
    console.info("Market data updated", pair);
  } catch (err) {
    console.error("Dexscreener fetch failed, falling back to on-chain data:", err);
    await refreshMarketDataFromExplorer();
    if (!isRetry) setTimeout(() => refreshMarketData(true), RETRY_DELAY_MS);
  }
}

refreshDashboard();
refreshMarketData();
setInterval(refreshDashboard, REFRESH_MS);
setInterval(refreshMarketData, REFRESH_MS);
