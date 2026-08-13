const CONTRACT_ADDRESS = "REPLACE_WITH_CONTRACT_ADDRESS";

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
