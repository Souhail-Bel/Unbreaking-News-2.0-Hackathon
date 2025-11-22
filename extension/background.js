const HF_API_TOKEN = "hf_YOUR_ACTUAL_TOKEN_HERE"; // ⚠️ Keep this secret if publishing!
const MODEL_URL = "https://api-inference.huggingface.co/models/openai-community/roberta-base-openai-detector";

// Context Menu Setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "check_text_ai",
    title: "Check AI Probability (HuggingFace)",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "check_text_ai") {
    checkAI(info.selectionText);
  }
});

async function checkAI(text) {
  try {
    showNotification("Analyzing...");

    const response = await fetch(MODEL_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: text })
    });

    const result = await response.json();
    
    // HuggingFace returns distinct labels, e.g., [[{"label": "Real", "score": 0.9}, ...]]
    // This parsing depends heavily on the specific model you choose.
    const score = JSON.stringify(result).substring(0, 100); 
    
    showNotification(`Result: ${score}...`);
    
  } catch (error) {
    showNotification("Error connecting to Hugging Face.");
    console.error(error);
  }
}

function showNotification(message) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            func: (msg) => alert(msg),
            args: [message]
        });
    });
}
