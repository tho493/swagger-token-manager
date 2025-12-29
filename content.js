// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'applyToken') {
        applyTokenToSwagger(request.token, request.tokenName);
        sendResponse({ success: true });
    }
    return true;
});

// Logout/clear existing token - AGGRESSIVE VERSION
function logoutExistingToken() {
    console.log('🔄 Starting aggressive logout...');

    try {
        // Method 1: Click the Logout button in Swagger UI modal (most reliable!)
        const authorizeBtn = document.querySelector('.btn.authorize') ||
            document.querySelector('button.authorize') ||
            document.querySelector('.auth-wrapper .authorize');

        if (authorizeBtn) {
            authorizeBtn.click();
            console.log('🔓 Opened authorize modal');

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
                    console.log('✅ Clicked Logout button in UI');

                    // Close the modal after logout
                    setTimeout(() => {
                        const closeBtn = document.querySelector('.close-modal') ||
                            document.querySelector('button.btn-done') ||
                            document.querySelector('.btn.modal-btn.auth.btn-done.button');
                        if (closeBtn) {
                            closeBtn.click();
                            console.log('✅ Closed auth modal');
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
                                console.log(`🔓 API Logged out: ${authName}`);
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

            console.log('✅ Swagger UI API logout completed');
        }

        // Method 3: Logout via SwaggerUIBundle
        if (window.SwaggerUIBundle && window.SwaggerUIBundle.authActions) {
            const commonAuthNames = ['Bearer', 'bearer', 'api_key', 'apiKey', 'API_KEY', 'Authorization'];
            commonAuthNames.forEach(authName => {
                try {
                    window.SwaggerUIBundle.authActions.logout([authName]);
                } catch (e) { /* ignore */ }
            });
            console.log('✅ SwaggerUIBundle logout completed');
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
            console.log(`🗑️ Removed localStorage: ${key}`);
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
            console.log(`🗑️ Removed sessionStorage: ${key}`);
        });

        console.log('✅ Aggressive logout completed');

    } catch (error) {
        console.error('❌ Error during logout:', error);
    }
}

// Apply token to Swagger UI
function applyTokenToSwagger(token, tokenName) {
    try {
        console.log(`🔄 Applying token: ${tokenName}`);

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

            console.log(`✅ Token "${tokenName}" applied successfully via Swagger UI API`);
            showSuccessMessage(tokenName);

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

                console.log(`✅ Token "${tokenName}" applied successfully via SwaggerUIBundle`);
                showSuccessMessage(tokenName);

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
                                    console.log(`✅ Token "${tokenName}" applied via UI interaction`);
                                    showSuccessMessage(tokenName);

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
                console.log('⚠️ Authorize button not found, token saved to localStorage');
                showSuccessMessage(tokenName);
            }
        }, 100);

    } catch (error) {
        console.error('Error applying new token:', error);
    }
}

// Show success message on the page
function showSuccessMessage(tokenName) {
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
      ✅ Token "${tokenName}" đã được áp dụng!
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
            console.log('✅ Swagger UI fully loaded (Authorize button found)!');
            // Wait a bit more to ensure everything is rendered
            setTimeout(() => callback(), 300);
        } else if (Date.now() - startTime < maxWaitTime) {
            // Continue waiting
            console.log('⏳ Waiting for Authorize button to appear...');
            setTimeout(checkReady, checkInterval);
        } else {
            console.warn('⚠️ Timeout waiting for Swagger UI Authorize button');
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
            console.log('🔄 Waiting for Swagger docs to load (Authorize button)...');
            console.log('Token to apply:', authData.tokenName);

            // Wait for Swagger UI to be ready (Authorize button appears)
            waitForSwaggerReady(() => {
                console.log('✅ Authorize button found, applying token now...');
                // Use applyNewToken directly as there's no existing token on fresh page load
                applyNewToken(authData.token, authData.tokenName);
            });
        } catch (error) {
            console.error('Error auto-applying token:', error);
        }
    }
});
