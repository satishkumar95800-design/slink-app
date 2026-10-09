import { Transform } from 'class-transformer';

/**
 * Trims a person's name and collapses repeated spaces before validation.
 * Capitalisation is never changed — stored names are shown exactly as entered.
 */
export const CleanName = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value,
  );
