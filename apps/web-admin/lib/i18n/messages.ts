import en from '../../messages/en.json';
import type { Language } from './languages';

export type Messages = typeof en;

/** English ships with the bundle (it is every language's fallback); the others load on demand. */
const loaders: Record<Exclude<Language, 'en'>, () => Promise<{ default: unknown }>> = {
  kn: () => import('../../messages/kn.json'),
  hi: () => import('../../messages/hi.json'),
};

type Tree = { [key: string]: string | Tree };

/** Every key path in a message tree, e.g. "common.save". */
export function keyPaths(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keyPaths(v, `${prefix}${k}.`),
  );
}

/** Translated messages laid over English, so any missing key shows English text, never a raw key. */
function overlay(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = base[k];
    out[k] = typeof v === 'string' || typeof b !== 'object' ? v : overlay(b, v);
  }
  return out;
}

export async function loadMessages(code: Language): Promise<Messages> {
  if (code === 'en') return en;
  const translated = (await loaders[code]()).default as Tree;
  if (process.env.NODE_ENV === 'development') {
    const have = new Set(keyPaths(translated));
    const missing = keyPaths(en as Tree).filter((k) => !have.has(k));
    if (missing.length) console.warn(`[i18n] ${missing.length} keys missing in ${code}.json (showing English):`, missing);
  }
  return overlay(en as Tree, translated) as Messages;
}

export { en as englishMessages };
