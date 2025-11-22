/**
 * Unbreaking News - Background Service Worker
 * Handles claim analysis, scoring, and cross-tab communication
 */

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

const SENSATIONAL_WORDS = [
  'breaking', 'shocking', 'explosive', 'bombshell', 'unprecedented',
  'miracle', 'secret', 'exposed', 'banned', 'they don\'t want you to know',
  'mainstream media', 'wake up', 'hoax', 'fraud', 'conspiracy',
  'urgent', 'alert', 'warning', 'dangerous', 'deadly', 'cure',
  'doctors hate', '100%', 'guaranteed', 'proven', 'exposed truth'
];

const CREDIBLE_DOMAINS = [
  'reuters.com', 'apnews.com', 'bbc.com', 'npr.org', 'pbs.org',
  'nature.com', 'science.org', 'gov', 'edu', 'who.int', 'cdc.gov',
  'snopes.com', 'factcheck.org', 'politifact.com', 'fullfact.org'
];

const FACT_CHECK_SITES = [
  { name: 'Snopes', url: 'https://www.snopes.com/search/' },
  { name: 'PolitiFact', url: 'https://www.politifact.com/search/?q=' },
  { name: 'FactCheck.org', url: 'https://www.factcheck.org/?s=' },
  { name: 'Full Fact', url: 'https://fullfact.org/search/?q=' }
];

// Store current claim data for popup access
let currentClaimData = null;

// ============================================
// INITIALIZATION
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('Unbreaking News extension installed');
  
  // Create context menu item
  chrome.contextMenus.create({
    id: 'verify-claim',
    title: 'Verify this claim',
    contexts: ['selection']
  });
  
  // Initialize default settings
  chrome.storage.local.get(['settings'], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          showFloatingButton: true,
          autoAnalyze: false,
          privacyMode: true,
          theme: 'auto'
        },
        reports: [],
        analysisHistory: []
      });
    }
  });
});

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'analyzeClaim':
      handleClaimAnalysis(request.text, request.url, request.domain)
        .then(sendResponse);
      return true; // Keep channel open for async response
      
    case 'getCurrentClaim':
      sendResponse(currentClaimData);
      return false;
      
    case 'saveReport':
      saveUserReport(request.report).then(sendResponse);
      return true;
      
    case 'getReports':
      getReports().then(sendResponse);
      return true;
      
    case 'getAnalysisHistory':
      getAnalysisHistory().then(sendResponse);
      return true;
      
    case 'clearHistory':
      clearHistory().then(sendResponse);
      return true;
  }
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'verify-claim' && info.selectionText) {
    const url = new URL(tab.url);
    handleClaimAnalysis(info.selectionText, tab.url, url.hostname)
      .then(data => {
        currentClaimData = data;
        // Notify content script to show results
        chrome.tabs.sendMessage(tab.id, {
          action: 'showResults',
          data: data
        });
      });
  }
});

// ============================================
// CLAIM ANALYSIS ENGINE
// ============================================

async function handleClaimAnalysis(text, pageUrl, domain) {
  const timestamp = Date.now();
  
  // Run all analysis in parallel
  const [
    heuristicScore,
    domainTrust,
    evidenceLinks
  ] = await Promise.all([
    analyzeHeuristics(text),
    analyzeDomainTrust(domain, pageUrl),
    generateEvidenceLinks(text)
  ]);
  
  // Calculate overall credibility score
  const overallScore = calculateOverallScore(heuristicScore, domainTrust);
  
  const analysis = {
    id: `claim_${timestamp}`,
    timestamp,
    claim: text.substring(0, 500), // Limit claim length
    pageUrl,
    domain,
    scores: {
      overall: overallScore,
      heuristic: heuristicScore,
      domainTrust: domainTrust
    },
    evidenceLinks,
    flags: heuristicScore.flags,
    recommendation: getRecommendation(overallScore)
  };
  
  // Store for popup access
  currentClaimData = analysis;
  
  // Save to history (privacy respecting)
  await saveToHistory(analysis);
  
  return analysis;
}

