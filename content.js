// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'applyToken') {
        applyTokenToSwagger(request.token, request.tokenName);
        sendResponse({ success: true });
    } else if (request.action === 'toggleParamLock') {
        toggleParameterLock(request.enabled);
        sendResponse({ success: true });
    }
    return true;
});

function logoutExistingToken() {
    console.log('Starting aggressive logout...');

    try {
        // Method 1: Click the Logout button in Swagger UI modal (most reliable!)
        const authorizeBtn = document.querySelector('.btn.authorize') ||
            document.querySelector('button.authorize') ||
            document.querySelector('.auth-wrapper .authorize');

        if (authorizeBtn) {
            authorizeBtn.click();
            console.log('Opened authorize modal');

            // Wait for modal to open and click Logout button
            setTimeout(() => {
                // Find Logout button: class="btn modal-btn auth button"
                const logoutBtn = document.querySelector('button.btn.modal-btn.auth.button') ||
                    document.querySelector('.auth-btn-wrapper button') ||
                    Array.from(document.querySelectorAll('button.modal-btn')).find(btn =>
                        btn.textContent.trim().toLowerCase() === 'logout'
                    );

                if (logoutBtn && logoutBtn.textContent.trim().toLowerCase() === 'logout') {
                    logoutBtn.click();
                    console.log('Clicked Logout button in UI');

                    // Close the modal after logout
                    setTimeout(() => {
                        const closeBtn = document.querySelector('.close-modal') ||
                            document.querySelector('button.btn-done') ||
                            document.querySelector('.btn.modal-btn.auth.btn-done.button');
                        if (closeBtn) {
                            closeBtn.click();
                            console.log('Closed auth modal');
                        }
                    }, 100);
                }
            }, 200);
        }

        // Method 2: Logout via Swagger UI API - ALL authorization types
        if (window.ui) {
            try {
                // Try to get all security definitions from spec
                const state = window.ui.getState();
                if (state && typeof state.toJS === 'function') {
                    const spec = state.toJS().spec;
                    if (spec && spec.securityDefinitions) {
                        Object.keys(spec.securityDefinitions).forEach(authName => {
                            try {
                                window.ui.authActions.logout([authName]);
                                console.log(`API Logged out: ${authName}`);
                            } catch (e) {
                                console.warn(`Failed to logout ${authName}:`, e);
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn('Could not read spec security definitions:', e);
            }

            // Also force logout common names
            const commonAuthNames = ['Bearer', 'bearer', 'api_key', 'apiKey', 'API_KEY', 'Authorization', 'authorization'];
            commonAuthNames.forEach(authName => {
                try {
                    window.ui.authActions.logout([authName]);
                } catch (e) { /* ignore */ }
            });

            console.log('Swagger UI API logout completed');
        }

        // Method 3: Logout via SwaggerUIBundle
        if (window.SwaggerUIBundle && window.SwaggerUIBundle.authActions) {
            const commonAuthNames = ['Bearer', 'bearer', 'api_key', 'apiKey', 'API_KEY', 'Authorization'];
            commonAuthNames.forEach(authName => {
                try {
                    window.SwaggerUIBundle.authActions.logout([authName]);
                } catch (e) { /* ignore */ }
            });
            console.log('SwaggerUIBundle logout completed');
        }

        // Method 4: NUCLEAR OPTION - Clear ALL auth-related localStorage
        const localStorageKeysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Skip our own storage key
            if (key && key !== 'swagger_token_manager_auth') {
                // Remove if contains auth-related keywords
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('authorized') ||
                    lowerKey.includes('auth') ||
                    lowerKey.includes('bearer') ||
                    lowerKey.includes('token') ||
                    lowerKey.includes('swagger') ||
                    lowerKey.includes('api')) {
                    localStorageKeysToRemove.push(key);
                }
            }
        }

        localStorageKeysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`Removed localStorage: ${key}`);
        });

        // Method 5: Clear sessionStorage
        const sessionStorageKeysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) {
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('authorized') ||
                    lowerKey.includes('auth') ||
                    lowerKey.includes('bearer') ||
                    lowerKey.includes('token')) {
                    sessionStorageKeysToRemove.push(key);
                }
            }
        }

        sessionStorageKeysToRemove.forEach(key => {
            sessionStorage.removeItem(key);
            console.log(`Removed sessionStorage: ${key}`);
        });

        console.log('Aggressive logout completed');

    } catch (error) {
        console.error('Error during logout:', error);
    }
}

