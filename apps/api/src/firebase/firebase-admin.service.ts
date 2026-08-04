import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private app: App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      this.app = existingApps[0]!;
      return;
    }

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      if (this.config.get('NODE_ENV') !== 'production') {
        // Dev mode: verifyIdToken falls back to a stub
        return;
      }
      throw new Error('Firebase Admin credentials are required in production');
    }

    this.app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.app) {
      // Dev stub: decode JWT payload without verifying signature
      try {
        const [, payload] = idToken.split('.');
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
        return decoded as DecodedIdToken;
      } catch {
        throw new UnauthorizedException('Invalid Firebase ID token');
      }
    }
    return getAuth(this.app).verifyIdToken(idToken);
  }
}
