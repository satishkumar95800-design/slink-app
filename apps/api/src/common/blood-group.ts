import { BloodGroup } from '@prisma/client';

/**
 * Prisma enum identifiers can't contain "+"/"-", so the human-facing "A+"/"A-"/...
 * strings (used in the API wire format, the bulk-import spreadsheet, and the
 * admin UI) are translated to/from Prisma's BloodGroup identifiers here — the
 * only place this mapping should live.
 */
export const BLOOD_GROUP_DISPLAY_TO_ENUM: Record<string, BloodGroup> = {
  'A+': BloodGroup.A_POSITIVE,
  'A-': BloodGroup.A_NEGATIVE,
  'B+': BloodGroup.B_POSITIVE,
  'B-': BloodGroup.B_NEGATIVE,
  'AB+': BloodGroup.AB_POSITIVE,
  'AB-': BloodGroup.AB_NEGATIVE,
  'O+': BloodGroup.O_POSITIVE,
  'O-': BloodGroup.O_NEGATIVE,
};

export const BLOOD_GROUP_ENUM_TO_DISPLAY: Record<BloodGroup, string> = {
  [BloodGroup.A_POSITIVE]: 'A+',
  [BloodGroup.A_NEGATIVE]: 'A-',
  [BloodGroup.B_POSITIVE]: 'B+',
  [BloodGroup.B_NEGATIVE]: 'B-',
  [BloodGroup.AB_POSITIVE]: 'AB+',
  [BloodGroup.AB_NEGATIVE]: 'AB-',
  [BloodGroup.O_POSITIVE]: 'O+',
  [BloodGroup.O_NEGATIVE]: 'O-',
};

export const BLOOD_GROUP_OPTIONS = Object.keys(BLOOD_GROUP_DISPLAY_TO_ENUM);
