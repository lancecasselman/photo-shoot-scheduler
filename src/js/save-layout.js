document.getElementById("saveLayout").addEventListener("click", async () => {
  const blocks = document.querySelectorAll(".block");
  const layout = [];

  blocks.forEach(block => {
    layout.push({
      type: block.dataset.type || "custom",
      html: block.innerHTML.trim()
    });
  });

  try {
    const response = await fetch("/api/save-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout })
    });
    const result = await response.json();
    alert("Layout saved! ID: " + result.id);
  } catch (err) {
    alert("Failed to save layout.");
    console.error(err);
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