// Apply token to Swagger UI
function applyTokenToSwagger(token, tokenName) {
    try {
        console.log(`Applying token: ${tokenName}`);
        
        updateActiveTokenBadge(null); // Clear current badge temporarily

        // First, logout existing token
        logoutExistingToken();

        // Longer delay to ensure logout completes (including button clicks + API + storage clearing)
        setTimeout(() => {
            applyNewToken(token, tokenName);
        }, 500);

    } catch (error) {
        console.error('Error in applyTokenToSwagger:', error);
    }
}

// Apply new token after logout
function applyNewToken(token, tokenName) {
    try {
        // Method 1: Try to find Swagger UI instance in window
        if (window.ui) {
            // Swagger UI 3.x and later
            window.ui.authActions.authorize({
                Bearer: {
                    name: 'Bearer',
                    schema: {
                        type: 'apiKey',
                        in: 'header',
                        name: 'Authorization',
                        description: ''
                    },
                    value: token
                }
            });

            console.log(`Token "${tokenName}" applied successfully via Swagger UI API`);
            showSuccessMessage(`Token "${tokenName}" đã được áp dụng`);
            updateActiveTokenBadge(tokenName);

            // Save to localStorage for persistence
            localStorage.setItem('swagger_token_manager_auth', JSON.stringify({
                token: token,
                tokenName: tokenName,
                appliedAt: new Date().toISOString()
            }));
            return;
        }

        // Method 2: Try to access through presets
        if (window.SwaggerUIBundle) {
            const swaggerUI = window.SwaggerUIBundle;
            if (swaggerUI && swaggerUI.authActions) {
                swaggerUI.authActions.authorize({
                    Bearer: {
                        value: token
                    }
                });

                console.log(`Token "${tokenName}" applied successfully via SwaggerUIBundle`);
                showSuccessMessage(`Token "${tokenName}" đã được áp dụng`);
                updateActiveTokenBadge(tokenName);

                // Save to localStorage for persistence
                localStorage.setItem('swagger_token_manager_auth', JSON.stringify({
                    token: token,
                    tokenName: tokenName,
                    appliedAt: new Date().toISOString()
                }));
                return;
            }
        }

        // Method 3: Try to inject via localStorage for persistence
        localStorage.setItem('swagger_token_manager_auth', JSON.stringify({
            token: token,
            tokenName: tokenName,
            appliedAt: new Date().toISOString()
        }));

        // Method 4: Try to click authorize button and fill in the token
        setTimeout(() => {
            const authorizeBtn = document.querySelector('.btn.authorize') ||
                document.querySelector('button.authorize') ||
                document.querySelector('.auth-wrapper .authorize');

            if (authorizeBtn) {
                authorizeBtn.click();

                setTimeout(() => {
                    // First, clear any existing token in the input
                    const tokenInput = document.querySelector('input[name="Bearer"]') ||
                        document.querySelector('input[type="text"][placeholder*="auth"]') ||
                        document.querySelector('.auth-container input[type="text"]');

                    if (tokenInput) {
                        // Clear existing value first
                        tokenInput.value = '';
                        tokenInput.dispatchEvent(new Event('input', { bubbles: true }));

                        // Then set new token
                        setTimeout(() => {
                            tokenInput.value = token;
                            tokenInput.dispatchEvent(new Event('input', { bubbles: true }));
                            tokenInput.dispatchEvent(new Event('change', { bubbles: true }));

                            // Click authorize button in modal
                            setTimeout(() => {
                                const authModalBtn = document.querySelector('.auth-btn-wrapper .authorize') ||
                                    document.querySelector('button.btn.modal-btn.auth.authorize');

                                if (authModalBtn) {
                                    authModalBtn.click();
                                    console.log(`Token "${tokenName}" applied via UI interaction`);
                                    showSuccessMessage(`Token "${tokenName}" đã được áp dụng`);
                                    updateActiveTokenBadge(tokenName);

                                    // Close modal
                                    setTimeout(() => {
                                        const closeBtn = document.querySelector('.close-modal') ||
                                            document.querySelector('button.btn.modal-btn.auth.btn-done');
                                        if (closeBtn) closeBtn.click();
                                    }, 300);
                                }
                            }, 200);
                        }, 100);
                    }
                }, 300);
            } else {
                console.log('Authorize button not found, token saved to localStorage');
                showSuccessMessage(`Token "${tokenName}" đã được áp dụng`);
                updateActiveTokenBadge(tokenName);
            }
        }, 100);

    } catch (error) {
        console.error('Error applying new token:', error);
    }
}

