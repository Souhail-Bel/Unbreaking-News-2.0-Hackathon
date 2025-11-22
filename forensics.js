/**
 * Unbreaking News - Forensics Lab
 * Image authentication and analysis tools
 */

// ============================================
// STATE & ELEMENTS
// ============================================

let originalImage = null;
let originalImageData = null;
let currentTool = 'original';
let imageInfo = {};

let canvas, ctx, dropZone, fileInput, canvasContainer, toolControls, magnifierLens;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Get DOM elements
  canvas = document.getElementById('main-canvas');
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  dropZone = document.getElementById('drop-zone');
  fileInput = document.getElementById('file-input');
  canvasContainer = document.getElementById('canvas-container');
  toolControls = document.getElementById('tool-controls');
  magnifierLens = document.getElementById('magnifier-lens');
  
  console.log('Forensics Lab initialized');
  console.log('Canvas:', canvas);
  console.log('Context:', ctx);
  
  setupEventListeners();
  
  // Check if image was passed from context menu
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const { forensicsImageUrl } = await chrome.storage.local.get(['forensicsImageUrl']);
      if (forensicsImageUrl) {
        await loadImageFromUrl(forensicsImageUrl);
        chrome.storage.local.remove(['forensicsImageUrl']);
      }
    }
  } catch (e) {
    console.log('Running outside extension context or no image passed');
  }
}

function setupEventListeners() {
  // File input & drag/drop
  if (dropZone) {
    dropZone.addEventListener('click', (e) => {
      console.log('Drop zone clicked');
      fileInput.click();
    });
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
  }
  
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      console.log('File input changed', e.target.files);
      handleFileSelect(e);
    });
  }
  
  // Tool buttons
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => selectTool(btn.dataset.tool));
  });
  
  // Header buttons
  const btnUpload = document.getElementById('btn-upload');
  if (btnUpload) {
    btnUpload.addEventListener('click', () => {
      console.log('Upload button clicked');
      fileInput.click();
    });
  }
  
  const btnReverseSearch = document.getElementById('btn-reverse-search');
  if (btnReverseSearch) {
    btnReverseSearch.addEventListener('click', reverseImageSearch);
  }
  
  // Tool controls
  setupToolControls();
  
  // Canvas interactions for magnifier
  if (canvasContainer) {
    canvasContainer.addEventListener('mousemove', handleCanvasMouseMove);
    canvasContainer.addEventListener('mouseleave', handleCanvasMouseLeave);
  }
  
  console.log('Event listeners set up');
}

function setupToolControls() {
  // ELA controls
  const elaQuality = document.getElementById('ela-quality');
  const elaEnhance = document.getElementById('ela-enhance');
  
  if (elaQuality) {
    elaQuality.addEventListener('input', (e) => {
      document.getElementById('ela-quality-value').textContent = e.target.value;
      if (currentTool === 'ela') applyELA();
    });
  }
  
  if (elaEnhance) {
    elaEnhance.addEventListener('input', (e) => {
      document.getElementById('ela-enhance-value').textContent = e.target.value;
      if (currentTool === 'ela') applyELA();
    });
  }
  
  // Magnifier controls
  const magZoom = document.getElementById('mag-zoom');
  const magSize = document.getElementById('mag-size');
  
  if (magZoom) {
    magZoom.addEventListener('input', (e) => {
      document.getElementById('mag-zoom-value').textContent = e.target.value;
    });
  }
  
  if (magSize) {
    magSize.addEventListener('input', (e) => {
      document.getElementById('mag-size-value').textContent = e.target.value;
      magnifierLens.style.width = e.target.value + 'px';
      magnifierLens.style.height = e.target.value + 'px';
    });
  }
  
  // Noise controls
  const noiseSens = document.getElementById('noise-sens');
  if (noiseSens) {
    noiseSens.addEventListener('input', (e) => {
      document.getElementById('noise-sens-value').textContent = e.target.value;
      if (currentTool === 'noise') applyNoiseAnalysis();
    });
  }
  
  // Level sweep controls
  const levelSweep = document.getElementById('level-sweep');
  const levelWindow = document.getElementById('level-window');
  
  if (levelSweep) {
    levelSweep.addEventListener('input', (e) => {
      document.getElementById('level-value').textContent = e.target.value;
      if (currentTool === 'levels') applyLevelSweep();
    });
  }
  
  if (levelWindow) {
    levelWindow.addEventListener('input', (e) => {
      document.getElementById('level-window-value').textContent = e.target.value;
      if (currentTool === 'levels') applyLevelSweep();
    });
  }
  
  // Channel buttons
  document.querySelectorAll('.channel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (currentTool === 'channels') applyChannelView(btn.dataset.channel);
    });
  });
}

// ============================================
// FILE HANDLING
// ============================================

function handleDragOver(e) {
  e.preventDefault();
  dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    loadImageFromFile(file);
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    loadImageFromFile(file);
  }
}

async function loadImageFromFile(file) {
  console.log('Loading file:', file.name, file.type, file.size);
  
  imageInfo.fileName = file.name;
  imageInfo.fileSize = formatFileSize(file.size);
  imageInfo.fileType = file.type || 'unknown';
  imageInfo.lastModified = new Date(file.lastModified).toLocaleString();
  
  // Use FileReader to read the file
  const reader = new FileReader();
  
  reader.onload = (e) => {
    console.log('FileReader loaded, data length:', e.target.result.length);
    loadImage(e.target.result);
  };
  
  reader.onerror = (e) => {
    console.error('FileReader error:', e);
    showResult('error', 'Failed to read the file.');
  };
  
  reader.readAsDataURL(file);
}

