document.getElementById("loadLayout").addEventListener("click", async () => {
  const id = document.getElementById("layoutIdInput").value.trim();
  loadLayout(id);
});

// Create a reusable function to load a layout by ID
function loadLayout(layoutId) {
  if (!layoutId) return alert("Please provide a layout ID.");

  fetch("/api/load-layout/" + layoutId)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      const blocksContainer = document.getElementById("blocks");
      
      if (!blocksContainer) {
        alert("Builder container not found!");
        return;
      }

      // Check if layout is HTML string (new format) or array (old format)
      if (typeof data.layout === 'string') {
        // New format: Direct HTML content
        blocksContainer.innerHTML = data.layout;
      } else if (Array.isArray(data.layout)) {
        // Old format: Array of block objects (for backward compatibility)
        blocksContainer.innerHTML = "";
        data.layout.forEach(block => {
          const div = document.createElement("div");
          div.className = "block";
          div.contentEditable = "true";
          div.dataset.type = block.type;
          div.innerHTML = block.html;
          blocksContainer.appendChild(div);
        });
      } else {
        throw new Error("Invalid layout format");
      }

      // Ensure all loaded blocks are editable
      const loadedBlocks = blocksContainer.querySelectorAll('.block');
      loadedBlocks.forEach(block => {
        if (!block.hasAttribute('contenteditable')) {
          block.contentEditable = "true";
        }
      });

      alert(`Layout ${layoutId} loaded successfully!`);
      console.log("Loaded layout data:", data);
    })
    .catch(err => {
      alert("Failed to load layout.");
      console.error("Load error:", err);
    });
}

document.getElementById("listLayouts").addEventListener("click", async () => {
  try {
    const res = await fetch("/api/layouts");
    const list = await res.json();
    const ul = document.getElementById("layoutList");
    ul.innerHTML = '';
    
    if (list.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No saved layouts found.";
      li.style.fontStyle = "italic";
      ul.appendChild(li);
      return;
    }
    
    list.forEach(item => {
      const li = document.createElement("li");
      li.style.cursor = "pointer";
      li.style.padding = "8px";
      li.style.margin = "4px 0";
      li.style.border = "1px solid #ddd";
      li.style.borderRadius = "4px";
      li.style.backgroundColor = "#f9f9f9";
      li.innerHTML = `
        <strong>ID:</strong> ${item.id}<br>
        <small><strong>Created:</strong> ${new Date(item.createdAt).toLocaleString()}</small>
      `;
      
      li.addEventListener("click", () => {
        if (confirm(`Load layout ${item.id}? This will replace your current work.`)) {
          loadLayout(item.id);
        }
      });
      
      li.addEventListener("mouseenter", () => {
        li.style.backgroundColor = "#e6f3ff";
      });
      
      li.addEventListener("mouseleave", () => {
        li.style.backgroundColor = "#f9f9f9";
      });
      
      ul.appendChild(li);
    });
  } catch (err) {
    console.error("Could not fetch layouts:", err);
    alert("Failed to load saved layouts. Please try again.");
  }
});
