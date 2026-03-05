console.log("[Background] Service Worker Started");

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("[Background] Message received:", request);
  
  if (request.action === "TEST_MESSAGE") {
    console.log("[Background] Test message received");
    sendResponse({ success: true, message: "Background script is working!" });
    return true;
  }
  
  if (request.action === "CAPTURE_FULL_PAGE") {
    console.log("[Background] Processing CAPTURE_FULL_PAGE");
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        console.error("[Background] No active tab found");
        sendResponse({ success: false, error: "No active tab found" });
        return;
      }
      
      console.log("[Background] Active tab ID:", tab.id);
      
      // Scroll to top first, then capture
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          window.scrollTo(0, 0);
          return { scrolled: true };
        }
      }, () => {
        // Wait a bit for scroll to complete
        setTimeout(() => {
          // Capture the full visible tab
          chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, (dataUrl) => {
            if (chrome.runtime.lastError) {
              console.error("[Background] Capture error:", chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            
            console.log("[Background] Full page capture successful, sending to app");
            sendResponse({ success: true, dataUri: dataUrl });
          });
        }, 500);
      });
    });
    
    return true; // Keep message channel open
  }
});

console.log("[Background] Message listener set up");