async function loadImageFromUrl(url) {
  showResult('info', 'Loading image from URL...');
  
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    
    imageInfo.fileName = url.split('/').pop().split('?')[0] || 'External Image';
    imageInfo.fileSize = formatFileSize(blob.size);
    imageInfo.fileType = blob.type || 'image/unknown';
    imageInfo.sourceUrl = url;
    
    const reader = new FileReader();
    reader.onload = (e) => loadImage(e.target.result);
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error('Failed to load image:', error);
    showResult('error', `
      <strong>Failed to load image</strong><br><br>
      The image may be protected by CORS policy. Try one of these options:<br><br>
      • Download the image and upload it manually<br>
      • Right-click → "Save image as..." then drag it here
    `);
  }
}

function loadImage(src) {
  console.log('loadImage called, src type:', src.substring(0, 50));
  
  const img = new Image();
  
  img.onload = () => {
    console.log('Image onload fired:', img.width, 'x', img.height);
    
    if (img.width === 0 || img.height === 0) {
      showResult('error', 'Image has invalid dimensions.');
      return;
    }
    
    originalImage = img;
    
    // Set canvas dimensions
    canvas.width = img.width;
    canvas.height = img.height;
    
    console.log('Canvas size set to:', canvas.width, 'x', canvas.height);
    
    // Clear canvas first
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw the image
    ctx.drawImage(img, 0, 0);
    
    console.log('Image drawn to canvas');
    
    // Capture the image data
    try {
      originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      console.log('ImageData captured, length:', originalImageData.data.length);
      
      // Verify image data is not all zeros
      let nonZeroCount = 0;
      for (let i = 0; i < Math.min(1000, originalImageData.data.length); i++) {
        if (originalImageData.data[i] !== 0) nonZeroCount++;
      }
      console.log('Non-zero pixels in first 1000:', nonZeroCount);
      
    } catch (e) {
      console.error('Failed to get image data:', e);
      showResult('error', 'Failed to process image. It may be tainted by CORS.');
      return;
    }
    
    // Update UI - show canvas, hide drop zone
    dropZone.style.display = 'none';
    canvasContainer.style.display = 'flex';
    canvasContainer.classList.remove('hidden');
    
    // Update info panel
    updateImageInfo();
    
    showResult('success', `
      <strong>✅ Image loaded successfully!</strong><br><br>
      Dimensions: ${img.width} × ${img.height}<br>
      File: ${imageInfo.fileName || 'Unknown'}<br><br>
      Select an analysis tool from the sidebar to begin.
    `);
  };
  
  img.onerror = (e) => {
    console.error('Image onerror fired:', e);
    showResult('error', 'Failed to load image. The file may be corrupted or unsupported format.');
  };
  
  // Set the source to trigger loading
  img.src = src;
  
  console.log('Image src set, waiting for load...');
}

function updateImageInfo() {
  document.getElementById('info-dimensions').textContent = `${canvas.width} × ${canvas.height}`;
  document.getElementById('info-filesize').textContent = imageInfo.fileSize || '-';
  document.getElementById('info-format').textContent = imageInfo.fileType || '-';
  document.getElementById('info-depth').textContent = '32-bit RGBA';
  
  // Update metadata panel
  updateMetadataPanel();
}

function updateMetadataPanel() {
  const content = document.getElementById('metadata-content');
  
  let html = `
    <div class="metadata-item">
      <span class="metadata-key">File Name</span>
      <span class="metadata-value">${imageInfo.fileName || '-'}</span>
    </div>
    <div class="metadata-item">
      <span class="metadata-key">Dimensions</span>
      <span class="metadata-value">${canvas.width} × ${canvas.height} px</span>
    </div>
    <div class="metadata-item">
      <span class="metadata-key">File Size</span>
      <span class="metadata-value">${imageInfo.fileSize || '-'}</span>
    </div>
    <div class="metadata-item">
      <span class="metadata-key">MIME Type</span>
      <span class="metadata-value">${imageInfo.fileType || '-'}</span>
    </div>
    <div class="metadata-item">
      <span class="metadata-key">Total Pixels</span>
      <span class="metadata-value">${(canvas.width * canvas.height).toLocaleString()}</span>
    </div>
    <div class="metadata-item">
      <span class="metadata-key">Aspect Ratio</span>
      <span class="metadata-value">${getAspectRatio(canvas.width, canvas.height)}</span>
    </div>
  `;
  
  if (imageInfo.lastModified) {
    html += `
      <div class="metadata-item">
        <span class="metadata-key">Last Modified</span>
        <span class="metadata-value">${imageInfo.lastModified}</span>
      </div>
    `;
  }
  
  if (imageInfo.sourceUrl) {
    html += `
      <div class="metadata-item">
        <span class="metadata-key">Source URL</span>
        <span class="metadata-value" style="font-size: 10px;">${imageInfo.sourceUrl.substring(0, 50)}...</span>
      </div>
    `;
  }
  
  content.innerHTML = html;
}

function getAspectRatio(w, h) {
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const divisor = gcd(w, h);
  return `${w / divisor}:${h / divisor}`;
}

// ============================================
// TOOL SELECTION
// ============================================

