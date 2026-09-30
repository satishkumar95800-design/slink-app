/** Custom CSS/SVG illustration standing in for a product photo — a stylised
 * phone showing the parent app's fee/report screen, inside a soft gradient
 * backdrop card (matching the proportions of collabdrop.in's hero photo). */
export function DashboardMockup() {
  return (
    <div className="relative mx-auto aspect-[4/3.1] w-full max-w-xl overflow-hidden rounded-3xl bg-gradient-to-br from-coral/15 via-cream to-teal/10">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute -left-10 -top-10 h-56 w-56 rounded-full bg-coral/30 blur-3xl" />
        <div className="absolute -bottom-16 -right-10 h-64 w-64 rounded-full bg-teal/30 blur-3xl" />
      </div>

      {/* Phone frame */}
      <div className="absolute left-1/2 top-1/2 h-[92%] w-[54%] -translate-x-1/2 -translate-y-1/2 rounded-[2.2rem] border-[6px] border-gray-900 bg-gray-900 shadow-2xl">
        <div className="mx-auto mb-1 mt-1.5 h-1 w-10 rounded-full bg-gray-700" />
        <div className="h-[calc(100%-0.6rem)] overflow-hidden rounded-[1.7rem] bg-white">
          {/* status/header */}
          <div className="flex items-center justify-between bg-teal px-4 pb-4 pt-6 text-white">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/70">Hi, Aarav&apos;s Parent</p>
              <p className="text-sm font-bold">Fee Overview</p>
            </div>
            <div className="h-6 w-6 rounded-full bg-white/20" />
          </div>
          {/* stat row */}
          <div className="grid grid-cols-2 gap-2 px-3 pt-3">
            <div className="rounded-lg bg-coral/10 p-2">
              <p className="text-[9px] font-semibold uppercase text-coral-dark">Paid</p>
              <p className="text-sm font-extrabold text-gray-900">₹48,500</p>
            </div>
            <div className="rounded-lg bg-gray-100 p-2">
              <p className="text-[9px] font-semibold uppercase text-gray-500">Pending</p>
              <p className="text-sm font-extrabold text-gray-900">₹6,000</p>
            </div>
          </div>
          {/* list rows */}
          <div className="mt-3 space-y-2 px-3">
            {['Term 2 · Tuition', 'Transport · Q3', 'Report Card · Term 1'].map((label, i) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-gray-100 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <div className={`h-6 w-6 rounded-full ${i === 0 ? 'bg-coral/20' : i === 1 ? 'bg-teal/15' : 'bg-gray-100'}`} />
                  <span className="text-[10px] font-medium text-gray-700">{label}</span>
                </div>
                <span className="text-[9px] font-bold text-gray-400">{i === 2 ? 'PDF' : '✓'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
