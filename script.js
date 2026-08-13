const CONTRACT_ADDRESS = "0xfa94473b453baf93df2db8ab8101b9da518a10c0";

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
