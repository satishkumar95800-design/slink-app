import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SetPaymentGatewayDto {
  /** Razorpay publishable key, e.g. rzp_test_… or rzp_live_… */
  @Matches(/^rzp_(test|live)_[A-Za-z0-9]+$/, {
    message: 'Key ID must look like rzp_test_… or rzp_live_…',
  })
  keyId: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  keySecret: string;

  /** The secret entered when creating the webhook in the Razorpay dashboard. */
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  webhookSecret: string;
}
