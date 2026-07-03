'use strict';

// Build-time replacement for the `immediate` package (jszip -> lie -> immediate).
// The upstream module carries legacy-browser fallbacks that create <script> elements,
// which trip the community plugin scanner as dynamic code injection. Obsidian's
// Electron runtime always has queueMicrotask, so the fallbacks are dead code.
module.exports = function immediate(task) {
  var args = Array.prototype.slice.call(arguments, 1);
  queueMicrotask(function () {
    task.apply(null, args);
  });
};
