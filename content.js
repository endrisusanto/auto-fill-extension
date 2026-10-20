// Use chrome for universal compatibility
const api = typeof browser !== "undefined" ? browser : chrome;

// State variable to track if auto-fill workflow is running
let isAutoFilling = false;

// State variable to temporarily bypass click interception for fallback manual picker
let isInterceptingClick = true;

// Add a listener for messages from the popup
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fillForm") {
        if (request.data) {
            // Data provided directly from popup
            fillBASForm(request.data);
        } else {
            // Fetch from storage if triggered from overlay button
            api.storage.local.get(['bas_presets', 'active_preset_id'], (result) => {
                const presets = result.bas_presets || [];
                const activeId = result.active_preset_id;
                const preset = presets.find(p => p.id === activeId) || presets[0];
                if (preset) {
                    fillBASForm(preset);
                } else {
                    console.error("No preset found to fill form.");
                    alert("Please set a preset in the extension popup first.");
                }
            });
        }
    }
});

// Helper to parse comma separated strings to arrays
function parseList(str) {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(s => s !== "");
}

// Inject Overlay Button
function injectOverlayButton() {
    // Only inject on specific paths
    const hash = window.location.hash;
    const isValidPath = hash.includes('smrSecond') || hash.includes('submit-normal') || hash.includes('submit-sku') || hash.includes('regularSubmission');

    if (!isValidPath) {
        const existing = document.getElementById('bas-auto-fill-overlay');
        if (existing) existing.remove();
        return;
    }

    if (document.getElementById('bas-auto-fill-overlay')) return;

    const btn = document.createElement('button');
    btn.id = 'bas-auto-fill-overlay';

    let pageLabel = "BAS";
    if (hash.includes('smrSecond')) pageLabel = "SMR";
    else if (hash.includes('submit-normal') || hash.includes('regularSubmission')) pageLabel = "NORMAL";
    else if (hash.includes('submit-sku')) pageLabel = "SKU";

    btn.innerHTML = `🐱 AUTO FILL ${pageLabel}`;
    btn.title = "Click to auto-fill. Right click to change presets in extension popup.";
    btn.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10000;
        padding: 20px 40px;
        font-size: 24px;
        font-weight: bold;
        color: white;
        background: rgba(26, 188, 156, 0.4);
        border: 3px dashed rgba(255, 255, 255, 0.8);
        border-radius: 15px;
        cursor: pointer;
        backdrop-filter: blur(5px);
        transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        box-shadow: 0 0 20px rgba(0,0,0,0.2);
    `;

    btn.onmouseover = () => {
        if (btn.classList.contains('minimized')) return;
        btn.style.background = 'rgba(26, 188, 156, 0.8)';
    };
    btn.onmouseout = () => {
        if (btn.classList.contains('minimized')) return;
        btn.style.background = 'rgba(26, 188, 156, 0.4)';
    };

    btn.onclick = async () => {
        btn.innerHTML = 'Fetching Preset...';
        btn.disabled = true;

        if (typeof api === 'undefined' || !api.storage) {
            alert("Extension context was invalidated. Please refresh the page to use Auto-Fill.");
            btn.innerHTML = 'Error: Refresh Page';
            btn.disabled = false;
            return;
        }

        api.storage.local.get(['bas_presets', 'active_preset_id'], async (result) => {
            const presets = result.bas_presets || [];
            const activeId = result.active_preset_id;
            const preset = presets.find(p => p.id === activeId) || presets[0];

            if (preset) {
                btn.innerHTML = 'Filling...';
                await fillBASForm(preset);
                btn.innerHTML = 'Done! ✨';

                btn.classList.add('minimized');
                btn.style.top = '50%';
                btn.style.left = 'auto';
                btn.style.bottom = 'auto';
                btn.style.right = '20px';
                btn.style.transform = 'translateY(-50%)';
                btn.style.padding = '10px 20px';
                btn.style.fontSize = '14px';
                btn.style.background = 'rgba(26, 188, 156, 0.9)';
                btn.style.border = '1px solid white';

                setTimeout(() => {
                    btn.innerHTML = `🐱 RE-FILL ${pageLabel}`;
                    btn.disabled = false;
                }, 2000);
            } else {
                btn.innerHTML = 'Error: No Preset';
                btn.style.background = 'rgba(231, 76, 60, 0.8)';
                setTimeout(() => {
                    btn.innerHTML = `⚡ AUTO FILL ${pageLabel}`;
                    btn.disabled = false;
                    btn.style.background = 'rgba(26, 188, 156, 0.4)';
                }, 3000);
            }
        });
    };

    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 0px;
        right: 8px;
        color: white;
        cursor: pointer;
        font-size: 18px;
    `;
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        btn.remove();
        btn.dataset.closed = "true";
    };
    btn.appendChild(closeBtn);

    document.body.appendChild(btn);
}

