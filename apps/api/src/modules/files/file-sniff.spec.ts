import { contentMatches, sniff } from './file-sniff';

const bytes = (...b: number[]) => Buffer.from(b);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe1, 0, 0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  bytes(0, 0, 0, 0),
  Buffer.from('WEBPVP8 '),
]);
const PDF = Buffer.from('%PDF-1.4\n%âãÏÓ\n');
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0);
const OLE = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0);
const CSV = Buffer.from('Name,Class\nAsha,5A\n');
const HTML = Buffer.from('<!doctype html><script>alert(1)</script>');

describe('sniff', () => {
  it.each([
    [JPEG, 'jpeg'],
    [PNG, 'png'],
    [WEBP, 'webp'],
    [PDF, 'pdf'],
    [ZIP, 'zip'],
    [OLE, 'ole'],
    [CSV, 'text'],
  ])('recognises %#', (buf, kind) => expect(sniff(buf)).toBe(kind));

  it('finds a PDF header after a little junk', () => {
    expect(sniff(Buffer.concat([Buffer.from('\r\n  '), PDF]))).toBe('pdf');
  });

  it.each([
    ['HTML', HTML],
    ['SVG', Buffer.from('<?xml version="1.0"?><svg onload="alert(1)"/>')],
    ['script in text', Buffer.from('hello\n<script src=//evil></script>')],
    ['binary junk', bytes(0x00, 0x01, 0x02, 0x03)],
    ['empty', Buffer.alloc(0)],
  ])('accepts nothing for %s', (_n, buf) => expect(sniff(buf)).toBeNull());
});

describe('contentMatches', () => {
  it('accepts files that are what they say', () => {
    expect(contentMatches(JPEG, 'image/jpeg')).toBe(true);
    expect(contentMatches(PNG, 'image/png')).toBe(true);
    expect(contentMatches(PDF, 'application/pdf')).toBe(true);
    expect(
      contentMatches(
        ZIP,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ).toBe(true);
    expect(contentMatches(CSV, 'text/csv')).toBe(true);
  });

  it('accepts a CSV that a Windows browser labels as Excel', () => {
    expect(contentMatches(CSV, 'application/vnd.ms-excel')).toBe(true);
  });

  it('refuses a file dressed up as another type', () => {
    expect(contentMatches(HTML, 'image/png')).toBe(false);
    expect(contentMatches(HTML, 'application/pdf')).toBe(false);
    expect(contentMatches(HTML, 'text/plain')).toBe(false);
    expect(contentMatches(PDF, 'image/jpeg')).toBe(false);
    expect(contentMatches(PNG, 'image/jpeg')).toBe(false);
    expect(contentMatches(ZIP, 'application/pdf')).toBe(false);
  });

  it('refuses types it does not know (SVG)', () => {
    expect(contentMatches(Buffer.from('<svg/>'), 'image/svg+xml')).toBe(false);
  });
});
