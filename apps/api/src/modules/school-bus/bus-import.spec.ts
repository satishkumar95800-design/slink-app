/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- jest Prisma mocks */
import ExcelJS from 'exceljs';
import {
  buildBusTemplate,
  locationOf,
  parseBusWorkbook,
  phoneOf,
} from './bus-import';
import { BusImportService } from './bus-import.service';

const T = 'tenant-1';
const ROUTE_HEAD = [
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
];
const STUDENT_HEAD = ['Admission number', 'Student name', 'Route', 'Stop'];

async function xlsx(routes: unknown[][] | null, students: unknown[][] | null) {
  const wb = new ExcelJS.Workbook();
  if (routes) {
    const s = wb.addWorksheet('Routes');
    s.addRow(ROUTE_HEAD);
    routes.forEach((r) => s.addRow(r));
  }
  if (students) {
    const s = wb.addWorksheet('Students');
    s.addRow(STUDENT_HEAD);
    students.forEach((r) => s.addRow(r));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('reading the file', () => {
  it('groups stops under their route, with details from any row', async () => {
    const { routes, issues } = await parseBusWorkbook(
      await xlsx(
        [
          [
            'Route 1',
            '',
            '',
            '',
            '',
            '',
            '',
            'Temple',
            '7:20',
            '3:45 pm',
            '12.93, 77.58',
          ],
          [
            'route  1',
            'ka01ab1234',
            'Ramesh',
            '98450 77788',
            '',
            '',
            '',
            'Park',
            new Date(Date.UTC(1899, 11, 30, 7, 30)),
            '15:35',
            '',
          ],
        ],
        null,
      ),
    );
    expect(issues).toEqual([]);
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      name: 'Route 1',
      vehicleNumber: 'KA01AB1234',
      driver: { name: 'Ramesh', phone: '+919845077788' },
      stops: [
        {
          name: 'Temple',
          pickupTime: '07:20',
          dropTime: '15:45',
          lat: 12.93,
          lng: 77.58,
        },
        { name: 'Park', pickupTime: '07:30', dropTime: '15:35', lat: null },
      ],
    });
  });

  it('reports bad rows on the right sheet', async () => {
    const { issues } = await parseBusWorkbook(
      await xlsx(
        [
          ['', '', '', '', '', '', '', 'Temple'],
          [
            'R1',
            '',
            '',
            '12345',
            '',
            '',
            'gps.example.com',
            'Park',
            '25:00',
            '',
            'near the temple',
          ],
          ['R1', 'KA01', '', '', '', '', '', 'Gate'],
          ['R1', 'KA02', '', '', '', '', '', 'gate'],
        ],
        [['', 'Asha', 'R1']],
      ),
    );
    expect(issues).toEqual([
      { sheet: 'routes', row: 2, code: 'ROUTE_MISSING' },
      {
        sheet: 'routes',
        row: 3,
        code: 'LINK_INVALID',
        value: 'gps.example.com',
      },
      { sheet: 'routes', row: 3, code: 'TIME_INVALID', value: '25:00' },
      {
        sheet: 'routes',
        row: 3,
        code: 'LOCATION_INVALID',
        value: 'near the temple',
      },
      { sheet: 'routes', row: 3, code: 'PHONE_INVALID', value: '12345' },
      {
        sheet: 'routes',
        row: 5,
        code: 'ROUTE_DETAILS_DIFFER',
        value: 'Vehicle number',
      },
      { sheet: 'routes', row: 5, code: 'STOP_REPEATED', value: 'gate' },
      { sheet: 'students', row: 2, code: 'ADMISSION_MISSING' },
    ]);
  });

  it('reads its own template', async () => {
    const { routes, students, issues } = await parseBusWorkbook(
      await buildBusTemplate(),
    );
    expect(issues).toEqual([]);
    expect(routes.map((r) => r.stops.length)).toEqual([2, 1]);
    expect(students).toHaveLength(2);
  });

  it('reads phones and locations', () => {
    expect(phoneOf('09845077788')).toBe('+919845077788');
    expect(phoneOf('+44 20 7946 0958')).toBe('+442079460958');
    expect(phoneOf('12345')).toBeNull();
    expect(
      locationOf('https://www.google.com/maps/place/X/@12.93,77.62,17z'),
    ).toEqual({ lat: 12.93, lng: 77.62 });
  });
});

