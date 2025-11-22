# API Setup Guide - Unbreaking News Image Fact-Checking

## Overview
This guide explains how to set up and integrate the Google Fact Check API and image verification APIs into the Unbreaking News extension.

## Google Fact Check Tools API

### What It Does
- Searches verified fact-checks from professional fact-checking organizations
- Returns ratings and sources from Snopes, PolitiFact, Full Fact, etc.
- Provides structured data on verified claims

### Setup Instructions

#### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: **"Unbreaking News"**
3. Enable the **Fact Check Tools API**

#### Step 2: Create API Key
1. Go to **Credentials** in the left menu
2. Click **Create Credentials** → **API Key**
3. Copy your API key

#### Step 3: Add to Extension
1. Click the Unbreaking News extension icon
2. Go to **Settings** (gear icon)
3. Paste the API key in: **"Google Fact Check API Key"**
4. Click **Save**

### Usage Example

```javascript
// Query for fact-checks about a claim
const claim = "The 2020 election was rigged";

const response = await fetch(
  `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(claim)}&key=YOUR_API_KEY`
);

const data = await response.json();

// Returns:
// {
//   claims: [
//     {
//       text: "The 2020 election was rigged",
//       claimant: "Various sources",
//       claimReview: [
//         {
//           publisher: { name: "FactCheck.org" },
//           textualRating: "FALSE",
//           url: "https://factcheck.org/...",
//           title: "No Evidence of Widespread Rigging"
//         }
//       ]
//     }
//   ]
// }
```

### API Limits
- **Free Tier**: 5,000 queries/day
- **Paid Tier**: Higher limits available
- **Rate Limit**: 100 queries/minute

### Pricing
- **Free**: Up to 5,000 queries/day
- **Additional queries**: $1 per 1,000 queries

## Image Reverse Search APIs

### Option 1: Google Vision API (Recommended)

#### Setup
1. In Google Cloud Console, enable **Cloud Vision API**
2. Download service account JSON key
3. Configure in extension settings

