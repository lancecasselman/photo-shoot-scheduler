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

document.getElementById("addBlock").addEventListener("click", () => {
  const div = document.createElement("div");
  div.className = "block";
  div.contentEditable = "true";
  div.innerHTML = "<h2>New Section</h2><p>Click to edit...</p>";
  document.getElementById("blocks").appendChild(div);
});

document.getElementById("toggleTheme").addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

document.getElementById("exportHtml").addEventListener("click", () => {
  const blocks = document.querySelectorAll(".block");
  let html = '';
  blocks.forEach(block => {
    html += block.outerHTML + '\n';
  });

  const blob = new Blob([html], { type: 'text/html' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'page.html';
  link.click();
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
