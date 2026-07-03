'use strict';

// Build-time replacement for js-yaml's `!!js/function` type (type/js/function.js).
// The upstream implementation compiles YAML content with `new Function`, which trips
// the community plugin scanner as dynamic code execution. Knowlery only ever parses
// frontmatter with the safe schema, so this type is never used; the stub keeps the
// full schema constructible while refusing to resolve function payloads.
var Type = require('js-yaml/lib/js-yaml/type');

module.exports = new Type('tag:yaml.org,2002:js/function', {
  kind: 'scalar',
  resolve: function () {
    return false;
  },
  construct: function () {
    return undefined;
  },
  predicate: function () {
    return false;
  },
  represent: function () {
    throw new Error('js/function serialization is disabled in this build');
  },
});
