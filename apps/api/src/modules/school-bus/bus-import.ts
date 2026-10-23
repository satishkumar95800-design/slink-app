import ExcelJS from 'exceljs';

/**
 * Excel import of school bus routes (pure reading and row checks; lookups in
 * BusImportService). Two sheets:
 * - "Routes": one row per stop, in pick-up order. The route's own details
 *   (vehicle, driver, attendant, tracking link) may be on any of its rows.
 * - "Students": one row per child, found by admission number.
 */

export type Sheet = 'routes' | 'students';

/** A row problem; the console translates `code` (schoolBus.importError.*). */
export interface ImportIssue {
  sheet: Sheet;
  row: number;
  code: string;
  value?: string;
  /** A second value for the message (e.g. the route a child is already on). */
  detail?: string;
}

export interface Person {
  name: string | null;
  /** Compact E.164 (+919845077788); 10 digits get +91. */
  phone: string | null;
}

export interface StopRow {
  row: number;
  name: string;
  pickupTime: string | null;
  dropTime: string | null;
  lat: number | null;
  lng: number | null;
}

export interface RouteRows {
  /** First row of the route, for messages. */
  row: number;
  name: string;
  vehicleNumber: string | null;
  trackingUrl: string | null;
  driver: Person | null;
  attendant: Person | null;
  stops: StopRow[];
}

export interface StudentRow {
  row: number;
  admissionNo: string;
  name: string | null;
  route: string;
  stop: string | null;
}

export const MAX_ROWS = 5000;

const ROUTE_COLUMNS = [
  'Route',
  'Vehicle number',
  'Driver name',
  'Driver phone',
  'Attendant name',
  'Attendant phone',
  'Tracking link',
  'Stop',
  'Pick-up time',
  'Drop time',
  'Stop location',
] as const;
const STUDENT_COLUMNS = [
  'Admission number',
  'Student name',
  'Route',
  'Stop',
] as const;

const text = (cell: ExcelJS.Cell): string => {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && 'richText' in v)
    return v.richText
      .map((r) => r.text)
      .join('')
      .trim();
  const plain = (x: unknown) =>
    typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean'
      ? String(x).trim()
      : '';
  if (typeof v === 'object' && 'result' in v) return plain(v.result);
  if (typeof v === 'object' && 'hyperlink' in v)
    return plain((v as { hyperlink: unknown }).hyperlink);
  if (typeof v === 'object' && 'text' in v) return plain(v.text);
  return plain(v);
};

/** Same name, ignoring case and spacing. */
export const sameName = (a: string, b: string) =>
  a.toLowerCase().replace(/\s+/g, ' ').trim() ===
  b.toLowerCase().replace(/\s+/g, ' ').trim();

/** "HH:MM" from an Excel time, "7:40", "07.40", "7:40 am" or "3:20 PM"; '' for blank; null if unreadable. */
export function timeOf(cell: ExcelJS.Cell): string | null {
  const v = cell.value;
  const hm = (h: number, m: number) =>
    h >= 0 && h < 24 && m >= 0 && m < 60
      ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      : null;
  // Excel keeps a time as a date on 30/12/1899 (UTC).
  if (v instanceof Date) return hm(v.getUTCHours(), v.getUTCMinutes());
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const mins = Math.round(v * 24 * 60);
    return hm(Math.floor(mins / 60), mins % 60);
  }
  const s = text(cell).toLowerCase();
  if (!s) return '';
  const m = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[3] === 'pm' ? 12 : 0);
  }
  return hm(h, Number(m[2]));
}

/** "12.9716, 77.5946" or a Google Maps link; null when blank; 'invalid' otherwise. */
export function locationOf(
  value: string,
): { lat: number; lng: number } | null | 'invalid' {
  const v = value.trim();
  if (!v) return null;
  const num = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
  const patterns = [
    new RegExp(String.raw`!3d${num}!4d${num}`),
    new RegExp(String.raw`@${num},\s*${num}`),
    new RegExp(
      String.raw`[?&](?:q|query|ll|destination)=${num}(?:,|%2C)\s*${num}`,
      'i',
    ),
    new RegExp(String.raw`^${num}\s*[,\s]\s*${num}$`),
  ];
  for (const re of patterns) {
    const m = re.exec(v);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      !(lat === 0 && lng === 0)
    )
      return { lat, lng };
  }
  return 'invalid';
}

