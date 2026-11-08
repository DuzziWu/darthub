/**
 * Lobby page — shows public rooms, create private room button, and matchmaking queue.
 * Uses Tailwind utility classes for responsive layout.
 */
export default function LobbyPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Game Lobby</h1>

        {/* Matchmaking section */}
        <section className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Matchmaking</h2>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors">
            Find Match
          </button>
        </section>

        {/* Public rooms */}
        <section className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Public Rooms</h2>
          <div className="text-slate-400 text-sm">No rooms available</div>
        </section>

        {/* Create private room */}
        <section className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Private Room</h2>
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors">
            Create Room
          </button>
        </section>
      </div>
    </main>
  );
}