function selectTool(tool) {
  currentTool = tool;
  
  // Update button states
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  
  // Hide all control panels
  document.querySelectorAll('.control-panel').forEach(p => p.classList.add('hidden'));
  if (toolControls) toolControls.classList.add('hidden');
  if (magnifierLens) magnifierLens.classList.add('hidden');
  
  if (!originalImage) {
    showResult('info', 'Please load an image first.');
    return;
  }
  
  // Apply selected tool
  switch (tool) {
    case 'original':
      showOriginal();
      break;
    case 'magnifier':
      setupMagnifier();
      break;
    case 'ela':
      applyELA();
      showControls('ela-controls');
      break;
    case 'noise':
      applyNoiseAnalysis();
      showControls('noise-controls');
      break;
    case 'edges':
      applyEdgeDetection();
      break;
    case 'levels':
      applyLevelSweep();
      showControls('levels-controls');
      break;
    case 'luminance':
      applyLuminanceGradient();
      break;
    case 'clone':
      applyCloneDetection();
      break;
    case 'histogram':
      showHistogram();
      break;
    case 'metadata':
      showMetadata();
      break;
    case 'jpeg':
      analyzeJPEG();
      break;
    case 'strings':
      extractStrings();
      break;
    case 'contrast':
      applyAutoContrast();
      break;
    case 'sharpen':
      applySharpen();
      break;
    case 'channels':
      applyChannelView('rgb');
      showControls('channel-controls');
      break;
  }
}

function showControls(panelId) {
  if (toolControls) toolControls.classList.remove('hidden');
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.remove('hidden');
}

function showOriginal() {
  if (originalImageData && ctx) {
    ctx.putImageData(originalImageData, 0, 0);
  }
  showResult('info', `
    <strong>Original Image</strong><br><br>
    Showing the unmodified original image.<br><br>
    Select an analysis tool from the sidebar to begin forensic examination.
  `);
}

// ============================================
// MAGNIFIER TOOL
// ============================================

function setupMagnifier() {
  ctx.putImageData(originalImageData, 0, 0);
  magnifierLens.classList.remove('hidden');
  showResult('info', `
    <strong>Magnifier Tool</strong><br><br>
    Move your cursor over the image to magnify details.<br><br>
    <strong>Controls:</strong><br>
    • Zoom: Adjust magnification level<br>
    • Lens Size: Change the magnifier diameter<br><br>
    <em>Useful for examining pixel-level details and finding subtle edits.</em>
  `);
}

function handleCanvasMouseMove(e) {
  if (currentTool !== 'magnifier' || !originalImage) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Check if mouse is over canvas
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
    magnifierLens.style.display = 'none';
    return;
  }
  
  magnifierLens.style.display = 'block';
  
  const zoom = parseInt(document.getElementById('mag-zoom')?.value || 4);
  const size = parseInt(document.getElementById('mag-size')?.value || 150);
  
  // Position lens at cursor
  const containerRect = canvasContainer.getBoundingClientRect();
  magnifierLens.style.left = (e.clientX - containerRect.left - size / 2) + 'px';
  magnifierLens.style.top = (e.clientY - containerRect.top - size / 2) + 'px';
  magnifierLens.style.width = size + 'px';
  magnifierLens.style.height = size + 'px';
  
  // Calculate background position for zoom effect
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const imgX = x * scaleX;
  const imgY = y * scaleY;
  
  // Use original image for magnification
  magnifierLens.style.backgroundImage = `url(${originalImage.src})`;
  magnifierLens.style.backgroundSize = `${canvas.width * zoom}px ${canvas.height * zoom}px`;
  magnifierLens.style.backgroundPosition = `${-imgX * zoom + size / 2}px ${-imgY * zoom + size / 2}px`;
}

function handleCanvasMouseLeave() {
  if (currentTool === 'magnifier') {
    magnifierLens.style.display = 'none';
  }
}

// ============================================
// ERROR LEVEL ANALYSIS (ELA)
// ============================================

function applyELA() {
  const quality = parseInt(document.getElementById('ela-quality')?.value || 90);
  const enhance = parseInt(document.getElementById('ela-enhance')?.value || 10);
  
  showResult('info', 'Processing Error Level Analysis...');
  
  // Create temporary canvas for recompression
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(originalImage, 0, 0);
  
  // Recompress at specified quality
  const recompressed = new Image();
  recompressed.onload = () => {
    tempCtx.drawImage(recompressed, 0, 0);
    const recompData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Calculate difference between original and recompressed
    const origData = originalImageData.data;
    const recompDataArr = recompData.data;
    const result = ctx.createImageData(canvas.width, canvas.height);
    
    let maxDiff = 0;
    const diffs = [];
    
    for (let i = 0; i < origData.length; i += 4) {
      const diffR = Math.abs(origData[i] - recompDataArr[i]);
      const diffG = Math.abs(origData[i + 1] - recompDataArr[i + 1]);
      const diffB = Math.abs(origData[i + 2] - recompDataArr[i + 2]);
      const avgDiff = (diffR + diffG + diffB) / 3;
      diffs.push(avgDiff);
      maxDiff = Math.max(maxDiff, avgDiff);
    }
    
    // Apply enhanced difference to result
    let idx = 0;
    for (let i = 0; i < origData.length; i += 4) {
      const diffR = Math.abs(origData[i] - recompDataArr[i]) * enhance;
      const diffG = Math.abs(origData[i + 1] - recompDataArr[i + 1]) * enhance;
      const diffB = Math.abs(origData[i + 2] - recompDataArr[i + 2]) * enhance;
      
      result.data[i] = Math.min(255, diffR);
      result.data[i + 1] = Math.min(255, diffG);
      result.data[i + 2] = Math.min(255, diffB);
      result.data[i + 3] = 255;
      idx++;
    }
    
    ctx.putImageData(result, 0, 0);
    
    // Calculate average error level
    const avgError = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    
    showResult('info', `
      <strong>Error Level Analysis (ELA)</strong><br><br>
      ELA reveals areas that may have different compression histories, 
      potentially indicating manipulation.<br><br>
      <strong>Statistics:</strong><br>
      • Quality: ${quality}%<br>
      • Enhancement: ${enhance}x<br>
      • Max Error: ${maxDiff.toFixed(1)}<br>
      • Avg Error: ${avgError.toFixed(2)}<br><br>
      <strong>Interpretation:</strong><br>
      • <span style="color:#22c55e">Uniform brightness</span> = consistent compression<br>
      • <span style="color:#ef4444">Bright patches</span> = possible edits<br>
      • Edges naturally show higher error levels
    `);
  };
  
  recompressed.src = tempCanvas.toDataURL('image/jpeg', quality / 100);
}

