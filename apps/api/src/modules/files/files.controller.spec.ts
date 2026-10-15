import { ForbiddenException } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FileCategory } from './dto/upload-file.dto';
import type { ActiveUser } from '../../common/types/active-user.type';

describe('FilesController petty cash receipts', () => {
  const service = {
    upload: jest.fn(),
    getSignedUrl: jest.fn(),
    delete: jest.fn(),
  };
  const controller = new FilesController(service as never);
  const file = { size: 1, mimetype: 'image/png' } as never;

  it('refuses generic upload of petty cash receipts', () => {
    expect(() =>
      controller.upload('t1', {} as ActiveUser, file, {
        category: FileCategory.PETTY_CASH_RECEIPT,
      }),
    ).toThrow(ForbiddenException);
    expect(service.upload).not.toHaveBeenCalled();
  });

  it('refuses generic signed URLs and deletes for petty cash keys', async () => {
    await expect(
      controller.getSignedUrl('t1', {
        key: 'private/t1/petty-cash/a.pdf',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(() =>
      controller.delete('t1', 'private/t1/petty-cash/a.pdf'),
    ).toThrow(ForbiddenException);
    expect(service.getSignedUrl).not.toHaveBeenCalled();
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('still serves other private keys', async () => {
    service.getSignedUrl.mockResolvedValue('https://signed');
    await expect(
      controller.getSignedUrl('t1', {
        key: 'private/t1/attachments/a.pdf',
      }),
    ).resolves.toMatchObject({ url: 'https://signed' });
  });
});
