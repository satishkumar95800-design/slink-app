import { AuditLogInterceptor } from './audit-log.interceptor';

describe('AuditLogInterceptor redaction', () => {
  const redact = (body: unknown) =>
    (
      new AuditLogInterceptor({} as never) as unknown as {
        redact: (b: unknown) => unknown;
      }
    ).redact(body);

  it('hides gateway secrets and HR identifiers, at any depth', () => {
    expect(
      redact({
        keyId: 'rzp_live_1',
        keySecret: 's3cret',
        webhookSecret: 'wh',
        name: 'Asha',
        pan: 'ABCDE1234F',
        rows: [
          {
            aadhaar: '123412341234',
            bankAccount: '0001',
            bankIfsc: 'X',
            bankHolder: 'Asha',
          },
        ],
        nested: { password: 'p' },
      }),
    ).toEqual({
      keyId: 'rzp_live_1',
      keySecret: '[REDACTED]',
      webhookSecret: '[REDACTED]',
      name: 'Asha',
      pan: '[REDACTED]',
      rows: [
        {
          aadhaar: '[REDACTED]',
          bankAccount: '[REDACTED]',
          bankIfsc: '[REDACTED]',
          bankHolder: '[REDACTED]',
        },
      ],
      nested: { password: '[REDACTED]' },
    });
  });
});
