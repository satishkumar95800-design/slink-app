import { strings } from './strings';

/** True for names with letters and no capitals ("aarav iyer"); scripts without case never match. Mirrors the API import check. */
export function isAllLowercaseName(name: string | undefined): boolean {
  const n = (name ?? '').trim();
  return n !== n.toUpperCase() && n === n.toLowerCase();
}

/** Non-blocking hint for a name field; stored names are never re-cased. */
export function nameCaseWarning(name: string | undefined): string | undefined {
  return isAllLowercaseName(name) ? strings.names.allLowercaseWarning : undefined;
}
