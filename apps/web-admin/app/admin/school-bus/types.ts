export interface Person {
  id: string;
  name: string;
  phone: string | null;
  isActive?: boolean;
}

export interface Stop {
  id: string;
  name: string;
  pickupTime: string | null;
  dropTime: string | null;
  lat: number | null;
  lng: number | null;
  studentCount: number;
}

export interface Route {
  id: string;
  name: string;
  vehicleNumber: string | null;
  notes: string | null;
  trackingUrl: string | null;
  driverId: string | null;
  attendantId: string | null;
  driver: Person | null;
  attendant: Person | null;
  stops: Stop[];
  studentCount: number;
}

export interface Rider {
  id: string;
  name: string;
  admissionNo: string;
  stopId: string | null;
  class: { id: string; name: string; section: string | null };
}

export interface ClassStudent {
  id: string;
  name: string;
  admissionNo: string;
  routeId: string | null;
  routeName: string | null;
  stopId: string | null;
}

export interface ClassOption {
  id: string;
  name: string;
  section?: string | null;
  academicYear: string;
}

/** Row problems from /transport/import/validate (messages schoolBus.importError.*). */
export const IMPORT_ERROR_CODES = [
  'FILE_UNREADABLE',
  'SHEETS_MISSING',
  'HEADERS_MISSING',
  'TOO_MANY_ROWS',
  'ROUTE_MISSING',
  'STOP_MISSING',
  'TOO_LONG',
  'LINK_INVALID',
  'TIME_INVALID',
  'LOCATION_INVALID',
  'PHONE_INVALID',
  'ROUTE_DETAILS_DIFFER',
  'STOP_REPEATED',
  'ROUTE_EXISTS',
  'STAFF_AMBIGUOUS',
  'STAFF_INACTIVE',
  'STAFF_NAME_MISSING',
  'DRIVER_IS_ATTENDANT',
  'ADMISSION_MISSING',
  'STUDENT_NOT_FOUND',
  'STUDENT_REPEATED',
  'STUDENT_ON_ROUTE',
  'ROUTE_UNKNOWN',
  'STOP_UNKNOWN',
  'NAME_DIFFERS',
] as const;

export interface ImportIssue {
  sheet: 'routes' | 'students';
  row: number;
  code: string;
  value?: string;
  detail?: string;
}

export interface ImportReport {
  routes: number;
  stops: number;
  staffAdded: number;
  staffMatched: number;
  students: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}