/** "+91 98450 77788", "9845077788" or "09845077788" -> "+919845077788"; null if unreadable. */
export function phoneOf(value: string): string | null {
  const compact = value.replace(/[\s()-]/g, '');
  if (/^\+[1-9]\d{6,14}$/.test(compact)) return compact;
  const digits = compact.replace(/^0/, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  return null;
}

const isWebLink = (v: string) => /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(v);

function headerMap(sheet: ExcelJS.Worksheet) {
  const col = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, n) => {
    col.set(
      text(cell)
        .toLowerCase()
        .replace(/\s*\(.*\)$/, '')
        .replace(/\s+/g, ' '),
      n,
    );
  });
  return col;
}

const findSheet = (wb: ExcelJS.Workbook, name: string) =>
  wb.worksheets.find((s) => s.name.trim().toLowerCase() === name);

export async function parseBusWorkbook(buffer: Buffer): Promise<{
  routes: RouteRows[];
  students: StudentRow[];
  issues: ImportIssue[];
}> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return {
      routes: [],
      students: [],
      issues: [{ sheet: 'routes', row: 0, code: 'FILE_UNREADABLE' }],
    };
  }
  const issues: ImportIssue[] = [];
  const routeSheet = findSheet(workbook, 'routes');
  const studentSheet = findSheet(workbook, 'students');
  if (!routeSheet && !studentSheet)
    return {
      routes: [],
      students: [],
      issues: [{ sheet: 'routes', row: 0, code: 'SHEETS_MISSING' }],
    };
  const routes = routeSheet ? readRoutes(routeSheet, issues) : [];
  const students = studentSheet ? readStudents(studentSheet, issues) : [];
  return { routes, students, issues };
}

