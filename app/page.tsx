// Warna candy yang tersedia untuk game match-3
const CANDY_COLORS = [
  { id: 0, bg: "bg-red-500",    label: "🍎" },
  { id: 1, bg: "bg-blue-500",   label: "🫐" },
  { id: 2, bg: "bg-yellow-400", label: "🍋" },
  { id: 3, bg: "bg-green-500",  label: "🍀" },
  { id: 4, bg: "bg-purple-500", label: "🍇" },
  { id: 5, bg: "bg-orange-400", label: "🍊" },
];

// Buat array 1 dimensi 64 elemen (8x8 grid) dengan warna acak
function createGrid(): number[] {
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * CANDY_COLORS.length)
  );
}

export default function Home() {
  const grid: number[] = createGrid();

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold text-white tracking-widest uppercase">
        Sweet Game
      </h1>

      {/* Grid 8x8 — array 1D dirender sebagai grid CSS */}
      <div className="grid grid-cols-8 gap-1 p-4 bg-gray-800 rounded-2xl shadow-2xl shadow-black/60">
        {grid.map((colorId, index) => {
          const candy = CANDY_COLORS[colorId];
          const row = Math.floor(index / 8);
          const col = index % 8;

          return (
            <div
              key={index}
              title={`[${row},${col}] idx:${index}`}
              className={`
                ${candy.bg}
                w-12 h-12
                rounded-lg
                flex items-center justify-center
                text-xl
                shadow-md
                cursor-pointer
                hover:scale-110 hover:brightness-125
                transition-transform duration-150
              `}
            >
              {candy.label}
            </div>
          );
        })}
      </div>

      <p className="text-gray-500 text-sm">
        8 × 8 grid · {grid.length} cells · {CANDY_COLORS.length} candy types
      </p>
    </main>
  );
}
