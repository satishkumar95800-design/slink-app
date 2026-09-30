export function Eyebrow({ children, tone = 'coral' }: { children: React.ReactNode; tone?: 'coral' | 'teal' }) {
  const toneClasses =
    tone === 'coral' ? 'bg-coral/10 text-coral-dark' : 'bg-teal/10 text-teal';
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${toneClasses}`}
    >
      {children}
    </span>
  );
}
