const CONTRACT_ADDRESS = "0xfa94473b453baf93df2db8ab8101b9da518a10c0";
const TREASURY_ADDRESS = "0x6d2fA5EE4621BA475346fdb54336481fbbfc3E75";
const TREASURY_API = `https://www.backed.is/api/baskets/${TREASURY_ADDRESS}`;
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

refreshDashboard();
setInterval(refreshDashboard, REFRESH_MS);
