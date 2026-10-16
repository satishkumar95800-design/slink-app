import { maskValue } from '../../common/secret-box';
import { SensitiveField } from './dto/hrms.dto';

/** Column that stores each sensitive field's ciphertext. */
export const ENC_COLUMN = {
  pan: 'panEnc',
  aadhaar: 'aadhaarEnc',
  uan: 'uanEnc',
  esiNumber: 'esiNumberEnc',
  bankAccount: 'bankAccountEnc',
  bankIfsc: 'bankIfscEnc',
  bankHolder: 'bankHolderEnc',
} as const satisfies Record<SensitiveField, string>;

const RULES: Record<
  SensitiveField,
  { re: RegExp; normalize: (v: string) => string; error: string }
> = {
  pan: {
    re: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    normalize: (v) => v.replace(/\s/g, '').toUpperCase(),
    error: 'invalidPan',
  },
  aadhaar: {
    re: /^\d{12}$/,
    normalize: (v) => v.replace(/[\s-]/g, ''),
    error: 'invalidAadhaar',
  },
  uan: {
    re: /^\d{12}$/,
    normalize: (v) => v.replace(/[\s-]/g, ''),
    error: 'invalidField',
  },
  esiNumber: {
    re: /^\d{10,17}$/,
    normalize: (v) => v.replace(/[\s-]/g, ''),
    error: 'invalidField',
  },
  bankAccount: {
    re: /^\d{6,20}$/,
    normalize: (v) => v.replace(/[\s-]/g, ''),
    error: 'invalidAccount',
  },
  bankIfsc: {
    re: /^[A-Z]{4}0[A-Z0-9]{6}$/,
    normalize: (v) => v.replace(/\s/g, '').toUpperCase(),
    error: 'invalidIfsc',
  },
  bankHolder: {
    re: /^.{1,120}$/,
    normalize: (v) => v.replace(/\s+/g, ' ').trim(),
    error: 'invalidField',
  },
};

/** Normalised value, or null when it does not look right. */
export function normalizeSensitive(
  field: SensitiveField,
  raw: string,
): string | null {
  const r = RULES[field];
  const v = r.normalize(raw);
  return r.re.test(v) ? v : null;
}

export const invalidKey = (field: SensitiveField) => RULES[field].error;

/** Display-only mask kept in sensitive_hints; the full value is never in a list or detail response. */
export function hintFor(field: SensitiveField, value: string): string {
  if (field === 'bankHolder')
    return `${value.charAt(0)}${'X'.repeat(Math.max(3, value.length - 1))}`;
  if (field === 'bankIfsc') return `${value.slice(0, 4)}XXXXXXX`;
  return maskValue(value, 4);
}
