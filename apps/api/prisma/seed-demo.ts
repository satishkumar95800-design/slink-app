/**
 * Demo school seed (docs/SPEC-improvements.md Phase 6).
 *
 * Builds — or wipes and rebuilds — a fully fictional school, "Green Valley
 * Public School", for product videos and live demos. It only ever touches the
 * tenant with slug DEMO_SLUG, and refuses to run if that tenant exists without
 * the demo flag (features.isDemo === true), so it can never modify a real school.
 *
 *   pnpm --filter api seed:demo
 *
 * Demo logins are documented in prisma/DEMO_SEED.md (never printed here).
 * Placeholder photos/PDFs are uploaded to S3 with the API's own S3 settings; if
 * S3 isn't reachable, data is still created and the files are skipped.
 */
import { randomUUID } from 'crypto';
import { deflateSync } from 'zlib';
import * as bcrypt from 'bcrypt';
import PDFDocument from 'pdfkit';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  AttendanceStatus,
  BillingFrequency,
  BroadcastKind,
  ClaimPaymentMode,
  DiscountKind,
  FeeStatus,
  Gender,
  GuardianRelation,
  NotificationChannel,
  NotificationStatus,
  PaymentClaimStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
  ReportStatus,
  ReportType,
  Role,
  StudentNoteType,
} from '@prisma/client';
import { explodeFeeItem } from '../src/modules/fees/fee-component-explosion.util';

export const DEMO_SLUG = 'gvps-demo';
export const DEMO_SCHOOL_NAME = 'Green Valley Public School';
const TIME_ZONE = 'Asia/Kolkata';
const PASSWORD = process.env.DEMO_SEED_PASSWORD ?? 'GreenValley@2026';

/** The one guard that matters: never touch a school that isn't flagged as the demo. */
export function assertSafeToReset(
  existing: { slug: string; features: unknown } | null,
): void {
  if (!existing) return;
  const features = (existing.features ?? {}) as Record<string, unknown>;
  if (features.isDemo !== true) {
    throw new Error(
      `Refusing to run: tenant "${existing.slug}" exists but is not flagged as a demo school (features.isDemo). ` +
        'The demo seed only ever resets a school it created itself.',
    );
  }
}

// ── Deterministic randomness, so every run builds the same school ────────────

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261009);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;
const between = (lo: number, hi: number) =>
  lo + Math.floor(rand() * (hi - lo + 1));

// ── Dates (all calendar days in IST, stored as UTC-midnight DATE) ────────────

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const dbDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
const todayYmd = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const today = dbDate(todayYmd);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
/** June–May academic year, matching the fees module. */
const AY_START =
  today.getUTCMonth() >= 5
    ? today.getUTCFullYear()
    : today.getUTCFullYear() - 1;
const ACADEMIC_YEAR = `${AY_START}-${String((AY_START + 1) % 100).padStart(2, '0')}`;
/** A timestamp at hh:mm IST on a given day. */
const atIst = (day: Date, hh: number, mm: number) =>
  new Date(day.getTime() + ((hh - 5) * 60 + (mm - 30)) * 60_000);

// ── Fictional people ──────────────────────────────────────────────────────────

const BOYS = [
  'Aarav',
  'Vihaan',
  'Arjun',
  'Reyansh',
  'Advik',
  'Kabir',
  'Ishaan',
  'Atharv',
  'Vivaan',
  'Ayaan',
  'Krishna',
  'Rohan',
  'Siddharth',
  'Dhruv',
  'Aditya',
  'Karthik',
  'Pranav',
  'Nikhil',
  'Rahul',
  'Varun',
  'Harsh',
  'Yash',
  'Tejas',
  'Manav',
  'Shaurya',
  'Rudra',
  'Om',
  'Laksh',
  'Neel',
  'Dev',
  'Arnav',
  'Samarth',
  'Chirag',
  'Ritvik',
  'Avinash',
  'Sai',
] as const;
const GIRLS = [
  'Aadhya',
  'Ananya',
  'Diya',
  'Saanvi',
  'Myra',
  'Ira',
  'Kiara',
  'Anika',
  'Navya',
  'Riya',
  'Sneha',
  'Pooja',
  'Meera',
  'Tanvi',
  'Ishita',
  'Kavya',
  'Nandini',
  'Shreya',
  'Aditi',
  'Divya',
  'Lakshmi',
  'Prisha',
  'Vaishnavi',
  'Sanjana',
  'Avani',
  'Bhavya',
  'Charvi',
  'Ritika',
  'Sahana',
  'Varsha',
  'Keerthi',
  'Harini',
  'Pallavi',
  'Nithya',
  'Swathi',
  'Gauri',
] as const;
const SURNAMES = [
  'Sharma',
  'Verma',
  'Iyer',
  'Rao',
  'Reddy',
  'Nair',
  'Menon',
  'Patel',
  'Gowda',
  'Hegde',
  'Kulkarni',
  'Joshi',
  'Singh',
  'Gupta',
  'Shetty',
  'Pillai',
  'Desai',
  'Bhat',
  'Kamath',
  'Naidu',
  'Mehta',
  'Chopra',
  'Shah',
  'Agarwal',
  'Pai',
  'Acharya',
  'Murthy',
  'Prasad',
  'Krishnan',
  'Raman',
] as const;
const FATHERS = [
  'Ramesh',
  'Suresh',
  'Mahesh',
  'Rajesh',
  'Prakash',
  'Anil',
  'Sunil',
  'Vijay',
  'Sanjay',
  'Manoj',
  'Rakesh',
  'Deepak',
  'Ashok',
  'Naveen',
  'Kiran',
  'Girish',
  'Srinivas',
  'Venkatesh',
  'Harish',
  'Arun',
] as const;
const MOTHERS = [
  'Lakshmi',
  'Sunitha',
  'Kavitha',
  'Rekha',
  'Asha',
  'Geetha',
  'Shobha',
  'Usha',
  'Anitha',
  'Deepa',
  'Vidya',
  'Sangeetha',
  'Pushpa',
  'Radha',
  'Meena',
  'Sudha',
  'Latha',
  'Jyothi',
  'Shanthi',
  'Padma',
] as const;
const PROFESSIONS = [
  'Software Engineer',
  'Business Owner',
  'Doctor',
  'Teacher',
  'Bank Officer',
  'Government Employee',
  'Accountant',
  'Shop Owner',
  'Farmer',
  'Engineer',
  'Lawyer',
  'Homemaker',
] as const;

