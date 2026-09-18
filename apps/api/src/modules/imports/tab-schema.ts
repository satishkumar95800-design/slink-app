export const REQUIRED_TABS = [
  'Instructions',
  'Classes',
  'Users',
  'Students',
  'Fee Structures',
  'Teachers',
] as const;

export const TAB_HEADERS: Record<
  'Classes' | 'Users' | 'Students' | 'Fee Structures' | 'Teachers',
  string[]
> = {
  Classes: ['Class Name', 'Section', 'Academic Year', 'Class Teacher Email'],
  Users: ['Full Name', 'Email', 'Phone Number', 'Role', 'Assigned Class (Teachers only)'],
  Teachers: [
    'Teacher Name',
    'Phone Number',
    'Email',
    'Class Name',
    'Section',
    'Subject Name',
    'Is Class Teacher',
  ],
  Students: [
    'Student Name',
    'Admission Number',
    'Class Name',
    'Section',
    'Date of Birth',
    'Parent Name',
    'Guardian 1 Relation',
    'Parent Mobile Number',
    'Parent Email',
    'Parent Profession',
    'Guardian 2 Name',
    'Guardian 2 Relation',
    'Guardian 2 Mobile Number',
    'Guardian 2 Email',
    'Guardian 2 Profession',
    'Blood Group',
    'Caste',
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
  'Classes' | 'Users' | 'Students' | 'Fee Structures' | 'Teachers',
  string[]
> = {
  Classes: ['Class Name*', 'Section*', 'Academic Year*', 'Class Teacher Email'],
  Users: ['Full Name*', 'Email*', 'Phone Number', 'Role*', 'Assigned Class (Teachers only)'],
  Teachers: [
    'Teacher Name*',
    'Phone Number*',
    'Email',
    'Class Name*',
    'Section',
    'Subject Name*',
    'Is Class Teacher',
  ],
  Students: [
    'Student Name*',
    'Admission Number*',
    'Class Name*',
    'Section*',
    'Date of Birth',
    'Parent Name*',
    'Guardian 1 Relation',
    'Parent Mobile Number*',
    'Parent Email',
    'Parent Profession',
    'Guardian 2 Name',
    'Guardian 2 Relation',
    'Guardian 2 Mobile Number',
    'Guardian 2 Email',
    'Guardian 2 Profession',
    'Blood Group',
    'Caste',
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
/** Display casing shown in the template dropdown; stored lowercase to match the Prisma enum directly. */
export const GUARDIAN_RELATION_TEMPLATE_OPTIONS = ['Father', 'Mother', 'Guardian'];
export const YES_NO_TEMPLATE_OPTIONS = ['Yes', 'No'];