// ponytail: lock to prevent concurrent execution during interval ticks
let isSubmissionsAutomating = false;

// Periodically check for injection (Better for SPAs)
setInterval(() => {
    injectOverlayButton();
    runSubmissionsWorkflow();
    injectApVersionSearch();
}, 1000);

// ponytail: inject AP Version quick search on searchSubmissions page
function injectApVersionSearch() {
    const hash = window.location.hash;
    const isSearchPage = hash.includes('searchSubmissions');
    const existing = document.getElementById('bas-ap-lookup-container');

    if (!isSearchPage) {
        if (existing) existing.remove();
        return;
    }

    if (existing) return;

    const heroCard = document.querySelector('.card.card--hero, section.card--hero');
    if (!heroCard) return;

    const container = document.createElement('div');
    container.id = 'bas-ap-lookup-container';
    container.style.cssText = 'margin-top: 18px; padding-top: 16px; border-top: 1px dashed #d7e9e6;';

    container.innerHTML = `
        <div class="card__head--inline" style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
            <span class="material-icons" style="font-size:18px; width:18px; height:18px; color:#0f766e;">layers</span>
            <h2 style="margin:0; font-size:15px; font-weight:600; color:#10171d;">Quick lookup by AP Version</h2>
            <span class="tag" style="background:#e6f4f2; color:#0f766e; border:1px solid #c6e0dc; border-radius:6px; font-size:11px; padding:2px 8px; font-weight:500;">Extension</span>
        </div>
        <div class="lookup" style="display:flex; gap:10px;">
            <div class="lookup__box" style="display:flex; align-items:center; flex:1 1 auto; min-width:0; height:46px; padding:0 15px; background:#fff; border:1px solid #e4e7ea; border-radius:10px; box-shadow:0 1px 2px rgba(16,24,32,0.05);">
                <input id="bas-ap-input" type="text" placeholder="e.g. S928BXXU1AXB5..." class="lookup__input" style="flex:1 1 auto; min-width:0; border:0; outline:0; background:transparent; font-size:14px; color:#10171d; caret-color:#0f766e;">
            </div>
            <button id="bas-ap-search-btn" type="button" class="btn btn--primary btn--lg" style="height:46px; padding:0 24px; font-size:14px; border-radius:10px; background:#0f766e; color:#fff; border:1px solid #0f766e; font-weight:500; cursor:pointer;">Search AP</button>
            <button id="bas-ap-clear-btn" type="button" class="btn btn--ghost btn--lg" style="height:46px; padding:0 24px; font-size:14px; border-radius:10px; background:#fff; color:#55606b; border:1px solid #e4e7ea; font-weight:500; cursor:pointer;">Clear</button>
        </div>
        <p class="card__hint" style="margin:8px 0 0; font-size:12px; color:#55606b;">Cari submission berdasarkan AP Version secara langsung tanpa perlu membuka accordion Advanced Search.</p>
    `;

    const inputEl = container.querySelector('#bas-ap-input');
    const searchBtn = container.querySelector('#bas-ap-search-btn');
    const clearBtn = container.querySelector('#bas-ap-clear-btn');

    // Sync if target apVersion input already has a value
    const existingApInput = document.getElementById('apVersion');
    if (existingApInput && existingApInput.value) {
        inputEl.value = existingApInput.value;
    }

    const executeApSearch = async () => {
        const val = inputEl.value.trim();
        if (!val) {
            inputEl.focus();
            return;
        }

        searchBtn.disabled = true;
        searchBtn.textContent = 'Searching...';

        try {
            // ponytail: clear master id field so BAS does not prioritize id lookup
            const idInput = document.getElementById('id');
            if (idInput && idInput.value) {
                idInput.value = '';
                idInput.dispatchEvent(new Event('input', { bubbles: true }));
                idInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // ponytail: open advanced panel if apVersion input is not yet in DOM
            let targetAp = document.getElementById('apVersion');
            if (!targetAp) {
                const advToggle = document.querySelector('.adv-toggle');
                if (advToggle) {
                    advToggle.click();
                    await sleep(150);
                    targetAp = document.getElementById('apVersion');
                }
            }

            if (targetAp) {
                targetAp.value = val;
                targetAp.dispatchEvent(new Event('input', { bubbles: true }));
                targetAp.dispatchEvent(new Event('change', { bubbles: true }));
                targetAp.dispatchEvent(new Event('blur', { bubbles: true }));
            }

            // ponytail: trigger standard BAS search button in actions bar
            const formSearchBtn = Array.from(document.querySelectorAll('.actions__btns button.btn--primary'))
                .find(b => b.textContent.trim().includes('Search')) || document.querySelector('.actions__btns .btn--primary');

            if (formSearchBtn) {
                formSearchBtn.click();
            }
        } finally {
            setTimeout(() => {
                searchBtn.disabled = false;
                searchBtn.textContent = 'Search AP';
            }, 600);
        }
    };

    searchBtn.onclick = executeApSearch;

    inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            executeApSearch();
        }
    };

    clearBtn.onclick = () => {
        inputEl.value = '';
        const targetAp = document.getElementById('apVersion');
        if (targetAp) {
            targetAp.value = '';
            targetAp.dispatchEvent(new Event('input', { bubbles: true }));
            targetAp.dispatchEvent(new Event('change', { bubbles: true }));
        }
        inputEl.focus();
    };

    heroCard.appendChild(container);
}

