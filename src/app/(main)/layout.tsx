'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LayoutDashboard, Activity, Info } from 'lucide-react';

export default function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium transition-colors ${
      pathname === path
        ? 'text-purple-400 font-bold'
        : ' text-slate-700 hover:text-slate-400'
    }`;

  return (
    <div className="min-h-screen bg-slate-950">
      {children}

      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto grid max-w-md grid-cols-3 border-t border-slate-800 bg-slate-100 px-2 py-2 shadow-xl backdrop-blur"
      >
        <Link href="/" className={linkClass('/')}>
          <LayoutDashboard className="h-5 w-5 mb-0.5" strokeWidth={2.5} />
          <span className="truncate">Painel</span>
        </Link>
        
        <Link href="/analise" className={linkClass('/analise')}>
          <Activity className="h-5 w-5 mb-0.5" strokeWidth={2.5} />
          <span className="truncate">Análise</span>
        </Link>

        <Link href="/sobre" className={linkClass('/sobre')}>
          <Info className="h-5 w-5 mb-0.5" strokeWidth={2.5} />
          <span className="truncate">Sobre</span>
        </Link>
      </nav>
    </div>
  );
}