// ============================================
// NOISE ANALYSIS
// ============================================

function applyNoiseAnalysis() {
  const sensitivity = parseInt(document.getElementById('noise-sens')?.value || 20);
  
  showResult('info', 'Analyzing noise patterns...');
  
  const data = originalImageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const result = ctx.createImageData(w, h);
  
  // Calculate local variance for each pixel
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sumR = 0, sumG = 0, sumB = 0;
      let sumR2 = 0, sumG2 = 0, sumB2 = 0;
      let count = 0;
      
      // 3x3 neighborhood
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ni = ((y + dy) * w + (x + dx)) * 4;
          sumR += data[ni];
          sumG += data[ni + 1];
          sumB += data[ni + 2];
          sumR2 += data[ni] * data[ni];
          sumG2 += data[ni + 1] * data[ni + 1];
          sumB2 += data[ni + 2] * data[ni + 2];
          count++;
        }
      }
      
      // Variance = E[X²] - E[X]²
      const varR = (sumR2 / count) - Math.pow(sumR / count, 2);
      const varG = (sumG2 / count) - Math.pow(sumG / count, 2);
      const varB = (sumB2 / count) - Math.pow(sumB / count, 2);
      
      // Combined noise level
      const noise = Math.sqrt((varR + varG + varB) / 3) * (sensitivity / 10);
      
      const i = (y * w + x) * 4;
      result.data[i] = Math.min(255, noise);
      result.data[i + 1] = Math.min(255, noise);
      result.data[i + 2] = Math.min(255, noise);
      result.data[i + 3] = 255;
    }
  }
  
  ctx.putImageData(result, 0, 0);
  
  showResult('info', `
    <strong>Noise Analysis</strong><br><br>
    Displays the local noise/variance pattern across the image.<br><br>
    <strong>What to look for:</strong><br>
    • <span style="color:#ef4444">Inconsistent noise</span> between regions<br>
    • Unnaturally smooth areas in noisy images<br>
    • Sharp boundaries in noise levels<br>
    • Clone-stamped areas often have different noise<br><br>
    <strong>Current sensitivity:</strong> ${sensitivity}
  `);
}

// ============================================
// EDGE DETECTION (Sobel)
// ============================================

function applyEdgeDetection() {
  showResult('info', 'Applying Sobel edge detection...');
  
  const data = originalImageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const result = ctx.createImageData(w, h);
  
  // Sobel kernels
  const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
  
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0, gy = 0;
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ni = ((y + dy) * w + (x + dx)) * 4;
          // Convert to grayscale
          const gray = (data[ni] * 0.299 + data[ni + 1] * 0.587 + data[ni + 2] * 0.114);
          gx += gray * sobelX[dy + 1][dx + 1];
          gy += gray * sobelY[dy + 1][dx + 1];
        }
      }
      
      // Gradient magnitude
      const magnitude = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      
      const i = (y * w + x) * 4;
      result.data[i] = magnitude;
      result.data[i + 1] = magnitude;
      result.data[i + 2] = magnitude;
      result.data[i + 3] = 255;
    }
  }
  
  ctx.putImageData(result, 0, 0);
  
  showResult('info', `
    <strong>Edge Detection (Sobel)</strong><br><br>
    Highlights edges and boundaries using the Sobel operator.<br><br>
    <strong>What to look for:</strong><br>
    • Unnatural or overly sharp edges<br>
    • Missing edges where objects meet backgrounds<br>
    • Inconsistent edge quality (some sharp, some blurry)<br>
    • Halos or double edges around inserted objects<br><br>
    <em>Composited elements often have edge artifacts.</em>
  `);
}

// ============================================
// LEVEL SWEEP
// ============================================

function applyLevelSweep() {
  const level = parseInt(document.getElementById('level-sweep')?.value || 128);
  const windowSize = parseInt(document.getElementById('level-window')?.value || 10);
  
  const data = originalImageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const result = ctx.createImageData(w, h);
  
  let matchCount = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    // Calculate luminance
    const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    const inRange = Math.abs(gray - level) <= windowSize;
    
    if (inRange) matchCount++;
    
    result.data[i] = inRange ? 255 : 0;
    result.data[i + 1] = inRange ? 255 : 0;
    result.data[i + 2] = inRange ? 255 : 0;
    result.data[i + 3] = 255;
  }
  
  ctx.putImageData(result, 0, 0);
  
  const percentage = ((matchCount / (w * h)) * 100).toFixed(1);
  
  showResult('info', `
    <strong>Level Sweep</strong><br><br>
    Shows pixels within a specific luminance range. Useful for finding 
    subtle edits that affect brightness levels.<br><br>
    <strong>Current settings:</strong><br>
    • Level: ${level} / 255<br>
    • Window: ±${windowSize}<br>
    • Matching pixels: ${percentage}%<br><br>
    <strong>Tip:</strong> Sweep through different levels to find 
    hidden details or inconsistent lighting.
  `);
}

