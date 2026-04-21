const BASE = "http://localhost:8765";

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
          id: "reed-save-link",
          title: "Save link to Reed",
          contexts: ["link"],
    });
    chrome.contextMenus.create({
          id: "reed-save-page",
          title: "Save page to Reed",
          contexts: ["page"],
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    const url =
          info.menuItemId === "reed-save-link"
        ? info.linkUrl
            : info.pageUrl;
    saveUrl(url);
});

async function saveUrl(url) {
    try {
          const res = await fetch(`${BASE}/api/save`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ url }),
          });
          const data = await res.json();
          await chrome.storage.session.set({
                  lastSave: {
                            ok: res.ok,
                            duplicate: data.duplicate ?? false,
                            title: data.title ?? url,
                            timestamp: Date.now(),
                  },
          });
    } catch (e) {
          await chrome.storage.session.set({
                  lastSave: {
                            ok: false,
                            duplicate: false,
                            title: url,
                            error: "Could not reach Reed. Is the backend running?",
                            timestamp: Date.now(),
                  },
          });
    }
}

// Expose saveUrl so popup can call it via messaging
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "SAVE_URL") {
          saveUrl(msg.url).then(() => sendResponse({ ok: true }));
          return true;
    }
});
