/** Shared helpers for fee plans, which schools name per class, e.g. "Term 1 — Class 4 A". */

export interface ClassRef {
  id: string;
  name: string;
  section?: string | null;
  academicYear: string;
}

export interface FeePlanRef {
  name: string;
  /** One plan can cover several classes. */
  classes?: Array<{ class: ClassRef }>;
}

/** "Class 4 A" (no year). */
export function classLabel(c: ClassRef): string {
  return `${c.name}${c.section ? ` ${c.section}` : ''}`;
}

/** Newest year first, then Class 1, 2 … 10 in number order, then section. */
export function compareClasses(a: ClassRef, b: ClassRef): number {
  return (
    b.academicYear.localeCompare(a.academicYear) ||
    a.name.localeCompare(b.name, undefined, { numeric: true }) ||
    (a.section ?? '').localeCompare(b.section ?? '')
  );
}

/**
 * Plans have no term field. The term is the plan name without its class part
 * ("Term 1 — Class 4 A" → "Term 1"), else the whole name ("Annual Day").
 */
export function termOf(plan: FeePlanRef): string {
  let rest = plan.name;
  for (const { class: c } of plan.classes ?? []) {
    rest = rest.replace(classLabel(c), '').replace(c.name, '');
  }
  rest = rest.replace(/^[\s—–\-:|,/()]+|[\s—–\-:|,/()]+$/g, '').trim();
  return rest || plan.name;
}

export function compareTerms(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}