function readRoutes(sheet: ExcelJS.Worksheet, issues: ImportIssue[]) {
  const col = headerMap(sheet);
  const missing = ['Route', 'Stop'].filter((h) => !col.has(h.toLowerCase()));
  if (missing.length) {
    issues.push({
      sheet: 'routes',
      row: 1,
      code: 'HEADERS_MISSING',
      value: missing.join(', '),
    });
    return [];
  }
  const cellOf = (row: ExcelJS.Row, h: string) => {
    const n = col.get(h.toLowerCase());
    return n ? row.getCell(n) : null;
  };
  const read = (row: ExcelJS.Row, h: string) => {
    const c = cellOf(row, h);
    return c ? text(c) : '';
  };

  const routes = new Map<string, RouteRows>();
  let count = 0;
  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    const v = Object.fromEntries(
      ROUTE_COLUMNS.map((h) => [h, read(row, h)]),
    ) as Record<(typeof ROUTE_COLUMNS)[number], string>;
    if (Object.values(v).every((x) => !x)) continue;
    if (++count > MAX_ROWS) {
      issues.push({
        sheet: 'routes',
        row: n,
        code: 'TOO_MANY_ROWS',
        value: String(MAX_ROWS),
      });
      break;
    }
    const bad = (code: string, value?: string) =>
      issues.push({
        sheet: 'routes',
        row: n,
        code,
        ...(value !== undefined && { value }),
      });
    const before = issues.length;

    if (!v.Route) bad('ROUTE_MISSING');
    else if (v.Route.length > 80) bad('TOO_LONG', 'Route');
    if (!v.Stop) bad('STOP_MISSING');
    else if (v.Stop.length > 100) bad('TOO_LONG', 'Stop');
    if (v['Vehicle number'].length > 20) bad('TOO_LONG', 'Vehicle number');
    if (
      v['Tracking link'] &&
      (!isWebLink(v['Tracking link']) || v['Tracking link'].length > 500)
    )
      bad('LINK_INVALID', v['Tracking link']);

    const times: Record<string, string | null> = {};
    for (const h of ['Pick-up time', 'Drop time'] as const) {
      const c = cellOf(row, h);
      const t = c ? timeOf(c) : '';
      if (t === null) bad('TIME_INVALID', read(row, h));
      times[h] = t || null;
    }
    const at = locationOf(v['Stop location']);
    if (at === 'invalid') bad('LOCATION_INVALID', v['Stop location']);

    const person = (role: 'Driver' | 'Attendant'): Person | null => {
      const name = v[`${role} name`];
      const raw = v[`${role} phone`];
      if (!name && !raw) return null;
      const phone = raw ? phoneOf(raw) : null;
      if (raw && !phone) bad('PHONE_INVALID', raw);
      if (name.length > 100) bad('TOO_LONG', `${role} name`);
      return { name: name || null, phone };
    };
    const driver = person('Driver');
    const attendant = person('Attendant');
    if (issues.length > before || !v.Route) continue;

    const key = v.Route.toLowerCase().replace(/\s+/g, ' ');
    const route =
      routes.get(key) ??
      ({
        row: n,
        name: v.Route.replace(/\s+/g, ' '),
        vehicleNumber: null,
        trackingUrl: null,
        driver: null,
        attendant: null,
        stops: [],
      } satisfies RouteRows);
    // A route's details may sit on any one of its rows, but must not differ.
    const merge = <T>(
      current: T | null,
      next: T | null,
      same: (a: T, b: T) => boolean,
      label: string,
    ) => {
      if (next == null) return current;
      if (current != null && !same(current, next)) {
        bad('ROUTE_DETAILS_DIFFER', label);
        return current;
      }
      return next;
    };
    const samePerson = (a: Person, b: Person) =>
      (a.phone ?? '') === (b.phone ?? '') &&
      sameName(a.name ?? '', b.name ?? '');
    route.vehicleNumber = merge(
      route.vehicleNumber,
      v['Vehicle number'].toUpperCase() || null,
      (a, b) => a === b,
      'Vehicle number',
    );
    route.trackingUrl = merge(
      route.trackingUrl,
      v['Tracking link'] || null,
      (a, b) => a === b,
      'Tracking link',
    );
    route.driver = merge(route.driver, driver, samePerson, 'Driver');
    route.attendant = merge(
      route.attendant,
      attendant,
      samePerson,
      'Attendant',
    );
    if (route.stops.some((s) => sameName(s.name, v.Stop)))
      bad('STOP_REPEATED', v.Stop);
    else
      route.stops.push({
        row: n,
        name: v.Stop.replace(/\s+/g, ' '),
        pickupTime: times['Pick-up time'],
        dropTime: times['Drop time'],
        lat: at && at !== 'invalid' ? at.lat : null,
        lng: at && at !== 'invalid' ? at.lng : null,
      });
    routes.set(key, route);
  }
  return [...routes.values()];
}

function readStudents(sheet: ExcelJS.Worksheet, issues: ImportIssue[]) {
  const col = headerMap(sheet);
  const missing = ['Admission number', 'Route'].filter(
    (h) => !col.has(h.toLowerCase()),
  );
  if (missing.length) {
    issues.push({
      sheet: 'students',
      row: 1,
      code: 'HEADERS_MISSING',
      value: missing.join(', '),
    });
    return [];
  }
  const read = (row: ExcelJS.Row, h: string) => {
    const n = col.get(h.toLowerCase());
    return n ? text(row.getCell(n)) : '';
  };
  const out: StudentRow[] = [];
  let count = 0;
  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    const v = Object.fromEntries(
      STUDENT_COLUMNS.map((h) => [h, read(row, h)]),
    ) as Record<(typeof STUDENT_COLUMNS)[number], string>;
    if (Object.values(v).every((x) => !x)) continue;
    if (++count > MAX_ROWS) {
      issues.push({
        sheet: 'students',
        row: n,
        code: 'TOO_MANY_ROWS',
        value: String(MAX_ROWS),
      });
      break;
    }
    const before = issues.length;
    const bad = (code: string, value?: string) =>
      issues.push({
        sheet: 'students',
        row: n,
        code,
        ...(value !== undefined && { value }),
      });
    if (!v['Admission number']) bad('ADMISSION_MISSING');
    if (!v.Route) bad('ROUTE_MISSING');
    if (issues.length > before) continue;
    out.push({
      row: n,
      admissionNo: v['Admission number'],
      name: v['Student name'] || null,
      route: v.Route.replace(/\s+/g, ' '),
      stop: v.Stop ? v.Stop.replace(/\s+/g, ' ') : null,
    });
  }
  return out;
}

