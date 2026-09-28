// Some Node.js hosting platforms (e.g. Hostinger) promote only the build's
// "Output directory" from the build stage into the runtime release, dropping
// node_modules entirely. Copying node_modules inside dist makes it travel
// with the output regardless — Node's module resolution walks up from
// dist/src/main.js and finds dist/node_modules.
//
// Where the real node_modules ends up depends on how npm/pnpm was invoked:
//   - Plain install scoped to apps/api: apps/api/node_modules.
//   - npm/pnpm workspaces (root package.json declares "workspaces": [...],
//     added for an unrelated web-admin deploy fix): most/all deps get
//     hoisted to the repo root's node_modules instead, leaving
//     apps/api/node_modules missing or holding only version-conflict
//     overrides.
// So: copy the repo-root node_modules first (the common case under
// workspaces), then overlay apps/api's own node_modules on top (its
// versions win on conflict, matching Node's own "closer node_modules wins"
// resolution order).
//
// DANGER — workspace self-link cycle: both npm and pnpm workspaces create a
// symlink for this very package inside the root node_modules (e.g.
// node_modules/api -> apps/api) so other workspace packages can require it.
// Copying the root node_modules with symlinks dereferenced would follow that
// link straight back into apps/api — which contains the destination
// (dist/node_modules) we're actively writing into — recursing forever until
// disk fills up. The filter below skips any entry whose real path resolves
// inside apiDir before it's ever followed.
const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..');
const dest = path.join(apiDir, 'dist', 'node_modules');
const rootNodeModules = path.join(apiDir, '..', '..', 'node_modules');
const localNodeModules = path.join(apiDir, 'node_modules');

function realpathOrSelf(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Only meaningful for the root-node_modules pass: skips any entry (the
 * workspace self-link, most notably) that would resolve back inside
 * apps/api — see the cycle warning above. NOT applied to the local overlay
 * pass, since apps/api/node_modules itself is (correctly) inside apiDir —
 * applying this filter there would skip the entire local copy.
 */
function skipSelfReferences(src) {
  return !isInside(apiDir, realpathOrSelf(src));
}

fs.rmSync(dest, { recursive: true, force: true });

let copiedAnything = false;

if (fs.existsSync(rootNodeModules)) {
  console.log(`Copying ${rootNodeModules} -> ${dest}`);
  fs.cpSync(rootNodeModules, dest, {
    recursive: true,
    dereference: true,
    filter: skipSelfReferences,
  });
  copiedAnything = true;
}

if (fs.existsSync(localNodeModules)) {
  console.log(`Overlaying ${localNodeModules} -> ${dest}`);
  fs.cpSync(localNodeModules, dest, {
    recursive: true,
    dereference: true,
    force: true,
  });
  copiedAnything = true;
}

if (!copiedAnything) {
  throw new Error(
    `Could not find node_modules at either ${rootNodeModules} or ${localNodeModules} — did npm/pnpm install run?`,
  );
}

console.log(`Done: ${dest}`);
