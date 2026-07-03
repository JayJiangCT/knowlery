'use strict';

// Build-time replacement for gray-matter's lib/engines.js. Identical to upstream for
// the yaml and json engines Knowlery actually uses; the upstream `javascript` engine
// (eval-based, for JS frontmatter) is omitted so the bundle carries no eval — it
// tripped the community plugin scanner as dynamic code execution.
const yaml = require('js-yaml');

const engines = exports = module.exports;

engines.yaml = {
  parse: yaml.safeLoad.bind(yaml),
  stringify: yaml.safeDump.bind(yaml),
};

engines.json = {
  parse: JSON.parse.bind(JSON),
  stringify: function (obj, options) {
    const opts = Object.assign({ replacer: null, space: 2 }, options);
    return JSON.stringify(obj, opts.replacer, opts.space);
  },
};
