document.getElementById("saveLayout").addEventListener("click", async () => {
  // Capture the complete HTML content from the blocks container
  const builderContainer = document.getElementById("blocks");
  
  if (!builderContainer) {
    alert("Builder container not found!");
    return;
  }

  // Get the complete live HTML including all user edits
  const layout = builderContainer.innerHTML;
  
  // Create the payload with layout content, title, and timestamp
  const payload = {
    layout: layout,
    title: 'Untitled Layout',
    createdAt: new Date()
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
