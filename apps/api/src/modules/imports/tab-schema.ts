export const REQUIRED_TABS = [
  'Instructions',
  'Classes',
  'Users',
  'Students',
  'Fee Structures',
] as const;

export const TAB_HEADERS: Record<
  'Classes' | 'Users' | 'Students' | 'Fee Structures',
  string[]
> = {
  Classes: ['Class Name', 'Section', 'Academic Year', 'Class Teacher Email'],
  Users: ['Full Name', 'Email', 'Phone Number', 'Role', 'Assigned Class (Teachers only)'],
  Students: [
    'Student Name',
    'Admission Number',
    'Class Name',
    'Section',
    'Date of Birth',
    'Parent Name',
    'Parent Mobile Number',
    'Parent Email',
    'Blood Group',
    'Caste',
    'Parent Profession',
  ],
  'Fee Structures': [
    'Class Name',
    'Section',
    'Term',
    'Fee Component',
    'Amount',
    'Due Date',
    'Late Fee',
  ],
};

/**
 * Header text as written in the downloadable template — required columns get a
 * trailing "*", matching the spec's column-naming convention (e.g. "Class Name*").
 * Same order/length as TAB_HEADERS; the parser strips "*" back off on read, so
 * TAB_HEADERS stays the canonical (asterisk-free) name used everywhere internally.
 */
export const DISPLAY_HEADERS: Record<
  'Classes' | 'Users' | 'Students' | 'Fee Structures',
  string[]
> = {
  Classes: ['Class Name*', 'Section*', 'Academic Year*', 'Class Teacher Email'],
  Users: ['Full Name*', 'Email*', 'Phone Number', 'Role*', 'Assigned Class (Teachers only)'],
  Students: [
    'Student Name*',
    'Admission Number*',
    'Class Name*',
    'Section*',
    'Date of Birth',
    'Parent Name*',
    'Parent Mobile Number*',
    'Parent Email',
    'Blood Group',
    'Caste',
    'Parent Profession',
  ],
  'Fee Structures': [
    'Class Name*',
    'Section',
    'Term*',
    'Fee Component*',
    'Amount*',
    'Due Date*',
    'Late Fee',
  ],
};

export const ALLOWED_ROLES = ['admin', 'accounts', 'teacher'] as const;

export const COMMON_FEE_COMPONENTS = [
  'Tuition',
  'Transport',
  'Activities',
  'Lab Fee',
  'Library Fee',
  'Miscellaneous',
];

export const BLOOD_GROUP_TEMPLATE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const CASTE_TEMPLATE_OPTIONS = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'];
