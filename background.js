// BAS Session Bridge Background Service Worker
const api = typeof browser !== "undefined" ? browser : chrome;

const TARGET_ENDPOINTS = [
    "http://localhost/project_manager/api_bas_bridge.php",
    "http://127.0.0.1/project_manager/api_bas_bridge.php",
    "http://localhost:8089/api_bas_bridge.php",
    "http://127.0.0.1:8089/api_bas_bridge.php",
    "http://localhost:8888/api_bas_bridge.php",
    "http://127.0.0.1:8888/api_bas_bridge.php"
];

let lastSyncTime = 0;
const MIN_SYNC_INTERVAL = 30000; // 30 seconds debounce

async function captureAndSendBASSession(force = false) {
    const now = Date.now();
    if (!force && (now - lastSyncTime < MIN_SYNC_INTERVAL)) {
        return;
    }

    try {
        if (!api.cookies || !api.cookies.getAll) {
            return;
        }

        const cookies = await api.cookies.getAll({ domain: "buildapprovalsystem.com" });
        if (!cookies || cookies.length === 0) {
            return;
        }

        let sid = "";
        let device = "";
        const allCookies = [];

        for (const c of cookies) {
            allCookies.push(`${c.name}=${c.value}`);
            if (c.name === "sid") {
                sid = c.value;
            } else if (c.name.startsWith("CF_VERIFIED_DEVICE") || c.name.includes("VERIFIED_DEVICE")) {
                device = c.value;
            }
        }

        // If sid is not found, cannot bridge session
        if (!sid) {
            return;
        }

        const payload = {
            sid: sid,
            device: device,
            cookie_header: allCookies.join("; "),
            timestamp: Math.floor(now / 1000)
        };

        lastSyncTime = now;

        // Attempt sending to candidate endpoints silently
        for (const url of TARGET_ENDPOINTS) {
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    // Successfully synced to local bridge
                    break;
                }
            } catch (err) {
                // Silently ignore unreachable local endpoints
            }
        }
    } catch (e) {
        // Safe fail - do not disrupt normal extension functions
    }
}

// Listen for tab updates on buildapprovalsystem.com
api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab && tab.url && tab.url.includes("buildapprovalsystem.com")) {
        if (changeInfo.status === "complete") {
            captureAndSendBASSession(false);
        }
    }
});

// Listen for cookie changes on buildapprovalsystem.com
if (api.cookies && api.cookies.onChanged) {
    api.cookies.onChanged.addListener((changeInfo) => {
        if (changeInfo.cookie && changeInfo.cookie.domain && changeInfo.cookie.domain.includes("buildapprovalsystem.com")) {
            if (changeInfo.cookie.name === "sid" || changeInfo.cookie.name.includes("VERIFIED_DEVICE")) {
                captureAndSendBASSession(false);
            }
        }
    });
}

// Listen for messages from content.js or popup
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sync_bas_session") {
        captureAndSendBASSession(true).then(() => {
            sendResponse({ status: "done" });
        });
        return true;
    }
});
