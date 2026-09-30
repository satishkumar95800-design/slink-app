export function Marquee({ items }: { items: string[] }) {
  // Duplicated once so the 50%-width translateX loop is seamless.
  const looped = [...items, ...items];
  return (
    <div className="overflow-hidden border-y border-teal-light/40 bg-teal py-3">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
        {looped.map((item, i) => (
          <span key={i} className="flex items-center gap-10 text-xs font-bold uppercase tracking-wider text-white/90">
            {item}
            <span className="text-coral">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}
