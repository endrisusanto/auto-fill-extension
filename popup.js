const api = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_PRESET = {
    id: 'default',
    name: 'Endri (Default)',
    submitterName: "Endri Susanto",
    plEmail: "danar.kurnia@samsung.com",
    cscType: "MainCSC",
    quickBuildPath: "https://android.qb.sec.samsung.net/build/106894213",
    scatLink: "https://mobilerndhub.sec.samsung.net/scat/test/2956447",
    notificationEmails: "endri.s@samsung.com, lufti.b@samsung.com, apta.p@samsung.com, danar.kurnia@samsung.com, aulia.am@samsung.com",
    carrier: "XID",
    countries: "Indonesia"
};

let presets = [];
let activePresetId = 'default';

// DOM Elements
const listView = document.getElementById('listView');
const formView = document.getElementById('formView');
const presetList = document.getElementById('presetList');
const listFooter = document.getElementById('listFooter');
const presetForm = document.getElementById('presetForm');

// Session Status DOM Elements
const sessionDot = document.getElementById('sessionDot');
const sessionStatusText = document.getElementById('sessionStatusText');
const sessionDetailText = document.getElementById('sessionDetailText');
const btnSyncSession = document.getElementById('btnSyncSession');

// Mobile R&D Hub Status DOM Elements
const hubDot = document.getElementById('hubDot');
const hubStatusText = document.getElementById('hubStatusText');
const hubDetailText = document.getElementById('hubDetailText');
const btnSyncHubSession = document.getElementById('btnSyncHubSession');

// Initialize
async function init() {
    const data = await api.storage.local.get(['bas_presets', 'active_preset_id']);
    
    if (!data.bas_presets || data.bas_presets.length === 0) {
        presets = [DEFAULT_PRESET];
        await api.storage.local.set({ bas_presets: presets });
    } else {
        presets = data.bas_presets;
    }

    activePresetId = data.active_preset_id || 'default';
    renderList();
    updateSessionStatus();
    updateHubSessionStatus();
}

async function updateSessionStatus() {
    if (!sessionDot || !sessionStatusText) return;

    sessionStatusText.textContent = "Memeriksa token...";
    sessionDetailText.textContent = "Menghubungkan ke BAS Bridge...";

    // 1. Check local cookies for buildapprovalsystem.com
    let hasLocalSid = false;
    let localDevice = false;
    if (api.cookies && api.cookies.getAll) {
        try {
            const cookies = await api.cookies.getAll({ domain: "buildapprovalsystem.com" });
            if (cookies && cookies.length > 0) {
                hasLocalSid = cookies.some(c => c.name === "sid");
                localDevice = cookies.some(c => c.name.includes("VERIFIED_DEVICE"));
            }
        } catch (e) {
            console.error("Error querying cookies:", e);
        }
    }

    // 2. Query bridge status via background script
    api.runtime.sendMessage({ action: "check_bas_status" }, (response) => {
        const endpoints = response && response.endpoints ? response.endpoints : [];
        const activeEndpoint = endpoints.find(e => e.reachable && e.active);
        const reachableEndpoint = endpoints.find(e => e.reachable);

        if (activeEndpoint) {
            sessionDot.className = 'status-dot active';
            sessionStatusText.textContent = 'Session Active (Tersambung)';
            const updated = activeEndpoint.data && activeEndpoint.data.updated_at ? activeEndpoint.data.updated_at : 'Baru saja';
            const ageH = activeEndpoint.data && activeEndpoint.data.age_hours !== undefined ? activeEndpoint.data.age_hours : '0';
            sessionDetailText.textContent = 'Update: ' + updated + ' (' + ageH + 'h lalu)';
        } else if (reachableEndpoint && reachableEndpoint.data && reachableEndpoint.data.status === 'expired') {
            sessionDot.className = 'status-dot expired';
            sessionStatusText.textContent = 'Session Expired (>8 Jam)';
            sessionDetailText.textContent = 'Buka portal BAS di browser untuk refresh token.';
        } else if (hasLocalSid) {
            sessionDot.className = 'status-dot active';
            sessionStatusText.textContent = 'Token Siap di Browser';
            sessionDetailText.textContent = localDevice ? 'Cookie sid & Device terdeteksi. Klik Sync.' : 'Cookie sid terdeteksi. Klik Sync.';
        } else {
            sessionDot.className = 'status-dot disconnected';
            sessionStatusText.textContent = 'Belum Ada Token BAS';
            sessionDetailText.textContent = 'Silakan login ke portal Build Approval System.';
        }
    });
}

async function updateHubSessionStatus() {
    if (!hubDot || !hubStatusText) return;

    hubStatusText.textContent = "Memeriksa Hub...";
    hubDetailText.textContent = "Menghubungkan ke Heist Hub...";

    api.runtime.sendMessage({ action: "check_hub_status" }, (response) => {
        const endpoints = response && response.endpoints ? response.endpoints : [];
        const activeEndpoint = endpoints.find(e => e.reachable && e.active);
        const reachableEndpoint = endpoints.find(e => e.reachable);
        const hasLocal = response && response.hasLocalSession;
        const username = response && response.username ? response.username : 'User';
        const count = response && response.cookiesCount ? response.cookiesCount : 0;

        if (activeEndpoint) {
            hubDot.className = 'status-dot active';
            hubStatusText.textContent = 'Hub Sync: Aktif (' + username + ')';
            hubDetailText.textContent = 'Tersinkron ke Heist Hub (' + count + ' cookies)';
        } else if (hasLocal) {
            hubDot.className = 'status-dot active';
            hubStatusText.textContent = 'Cookie Siap di Browser (' + username + ')';
            hubDetailText.textContent = count + ' cookie terdeteksi. Klik Sync Hub.';
        } else {
            hubDot.className = 'status-dot disconnected';
            hubStatusText.textContent = 'Belum Ada Sesi Mobile R&D';
            hubDetailText.textContent = 'Silakan login ke portal Mobile R&D Hub.';
        }
    });
}

