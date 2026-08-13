const CONTRACT_ADDRESS = "0xfa94473b453baf93df2db8ab8101b9da518a10c0";
const TREASURY_ADDRESS = "0x6d2fA5EE4621BA475346fdb54336481fbbfc3E75";
const TREASURY_API = `https://www.backed.is/api/baskets/${TREASURY_ADDRESS}`;
const DEX_CHAIN_ID = "robinhood";
const DEX_PAIR_ADDRESS = "0xa1766f6cdf47f96d912b77cd08f077f65b53decfe71c670de60c5d812049c71c";
const DEXSCREENER_API = `https://api.dexscreener.com/latest/dex/pairs/${DEX_CHAIN_ID}/${DEX_PAIR_ADDRESS}`;
const EXPLORER_TOKEN_API = `https://robinhoodchain.blockscout.com/api/v2/tokens/${CONTRACT_ADDRESS}`;
const REFRESH_MS = 60000;

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

async function refreshDashboard() {
  try {
    const res = await fetch(TREASURY_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    setStat("feesCollected", `$${data.feesUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    setStat("rounds", data.rounds.toLocaleString());
    setStat("holderCount", data.holdersPaid.toLocaleString());

    const djt = (data.distributed || []).find((d) => d.symbol === "DJT");
    if (djt) {
      setStat("djtDistributed", djt.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  } catch (err) {
    console.error("Failed to load treasury stats:", err);
  }
}

function formatUsd(amount) {
  return `$${Math.round(amount).toLocaleString()}`;
}

async function refreshMarketDataFromExplorer() {
  try {
    const res = await fetch(EXPLORER_TOKEN_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const decimals = Number(data.decimals ?? 18);
    const totalSupply = Number(data.total_supply) / 10 ** decimals;
    const priceUsd = data.exchange_rate != null ? Number(data.exchange_rate) : null;
    if (priceUsd != null && Number.isFinite(totalSupply)) {
      setStat("marketCap", formatUsd(totalSupply * priceUsd));
    }
  } catch (err) {
    console.error("Explorer market data fetch failed:", err);
  }
}

async function refreshMarketData() {
  try {
    const res = await fetch(DEXSCREENER_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const pair = data.pairs && data.pairs[0];
    if (!pair) throw new Error("No pair data returned");

    const marketCap = pair.marketCap ?? pair.fdv;
    const volume24h = pair.volume && pair.volume.h24;
    if (marketCap != null) setStat("marketCap", formatUsd(marketCap));
    if (volume24h != null) setStat("volume24h", formatUsd(volume24h));
    if (marketCap == null) await refreshMarketDataFromExplorer();
  } catch (err) {
    console.error("Dexscreener fetch failed, falling back to on-chain data:", err);
    await refreshMarketDataFromExplorer();
  }
}

refreshDashboard();
refreshMarketData();
setInterval(refreshDashboard, REFRESH_MS);
setInterval(refreshMarketData, REFRESH_MS);