const CLASSES = [
  { name: 'LKG', tuition: 2800 },
  { name: 'UKG', tuition: 2800 },
  { name: 'Class 1', tuition: 3200 },
  { name: 'Class 2', tuition: 3200 },
  { name: 'Class 3', tuition: 3200 },
  { name: 'Class 4', tuition: 3500 },
  { name: 'Class 5', tuition: 3500 },
  { name: 'Class 6', tuition: 3800 },
  { name: 'Class 7', tuition: 3800 },
  { name: 'Class 8', tuition: 3800 },
] as const;
const STUDENTS_PER_CLASS = 30;

const SUBJECTS = [
  'English',
  'Kannada',
  'Hindi',
  'Mathematics',
  'Science',
  'Social Science',
  'EVS',
  'Computer Science',
] as const;
const TEACHERS = [
  { name: 'Neha Kulkarni', subject: 'English' },
  { name: 'Ramya Gowda', subject: 'Kannada' },
  { name: 'Sunita Verma', subject: 'Hindi' },
  { name: 'Krishna Murthy', subject: 'Mathematics' },
  { name: 'Anjali Nair', subject: 'Science' },
  { name: 'Prakash Hegde', subject: 'Social Science' },
  { name: 'Divya Rao', subject: 'EVS' },
  { name: 'Arvind Shetty', subject: 'Computer Science' },
  { name: 'Meghana Joshi', subject: 'Mathematics' },
  { name: 'Farhan Sheikh', subject: 'English' },
  { name: 'Lalitha Iyer', subject: 'Science' },
  { name: 'Vikram Desai', subject: 'Social Science' },
] as const;

const PERIOD_TIMES = [
  ['09:00', '09:45'],
  ['09:45', '10:30'],
  ['10:45', '11:30'],
  ['11:30', '12:15'],
  ['13:00', '13:45'],
  ['13:45', '14:30'],
  ['14:30', '15:15'],
  ['15:15', '16:00'],
] as const;

/** Fixed-date national/state holidays inside the academic year (no movable festivals guessed). */
const HOLIDAYS = [
  [`${AY_START}-08-15`, 'Independence Day'],
  [`${AY_START}-10-02`, 'Gandhi Jayanti'],
  [`${AY_START}-11-01`, 'Kannada Rajyotsava'],
  [`${AY_START}-12-25`, 'Christmas'],
  [`${AY_START + 1}-01-26`, 'Republic Day'],
] as const;

// ── Placeholder files ────────────────────────────────────────────────────────

/** A tiny dependency-free PNG: coloured page with ruled lines, enough to read as "a photo of a notebook/receipt". */
function placeholderPng(
  width: number,
  height: number,
  bg: [number, number, number],
  ink: [number, number, number],
): Buffer {
  const rowBytes = width * 3 + 1;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowBytes] = 0;
    const ruled = y > 40 && y % 28 === 0;
    const header = y > 12 && y < 30;
    for (let x = 0; x < width; x++) {
      const margin = x > 24 && x < 28;
      const c =
        ruled || margin || (header && x > 30 && x < width * 0.6) ? ink : bg;
      raw.set(c, y * rowBytes + 1 + x * 3);
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function pdf(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    build(doc);
    doc.end();
  });
}

