import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { StudentsService } from './students.service';
import { studentPhotoKey } from '../files/files.service';
import type { ActiveUser } from '../../common/types/active-user.type';

const T = 'tenant-1';
const KEY = `private/${T}/students/s1/photo-uuid.jpg`;
/** What the console used to save: a 15-minute signed URL of the key. */
const OLD_SIGNED = `https://bucket.s3.ap-south-1.amazonaws.com/${KEY}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=abc`;

describe('studentPhotoKey', () => {
  it('accepts a stored key and recovers the key from an old signed URL', () => {
    expect(studentPhotoKey(KEY, T)).toBe(KEY);
    expect(studentPhotoKey(OLD_SIGNED, T)).toBe(KEY);
    // Path-style (custom S3 endpoint) URLs too.
    expect(
      studentPhotoKey(
        `https://s3.example.com/bucket/${KEY}?X-Amz-Signature=x`,
        T,
      ),
    ).toBe(KEY);
  });

  it("ignores other schools' photos, other files and external URLs", () => {
    expect(studentPhotoKey(`private/other/students/s1/p.jpg`, T)).toBeNull();
    expect(studentPhotoKey(`private/${T}/documents/d.pdf`, T)).toBeNull();
    expect(studentPhotoKey('https://example.com/kid.jpg', T)).toBeNull();
    expect(studentPhotoKey('not a url', T)).toBeNull();
  });
});

describe('StudentsService photos', () => {
  const admin: ActiveUser = {
    id: 'a1',
    tenantId: T,
    role: Role.admin,
    name: 'Admin',
    isVerified: true,
  };

  function setup(photoUrl: string | null) {
    const row = {
      id: 's1',
      tenantId: T,
      classId: 'c1',
      photoUrl,
      parents: [],
      customFieldValues: [],
    };
    const prisma = {
      student: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue({ ...row, photoUrl: KEY }),
      },
    };
    const files = {
      studentPhotoUrl: jest.fn(async (stored: string) =>
        studentPhotoKey(stored, T)
          ? `https://fresh/${studentPhotoKey(stored, T)}`
          : stored,
      ),
    };
    return {
      prisma,
      files,
      service: new StudentsService(prisma as never, files as never),
    };
  }

  it('returns a fresh URL for an expired one saved before the fix', async () => {
    const { service } = setup(OLD_SIGNED);
    const s = (await service.findOne(T, 's1', admin)) as { photoUrl: string };
    expect(s.photoUrl).toBe(`https://fresh/${KEY}`);
  });

  it('stores the key, not a URL, when a photo is saved', async () => {
    const { service, prisma } = setup(null);
    await service.update(T, 's1', { photoUrl: OLD_SIGNED });
    expect(prisma.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ photoUrl: KEY }),
      }),
    );
  });

  it("refuses a key that isn't one of this school's student photos", async () => {
    const { service } = setup(null);
    await expect(
      service.update(T, 's1', { photoUrl: `private/${T}/documents/d.pdf` }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
