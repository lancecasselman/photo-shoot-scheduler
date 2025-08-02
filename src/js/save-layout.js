document.getElementById("saveLayout").addEventListener("click", async () => {
  // Capture the complete HTML content from the blocks container
  const builderContainer = document.getElementById("blocks");
  
  if (!builderContainer) {
    alert("Builder container not found!");
    return;
  }

  // Get the complete live HTML including all user edits
  const layout = builderContainer.innerHTML;
  
  // Get publish status
  const publishToggle = document.getElementById("publishToggle");
  const isPublished = publishToggle ? publishToggle.checked : false;

  // Create the payload with layout content, title, and timestamp
  const payload = {
    layout: layout,
    title: 'Untitled Layout',
    createdAt: new Date(),
    published: isPublished
  };

  try {
    const response = await fetch("/api/save-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    alert("Layout saved! ID: " + result.id);
    console.log("Saved layout:", payload);
    
    // Set current layout ID for autosave functionality
    if (typeof setCurrentLayoutId === 'function') {
      setCurrentLayoutId(result.id);
    }
    
    // Show preview button now that layout is saved
    showPreviewButton(result.id);
  } catch (err) {
    alert("Failed to save layout.");
    console.error("Save error:", err);
  }
});

// Add block and theme toggle handlers moved to dragdrop.js to avoid duplicates

// Global variables for export functionality
let currentFont = 'Inter';

// Font picker functionality
document.getElementById("fontPicker").addEventListener("change", (e) => {
  currentFont = e.target.value;
  const blocksContainer = document.getElementById("blocks");
  if (blocksContainer) {
    blocksContainer.style.fontFamily = `'${currentFont}', sans-serif`;
  }
  console.log('Font changed to:', currentFont);
});

// Light/Dark mode toggle
document.getElementById("toggleLightDark").addEventListener("click", () => {
  document.body.classList.toggle('dark-mode');
  console.log('Light/Dark mode toggled');
});

// Enhanced Export HTML functionality
document.getElementById("exportHtml").addEventListener("click", () => {
  const blocks = document.querySelectorAll(".block");
  let html = '';
  blocks.forEach(block => html += block.outerHTML);
  
  const fontUrl = `https://fonts.googleapis.com/css2?family=${currentFont.replace(' ', '+')}:wght@300;400;500;600;700&display=swap`;
  
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Website</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${fontUrl}" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: '${currentFont}', sans-serif; 
      line-height: 1.6; 
      color: #333; 
      background: #fff;
    }
    .block { 
      margin: 20px 0; 
      padding: 20px; 
      min-height: 50px;
    }
    h1, h2, h3, h4, h5, h6 { 
      font-family: '${currentFont}', sans-serif; 
      margin-bottom: 10px; 
    }
    p { margin-bottom: 15px; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'layout.html';
  a.click();
  URL.revokeObjectURL(url);
  
  console.log('HTML exported with font:', currentFont);
});

// Preview functionality
function showPreviewButton(layoutId) {
  const previewBtn = document.getElementById("previewLayout");
  if (previewBtn) {
    previewBtn.style.display = "inline-block";
    previewBtn.onclick = () => openPreview(layoutId);
  }
}

function openPreview(layoutId) {
  if (layoutId) {
    window.open(`/preview/${layoutId}`, '_blank');
  }
}

// Initialize preview button if layout ID is already set
document.addEventListener('DOMContentLoaded', () => {
  const previewBtn = document.getElementById("previewLayout");
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      // Get current layout ID from autosave functionality
      if (typeof currentLayoutId !== 'undefined' && currentLayoutId) {
        openPreview(currentLayoutId);
      } else {
        alert("Please save the layout first to enable preview.");
      }
    });
  }
});
