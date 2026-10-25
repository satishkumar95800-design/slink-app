/**
 * Upload content check. The type a browser or app sends (multer's mimetype)
 * is whatever the uploader says, so the first bytes must agree with it
 * before a file is stored: an HTML page or script renamed to .png or .pdf is
 * refused. Pure, so it is unit-tested on its own.
 */

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // docx, xlsx, pptx
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // doc, xls, ppt

type Kind = 'jpeg' | 'png' | 'webp' | 'pdf' | 'zip' | 'ole' | 'text';

const startsWith = (buf: Buffer, sig: number[], at = 0) =>
  buf.length >= at + sig.length && sig.every((b, i) => buf[at + i] === b);

/** Plain text a browser can't be talked into running: no NUL bytes, not markup. */
function isSafeText(buf: Buffer): boolean {
  const head = buf.subarray(0, 8192);
  if (head.includes(0)) return false;
  const text = head.toString('latin1').replace(/^\xEF\xBB\xBF/, ''); // a UTF-8 BOM, decoded as latin1
  return !/^\s*</.test(text) && !/<\s*(script|html|svg|iframe)\b/i.test(text);
}

/** What the bytes actually are, or null when it is none of the kinds accepted anywhere. */
export function sniff(buf: Buffer): Kind | null {
  if (startsWith(buf, JPEG)) return 'jpeg';
  if (startsWith(buf, PNG)) return 'png';
  if (
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'webp';
  // The PDF header may follow a little junk; readers look in the first 1 KB.
  if (buf.subarray(0, 1024).includes('%PDF-')) return 'pdf';
  if (startsWith(buf, ZIP)) return 'zip';
  if (startsWith(buf, OLE)) return 'ole';
  if (buf.length > 0 && isSafeText(buf)) return 'text';
  return null;
}

/** Content kinds each declared type may hold. */
const KINDS_FOR: Record<string, Kind[]> = {
  'image/jpeg': ['jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
  'text/plain': ['text'],
  'text/csv': ['text'],
  'application/msword': ['ole'],
  'application/vnd.ms-powerpoint': ['ole'],
  // Windows browsers also label .csv (and sometimes .xlsx) files this way.
  'application/vnd.ms-excel': ['ole', 'zip', 'text'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'zip',
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['zip'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    'zip',
  ],
};

/** True when the file's bytes are what its declared type says. */
export function contentMatches(buf: Buffer, mimetype: string): boolean {
  const kinds = KINDS_FOR[mimetype];
  const kind = sniff(buf);
  return !!kinds && !!kind && kinds.includes(kind);
}
