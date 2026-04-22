const DEFAULT_BACKEND = "http://localhost:8765";

const backendInput = document.getElementById("backend");
const tokenInput = document.getElementById("token");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

(async function load() {
  const { backend, apiToken } = await chrome.storage.local.get([
    "backend",
    "apiToken",
  ]);
  backendInput.value = backend || DEFAULT_BACKEND;
  tokenInput.value = apiToken || "";
})();

saveBtn.addEventListener("click", async () => {
  const backend = (backendInput.value || DEFAULT_BACKEND).replace(/\/+$/, "");
  const apiToken = tokenInput.value.trim();

  if (!apiToken) {
    statusEl.className = "status err";
    statusEl.textContent = "Token is required.";
    return;
  }

  // Validate by calling /api/articles with the token.
  try {
    const r = await fetch(
      `${backend}/api/articles?limit=1&token=${encodeURIComponent(apiToken)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!r.ok) {
      statusEl.className = "status err";
      statusEl.textContent = `Validation failed (${r.status}). Check your token.`;
      return;
    }
  } catch (e) {
    statusEl.className = "status err";
    statusEl.textContent = `Could not reach ${backend}. Is the backend running?`;
    return;
  }

  await chrome.storage.local.set({ backend, apiToken });
  statusEl.className = "status ok";
  statusEl.textContent = "Saved. You can close this tab.";
});
