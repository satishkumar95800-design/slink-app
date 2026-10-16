import { strings } from '../../lib/strings';
import { Checklist } from './checklist';
import { Eyebrow } from './eyebrow';
import { Section } from './section';
import { WhatsAppDemoButton } from './cta';
import { PricingForm } from './pricing-form';

/** Plan cards without prices; the prices come in the PDF a visitor downloads from the form below them. */
export function Pricing() {
  const t = strings.marketing.pricing;
  return (
    <Section tone="muted" id="pricing">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{t.title}</h2>
        <p className="mt-3 text-gray-600">{t.subtitle}</p>
      </div>
      <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
        {t.plans.map((plan, i) => (
          <div
            key={plan.name}
            className={`relative rounded-3xl bg-white p-6 shadow-sm ${i === 1 ? 'border-2 border-coral' : 'border border-black/5'}`}
          >
            {i === 1 && (
              <span className="absolute -top-3 left-6 rounded-full bg-coral px-3 py-1 text-xs font-bold text-white">{t.popular}</span>
            )}
            <h3 className="text-xl font-extrabold text-gray-900">{plan.name}</h3>
            <p className="mt-1 text-sm text-gray-500">{plan.tagline}</p>
            <p className="mt-4 text-sm font-bold text-gray-900">{t.upTo(plan.students)}</p>
            <Checklist items={[...plan.highlights]} />
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 max-w-3xl">
        <PricingForm />
        <div className="mt-6 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center">
          <WhatsAppDemoButton label={t.cta} />
          <p className="text-sm text-gray-500">{t.multiBranch}</p>
        </div>
      </div>
    </Section>
  );
}