// Show success message on the page
function showSuccessMessage(message) {
    // Remove existing message if any
    const existing = document.getElementById('swagger-token-manager-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'swagger-token-manager-notification';
    notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #84cfadff 0%, #49cc90 100%);
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      font-weight: 600;
      animation: slideInRight 0.3s ease-out;
    ">
      ${message}
    </div>
    <style>
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    </style>
  `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.transition = 'all 0.3s ease-out';
        notification.style.transform = 'translateX(400px)';
        notification.style.opacity = '0';

        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Show a persistent badge with the active token name
function updateActiveTokenBadge(tokenName) {
    let badge = document.getElementById('swagger-active-token-badge');
    
    if (!tokenName) {
        if (badge) badge.remove();
        return;
    }
    
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'swagger-active-token-badge';
        badge.title = 'Token đang được áp dụng';
        badge.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: #49cc90;
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 999998;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: default;
        `;
        document.body.appendChild(badge);
    }
    badge.innerHTML = `
        <span style="font-size: 14px;">🔑</span>
        <span>${tokenName}</span>
    `;
}

// Wait for Swagger UI to be fully ready - specifically wait for Authorize button
function waitForSwaggerReady(callback, maxWaitTime = 15000) {
    const startTime = Date.now();
    const checkInterval = 200; // Check every 200ms

    const checkReady = () => {
        // Specifically check for Authorize button - means docs are fully loaded
        const authorizeBtn = document.querySelector('.btn.authorize') ||
            document.querySelector('button.authorize') ||
            document.querySelector('.auth-wrapper .authorize');

        if (authorizeBtn) {
            console.log('Swagger UI fully loaded (Authorize button found)!');
            // Wait a bit more to ensure everything is rendered
            setTimeout(() => callback(), 300);
        } else if (Date.now() - startTime < maxWaitTime) {
            // Continue waiting
            console.log('Waiting for Authorize button to appear...');
            setTimeout(checkReady, checkInterval);
        } else {
            console.warn('Timeout waiting for Swagger UI Authorize button');
            // Still try to apply even if timeout
            callback();
        }
    };

    checkReady();
}

// Auto-apply saved token on page load if available
window.addEventListener('load', () => {
    const savedAuth = localStorage.getItem('swagger_token_manager_auth');
    if (savedAuth) {
        try {
            const authData = JSON.parse(savedAuth);
            console.log('Waiting for Swagger docs to load (Authorize button)...');
            console.log('Token to apply:', authData.tokenName);

            // Immediately show badge on page load if we have a saved token
            updateActiveTokenBadge(authData.tokenName);

            // Wait for Swagger UI to be ready (Authorize button appears)
            waitForSwaggerReady(() => {
                console.log('Authorize button found, applying token now...');
                // Use applyNewToken directly as there's no existing token on fresh page load
                applyNewToken(authData.token, authData.tokenName);
            });
        } catch (error) {
            console.error('Error auto-applying token:', error);
        }
    }

    // Check if parameter lock is enabled and restore parameters
    checkAndRestoreParameters();
});

