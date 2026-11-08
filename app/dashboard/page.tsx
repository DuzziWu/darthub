/**
 * Dashboard page — shows user stats (rating, level, XP) and friend count.
 * Uses Tailwind utility classes for responsive layout.
 */
export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Rating stat */}
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-sm text-slate-400">Rating</p>
            <p className="text-xl font-semibold">--</p>
          </div>

          {/* Level stat */}
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-sm text-slate-400">Level</p>
            <p className="text-xl font-semibold">--</p>
          </div>

          {/* XP stat */}
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-sm text-slate-400">XP</p>
            <p className="text-xl font-semibold">--</p>
          </div>

          {/* Friends count */}
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-sm text-slate-400">Friends</p>
            <p className="text-xl font-semibold">--</p>
          </div>
        </div>
      </div>
    </main>
  );
}
