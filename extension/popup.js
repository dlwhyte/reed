const DEFAULT_BACKEND = "http://localhost:8765";

const saveBtn = document.getElementById("save-btn");
const saveBtnText = document.getElementById("save-btn-text");
const statusEl = document.getElementById("status");
const statusLabel = document.getElementById("status-label");
const statusDetail = document.getElementById("status-detail");
const offlineWarning = document.getElementById("offline-warning");
const setupWarning = document.getElementById("setup-warning");
const recentsList = document.getElementById("recents-list");
const tabTitleEl = document.getElementById("tab-title");
const tabUrlEl = document.getElementById("tab-url");
const tabFaviconEl = document.getElementById("tab-favicon");

let BACKEND = DEFAULT_BACKEND;
let API_TOKEN = "";

// ── Helpers ──────────────────────────────────────────────────────────────────

function showStatus(type, label, detail) {
    statusEl.className = `status ${type}`;
    statusEl.style.display = "block";
    statusLabel.textContent = label;
    statusDetail.textContent = detail;
}

function timeAgo(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function cleanHost(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
}

function qs(extra) {
    const p = new URLSearchParams({ token: API_TOKEN, ...(extra || {}) });
    return `?${p}`;
}

async function loadSettings() {
    const { backend, apiToken } = await chrome.storage.local.get([
        "backend",
        "apiToken",
    ]);
    BACKEND = (backend || DEFAULT_BACKEND).replace(/\/+$/, "");
    API_TOKEN = apiToken || "";
}

// ── Backend health ───────────────────────────────────────────────────────────

async function checkHealth() {
    try {
        const res = await fetch(`${BACKEND}/api/health`, { signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch {
        return false;
    }
}

// ── Active tab ───────────────────────────────────────────────────────────────

async function loadCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabTitleEl.textContent = tab?.title || "—";
    tabUrlEl.textContent = tab?.url ? cleanHost(tab.url) : "";
    if (tab?.favIconUrl) {
        tabFaviconEl.src = tab.favIconUrl;
        tabFaviconEl.onerror = () => { tabFaviconEl.style.visibility = "hidden"; };
    } else {
        tabFaviconEl.style.visibility = "hidden";
    }
    return tab;
}

// ── Recents ──────────────────────────────────────────────────────────────────

async function loadRecents() {
    try {
        const res = await fetch(
            `${BACKEND}/api/articles${qs({ state: "unread", limit: "5", sort: "newest" })}`
        );
        if (!res.ok) return;
        const articles = await res.json();
        recentsList.innerHTML = "";
        if (articles.length === 0) {
            const empty = document.createElement("p");
            empty.className = "article-empty";
            empty.textContent = "Nothing shelved yet. Save your first page above.";
            recentsList.appendChild(empty);
            return;
        }
        for (const a of articles.slice(0, 5)) {
            const item = document.createElement("a");
            item.className = "article-item";
            item.href = `${BACKEND}/?article=${a.id}`;
            item.target = "_blank";

            const img = document.createElement("img");
            img.className = "article-thumb";
            img.src = a.image_url || "";
            img.alt = "";
            img.onerror = () => { img.style.visibility = "hidden"; };

            const info = document.createElement("div");
            info.className = "article-info";

            const title = document.createElement("div");
            title.className = "article-title";
            title.textContent = a.title || a.url;

            const meta = document.createElement("div");
            meta.className = "article-meta";
            meta.textContent = `${a.site_name || cleanHost(a.url)} · ${timeAgo(a.created_at)}`;

            info.appendChild(title);
            info.appendChild(meta);
            item.appendChild(img);
            item.appendChild(info);
            recentsList.appendChild(item);
        }
    } catch {
        // silently fail - recents are a nice-to-have
    }
}

// ── Save flow ────────────────────────────────────────────────────────────────

async function saveCurrentTab() {
    saveBtn.disabled = true;
    saveBtn.classList.add("saving");
    saveBtnText.textContent = "Saving…";
    statusEl.style.display = "none";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url;

    if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
        showStatus("error", "Can’t save this page", "This isn’t a regular web page.");
        saveBtn.disabled = false;
        saveBtn.classList.remove("saving");
        saveBtnText.textContent = "Save to shelf";
        return;
    }

    try {
        const res = await fetch(`${BACKEND}/api/save${qs()}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });
        const data = await res.json();

        if (!res.ok) {
            showStatus("error", "Couldn’t save", data.detail || "BrowseFellow rejected the URL.");
        } else if (data.duplicate) {
            showStatus("duplicate", "Already on your shelf", data.title || url);
        } else {
            showStatus("success", "Saved to shelf", data.title || url);
            loadRecents();
        }
    } catch {
        showStatus(
            "error",
            "Can’t reach BrowseFellow",
            "Is the backend running on port 8765?",
        );
    }

    saveBtn.disabled = false;
    saveBtn.classList.remove("saving");
    saveBtnText.textContent = "Save to shelf";
}

// ── Init ─────────────────────────────────────────────────────────────────────

(async () => {
    await loadSettings();
    loadCurrentTab();

    if (!API_TOKEN) {
        setupWarning.style.display = "block";
        saveBtn.disabled = true;
        return;
    }

    const online = await checkHealth();
    if (!online) {
        offlineWarning.style.display = "block";
        saveBtn.disabled = true;
    } else {
        loadRecents();
    }
})();

saveBtn.addEventListener("click", saveCurrentTab);

document.querySelectorAll("[data-open-options]").forEach((el) => {
    el.addEventListener("click", (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });
});
