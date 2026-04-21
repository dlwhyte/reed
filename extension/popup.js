const BASE = "http://localhost:8765";

const saveBtn = document.getElementById("save-btn");
const statusEl = document.getElementById("status");
const statusLabel = document.getElementById("status-label");
const statusDetail = document.getElementById("status-detail");
const offlineWarning = document.getElementById("offline-warning");
const recentsList = document.getElementById("recents-list");

// ── Helpers ──────────────────────────────────────────────────────────────────

function showStatus(type, label, detail) {
    statusEl.className = type;
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

// ── Check backend health ──────────────────────────────────────────────────────

async function checkHealth() {
    try {
          const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
          return res.ok;
    } catch {
          return false;
    }
}

// ── Load recent articles ──────────────────────────────────────────────────────

async function loadRecents() {
    try {
          const res = await fetch(`${BASE}/api/articles?state=unread&limit=5&sort=newest`);
          if (!res.ok) return;
          const articles = await res.json();
          recentsList.innerHTML = "";
          if (articles.length === 0) {
                  recentsList.innerHTML =
                            '<p style="padding:8px 16px 12px;font-size:13px;color:#999;">No saved articles yet.</p>';
                  return;
          }
          for (const a of articles) {
                  const item = document.createElement("a");
                  item.className = "article-item";
                  item.href = `${BASE}/?article=${a.id}`;
                  item.target = "_blank";

            const img = document.createElement("img");
                  img.className = "article-thumb";
                  img.src = a.image_url || "";
                  img.onerror = () => { img.style.display = "none"; };

            const info = document.createElement("div");
                  info.className = "article-info";

            const title = document.createElement("div");
                  title.className = "article-title";
                  title.textContent = a.title || a.url;

            const meta = document.createElement("div");
                  meta.className = "article-meta";
                  meta.textContent = `${a.site_name || new URL(a.url).hostname} · ${timeAgo(a.created_at)}`;

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

// ── Save current tab ──────────────────────────────────────────────────────────

async function saveCurrentTab() {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    statusEl.style.display = "none";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url;

  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
        showStatus("error", "Can't save this page", "This isn't a regular web page.");
        saveBtn.disabled = false;
        saveBtn.textContent = "Save this page";
        return;
  }

  try {
        const res = await fetch(`${BASE}/api/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
        });
        const data = await res.json();

      if (!res.ok) {
              showStatus("error", "Error", data.detail || "Could not save article.");
      } else if (data.duplicate) {
              showStatus("duplicate", "Already saved", data.title || url);
      } else {
              showStatus("success", "Saved!", data.title || url);
              loadRecents();
      }
  } catch {
        showStatus("error", "Connection error", "Could not reach Reed. Is the backend running?");
  }

  saveBtn.disabled = false;
    saveBtn.textContent = "Save this page";
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
    const online = await checkHealth();
    if (!online) {
          offlineWarning.style.display = "block";
          saveBtn.disabled = true;
    } else {
          loadRecents();
    }
})();

saveBtn.addEventListener("click", saveCurrentTab);