/**
 * Analyze text using heuristic patterns
 * Returns score 0-100 (higher = more credible)
 */
function analyzeHeuristics(text) {
  const flags = [];
  let score = 70; // Start neutral-positive
  const lowerText = text.toLowerCase();
  
  // Check for sensational language
  const sensationalCount = SENSATIONAL_WORDS.filter(word => 
    lowerText.includes(word.toLowerCase())
  ).length;
  
  if (sensationalCount > 0) {
    score -= sensationalCount * 8;
    flags.push({
      type: 'sensational',
      severity: sensationalCount > 2 ? 'high' : 'medium',
      message: `Contains ${sensationalCount} sensational term(s)`
    });
  }
  
  // Check for excessive capitalization
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.4 && text.length > 20) {
    score -= 15;
    flags.push({
      type: 'caps',
      severity: 'medium',
      message: 'Excessive capitalization detected'
    });
  }
  
  // Check for excessive punctuation
  const excessivePunctuation = /[!?]{2,}/.test(text);
  if (excessivePunctuation) {
    score -= 10;
    flags.push({
      type: 'punctuation',
      severity: 'low',
      message: 'Excessive punctuation (!!, ??)'
    });
  }
  
  // Check for unverifiable numbers/statistics
  const hasVagueStats = /\d+%|millions|billions|thousands/i.test(text) &&
    !/according to|study|research|survey|report/i.test(text);
  if (hasVagueStats) {
    score -= 12;
    flags.push({
      type: 'stats',
      severity: 'medium',
      message: 'Statistics without cited source'
    });
  }
  
  // Check for absolute language
  const absoluteTerms = /always|never|everyone|no one|all|none|completely|totally|100%/i;
  if (absoluteTerms.test(text)) {
    score -= 8;
    flags.push({
      type: 'absolute',
      severity: 'low',
      message: 'Contains absolute language'
    });
  }
  
  // Check for emotional manipulation
  const emotionalTriggers = /you won't believe|they don't want|exposed|revealed|truth about/i;
  if (emotionalTriggers.test(text)) {
    score -= 15;
    flags.push({
      type: 'emotional',
      severity: 'high',
      message: 'Emotional manipulation patterns detected'
    });
  }
  
  // Bonus for citing sources
  const citesSource = /according to|study shows|research|published in|reported by/i;
  if (citesSource.test(text)) {
    score += 10;
    flags.push({
      type: 'citation',
      severity: 'positive',
      message: 'Appears to cite a source'
    });
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    flags,
    confidence: flags.length > 0 ? 'analyzed' : 'neutral'
  };
}

/**
 * Analyze domain trustworthiness
 */
function analyzeDomainTrust(domain, url) {
  let score = 50; // Neutral starting point
  const flags = [];
  
  // Check if it's a known credible domain
  const isCredible = CREDIBLE_DOMAINS.some(d => domain.includes(d));
  if (isCredible) {
    score = 85;
    flags.push({
      type: 'trusted',
      severity: 'positive',
      message: 'Known credible news source'
    });
  }
  
  // Check for .gov or .edu domains
  if (domain.endsWith('.gov') || domain.endsWith('.edu')) {
    score = 90;
    flags.push({
      type: 'official',
      severity: 'positive',
      message: 'Official government/educational domain'
    });
  }
  
  // Check for suspicious TLDs
  const suspiciousTLDs = ['.xyz', '.top', '.click', '.buzz', '.info'];
  if (suspiciousTLDs.some(tld => domain.endsWith(tld))) {
    score -= 20;
    flags.push({
      type: 'tld',
      severity: 'medium',
      message: 'Potentially suspicious domain extension'
    });
  }
  
  // Check for typosquatting patterns
  const typoPatterns = /newss|goggle|facebok|twiter|yahooo/i;
  if (typoPatterns.test(domain)) {
    score -= 30;
    flags.push({
      type: 'typo',
      severity: 'high',
      message: 'Possible typosquatting domain'
    });
  }
  
  // Check domain age indicator (heuristic: very long subdomains)
  if ((domain.match(/\./g) || []).length > 3) {
    score -= 10;
    flags.push({
      type: 'subdomain',
      severity: 'low',
      message: 'Unusual subdomain structure'
    });
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    domain,
    flags,
    isKnownSource: isCredible
  };
}