describe('BusImportService', () => {
  function makePrisma() {
    const prisma: any = {
      transportRoute: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'r-old',
            name: 'Route 9',
            stops: [{ id: 'st-old', name: 'Market' }],
          },
        ]),
        create: jest.fn(),
      },
      transportStop: { createMany: jest.fn() },
      pettyCashPayee: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p-ramesh',
            name: 'Ramesh Gowda',
            phone: '+91 98450 77788',
            isActive: true,
          },
          {
            id: 'p-old',
            name: 'Old Driver',
            phone: '+919000000000',
            isActive: false,
          },
        ]),
        createMany: jest.fn(),
      },
      student: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 's1',
            name: 'Asha Rao',
            admissionNo: 'GV1001',
            transport: null,
          },
          {
            id: 's2',
            name: 'Rahul Shetty',
            admissionNo: 'GV1002',
            transport: null,
          },
          {
            id: 's3',
            name: 'Kiran',
            admissionNo: 'GV1003',
            transport: { route: { name: 'Route 9' } },
          },
        ]),
      },
      studentTransport: { createMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
    return prisma;
  }

  const good = () =>
    xlsx(
      [
        [
          'Route 1',
          'KA01',
          'Ramesh',
          '9845077788',
          'Lakshmi',
          '9845011122',
          '',
          'Temple',
          '07:20',
          '15:45',
        ],
        ['Route 1', '', '', '', '', '', '', 'Park', '07:30', '15:35'],
      ],
      [
        ['gv1001', 'Asha Rao', 'Route 1', 'Park'],
        ['GV1002', 'Rahul', 'route 9', 'market'],
      ],
    );

  it('matches staff by phone, adds new ones, and places children', async () => {
    const prisma = makePrisma();
    const service = new BusImportService(prisma);
    expect(await service.validate(T, await good())).toEqual({
      routes: 1,
      stops: 2,
      staffAdded: 1,
      staffMatched: 1,
      students: 2,
      errors: [],
      warnings: [
        {
          sheet: 'students',
          row: 3,
          code: 'NAME_DIFFERS',
          value: 'GV1002',
          detail: 'Rahul Shetty',
        },
      ],
    });
    expect(prisma.transportRoute.create).not.toHaveBeenCalled();

    expect(await service.commit(T, 'admin-1', await good())).toEqual({
      routes: 1,
      stops: 2,
      staffAdded: 1,
      students: 2,
    });
    const staff = prisma.pettyCashPayee.createMany.mock.calls[0][0].data;
    expect(staff).toEqual([
      expect.objectContaining({
        name: 'Lakshmi',
        phone: '+919845011122',
        type: 'GROUND_STAFF',
      }),
    ]);
    const route = prisma.transportRoute.create.mock.calls[0][0].data;
    expect(route).toMatchObject({
      name: 'Route 1',
      driverId: 'p-ramesh',
      attendantId: staff[0].id,
    });
    const stops = prisma.transportStop.createMany.mock.calls[0][0].data;
    const park = stops.find((s: any) => s.name === 'Park');
    expect(prisma.studentTransport.createMany).toHaveBeenCalledWith({
      data: [
        { tenantId: T, studentId: 's1', routeId: route.id, stopId: park.id },
        { tenantId: T, studentId: 's2', routeId: 'r-old', stopId: 'st-old' },
      ],
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'transport.import' }),
      }),
    );
  });

  it('refuses children on another route, unknown ones, and names already used', async () => {
    const prisma = makePrisma();
    const service = new BusImportService(prisma);
    const report = await service.validate(
      T,
      await xlsx(
        [
          ['Route 9', '', '', '', '', '', '', 'Market'],
          ['Route 2', '', 'Old Driver', '9000000000', '', '', '', 'Gate'],
        ],
        [
          ['GV1003', '', 'Route 2'],
          ['GV9999', '', 'Route 2'],
          ['GV1001', '', 'Route 7'],
          ['GV1002', '', 'Route 2', 'Nowhere'],
          ['GV1002', '', 'Route 2'],
        ],
      ),
    );
    expect(report.errors).toEqual([
      { sheet: 'routes', row: 2, code: 'ROUTE_EXISTS', value: 'Route 9' },
      { sheet: 'routes', row: 3, code: 'STAFF_INACTIVE', value: 'Old Driver' },
      {
        sheet: 'students',
        row: 2,
        code: 'STUDENT_ON_ROUTE',
        value: 'Kiran',
        detail: 'Route 9',
      },
      { sheet: 'students', row: 3, code: 'STUDENT_NOT_FOUND', value: 'GV9999' },
      { sheet: 'students', row: 4, code: 'ROUTE_UNKNOWN', value: 'Route 7' },
      {
        sheet: 'students',
        row: 5,
        code: 'STOP_UNKNOWN',
        value: 'Nowhere',
        detail: 'Route 2',
      },
      {
        sheet: 'students',
        row: 6,
        code: 'STUDENT_REPEATED',
        value: 'GV1002',
        detail: '5',
      },
    ]);
    await expect(
      service.commit(
        T,
        'admin-1',
        await xlsx(null, [['GV1003', '', 'Route 9']]),
      ),
    ).rejects.toMatchObject({
      response: { code: 'IMPORT_ROWS_INVALID' },
    });
    expect(prisma.studentTransport.createMany).not.toHaveBeenCalled();
  });
});
