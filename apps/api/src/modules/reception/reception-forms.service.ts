import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { FilesService } from '../files/files.service';
import { FileCategory } from '../files/dto/upload-file.dto';
import { ReceptionFormDto } from './dto/reception-forms.dto';

const err = (code: string, message: string) => ({ code, message });

/**
 * Blank forms the front desk prints for visitors and parents to sign
 * (consent, admission form, visitor declaration...). Any front desk login
 * adds, renames or removes them; the file is served by this module only
 * (generic /files routes refuse reception-forms keys), so the console can
 * show and print it from its own page.
 */
@Injectable()
export class ReceptionFormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async list(tenantId: string) {
    const rows = await this.prisma.receptionForm.findMany({
      where: { tenantId },
      orderBy: { title: 'asc' },
    });
    const names = await this.names(rows.map((r) => r.uploadedBy));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      note: r.note,
      fileName: r.fileName,
      contentType: r.contentType,
      size: r.size,
      uploadedBy: names.get(r.uploadedBy) ?? null,
      createdAt: r.createdAt,
    }));
  }

  async upload(
    tenantId: string,
    user: ActiveUser,
    file: Express.Multer.File,
    dto: ReceptionFormDto,
  ) {
    const stored = await this.files.upload(
      tenantId,
      file,
      FileCategory.RECEPTION_FORM,
    );
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.receptionForm.create({
        data: {
          tenantId,
          title: dto.title,
          note: dto.note || null,
          fileKey: stored.key,
          fileName: file.originalname.slice(0, 200),
          contentType: stored.contentType,
          size: stored.size,
          uploadedBy: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: user.id,
          action: 'reception.form_added',
          entityType: 'reception',
          entityId: created.id,
          diff: { title: created.title, fileName: created.fileName },
        },
      });
      return created;
    });
    return { id: row.id };
  }

  async rename(
    tenantId: string,
    actorId: string,
    id: string,
    dto: ReceptionFormDto,
  ) {
    const form = await this.find(tenantId, id);
    await this.prisma.$transaction([
      this.prisma.receptionForm.update({
        where: { id },
        data: { title: dto.title, note: dto.note || null },
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId,
          actorId,
          action: 'reception.form_renamed',
          entityType: 'reception',
          entityId: id,
          diff: { from: form.title, to: dto.title },
        },
      }),
    ]);
    return { id };
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const form = await this.find(tenantId, id);
    await this.prisma.$transaction([
      this.prisma.receptionForm.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          tenantId,
          actorId,
          action: 'reception.form_removed',
          entityType: 'reception',
          entityId: id,
          diff: { title: form.title, fileName: form.fileName },
        },
      }),
    ]);
    await this.files.delete(form.fileKey, tenantId).catch(() => undefined);
    return { removed: true };
  }

  /** The file itself, to show or print in the console. */
  async file(tenantId: string, id: string) {
    const form = await this.find(tenantId, id);
    return {
      body: await this.files.getBuffer(form.fileKey, tenantId),
      contentType: form.contentType,
      fileName: form.fileName,
    };
  }

  private async find(tenantId: string, id: string) {
    const form = await this.prisma.receptionForm.findFirst({
      where: { id, tenantId },
    });
    if (!form)
      throw new NotFoundException(
        err('FORM_NOT_FOUND', 'This form has been removed'),
      );
    return form;
  }

  private async names(ids: string[]) {
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: [...new Set(ids)] } },
          select: { id: true, name: true },
        })
      : [];
    return new Map(users.map((u) => [u.id, u.name]));
  }
}
