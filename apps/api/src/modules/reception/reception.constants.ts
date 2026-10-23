/** Documents the front desk collects for an admission (fixed list; labels in the console). */
export const ADMISSION_DOCUMENTS = [
  'birth_certificate',
  'transfer_certificate',
  'report_card',
  'photos',
  'child_aadhaar',
  'parent_id_proof',
  'address_proof',
  'medical_certificate',
] as const;
export type AdmissionDocumentKind = (typeof ADMISSION_DOCUMENTS)[number];

/** What money taken at the desk is for. */
export const DESK_PAYMENT_PURPOSES = [
  'registration_fee',
  'application_form',
  'other',
] as const;
