document.getElementById('openUtils').addEventListener('click', () => {
  // Opens the larger utility page in a new browser tab
  chrome.tabs.create({ url: 'utilities.html' });
});
