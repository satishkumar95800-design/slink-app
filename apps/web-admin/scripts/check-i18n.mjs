#!/usr/bin/env node
/**
 * docs/SPEC-languages.md checks for the console, run with `pnpm --filter web-admin check:i18n`:
 *  1. No hard-coded words in user-facing props / toasts / confirms in console files
 *     (JSX text itself is covered by the react/jsx-no-literals ESLint rule).
 *  2. Every key in kn.json / hi.json exists in en.json (no stray or misspelt keys),
 *     and every ICU placeholder in a translation also exists in the English text.
 * Prints what's still untranslated (that falls back to English — not an error).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const SCOPES = ['app/admin', 'app/login', 'components/layout', 'components/import', 'components/ui'];
const PROP = /\b(label|placeholder|title|helpText|description|aria-label|alt|warning)=("|')([^"']*[A-Za-z]{2,}[^"']*)\2/g;
const CALL = /\b(toast|confirm|alert|setError)\(\s*(['"`])([^'"`]*[A-Za-z]{2,}[^'"`]*)\2/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') || p.endsWith('.ts') ? [p] : [];
  });
}

const problems = [];
for (const scope of SCOPES) {
  for (const file of walk(join(root, scope))) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const re of [PROP, CALL]) {
          re.lastIndex = 0;
          for (const m of line.matchAll(re)) problems.push(`${file.replace(root, '')}:${i + 1}  ${m[0]}`);
        }
      });
  }
}

const load = (code) => JSON.parse(readFileSync(join(root, 'messages', `${code}.json`), 'utf8'));
const flat = (tree, prefix = '') =>
  Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [[`${prefix}${k}`, v]] : flat(v, `${prefix}${k}.`)));
const placeholders = (text) => new Set([...text.matchAll(/\{(\w+)/g)].map((m) => m[1]));

const en = new Map(flat(load('en')));
for (const code of ['kn', 'hi']) {
  const entries = flat(load(code));
  for (const [key, text] of entries) {
    if (!en.has(key)) {
      problems.push(`messages/${code}.json: "${key}" is not in en.json`);
      continue;
    }
    const allowed = placeholders(en.get(key));
    for (const p of placeholders(text)) {
      if (!allowed.has(p) && !['plural', 'select', 'other', 'one'].includes(p)) {
        problems.push(`messages/${code}.json: "${key}" uses {${p}}, which the English text doesn't have`);
      }
    }
  }
  console.log(`${code}: ${entries.length}/${en.size} keys translated (the rest show English)`);
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('i18n check passed');
