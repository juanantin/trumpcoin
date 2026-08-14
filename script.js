const CONTRACT_ADDRESS = "0xfa94473b453baf93df2db8ab8101b9da518a10c0";
const TREASURY_ADDRESS = "0x6d2fA5EE4621BA475346fdb54336481fbbfc3E75";
const TREASURY_API = `https://www.backed.is/api/baskets/${TREASURY_ADDRESS}`;
const DEX_CHAIN_ID = "robinhood";
const DEX_PAIR_ADDRESS = "0xa1766f6cdf47f96d912b77cd08f077f65b53decfe71c670de60c5d812049c71c";
const DEXSCREENER_API = `https://api.dexscreener.com/latest/dex/pairs/${DEX_CHAIN_ID}/${DEX_PAIR_ADDRESS}`;
const EXPLORER_TOKEN_API = `https://robinhoodchain.blockscout.com/api/v2/tokens/${CONTRACT_ADDRESS}`;
const REFRESH_MS = 30000;
const RETRY_DELAY_MS = 5000;
// Public read-only APIs above don't all send CORS headers for cross-origin
// browser requests. If a direct fetch is blocked, retry once through a
// CORS-relay so the dashboard still loads live data instead of freezing.
const CORS_PROXY = "https://corsproxy.io/?url=";

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

async function fetchJson(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (directErr) {
    console.warn(`Direct fetch failed for ${url}, retrying via CORS proxy:`, directErr);
    const res = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
    return await res.json();
  }
}

async function refreshDashboard(isRetry = false) {
  try {
    const data = await fetchJson(TREASURY_API);

    setStat("feesCollected", `$${data.feesUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    setStat("rounds", data.rounds.toLocaleString());
    setStat("holderCount", data.holdersPaid.toLocaleString());

    const djt = (data.distributed || []).find((d) => d.symbol === "DJT");
    if (djt) {
      setStat("djtDistributed", djt.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
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