async function runSubmissionsWorkflow() {
    if (isSubmissionsAutomating) return;

    // ponytail: check if page is still loading
    const isSpinnerPresent = document.querySelector('.ngx-spinner-overlay, mat-spinner, mat-progress-bar, .spinner, .loading-spinner, .loading, .ant-spin-spinning');
    if (isSpinnerPresent) return;

    isSubmissionsAutomating = true;
    try {
        const hash = window.location.hash;
        const isSubmissionsPage = hash.includes('ongoing-submissions') || hash.includes('mysubmissions-submitter');

        // ponytail: avoid race condition by ensuring Category is Email before pagination
        if (isSubmissionsPage) {
            const isCategoryEmail = await autoSelectCategoryEmail();
            if (isCategoryEmail) {
                await autoSelectPagination20();
            }
        } else {
            await autoSelectPagination20();
        }
    } finally {
        isSubmissionsAutomating = false;
    }
}

async function autoSelectCategoryEmail() {
    // ponytail: support NG-ZORRO filter-control and legacy Angular Material select
    let categorySelect = null;
    const filterControls = document.querySelectorAll('.filter-control');
    for (const fc of filterControls) {
        if (fc.querySelector('.filter-control__label')?.textContent.trim().toLowerCase() === 'category') {
            categorySelect = fc.querySelector('nz-select, .ant-select');
            break;
        }
    }

    if (!categorySelect) {
        const matSelects = document.querySelectorAll('mat-select:not([aria-labelledby*="paginator"])');
        for (const select of matSelects) {
            const placeholder = select.getAttribute('placeholder') || "";
            const label = select.closest('mat-form-field')?.querySelector('mat-label')?.textContent || "";
            if (placeholder.includes('Category') || label.includes('Category')) {
                categorySelect = select;
                break;
            }
        }
    }

    if (!categorySelect) return false;

    const valueEl = categorySelect.querySelector('.ant-select-selection-item, nz-select-item, .mat-mdc-select-value-text, .mat-select-value-text');
    const currentVal = valueEl?.textContent.trim();

    if (currentVal === "Email") return true;

    if (!categorySelect.getAttribute('data-auto-filled')) {
        console.log("Auto-selecting Category: Email");
        const trigger = categorySelect.querySelector('.ant-select-selector, nz-select-top-control, .mat-mdc-select-trigger') || categorySelect;
        trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        trigger.click();

        await sleep(400);

        const options = Array.from(document.querySelectorAll('.ant-select-item-option, nz-option-item, mat-option, .mat-mdc-option, [role="option"]'));
        let found = false;
        for (const opt of options) {
            const text = opt.textContent.trim();
            const title = opt.getAttribute('title');
            if (text === "Email" || title === "Email") {
                opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                opt.click();
                categorySelect.setAttribute('data-auto-filled', 'true');
                found = true;
                break;
            }
        }

        if (!found) {
            document.body.click();
        }
    }

    return false;
}

