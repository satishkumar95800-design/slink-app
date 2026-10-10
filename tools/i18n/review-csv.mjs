#!/usr/bin/env node
/**
 * Native-speaker review spreadsheet for docs/SPEC-languages.md ("Translation workflow").
 *
 *   node tools/i18n/review-csv.mjs export [out.csv]   → key, app, screen, English, Kannada, Hindi, Reviewed
 *   node tools/i18n/review-csv.mjs import <in.csv>    → writes the Kannada/Hindi columns back
 *
 * Covers the mobile app (apps/mobile/lib/l10n/app_*.arb) and the console
 * (apps/web-admin/messages/*.json). After importing, run `flutter gen-l10n` in
 * apps/mobile. Empty cells are skipped, so a partly filled sheet is safe to import.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = new URL('../..', import.meta.url).pathname;
const LANGS = [
  ['kn', 'Kannada'],
  ['hi', 'Hindi'],
];
const HEADER = ['key', 'app', 'screen', 'English', ...LANGS.map(([, name]) => name), 'Reviewed'];

const mobileFile = (code) => join(repo, 'apps/mobile/lib/l10n', `app_${code}.arb`);
const webFile = (code) => join(repo, 'apps/web-admin/messages', `${code}.json`);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, data) => writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);

/** ARB → { key: text }, dropping @metadata. */
const arbStrings = (arb) => Object.fromEntries(Object.entries(arb).filter(([k]) => !k.startsWith('@')));

const flatten = (tree, prefix = '') =>
  Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [[`${prefix}${k}`, v]] : flatten(v, `${prefix}${k}.`)));

function setPath(tree, path, value) {
  const parts = path.split('.');
  let node = tree;
  for (const p of parts.slice(0, -1)) node = node[p] ??= {};
  node[parts.at(-1)] = value;
}

/** Mobile keys are camelCase with a screen prefix (feesPayOnline → "fees"); console keys are namespaced. */
const mobileScreen = (key) => key.match(/^[a-z]+/)?.[0] ?? '';
const webScreen = (key) => key.split('.')[0];

const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.filter((r) => r.some(Boolean));
}

function exportCsv(out) {
  const lines = [HEADER];
  const mobile = Object.fromEntries(['en', ...LANGS.map(([c]) => c)].map((c) => [c, arbStrings(readJson(mobileFile(c)))]));
  for (const [key, en] of Object.entries(mobile.en)) {
    lines.push([key, 'mobile', mobileScreen(key), en, ...LANGS.map(([c]) => mobile[c][key] ?? ''), '']);
  }
  const web = Object.fromEntries(['en', ...LANGS.map(([c]) => c)].map((c) => [c, Object.fromEntries(flatten(readJson(webFile(c))))]));
  for (const [key, en] of Object.entries(web.en)) {
    lines.push([key, 'console', webScreen(key), en, ...LANGS.map(([c]) => web[c][key] ?? ''), '']);
  }
  // BOM so Excel opens Kannada/Devanagari correctly.
  writeFileSync(out, `﻿${lines.map((l) => l.map(csvCell).join(',')).join('\n')}\n`);
  console.log(`Wrote ${lines.length - 1} strings to ${out}`);
}

function importCsv(file) {
  const [header, ...rows] = parseCsv(readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  for (const h of ['key', 'app', 'English']) if (!(h in col)) throw new Error(`Missing column "${h}"`);

  const enMobile = arbStrings(readJson(mobileFile('en')));
  const enWeb = Object.fromEntries(flatten(readJson(webFile('en'))));
  let written = 0;
  const skipped = [];

  for (const [code, name] of LANGS) {
    if (!(name in col)) continue;
    const arb = readJson(mobileFile(code));
    const web = readJson(webFile(code));
    for (const r of rows) {
      const [key, app, value] = [r[col.key], r[col.app], (r[col[name]] ?? '').trim()];
      if (!value) continue;
      if (app === 'mobile') {
        if (!(key in enMobile)) skipped.push(`${key} (not in app_en.arb)`);
        else (arb[key] = value), written++;
      } else if (app === 'console') {
        if (!(key in enWeb)) skipped.push(`${key} (not in en.json)`);
        else setPath(web, key, value), written++;
      }
    }
    writeJson(mobileFile(code), arb);
    writeJson(webFile(code), web);
  }
  console.log(`Imported ${written} translations.${skipped.length ? ` Skipped ${skipped.length}: ${skipped.join(', ')}` : ''}`);
  console.log('Next: cd apps/mobile && flutter gen-l10n; pnpm --filter web-admin check:i18n');
}

const [cmd, path] = process.argv.slice(2);
if (cmd === 'export') exportCsv(path ?? 'translations-review.csv');
else if (cmd === 'import' && path) importCsv(path);
else {
  console.error('Usage: node tools/i18n/review-csv.mjs export [out.csv] | import <in.csv>');
  process.exit(1);
}