#### Integration
```javascript
// Not directly available in browser (requires backend)
// Alternative: Use Google Images redirect URLs instead
const googleImagesUrl = `https://images.google.com/searchbyimage?image_url=${imageUrl}`;
```

### Option 2: TinEye API

#### What It Does
- Tracks reverse image locations
- Finds when/where images were first uploaded
- Detects image modifications

#### Setup
1. Go to [TinEye.com](https://www.tineye.com/)
2. Create API account
3. Get API key from dashboard
4. Add to extension settings

#### Usage
```javascript
// TinEye Search
const response = await fetch(
  `https://api.tineye.com/api/image/search`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer YOUR_API_KEY`
    },
    body: imageFormData
  }
);
```

#### Pricing
- API Calls: $0.25 per search
- Bulk discount available

### Option 3: Built-in Browser API

**No Cost** - Use native browser capabilities:

```javascript
// Generate reverse image search URLs (free)
const imageUrl = 'https://example.com/image.jpg';

// Google Images
window.open(`https://images.google.com/searchbyimage?image_url=${imageUrl}`);

// TinEye
window.open(`https://www.tineye.com/search?url=${imageUrl}`);

// Bing
window.open(`https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${imageUrl}`);
```

## Deepfake Detection APIs

### Option 1: Deeptrace (Paid)
```javascript
// Enterprise-grade deepfake detection
const response = await fetch(
  'https://api.deeptrace.com/api/v1/videos/detect',
  {
    method: 'POST',
    headers: { 'x-api-key': 'YOUR_KEY' }
  }
);
```

### Option 2: TensorFlow.js (Free, Local)
```javascript
// Download pre-trained models locally
import * as tf from '@tensorflow/tfjs';

// Load deepfake detection model
const model = await tf.loadLayersModel(
  'file://models/deepfake-detection-model.json'
);

// Analyze image
const prediction = await model.predict(imageData);
```

## Configuration Steps

### 1. Add API Key Storage

In `options.html`, add:
```html
<div class="api-settings">
  <h3>API Configuration</h3>
  
  <label>
    Google Fact Check API Key:
    <input type="password" id="googleFactCheckKey" placeholder="Paste API key here">
  </label>
  
  <label>
    Google Vision API Key:
    <input type="password" id="googleVisionKey" placeholder="Optional">
  </label>
  
  <label>
    TinEye API Key:
    <input type="password" id="tineyeKey" placeholder="Optional">
  </label>
  
  <button id="saveApiKeys">Save API Keys</button>
</div>
```

### 2. Save API Keys

In `options.js`:
```javascript
document.getElementById('saveApiKeys').addEventListener('click', () => {
  const apiKeys = {
    googleFactCheck: document.getElementById('googleFactCheckKey').value,
    googleVision: document.getElementById('googleVisionKey').value,
    tineye: document.getElementById('tineyeKey').value
  };
  
  chrome.storage.local.set({ apiKeys }, () => {
    alert('API keys saved securely');
  });
});
```

### 3. Use API Keys in Background Script

In `background.js`:
```javascript
async function queryGoogleFactCheck(claimText) {
  const { apiKeys = {} } = await chrome.storage.local.get(['apiKeys']);
  
  if (!apiKeys.googleFactCheck) {
    return { available: false, reason: 'No API key configured' };
  }
  
  try {
    const response = await fetch(
      `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(claimText)}&key=${apiKeys.googleFactCheck}`
    );
    
    // Process response...
  } catch (error) {
    console.error('API error:', error);
  }
}
```

## Best Practices

### Security
- ✅ Store API keys in Chrome storage (encrypted)
- ✅ Never expose keys in client-side code
- ❌ Don't commit API keys to version control
- ✅ Rotate keys regularly
- ✅ Set API restrictions in Google Cloud Console

### Performance
- 🚀 Cache API results locally
- 🚀 Use debouncing for rapid requests
- 🚀 Implement request queuing
- 🚀 Set rate limiting (max 10 requests/second)

### Error Handling
```javascript
async function queryWithErrorHandling(apiCall) {
  try {
    const result = await apiCall();
    return result;
  } catch (error) {
    if (error.code === 429) {
      // Rate limited - retry after 60 seconds
      await new Promise(r => setTimeout(r, 60000));
      return queryWithErrorHandling(apiCall);
    }
    console.error('API error:', error);
    return { available: false, error: error.message };
  }
}
```

## Testing APIs

### Test Queries

**For Fact Check API:**
```
"The Earth is flat"
"COVID-19 was created in a lab"
"The 2020 election was rigged"
```

**For Image Search:**
- Use known controversial images
- Test with both real and manipulated images

### Debugging

Enable verbose logging:
```javascript
// In background.js
const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log('[DEBUG]', ...args);
}
```

## Troubleshooting

### "API key not valid" Error
- ✓ Check API key is copied correctly
- ✓ Verify API is enabled in Google Cloud Console
- ✓ Check API restrictions match extension domain

### "Rate limit exceeded"
- ✓ Reduce request frequency
- ✓ Implement caching
- ✓ Upgrade API tier for higher limits

### "CORS error"
- ✓ Use CORS proxy if needed
- ✓ Check Chrome extension CORS policy
- ✓ Ensure API allows extension origins

## Future Enhancements

### Phase 1: Google Fact Check API ✅
- Already implemented in background.js
- Just needs API key configuration

### Phase 2: Image Reverse Search 📋
- TinEye integration
- Google Vision API
- Automated image source verification

### Phase 3: AI-Powered Detection 🔮
- TensorFlow.js deepfake detection
- Advanced image manipulation detection
- Semantic image analysis

### Phase 4: Collaborative Database 🌐
- Community reports of fake images
- Crowdsourced fact-checking
- Integration with Wikipedia

## Resources

- [Google Fact Check Tools API](https://developers.google.com/fact-check/tools/api)
- [Google Cloud Console](https://console.cloud.google.com/)
- [TinEye API Documentation](https://services.tineye.com/developers)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions)
- [TensorFlow.js Models](https://github.com/tensorflow/tfjs-models)

## Support

For API integration help:
1. Check the troubleshooting section above
2. Review API documentation
3. Check browser console for error messages
4. Open GitHub issue with error logs

---

**Last Updated**: November 22, 2025
**Maintained By**: Unbreaking News Development Team
