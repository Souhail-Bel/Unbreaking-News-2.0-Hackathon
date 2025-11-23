# 🛡️ Veritas, Let No Lie Pass
`by Team: El Tabassi de Novo`

`Souhail Ben Belhassen, Semah Soudani, Mohamed Yassine Ben Slama`

<div align="center">
  <img src="extension/icons/icon128.png" width="100" alt="Extension Icon">
</div>

Veritas is a Chromium browser extension developed to combat misinformation.\
This utility combines text-based heuristic analysis and a client-side image forensics lab in order to centralize and expedite the fact-checking process as well as rectifying the daily Internet usage towards prudence.\
> [!NOTE]
> Using <i>Manifest V3</i>, the extension requires <b>Chrome 88 or later</b>[^1].

> [!WARNING]
> While used for fact-checking, the extension is still in development phase and may not be effective in all fact-checking scenarios.


## Table of Content
1. [Core Concept](#-core-concept)
2. [Installing and Running](#-installing-and-running)
3. [Project Structure](#-project-structure)
4. [Use Cases](#-use-cases)
5. [Technology Choices](#%EF%B8%8F-technology-choices)
6. [Technical Architecture](#-technical-architecture)
7. [Pipelining and Data Flow](#-pipelining-and-data-flow)
8. [Evaluation and Testing](#-evaluation-and-testing)
99. [The Future of this Project](#%EF%B8%8F-the-future-of-this-project)


## 💡 Core Concept
In the contemporary era of generative AI breakthroughs came a massive throughput of information on the Internet that has morphed it into a hodgepodge of varying credibility. 

As such, it became crucial to test it against historical records and savvy their soundness.

## 💾 Installing and Running
### 📥 Installing
1. If you're on Google Chrome, head over to `chrome://extensions`\
   If you're on Brave Browser, head over to `brave://extensions`\
   Otherwise, look up the analog website for your chromium browser
3. Enable developer options
4. Select import unpacked extension
5. Head over to the `extension` folder and select it (in some cases, you might need to select a file, select `manifest.json` in that case)
6. Enjoy :)
### 💠 Running
#### Text Analysis
Select a text on a website, now either:
* Click on the <b>"Verify"</b> button or,
* Right click and select <b>"Verify this claim"</b> in the context menu

You can later check the stats or history (and even download the reports!)
#### Forensics Lab
Click on the extension icon in the toolbar.\
Now, select `Tools` and then `Forensics Lab`.\
This will take you to a website where you can either click and choose an image or drag and drop.\
The tool are displayed by the image and the metadata on the opposite end.\

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
* <b>Chrome Extension Manifest V3[^1]:</b> The latest standard for browser extensions was adopted to ensure upward compatibility and robust security.\
The memory overhead is reduced while idle by having `background.js` as a service worker instead of using a persistent background page.

* <b>Vanilla Javascript (ES6[^2]+):</b> No heavy frameworks are needed for our objectives, it is lightweight and readability is ensured.\
DOM manipulation, essential for `content_script.js`, is done seamlessly without style conflicts.

* <b>HTML5 Canvas API[^3]:</b> Useful for image processing done by `forensics.js` on the client side to read ImageData and apply the respective mathematical transformations (ELA, Edge Detection...).

* <b>Local Storage API[^4]:</b> Analysis history, reports as well as settings are kept in `chrome.storage.local` unless the user chooses to export it. This is to ensure privacy.

## 📐 Technical Architecture
The project follows this modular architecture:
### Background Service `background.js`
This is the central piece of the extension.\
It houses dictionaries such as <i>SENSATIONAL_WORDS</i> and <i>CREDIBILITY_BOOSTERS</i> as well as the scoring algorithm.\
It takes the role of receiving text from content scripts, calculating credibility scores and managing the persistent history in `chrome.storage.local`.
### Content Injector `content_script.js`
This serves as the link between the user and the webpage.
It listens for `mouseup` events (text selection).
It injects a shadow DOM[^5] (attach DOM elements to tree) or isolated div elements for the floating verification button and results panel so as not to break the UI.
### Forensics Lab `forensics.*`
A standalone SPA (single-page application) bundled with the extension.
* <b>EXIF Parser:</b> Using `piexif.min.js`[^6] for metadata
* <b>Image Processing Algorithms:</b>
    * <b>applyELA()</b> Recompression to identify differences
    * <b>applyEdgeDetection()</b> Gaussian high-pass filters
    * <b>applyHistogram()</b> Visualize color distribution

### Options and Popup `options.*`, `popup.*`
Used for configuration and data visualization.
It can be expanded to support <b>API keys</b> and export their analysis data.

## 🔄 Pipelining and Data Flow
We will discuss how components pass and process information.
### Text Analysis Pipeline
User Selection ▶️ Credibility Score
* <b>Trigger:</b> User selection on a DOM element is handled with `mouseup` event
* <b>Capture:</b> Done via `content_script.js`
* <b>Transport:</b> `chrome.runtime.sendMessage` send a message
* <b>Processing:</b>
    1. Wake up `background.js` (Service Worker)
    2. Normalize and tokenize input text
    3. Cross-reference against dictionaries
    4. Calculate 0-100 confidence score
* <b>Persistence:</b> Save result in `chrome.storage.local` (depending on privacy mode)
* <b>Feedback:</b> Send score and recommendation back to `content_script.js`
* <b>Render:</b> Inject the results panel into the DOM via `content_script.js`
### Image Forensics Pipeline
* <b>Loading:</b> Fetch image and draw onto HTML5's `<canvas>` element.
* <b>Analysis:</b> Client-sided
    * <b>Magnifier:</b> Scale a portion of an image around the mouse by a `zoom` factor
    * <b>ELA:</b> Convert canvas data to JPEG, re-read and calculate pixel differences
    * <b>Noise Analysis:</b> Calculate local variance per pixel in a 3x3 neighborhood then combine channels
    * <b>Sobel's Edge Detection:</b> Runs Sobel filter[^7] via convolution kernels
    * <b>Level Sweep:</b> Calculate luminance against a certain level
    * <b>Luminance Gradient:</b> Calculate luminance per pixel and its neighborhoods
    * <b>Clone Detection:</b> Extract blocks and their respective hashes, find similarities and spatial separation and draw each pair by colour and a connecting line
    * <b>Histogram:</b> Count pixel values and assign them to RGB channels (+ luminance) then draw the histogram, draw luminance line, labels and calculate statistics
    * <b>Metadata:</b> `piexif.js`[^6] parses binary string for EXIF tags
    * <b>JPEG Analysis:</b> Draw 8x8 JPEG block grid, horizontal and vertical lines and check for block alignement
    * <b>String Extraction:</b> Get image as base64, then to binary string and search for printable ASCII sequences (ignoring those that are less than 5 characters long, pure numbers, hex-only strings and uninteresting patterns, duplicates)
    * <b>Autocontrast</b>: Apply contrast stretching (or normalization)[^8]
    * <b>Sharpen:</b> Apply unsharp mask kernel[^9]
    * <b>Per-channel view:</b> View individual RGB channels
    * <b>Reverse Image Search:</b> Look up the image online on <i>Google</i>, <i>Yandex</i>, <i>Bing</i> or <i>Tineye</i>\
    It is also possible to access these utilities via keyboard shortcuts. For instance: 'n' or '4' for `noise analysis` and 'e' or '3' for `ela`

## 🧪 Evaluation and Testing
### Text Analysis
#### Where it shines 🌟
<b>Is the Earth flat?</b>
<img width="1366" height="768" alt="guardian_article" src="https://github.com/user-attachments/assets/e97a4f91-0e3b-4907-9dbc-e568b6718e73" />

<b>Did France win the 2018 FIFA World Cup in Russia?</b>
<img width="1366" height="768" alt="france_2018_fifa" src="https://github.com/user-attachments/assets/09384771-0902-4a28-949d-810ead1037bc" />

While it's true these entries belong to dictionaries, it still holds that it successfully identified the context and checked for credibility indictators.
We can try it against a topic like mathematics.
We noticed that earlier versions were aggressive against the absolute language of mathematics, but we refined that by properly isolating the "absolute language" case, as evident by this remarkable result when it correctly deemed the article about [Wedge Sum](https://en.wikipedia.org/wiki/Wedge_sum) as credible.
<img width="1366" height="768" alt="wedge_sum" src="https://github.com/user-attachments/assets/9ce2f067-3b10-4a9e-aade-56b47bc7defa" />


#### Where it (still) fails ❌
On fake sites like onion where it _feels_ like it's credible, it fails and deems it as such.
This is an example from **the Onion** website.
<img width="1366" height="768" alt="false_onion_news_identified" src="https://github.com/user-attachments/assets/85a48d89-7448-49f4-9144-a24a85c35593" />

### Forensics Lab
Here, we demonstrate the capabilities of the Error Level Analysis.\
Input Image:\
![FotoForensics](https://github.com/user-attachments/assets/7352902c-53e5-40f9-9b07-925b8b36f57e)\
ELA results:\
<img width="1366" height="768" alt="ela_results_showing_manip" src="https://github.com/user-attachments/assets/9af2a8b7-e313-496b-a86c-4c6afef233f9" />




## 🕰️ The Future of this Project
We would like to make this project available on Chromium based browsers on Android, as well as Firefox browser and Safari.

We are also looking forward to bolstering this project by switching from a primitive mass of lists to a more intelligent approach by incorporating techniques such as <b>sentiment analysis[^10] via machine learning</b> under a score-based system to <i>penalize manipulative marketing</i> and <i>compliment neutral content</i> while highlighting the weak and strong points, side-to-side with an <b>AI detector</b> (similar to <b>Quillbot AI Content Detector[^11]</b>).\
As an addendum, we can improve the JPEG analysis tool to incorporate [DCT discrete cosine transform)[^12], quantize and compress for block alignement, check out <b>JPEG Blocking[^13]</b>. Another possibility is using <b>FFmpeg[^14]</b> to expand the utility to videos.


[^1]: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
[^2]: https://262.ecma-international.org/6.0/
[^3]: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
[^4]: https://developer.chrome.com/docs/extensions/reference/api/storage
[^5]: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM
[^6]: https://github.com/hMatoba/piexifjs
[^7]: https://en.wikipedia.org/wiki/Sobel_operator
[^8]: https://homepages.inf.ed.ac.uk/rbf/HIPR2/stretch.htm
[^9]: https://en.wikipedia.org/wiki/Unsharp_masking
[^10]: https://www.geeksforgeeks.org/machine-learning/what-is-sentiment-analysis/
[^11]: https://quillbot.com/ai-content-detector
[^12]: https://en.wikipedia.org/wiki/Discrete_cosine_transform
[^13]: http://www.signalsguru.net/articles/jpegblocking/imagecompress.html
[^14]: https://www.ffmpeg.org/
