/**
 * Career page — shows current quest, progress bar, and available training lessons.
 * Uses Tailwind utility classes for responsive layout.
 */
export default function CareerPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Career Mode</h1>

        {/* Current quest */}
        <section className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Current Quest</h2>
          <div className="text-slate-400 text-sm">No active quest</div>
        </section>

        {/* Progress bar */}
        <section className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Progress</h2>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div className="bg-blue-600 h-3 rounded-full" style={{ width: "0%" }} />
          </div>
        </section>

        {/* Training lessons */}
        <section className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Training</h2>
          <div className="text-slate-400 text-sm">No training available</div>
        </section>
      </div>
    </main>
  );
}
