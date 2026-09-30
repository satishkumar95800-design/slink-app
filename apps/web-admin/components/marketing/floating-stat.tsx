import { LucideIcon } from 'lucide-react';

interface FloatingStatProps {
  icon?: LucideIcon;
  label: string;
  value: string;
  caption?: string;
  className?: string;
}

/** A small overlapping card used on top of the hero/feature mockups — mirrors
 * the "Escrow held" / "37 visits" proof-point cards on collabdrop.in. */
export function FloatingStat({ icon: Icon, label, value, caption, className = '' }: FloatingStatProps) {
  return (
    <div className={`rounded-xl border border-gray-100 bg-white p-4 shadow-xl ${className}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-coral-dark">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <p className="mt-1 text-xl font-extrabold text-gray-900">{value}</p>
      {caption && <p className="text-xs text-gray-500">{caption}</p>}
    </div>
  );
}