// ============================================
// LUMINANCE GRADIENT
// ============================================

function applyLuminanceGradient() {
  showResult('info', 'Calculating luminance gradient...');
  
  const data = originalImageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const result = ctx.createImageData(w, h);
  
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const iRight = (y * w + x + 1) * 4;
      const iDown = ((y + 1) * w + x) * 4;
      
      // Calculate luminance for current and neighbors
      const l1 = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      const l2 = (data[iRight] * 0.299 + data[iRight + 1] * 0.587 + data[iRight + 2] * 0.114);
      const l3 = (data[iDown] * 0.299 + data[iDown + 1] * 0.587 + data[iDown + 2] * 0.114);
      
      // Gradient magnitude
      const gradX = Math.abs(l1 - l2);
      const gradY = Math.abs(l1 - l3);
      const grad = Math.min(255, (gradX + gradY) * 2);
      
      result.data[i] = grad;
      result.data[i + 1] = grad;
      result.data[i + 2] = grad;
      result.data[i + 3] = 255;
    }
  }
  
  ctx.putImageData(result, 0, 0);
  
  showResult('info', `
    <strong>Luminance Gradient</strong><br><br>
    Shows the rate of brightness change across the image.<br><br>
    <strong>What to look for:</strong><br>
    • Abrupt gradient changes at edit boundaries<br>
    • Unnaturally smooth areas (low gradient)<br>
    • Gradient discontinuities<br>
    • Lighting inconsistencies between composited elements
  `);
}

// ============================================
// CLONE DETECTION
// ============================================

