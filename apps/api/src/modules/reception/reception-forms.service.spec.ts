/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- jest Prisma mocks */
import { Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import { FileCategory } from '../files/dto/upload-file.dto';
import { isModuleOwnedKey } from '../files/files.service';
import { ReceptionFormsService } from './reception-forms.service';

const T = 'tenant-1';
const DESK: ActiveUser = {
  id: 'r1',
  role: Role.receptionist,
  tenantId: T,
  name: 'Kavitha',
  isVerified: true,
};
const FORM = {
  id: 'f1',
  tenantId: T,
  title: 'Visitor declaration',
  note: null,
  fileKey: `private/${T}/reception-forms/abc.pdf`,
  fileName: 'declaration.pdf',
  contentType: 'application/pdf',
  size: 1200,
  uploadedBy: 'r1',
  createdAt: new Date('2026-10-24T05:00:00Z'),
};

function setup() {
  const prisma: any = {
    receptionForm: {
      findMany: jest.fn().mockResolvedValue([FORM]),
      findFirst: jest.fn().mockResolvedValue(FORM),
      create: jest.fn().mockResolvedValue(FORM),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Kavitha' }]),
    },
    auditLog: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(prisma)
      : Promise.all(arg as unknown[]),
  );
  const files: any = {
    upload: jest.fn().mockResolvedValue({
      key: FORM.fileKey,
      contentType: 'application/pdf',
      size: 1200,
    }),
    getBuffer: jest.fn().mockResolvedValue(Buffer.from('%PDF')),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  return { prisma, files, service: new ReceptionFormsService(prisma, files) };
}

describe('ReceptionFormsService', () => {
  it('stores the form under the module-owned key path, audit-logged', async () => {
    const { prisma, files, service } = setup();
    const file = {
      originalname: 'declaration.pdf',
      mimetype: 'application/pdf',
    } as Express.Multer.File;
    await service.upload(T, DESK, file, { title: 'Visitor declaration' });
    expect(files.upload).toHaveBeenCalledWith(
      T,
      file,
      FileCategory.RECEPTION_FORM,
    );
    expect(prisma.receptionForm.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: T,
        title: 'Visitor declaration',
        note: null,
        uploadedBy: 'r1',
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'reception.form_added' }),
      }),
    );
    // The generic /files routes never serve these.
    expect(isModuleOwnedKey(FORM.fileKey)).toBe(true);
  });

  it('lists forms with who added them', async () => {
    const { service } = setup();
    expect(await service.list(T)).toEqual([
      expect.objectContaining({
        id: 'f1',
        title: 'Visitor declaration',
        uploadedBy: 'Kavitha',
      }),
    ]);
  });

  it("serves the file of this school's form only", async () => {
    const { prisma, files, service } = setup();
    const f = await service.file(T, 'f1');
    expect(f).toEqual({
      body: Buffer.from('%PDF'),
      contentType: 'application/pdf',
      fileName: 'declaration.pdf',
    });
    expect(prisma.receptionForm.findFirst).toHaveBeenCalledWith({
      where: { id: 'f1', tenantId: T },
    });
    expect(files.getBuffer).toHaveBeenCalledWith(FORM.fileKey, T);

    prisma.receptionForm.findFirst.mockResolvedValue(null);
    await expect(service.file(T, 'other')).rejects.toMatchObject({
      response: { code: 'FORM_NOT_FOUND' },
    });
  });

  it('removes the row and the file, audit-logged', async () => {
    const { prisma, files, service } = setup();
    await service.remove(T, 'r1', 'f1');
    expect(prisma.receptionForm.delete).toHaveBeenCalledWith({
      where: { id: 'f1' },
    });
    expect(files.delete).toHaveBeenCalledWith(FORM.fileKey, T);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'reception.form_removed' }),
      }),
    );
  });
});
