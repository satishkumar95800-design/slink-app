// Some Node.js hosting platforms (e.g. Hostinger) promote only the build's
// "Output directory" from the build stage into the runtime release, dropping
// the sibling node_modules that npm install produced. Copying node_modules
// inside dist makes it travel with the output regardless — Node's module
// resolution walks up from dist/src/main.js and finds dist/node_modules.
// dereference: true fully materializes any symlinks (e.g. a local pnpm
// store) so this is also safe to run against a pnpm-managed node_modules.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules');
const dest = path.join(__dirname, '..', 'dist', 'node_modules');

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true, dereference: true });
console.log(`Copied node_modules -> ${dest}`);