function applyCloneDetection() {
  showResult('info', `
    <strong>Clone Detection</strong><br><br>
    Analyzing image for duplicated regions...<br>
    This may take a moment for large images.
  `);
  
  // Use setTimeout to allow UI to update
  setTimeout(() => {
    const blockSize = 16;
    const data = originalImageData.data;
    const w = canvas.width;
    const h = canvas.height;
    const blocks = [];
    
    // Extract blocks with their hashes
    for (let y = 0; y < h - blockSize; y += Math.floor(blockSize / 2)) {
      for (let x = 0; x < w - blockSize; x += Math.floor(blockSize / 2)) {
        const hash = getBlockHash(data, x, y, blockSize, w);
        blocks.push({ x, y, hash });
      }
    }
    
    // Find similar blocks that are spatially separated
    const matches = [];
    const minDistance = blockSize * 3;
    
    for (let i = 0; i < blocks.length && matches.length < 100; i++) {
      for (let j = i + 1; j < blocks.length && matches.length < 100; j++) {
        const dist = Math.sqrt(
          Math.pow(blocks[i].x - blocks[j].x, 2) + 
          Math.pow(blocks[i].y - blocks[j].y, 2)
        );
        
        if (dist > minDistance && hashSimilar(blocks[i].hash, blocks[j].hash)) {
          matches.push([blocks[i], blocks[j]]);
        }
      }
    }
    
    // Draw results on original image
    ctx.putImageData(originalImageData, 0, 0);
    
    if (matches.length > 0) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      
      matches.forEach(([a, b], idx) => {
        // Use different colors for different match pairs
        const hue = (idx * 37) % 360;
        ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
        
        // Draw rectangles around matched blocks
        ctx.strokeRect(a.x, a.y, blockSize, blockSize);
        ctx.strokeRect(b.x, b.y, blockSize, blockSize);
        
        // Draw connecting line
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(a.x + blockSize / 2, a.y + blockSize / 2);
        ctx.lineTo(b.x + blockSize / 2, b.y + blockSize / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }
    
    showResult(matches.length > 5 ? 'warning' : 'success', `
      <strong>Clone Detection Results</strong><br><br>
      ${matches.length > 0 
        ? `Found <strong>${matches.length}</strong> potentially cloned region${matches.length > 1 ? 's' : ''}.`
        : 'No obvious cloned regions detected.'
      }<br><br>
      ${matches.length > 5 
        ? '<span style="color:#ef4444">⚠️ Multiple cloned areas detected - image may be manipulated.</span><br><br>' 
        : ''
      }
      <strong>Note:</strong> Some matches may be natural patterns, 
      textures, or repeated design elements. Manual verification recommended.
    `);
  }, 100);
}

function getBlockHash(data, startX, startY, size, width) {
  let r = 0, g = 0, b = 0;
  let count = 0;
  
  // Sample pixels from the block
  for (let dy = 0; dy < size; dy += 2) {
    for (let dx = 0; dx < size; dx += 2) {
      const i = ((startY + dy) * width + (startX + dx)) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
  }
  
  // Return averaged hash
  return {
    r: Math.floor(r / count),
    g: Math.floor(g / count),
    b: Math.floor(b / count)
  };
}

function hashSimilar(h1, h2) {
  const threshold = 10;
  return Math.abs(h1.r - h2.r) < threshold &&
         Math.abs(h1.g - h2.g) < threshold &&
         Math.abs(h1.b - h2.b) < threshold;
}

// ============================================
// HISTOGRAM
// ============================================

function showHistogram() {
  const data = originalImageData.data;
  const w = canvas.width;
  const h = canvas.height;
  
  // Initialize histogram arrays
  const histR = new Array(256).fill(0);
  const histG = new Array(256).fill(0);
  const histB = new Array(256).fill(0);
  const histL = new Array(256).fill(0);
  
  // Count pixel values
  for (let i = 0; i < data.length; i += 4) {
    histR[data[i]]++;
    histG[data[i + 1]]++;
    histB[data[i + 2]]++;
    const lum = Math.floor(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    histL[lum]++;
  }
  
  // Find max value for scaling
  const maxVal = Math.max(...histL) * 0.9;
  
  // Clear and set up canvas
  ctx.fillStyle = '#0a0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const barWidth = canvas.width / 256;
  const height = canvas.height;
  const padding = 40;
  const graphHeight = height - padding * 2;
  
  // Draw grid
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + (graphHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  
  // Draw color channel histograms
  const channels = [
    { hist: histR, color: 'rgba(239, 68, 68, 0.5)' },
    { hist: histG, color: 'rgba(34, 197, 94, 0.5)' },
    { hist: histB, color: 'rgba(59, 130, 246, 0.5)' }
  ];
  
  channels.forEach(({ hist, color }) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height - padding);
    
    for (let i = 0; i < 256; i++) {
      const barHeight = (hist[i] / maxVal) * graphHeight;
      ctx.lineTo(i * barWidth, height - padding - barHeight);
    }
    
    ctx.lineTo(canvas.width, height - padding);
    ctx.closePath();
    ctx.fill();
  });
  
  // Draw luminance line
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  
  for (let i = 0; i < 256; i++) {
    const barHeight = (histL[i] / maxVal) * graphHeight;
    const x = i * barWidth;
    const y = height - padding - barHeight;
    
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  
  // Draw labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText('0', 5, height - padding + 15);
  ctx.fillText('255', canvas.width - 25, height - padding + 15);
  ctx.fillText('Shadows', 20, height - padding + 30);
  ctx.fillText('Midtones', canvas.width / 2 - 25, height - padding + 30);
  ctx.fillText('Highlights', canvas.width - 70, height - padding + 30);
  
  // Calculate statistics
  let minL = 255, maxL = 0, sumL = 0, countL = 0;
  for (let i = 0; i < 256; i++) {
    if (histL[i] > 0) {
      if (i < minL) minL = i;
      if (i > maxL) maxL = i;
      sumL += i * histL[i];
      countL += histL[i];
    }
  }
  const avgL = sumL / countL;
  
  showResult('info', `
    <strong>Histogram Analysis</strong><br><br>
    <span style="color:#ef4444">■</span> Red 
    <span style="color:#22c55e">■</span> Green 
    <span style="color:#3b82f6">■</span> Blue 
    <span style="color:#fff">─</span> Luminance<br><br>
    <strong>Statistics:</strong><br>
    • Luminance range: ${minL} - ${maxL}<br>
    • Average brightness: ${avgL.toFixed(1)}<br>
    • Dynamic range: ${maxL - minL}<br><br>
    <strong>What to look for:</strong><br>
    • Gaps or spikes may indicate editing<br>
    • Clipped shadows (spike at 0)<br>
    • Clipped highlights (spike at 255)<br>
    • Comb patterns suggest color manipulation
  `);
}

// ============================================
// METADATA DISPLAY
// ============================================

function showMetadata() {
  document.getElementById('metadata-panel').classList.remove('hidden');
  ctx.putImageData(originalImageData, 0, 0);
  
  showResult('info', `
    <strong>Image Metadata</strong><br><br>
    Basic file and image information is displayed in the panel below.<br><br>
    <strong>Note:</strong> Full EXIF data extraction requires server-side 
    processing or specialized libraries. For comprehensive metadata analysis, 
    consider using:<br><br>
    • <a href="https://exifdata.com/" target="_blank" style="color:#3b82f6">ExifData.com</a><br>
    • <a href="http://metapicz.com/" target="_blank" style="color:#3b82f6">Metapicz</a><br>
    • <a href="https://www.verexif.com/en/" target="_blank" style="color:#3b82f6">VerExif</a>
  `);
}

// ============================================
// JPEG ANALYSIS
// ============================================

function analyzeJPEG() {
  // Draw original with JPEG grid overlay
  ctx.putImageData(originalImageData, 0, 0);
  
  // Draw 8x8 JPEG block grid
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
  ctx.lineWidth = 1;
  
  // Vertical lines
  for (let x = 0; x < canvas.width; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  
  // Horizontal lines
  for (let y = 0; y < canvas.height; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  
  // Analyze block alignment
  const isAligned = (canvas.width % 8 === 0) && (canvas.height % 8 === 0);
  
  showResult('info', `
    <strong>JPEG Analysis</strong><br><br>
    JPEG compression uses 8×8 pixel blocks. The blue grid shows these boundaries.<br><br>
    <strong>Image dimensions:</strong> ${canvas.width} × ${canvas.height}<br>
    <strong>Block alignment:</strong> ${isAligned ? '✅ Aligned' : '⚠️ Not aligned'}<br>
    <strong>Horizontal blocks:</strong> ${Math.ceil(canvas.width / 8)}<br>
    <strong>Vertical blocks:</strong> ${Math.ceil(canvas.height / 8)}<br><br>
    <strong>What to look for:</strong><br>
    • Edits not aligned to 8×8 grid suggest post-JPEG manipulation<br>
    • Different compression levels in different areas<br>
    • Block artifacts that don't match the grid<br><br>
    <em>Zoom in to examine individual blocks for artifacts.</em>
  `);
}

// ============================================
// STRING EXTRACTION
// ============================================

function extractStrings() {
  ctx.putImageData(originalImageData, 0, 0);
  
  // Get image as base64
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  
  try {
    // Decode base64 to binary string
    const binary = atob(base64);
    const strings = [];
    let currentString = '';
    
    // Search for printable ASCII sequences
    for (let i = 0; i < binary.length; i++) {
      const charCode = binary.charCodeAt(i);
      
      // Printable ASCII range (32-126)
      if (charCode >= 32 && charCode <= 126) {
        currentString += binary[i];
      } else {
        if (currentString.length >= 4) {
          strings.push(currentString);
        }
        currentString = '';
      }
    }
    
    // Add last string if valid
    if (currentString.length >= 4) {
      strings.push(currentString);
    }
    
    // Filter for interesting strings
    const interesting = strings.filter(s => {
      // Must be at least 5 characters
      if (s.length < 5) return false;
      // Skip pure numbers
      if (/^\d+$/.test(s)) return false;
      // Skip hex-only strings
      if (/^[0-9A-Fa-f]+$/.test(s)) return false;
      // Skip very common/uninteresting patterns
      if (/^[IDAThdr]+$/.test(s)) return false;
      return true;
    });
    
    // Remove duplicates
    const unique = [...new Set(interesting)].slice(0, 30);
    
    // Look for specific patterns
    const softwarePatterns = unique.filter(s => 
      /photoshop|gimp|lightroom|camera|canon|nikon|sony|iphone|samsung|adobe|editor/i.test(s)
    );
    
    showResult('info', `
      <strong>String Extraction</strong><br><br>
      Found <strong>${unique.length}</strong> readable strings in image data.<br><br>
      ${softwarePatterns.length > 0 ? `
        <strong style="color:#eab308">⚠️ Software signatures found:</strong><br>
        ${softwarePatterns.map(s => `• ${s}`).join('<br>')}<br><br>
      ` : ''}
      <strong>All extracted strings:</strong><br>
      <div style="font-family: monospace; font-size: 10px; max-height: 150px; overflow-y: auto; background: #1e293b; padding: 8px; border-radius: 4px; margin-top: 8px;">
        ${unique.length > 0 
          ? unique.map(s => s.length > 40 ? s.substring(0, 40) + '...' : s).join('<br>') 
          : '<em>No significant strings found</em>'}
      </div><br>
      <em>Strings may reveal editing software, camera info, or hidden messages.</em>
    `);
  } catch (e) {
    showResult('error', 'Failed to extract strings from image data.');
  }
}

// ============================================
// IMAGE ENHANCEMENTS
// ============================================

function applyAutoContrast() {
  const data = originalImageData.data;
  const result = ctx.createImageData(canvas.width, canvas.height);
  
  // Find min/max for each channel
  let minR = 255, maxR = 0;
  let minG = 255, maxG = 0;
  let minB = 255, maxB = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    minR = Math.min(minR, data[i]);
    maxR = Math.max(maxR, data[i]);
    minG = Math.min(minG, data[i + 1]);
    maxG = Math.max(maxG, data[i + 1]);
    minB = Math.min(minB, data[i + 2]);
    maxB = Math.max(maxB, data[i + 2]);
  }
  
  // Calculate ranges (avoid division by zero)
  const rangeR = maxR - minR || 1;
  const rangeG = maxG - minG || 1;
  const rangeB = maxB - minB || 1;
  
  // Apply contrast stretch
  for (let i = 0; i < data.length; i += 4) {
    result.data[i] = ((data[i] - minR) / rangeR) * 255;
    result.data[i + 1] = ((data[i + 1] - minG) / rangeG) * 255;
    result.data[i + 2] = ((data[i + 2] - minB) / rangeB) * 255;
    result.data[i + 3] = 255;
  }
  
  ctx.putImageData(result, 0, 0);
  
  showResult('info', `
    <strong>Auto Contrast Enhancement</strong><br><br>
    Stretches each color channel to use the full 0-255 range, 
    revealing hidden details in shadows and highlights.<br><br>
    <strong>Original ranges:</strong><br>
    • Red: ${minR} - ${maxR} (range: ${rangeR})<br>
    • Green: ${minG} - ${maxG} (range: ${rangeG})<br>
    • Blue: ${minB} - ${maxB} (range: ${rangeB})<br><br>
    <strong>Use case:</strong> Reveal details in underexposed or 
    low-contrast areas of the image.
  `);
}

function applySharpen() {
  const data = originalImageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const result = ctx.createImageData(w, h);
  
  // Unsharp mask kernel
  const kernel = [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0]
  ];
  
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let r = 0, g = 0, b = 0;
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ni = ((y + dy) * w + (x + dx)) * 4;
          const k = kernel[dy + 1][dx + 1];
          r += data[ni] * k;
          g += data[ni + 1] * k;
          b += data[ni + 2] * k;
        }
      }
      
      const i = (y * w + x) * 4;
      result.data[i] = Math.max(0, Math.min(255, r));
      result.data[i + 1] = Math.max(0, Math.min(255, g));
      result.data[i + 2] = Math.max(0, Math.min(255, b));
      result.data[i + 3] = 255;
    }
  }
  
  // Copy edge pixels from original
  for (let x = 0; x < w; x++) {
    // Top row
    let i = x * 4;
    result.data[i] = data[i];
    result.data[i + 1] = data[i + 1];
    result.data[i + 2] = data[i + 2];
    result.data[i + 3] = 255;
    
    // Bottom row
    i = ((h - 1) * w + x) * 4;
    result.data[i] = data[i];
    result.data[i + 1] = data[i + 1];
    result.data[i + 2] = data[i + 2];
    result.data[i + 3] = 255;
  }
  
  for (let y = 0; y < h; y++) {
    // Left column
    let i = (y * w) * 4;
    result.data[i] = data[i];
    result.data[i + 1] = data[i + 1];
    result.data[i + 2] = data[i + 2];
    result.data[i + 3] = 255;
    
    // Right column
    i = (y * w + w - 1) * 4;
    result.data[i] = data[i];
    result.data[i + 1] = data[i + 1];
    result.data[i + 2] = data[i + 2];
    result.data[i + 3] = 255;
  }
  
  ctx.putImageData(result, 0, 0);
  
  showResult('info', `
    <strong>Sharpen Enhancement</strong><br><br>
    Enhances edges and fine details using an unsharp mask filter.<br><br>
    <strong>What it reveals:</strong><br>
    • Compression artifacts become more visible<br>
    • Edge manipulation becomes apparent<br>
    • Blur boundaries around inserted objects<br>
    • Resizing artifacts<br><br>
    <em>Useful for detecting softened edges around composited elements.</em>
  `);
}