function renderList() {
    presetList.innerHTML = '';
    
    if (presets.length === 0) {
        presetList.innerHTML = '<div class="empty-state">Belum ada preset. Buat preset baru!</div>';
        return;
    }

    presets.forEach(preset => {
        const card = document.createElement('div');
        card.className = 'preset-card ' + (preset.id === activePresetId ? 'active' : '');
        card.innerHTML = 
            '<div class="preset-name">' + preset.name + '</div>' +
            '<div class="preset-details">' + preset.submitterName + ' • ' + (preset.carrier || 'No Carrier') + '</div>' +
            '<div class="card-actions">' +
                '<button class="btn-sm edit-btn" data-id="' + preset.id + '">Edit</button>' +
                '<button class="btn-sm danger delete-btn" data-id="' + preset.id + '">Delete</button>' +
            '</div>';

        card.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            setActive(preset.id);
        });

        const editBtn = card.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => showForm(preset.id));

        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deletePreset(preset.id));

        presetList.appendChild(card);
    });
}

async function setActive(id) {
    activePresetId = id;
    await api.storage.local.set({ active_preset_id: id });
    renderList();
}

function showForm(id = null) {
    listView.classList.remove('show');
    listFooter.style.display = 'none';
    formView.classList.add('show');

    if (id) {
        const preset = presets.find(p => p.id === id);
        document.getElementById('presetId').value = preset.id;
        document.getElementById('name').value = preset.name;
        document.getElementById('submitterName').value = preset.submitterName;
        document.getElementById('plEmail').value = preset.plEmail;
        document.getElementById('cscType').value = preset.cscType;
        document.getElementById('quickBuildPath').value = preset.quickBuildPath || '';
        document.getElementById('scatLink').value = preset.scatLink || '';
        document.getElementById('notificationEmails').value = preset.notificationEmails || '';
        document.getElementById('carrier').value = preset.carrier || '';
        document.getElementById('countries').value = preset.countries || '';
    } else {
        presetForm.reset();
        document.getElementById('presetId').value = '';
    }
}

function hideForm() {
    formView.classList.remove('show');
    listView.classList.add('show');
    listFooter.style.display = 'flex';
}

async function deletePreset(id) {
    if (presets.length <= 1) {
        alert("Harus ada minimal satu preset tersimpan.");
        return;
    }
    
    if (!confirm("Apakah Anda yakin ingin menghapus preset ini?")) return;

    presets = presets.filter(p => p.id !== id);
    if (activePresetId === id) {
        activePresetId = presets[0].id;
    }

    await api.storage.local.set({ 
        bas_presets: presets,
        active_preset_id: activePresetId
    });
    renderList();
}

// Event Listeners
document.getElementById('addBtn').addEventListener('click', () => showForm());
document.getElementById('cancelBtn').addEventListener('click', hideForm);

if (btnSyncHubSession) {
    btnSyncHubSession.addEventListener('click', () => {
        btnSyncHubSession.disabled = true;
        btnSyncHubSession.innerHTML = '<span>⏳</span> Syncing...';
        api.runtime.sendMessage({ action: "sync_hub_session" }, (res) => {
            setTimeout(() => {
                btnSyncHubSession.disabled = false;
                btnSyncHubSession.innerHTML = '<span>🌐</span> Sync Hub';
                updateHubSessionStatus();
            }, 700);
        });
    });
}

if (btnSyncSession) {
    btnSyncSession.addEventListener('click', () => {
        btnSyncSession.disabled = true;
        btnSyncSession.innerHTML = '<span>⏳</span> Syncing...';
        api.runtime.sendMessage({ action: "sync_bas_session" }, (res) => {
            setTimeout(() => {
                btnSyncSession.disabled = false;
                btnSyncSession.innerHTML = '<span>🔄</span> Sync';
                updateSessionStatus();
            }, 700);
        });
    });
}

presetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('presetId').value || 'id_' + Date.now();
    const newPreset = {
        id,
        name: document.getElementById('name').value,
        submitterName: document.getElementById('submitterName').value,
        plEmail: document.getElementById('plEmail').value,
        cscType: document.getElementById('cscType').value,
        quickBuildPath: document.getElementById('quickBuildPath').value,
        scatLink: document.getElementById('scatLink').value,
        notificationEmails: document.getElementById('notificationEmails').value,
        carrier: document.getElementById('carrier').value,
        countries: document.getElementById('countries').value
    };

    const index = presets.findIndex(p => p.id === id);
    if (index > -1) {
        presets[index] = newPreset;
    } else {
        presets.push(newPreset);
        activePresetId = id; // Auto select new preset
    }

    await api.storage.local.set({ 
        bas_presets: presets,
        active_preset_id: activePresetId
    });

    hideForm();
    renderList();
});

document.getElementById('fillBtn').addEventListener('click', async () => {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
        const preset = presets.find(p => p.id === activePresetId);
        api.tabs.sendMessage(tabs[0].id, { 
            action: "fillForm",
            data: preset
        });
    }
});

init();
