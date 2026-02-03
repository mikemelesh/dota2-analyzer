import { Link } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0e14]">
      <header className="sticky top-0 z-50 border-b border-[#21262d] bg-[#0d1117]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-white hover:text-[#7cb342] transition-colors">
            <span className="text-xl">⚔</span>
            <span>Dota 2 Analyzer</span>
          </Link>
          <nav className="flex gap-4 text-sm text-[#8b949e]">
            <Link to="/" className="hover:text-white transition-colors">Matches</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
