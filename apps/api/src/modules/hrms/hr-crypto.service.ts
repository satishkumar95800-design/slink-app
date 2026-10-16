import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SecretKeyMissingError,
  decryptSecret,
  encryptSecret,
} from '../../common/secret-box';
import { hrmsStrings as t } from './hrms.strings';

/** Encrypts HR identifiers and bank details with the same scheme/key as the payment-gateway secrets. */
@Injectable()
export class HrCrypto {
  constructor(private readonly config: ConfigService) {}

  encrypt(plain: string): string {
    try {
      return encryptSecret(
        this.config.get<string>('PAYMENT_SECRETS_KEY'),
        plain,
      );
    } catch (err) {
      if (err instanceof SecretKeyMissingError)
        throw new BadRequestException({
          code: 'PAYMENT_SECRETS_KEY_MISSING',
          message: t.secretKeyMissing,
        });
      throw err;
    }
  }

  decrypt(stored: string): string {
    try {
      return decryptSecret(
        this.config.get<string>('PAYMENT_SECRETS_KEY'),
        stored,
      );
    } catch (err) {
      if (err instanceof SecretKeyMissingError)
        throw new BadRequestException({
          code: 'PAYMENT_SECRETS_KEY_MISSING',
          message: t.secretKeyMissing,
        });
      throw new BadRequestException({
        code: 'DECRYPT_FAILED',
        message:
          'A stored value could not be decrypted (is PAYMENT_SECRETS_KEY unchanged?)',
      });
    }
  }
}
