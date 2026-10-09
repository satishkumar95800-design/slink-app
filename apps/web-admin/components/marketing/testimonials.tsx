import { Quote } from 'lucide-react';
import { marketingConfig } from '../../lib/marketing-config';
import { strings } from '../../lib/strings';
import { Eyebrow } from './eyebrow';
import { Section } from './section';

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  school: string;
  /** Optional square photo URL. */
  photoUrl?: string;
  /** Optional YouTube id for a short video testimonial. */
  videoYoutubeId?: string;
}

/** Placeholders — replace with real quotes, then set showTestimonials: true in lib/marketing-config.ts. */
export const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'We see exactly who has paid and who hasn’t, every evening, without asking the accounts desk.',
    name: 'Principal name',
    role: 'Principal',
    school: 'School name, City',
  },
  {
    quote: 'Parents stopped calling the office about homework — it’s on their phone with a photo.',
    name: 'Teacher name',
    role: 'Class teacher',
    school: 'School name, City',
  },
  {
    quote: 'Cash, cheque and online all in one place. Month-end reconciliation went from days to minutes.',
    name: 'Accountant name',
    role: 'Accounts',
    school: 'School name, City',
  },
];

export function Testimonials() {
  if (!marketingConfig.showTestimonials) return null;
  return (
    <Section tone="light">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow tone="teal">{strings.marketing.testimonialsEyebrow}</Eyebrow>
        <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{strings.marketing.testimonialsTitle}</h2>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure key={t.name + t.school} className="flex flex-col rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <Quote className="h-6 w-6 text-coral" aria-hidden />
            {t.videoYoutubeId ? (
              <div className="mt-4 aspect-video overflow-hidden rounded-xl">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${t.videoYoutubeId}`}
                  title={t.name}
                  loading="lazy"
                  allowFullScreen
                />
              </div>
            ) : null}
            <blockquote className="mt-4 flex-1 text-gray-700">“{t.quote}”</blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              {t.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.photoUrl} alt="" loading="lazy" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal/10 text-sm font-bold text-teal">
                  {t.name.charAt(0)}
                </span>
              )}
              <span>
                <span className="block text-sm font-bold text-gray-900">{t.name}</span>
                <span className="block text-xs text-gray-500">
                  {t.role} · {t.school}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
