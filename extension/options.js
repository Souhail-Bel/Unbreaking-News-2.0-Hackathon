/**
 * Unbreaking News - Options Page Script
 * Handles user settings and data management
 */

document.addEventListener('DOMContentLoaded', init);

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  // Load saved settings
  await loadSettings();
  
  // Set up event listeners
  setupEventListeners();
}

async function loadSettings() {
  const { settings = {}, apiKeys = {} } = await chrome.storage.local.get(['settings', 'apiKeys']);
  
  // General settings
  document.getElementById('setting-floating-btn').checked = settings.showFloatingButton !== false;
  document.getElementById('setting-auto-analyze').checked = settings.autoAnalyze === true;
  
  // Privacy settings
  document.getElementById('setting-privacy-mode').checked = settings.privacyMode !== false;
  
  // API keys (show masked if exists)
  if (apiKeys.googleFactCheck) {
    document.getElementById('api-google-factcheck').value = '••••••••••••••••';
  }
  if (apiKeys.claimBuster) {
    document.getElementById('api-claimbuster').value = '••••••••••••••••';
  }
}

function setupEventListeners() {
  // Toggle switches - save on change
  document.getElementById('setting-floating-btn').addEventListener('change', saveSettings);
  document.getElementById('setting-auto-analyze').addEventListener('change', saveSettings);
  document.getElementById('setting-privacy-mode').addEventListener('change', saveSettings);
  
  // API key inputs - save on blur
  document.getElementById('api-google-factcheck').addEventListener('blur', saveApiKeys);
  document.getElementById('api-claimbuster').addEventListener('blur', saveApiKeys);
  
  // Clear input placeholder on focus
  document.querySelectorAll('input[type="password"]').forEach(input => {
    input.addEventListener('focus', function() {
      if (this.value === '••••••••••••••••') {
        this.value = '';
      }
    });
  });
  
  // Buttons
  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('btn-clear').addEventListener('click', clearAllData);
  document.getElementById('link-feedback').addEventListener('click', openFeedback);
}

// ============================================
// SETTINGS MANAGEMENT
// ============================================

async function saveSettings() {
  const settings = {
    showFloatingButton: document.getElementById('setting-floating-btn').checked,
    autoAnalyze: document.getElementById('setting-auto-analyze').checked,
    privacyMode: document.getElementById('setting-privacy-mode').checked,
    theme: 'auto'
  };
  
  await chrome.storage.local.set({ settings });
  showStatus('Settings saved!', 'success');
}

async function saveApiKeys() {
  const googleKey = document.getElementById('api-google-factcheck').value;
  const claimBusterKey = document.getElementById('api-claimbuster').value;
  
  // Don't save masked values
  const { apiKeys = {} } = await chrome.storage.local.get(['apiKeys']);
  
  if (googleKey && googleKey !== '••••••••••••••••') {
    apiKeys.googleFactCheck = googleKey;
  }
  if (claimBusterKey && claimBusterKey !== '••••••••••••••••') {
    apiKeys.claimBuster = claimBusterKey;
  }
  
  await chrome.storage.local.set({ apiKeys });
  showStatus('API keys saved securely!', 'success');
}

// ============================================
// DATA MANAGEMENT
// ============================================

async function exportData() {
  try {
    const data = await chrome.storage.local.get(null);
    
    // Create downloadable file
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `unbreaking-news-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus('Data exported successfully!', 'success');
  } catch (e) {
    console.error('Export error:', e);
    showStatus('Failed to export data.', 'error');
  }
}

async function clearAllData() {
  if (!confirm('Are you sure you want to delete all data? This cannot be undone.')) {
    return;
  }
  
  if (!confirm('This will clear all history, reports, and API keys. Continue?')) {
    return;
  }
  
  try {
    // Keep settings, clear everything else
    const { settings } = await chrome.storage.local.get(['settings']);
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ settings });
    
    // Clear API key fields
    document.getElementById('api-google-factcheck').value = '';
    document.getElementById('api-claimbuster').value = '';
    
    showStatus('All data cleared successfully!', 'success');
  } catch (e) {
    console.error('Clear error:', e);
    showStatus('Failed to clear data.', 'error');
  }
}

// ============================================
// HELPERS
// ============================================

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    status.className = 'status';
  }, 3000);
}

function openFeedback(e) {
  e.preventDefault();
  // Could open a feedback form or email
  const subject = encodeURIComponent('Unbreaking News Feedback');
  const body = encodeURIComponent('Hi! I have some feedback about the Unbreaking News extension:\n\n');
  window.open(`mailto:feedback@unbreaking-news.com?subject=${subject}&body=${body}`);
}