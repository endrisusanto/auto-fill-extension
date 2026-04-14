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
}

function renderList() {
    presetList.innerHTML = '';
    
    if (presets.length === 0) {
        presetList.innerHTML = '<div class="empty-state">No presets found. Add one to get started!</div>';
        return;
    }

    presets.forEach(preset => {
        const card = document.createElement('div');
        card.className = `preset-card ${preset.id === activePresetId ? 'active' : ''}`;
        card.innerHTML = `
            <div class="preset-name">${preset.name}</div>
            <div class="preset-details">${preset.submitterName} • ${preset.carrier || 'No Carrier'}</div>
            <div class="card-actions">
                <button class="btn-sm edit-btn" data-id="${preset.id}">Edit</button>
                <button class="btn-sm danger delete-btn" data-id="${preset.id}">Delete</button>
            </div>
        `;

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
        alert("You must have at least one preset.");
        return;
    }
    
    if (!confirm("Are you sure you want to delete this preset?")) return;

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
        // Send the specific preset data so content script doesn't have to fetch it (though it could)
        const preset = presets.find(p => p.id === activePresetId);
        api.tabs.sendMessage(tabs[0].id, { 
            action: "fillForm",
            data: preset
        });
    }
});

init();
