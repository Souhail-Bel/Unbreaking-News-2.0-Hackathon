Technical Documentation - Unbreaking News Extension
Architecture Overview
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERACTION                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Select    │    │   Click     │    │   View      │     │
│  │    Text     │───▶│   Verify    │───▶│  Results    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CONTENT SCRIPT                            │
│  content_script.js                                          │
│  • Detects text selection                                   │
│  • Shows floating "Verify" button                           │
│  • Displays results panel                                   │
│  • Handles user feedback                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ chrome.runtime.sendMessage()
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  BACKGROUND SERVICE WORKER                   │
│  background.js                                               │
│  • Receives claim text                                      │
│  • Runs heuristic analysis                                  │
│  • Analyzes domain trust                                    │
│  • Generates evidence links                                 │
│  • Manages storage                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CHROME STORAGE                            │
│  chrome.storage.local                                       │
│  • settings: User preferences                               │
│  • reports: User feedback on claims                         │
│  • analysisHistory: Past verifications                      │
│  • apiKeys: Optional API credentials                        │
└─────────────────────────────────────────────────────────────┘
Component Details
1. Manifest (manifest.json)
Manifest Version: V3 (required for Chrome Web Store as of 2024)

Key Permissions:

storage: Save user data locally
activeTab: Access current tab for analysis
contextMenus: Right-click "Verify" option
Content Security:

No remote code execution
All scripts bundled locally
CSP-compliant design
2. Background Service Worker (background.js)
The brain of the extension. Runs as an event-driven service worker.

Message Handlers:

javascript
// Message routing
switch (request.action) {
  case 'analyzeClaim':    // Full claim analysis
  case 'getCurrentClaim': // Get last analysis
  case 'saveReport':      // Save user feedback
  case 'getReports':      // Retrieve feedback history
  case 'getAnalysisHistory': // Get past analyses
  case 'clearHistory':    // Delete all data
}
Analysis Pipeline:

Input Text → Heuristic Analysis → Domain Trust → Score Calculation → Result
Scoring Algorithm:

javascript
// Heuristic factors (affects 60% of score)
const FACTORS = {
  sensationalWords: -8 per word (max -40),
  excessiveCaps: -15,
  excessivePunctuation: -10,
  unverifiedStats: -12,
  absoluteLanguage: -8,
  emotionalManipulation: -15,
  citesSource: +10
};

// Domain factors (affects 40% of score)
const DOMAIN_FACTORS = {
  knownCredible: +35,
  govOrEdu: +40,
  suspiciousTLD: -20,
  typosquatting: -30,
  excessiveSubdomains: -10
};
3. Content Script (content_script.js)
Injected into all web pages. Handles UI overlay.

Event Flow:

mouseup → getSelection() → validate length → position button → await click
    ↓
  click → sendMessage(analyzeClaim) → await response → renderResults()
UI Elements:

#ubn-floating-btn: Positioned near text selection
#ubn-results-panel: Fixed position results display
Security: Uses IIFE pattern to avoid global namespace pollution.

4. Popup (popup.html/js)
Extension toolbar popup. Three tabs:

Current: Shows last analyzed claim
History: List of past analyses
Stats: Aggregated statistics
5. Options Page (options.html/js)
Full-page settings interface.

Configurable Settings:

Setting	Key	Default
Show floating button	showFloatingButton	true
Auto-analyze	autoAnalyze	false
Privacy mode	privacyMode	true
6. Styles (styles.css)
Scoped CSS for content script UI.

Features:

High z-index (2147483647) to overlay any page content
Dark mode support via prefers-color-scheme
Reduced motion support for accessibility
Print styles hide extension UI
Data Structures
Claim Analysis Result
typescript
interface ClaimAnalysis {
  id: string;                    // "claim_1699999999999"
  timestamp: number;             // Unix timestamp
  claim: string;                 // Selected text (max 500 chars)
  pageUrl: string;               // Source page URL
  domain: string;                // Source domain
  scores: {
    overall: number;             // 0-100
    heuristic: HeuristicScore;
    domainTrust: DomainScore;
  };
  evidenceLinks: EvidenceLinks;
  flags: Flag[];
  recommendation: Recommendation;
}
User Report
typescript
interface UserReport {
  claimId: string;
  claim: string;                 // Truncated to 200 chars
  domain: string;
  score: number;
  userVerdict: boolean;          // true = verified, false = misinformation
  pageUrl: string;
  timestamp: number;
}
API Integration Points
Google Fact Check Tools API
javascript
const endpoint = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
// Returns matching fact-checks from verified publishers
ClaimBuster API
javascript
const endpoint = 'https://idir.uta.edu/claimbuster/api/v2/score/text/';
// Returns check-worthiness score (0-1)
Integration Example
javascript
// In background.js, add to handleClaimAnalysis():
async function enhancedAnalysis(text) {
  const { apiKeys } = await chrome.storage.local.get(['apiKeys']);
  
  if (apiKeys?.googleFactCheck) {
    const factChecks = await fetchGoogleFactCheck(text, apiKeys.googleFactCheck);
    // Merge results with heuristic analysis
  }
  
  if (apiKeys?.claimBuster) {
    const worthiness = await fetchClaimBuster(text, apiKeys.claimBuster);
    // Adjust score based on check-worthiness
  }
}
Testing Guide
Manual Testing Checklist
Text Selection
 Select text on various websites
 Verify button appears near selection
 Button disappears when clicking elsewhere
 Minimum 10 character requirement works
Analysis
 Sensational text scores lower
 Credible source URLs score higher
 Results panel displays correctly
 Fact-checker links work
User Feedback
 "Mark as True" saves correctly
 "Mark as False" saves correctly
 History shows saved reports
Settings
 Toggle switches save immediately
 API keys save securely
 Export downloads JSON file
 Clear data works
Test Cases
javascript
// High credibility claim (should score 70+)
"According to a peer-reviewed study published in Nature, researchers found evidence of..."

// Low credibility claim (should score <50)
"BREAKING: They don't want you to know this SHOCKING secret that doctors HATE!!!"

// Neutral claim (should score 50-70)
"The company announced quarterly earnings yesterday."
Packaging for Distribution
Chrome Web Store
Create production build:
bash
# Remove development files
rm -rf .git .gitignore *.md

# Ensure icons exist
ls icons/  # Should show icon16.png, icon32.png, icon48.png, icon128.png

# Create ZIP
zip -r unbreaking-news-v1.0.0.zip . -x "*.DS_Store"
Upload to Chrome Web Store Developer Dashboard
Provide required assets:
128x128 icon
1280x800 screenshot
440x280 promotional tile
Description (up to 132 characters for short, detailed for full)
Firefox (Future)
Requires manifest changes:

json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "unbreaking-news@example.com"
    }
  }
}
Performance Considerations
Content script: Lightweight, only creates UI elements when needed
Background worker: Event-driven, sleeps when inactive
Storage: Limits history to 100 items, reports to 500
Analysis: All synchronous, typically <10ms
Security Considerations
No eval(): All code is static
CSP Compliant: No inline scripts in HTML
Sanitized Output: User text is escaped before display
Local Storage: Sensitive data never leaves the browser
Minimal Permissions: Only requests what's needed
