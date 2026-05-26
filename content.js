// Use chrome for universal compatibility
const api = typeof browser !== "undefined" ? browser : chrome;

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

// Periodically check for injection (Better for SPAs)
setInterval(() => {
    injectOverlayButton();
    autoSelectCategoryEmail();
    autoCloseSuccessModal();
}, 1000);

async function autoSelectCategoryEmail() {
    const hash = window.location.hash;
    if (!hash.includes('ongoing-submissions') && !hash.includes('mysubmissions-submitter')) return;
    
    // Find Choose Category dropdown
    const matSelects = document.querySelectorAll('mat-select');
    let categorySelect = null;
    
    for (let select of matSelects) {
        const placeholder = select.getAttribute('placeholder') || "";
        const label = select.closest('mat-form-field')?.querySelector('mat-label')?.textContent || "";
        if (placeholder.includes('Choose Category') || label.includes('Choose Category')) {
            categorySelect = select;
            break;
        }
    }
    
    // Fallback: if we are on ongoing-submissions and can't find by label, 
    // it's likely the only mat-select or the first one.
    if (!categorySelect) categorySelect = matSelects[0];

    if (categorySelect) {
        const valueText = categorySelect.querySelector('.mat-mdc-select-value-text, .mat-select-value-text');
        const currentVal = valueText?.textContent.trim();
        
        // Only auto-fill if it's not already "Email" and we haven't done it this "session"
        // We use a property to avoid overriding user changes repeatedly
        if (currentVal !== "Email" && !categorySelect.getAttribute('data-auto-filled')) {
            console.log("Auto-selecting Category: Email");
            const trigger = categorySelect.querySelector('.mat-mdc-select-trigger') || categorySelect;
            trigger.click();
            
            // Wait for the panel to appear
            await sleep(500);
            
            const options = Array.from(document.querySelectorAll('mat-option, .mat-mdc-option, [role="option"]'));
            let found = false;
            for (let opt of options) {
                if (opt.textContent.trim() === "Email") {
                    opt.click();
                    categorySelect.setAttribute('data-auto-filled', 'true');
                    found = true;
                    break;
                }
            }
            
            // If not found, maybe the panel didn't open or it's different.
            // Don't mark as auto-filled so it can try again.
            if (!found) {
                // Click outside to close panel if it stayed open
                document.body.click();
            }
        }
    } else {
        // If we leave the page, the button/select might be gone, 
        // but just to be safe, we don't need to reset anything here 
        // as categorySelect is local to the function call.
    }
}

