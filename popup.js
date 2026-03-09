// DOM Elements
const addTokenForm = document.getElementById('addTokenForm');
const tokenNameInput = document.getElementById('tokenName');
const tokenValueInput = document.getElementById('tokenValue');
const tokensList = document.getElementById('tokensList');
const notification = document.getElementById('notification');
const toggleLockBtn = document.getElementById('toggleLockBtn');
const lockStatus = document.getElementById('lockStatus');

// Tab Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize Tabs
function initTabs() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Load tokens and lock state when popup opens
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadTokens();
    loadLockState();
});

// Add token form submission
addTokenForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = tokenNameInput.value.trim();
    const value = tokenValueInput.value.trim();

    if (!name || !value) {
        showNotification('Vui lòng điền đầy đủ thông tin!', 'error');
        return;
    }

    await saveToken(name, value);

    // Reset form
    tokenNameInput.value = '';
    tokenValueInput.value = '';

    showNotification('Token đã được lưu thành công!');
    loadTokens();
    
    // Switch to select token tab after successful addition
    document.querySelector('.tab-btn[data-tab="select-token"]').click();
});

// Load and display all tokens
async function loadTokens() {
    const tokens = await getTokens();

    if (tokens.length === 0) {
        tokensList.innerHTML = '<p class="empty-state">Chưa có token nào. Hãy thêm token mới ở trên.</p>';
        return;
    }

    tokensList.innerHTML = tokens.map((token, index) => `
    <div class="token-item" data-index="${index}">
      <button class="btn btn-delete" data-index="${index}">
        Xóa
      </button>
      <div class="token-name">${escapeHtml(token.name)}</div>
      <div class="token-value">${escapeHtml(token.value.substring(0, 50))}${token.value.length > 50 ? '...' : ''}</div>
    </div>
  `).join('');

    // Add click handlers to token items
    document.querySelectorAll('.token-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't apply token if delete button was clicked
            if (e.target.classList.contains('btn-delete') || e.target.closest('.btn-delete')) {
                return;
            }

            const index = item.dataset.index;
            applyToken(tokens[index]);
        });
    });

    // Add click handlers to delete buttons
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            await deleteToken(index);
        });
    });
}

// Save a new token
async function saveToken(name, value) {
    const tokens = await getTokens();
    tokens.push({ name, value, createdAt: new Date().toISOString() });
    await chrome.storage.local.set({ tokens });
}

// Get all tokens from storage
async function getTokens() {
    const result = await chrome.storage.local.get(['tokens']);
    return result.tokens || [];
}

// Delete a token
async function deleteToken(index) {
    const tokens = await getTokens();
    const deletedToken = tokens[index];
    tokens.splice(index, 1);

    await chrome.storage.local.set({ tokens });
    showNotification(`Token "${deletedToken.name}" đã được xóa`);
    loadTokens();
}

// Apply token to current Swagger page
async function applyToken(token) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            showNotification('Không tìm thấy tab đang hoạt động!', 'error');
            return;
        }

        // Check if URL contains swagger or api-docs
        if (!tab.url.includes('swagger') && !tab.url.includes('api-docs') && !tab.url.includes('api/docs')) {
            showNotification('Trang này không phải Swagger UI!', 'error');
            return;
        }

        // Send message to content script
        chrome.tabs.sendMessage(tab.id, {
            action: 'applyToken',
            token: token.value,
            tokenName: token.name
        }, (response) => {
            if (chrome.runtime.lastError) {
                showNotification('Không thể áp dụng token. Hãy refresh trang Swagger!', 'error');
                return;
            }

            if (response && response.success) {
                showNotification(`Token "${token.name}" đã được áp dụng!`);
            } else {
                showNotification('Không thể áp dụng token!', 'error');
            }
        });
    } catch (error) {
        console.error('Error applying token:', error);
        showNotification('Có lỗi xảy ra khi áp dụng token!', 'error');
    }
}

// Show notification message
function showNotification(message, type = 'success') {
    notification.textContent = message;
    notification.className = `notification ${type}`;

    // Trigger reflow to restart animation
    void notification.offsetWidth;

    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== PARAMETER LOCK FEATURE =====

// Load parameter lock state and update UI
async function loadLockState() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) {
            return;
        }

        const url = new URL(tab.url).origin + new URL(tab.url).pathname;
        const result = await chrome.storage.local.get(['paramLockState']);
        const lockState = result.paramLockState || {};
        const isLocked = lockState[url] || false;

        updateLockUI(isLocked);
    } catch (error) {
        console.error('Error loading lock state:', error);
    }
}

// Update lock UI based on state
function updateLockUI(isLocked) {
    if (!toggleLockBtn || !lockStatus) return;

    toggleLockBtn.dataset.locked = isLocked;

    if (isLocked) {
        toggleLockBtn.classList.add('locked');
        toggleLockBtn.querySelector('.lock-icon').textContent = '🔒';
        toggleLockBtn.querySelector('.lock-text').textContent = 'Tắt Khóa';
        lockStatus.textContent = 'Đang bật';
        lockStatus.classList.add('locked');
    } else {
        toggleLockBtn.classList.remove('locked');
        toggleLockBtn.querySelector('.lock-icon').textContent = '🔓';
        toggleLockBtn.querySelector('.lock-text').textContent = 'Bật Khóa';
        lockStatus.textContent = 'Đang tắt';
        lockStatus.classList.remove('locked');
    }
}

// Toggle parameter lock
toggleLockBtn?.addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) {
            showNotification('Không tìm thấy tab đang hoạt động!', 'error');
            return;
        }

        // Check if URL contains swagger or api-docs
        if (!tab.url.includes('swagger') && !tab.url.includes('api-docs') && !tab.url.includes('api/docs')) {
            showNotification('Trang này không phải Swagger UI!', 'error');
            return;
        }

        const url = new URL(tab.url).origin + new URL(tab.url).pathname;
        const result = await chrome.storage.local.get(['paramLockState']);
        const lockState = result.paramLockState || {};
        const currentState = lockState[url] || false;
        const newState = !currentState;

        // Update lock state
        lockState[url] = newState;
        await chrome.storage.local.set({ paramLockState: lockState });

        // Update UI
        updateLockUI(newState);

        // Send message to content script to enable/disable monitoring
        chrome.tabs.sendMessage(tab.id, {
            action: 'toggleParamLock',
            enabled: newState
        }, (response) => {
            if (chrome.runtime.lastError) {
                showNotification('Không thể kết nối với trang. Hãy refresh trang Swagger!', 'error');
                return;
            }

            if (newState) {
                showNotification('Đã bật khóa tham số');
            } else {
                showNotification('Đã tắt khóa tham số');
            }
        });

    } catch (error) {
        console.error('Error toggling lock:', error);
        showNotification('Có lỗi xảy ra!', 'error');
    }
});