class Uploader {
  private readonly s3: S3Client;
  private readonly bucket = process.env.S3_BUCKET_NAME ?? 'slink-assets';
  private disabled = process.env.DEMO_SEED_SKIP_FILES === 'true';
  uploaded = 0;
  skipped = 0;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    this.s3 = new S3Client({
      region: process.env.AWS_REGION ?? 'ap-south-1',
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }

  /** Uploads once; on the first failure, stops trying (data is still created). */
  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    if (this.disabled) {
      this.skipped++;
      return key;
    }
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      this.uploaded++;
    } catch (err) {
      console.warn(
        `S3 upload failed (${(err as Error).name}); continuing without files.`,
      );
      this.disabled = true;
      this.skipped++;
    }
    return key;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

type StudentRow = Prisma.StudentCreateManyInput & {
  id: string;
  name: string;
  classIndex: number;
  gender: Gender;
};

async function chunked<T>(
  rows: T[],
  size: number,
  write: (part: T[]) => Promise<unknown>,
) {
  for (let i = 0; i < rows.length; i += size)
    await write(rows.slice(i, i + size));
}

export async function seedDemo(prisma: PrismaClient) {
  const existing = await prisma.tenant.findUnique({
    where: { slug: DEMO_SLUG },
    select: { id: true, slug: true, features: true },
  });
  assertSafeToReset(existing);

  if (existing) {
    // Attendance rows reference users with ON DELETE RESTRICT, so clear them before the tenant cascade.
    await prisma.attendanceRecord.deleteMany({
      where: { tenantId: existing.id },
    });
    await prisma.tenant.delete({ where: { id: existing.id } });
    console.log('Removed previous demo school.');
  }

  const files = new Uploader();
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const tenant = await prisma.tenant.create({
    data: {
      slug: DEMO_SLUG,
      name: DEMO_SCHOOL_NAME,
      timezone: TIME_ZONE,
      primaryColor: '#123E3B',
      accentColor: '#E8623D',
      branding: {
        address: 'Hebbal, Bengaluru 560024',
        contactPhone: '+91 80 4000 1234',
        contactEmail: 'office@greenvalley.example',
      },
      features: {
        installmentPlans: false,
        inAppMessaging: false,
        transportFeeModule: true,
        photoGallery: false,
        isDemo: true,
      },
    },
  });
  const tenantId = tenant.id;

  // Staff
  const admin = {
    id: randomUUID(),
    tenantId,
    name: 'Gayathri Rao',
    email: 'admin@gvps-demo.in',
    role: Role.admin,
    passwordHash,
    isVerified: true,
  };
  const accountant = {
    id: randomUUID(),
    tenantId,
    name: 'Manjunath Bhat',
    email: 'accounts@gvps-demo.in',
    role: Role.accounts,
    passwordHash,
    isVerified: true,
  };
  const teachers = TEACHERS.map((t, i) => ({
    id: randomUUID(),
    tenantId,
    name: t.name,
    // Teacher 7 (Class 5's class teacher) is the documented demo teacher login.
    phone:
      i === 6 ? '+919999900002' : `+91980010${String(i + 10).padStart(4, '0')}`,
    email:
      i === 6
        ? 'teacher@gvps-demo.in'
        : `${t.name.split(' ')[0].toLowerCase()}@gvps-demo.in`,
    role: Role.teacher,
    passwordHash,
    isVerified: true,
  }));
  await prisma.user.createMany({ data: [admin, accountant, ...teachers] });

  // Subjects, classes, class teachers
  const subjectIds = new Map<string, string>(
    SUBJECTS.map((s) => [s, randomUUID()]),
  );
  await prisma.subject.createMany({
    data: SUBJECTS.map((name) => ({
      id: subjectIds.get(name)!,
      tenantId,
      name,
    })),
  });

  const classIds = CLASSES.map(() => randomUUID());
  await prisma.class.createMany({
    data: CLASSES.map((c, i) => ({
      id: classIds[i],
      tenantId,
      name: c.name,
      section: 'A',
      academicYear: ACADEMIC_YEAR,
    })),
  });
  // Class teacher per class (index into TEACHERS). Teacher 6 — the documented demo teacher — is Class 5's.
  const ctIndex = [0, 1, 2, 3, 4, 5, 6, 9, 10, 11];

  // Timetable: periods 1–7, Mon–Sat; teacher = (class + period + day) % 12 keeps every teacher in one room at a time.
  const slots: Prisma.TimetableSlotCreateManyInput[] = [];
  const teaches = new Set<string>();
  for (let ci = 0; ci < CLASSES.length; ci++) {
    for (let day = 1; day <= 6; day++) {
      for (let period = 1; period <= 7; period++) {
        const ti = (ci + period + day) % 12;
        const subject = TEACHERS[ti].subject;
        slots.push({
          tenantId,
          teacherId: teachers[ti].id,
          classId: classIds[ci],
          subjectId: subjectIds.get(subject)!,
          dayOfWeek: day,
          periodNumber: period,
        });
        teaches.add(`${ti}|${ci}`);
      }
    }
  }
  await prisma.timetableSlot.createMany({ data: slots });
  await prisma.periodTiming.createMany({
    data: PERIOD_TIMES.map(([startTime, endTime], i) => ({
      tenantId,
      periodNumber: i + 1,
      startTime,
      endTime,
    })),
  });
  await prisma.teacherSubject.createMany({
    data: [...teaches].map((key) => {
      const [ti, ci] = key.split('|').map(Number);
      return {
        tenantId,
        teacherId: teachers[ti].id,
        subjectId: subjectIds.get(TEACHERS[ti].subject)!,
        classId: classIds[ci],
      };
    }),
  });
  const classTeacherLinks = new Map<string, boolean>();
  for (const key of teaches) {
    const [ti, ci] = key.split('|').map(Number);
    classTeacherLinks.set(`${ti}|${ci}`, false);
  }
  CLASSES.forEach((_, ci) =>
    classTeacherLinks.set(`${ctIndex[ci]}|${ci}`, true),
  );
  await prisma.classTeacher.createMany({
    data: [...classTeacherLinks].map(([key, isClassTeacher]) => {
      const [ti, ci] = key.split('|').map(Number);
      return {
        teacherId: teachers[ti].id,
        classId: classIds[ci],
        isClassTeacher,
      };
    }),
  });

  // Transport slabs & discounts
  const slabs = [
    {
      id: randomUUID(),
      tenantId,
      minDistanceKm: new Prisma.Decimal(0),
      maxDistanceKm: new Prisma.Decimal(3),
      monthlyAmount: new Prisma.Decimal(500),
    },
    {
      id: randomUUID(),
      tenantId,
      minDistanceKm: new Prisma.Decimal(3),
      maxDistanceKm: new Prisma.Decimal(7),
      monthlyAmount: new Prisma.Decimal(600),
    },
    {
      id: randomUUID(),
      tenantId,
      minDistanceKm: new Prisma.Decimal(7),
      maxDistanceKm: new Prisma.Decimal(12),
      monthlyAmount: new Prisma.Decimal(700),
    },
  ];
  await prisma.transportSlab.createMany({ data: slabs });
  const siblingDiscount = {
    id: randomUUID(),
    tenantId,
    name: 'Sibling Discount',
    kind: DiscountKind.percentage,
  };
  const staffDiscount = {
    id: randomUUID(),
    tenantId,
    name: 'Staff Ward',
    kind: DiscountKind.fixed_amount,
  };
  await prisma.discountType.createMany({
    data: [siblingDiscount, staffDiscount],
  });

  // Students & parents. Sibling pairs share a parent; pair 0 is the documented demo parent (Class 5 + Class 2).
  const students: StudentRow[] = [];
  const parents: Prisma.UserCreateManyInput[] = [];
  const links: Prisma.StudentParentCreateManyInput[] = [];
  let admission = 1;
  const usedNames = new Set<string>();
  const freshName = (gender: Gender, surname: string) => {
    for (;;) {
      const name = `${gender === Gender.male ? pick(BOYS) : pick(GIRLS)} ${surname}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
  };
  for (let ci = 0; ci < CLASSES.length; ci++) {
    for (let k = 0; k < STUDENTS_PER_CLASS; k++) {
      const gender = chance(0.5) ? Gender.male : Gender.female;
      const surname = pick(SURNAMES);
      const ageYears = 4 + ci;
      students.push({
        id: randomUUID(),
        tenantId,
        name: freshName(gender, surname),
        admissionNo: `GV-${AY_START - (ci > 1 ? between(0, Math.min(ci, 6)) : 0)}-${String(admission++).padStart(4, '0')}`,
        classId: classIds[ci],
        classIndex: ci,
        gender,
        dob: dbDate(
          `${AY_START - ageYears}-${String(between(1, 12)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}`,
        ),
        transportSlabId: chance(0.1) ? pick(slabs).id : null,
      });
    }
  }
  // Roll numbers: alphabetical within each class.
  for (let ci = 0; ci < CLASSES.length; ci++) {
    students
      .filter((s) => s.classIndex === ci)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((s, i) => (s.rollNo = String(i + 1)));
  }

  // Five+ sibling pairs (younger child shares the older child's surname and parent).
  const SIBLING_PAIRS: [number, number][] = [
    [6, 3], // demo parent: Class 5 + Class 2
    [9, 4],
    [8, 2],
    [7, 1],
    [5, 0],
    [4, 2],
  ];
  const siblingOf = new Map<string, string>(); // younger id -> older id
  SIBLING_PAIRS.forEach(([olderClass, youngerClass], pairIndex) => {
    const older = students.filter((s) => s.classIndex === olderClass)[
      pairIndex
    ];
    const younger = students.filter((s) => s.classIndex === youngerClass)[
      pairIndex + 10
    ];
    const surname = older.name.split(' ').slice(1).join(' ');
    usedNames.delete(younger.name);
    younger.name = freshName(younger.gender, surname);
    siblingOf.set(younger.id, older.id);
  });
  const demoParentChildren = new Set<string>();

  const parentOf = new Map<string, string>();
  const relationOf = new Map<string, GuardianRelation>();
  let parentPhone = 1;
  // Younger siblings are in lower classes (earlier in the list), so give every other child a parent first.
  for (const s of students) {
    if (siblingOf.has(s.id)) continue;
    const surname = s.name.split(' ').slice(1).join(' ');
    const isFather = chance(0.6);
    const id = randomUUID();
    relationOf.set(
      id,
      isFather ? GuardianRelation.father : GuardianRelation.mother,
    );
    // The oldest child of sibling pair 0 anchors the documented demo parent.
    const isDemoParent =
      students.filter((x) => x.classIndex === SIBLING_PAIRS[0][0])[0].id ===
      s.id;
    parents.push({
      id,
      tenantId,
      name: `${isFather ? pick(FATHERS) : pick(MOTHERS)} ${surname}`,
      phone: isDemoParent
        ? '+919999900001'
        : `+91981${String(parentPhone++).padStart(7, '0')}`,
      role: Role.parent,
      profession: pick(PROFESSIONS),
      isVerified: true,
    });
    parentOf.set(s.id, id);
    if (isDemoParent) demoParentChildren.add(s.id);
  }
  for (const [younger, older] of siblingOf) {
    parentOf.set(younger, parentOf.get(older)!);
    if (demoParentChildren.has(older)) demoParentChildren.add(younger);
  }

  await chunked(
    students.map((row) => {
      const { classIndex, ...student } = row;
      void classIndex;
      return student;
    }),
    500,
    (part) => prisma.student.createMany({ data: part }),
  );
  await chunked(parents, 500, (part) => prisma.user.createMany({ data: part }));
  for (const s of students) {
    const parentId = parentOf.get(s.id)!;
    links.push({
      studentId: s.id,
      parentId,
      relation: relationOf.get(parentId)!,
      isPrimary: true,
    });
  }
  await chunked(links, 1000, (part) =>
    prisma.studentParent.createMany({ data: part }),
  );

  // Sibling discount: 10% on the younger child's tuition.
  const discounted = new Set(siblingOf.keys());
  await prisma.studentDiscount.createMany({
    data: [...discounted].map((studentId) => ({
      tenantId,
      studentId,
      discountTypeId: siblingDiscount.id,
      percentage: new Prisma.Decimal(10),
      reason: 'Sibling studying in the school',
    })),
  });

  // ── Fees ──────────────────────────────────────────────────────────────────
  const term1Due = dbDate(`${AY_START}-06-15`);
  const term2Due = dbDate(`${AY_START}-10-15`);
  const transportDue = dbDate(`${AY_START}-07-10`);

  type Plan = {
    id: string;
    itemId: string;
    classIndex: number | null;
    name: string;
    due: Date;
    amount: number;
    transport: boolean;
  };
  const plans: Plan[] = [];
  CLASSES.forEach((c, ci) => {
    plans.push({
      id: randomUUID(),
      itemId: randomUUID(),
      classIndex: ci,
      name: `Term 1 Tuition — ${c.name}`,
      due: term1Due,
      amount: c.tuition,
      transport: false,
    });
    plans.push({
      id: randomUUID(),
      itemId: randomUUID(),
      classIndex: ci,
      name: `Term 2 Tuition — ${c.name}`,
      due: term2Due,
      amount: c.tuition,
      transport: false,
    });
  });
  const transportPlan: Plan = {
    id: randomUUID(),
    itemId: randomUUID(),
    classIndex: null,
    name: 'School Transport (Annual)',
    due: transportDue,
    amount: 6000,
    transport: true,
  };
  plans.push(transportPlan);

  await prisma.feeStructure.createMany({
    data: plans.map((p) => ({
      id: p.id,
      tenantId,
      name: p.name,
      totalAmount: new Prisma.Decimal(p.amount),
      dueDate: p.due,
      academicYear: ACADEMIC_YEAR,
    })),
  });
  await prisma.feeItem.createMany({
    data: plans.map((p) => ({
      id: p.itemId,
      feeStructureId: p.id,
      label: p.transport ? 'Transport' : 'Tuition',
      amount: new Prisma.Decimal(p.amount),
      billingFrequency: BillingFrequency.one_time,
      isTransportFee: p.transport,
    })),
  });
  await prisma.feeStructureClass.createMany({
    data: [
      ...plans
        .filter((p) => p.classIndex !== null)
        .map((p) => ({
          feeStructureId: p.id,
          classId: classIds[p.classIndex!],
        })),
      ...classIds.map((classId) => ({
        feeStructureId: transportPlan.id,
        classId,
      })),
    ],
  });

  // Payment profile: ~80% fully paid, ~15% partial, ~5% overdue (nothing paid on Term 1).
  const profileOf = new Map<string, 'paid' | 'partial' | 'overdue'>();
  for (const s of students) {
    const r = rand();
    profileOf.set(
      s.id,
      demoParentChildren.has(s.id)
        ? s.classIndex === 6
          ? 'partial'
          : 'paid'
        : r < 0.8
          ? 'paid'
          : r < 0.95
            ? 'partial'
            : 'overdue',
    );
  }

  const studentFees: Prisma.StudentFeeCreateManyInput[] = [];
  const components: (Prisma.StudentFeeComponentCreateManyInput & {
    id: string;
  })[] = [];
  const receipts: Prisma.ReceiptCreateManyInput[] = [];
  const allocations: Prisma.ReceiptAllocationCreateManyInput[] = [];
  let receiptSeq = 0;
  const methodFor = () => {
    const r = rand();
    return r < 0.45
      ? PaymentMethod.gateway
      : r < 0.8
        ? PaymentMethod.cash
        : r < 0.92
          ? PaymentMethod.cheque
          : PaymentMethod.bank_transfer;
  };
  const payDate = (due: Date) => {
    const d = addDays(due, between(-25, 20));
    return d > today ? addDays(today, -between(0, 5)) : d;
  };
  const feeByStudentPlan = new Map<
    string,
    { feeId: string; componentId: string; due: number; paid: number }
  >();

  for (const s of students) {
    const profile = profileOf.get(s.id)!;
    const myPlans = plans.filter((p) =>
      p.transport ? !!s.transportSlabId : p.classIndex === s.classIndex,
    );
    for (const plan of myPlans) {
      const slab = plan.transport
        ? slabs.find((x) => x.id === s.transportSlabId)
        : undefined;
      const [component] = explodeFeeItem(
        {
          id: plan.itemId,
          amount: new Prisma.Decimal(plan.amount),
          billingFrequency: BillingFrequency.one_time,
          quarterMonthCounts: [],
          isTransportFee: plan.transport,
        },
        ACADEMIC_YEAR,
        plan.due,
        slab?.monthlyAmount,
      );
      let due = component.amountDue.toNumber();
      if (!plan.transport && discounted.has(s.id)) due = Math.round(due * 0.9);

      let paid = 0;
      const isTerm1 = plan.due.getTime() === term1Due.getTime();
      if (profile === 'paid') paid = due;
      else if (profile === 'partial')
        paid = isTerm1 ? Math.round(due * 0.5) : 0;
      // 'overdue' pays nothing at all.

      const feeId = randomUUID();
      const componentId = randomUUID();
      const statusFor = (
        amountDue: number,
        amountPaid: number,
        dueDate: Date,
      ) =>
        amountPaid >= amountDue
          ? FeeStatus.paid
          : amountPaid > 0
            ? FeeStatus.partial
            : dueDate < today
              ? FeeStatus.overdue
              : FeeStatus.pending;
      studentFees.push({
        id: feeId,
        tenantId,
        studentId: s.id,
        feeStructureId: plan.id,
        amountDue: new Prisma.Decimal(due),
        amountPaid: new Prisma.Decimal(paid),
        status: statusFor(due, paid, plan.due),
        dueDate: plan.due,
      });
      components.push({
        id: componentId,
        studentFeeId: feeId,
        feeItemId: plan.itemId,
        periodLabel: component.periodLabel,
        periodStart: component.periodStart,
        periodEnd: component.periodEnd,
        dueDate: component.dueDate,
        amountDue: new Prisma.Decimal(due),
        amountPaid: new Prisma.Decimal(paid),
        status: statusFor(due, paid, plan.due),
      });
      feeByStudentPlan.set(`${s.id}|${plan.id}`, {
        feeId,
        componentId,
        due,
        paid,
      });

      if (paid > 0) {
        const method = methodFor();
        const receiptId = randomUUID();
        const paidOn = payDate(plan.due);
        receiptSeq++;
        receipts.push({
          id: receiptId,
          tenantId,
          receiptNumber: `${DEMO_SLUG.toUpperCase()}-${paidOn.getUTCFullYear()}-${String(receiptSeq).padStart(5, '0')}`,
          studentFeeId: feeId,
          studentId: s.id,
          classId: classIds[s.classIndex],
          amount: new Prisma.Decimal(paid),
          method,
          reference:
            method === PaymentMethod.cheque
              ? `CHQ ${between(100000, 999999)}`
              : method === PaymentMethod.bank_transfer
                ? `UTR${between(100000000, 999999999)}`
                : null,
          paidOn,
          recordedBy: method === PaymentMethod.gateway ? null : accountant.id,
          ...(discounted.has(s.id) && !plan.transport
            ? {
                discountTypeId: siblingDiscount.id,
                discountAmount: new Prisma.Decimal(
                  Math.round(plan.amount * 0.1),
                ),
                discountNote: 'Sibling discount (10%)',
              }
            : {}),
          createdAt: atIst(paidOn, between(9, 17), between(0, 59)),
        });
        allocations.push({
          receiptId,
          studentFeeComponentId: componentId,
          amount: new Prisma.Decimal(paid),
        });
      }
    }
  }
  await chunked(studentFees, 1000, (part) =>
    prisma.studentFee.createMany({ data: part }),
  );
  await chunked(components, 1000, (part) =>
    prisma.studentFeeComponent.createMany({ data: part }),
  );
  await chunked(receipts, 1000, (part) =>
    prisma.receipt.createMany({ data: part }),
  );
  await chunked(allocations, 1000, (part) =>
    prisma.receiptAllocation.createMany({ data: part }),
  );

  // ── Payment claims: pending (with proof), approved (linked to a receipt), one rejected ──
  const proofKeys: string[] = [];
  for (let i = 0; i < 3; i++) {
    proofKeys.push(
      await files.put(
        `private/${tenantId}/payment-claims/demo-proof-${i + 1}.png`,
        placeholderPng(480, 640, [252, 250, 245], [70, 90, 140]),
        'image/png',
      ),
    );
  }
  const owing = students.filter((s) => profileOf.get(s.id) !== 'paid');
  const claims: Prisma.PaymentClaimCreateManyInput[] = [];
  const term2PlanFor = (s: StudentRow) =>
    plans.find(
      (p) =>
        p.classIndex === s.classIndex && p.due.getTime() === term2Due.getTime(),
    )!;
  owing.slice(0, 5).forEach((s, i) => {
    const fee = feeByStudentPlan.get(`${s.id}|${term2PlanFor(s).id}`)!;
    claims.push({
      tenantId,
      studentId: s.id,
      studentFeeId: fee.feeId,
      submittedBy: parentOf.get(s.id)!,
      fileKey: proofKeys[i % proofKeys.length],
      claimedAmount: new Prisma.Decimal(fee.due - fee.paid),
      claimedDate: addDays(today, -between(1, 4)),
      claimedMode: [
        ClaimPaymentMode.cash,
        ClaimPaymentMode.upi,
        ClaimPaymentMode.cheque,
      ][i % 3],
      note: [
        'Paid at the office counter',
        'Paid via UPI to school account',
        'Cheque dropped in the office box',
      ][i % 3],
      status: PaymentClaimStatus.pending,
      createdAt: atIst(
        addDays(today, -between(0, 3)),
        between(8, 20),
        between(0, 59),
      ),
    });
  });
  // Approved claims point at receipts that already exist (paid students' Term 2 receipts).
  const paidStudents = students.filter(
    (s) => profileOf.get(s.id) === 'paid' && !demoParentChildren.has(s.id),
  );
  for (const s of paidStudents.slice(0, 3)) {
    const fee = feeByStudentPlan.get(`${s.id}|${term2PlanFor(s).id}`)!;
    const receipt = receipts.find((r) => r.studentFeeId === fee.feeId)!;
    claims.push({
      tenantId,
      studentId: s.id,
      studentFeeId: fee.feeId,
      submittedBy: parentOf.get(s.id)!,
      fileKey: proofKeys[0],
      claimedAmount: new Prisma.Decimal(fee.due),
      claimedDate: receipt.paidOn,
      claimedMode: ClaimPaymentMode.upi,
      status: PaymentClaimStatus.approved,
      reviewedBy: accountant.id,
      reviewedAt: addDays(new Date(receipt.paidOn), 1),
      receiptId: receipt.id,
      createdAt: atIst(new Date(receipt.paidOn), 19, 10),
    });
  }
  const rejectedFor = owing[6] ?? owing[0];
  claims.push({
    tenantId,
    studentId: rejectedFor.id,
    studentFeeId: feeByStudentPlan.get(
      `${rejectedFor.id}|${term2PlanFor(rejectedFor).id}`,
    )!.feeId,
    submittedBy: parentOf.get(rejectedFor.id)!,
    fileKey: proofKeys[2],
    claimedAmount: new Prisma.Decimal(1500),
    claimedDate: addDays(today, -9),
    claimedMode: ClaimPaymentMode.bank_transfer,
    status: PaymentClaimStatus.rejected,
    reviewedBy: accountant.id,
    reviewedAt: addDays(today, -8),
    reviewNote:
      'The screenshot does not show a transaction reference. Please upload the bank confirmation with the UTR number.',
    createdAt: atIst(addDays(today, -9), 18, 40),
  });
  await prisma.paymentClaim.createMany({ data: claims });

  // ── Holidays & attendance: last 30 school days at ~92%, a few classes unmarked today ──
  await prisma.schoolHoliday.createMany({
    data: HOLIDAYS.map(([date, name]) => ({
      tenantId,
      date: dbDate(date),
      name,
    })),
  });
  const holidaySet = new Set<string>(HOLIDAYS.map(([d]) => d));
  const schoolDays: Date[] = [];
  for (let d = addDays(today, -1); schoolDays.length < 30; d = addDays(d, -1)) {
    if (d.getUTCDay() !== 0 && !holidaySet.has(ymd(d))) schoolDays.push(d);
  }
  const todayIsSchoolDay = today.getUTCDay() !== 0 && !holidaySet.has(todayYmd);
  const unmarkedToday = new Set([1, 4, 8]); // UKG, Class 3, Class 7 still to mark
  const frequentAbsentees = new Set(
    students.filter(() => chance(0.04)).map((s) => s.id),
  );
  const attendance: Prisma.AttendanceRecordCreateManyInput[] = [];
  const statusFor = (studentId: string) => {
    const r = rand();
    const absentP = frequentAbsentees.has(studentId) ? 0.2 : 0.055;
    return r < absentP
      ? AttendanceStatus.absent
      : r < absentP + 0.02
        ? AttendanceStatus.leave
        : r < absentP + 0.045
          ? AttendanceStatus.late
          : AttendanceStatus.present;
  };
  const markDay = (day: Date, isToday: boolean) => {
    for (const s of students) {
      if (isToday && unmarkedToday.has(s.classIndex)) continue;
      const status = statusFor(s.id);
      attendance.push({
        tenantId,
        classId: classIds[s.classIndex],
        studentId: s.id,
        date: day,
        status,
        markedBy: teachers[ctIndex[s.classIndex]].id,
        markedAt: atIst(day, 9, between(5, 25)),
        absenceAlertSent: status === AttendanceStatus.absent,
      });
    }
  };
  schoolDays.forEach((d) => markDay(d, false));
  if (todayIsSchoolDay) markDay(today, true);
  await chunked(attendance, 2000, (part) =>
    prisma.attendanceRecord.createMany({ data: part }),
  );

  // ── Homework (photos), notices (one with a PDF), seen tracking ──
  const homeworkPhotoKeys: string[] = [];
  const PAPER: [number, number, number][] = [
    [250, 248, 240],
    [245, 250, 255],
    [255, 252, 238],
  ];
  for (let i = 0; i < 4; i++) {
    homeworkPhotoKeys.push(
      await files.put(
        `private/${tenantId}/attachments/demo-homework-${i + 1}.png`,
        placeholderPng(640, 480, PAPER[i % 3], [60, 60, 70]),
        'image/png',
      ),
    );
  }
  const circular = await pdf((doc) => {
    doc.fontSize(20).text(DEMO_SCHOOL_NAME, { align: 'center' }).moveDown();
    doc
      .fontSize(14)
      .text('Circular: Parent–Teacher Meeting', { align: 'center' })
      .moveDown();
    doc
      .fontSize(11)
      .text(
        'Dear Parents, the Term 1 Parent–Teacher Meeting will be held on Saturday from 9:30 am to 12:30 pm. Please collect the progress report from the class teacher. — Principal',
      );
  });
  const circularKey = await files.put(
    `private/${tenantId}/attachments/demo-ptm-circular.pdf`,
    circular,
    'application/pdf',
  );

  const parentsOfClass = (ci: number) => [
    ...new Set(
      students
        .filter((s) => s.classIndex === ci)
        .map((s) => parentOf.get(s.id)!),
    ),
  ];
  const broadcasts: Prisma.BroadcastCreateManyInput[] = [];
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  const reports: Prisma.ReportCreateManyInput[] = [];
  const HOMEWORK = [
    'Complete exercise 4.2, questions 1 to 10.',
    'Learn the poem and write the first two stanzas.',
    'Draw and label the parts of a plant.',
    'Read chapter 5 and answer the questions at the end.',
    'Practise the multiplication tables of 7 and 8.',
    'Write a paragraph on "My Favourite Festival".',
    'Revise the map work done in class.',
  ];
  const fan = (
    b: Prisma.BroadcastCreateManyInput,
    recipients: string[],
    data: Record<string, string>,
    seenRate: number,
  ) => {
    for (const userId of recipients) {
      const seen = chance(seenRate);
      notifications.push({
        tenantId,
        userId,
        channel: NotificationChannel.fcm,
        title: b.title,
        body: b.body,
        data: { ...data, broadcastId: b.id as string },
        status: NotificationStatus.sent,
        sentAt: b.createdAt,
        createdAt: b.createdAt,
        broadcastId: b.id,
        seenAt: seen
          ? new Date(
              (b.createdAt as Date).getTime() + between(10, 600) * 60_000,
            )
          : null,
      });
    }
  };
  const homeworkDays = [
    ...(todayIsSchoolDay ? [today] : []),
    ...schoolDays.slice(0, 9),
  ];
  homeworkDays.forEach((day, di) => {
    for (let ci = 0; ci < CLASSES.length; ci++) {
      if (di > 0 && chance(0.4)) continue;
      const period = between(1, 7);
      const slot = slots.find(
        (x) =>
          x.classId === classIds[ci] &&
          x.dayOfWeek === day.getUTCDay() &&
          x.periodNumber === period,
      )!;
      const teacherIndex = teachers.findIndex((t) => t.id === slot.teacherId);
      const subject = TEACHERS[teacherIndex].subject;
      const photos = homeworkPhotoKeys
        .slice(0, between(1, 2))
        .map((key) => ({ key, contentType: 'image/png' }));
      const id = randomUUID();
      const createdAt = atIst(day, between(13, 16), between(0, 59));
      const body = pick(HOMEWORK);
      broadcasts.push({
        id,
        tenantId,
        senderId: slot.teacherId,
        classId: classIds[ci],
        subjectId: subjectIds.get(subject),
        kind: BroadcastKind.homework,
        title: 'Homework',
        body,
        attachments: photos,
        createdAt,
      });
      fan(
        broadcasts[broadcasts.length - 1],
        parentsOfClass(ci),
        { type: 'homework', classId: classIds[ci] },
        di === 0 ? 0.55 : 0.85,
      );
      for (const s of students.filter((x) => x.classIndex === ci)) {
        reports.push({
          tenantId,
          studentId: s.id,
          classId: classIds[ci],
          teacherId: slot.teacherId,
          type: ReportType.homework,
          term: ymd(day),
          academicYear: ACADEMIC_YEAR,
          content: {
            caption: body,
            fileKey: photos[0].key,
            fileKeys: photos.map((p) => p.key),
            attachmentUrl: null,
            broadcastId: id,
            subject,
          },
          status: ReportStatus.published,
          publishedAt: createdAt,
          createdAt,
        });
      }
    }
  });

  const NOTICES: {
    ci: number | null;
    title: string;
    body: string;
    daysAgo: number;
    pdf?: boolean;
  }[] = [
    {
      ci: null,
      title: 'Parent–Teacher Meeting',
      body: 'The Term 1 PTM is on Saturday, 9:30 am–12:30 pm. Please see the attached circular.',
      daysAgo: 2,
      pdf: true,
    },
    {
      ci: null,
      title: 'Fee reminder',
      body: 'Term 2 fees are due on 15 October. Pay online in the app or at the office.',
      daysAgo: 6,
    },
    {
      ci: 6,
      title: 'Science exhibition',
      body: 'Class 5 students will present projects next Friday. Please send materials by Wednesday.',
      daysAgo: 4,
    },
    {
      ci: 3,
      title: 'Field trip',
      body: 'Class 2 will visit the Lalbagh Botanical Garden on Thursday. Lunch will be provided.',
      daysAgo: 8,
    },
    {
      ci: 9,
      title: 'Unit test schedule',
      body: 'Class 8 unit tests start Monday. The schedule has been shared in class.',
      daysAgo: 10,
    },
    {
      ci: 0,
      title: 'Colour day',
      body: 'LKG will celebrate Yellow Day on Friday — please dress your child in yellow.',
      daysAgo: 12,
    },
  ];
  for (const n of NOTICES) {
    const id = randomUUID();
    const createdAt = atIst(addDays(today, -n.daysAgo), 11, 15);
    const sender = n.ci === null ? admin.id : teachers[ctIndex[n.ci]].id;
    broadcasts.push({
      id,
      tenantId,
      senderId: sender,
      classId: n.ci === null ? null : classIds[n.ci],
      kind: BroadcastKind.notice,
      title: n.title,
      body: n.body,
      attachments: n.pdf
        ? [{ key: circularKey, contentType: 'application/pdf' }]
        : [],
      createdAt,
    });
    const recipients =
      n.ci === null ? parents.map((p) => p.id as string) : parentsOfClass(n.ci);
    fan(
      broadcasts[broadcasts.length - 1],
      recipients,
      { type: 'notice', ...(n.ci === null ? {} : { classId: classIds[n.ci] }) },
      0.8,
    );
  }
  await prisma.broadcast.createMany({ data: broadcasts });
  await chunked(notifications, 2000, (part) =>
    prisma.notification.createMany({ data: part }),
  );

  // ── Report cards (PDF), progress reports, read receipts ──
  const reportCardStudents = [
    ...students.filter((s) => demoParentChildren.has(s.id)),
    ...students.filter((s) => s.classIndex === 9).slice(0, 8),
  ];
  for (const s of reportCardStudents) {
    const reportId = randomUUID();
    const body = await pdf((doc) => {
      doc.fontSize(20).text(DEMO_SCHOOL_NAME, { align: 'center' });
      doc
        .fontSize(14)
        .text(`Report Card — Term 1, ${ACADEMIC_YEAR}`, { align: 'center' })
        .moveDown();
      doc
        .fontSize(12)
        .text(`Student: ${s.name}`)
        .text(`Class: ${CLASSES[s.classIndex].name} A`)
        .text(`Roll No: ${s.rollNo}`)
        .moveDown();
      for (const subject of SUBJECTS.slice(0, 6))
        doc.text(`${subject.padEnd(20, ' ')} ${between(62, 98)} / 100`);
      doc
        .moveDown()
        .text('Remarks: Attentive in class and participates well. Keep it up!');
    });
    const key = await files.put(
      `private/${tenantId}/reports/${reportId}/report-card.pdf`,
      body,
      'application/pdf',
    );
    const publishedAt = atIst(addDays(today, -between(5, 15)), 16, 0);
    reports.push({
      id: reportId,
      tenantId,
      studentId: s.id,
      classId: classIds[s.classIndex],
      teacherId: teachers[ctIndex[s.classIndex]].id,
      type: ReportType.report_card,
      term: 'Term 1',
      academicYear: ACADEMIC_YEAR,
      content: {},
      pdfKey: key,
      status: ReportStatus.published,
      publishedAt,
      createdAt: publishedAt,
    });
  }
  const progressIds: { id: string; studentId: string }[] = [];
  for (const s of students.filter((x) => x.classIndex >= 5 && chance(0.25))) {
    const id = randomUUID();
    const publishedAt = atIst(addDays(today, -between(3, 25)), 15, 30);
    progressIds.push({ id, studentId: s.id });
    reports.push({
      id,
      tenantId,
      studentId: s.id,
      classId: classIds[s.classIndex],
      teacherId: teachers[ctIndex[s.classIndex]].id,
      type: pick([
        ReportType.academic,
        ReportType.academic,
        ReportType.behavior,
      ]),
      term: 'Term 1',
      academicYear: ACADEMIC_YEAR,
      content: {
        summary: pick([
          'Steady progress in all subjects.',
          'Strong in Mathematics; needs more reading practice.',
          'Very good participation in class activities.',
          'Should complete homework on time.',
        ]),
        grades: Object.fromEntries(
          SUBJECTS.slice(0, 5).map((sub) => [
            sub,
            pick(['A+', 'A', 'B+', 'B']),
          ]),
        ),
      },
      status: ReportStatus.published,
      publishedAt,
      createdAt: publishedAt,
    });
  }
  await chunked(reports, 2000, (part) =>
    prisma.report.createMany({ data: part }),
  );
  await prisma.reportReadReceipt.createMany({
    data: progressIds
      .filter(() => chance(0.65))
      .map((r) => ({ reportId: r.id, userId: parentOf.get(r.studentId)! })),
  });

  // ── Student notes (internal only) ──
  const NOTES: [StudentNoteType, string][] = [
    [
      StudentNoteType.note,
      'Showed good improvement in handwriting this month.',
    ],
    [
      StudentNoteType.mom,
      'Met parents about frequent late arrivals; agreed the child will take the earlier school bus.',
    ],
    [
      StudentNoteType.complaint,
      'Parent raised a concern about a lost water bottle; checked with the class, not found yet.',
    ],
    [
      StudentNoteType.parent_discussion,
      'Discussed extra reading support at home; parent will read with the child for 20 minutes daily.',
    ],
    [StudentNoteType.note, 'Represented the class in the inter-house quiz.'],
  ];
  await prisma.studentNote.createMany({
    data: students
      .filter(() => chance(0.08))
      .map((s) => {
        const [type, content] = pick(NOTES);
        return {
          tenantId,
          studentId: s.id,
          authorId: teachers[ctIndex[s.classIndex]].id,
          type,
          content,
          createdAt: atIst(addDays(today, -between(1, 40)), 15, 45),
        };
      }),
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { receiptSequence: receiptSeq },
  });

  // Summary (aggregates only — never credentials).
  const due = studentFees.reduce((s, f) => s + Number(f.amountDue), 0);
  const collected = studentFees.reduce((s, f) => s + Number(f.amountPaid), 0);
  const marked = attendance.length;
  const present = attendance.filter(
    (a) =>
      a.status === AttendanceStatus.present ||
      a.status === AttendanceStatus.late,
  ).length;
  const lakh = (n: number) => `₹${(n / 100000).toFixed(2)} lakh`;
  console.log(
    [
      `Demo school ready: ${DEMO_SCHOOL_NAME} (school code: ${DEMO_SLUG}, ${ACADEMIC_YEAR})`,
      `  ${CLASSES.length} classes · ${students.length} students · ${parents.length} parents · ${teachers.length} teachers · ${SIBLING_PAIRS.length} sibling pairs`,
      `  Fees: ${lakh(collected)} collected · ${lakh(due - collected)} outstanding (of ${lakh(due)})`,
      `  ${receipts.length} receipts · ${claims.length} payment claims · ${broadcasts.length} homework/notices · ${reports.length} reports`,
      `  Attendance: ${((present / marked) * 100).toFixed(1)}% over ${schoolDays.length} school days${todayIsSchoolDay ? `; ${unmarkedToday.size} classes not yet marked today` : ''}`,
      `  Files: ${files.uploaded} uploaded, ${files.skipped} skipped`,
      `  Logins: see apps/api/prisma/DEMO_SEED.md`,
    ].join('\n'),
  );
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDemo(prisma)
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
