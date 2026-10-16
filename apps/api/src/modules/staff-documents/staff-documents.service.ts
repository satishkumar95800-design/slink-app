import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { Express } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { FilesService } from '../files/files.service';
import { FileCategory } from '../files/dto/upload-file.dto';

const FOLDER_EXISTS = {
  code: 'FOLDER_EXISTS',
  message: 'A folder with this name already exists',
};
const FOLDER_NOT_EMPTY = {
  code: 'FOLDER_NOT_EMPTY',
  message: 'Delete the files in this folder first',
};
const NOT_OWNER = {
  code: 'NOT_OWNER',
  message: 'Only the person who added this, or an admin, can change it',
};

/**
 * Shared staff documents: every teacher, admin and accounts user of a school
 * sees every folder and file of that school. Anyone of them can create a
 * folder or upload; renaming or deleting is for whoever created it or an admin.
 * Files live under private/{tenant}/staff-docs/ and are served only here.
 */
@Injectable()
export class StaffDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async listFolders(tenantId: string, user: ActiveUser) {
    const folders = await this.prisma.staffFolder.findMany({
      where: { tenantId },
      include: { _count: { select: { files: true } } },
      orderBy: { name: 'asc' },
    });
    const names = await this.userNames(
      tenantId,
      folders.map((f) => f.createdBy),
    );
    return folders.map((f) => ({
      id: f.id,
      name: f.name,
      fileCount: f._count.files,
      createdBy: names.get(f.createdBy) ?? null,
      createdAt: f.createdAt.toISOString(),
      canManage: this.canManage(user, f.createdBy),
    }));
  }

  async createFolder(tenantId: string, user: ActiveUser, name: string) {
    try {
      const f = await this.prisma.staffFolder.create({
        data: { tenantId, name, createdBy: user.id },
      });
      return { id: f.id, name: f.name };
    } catch (e) {
      throw this.duplicate(e);
    }
  }

  async renameFolder(
    tenantId: string,
    user: ActiveUser,
    id: string,
    name: string,
  ) {
    const folder = await this.folder(tenantId, id);
    this.assertCanManage(user, folder.createdBy);
    try {
      const f = await this.prisma.staffFolder.update({
        where: { id },
        data: { name },
      });
      return { id: f.id, name: f.name };
    } catch (e) {
      throw this.duplicate(e);
    }
  }

  async deleteFolder(tenantId: string, user: ActiveUser, id: string) {
    const folder = await this.folder(tenantId, id);
    this.assertCanManage(user, folder.createdBy);
    const count = await this.prisma.staffFile.count({
      where: { tenantId, folderId: id },
    });
    if (count > 0) throw new ConflictException(FOLDER_NOT_EMPTY);
    await this.prisma.staffFolder.delete({ where: { id } });
  }

  async listFiles(tenantId: string, user: ActiveUser, folderId: string) {
    const folder = await this.folder(tenantId, folderId);
    const files = await this.prisma.staffFile.findMany({
      where: { tenantId, folderId },
      orderBy: { createdAt: 'desc' },
    });
    const names = await this.userNames(
      tenantId,
      files.map((f) => f.uploadedBy),
    );
    return {
      folder: {
        id: folder.id,
        name: folder.name,
        canManage: this.canManage(user, folder.createdBy),
      },
      files: files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        contentType: f.contentType,
        size: f.size,
        uploadedBy: names.get(f.uploadedBy) ?? null,
        createdAt: f.createdAt.toISOString(),
        canManage: this.canManage(user, f.uploadedBy),
      })),
    };
  }

  async upload(
    tenantId: string,
    user: ActiveUser,
    folderId: string,
    file: Express.Multer.File,
  ) {
    await this.folder(tenantId, folderId);
    const res = await this.files.upload(
      tenantId,
      file,
      FileCategory.STAFF_DOCUMENT,
      folderId,
    );
    const row = await this.prisma.staffFile.create({
      data: {
        tenantId,
        folderId,
        fileKey: res.key,
        fileName: file.originalname.slice(0, 200),
        contentType: res.contentType,
        size: res.size,
        uploadedBy: user.id,
      },
    });
    return {
      id: row.id,
      fileName: row.fileName,
      contentType: row.contentType,
      size: row.size,
      uploadedBy: user.name,
      createdAt: row.createdAt.toISOString(),
      canManage: true,
    };
  }

  async fileUrl(tenantId: string, folderId: string, id: string) {
    const file = await this.file(tenantId, folderId, id);
    const url = await this.files.getSignedUrl(file.fileKey, tenantId, 900, {
      downloadName: file.fileName,
    });
    return { url };
  }

  async deleteFile(
    tenantId: string,
    user: ActiveUser,
    folderId: string,
    id: string,
  ) {
    const file = await this.file(tenantId, folderId, id);
    this.assertCanManage(user, file.uploadedBy);
    await this.prisma.staffFile.delete({ where: { id } });
    await this.files.delete(file.fileKey, tenantId).catch(() => undefined);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private canManage(user: ActiveUser, ownerId: string) {
    return (
      user.id === ownerId ||
      user.role === Role.admin ||
      user.role === Role.super_admin
    );
  }

  private assertCanManage(user: ActiveUser, ownerId: string) {
    if (!this.canManage(user, ownerId)) throw new ForbiddenException(NOT_OWNER);
  }

  private async folder(tenantId: string, id: string) {
    const f = await this.prisma.staffFolder.findFirst({
      where: { id, tenantId },
    });
    if (!f) throw new NotFoundException('Folder not found');
    return f;
  }

  private async file(tenantId: string, folderId: string, id: string) {
    const f = await this.prisma.staffFile.findFirst({
      where: { id, folderId, tenantId },
    });
    if (!f) throw new NotFoundException('File not found');
    return f;
  }

  private async userNames(tenantId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map<string, string>();
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(users.map((u) => [u.id, u.name]));
  }

  private duplicate(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return new ConflictException(FOLDER_EXISTS);
    return e;
  }
}
