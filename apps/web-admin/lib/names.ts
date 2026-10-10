/** True for names with letters and no capitals ("aarav iyer"); scripts without case never match. Mirrors the API import check. */
export function isAllLowercaseName(name: string | undefined): boolean {
  const n = (name ?? '').trim();
  return n !== n.toUpperCase() && n === n.toLowerCase();
}

/** Non-blocking hint for a name field (pass the translated `common.nameLowercaseWarning`); stored names are never re-cased. */
export function nameCaseWarning(name: string | undefined, warning: string): string | undefined {
  return isAllLowercaseName(name) ? warning : undefined;
}
