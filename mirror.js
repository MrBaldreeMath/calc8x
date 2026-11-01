/* mirror.js — copies the calculator screen onto the large display panel */
(function () {
  const App = window.App;
  function mirror() {
    const src = document.getElementById('screen'), dst = document.getElementById('screen2');
    if (!src || !dst || !dst.offsetParent) return;
    if (dst.width !== src.width) { dst.width = src.width; dst.height = src.height; }
    dst.getContext('2d').drawImage(src, 0, 0);
  }
  App.listeners.push(mirror);
})();
