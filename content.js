// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'applyToken') {
        applyTokenToSwagger(request.token, request.tokenName);
        sendResponse({ success: true });
    }
    return true;
});

// Apply token to Swagger UI
function applyTokenToSwagger(token, tokenName) {
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
            showSuccessMessage(tokenName);
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
                showSuccessMessage(tokenName);
                return;
            }
        }

        // Method 3: Try to inject via localStorage for persistence
        const authData = {
            token: token,
            tokenName: tokenName,
            appliedAt: new Date().toISOString()
        };
        localStorage.setItem('swagger_token_manager_auth', JSON.stringify(authData));

        // Method 4: Try to click authorize button and fill in the token
        setTimeout(() => {
            const authorizeBtn = document.querySelector('.btn.authorize') ||
                document.querySelector('button.authorize') ||
                document.querySelector('.auth-wrapper .authorize');

            if (authorizeBtn) {
                authorizeBtn.click();

                setTimeout(() => {
                    // Find the input field for Bearer token
                    const tokenInput = document.querySelector('input[name="Bearer"]') ||
                        document.querySelector('input[type="text"][placeholder*="auth"]') ||
                        document.querySelector('.auth-container input[type="text"]');

                    if (tokenInput) {
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
                                showSuccessMessage(tokenName);

                                // Close modal
                                setTimeout(() => {
                                    const closeBtn = document.querySelector('.close-modal') ||
                                        document.querySelector('button.btn.modal-btn.auth.btn-done');
                                    if (closeBtn) closeBtn.click();
                                }, 300);
                            }
                        }, 200);
                    }
                }, 300);
            } else {
                console.log('⚠️ Authorize button not found, token saved to localStorage');
                showSuccessMessage(tokenName);
            }
        }, 100);

    } catch (error) {
        console.error('Error applying token:', error);
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
      Token "${tokenName}" đã được áp dụng!
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

// Auto-apply saved token on page load if available
window.addEventListener('load', () => {
    const savedAuth = localStorage.getItem('swagger_token_manager_auth');
    if (savedAuth) {
        try {
            const authData = JSON.parse(savedAuth);
            console.log('🔄 Auto-applying saved token:', authData.tokenName);
            setTimeout(() => {
                applyTokenToSwagger(authData.token, authData.tokenName);
            }, 1500);
        } catch (error) {
            console.error('Error auto-applying token:', error);
        }
    }
});
