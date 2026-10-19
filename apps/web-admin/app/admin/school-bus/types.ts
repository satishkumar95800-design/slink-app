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
  studentCount: number;
}

export interface Route {
  id: string;
  name: string;
  vehicleNumber: string | null;
  notes: string | null;
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
