// DOM Elements
const addTokenForm = document.getElementById('addTokenForm');
const tokenNameInput = document.getElementById('tokenName');
const tokenValueInput = document.getElementById('tokenValue');
const tokensList = document.getElementById('tokensList');
const notification = document.getElementById('notification');

// Load tokens when popup opens
document.addEventListener('DOMContentLoaded', loadTokens);

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
        🗑️ Xóa
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
    showNotification(`🗑️ Token "${deletedToken.name}" đã được xóa!`);
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
