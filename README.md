# 🛡️ Veritas, Let No Lie Pass
Veritas is a Chromium browser extension developed to combat misinformation.\
This utility combines text-based heuristic analysis and a client-side image forensics lab in order to centralize and expedite the fact-checking process as well as rectifying the daily Internet usage towards prudence.\
Using <i>Manifest V3</i>, it requires <b>Chrome 88 or later</b>.

## Table of Content
1. [Core Concept](#💡-core-concept)
2. [Project Structure](#📂-project-structure)
3. [Use Cases](#🚀-use-cases)
4. [Technology Choices](#⚙️-technology-choices)
5. [Technical Architecture](#📐-technical-architecture)
6. [Pipelining and Data Flow](#🔄-pipelining-and-data-flow)
99. [The Future of this Project](#🕰️-the-future-of-this-project)


## 💡 Core Concept
In the contemporary era of generative AI breakthroughs came a massive throughput of information on the Internet that has morphed it into a hodgepodge of varying credibility. 

As such, it became crucial to test it against historical records and savvy their soundness.

## 📂 Project Structure
```
/extension
    ├─── manifest.json          # Core configuration file
    ├─── background.js          # Background Service Worker
    ├─── content_script.js      # Script injection (DOM interaction)
    ├─── popup.html             # Toolbar popup UI
    ├─── popup.js               # Logic for popup UI
    ├─── options.html           # Options page UI
    ├─── options.js             # Logic for settings and data export
    ├─── piexif.min.js          # EXIF metadata parsing
    ├─── forensics.html         # Forensics lab UI
    ├─── forensics.js           # Logic for image processing
    ├─── forensics.css          # Styling for forensics lab
    ├─── styles.css             # Overall styling
    |___ /icons
            ├─── icon128.png
            ├─── icon48.png
            ├─── icon32.png
            |___ icon16.png
```

## 🚀 Use Cases
Given the present contraints, we narrowed our software down to two main functionalities:
* <b>Linguistic Analysis:</b> Scanning the highlighted text for:
    * Sensationalist patterns
    * Clickbaiters
    * Conspiracy markers
    * Credibility boosters
    * Known facts
* <b>Forensics Lab:</b> Digital utilities for digital image forensics:
    * Magnifier
    * Error Level Analysis
    * Noise Analysis
    * Edge Detection
    * Level Sweep
    * Luminance Gradient
    * Clone Detection
    * Histogram
    * EXIF Data
    * JPEG Analysis
    * String Extraction
    * Auto Contrast
    * Sharpen
    * Color Channels

The user has the option to extract the results of their investigations via the Options page.

The options page also allows the user to enter their API key for their <i>ClaimBuster</i> (appears to be deprecated) and <i>Google Fact Check</i>, though that's currently unused.
## ⚙️ Technology Choices
Our choices were driven by prioritizing <b>compatibility</b>, <b>performance</b>, <b>security</b> and most importantly <b>privacy</b>.
* <b>Chrome Extension Manifest V3:</b> The latest standard for browser extensions was adopted to ensure upward compatibility and robust security.\
The memory overhead is reduced while idle by having `background.js` as a service worker instead of using a persistent background page.

* <b>Vanilla Javascript (ES6+):</b> No heavy frameworks are needed for our objectives, it is lightweight and readability is ensured.\
DOM manipulation, essential for `content_script.js`, is done seamlessly without style conflicts.

* <b>HTML5 Canvas API:</b> Useful for image processing done by `forensics.js` on the client side to read ImageData and apply the respective mathematical transformations (ELA, Edge Detection...).

* <b>Local Storage API:</b> Analysis history, reports as well as settings are kept in `chrome.storage.local` unless the user chooses to export it. This is to ensure privacy.

## 📐 Technical Architecture
The project follows this modular architecture:
### Background Service `background.js`
This is the central piece of the extension.\
It houses dictionaries such as <i>SENSATIONAL_WORDS</i> and <i>CREDIBILITY_BOOSTERS</i> as well as the scoring algorithm.\
It takes the role of receiving text from content scripts, calculating credibility scores and managing the persistent history in `chrome.storage.local`.
### Content Injector `content_script.js`
This serves as the link between the user and the webpage.
It listens for `mouseup` events (text selection).
It injects a shadow DOM (attach DOM elements to tree) or isolated div elements for the floating verification button and results panel so as not to break the UI.
### Forensics Lab `forensics.*`
A standalone SPA (single-page application) bundled with the extension.
* <b>EXIF Parser:</b> Using `piexif.min.js` for metadata
* <b>Image Processing Algorithms:</b>
    * <b>applyELA()</b> Recompression to identify differences
    * <b>applyEdgeDetection()</b> Gaussian high-pass filters
    * <b>applyHistogram()</b> Visualize color distribution

### Options and Popup `options.*`, `popup.*`
Used for configuration and data visualization.
It can be expanded to support <b>API keys</b> and export their analysis data.

## 🔄 Pipelining and Data Flow

## 🕰️ The Future of this Project
We would like to make this project available on Chromium based browsers on Android, as well as Firefox browser and Safari.

We are also looking forward to bolstering this project by switching from a primitive mass of lists to a more intelligent approach by incorporating techniques such as <b>sentiment analysis via machine learning</b> under a score-based system to <i>penalize manipulative marketing</i> and <i>compliment neutral content</i> while highlighting the weak and strong points, side-to-side with an <b>AI detector</b> (similar to <b>Quillbot</b>).
