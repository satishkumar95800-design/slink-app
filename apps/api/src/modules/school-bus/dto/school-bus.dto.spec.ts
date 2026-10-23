import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RouteInputDto } from './school-bus.dto';

const errorsFor = (trackingUrl: unknown) =>
  validateSync(
    plainToInstance(RouteInputDto, { name: 'Route 1', stops: [], trackingUrl }),
  ).map((e) => e.property);

describe('RouteInputDto trackingUrl', () => {
  it("takes the bus company's web link, or nothing", () => {
    expect(errorsFor('https://gps.example.in/track?id=KA01')).toEqual([]);
    expect(errorsFor('')).toEqual([]);
    expect(errorsFor(undefined)).toEqual([]);
  });

  it('refuses anything that is not a web link', () => {
    expect(errorsFor('gps.example.in/track')).toEqual(['trackingUrl']);
    expect(errorsFor('javascript:alert(1)')).toEqual(['trackingUrl']);
    expect(errorsFor('ftp://gps.example.in')).toEqual(['trackingUrl']);
  });
});