function applyChannelView(channel) {
  const data = originalImageData.data;
  const result = ctx.createImageData(canvas.width, canvas.height);
  
  for (let i = 0; i < data.length; i += 4) {
    let value;
    
    switch (channel) {
      case 'rgb':
        result.data[i] = data[i];
        result.data[i + 1] = data[i + 1];
        result.data[i + 2] = data[i + 2];
        result.data[i + 3] = 255;
        continue;
      case 'red':
        value = data[i];
        break;
      case 'green':
        value = data[i + 1];
        break;
      case 'blue':
        value = data[i + 2];
        break;
      default:
        value = 0;
    }
    
    // Display as grayscale for individual channels
    result.data[i] = value;
    result.data[i + 1] = value;
    result.data[i + 2] = value;
    result.data[i + 3] = 255;
  }
  
  ctx.putImageData(result, 0, 0);
  
  const channelInfo = {
    rgb: 'All color channels combined',
    red: 'Red channel only (0-255)',
    green: 'Green channel only (0-255)',
    blue: 'Blue channel only (0-255)'
  };
  
  showResult('info', `
    <strong>Color Channel View: ${channel.toUpperCase()}</strong><br><br>
    ${channelInfo[channel]}<br><br>
    <strong>What to look for:</strong><br>
    • Different noise levels between channels<br>
    • Artifacts present in only one channel<br>
    • Color fringing or chromatic aberration<br>
    • Channel-specific manipulation<br><br>
    <em>Some edits only affect certain color channels.</em>
  `);
}

