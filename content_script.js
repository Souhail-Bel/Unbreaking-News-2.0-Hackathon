/**
 * Unbreaking News - Content Script
 * Handles text selection detection and floating UI on webpages
 */

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.unbreakingNewsLoaded) return;
  window.unbreakingNewsLoaded = true;
  
  // ============================================
  // STATE
  // ============================================
  
  let floatingButton = null;
  let resultsPanel = null;
  let selectedText = '';
  let isAnalyzing = false;
  let settings = { showFloatingButton: true };
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  async function init() {
    // Load user settings
    const stored = await chrome.storage.local.get(['settings']);
    if (stored.settings) {
      settings = stored.settings;
    }
    
    // Create UI elements
    createFloatingButton();
    createResultsPanel();
    
    // Set up event listeners
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyPress);
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(handleMessage);
  }
  
  // ============================================
  // UI CREATION
  // ============================================
  
  function createFloatingButton() {
    floatingButton = document.createElement('div');
    floatingButton.id = 'ubn-floating-btn';
    floatingButton.innerHTML = `
      <span class="ubn-btn-icon">🔍</span>
      <span class="ubn-btn-text">Verify</span>
    `;
    floatingButton.style.cssText = `
      position: absolute;
      display: none;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
      border-radius: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      transition: transform 0.15s, box-shadow 0.15s;
      user-select: none;
    `;
    
    floatingButton.addEventListener('click', handleVerifyClick);
    floatingButton.addEventListener('mouseenter', () => {
      floatingButton.style.transform = 'scale(1.05)';
      floatingButton.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
    });
    floatingButton.addEventListener('mouseleave', () => {
      floatingButton.style.transform = 'scale(1)';
      floatingButton.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
    });
    
    document.body.appendChild(floatingButton);
  }
  
  function createResultsPanel() {
    resultsPanel = document.createElement('div');
    resultsPanel.id = 'ubn-results-panel';
    resultsPanel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 380px;
      max-height: 80vh;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
      z-index: 2147483647;
      display: none;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    `;
    
    document.body.appendChild(resultsPanel);
  }
  
  // ============================================
  // EVENT HANDLERS
  // ============================================
  
  function handleTextSelection(e) {
    // Don't trigger on our own UI
    if (e.target.closest('#ubn-floating-btn, #ubn-results-panel')) return;
    
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    // Hide button if no valid selection
    if (!text || text.length < 10) {
      setTimeout(() => hideFloatingButton(), 100);
      return;
    }
    
    selectedText = text;
    
    // Only show if settings allow
    if (!settings.showFloatingButton) return;
    
    // Position button near selection
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    floatingButton.style.display = 'flex';
    floatingButton.style.left = `${rect.left + window.scrollX + (rect.width / 2) - 50}px`;
    floatingButton.style.top = `${rect.bottom + window.scrollY + 10}px`;
  }
  
  function handleClickOutside(e) {
    if (!e.target.closest('#ubn-floating-btn, #ubn-results-panel')) {
      // Delay to allow button click to register
      setTimeout(() => {
        if (!window.getSelection().toString().trim()) {
          hideFloatingButton();
        }
      }, 50);
    }
  }
  
  function handleKeyPress(e) {
    // Close panel on Escape
    if (e.key === 'Escape') {
      hideResultsPanel();
      hideFloatingButton();
    }
  }
  
  function handleMessage(request, sender, sendResponse) {
    if (request.action === 'showResults' && request.data) {
      displayResults(request.data);
    }
  }
  
  async function handleVerifyClick(e) {
    e.stopPropagation();
    
    if (!selectedText || isAnalyzing) return;
    
    isAnalyzing = true;
    
    // Update button to show loading state
    floatingButton.innerHTML = `
      <span class="ubn-spinner"></span>
      <span class="ubn-btn-text">Analyzing...</span>
    `;
    
    try {
      // Send to background for analysis
      const result = await chrome.runtime.sendMessage({
        action: 'analyzeClaim',
        text: selectedText,
        url: window.location.href,
        domain: window.location.hostname
      });
      
      displayResults(result);
    } catch (error) {
      console.error('Analysis error:', error);
      showError('Failed to analyze claim. Please try again.');
    } finally {
      isAnalyzing = false;
      // Reset button
      floatingButton.innerHTML = `
        <span class="ubn-btn-icon">🔍</span>
        <span class="ubn-btn-text">Verify</span>
      `;
    }
  }
  
  // ============================================
  // RESULTS DISPLAY
  // ============================================
  
  function displayResults(data) {
    hideFloatingButton();
    
    const { scores, claim, flags, evidenceLinks, recommendation, domain, factCheck, verification } = data;
    const score = scores.overall;
    
    // Determine if this is a fact-checked claim
    const isFactChecked = factCheck && factCheck.matched;
    const isFalse = isFactChecked && !factCheck.isTrue;
    const isVerifiedTrue = isFactChecked && factCheck.isTrue;
    
    resultsPanel.innerHTML = `
      <div class="ubn-header" style="
        background: ${isFalse ? 'linear-gradient(135deg, #dc262622, #dc262611)' : 
                      isVerifiedTrue ? 'linear-gradient(135deg, #16a34a22, #16a34a11)' :
                      `linear-gradient(135deg, ${recommendation.color}22, ${recommendation.color}11)`};
        padding: 20px;
        border-bottom: 1px solid ${recommendation.color}33;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">${recommendation.icon}</span>
            <div>
              <h3 style="margin: 0; font-size: 16px; color: #1f2937;">
                ${isFactChecked ? 'Fact Check Result' : 'Credibility Check'}
              </h3>
              <span style="font-size: 12px; color: #6b7280;">${domain}</span>
            </div>
          </div>
          <button id="ubn-close" style="
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #9ca3af;
            padding: 4px;
          ">×</button>
        </div>
        
        ${isFactChecked ? `
          <div style="
            margin-top: 16px;
            padding: 16px;
            background: ${isFalse ? '#fef2f2' : '#f0fdf4'};
            border: 2px solid ${isFalse ? '#dc2626' : '#16a34a'};
            border-radius: 12px;
          ">
            <div style="
              font-size: 18px;
              font-weight: 700;
              color: ${isFalse ? '#dc2626' : '#16a34a'};
              margin-bottom: 8px;
              display: flex;
              align-items: center;
              gap: 8px;
            ">
              ${isFalse ? '❌ FALSE CLAIM' : '✅ VERIFIED TRUE'}
            </div>
            <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5;">
              ${factCheck.fact}
            </p>
            ${factCheck.correction ? `
              <p style="margin: 10px 0 0; font-size: 13px; color: #059669; font-weight: 500;">
                ✓ ${factCheck.correction}
              </p>
            ` : ''}
          </div>
        ` : `
          <div style="margin-top: 16px; display: flex; align-items: center; gap: 16px;">
            <div style="
              width: 70px;
              height: 70px;
              border-radius: 50%;
              background: conic-gradient(${recommendation.color} ${score}%, #e5e7eb ${score}%);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                font-weight: 700;
                color: ${recommendation.color};
              ">${score}</div>
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: ${recommendation.color}; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">
                ${recommendation.level}
              </div>
              <p style="margin: 4px 0 0; font-size: 13px; color: #4b5563; line-height: 1.4;">
                ${recommendation.message}
              </p>
            </div>
          </div>
        `}
      </div>
      
      <div style="padding: 16px; overflow-y: auto; max-height: calc(80vh - 200px);">
        <div style="
          background: #f9fafb;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        ">
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
            Claim Analyzed
          </div>
          <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">
            "${claim.length > 200 ? claim.substring(0, 200) + '...' : claim}"
          </p>
        </div>
        
        ${!isFactChecked ? `
          <div style="
            background: #fef3c7;
            border: 1px solid #f59e0b;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 16px;
          ">
            <div style="font-size: 12px; color: #92400e; display: flex; align-items: center; gap: 6px;">
              <span>⚠️</span>
              <strong>Unverified Claim</strong>
            </div>
            <p style="margin: 6px 0 0; font-size: 12px; color: #78350f;">
              This claim couldn't be automatically fact-checked. Please verify using the links below.
            </p>
          </div>
        ` : ''}
        
        ${flags && flags.length > 0 ? `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 8px;">
              Analysis Details
            </div>
            ${flags.map(flag => `
              <div style="
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 8px 10px;
                background: ${flag.severity === 'positive' ? '#dcfce7' : 
                             flag.severity === 'critical' ? '#fee2e2' : 
                             flag.severity === 'high' ? '#fee2e2' : 
                             flag.severity === 'info' ? '#e0f2fe' : '#fef3c7'};
                border-radius: 6px;
                margin-bottom: 6px;
                font-size: 12px;
                color: ${flag.severity === 'positive' ? '#166534' : 
                        flag.severity === 'critical' ? '#991b1b' : 
                        flag.severity === 'high' ? '#991b1b' : 
                        flag.severity === 'info' ? '#0369a1' : '#92400e'};
              ">
                <span style="flex-shrink: 0;">${
                  flag.severity === 'positive' ? '✓' : 
                  flag.severity === 'critical' ? '✗' : 
                  flag.severity === 'info' ? 'ℹ' :
                  flag.severity === 'high' ? '⚠' : '○'
                }</span>
                <span style="line-height: 1.4;">${flag.message}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 8px;">
            🔎 Verify This Claim
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${evidenceLinks.factCheckers.slice(0, 3).map(fc => `
              <a href="${fc.url}" target="_blank" rel="noopener" style="
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 12px;
                background: #f0fdf4;
                border: 1px solid #bbf7d0;
                border-radius: 6px;
                text-decoration: none;
                color: #166534;
                font-size: 13px;
                transition: background 0.15s;
              " onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">
                ✓ ${fc.name}
                <span style="margin-left: auto; font-size: 11px; color: #6b7280;">→</span>
              </a>
            `).join('')}
          </div>
        </div>
        
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 8px;">
            🌐 Search Engines
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${evidenceLinks.searchEngines.map(engine => `
              <a href="${engine.url}" target="_blank" rel="noopener" style="
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 12px;
                background: #f3f4f6;
                border-radius: 6px;
                text-decoration: none;
                color: #374151;
                font-size: 12px;
                transition: background 0.15s;
              " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                ${engine.icon} ${engine.name}
              </a>
            `).join('')}
          </div>
        </div>
        
        <div style="
          border-top: 1px solid #e5e7eb;
          padding-top: 16px;
          margin-top: 16px;
        ">
          <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 10px;">
            Was this analysis helpful?
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="ubn-feedback-btn" data-feedback="true" style="
              flex: 1;
              padding: 10px;
              background: #dcfce7;
              border: 1px solid #bbf7d0;
              border-radius: 8px;
              cursor: pointer;
              font-size: 13px;
              color: #166534;
              transition: background 0.15s;
            ">👍 Helpful</button>
            <button class="ubn-feedback-btn" data-feedback="false" style="
              flex: 1;
              padding: 10px;
              background: #fee2e2;
              border: 1px solid #fecaca;
              border-radius: 8px;
              cursor: pointer;
              font-size: 13px;
              color: #991b1b;
              transition: background 0.15s;
            ">👎 Not Helpful</button>
          </div>
        </div>
      </div>
    `;
    
    // Show panel
    resultsPanel.style.display = 'flex';
    
    // Add event listeners
    document.getElementById('ubn-close').addEventListener('click', hideResultsPanel);
    
    document.querySelectorAll('.ubn-feedback-btn').forEach(btn => {
      btn.addEventListener('click', () => handleFeedback(btn.dataset.feedback === 'true', data));
    });
  }
  
  async function handleFeedback(isTrue, data) {
    const report = {
      claimId: data.id,
      claim: data.claim.substring(0, 200),
      domain: data.domain,
      score: data.scores.overall,
      userVerdict: isTrue,
      pageUrl: window.location.href
    };
    
    try {
      await chrome.runtime.sendMessage({
        action: 'saveReport',
        report
      });
      
      // Update UI to show thanks
      const feedbackSection = resultsPanel.querySelector('.ubn-feedback-btn').parentElement;
      feedbackSection.innerHTML = `
        <div style="
          text-align: center;
          padding: 16px;
          background: #f0f9ff;
          border-radius: 8px;
          color: #0369a1;
        ">
          ✓ Thank you for your feedback!
        </div>
      `;
    } catch (error) {
      console.error('Failed to save feedback:', error);
    }
  }
  
  function showError(message) {
    resultsPanel.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <p style="color: #991b1b; font-size: 14px;">${message}</p>
        <button id="ubn-close" style="
          margin-top: 16px;
          padding: 10px 20px;
          background: #f3f4f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        ">Close</button>
      </div>
    `;
    
    resultsPanel.style.display = 'flex';
    document.getElementById('ubn-close').addEventListener('click', hideResultsPanel);
  }
  
  // ============================================
  // UI HELPERS
  // ============================================
  
  function hideFloatingButton() {
    if (floatingButton) {
      floatingButton.style.display = 'none';
    }
  }
  
  function hideResultsPanel() {
    if (resultsPanel) {
      resultsPanel.style.display = 'none';
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();