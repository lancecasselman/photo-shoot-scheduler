function loadGallery(images, containerId = "mainCanvas") {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  images.forEach(src => {
    const img = document.createElement("img");
    img.src = src;
    img.className = "gallery-item";
    img.style = "width: 100%; margin-bottom: 1rem; border-radius: 8px;";
    container.appendChild(img);
  });
}