// ============================================
// REVERSE IMAGE SEARCH
// ============================================

function reverseImageSearch() {
  if (!originalImage) {
    showResult('error', 'Please load an image first.');
    return;
  }
  
  showResult('info', `
    <strong>Reverse Image Search</strong><br><br>
    Find where this image has appeared online and check for earlier versions.<br><br>
    <strong>Search engines:</strong><br><br>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <a href="https://www.google.com/searchbyimage" target="_blank" 
         style="color:#3b82f6; text-decoration: none; padding: 8px; background: #1e293b; border-radius: 4px;">
        🔍 Google Images - Upload image there
      </a>
      <a href="https://tineye.com/" target="_blank" 
         style="color:#3b82f6; text-decoration: none; padding: 8px; background: #1e293b; border-radius: 4px;">
        👁️ TinEye - Best for finding original source
      </a>
      <a href="https://yandex.com/images/" target="_blank" 
         style="color:#3b82f6; text-decoration: none; padding: 8px; background: #1e293b; border-radius: 4px;">
        🔎 Yandex - Good for faces and locations
      </a>
      <a href="https://www.bing.com/visualsearch" target="_blank" 
         style="color:#3b82f6; text-decoration: none; padding: 8px; background: #1e293b; border-radius: 4px;">
        🅱️ Bing Visual Search
      </a>
    </div><br>
    <strong>Tip:</strong> Download the image first, then upload to each service for best results.
  `);
  
  // Open TinEye in new tab
  window.open('https://tineye.com/', '_blank');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showResult(type, message) {
  const content = document.getElementById('results-content');
  
  let className;
  switch (type) {
    case 'error':
      className = 'result-warning';
      break;
    case 'warning':
      className = 'result-warning';
      break;
    case 'success':
      className = 'result-success';
      break;
    default:
      className = 'result-info';
  }
  
  content.innerHTML = `<div class="${className}">${message}</div>`;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
  // Don't trigger if typing in an input
  if (e.target.tagName === 'INPUT') return;
  
  if (!originalImage) return;
  
  const shortcuts = {
    '1': 'original',
    '2': 'magnifier',
    '3': 'ela',
    '4': 'noise',
    '5': 'edges',
    '6': 'levels',
    '7': 'histogram',
    '8': 'clone',
    '9': 'metadata',
    '0': 'channels',
    'Escape': 'original',
    'o': 'original',
    'm': 'magnifier',
    'e': 'ela',
    'n': 'noise',
    'h': 'histogram',
    'c': 'clone'
  };
  
  if (shortcuts[e.key]) {
    e.preventDefault();
    selectTool(shortcuts[e.key]);
  }
});

// ============================================
// WINDOW RESIZE HANDLER
// ============================================

window.addEventListener('resize', () => {
  // Reposition magnifier if active
  if (currentTool === 'magnifier') {
    magnifierLens.style.display = 'none';
  }
});