async function autoSelectPagination20() {
    // ponytail: look for paginator page size select element
    const paginatorSelect = document.querySelector('mat-paginator mat-select, mat-select[aria-labelledby*="mat-paginator-page-size-label"], .mat-mdc-paginator-page-size-select mat-select');
    if (!paginatorSelect) return;

    const valueTextEl = paginatorSelect.querySelector('.mat-mdc-select-value-text, .mat-select-value-text');
    const currentVal = valueTextEl?.textContent.trim();

    if (currentVal && currentVal !== "20" && !paginatorSelect.getAttribute('data-auto-filled-page')) {
        console.log("Auto-selecting Pagination page size: 20");
        const trigger = paginatorSelect.querySelector('.mat-mdc-select-trigger') || paginatorSelect;
        trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        trigger.click();

        await sleep(500);

        const options = Array.from(document.querySelectorAll('mat-option, .mat-mdc-option, [role="option"]'));
        let found = false;
        for (const opt of options) {
            if (opt.textContent.trim() === "20") {
                opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                opt.click();
                paginatorSelect.setAttribute('data-auto-filled-page', 'true');
                found = true;
                break;
            }
        }

        if (!found) {
            document.body.click();
        }
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fillBASForm(preset) {
    console.log("Starting Auto-Fill with preset:", preset.name);
    isAutoFilling = true;
    const hash = window.location.hash;

    const setInputValue = (selector, value) => {
        if (!value) return false;
        const el = document.querySelector(selector);
        if (el) {
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
            return true;
        }
        return false;
    };

    // 1. Common Text Fields
    setInputValue('input[formcontrolname="submitterName"]', preset.submitterName);
    setInputValue('input[formcontrolname="plEmail"]', preset.plEmail);

    // Page specific QuickBuildPath detection
    if (hash.includes('smr')) {
        setInputValue('input[formcontrolname="quickBuildPath"]', preset.quickBuildPath);
        setInputValue('input[formcontrolname="scatLink"]', preset.scatLink);
    } else {
        // For Normal/SKU pages
        const qbField = document.querySelector('input[formcontrolname="qbPath"]') || document.querySelector('input[placeholder*="android.qb"]');
        if (qbField && preset.quickBuildPath) {
            qbField.value = preset.quickBuildPath;
            qbField.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // 2. Specialty Selects (CSC Type)
    const cscSelect = document.querySelector('mat-select[formcontrolname="cscType"]');
    if (cscSelect && preset.cscType) {
        const currentVal = cscSelect.querySelector('.mat-mdc-select-value-text')?.textContent.trim();
        if (currentVal !== preset.cscType) {
            console.log("Setting CSC Type to:", preset.cscType);
            const trigger = cscSelect.querySelector('.mat-mdc-select-trigger') || cscSelect;
            trigger.click();
            await sleep(600);
            const options = Array.from(document.querySelectorAll('mat-option, .mat-mdc-option, [role="option"]'));
            for (let opt of options) {
                if (opt.textContent.trim().includes(preset.cscType)) {
                    opt.click();
                    break;
                }
            }
        }
    }

    // 3. Notification Emails
    const emailInput = document.querySelector('input[formcontrolname="notificationEmail"]') ||
        document.querySelector('.mat-mdc-chip-grid input') ||
        document.querySelector('input[placeholder*="Separated by"]');

    if (emailInput && preset.notificationEmails) {
        console.log("Filling Notification Emails...");
        const emails = parseList(preset.notificationEmails);

        const existingChips = Array.from(document.querySelectorAll('.mat-mdc-chip-action-label, .mdc-evolution-chip__text-label, mat-chip-row'))
            .map(chip => chip.textContent.trim().toLowerCase());

        for (let email of emails) {
            const cleanEmail = email.trim().toLowerCase();
            if (!existingChips.some(chipText => chipText.includes(cleanEmail))) {
                emailInput.value = email;
                emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                emailInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                existingChips.push(cleanEmail);
                await sleep(200);
            }
        }
    }

    // 4. Carrier & Countries (SMR only)
    if (hash.includes('smr')) {
        let carrierSelect = document.querySelector('ng-select[formcontrolname="carrier"]');
        if (!carrierSelect) {
            const addCarrierBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Add Career') || btn.textContent.includes('Add another carrier') || btn.textContent.includes('Add Carrier'));
            if (addCarrierBtn) {
                addCarrierBtn.click();
                await sleep(500);
                carrierSelect = document.querySelector('ng-select[formcontrolname="carrier"]');
            }
        }

        if (carrierSelect && preset.carrier) {
            const currentCarrier = carrierSelect.querySelector('.ng-value')?.textContent.trim();
            if (!currentCarrier || !currentCarrier.includes(preset.carrier)) {
                carrierSelect.click();
                await sleep(400);
                const searchInput = carrierSelect.querySelector('input');
                if (searchInput) {
                    searchInput.value = preset.carrier;
                    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    await sleep(300);
                    const ngOptions = document.querySelectorAll('.ng-option');
                    for (let opt of ngOptions) {
                        if (opt.textContent.trim().split('\n')[0].trim() === preset.carrier) {
                            opt.click();
                            break;
                        }
                    }
                }
            }
        }

        const countryDropdown = document.querySelector('ng-multiselect-dropdown[formcontrolname="countries"]');
        if (countryDropdown && preset.countries) {
            const countries = parseList(preset.countries);
            const dropdownBtn = countryDropdown.querySelector('.dropdown-btn');
            if (dropdownBtn) {
                dropdownBtn.click();
                await sleep(400);
                const listItems = countryDropdown.querySelectorAll('.multiselect-item-checkbox');
                for (let item of listItems) {
                    const label = item.textContent.trim();
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    if (countries.some(c => label.includes(c))) {
                        if (checkbox && !checkbox.checked) {
                            item.click();
                            await sleep(100);
                        }
                    }
                }
                if (countryDropdown.querySelector('.dropdown-list:not([hidden])')) {
                    dropdownBtn.click();
                }
            }
        }
    }

    // 5. Automatic File Upload / Dropzone Trigger
    const fileInput = document.querySelector('.uploadfilecontainer input[type="file"]') ||
        document.querySelector('file-drag-drop input[type="file"][accept*=".zip"]') ||
        document.querySelector('input[type="file"][accept*=".zip"]');
    if (fileInput) {
        console.log("Auto-triggering ZIP folder upload...");
        // Guide user visually since directory picker requires user gesture
        highlightDropzone();
        showToast("Select a folder containing ZIP files for auto-upload.", "info");

        try {
            fileInput.click();
        } catch (e) {
            console.warn("Programmatic click on file input failed:", e);
        }
    } else {
        // No file upload dropzone on this page, run the next steps immediately
        triggerNextSteps();
    }

    console.log("Auto-Fill Completed!");
}

// Listen for click events on the dropzone or file input to enable directory selection
document.addEventListener('click', async (event) => {
    // Only active on specific pages
    const hash = window.location.hash;
    const isFolderUploadPage = hash.includes('submit-normal') || hash.includes('smrSecond') || hash.includes('submit-sku');
    if (!isFolderUploadPage) return;

    if (!isInterceptingClick) return; // Allow normal click (file picker) to proceed

    const target = event.target;

    // Find the dropzone container or the file input
    const dropzone = target.closest('.uploadfilecontainer') || target.closest('file-drag-drop');
    const isFileInput = target.tagName === 'INPUT' && target.type === 'file';

    if (dropzone || isFileInput) {
        // Find the input element associated with it
        const fileInput = isFileInput ? target : (dropzone.querySelector('input[type="file"]') || document.querySelector('input[type="file"][accept*=".zip"]'));

        if (fileInput && (!fileInput.accept || fileInput.accept.includes('.zip'))) {
            // Fallback for browsers that don't support showDirectoryPicker (e.g. Firefox or Brave shields)
            if (typeof window.showDirectoryPicker === 'undefined') {
                showToast("Silakan pilih zip files secara manual.", "info");
                return; // Let the default click/file picker open
            }

            // Intercept click to open directory picker instead of file chooser
            event.preventDefault();
            event.stopPropagation();

            // Remove pulsing highlights if active
            removeDropzoneHighlight();

            try {
                console.log("Opening directory picker...");
                const dirHandle = await window.showDirectoryPicker();
                showToast("Reading files from selected folder...", "info");

                const zipFiles = [];
                for await (const entry of dirHandle.values()) {
                    if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.zip')) {
                        const file = await entry.getFile();
                        zipFiles.push(file);
                    }
                }

                if (zipFiles.length === 0) {
                    showToast("No ZIP files found in the selected folder.", "warning");
                    isAutoFilling = false; // Reset autofill state
                    return;
                }

                const dataTransfer = new DataTransfer();
                zipFiles.forEach(file => dataTransfer.items.add(file));
                fileInput.files = dataTransfer.files;

                // Dispatch change event to trigger Angular / framework handler
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                showToast(`Successfully loaded ${zipFiles.length} ZIP file(s) from folder.`, "success");

                // Trigger the next steps automatically if we are in an auto-filling session
                if (isAutoFilling) {
                    isAutoFilling = false;
                    setTimeout(() => {
                        triggerNextSteps();
                    }, 1200); // 1.2s delay to let Angular process the file upload UI
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    // User cancelled the directory picker -> fall back to manual file picker
                    console.log("Directory picker cancelled. Falling back to manual file picker.");
                    isInterceptingClick = false;
                    fileInput.click();
                    setTimeout(() => {
                        isInterceptingClick = true;
                    }, 500);
                } else if (err.name === 'SecurityError' || err.message.toLowerCase().includes('user gesture')) {
                    console.warn("Directory picker blocked due to user gesture requirement. Waiting for user interaction.");
                    highlightDropzone();
                    showToast("Click on the pulsing upload area to select the ZIP folder.", "warning");
                } else {
                    console.error("Error reading directory:", err);
                    showToast("Failed to read directory: " + err.message, "error");
                    isAutoFilling = false;
                }
            }
        }
    }
}, true); // Capture phase is critical to run before other handlers

// Listen for change events on the file input to detect manual file selection
// This handles the case where the user cancelled the folder picker and picked files manually
document.addEventListener('change', (event) => {
    // Only active on specific pages
    const hash = window.location.hash;
    const isFolderUploadPage = hash.includes('submit-normal') || hash.includes('smrSecond') || hash.includes('submit-sku');
    if (!isFolderUploadPage) return;

    const target = event.target;
    if (target && target.tagName === 'INPUT' && target.type === 'file' &&
        (target.accept?.includes('.zip') || target.closest('.uploadfilecontainer') || target.closest('file-drag-drop'))) {

        // Only trigger auto-next if we are in an auto-filling session
        if (isAutoFilling && target.files && target.files.length > 0) {
            isAutoFilling = false;
            showToast(`${target.files.length} file(s) selected. Proceeding...`, "success");
            setTimeout(() => {
                triggerNextSteps();
            }, 1200);
        }
    }
}); // Bubble phase - after Angular processes the change

// Helper functions for visual highlights and toast notifications
function showToast(message, type = 'info') {
    const existing = document.getElementById('bas-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'bas-toast';
    toast.textContent = message;

    let bg = 'rgba(44, 62, 80, 0.95)'; // default dark
    let border = '1px solid rgba(255, 255, 255, 0.2)';
    if (type === 'success') {
        bg = 'rgba(26, 188, 156, 0.95)'; // primary teal
        border = '1px solid #1abc9c';
    } else if (type === 'error') {
        bg = 'rgba(231, 76, 60, 0.95)'; // red
        border = '1px solid #e74c3c';
    } else if (type === 'warning') {
        bg = 'rgba(241, 196, 15, 0.95)'; // yellow
        border = '1px solid #f1c40f';
    }

    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: ${bg};
        border: ${border};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        z-index: 100001;
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: none;
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
    }, 50);

    // Animate out
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

function highlightDropzone() {
    const dropzone = document.querySelector('.uploadfilecontainer') ||
        document.querySelector('file-drag-drop') ||
        document.querySelector('[appdragdrop]');
    if (dropzone) {
        dropzone.style.transition = 'all 0.3s ease';
        dropzone.style.border = '3px dashed #1abc9c';
        dropzone.style.backgroundColor = 'rgba(26, 188, 156, 0.1)';
        dropzone.style.animation = 'bas-pulse 1.5s infinite alternate';

        if (!document.getElementById('bas-pulse-style')) {
            const style = document.createElement('style');
            style.id = 'bas-pulse-style';
            style.innerHTML = `
                @keyframes bas-pulse {
                    from { box-shadow: 0 0 5px rgba(26, 188, 156, 0.2); }
                    to { box-shadow: 0 0 20px rgba(26, 188, 156, 0.6); }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

function removeDropzoneHighlight() {
    const dropzone = document.querySelector('.uploadfilecontainer') ||
        document.querySelector('file-drag-drop') ||
        document.querySelector('[appdragdrop]');
    if (dropzone) {
        dropzone.style.border = '';
        dropzone.style.backgroundColor = '';
        dropzone.style.animation = '';
    }
}

// Wait until the progress bar reaches 100% (aria-valuenow="100" or style width 100%)
async function waitForProgressBar(timeoutMs = 120000) {
    const startTime = Date.now();
    showToast("Waiting for upload to complete (100%)...", "info");
    while (Date.now() - startTime < timeoutMs) {
        const bar = document.querySelector('.progress-bar.progress-bar-info');
        if (bar) {
            const valuenow = parseInt(bar.getAttribute('aria-valuenow') || '0', 10);
            const widthStyle = parseFloat(bar.style.width || '0');
            if (valuenow >= 100 || widthStyle >= 100) {
                console.log("Progress bar reached 100%.");
                return true;
            }
            // Show current progress in toast every ~2 seconds
            const pct = valuenow || widthStyle;
            if (Math.round(Date.now() / 2000) % 1 === 0) {
                showToast(`Uploading... ${pct}%`, "info");
            }
        }
        await sleep(500);
    }
    console.warn("Timed out waiting for progress bar to reach 100%.");
    return false;
}

// Auto-scroll to bottom, wait for 100% progress, click Next, then click Proceed
async function triggerNextSteps() {
    isAutoFilling = false; // Reset state
    console.log("Auto-scrolling to bottom and clicking Next...");
    showToast("Scrolling to bottom...", "info");
    await sleep(800);

    // Smooth scroll to bottom of the page
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    document.documentElement.scrollTop = document.documentElement.scrollHeight;
    await sleep(800); // Wait for scroll animation

    // Wait until upload progress bar reaches 100% before proceeding
    const isComplete = await waitForProgressBar(120000); // up to 2 minutes
    if (!isComplete) {
        showToast("Upload progress timed out. Proceeding anyway...", "warning");
    }
    await sleep(500); // Brief pause after 100%

    showToast("Clicking Next...", "info");
    const clickedNext = await waitAndClickButton("Next", 8000);

    if (clickedNext) {
        showToast("Waiting for Proceed modal...", "info");
        await sleep(500); // Give modal time to appear
        const clickedProceed = await waitAndClickButton("Proceed", 8000);
        if (clickedProceed) {
            showToast("Proceed clicked!", "success");
        } else {
            console.warn("Proceed button not found within timeout.");
        }
    }
}

// Helper to find a button by its text content
function findButtonByText(text) {
    const term = text.toLowerCase().trim();

    // 1. Search in standard button elements
    for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.toLowerCase().includes(term)) {
            return btn;
        }
    }

    // 2. Search in custom elements with role="button" or common button classes
    for (const el of document.querySelectorAll('[role="button"], .btn, .button, .bas-primary-btn, .mdc-button')) {
        if (el.textContent.toLowerCase().includes(term)) {
            return el;
        }
    }

    // 3. Search in span elements (like inside material/mdc buttons)
    for (const span of document.querySelectorAll('span.mdc-button__label, span.button-text')) {
        if (span.textContent.toLowerCase().includes(term)) {
            const parentButton = span.closest('button, [role="button"], a');
            if (parentButton) return parentButton;
            return span;
        }
    }

    return null;
}

// Helper to poll for a button and click it once it is clickable
async function waitAndClickButton(text, timeoutMs = 6000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        const btn = findButtonByText(text);
        if (btn && !btn.disabled && btn.offsetParent !== null) { // Visible and not disabled
            console.log(`Found and clicking button: "${text}"`);
            btn.click();
            return true;
        }
        await sleep(250); // check every 250ms
    }
    console.warn(`Button "${text}" not found or not clickable within ${timeoutMs}ms.`);
    return false;
}

// MutationObserver: Auto-close modals that contain a success header (.modal-header.success)
// And handle specific CSC error modals automatically
const modalObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;

            // Check if a modal/dialog container was added
            const isDialog = node.matches?.('mat-dialog-container, .mat-mdc-dialog-container, .modal, [role="dialog"], .cdk-overlay-container, .cdk-global-overlay-wrapper')
                          || node.querySelector?.('mat-dialog-container, .mat-mdc-dialog-container, .modal, [role="dialog"]');

            if (isDialog) {
                // Small delay to let Angular render the modal's inner content
                setTimeout(async () => {
                    const dialogRoot = node.matches?.('mat-dialog-container, .mat-mdc-dialog-container, [role="dialog"]')
                        ? node
                        : node.querySelector('mat-dialog-container, .mat-mdc-dialog-container, [role="dialog"]');

                    if (!dialogRoot) return;

                    // 1. Detect CSC type error modal:
                    // Class matches or contains the error text: "CSC type Normal is not allowed for OS version... Allowed CSC types are..."
                    const modalMsgEl = dialogRoot.querySelector('.modal-message');
                    const modalMsgText = modalMsgEl ? modalMsgEl.textContent : '';
                    if (modalMsgText.includes("CSC type Normal is not allowed") && modalMsgText.includes("Allowed CSC types are")) {
                        console.log("CSC type mismatch error modal detected. Auto-adjusting to MultiCSC...");
                        showToast("CSC type Normal not allowed. Changing to MultiCSC...", "warning");

                        // Find close button for this error modal and click it
                        const errorCloseBtn = dialogRoot.querySelector('.btn-close') ||
                                              dialogRoot.querySelector('#btn-close') ||
                                              dialogRoot.querySelector('button');
                        if (errorCloseBtn) {
                            errorCloseBtn.click();
                        }

                        await sleep(500);

                        // Change CSC type to MultiCSC
                        const cscSelect = document.querySelector('mat-select[formcontrolname="cscType"]');
                        if (cscSelect) {
                            const trigger = cscSelect.querySelector('.mat-mdc-select-trigger') || cscSelect;
                            trigger.click();
                            await sleep(600);
                            const options = Array.from(document.querySelectorAll('mat-option, .mat-mdc-option, [role="option"]'));
                            for (let opt of options) {
                                if (opt.textContent.trim().includes("MultiCSC")) {
                                    opt.click();
                                    showToast("CSC Type set to MultiCSC. Retrying Next...", "success");
                                    break;
                                }
                            }
                        }

                        await sleep(800);

                        // Re-trigger the Next steps flow
                        triggerNextSteps();
                        return;
                    }

                    // 2. Only auto-close modals that have a .modal-header.success element
                    const hasSuccessHeader = dialogRoot.querySelector('.modal-header.success');
                    if (!hasSuccessHeader) {
                        console.log("Modal detected but no .modal-header.success — skipping auto-close.");
                        return;
                    }

                    // Find the close button
                    const closeBtn = dialogRoot.querySelector('.btn-close') ||
                                     dialogRoot.querySelector('#btn-close') ||
                                     dialogRoot.querySelector('[aria-label*="close" i]') ||
                                     dialogRoot.querySelector('[aria-label*="Close" i]') ||
                                     dialogRoot.querySelector('button[mat-dialog-close]') ||
                                     dialogRoot.querySelector('button[matdialogclose]') ||
                                     Array.from(dialogRoot.querySelectorAll('button')).find(btn =>
                                         btn.textContent.trim().toLowerCase() === 'close' ||
                                         btn.textContent.trim() === '\u00d7' ||
                                         btn.textContent.trim() === 'X'
                                     );

                    if (closeBtn && !closeBtn.disabled) {
                        console.log("Auto-closing success modal...");
                        closeBtn.click();
                    }
                }, 400);
            }
        }
    }
});

// Start observing DOM for modal additions
modalObserver.observe(document.body, { childList: true, subtree: true });

// Trigger BAS session sync to local Project Manager
try {
    if (api && api.runtime && api.runtime.sendMessage) {
        api.runtime.sendMessage({ action: "sync_bas_session" }, () => {
            if (api.runtime.lastError) {
                // Ignore silent error
            }
        });
    }
} catch (e) {
    // Ignore error
}
