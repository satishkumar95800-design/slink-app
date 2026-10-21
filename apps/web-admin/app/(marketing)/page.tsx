import { Bell, FileText, ShieldCheck, Upload, Wallet } from 'lucide-react';
import { WhatsAppDemoButton, TrackedLink } from '../../components/marketing/cta';
import { DemoVideo } from '../../components/marketing/demo-video';
import { Testimonials } from '../../components/marketing/testimonials';
import { Pricing } from '../../components/marketing/pricing';
import { AppBadges } from '../../components/marketing/app-badges';
import { marketingConfig } from '../../lib/marketing-config';
import { strings } from '../../lib/strings';
import { Section } from '../../components/marketing/section';
import { FeatureTabs } from '../../components/marketing/feature-tabs';
import { Eyebrow } from '../../components/marketing/eyebrow';
import { Marquee } from '../../components/marketing/marquee';
import { FloatingStat } from '../../components/marketing/floating-stat';
import { DashboardMockup } from '../../components/marketing/dashboard-mockup';

const m = strings.marketing;
const WHY_ICONS = [Wallet, Upload, Bell];

const TICKER_ITEMS = [
  'LIVE FEE COLLECTION',
  'ABSENCE ALERTS',
  'SCHOOL BUS ROUTES',
  'SAFE HOMEWORK PHOTOS',
  'SYLLABUS PROGRESS',
  'ADMISSIONS PIPELINE',
  'PAYROLL & PAYSLIPS',
  'PETTY CASH',
  'CONSENT FORMS',
  'HOLIDAY ALERTS',
  'KANNADA · HINDI · ENGLISH',
  'HEAD OFFICE VIEW',
];

export default function LandingPage() {
  return (
    <>
      <Section tone="cream" className="pt-14 pb-0 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>{m.eyebrow}</Eyebrow>
            <h1 className="mt-5 text-3xl font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl lg:text-[3.4rem]">
              {m.headline}{' '}
              <span className="relative inline-block">
                <span className="relative z-10">{m.headlineHighlight}</span>
                <span className="absolute inset-x-0 bottom-1 z-0 h-4 bg-coral/30" />
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-gray-600">{m.subline}</p>
            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <WhatsAppDemoButton />
              <TrackedLink href="/login" event="login_click">
                {m.schoolLogin}
              </TrackedLink>
            </div>
            <p className="mt-4 text-xs text-gray-500">{m.heroNote}</p>

            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-gray-200 pt-6 sm:max-w-md">
              {m.stats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-extrabold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <DashboardMockup />
            <FloatingStat
              icon={ShieldCheck}
              label="Discount applied"
              value="−₹2,000"
              caption="Sibling discount"
              className="absolute -right-2 top-6 hidden sm:block"
            />
            <FloatingStat
              icon={FileText}
              label="Report card ready"
              value="Term 2"
              caption="Published to parent"
              className="absolute -left-4 bottom-8 hidden sm:block"
            />
          </div>
        </div>
      </Section>

      <FeatureTabs />

      <Marquee items={TICKER_ITEMS} />

      <Section tone="cream" id="demo-video">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow tone="teal">{m.videoEyebrow}</Eyebrow>
          <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{m.videoTitle}</h2>
        </div>
        <div className="mx-auto mt-8 max-w-4xl">
          <DemoVideo />
        </div>
      </Section>

      <Section tone="light" id="why">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>{m.whyEyebrow}</Eyebrow>
          <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{m.whyTitle}</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {m.why.map((item, i) => {
            const Icon = WHY_ICONS[i];
            return (
              <div key={item.title} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-coral/10 text-coral">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.body}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-12 flex flex-col items-center gap-3 rounded-3xl bg-teal px-6 py-10 text-center text-white sm:px-12">
          <h3 className="text-xl font-extrabold sm:text-2xl">{m.midCtaTitle}</h3>
          <p className="max-w-md text-sm text-white/80">{m.midCtaBody}</p>
          <WhatsAppDemoButton className="mt-3" />
        </div>
      </Section>

      <Testimonials />

      <Pricing />

      {(marketingConfig.playStoreUrl || marketingConfig.appStoreUrl) && (
        <Section tone="light" id="app">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <Eyebrow tone="teal">{m.appEyebrow}</Eyebrow>
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{m.appTitle}</h2>
            <p className="text-gray-600">{m.appBody}</p>
            <AppBadges />
          </div>
        </Section>
      )}

      <Section tone="cream">
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:p-14">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-4xl">{m.finalTitle}</h2>
              <p className="mt-4 text-gray-600">{m.finalBody}</p>
              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <WhatsAppDemoButton />
                <TrackedLink href="/login" event="login_click">
                  {m.schoolLogin}
                </TrackedLink>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
