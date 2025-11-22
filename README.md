🛡️ Unbreaking News
Combat misinformation with OSINT-powered verification

A Chrome/Chromium browser extension that helps users verify claims and detect potential misinformation using Open Source Intelligence (OSINT) techniques.

🎯 Features
Text Selection Verification: Select any text on a webpage and instantly analyze it for credibility
Credibility Scoring: Get a 0-100 score based on heuristic analysis
Fact-Checker Links: Quick access to Snopes, PolitiFact, FactCheck.org, and more
Domain Trust Analysis: Automatic assessment of source credibility
Privacy-First: All analysis runs locally; only sends data when you click verification links
User Feedback: Mark claims as true/false to track your verification history
📁 Project Structure
unbreaking-news/
├── manifest.json          # Extension configuration (Manifest V3)
├── background.js          # Service worker for claim analysis
├── content_script.js      # Injected script for text selection
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── options.html           # Settings page
├── options.js             # Settings logic
├── styles.css             # Content script styles
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
🚀 Installation
From Source (Development)
Clone or download this repository
Generate icons from the SVG or use placeholder PNGs (16x16, 32x32, 48x48, 128x128)
Open Chrome and navigate to chrome://extensions/
Enable Developer mode (toggle in top right)
Click Load unpacked
Select the extension folder
The extension icon should appear in your toolbar!
Creating Icons
Use any image editor to export the SVG at these sizes:

icon16.png - 16x16px
icon32.png - 32x32px
icon48.png - 48x48px
icon128.png - 128x128px
🎮 Usage
Verifying a Claim
Select text on any webpage (minimum 10 characters)
Click the floating "🔍 Verify" button that appears
View the analysis in the results panel:
Credibility score (0-100)
Warning flags detected
Links to fact-checkers
Search engine queries
Using the Popup
Click the extension icon in your toolbar to:

View the last analyzed claim
Browse your verification history
See statistics on claims you've checked
Access settings
Settings
Access via the options page to configure:

Show/hide floating button
Enable privacy mode (don't store full claim text)
Add API keys for enhanced verification (optional)
Export or clear your data
🧠 How It Works
Heuristic Analysis
The extension analyzes text for common misinformation patterns:

Pattern	Impact
Sensational language ("SHOCKING", "They don't want you to know")	-8 to -15 points
Excessive capitalization	-15 points
Unverified statistics	-12 points
Emotional manipulation	-15 points
Absolute language ("always", "never")	-8 points
Source citations	+10 points
Domain Trust
Sources are scored based on:

Known credible news organizations (+35 points)
Government/educational domains (.gov, .edu) (+40 points)
Suspicious TLDs (.xyz, .click) (-20 points)
Typosquatting patterns (-30 points)
Scoring Formula
Overall Score = (Heuristic Score × 0.6) + (Domain Trust × 0.4)
🔒 Privacy
Local Processing: All analysis runs in your browser
No External APIs by Default: Only connects to search engines when you click links
Privacy Mode: Option to store only scores, not claim text
Data Export: Download your data anytime as JSON
Full Control: Clear all data with one click
🛠️ Development
Testing Changes
Make changes to the source files
Go to chrome://extensions/
Click the refresh icon on the Unbreaking News card
Test on any webpage
Debug Mode
Open DevTools on any page: View content script logs
Open the extension popup, right-click → Inspect: View popup logs
Go to chrome://extensions/ → Service Worker: View background logs
Building for Production
Remove any console.log statements
Ensure all icons are present
Zip the entire folder (excluding .git, README for submission)
Upload to Chrome Web Store Developer Dashboard
🔌 API Integration (Optional)
Enhance verification with external APIs:

Google Fact Check Tools API
javascript
// Add to background.js
async function checkGoogleFactCheck(claim) {
  const key = await getApiKey('googleFactCheck');
  const response = await fetch(
    `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(claim)}&key=${key}`
  );
  return response.json();
}
ClaimBuster API
javascript
// Scores text for "check-worthiness"
async function checkClaimBuster(claim) {
  const response = await fetch('https://idir.uta.edu/claimbuster/api/v2/score/text/', {
    method: 'POST',
    headers: { 'x-api-key': API_KEY },
    body: JSON.stringify({ input_text: claim })
  });
  return response.json();
}
📈 Future Improvements
 Reverse image search integration
 Machine learning-based claim detection
 Browser sync for cross-device history
 Crowdsourced claim database
 Multi-language support
 Firefox/Safari ports
🏆 Hackathon Info
Built for the Unbreaking News Hackathon - promoting media literacy and combating misinformation through technology.

Team Deliverables
✅ Working browser extension
✅ Technical documentation
✅ Clean, commented code
📹 90-second demo video (create separately)
🎨 Marketing assets (create separately)
📄 License
MIT License - Feel free to use, modify, and distribute.

🤝 Contributing
Fork the repository
Create a feature branch
Submit a pull request
Made with ❤️ for truth and transparency

