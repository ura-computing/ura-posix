console.log("[Content Script] Loaded");

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("[Content Script] Message received:", request);
  
  if (request.action === "SELECT_AND_CAPTURE") {
    console.log("[Content Script] Starting selection");
    
    // Remove any existing overlay
    const existingOverlay = document.getElementById("__capture-overlay");
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    // Create overlay
    const overlay = document.createElement("div");
    overlay.id = "__capture-overlay";
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      cursor: crosshair;
      background: rgba(0,0,0,0.35);
    `;
    
    // Create selection box
    const selection = document.createElement("div");
    selection.id = "__capture-selection";
    selection.style.cssText = `
      position: fixed;
      border: 2px solid #5b9bd5;
      background: rgba(91,155,213,0.15);
      pointer-events: none;
      display: none;
      z-index: 2147483647;
    `;
    
    // Create process button
    const processBtn = document.createElement("button");
    processBtn.id = "__capture-btn";
    processBtn.textContent = "⚡ Process Table";
    processBtn.style.cssText = `
      position: fixed;
      z-index: 2147483648;
      display: none;
      background: #5b9bd5;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font: bold 14px/1 system-ui;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    // Create cancel button
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "✕ Cancel";
    cancelBtn.style.cssText = `
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 2147483648;
      background: #333;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font: 13px/1 system-ui;
      cursor: pointer;
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(selection);
    document.body.appendChild(processBtn);
    document.body.appendChild(cancelBtn);
    
    let startX = 0, startY = 0, dragging = false;
    let finalRect: { left: number; top: number; width: number; height: number } | null = null;
    
    const cleanup = () => {
      overlay.remove();
      selection.remove();
      processBtn.remove();
      cancelBtn.remove();
    };
    
    // Cancel button handler
    cancelBtn.addEventListener("click", () => {
      console.log("[Content Script] Cancelled");
      cleanup();
      sendResponse({ success: false, error: "Cancelled by user" });
    });
    
    const getRect = (x1: number, y1: number, x2: number, y2: number) => ({
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    });
    
    // Mouse down
    overlay.addEventListener("mousedown", (e) => {
      console.log("[Content Script] Mouse down");
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      selection.style.display = "block";
      selection.style.left = `${startX}px`;
      selection.style.top = `${startY}px`;
      selection.style.width = "0px";
      selection.style.height = "0px";
      
      processBtn.style.display = "none";
    });
    
    // Mouse move
    overlay.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      
      const rect = getRect(startX, startY, e.clientX, e.clientY);
      selection.style.left = `${rect.left}px`;
      selection.style.top = `${rect.top}px`;
      selection.style.width = `${rect.width}px`;
      selection.style.height = `${rect.height}px`;
    });
    
    // Mouse up
    overlay.addEventListener("mouseup", (e) => {
      console.log("[Content Script] Mouse up");
      if (!dragging) return;
      dragging = false;
      
      const rect = getRect(startX, startY, e.clientX, e.clientY);
      
      if (rect.width < 20 || rect.height < 20) {
        selection.style.display = "none";
        return;
      }
      
      finalRect = rect;
      console.log("[Content Script] Selection complete:", finalRect);
      
      // Position process button
      const btnTop = rect.top + rect.height + 10;
      const btnLeft = rect.left + rect.width / 2;
      
      processBtn.style.display = "block";
      processBtn.style.top = `${Math.min(btnTop, window.innerHeight - 60)}px`;
      processBtn.style.left = `${btnLeft}px`;
      processBtn.style.transform = "translateX(-50%)";
    });
    
    // Process button handler
    processBtn.addEventListener("click", () => {
      console.log("[Content Script] Process clicked");
      if (!finalRect) return;
      
      const dpr = window.devicePixelRatio || 1;
      const scaledRect = {
        x: Math.round(finalRect.left * dpr),
        y: Math.round(finalRect.top * dpr),
        width: Math.round(finalRect.width * dpr),
        height: Math.round(finalRect.height * dpr),
      };
      
      console.log("[Content Script] Sending response:", scaledRect);
      cleanup();
      sendResponse({ success: true, rect: scaledRect });
    });
    
    return true; // Keep message channel open
  }
});

console.log("[Content Script] Message listener set up");
