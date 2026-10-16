import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { StaffDocumentsService } from './staff-documents.service';
import { isModuleOwnedKey } from '../files/files.service';
import { FileCategory } from '../files/dto/upload-file.dto';
import type { ActiveUser } from '../../common/types/active-user.type';

const T = 'tenant-1';
const user = (id: string, role: Role): ActiveUser => ({
  id,
  tenantId: T,
  role,
  name: id,
  isVerified: true,
});
const teacherA = user('ta', Role.teacher);
const teacherB = user('tb', Role.teacher);
const admin = user('ad', Role.admin);

function setup() {
  const folder = {
    id: 'f1',
    tenantId: T,
    name: 'Lesson plans',
    createdBy: 'ta',
  };
  const file = {
    id: 'x1',
    tenantId: T,
    folderId: 'f1',
    fileKey: `private/${T}/staff-docs/f1/u.pdf`,
    fileName: 'Week 1.pdf',
    contentType: 'application/pdf',
    size: 10,
    uploadedBy: 'ta',
    createdAt: new Date('2026-10-01T00:00:00Z'),
  };
  const prisma = {
    staffFolder: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { ...folder, createdAt: new Date(), _count: { files: 1 } },
        ]),
      findFirst: jest.fn().mockResolvedValue(folder),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    staffFile: {
      findMany: jest.fn().mockResolvedValue([file]),
      findFirst: jest.fn().mockResolvedValue(file),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue(file),
      delete: jest.fn(),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: 'ta', name: 'Asha' }]),
    },
  };
  const files = {
    upload: jest.fn().mockResolvedValue({
      key: file.fileKey,
      size: 10,
      contentType: 'application/pdf',
    }),
    getSignedUrl: jest.fn().mockResolvedValue('https://signed'),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  return {
    prisma,
    files,
    service: new StaffDocumentsService(prisma as never, files as never),
  };
}

describe('StaffDocumentsService', () => {
  it('shows every folder to every teacher, with who can manage it', async () => {
    const { service } = setup();
    const [a] = await service.listFolders(T, teacherA);
    const [b] = await service.listFolders(T, teacherB);
    expect(a).toMatchObject({
      name: 'Lesson plans',
      fileCount: 1,
      createdBy: 'Asha',
      canManage: true,
    });
    expect(b.canManage).toBe(false);
    expect((await service.listFolders(T, admin))[0].canManage).toBe(true);
  });

  it("lets another teacher download but not delete someone else's file", async () => {
    const { service, files, prisma } = setup();
    await expect(service.fileUrl(T, 'f1', 'x1')).resolves.toEqual({
      url: 'https://signed',
    });
    expect(files.getSignedUrl).toHaveBeenCalledWith(
      expect.any(String),
      T,
      900,
      {
        downloadName: 'Week 1.pdf',
      },
    );
    await expect(
      service.deleteFile(T, teacherB, 'f1', 'x1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await service.deleteFile(T, admin, 'f1', 'x1');
    expect(prisma.staffFile.delete).toHaveBeenCalled();
    expect(files.delete).toHaveBeenCalled();
  });

  it('uploads into the folder under the staff-docs key path', async () => {
    const { service, files } = setup();
    await service.upload(T, teacherB, 'f1', {
      originalname: 'Week 1.pdf',
    } as never);
    expect(files.upload).toHaveBeenCalledWith(
      T,
      expect.anything(),
      FileCategory.STAFF_DOCUMENT,
      'f1',
    );
  });

  it('refuses to delete a folder that still has files', async () => {
    const { service } = setup();
    await expect(
      service.deleteFolder(T, teacherA, 'f1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps staff document keys away from the generic /files routes', () => {
    expect(isModuleOwnedKey(`private/${T}/staff-docs/f1/u.pdf`)).toBe(true);
  });
});
