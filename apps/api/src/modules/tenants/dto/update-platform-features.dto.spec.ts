import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateFeaturesDto } from './update-features.dto';
import { UpdatePlatformFeaturesDto } from './update-platform-features.dto';

const check = <T extends object>(cls: new () => T, body: object) =>
  validate(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('platform feature flags', () => {
  it.each(['pettyCash', 'calendar'])(
    '%s can be switched by the platform team',
    async (flag) => {
      expect(
        await check(UpdatePlatformFeaturesDto, { [flag]: true }),
      ).toHaveLength(0);
      expect(
        await check(UpdatePlatformFeaturesDto, { [flag]: false }),
      ).toHaveLength(0);
    },
  );

  it.each(['pettyCash', 'calendar'])('%s must be a boolean', async (flag) => {
    expect(
      await check(UpdatePlatformFeaturesDto, { [flag]: 'yes' }),
    ).not.toHaveLength(0);
  });

  it.each(['pettyCash', 'calendar'])(
    '%s cannot be switched by a school itself',
    async (flag) => {
      expect(await check(UpdateFeaturesDto, { [flag]: true })).not.toHaveLength(
        0,
      );
    },
  );
});