/** Template: both sheets with example rows, and how to fill them. */
export async function buildBusTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const shade = (sheet: ExcelJS.Worksheet, rows: number[]) =>
    rows.forEach(
      (n) =>
        (sheet.getRow(n).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF7E6' },
        }),
    );

  const routes = workbook.addWorksheet('Routes');
  routes.columns = [
    { header: 'Route', width: 22 },
    { header: 'Vehicle number', width: 15 },
    { header: 'Driver name', width: 18 },
    { header: 'Driver phone', width: 16 },
    { header: 'Attendant name', width: 18 },
    { header: 'Attendant phone', width: 16 },
    { header: 'Tracking link', width: 30 },
    { header: 'Stop', width: 22 },
    { header: 'Pick-up time', width: 12 },
    { header: 'Drop time', width: 12 },
    { header: 'Stop location', width: 22 },
  ];
  routes.getRow(1).font = { bold: true };
  routes.addRows([
    [
      'Route 1 - Jayanagar',
      'KA01AB1234',
      'Ramesh Gowda',
      '9845077788',
      'Lakshmi B',
      '9845011122',
      '',
      'South End Circle',
      '07:20',
      '15:45',
      '12.9365, 77.5800',
    ],
    [
      'Route 1 - Jayanagar',
      '',
      '',
      '',
      '',
      '',
      '',
      'Jayanagar 4th Block',
      '07:30',
      '15:35',
      '',
    ],
    [
      'Route 2 - BTM',
      'KA05CD5678',
      'Suresh K',
      '9900112233',
      '',
      '',
      'https://gps.example.com/track/KA05CD5678',
      'Udupi Garden',
      '07:15',
      '15:50',
      '',
    ],
  ]);
  shade(routes, [2, 3, 4]);
  // Keep phones and times as typed.
  for (const c of [4, 6, 9, 10]) routes.getColumn(c).numFmt = '@';

  const students = workbook.addWorksheet('Students');
  students.columns = [
    { header: 'Admission number', width: 18 },
    { header: 'Student name', width: 24 },
    { header: 'Route', width: 22 },
    { header: 'Stop', width: 22 },
  ];
  students.getRow(1).font = { bold: true };
  students.addRows([
    ['GV1001', 'Asha Rao', 'Route 1 - Jayanagar', 'South End Circle'],
    ['GV1002', 'Rahul Shetty', 'Route 2 - BTM', 'Udupi Garden'],
  ]);
  shade(students, [2, 3]);
  students.getColumn(1).numFmt = '@';

  const help = workbook.addWorksheet('How to fill');
  help.getColumn(1).width = 120;
  [
    'Routes sheet: one row per stop, in pick-up order. Repeat the route name on every stop of the route.',
    'Vehicle, driver, attendant and tracking link are needed once per route (any of its rows).',
    'Drivers and attendants are matched to the ground staff on the School bus page by phone number (or by name when there is no phone); anyone not there yet is added.',
    'Times as HH:MM (07:20, 15:45). Stop location is optional: "latitude, longitude" or a Google Maps link, for the parents\' arrival time.',
    "Tracking link is optional: the bus company's GPS page for that bus.",
    'Routes already in Schoolinkd are not changed by the Routes sheet; edit them on the School bus page.',
    "Students sheet: one row per child. Admission number must match Schoolinkd; Student name is only checked. Route can be one in this file or one already in Schoolinkd; Stop must be one of that route's stops.",
    'A child already on a bus route is refused: take them off that route first.',
    'Replace the example rows (shaded) with your own. You can fill only one of the sheets.',
  ].forEach((line) => help.addRow([line]));

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
