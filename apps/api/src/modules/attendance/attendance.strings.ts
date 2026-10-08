/** User-facing attendance text (push notifications, errors) kept in one place for later translation. */
export const attendanceStrings = {
  absentTitle: 'Absent today',
  absentBody: (firstName: string, date: string) => `${firstName} was marked absent today (${date}).`,
  correctionTitle: 'Attendance corrected',
  correctionBody: (firstName: string, statusLabel: string, date: string) =>
    `Correction: ${firstName} was marked ${statusLabel} today (${date}).`,
  statusLabel: { present: 'present', absent: 'absent', late: 'late', leave: 'on leave' } as const,

  classNotFound: 'Class not found',
  studentNotFound: 'Student not found',
  notYourClass: 'You can only take attendance for classes you are the class teacher of',
  notYourStudent: 'You can only view attendance for your own children or students in your classes',
  teacherTodayOnly: "Teachers can only mark today's attendance. Ask an admin to change other days.",
  futureDate: 'Attendance cannot be marked for a future date',
  invalidDate: 'Not a valid calendar date',
  holiday: (name: string) => `This day is a school holiday (${name}). Remove the holiday in Settings first to mark attendance.`,
  studentNotInClass: 'One or more students are not in this class',
  duplicateStudent: 'Each student can appear only once',
  rangeTooLong: 'Choose a date range of at most 366 days',
  rangeReversed: '"from" must be on or before "to"',
  holidayExists: 'A holiday already exists on this date',
  holidayNotFound: 'Holiday not found',
};
