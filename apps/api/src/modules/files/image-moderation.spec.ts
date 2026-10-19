import { FileCategory } from './dto/upload-file.dto';
import {
  blockedCategories,
  imageModerationEnabled,
  needsImageCheck,
} from './image-moderation';

describe('image moderation rules', () => {
  it('is on in production (real S3) and off with a local endpoint unless set', () => {
    expect(imageModerationEnabled(undefined, undefined)).toBe(true);
    expect(imageModerationEnabled(undefined, 'http://localhost:4566')).toBe(
      false,
    );
    expect(imageModerationEnabled('on', 'http://localhost:4566')).toBe(true);
    expect(imageModerationEnabled('off', undefined)).toBe(false);
  });

  it('checks only JPEG/PNG attachments', () => {
    expect(needsImageCheck(FileCategory.ATTACHMENT, 'image/jpeg')).toBe(true);
    expect(needsImageCheck(FileCategory.ATTACHMENT, 'image/png')).toBe(true);
    expect(needsImageCheck(FileCategory.ATTACHMENT, 'application/pdf')).toBe(
      false,
    );
    expect(needsImageCheck(FileCategory.LOGO, 'image/png')).toBe(false);
  });

  it('reports top-level categories at or above the confidence floor', () => {
    expect(
      blockedCategories([
        { Name: 'Graphic Violence', ParentName: 'Violence', Confidence: 88 },
        { Name: 'Violence', ParentName: '', Confidence: 90 },
        { Name: 'Smoking', ParentName: 'Tobacco', Confidence: 40 },
      ]),
    ).toEqual(['Violence']);
    expect(blockedCategories([])).toEqual([]);
  });
});
