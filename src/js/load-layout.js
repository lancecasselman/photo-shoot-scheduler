document.getElementById("loadLayout").addEventListener("click", async () => {
  const id = document.getElementById("layoutIdInput").value.trim();
  if (!id) return alert("Please enter a layout ID.");

  try {
    const response = await fetch("/api/load-layout/" + id);
    const data = await response.json();

    const blocksContainer = document.getElementById("blocks");
    blocksContainer.innerHTML = "";
    data.layout.forEach(block => {
      const div = document.createElement("div");
      div.className = "block";
      div.contentEditable = "true";
      div.dataset.type = block.type;
      div.innerHTML = block.html;
      blocksContainer.appendChild(div);
    });
  } catch (err) {
    alert("Failed to load layout.");
    console.error(err);
  }
});

document.getElementById("listLayouts").addEventListener("click", async () => {
  try {
    const res = await fetch("/api/layouts");
    const list = await res.json();
    const ul = document.getElementById("layoutList");
    ul.innerHTML = '';
    list.forEach(item => {
      const li = document.createElement("li");
      li.textContent = `ID: ${item.id} (${item.createdAt})`;
      ul.appendChild(li);
    });
  } catch (err) {
    console.error("Could not fetch layouts:", err);
  }
});