// ===== PARAMETER LOCK FEATURE =====

let parameterLockEnabled = false;
let saveDebounceTimer = null;
let inputObserver = null;

// Get current page URL key for storage
function getPageKey() {
    return window.location.origin + window.location.pathname;
}

// Toggle parameter lock
function toggleParameterLock(enabled) {
    parameterLockEnabled = enabled;
    console.log(`Parameter lock ${enabled ? 'enabled' : 'disabled'}`);

    if (enabled) {
        startMonitoringParameters();
        // Save current parameters immediately
        saveCurrentParameters();
    } else {
        stopMonitoringParameters();
    }
}

// Check lock state and restore parameters on page load
async function checkAndRestoreParameters() {
    try {
        const pageKey = getPageKey();
        const result = await chrome.storage.local.get(['paramLockState', 'savedParameters']);
        const lockState = result.paramLockState || {};
        const isLocked = lockState[pageKey] || false;

        if (isLocked) {
            parameterLockEnabled = true;
            console.log('Parameter lock is enabled for this page');

            // Wait for Swagger UI to be ready before restoring
            waitForSwaggerReady(() => {
                restoreParameters();
                startMonitoringParameters();
            });
        }
    } catch (error) {
        console.error('Error checking parameter lock state:', error);
    }
}

// Get all input fields in Swagger UI
function getAllSwaggerInputs() {
    const inputs = [];

    // Find all input and textarea elements in Swagger UI
    const allInputs = document.querySelectorAll(
        'input[type="text"], input[type="number"], input[type="password"], input[type="email"], textarea, select'
    );

    allInputs.forEach(input => {
        // Skip if it's the auth token input (we handle that separately)
        if (input.name === 'Bearer' || input.closest('.auth-container')) {
            return;
        }

        // Try to get a unique identifier for this input
        const identifier = getInputIdentifier(input);
        if (identifier) {
            inputs.push({ element: input, id: identifier });
        }
    });

    return inputs;
}

// Get unique identifier for an input element
function getInputIdentifier(input) {
    // Try various methods to get a unique ID
    if (input.id) return input.id;
    if (input.name) return input.name;
    if (input.placeholder) return `placeholder:${input.placeholder}`;

    // Try to find parent labels or headings
    const label = input.closest('label');
    if (label && label.textContent) {
        return `label:${label.textContent.trim()}`;
    }

    // Try to find associated parameter name
    const paramWrapper = input.closest('.parameter__name, .parameters-col_name, [data-param-name]');
    if (paramWrapper) {
        const paramName = paramWrapper.textContent?.trim() || paramWrapper.dataset?.paramName;
        if (paramName) return `param:${paramName}`;
    }

    // Use a combination of tag and position as last resort
    const parent = input.parentElement;
    if (parent) {
        const index = Array.from(parent.children).indexOf(input);
        return `${input.tagName.toLowerCase()}:${parent.className}:${index}`;
    }

    return null;
}

// Save current parameter values
async function saveCurrentParameters() {
    if (!parameterLockEnabled) return;

    try {
        const inputs = getAllSwaggerInputs();
        const parameters = {};

        inputs.forEach(({ element, id }) => {
            if (element.value) {
                parameters[id] = element.value;
            }
        });

        const pageKey = getPageKey();
        const result = await chrome.storage.local.get(['savedParameters']);
        const savedParameters = result.savedParameters || {};
        savedParameters[pageKey] = parameters;

        await chrome.storage.local.set({ savedParameters });
        console.log(`Saved ${Object.keys(parameters).length} parameters`);
    } catch (error) {
        console.error('Error saving parameters:', error);
    }
}

