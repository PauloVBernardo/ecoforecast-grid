'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MainLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
      pathname === path
        ? 'text-sky-400 font-bold'
        : 'text-slate-400 hover:text-slate-200'
    }`;

  return (
    <div className="min-h-screen bg-slate-950">
      {children}

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900/90 backdrop-blur border-t border-slate-800 py-3 px-6 flex justify-around shadow-xl z-50">
        <Link href="/" className={linkClass('/')}>
          <span>📊</span>
          <span>Painel</span>
        </Link>

        <Link href="/configuracao" className={linkClass('/configuracao')}>
          <span>🗄️</span>
          <span>Dados</span>
        </Link>

        <Link href="/analise" className={linkClass('/analise')}>
          <span>🧠</span>
          <span>Análise</span>
        </Link>
      </nav>
    </div>
  );
}