// Use chrome for universal compatibility
const api = typeof browser !== "undefined" ? browser : chrome;

// Add a listener for messages from the popup
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fillForm") {
        fillBASForm();
    }
});

const DATA = {
    submitterName: "Endri Susanto",
    plEmail: "danar.kurnia@samsung.com",
    cscType: "MainCSC",
    quickBuildPath: "https://android.qb.sec.samsung.net/build/106894213",
    scatLink: "https://mobilerndhub.sec.samsung.net/scat/test/2956447",
    notificationEmails: ["endri.s@samsung.com", "lufti.b@samsung.com", "apta.p@samsung.com", "danar.kurnia@samsung.com", "aulia.am@samsung.com"],
    carrier: "XID",
    countries: ["Indonesia"]
};

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

    btn.innerHTML = `⚡ AUTO FILL ${pageLabel}`;
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
        btn.innerHTML = 'Filling...';
        btn.disabled = true;
        await fillBASForm();
        btn.innerHTML = 'Done! ✨';
        
        btn.classList.add('minimized');
        btn.style.top = 'auto';
        btn.style.left = 'auto';
        btn.style.bottom = '20px';
        btn.style.right = '20px';
        btn.style.transform = 'none';
        btn.style.padding = '10px 20px';
        btn.style.fontSize = '14px';
        btn.style.background = 'rgba(26, 188, 156, 0.9)';
        btn.style.border = '1px solid white';
        
        setTimeout(() => {
            btn.innerHTML = `⚡ RE-FILL ${pageLabel}`;
            btn.disabled = false;
        }, 2000);
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
setInterval(injectOverlayButton, 1000);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fillBASForm() {
    console.log("Starting Auto-Fill...");
    const hash = window.location.hash;

    const setInputValue = (selector, value) => {
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
    setInputValue('input[formcontrolname="submitterName"]', DATA.submitterName);
    setInputValue('input[formcontrolname="plEmail"]', DATA.plEmail);
    
    // Page specific QuickBuildPath detection
    if (hash.includes('smr')) {
        setInputValue('input[formcontrolname="quickBuildPath"]', DATA.quickBuildPath);
        setInputValue('input[formcontrolname="scatLink"]', DATA.scatLink);
    } else {
        // For Normal/SKU pages
        const qbField = document.querySelector('input[formcontrolname="qbPath"]') || document.querySelector('input[placeholder*="android.qb"]');
        if (qbField) {
            qbField.value = DATA.quickBuildPath;
            qbField.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // 2. Specialty Selects (CSC Type)
    // Run on any page that has the cscType mat-select
    const cscSelect = document.querySelector('mat-select[formcontrolname="cscType"]');
    if (cscSelect) {
        const currentVal = cscSelect.querySelector('.mat-mdc-select-value-text')?.textContent.trim();
        if (currentVal !== DATA.cscType) {
            console.log("Setting CSC Type to:", DATA.cscType);
            const trigger = cscSelect.querySelector('.mat-mdc-select-trigger') || cscSelect;
            trigger.click();
            await sleep(600);
            const options = Array.from(document.querySelectorAll('mat-option, .mat-mdc-option, [role="option"]'));
            for (let opt of options) {
                if (opt.textContent.trim().includes(DATA.cscType)) {
                    opt.click();
                    break;
                }
            }
        }
    }

    // 3. Notification Emails (Check for duplicates)
    // Find notification input more aggressively
    const emailInput = document.querySelector('input[formcontrolname="notificationEmail"]') || 
                       document.querySelector('.mat-mdc-chip-grid input') ||
                       document.querySelector('input[placeholder*="Separated by"]');
    
    if (emailInput) {
        console.log("Filling Notification Emails...");
        // Get existing chips text
        const existingChips = Array.from(document.querySelectorAll('.mat-mdc-chip-action-label, .mdc-evolution-chip__text-label, mat-chip-row'))
            .map(chip => chip.textContent.trim().toLowerCase());

        for (let email of DATA.notificationEmails) {
            const cleanEmail = email.trim().toLowerCase();
            // Check if email is already in the list
            if (!existingChips.some(chipText => chipText.includes(cleanEmail))) {
                emailInput.value = email;
                emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                emailInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                existingChips.push(cleanEmail);
                await sleep(200);
            } else {
                console.log("Skipping duplicate email:", email);
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

        if (carrierSelect) {
            const currentCarrier = carrierSelect.querySelector('.ng-value')?.textContent.trim();
            if (!currentCarrier || !currentCarrier.includes(DATA.carrier)) {
                carrierSelect.click();
                await sleep(400);
                const searchInput = carrierSelect.querySelector('input');
                if (searchInput) {
                    searchInput.value = DATA.carrier;
                    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    await sleep(300);
                    const ngOptions = document.querySelectorAll('.ng-option');
                    for (let opt of ngOptions) {
                        if (opt.textContent.trim().split('\n')[0].trim() === DATA.carrier) {
                            opt.click();
                            break;
                        }
                    }
                }
            }
        }

        const countryDropdown = document.querySelector('ng-multiselect-dropdown[formcontrolname="countries"]');
        if (countryDropdown) {
            const dropdownBtn = countryDropdown.querySelector('.dropdown-btn');
            if (dropdownBtn) {
                dropdownBtn.click();
                await sleep(400);
                const listItems = countryDropdown.querySelectorAll('.multiselect-item-checkbox');
                for (let item of listItems) {
                    const label = item.textContent.trim();
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    if (DATA.countries.some(c => label.includes(c))) {
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

    console.log("Auto-Fill Completed!");
}
