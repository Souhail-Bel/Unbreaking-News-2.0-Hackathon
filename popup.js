/**
 * Unbreaking News - Popup Script
 * Handles popup UI logic and displays current/historical claim data
 */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Set up tab navigation
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // Load current claim data
  await loadCurrentClaim();
}

// ============================================
// TAB NAVIGATION
// ============================================

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Update sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${tabName}`).classList.add('active');
  
  // Load data for section
  switch(tabName) {
    case 'current':
      loadCurrentClaim();
      break;
    case 'history':
      loadHistory();
      break;
    case 'stats':
      loadStats();
      break;
  }
}

// ============================================
// CURRENT CLAIM
// ============================================

async function loadCurrentClaim() {
  const container = document.getElementById('current-content');
  
  try {
    const data = await chrome.runtime.sendMessage({ action: 'getCurrentClaim' });
    
    if (!data) {
      container.innerHTML = `
        <div class="no-claim">
          <div class="no-claim-icon">🔍</div>
          <h3>No claim selected</h3>
          <p>Select text on any webpage and click the "Verify" button to analyze a claim.</p>
        </div>
      `;
      return;
    }
    
    renderClaimCard(container, data);
  } catch (e) {
    console.error('Error loading current claim:', e);
    container.innerHTML = `
      <div class="no-claim">
        <div class="no-claim-icon">⚠️</div>
        <h3>Error loading data</h3>
        <p>Please try refreshing the extension.</p>
      </div>
    `;
  }
}

function renderClaimCard(container, data) {
  const { scores, claim, flags, evidenceLinks, recommendation, domain } = data;
  const score = scores.overall;
  
  container.innerHTML = `
    <div class="claim-card">
      <div class="score-ring" style="background: conic-gradient(${recommendation.color} ${score}%, #e5e7eb ${score}%);">
        <div class="score-inner" style="color: ${recommendation.color};">${score}</div>
      </div>
      
      <div class="recommendation">
        <div class="recommendation-level" style="color: ${recommendation.color};">
          ${recommendation.icon} ${recommendation.level}
        </div>
        <p class="recommendation-message">${recommendation.message}</p>
      </div>
      
      <div class="claim-domain">📍 Source: ${domain}</div>
      <div class="claim-text">"${claim.length > 150 ? claim.substring(0, 150) + '...' : claim}"</div>
      
      ${flags && flags.length > 0 ? `
        <div class="links-section">
          <div class="links-title">⚠️ Flags Detected</div>
          ${flags.slice(0, 3).map(f => `
            <div style="
              padding: 8px 10px;
              background: ${f.severity === 'positive' ? '#dcfce7' : f.severity === 'high' ? '#fee2e2' : '#fef3c7'};
              border-radius: 6px;
              margin-bottom: 6px;
              font-size: 12px;
              color: ${f.severity === 'positive' ? '#166534' : f.severity === 'high' ? '#991b1b' : '#92400e'};
            ">${f.message}</div>
          `).join('')}
        </div>
      ` : ''}
      
      <div class="links-section">
        <div class="links-title">🔎 Verify with Fact-Checkers</div>
        ${evidenceLinks.factCheckers.slice(0, 3).map(fc => `
          <a href="${fc.url}" target="_blank" class="link-btn">
            ✓ Check on ${fc.name} →
          </a>
        `).join('')}
      </div>
      
      <div class="links-section">
        <div class="links-title">🌐 Search Engines</div>
        <div style="display: flex; gap: 8px;">
          ${evidenceLinks.searchEngines.map(se => `
            <a href="${se.url}" target="_blank" style="
              flex: 1;
              padding: 8px;
              background: #f3f4f6;
              border-radius: 6px;
              text-decoration: none;
              color: #374151;
              font-size: 11px;
              text-align: center;
            ">${se.icon} ${se.name}</a>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ============================================
// HISTORY
// ============================================

async function loadHistory() {
  const container = document.getElementById('history-content');
  
  try {
    const history = await chrome.runtime.sendMessage({ action: 'getAnalysisHistory' });
    
    if (!history || history.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📜 No analysis history yet</p>
          <p style="font-size: 12px; margin-top: 8px;">Your verified claims will appear here.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      ${history.slice(0, 20).map(item => `
        <div class="history-item">
          <div class="history-header">
            <span class="history-domain">${item.domain || 'Unknown'}</span>
            <span class="history-score ${item.recommendation || getLevel(item.score)}">${item.score}</span>
          </div>
          <div class="history-time">${formatTime(item.timestamp)}</div>
        </div>
      `).join('')}
      
      <button class="btn-clear" id="btn-clear-history">
        🗑️ Clear History
      </button>
    `;
    
    document.getElementById('btn-clear-history').addEventListener('click', clearHistory);
  } catch (e) {
    console.error('Error loading history:', e);
    container.innerHTML = '<div class="empty-state">Error loading history</div>';
  }
}

async function clearHistory() {
  if (confirm('Are you sure you want to clear all history?')) {
    await chrome.runtime.sendMessage({ action: 'clearHistory' });
    loadHistory();
    loadStats();
  }
}

// ============================================
// STATS
// ============================================

async function loadStats() {
  const container = document.getElementById('stats-content');
  
  try {
    const [history, reports] = await Promise.all([
      chrome.runtime.sendMessage({ action: 'getAnalysisHistory' }),
      chrome.runtime.sendMessage({ action: 'getReports' })
    ]);
    
    const totalAnalyzed = history?.length || 0;
    const totalReports = reports?.length || 0;
    const trueReports = reports?.filter(r => r.userVerdict === true).length || 0;
    const falseReports = reports?.filter(r => r.userVerdict === false).length || 0;
    
    // Calculate average score
    const avgScore = totalAnalyzed > 0 
      ? Math.round(history.reduce((sum, h) => sum + (h.score || 0), 0) / totalAnalyzed)
      : 0;
    
    // Score distribution
    const credible = history?.filter(h => h.score >= 75).length || 0;
    const uncertain = history?.filter(h => h.score >= 50 && h.score < 75).length || 0;
    const suspicious = history?.filter(h => h.score < 50).length || 0;
    
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalAnalyzed}</div>
          <div class="stat-label">Claims Analyzed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgScore}</div>
          <div class="stat-label">Avg. Score</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #22c55e;">${credible}</div>
          <div class="stat-label">Credible</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #ef4444;">${suspicious}</div>
          <div class="stat-label">Suspicious</div>
        </div>
      </div>
      
      <div class="feedback-summary">
        <h4 style="font-size: 13px; margin-bottom: 8px;">Your Feedback</h4>
        <div style="font-size: 12px; color: #6b7280;">
          You've marked ${totalReports} claims
        </div>
        <div class="feedback-bar">
          <div class="feedback-bar-fill" style="
            width: ${totalReports > 0 ? (trueReports / totalReports * 100) : 0}%;
            background: linear-gradient(90deg, #22c55e, #ef4444);
          "></div>
        </div>
        <div class="feedback-legend">
          <span>✓ True: ${trueReports}</span>
          <span>✗ False: ${falseReports}</span>
        </div>
      </div>
      
      <a href="options.html" target="_blank" class="settings-link">
        ⚙️ Extension Settings
      </a>
    `;
  } catch (e) {
    console.error('Error loading stats:', e);
    container.innerHTML = '<div class="empty-state">Error loading statistics</div>';
  }
}

// ============================================
// HELPERS
// ============================================

function getLevel(score) {
  if (score >= 75) return 'credible';
  if (score >= 50) return 'uncertain';
  return 'suspicious';
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return date.toLocaleDateString();
}