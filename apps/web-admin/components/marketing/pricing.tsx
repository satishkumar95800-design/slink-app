import { marketingConfig } from '../../lib/marketing-config';
import { formatRupees } from '../../lib/format';
import { strings } from '../../lib/strings';
import { Checklist } from './checklist';
import { Eyebrow } from './eyebrow';
import { Section } from './section';
import { WhatsAppDemoButton } from './cta';

export function Pricing() {
  const t = strings.marketing.pricing;
  const showNumber = marketingConfig.showPrice && marketingConfig.pricePerStudentPerYear > 0;
  return (
    <Section tone="muted" id="pricing">
      <div className="mx-auto max-w-3xl rounded-3xl border border-black/5 bg-white p-8 shadow-sm sm:p-12">
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
          {showNumber ? t.startingFrom(formatRupees(marketingConfig.pricePerStudentPerYear)) : t.simple}
        </h2>
        <p className="mt-3 text-gray-600">{t.subtitle}</p>
        <Checklist items={[...t.included]} />
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <WhatsAppDemoButton label={t.cta} />
          <p className="text-sm text-gray-500">{t.multiBranch}</p>
        </div>
      </div>
    </Section>
  );
}
