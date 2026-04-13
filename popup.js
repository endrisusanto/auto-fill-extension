document.getElementById('fillBtn').addEventListener('click', async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  browser.tabs.sendMessage(tab.id, { action: "fillForm" });
});