/**
 * Generate evidence/search links for verification
 */
function generateEvidenceLinks(text) {
  // Clean and encode the search query
  const query = encodeURIComponent(text.substring(0, 150));
  
  return {
    searchEngines: [
      {
        name: 'Google',
        url: `https://www.google.com/search?q=${query}`,
        icon: '🔍'
      },
      {
        name: 'DuckDuckGo',
        url: `https://duckduckgo.com/?q=${query}`,
        icon: '🦆'
      },
      {
        name: 'Bing',
        url: `https://www.bing.com/search?q=${query}`,
        icon: '🅱️'
      }
    ],
    factCheckers: FACT_CHECK_SITES.map(site => ({
      name: site.name,
      url: site.url + query,
      icon: '✓'
    })),
    googleNews: `https://news.google.com/search?q=${query}`,
    reverseImageSearch: `https://images.google.com/searchbyimage?image_url=`
  };
}

/**
 * Calculate overall credibility score
 */
function calculateOverallScore(heuristic, domain) {
  // Weighted average: 60% text analysis, 40% domain trust
  const weighted = (heuristic.score * 0.6) + (domain.score * 0.4);
  return Math.round(weighted);
}

/**
 * Get recommendation based on score
 */
function getRecommendation(score) {
  if (score >= 75) {
    return {
      level: 'credible',
      color: '#22c55e',
      message: 'This claim appears credible, but always verify important information.',
      icon: '✅'
    };
  } else if (score >= 50) {
    return {
      level: 'uncertain',
      color: '#eab308',
      message: 'This claim has some red flags. Cross-reference with trusted sources.',
      icon: '⚠️'
    };
  } else {
    return {
      level: 'suspicious',
      color: '#ef4444',
      message: 'This claim shows multiple warning signs. Verify before sharing.',
      icon: '🚨'
    };
  }
}

// ============================================
// STORAGE FUNCTIONS
// ============================================

async function saveToHistory(analysis) {
  const { settings } = await chrome.storage.local.get(['settings']);
  
  // Respect privacy mode - don't store full claims
  const historyEntry = settings?.privacyMode ? {
    id: analysis.id,
    timestamp: analysis.timestamp,
    domain: analysis.domain,
    score: analysis.scores.overall,
    recommendation: analysis.recommendation.level
  } : analysis;
  
  const { analysisHistory = [] } = await chrome.storage.local.get(['analysisHistory']);
  analysisHistory.unshift(historyEntry);
  
  // Keep only last 100 entries
  if (analysisHistory.length > 100) {
    analysisHistory.pop();
  }
  
  await chrome.storage.local.set({ analysisHistory });
}

async function saveUserReport(report) {
  const { reports = [] } = await chrome.storage.local.get(['reports']);
  
  reports.unshift({
    ...report,
    timestamp: Date.now()
  });
  
  // Keep only last 500 reports
  if (reports.length > 500) {
    reports.pop();
  }
  
  await chrome.storage.local.set({ reports });
  return { success: true, total: reports.length };
}

async function getReports() {
  const { reports = [] } = await chrome.storage.local.get(['reports']);
  return reports;
}

async function getAnalysisHistory() {
  const { analysisHistory = [] } = await chrome.storage.local.get(['analysisHistory']);
  return analysisHistory;
}

async function clearHistory() {
  await chrome.storage.local.set({ analysisHistory: [], reports: [] });
  return { success: true };
}