export function makeDraggable(el) {
  el.style.position = "absolute";
  el.onmousedown = function (e) {
    let shiftX = e.clientX - el.getBoundingClientRect().left;
    let shiftY = e.clientY - el.getBoundingClientRect().top;
    function moveAt(pageX, pageY) {
      el.style.left = pageX - shiftX + "px";
      el.style.top = pageY - shiftY + "px";
    }
    function onMouseMove(e) {
      moveAt(e.pageX, e.pageY);
    }
    document.addEventListener("mousemove", onMouseMove);
    el.onmouseup = function () {
      document.removeEventListener("mousemove", onMouseMove);
      el.onmouseup = null;
    };
  };
  el.ondragstart = () => false;
}
