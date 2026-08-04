// Jest stub for firebase-admin subpackages (firebase-admin/app, firebase-admin/auth, etc.)
// firebase-admin v14 depends on jose which is ESM-only and can't be required in Jest's CJS env.
// Individual test modules can override verifyIdToken via their own mocks.

export const initializeApp = jest.fn().mockReturnValue({ name: '[DEFAULT]' });
export const getApps = jest.fn().mockReturnValue([]);
export const cert = jest.fn((config: unknown) => config);

export const getAuth = jest.fn().mockReturnValue({
  verifyIdToken: jest.fn(),
});

export const getMessaging = jest.fn().mockReturnValue({
  sendEachForMulticast: jest.fn().mockResolvedValue({ successCount: 0, failureCount: 0, responses: [] }),
});
