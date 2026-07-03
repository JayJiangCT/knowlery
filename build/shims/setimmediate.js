'use strict';

// Build-time replacement for the `setimmediate` polyfill (required by jszip for side
// effects). The upstream module carries legacy-browser fallbacks using <script>
// element creation and `new Function`, which trip the community plugin scanner.
// Obsidian's Electron runtime provides setImmediate natively; nothing to polyfill.
if (typeof globalThis.setImmediate !== 'function') {
  globalThis.setImmediate = function setImmediate(task) {
    var args = Array.prototype.slice.call(arguments, 1);
    return setTimeout(function () {
      task.apply(null, args);
    }, 0);
  };
}