function autoCloseSuccessModal() {
    // Search for modal-header with class success
    const successHeader = document.querySelector('.modal-header.success') || 
                          Array.from(document.querySelectorAll('.modal-header')).find(el => el.textContent.toLowerCase().includes('success') || el.classList.contains('success'));
    
    if (successHeader) {
        // Find the modal container to search specifically inside it first
        const modalContainer = successHeader.closest('.modal, mat-dialog-container, .modal-content, .modal-dialog') || document.body;
        
        // Find close button
        const closeBtn = modalContainer.querySelector('.btn-close') || 
                         modalContainer.querySelector('.close') || 
                         modalContainer.querySelector('button[aria-label="Close"]') ||
                         successHeader.querySelector('.btn-close, .close') ||
                         document.querySelector('.btn-close') ||
                         document.querySelector('.close');
        
        if (closeBtn) {
            console.log("Success modal detected! Auto-clicking close button...");
            closeBtn.click();
            showToast("Successfully submitted and auto-closed success modal! ✨", "success");
        }
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fillBASForm(preset) {
    console.log("Starting Auto-Fill with preset:", preset.name);
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
        // If there is no file uploader on this page, proceed directly with form submission steps
        setTimeout(proceedSteps, 1000);
    }

    console.log("Auto-Fill Completed!");
}

// Helper to extract the model name from the page inputs
function getModelName() {
    const baseModelEl = document.querySelector('input[formcontrolname="baseModel"]');
    if (baseModelEl && baseModelEl.value) {
        return baseModelEl.value.trim();
    }
    const pdaVersionEl = document.querySelector('input[formcontrolname="pdaVersion"]') || 
                         document.querySelector('input[placeholder*="PDA"]');
    if (pdaVersionEl && pdaVersionEl.value) {
        const val = pdaVersionEl.value.trim();
        const match = val.match(/^([A-Z]\d{3}[A-Z])/i);
        if (match) {
            return "SM-" + match[1].toUpperCase();
        }
    }
    return "";
}

// Listen for click events on the dropzone or file input to enable directory selection or auto-bypass via local server
document.addEventListener('click', async (event) => {
    // Only active on specific pages
    const hash = window.location.hash;
    const isFolderUploadPage = hash.includes('submit-normal') || hash.includes('smrSecond') || hash.includes('submit-sku');
    if (!isFolderUploadPage) return;

    const target = event.target;
    
    // Find the dropzone container or the file input
    const dropzone = target.closest('.uploadfilecontainer') || target.closest('file-drag-drop');
    const isFileInput = target.tagName === 'INPUT' && target.type === 'file';
    
    if (dropzone || isFileInput) {
        // Find the input element associated with it
        const fileInput = isFileInput ? target : (dropzone.querySelector('input[type="file"]') || document.querySelector('input[type="file"][accept*=".zip"]'));
        
        if (fileInput && (!fileInput.accept || fileInput.accept.includes('.zip'))) {
            // If this is a fallback click triggered from the catch block, let it proceed to open the native dialog
            if (fileInput.dataset.bypassFallback === 'true') {
                fileInput.dataset.bypassFallback = 'false';
                return;
            }

            // Prevent default click behavior synchronously to block native file dialog
            event.preventDefault();
            event.stopPropagation();
            
            // Remove pulsing highlights if active
            removeDropzoneHighlight();

            const modelName = getModelName();
            console.log("Attempting auto-bypass for folder selection using model:", modelName);
            
            try {
                showToast("Bypassing picker. Fetching zip files from local server...", "info");
                
                const response = await fetch(`http://127.0.0.1:19000/get-zips?model=${encodeURIComponent(modelName)}`);
                if (!response.ok) throw new Error("Local server error: " + response.status);
                
                const data = await response.json();
                if (!data.files || data.files.length === 0) {
                    showToast(`No zip files found in local folder: ${data.folder}`, "warning");
                    return;
                }
                
                const zipFiles = data.files.map(f => {
                    const binary = atob(f.content);
                    const array = [];
                    for (let i = 0; i < binary.length; i++) {
                        array.push(binary.charCodeAt(i));
                    }
                    const blob = new Blob([new Uint8Array(array)], { type: 'application/zip' });
                    return new File([blob], f.name, { type: 'application/zip' });
                });
                
                const dataTransfer = new DataTransfer();
                zipFiles.forEach(file => dataTransfer.items.add(file));
                fileInput.files = dataTransfer.files;
                
                // Dispatch change event to let Angular process the files
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                showToast(`Auto-uploaded ${zipFiles.length} zip file(s) from: ${data.folder.split('/').pop()}`, "success");
                
                // Automatically proceed with Next -> Proceed -> Update steps
                setTimeout(proceedSteps, 1000);
            } catch (err) {
                console.warn("Local server auto-bypass failed, falling back to manual picker:", err);
                
                // Set fallback flag, enable directory selection, and trigger click again
                fileInput.webkitdirectory = true;
                fileInput.directory = true;
                fileInput.dataset.bypassFallback = 'true';
                fileInput.click();
            }
        }
    }
}, true); // Capture phase is critical to run before other handlers

// Listen for change events on the file input to filter and handle manual folder selection (when helper server is not running)
document.addEventListener('change', (event) => {
    // Only active on specific pages
    const hash = window.location.hash;
    const isFolderUploadPage = hash.includes('submit-normal') || hash.includes('smrSecond') || hash.includes('submit-sku');
    if (!isFolderUploadPage) return;

    const target = event.target;
    if (target && target.tagName === 'INPUT' && target.type === 'file' && target.webkitdirectory) {
        // Stop default propagation so we can filter files before the web app processes them
        event.stopPropagation();
        
        const originalFiles = Array.from(target.files);
        const zipFiles = originalFiles.filter(file => file.name.toLowerCase().endsWith('.zip'));
        
        console.log(`Manual folder upload triggered. Found ${zipFiles.length} zip files out of ${originalFiles.length} files.`);
        
        // Reset webkitdirectory so subsequent normal clicks behave normally
        target.webkitdirectory = false;
        target.directory = false;
        
        if (zipFiles.length === 0) {
            showToast("No .zip files found in the selected folder.", "warning");
            target.value = null; // Reset value
            return;
        }

        // Set the filtered ZIP files to the input files using DataTransfer
        const dataTransfer = new DataTransfer();
        zipFiles.forEach(file => dataTransfer.items.add(file));
        target.files = dataTransfer.files;
        
        // Dispatch new change event to let Angular/framework handle it
        target.dispatchEvent(new Event('change', { bubbles: true }));
        showToast(`Successfully uploaded ${zipFiles.length} ZIP file(s) from folder.`, "success");
        
        // Automatically proceed with Next -> Proceed -> Update steps
        setTimeout(proceedSteps, 1000);
    }
}, true); // Capture phase

// Step-by-step automation: Next -> Proceed (modal) -> Update
async function proceedSteps() {
    console.log("Starting next steps automation...");
    
    // Wait for any file uploads or spinners to complete
    await sleep(1500);
    let attempts = 0;
    while (attempts < 12) {
        const progressBar = document.querySelector('.progress-bar');
        const spinner = document.querySelector('ngx-spinner') || document.querySelector('.spinner-container') || document.querySelector('.spinner');
        const isUploading = (progressBar && progressBar.style.width !== '100%' && progressBar.style.width !== '0%' && progressBar.style.width !== '') || 
                            (spinner && (spinner.style.display !== 'none' && !spinner.classList.contains('hidden')));
        if (!isUploading) break;
        
        console.log("Upload or page spinner is active, waiting...");
        await sleep(1000);
        attempts++;
    }

    // 1. Click "Next" button
    console.log("Clicking 'Next' button...");
    const nextBtn = Array.from(document.querySelectorAll('button')).find(btn => {
        const text = btn.textContent.trim().toLowerCase();
        return text === 'next' || btn.classList.contains('bas-primary-btn');
    }) || document.querySelector('.bas-primary-btn');

    if (nextBtn) {
        nextBtn.click();
        showToast("Clicked 'Next'. Waiting for modal...", "info");
        await sleep(1500); // Wait for modal to load

        // 2. Click "Proceed" button in the modal
        console.log("Looking for 'Proceed' button...");
        const proceedBtn = Array.from(document.querySelectorAll('button, [role="button"], span')).find(el => {
            const text = el.textContent.trim().toLowerCase();
            return text === 'proceed' || text === 'yes, proceed' || text.includes('proceed');
        });

        if (proceedBtn) {
            proceedBtn.click();
            showToast("Clicked 'Proceed'. Waiting for transition...", "info");
            await sleep(1500); // Wait for page transition / update button load

            // 3. Click "Update" button
            console.log("Looking for 'Update' button...");
            const updateBtn = Array.from(document.querySelectorAll('button, [role="button"], span')).find(el => {
                const text = el.textContent.trim().toLowerCase();
                return text === 'update' || text === 'submit' || text.includes('update');
            });

            if (updateBtn) {
                updateBtn.click();
                showToast("Form successfully updated/submitted! ✨", "success");
            } else {
                console.warn("'Update' button not found.");
                showToast("Click 'Update' to finish submission.", "warning");
            }
        } else {
            console.warn("'Proceed' button not found on modal.");
            showToast("Click 'Proceed' on the dialog to continue.", "warning");
        }
    } else {
        console.warn("'Next' button not found.");
        showToast("Click 'Next' to continue.", "warning");
    }
}

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