// Restore saved parameters (passive mode - only when inputs appear)
async function restoreParameters() {
    try {
        const pageKey = getPageKey();
        const result = await chrome.storage.local.get(['savedParameters']);
        const savedParameters = result.savedParameters || {};
        const parameters = savedParameters[pageKey];

        if (!parameters || Object.keys(parameters).length === 0) {
            console.log('No saved parameters to restore');
            return;
        }

        console.log(`Parameter lock enabled. ${Object.keys(parameters).length} parameters saved.`);
        console.log('Parameters will auto-fill when you open operations and click "Try it out"');

        // Try to restore any currently visible inputs
        setTimeout(() => {
            attemptRestore(parameters);
        }, 500);
    } catch (error) {
        console.error('Error in restoreParameters:', error);
    }
}

// Attempt to restore parameters to visible inputs
function attemptRestore(parameters) {
    const inputs = getAllSwaggerInputs();

    if (inputs.length === 0) {
        console.log('No inputs visible yet. Waiting for you to open operations...');
        return;
    }

    console.log(`Found ${inputs.length} input fields`);
    let restoredCount = 0;

    inputs.forEach(({ element, id }) => {
        if (parameters[id] && !element.value) { // Only fill if empty
            console.log(`   Restoring "${id}" = "${parameters[id]}"`);
            element.value = parameters[id];
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            restoredCount++;
        }
    });

    if (restoredCount > 0) {
        console.log(`Restored ${restoredCount} parameters`);
        showSuccessMessage(`Đã khôi phục ${restoredCount} tham số`);
    }
}

// Start monitoring parameter changes
function startMonitoringParameters() {
    // Debounced save on input change
    document.addEventListener('input', handleInputChange);
    document.addEventListener('change', handleInputChange);

    // Also set up MutationObserver to catch dynamically added inputs
    observeNewInputs();

    console.log('Started monitoring parameters');
}

// Stop monitoring parameters
function stopMonitoringParameters() {
    document.removeEventListener('input', handleInputChange);
    document.removeEventListener('change', handleInputChange);

    if (inputObserver) {
        inputObserver.disconnect();
        inputObserver = null;
    }

    console.log('Stopped monitoring parameters');
}

// Handle input changes with debouncing
function handleInputChange(event) {
    if (!parameterLockEnabled) return;

    const target = event.target;
    if (target.matches('input, textarea, select') && !target.closest('.auth-container')) {
        // Debounce save to avoid too frequent saves
        clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(() => {
            saveCurrentParameters();
        }, 1000); // Save after 1 second of no changes
    }
}

// Observe DOM for new inputs
function observeNewInputs() {
    inputObserver = new MutationObserver((mutations) => {
        // Check if any new inputs were added
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    const newInputs = node.querySelectorAll?.('input, textarea, select');
                    if (newInputs && newInputs.length > 0) {
                        console.log(`Found ${newInputs.length} new inputs, will restore if needed`);
                        // Give Swagger UI time to initialize the inputs
                        setTimeout(() => {
                            restoreParametersForNewInputs(newInputs);
                        }, 500);
                    }
                }
            });
        });
    });

    // Observe the entire document for changes
    inputObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Restore parameters for newly added inputs
async function restoreParametersForNewInputs(newInputs) {
    if (!parameterLockEnabled) return;

    try {
        const pageKey = getPageKey();
        const result = await chrome.storage.local.get(['savedParameters']);
        const savedParameters = result.savedParameters || {};
        const parameters = savedParameters[pageKey];

        if (!parameters) return;

        let restoredCount = 0;
        newInputs.forEach(input => {
            if (input.closest('.auth-container')) return;

            const id = getInputIdentifier(input);
            if (id && parameters[id] && !input.value) { // Only fill if empty
                input.value = parameters[id];
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                restoredCount++;
            }
        });

        if (restoredCount > 0) {
            console.log(`Auto-filled ${restoredCount} parameters for newly opened operation`);
            showSuccessMessage(`Đã tự động điền ${restoredCount} tham số`);
        }
    } catch (error) {
        console.error('Error restoring parameters for new inputs:', error);
    }
}
