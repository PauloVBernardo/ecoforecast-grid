'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type GlossaryItem = {
  term: string;
  description: string;
};

type TutorialStep = {
  title: string;
  description: string;
  icon: string;
};

const glossary: GlossaryItem[] = [
  {
    term: 'Quadrante H3',
    description:
      'Unidade espacial usada para dividir a área urbana em pequenos polígonos de análise. Cada quadrante recebe previsões, histórico climático e indicadores próprios.'
  },
  {
    term: 'Histórico climático',
    description:
      'Série de dados meteorológicos passados usada como referência para comparar a previsão atual com o comportamento esperado do quadrante.'
  },
  {
    term: 'Previsão climática',
    description:
      'Dados projetados para os próximos dias, incluindo temperatura, chuva, vento, umidade e outras variáveis meteorológicas.'
  },
  {
    term: 'Anomalia',
    description:
      'Desvio relevante entre a previsão e o padrão histórico esperado. Uma anomalia indica que a condição prevista está fora do comportamento usual.'
  },
  {
    term: 'Evento composto',
    description:
      'Situação em que múltiplas variáveis climáticas se desviam ao mesmo tempo, como calor elevado, baixa umidade e estresse hídrico.'
  },
  {
    term: 'Score operacional',
    description:
      'Indicador simplificado de priorização. Quanto maior o score, maior a pressão climática prevista sobre o quadrante.'
  },
  {
    term: 'P95',
    description:
      'Percentil 95 da série histórica. Representa um valor alto, superado por cerca de 5% dos registros históricos.'
  },
  {
    term: 'DEC/FEC',
    description:
      'Indicadores regulatórios da ANEEL usados para avaliar continuidade do fornecimento de energia. Podem ser usados futuramente para validar a relação entre pressão climática e desempenho operacional.'
  }
];

const tutorialSteps: TutorialStep[] = [
  {
    icon: '1',
    title: 'Comece pelo Painel',
    description:
      'A tela inicial mostra a situação geral da área urbana monitorada, os quadrantes com maior prioridade e o mapa operacional.'
  },
  {
    icon: '2',
    title: 'Observe o status dos quadrantes',
    description:
      'Use os filtros para visualizar quadrantes estáveis, com alertas, críticos ou ainda sem histórico climático carregado.'
  },
  {
    icon: '3',
    title: 'Abra um quadrante',
    description:
      'Ao selecionar um quadrante no mapa ou na lista, acesse a análise detalhada para ver a previsão diária, gráficos e alertas.'
  },
  {
    icon: '4',
    title: 'Leia os alertas operacionais',
    description:
      'Cada alerta apresenta o fato detectado, o impacto esperado na infraestrutura e uma recomendação operacional.'
  },
  {
    icon: '5',
    title: 'Use a aba Dados para auditoria',
    description:
      'A aba Dados mostra o carregamento de histórico, previsões e execuções do processamento climático.'
  }
];

export default function SobrePage() {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
      pathname === path
        ? 'text-sky-400 font-bold'
        : 'text-slate-400 hover:text-slate-200'
    }`;

  return (
    <div className="bg-slate-950 min-h-screen">
      <div className="min-h-screen w-full bg-slate-950 px-4 py-6 font-sans text-slate-100 max-w-md mx-auto shadow-2xl border-x border-slate-800 pb-24">
        <header className="mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold text-sky-400">Sobre o EcoGrid</h1>

            <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-bold uppercase text-slate-300">
              v1.0
            </span>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Guia rápido, dicionário de indicadores, origem dos dados e
            informações metodológicas do protótipo.
          </p>
        </header>

        <main className="space-y-5">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-bold text-slate-100">
              O que é a aplicação?
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              O EcoGrid é um protótipo de monitoramento climático operacional.
              A aplicação divide a área urbana de Goiânia em quadrantes e cruza
              histórico climático, previsão meteorológica e indicadores de risco
              para apoiar a priorização de áreas que exigem atenção nos próximos
              dias.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Escopo
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Área urbana de Goiânia
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Unidade
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Quadrantes H3
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Horizonte
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Próximos dias
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Uso
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Apoio à decisão
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-bold text-slate-100">
              Como usar
            </h2>

            <div className="mt-4 space-y-3">
              {tutorialSteps.map((step) => (
                <div
                  key={step.title}
                  className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-black text-white">
                    {step.icon}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      {step.title}
                    </h3>

                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 rounded-xl border border-sky-900/50 bg-sky-950/20 p-3 text-xs leading-relaxed text-sky-200">
              Dica: para apresentação, use o fluxo Painel → Quadrante →
              Análise. Esse caminho mostra a jornada completa de identificação,
              priorização e interpretação do risco.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-bold text-slate-100">
              Dicionário dos indicadores
            </h2>

            <div className="mt-4 space-y-3">
              {glossary.map((item) => (
                <div
                  key={item.term}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                >
                  <h3 className="text-sm font-bold text-sky-300">
                    {item.term}
                  </h3>

                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-bold text-slate-100">
              Origem dos dados
            </h2>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <h3 className="text-sm font-bold text-slate-100">
                  Open-Meteo
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Fonte meteorológica usada para histórico climático e previsão
                  dos próximos dias. Os dados são associados aos centros dos
                  quadrantes monitorados.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <h3 className="text-sm font-bold text-slate-100">
                  Supabase
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Banco de dados utilizado para armazenar quadrantes, séries
                  históricas, previsões, anomalias e execuções dos jobs.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <h3 className="text-sm font-bold text-slate-100">
                  ANEEL DEC/FEC
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Base regulatória prevista como próxima camada de validação. Os
                  indicadores DEC e FEC podem ajudar a comparar pressão climática
                  mensal com desempenho de continuidade do fornecimento de
                  energia.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-bold text-slate-100">
              Metodologia resumida
            </h2>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-400">
              <p>
                A aplicação calcula referências históricas por quadrante e
                compara essas referências com as previsões futuras.
              </p>

              <p>
                Quando a previsão se afasta do padrão histórico, o sistema
                registra alertas estatísticos e apresenta uma leitura
                operacional do possível impacto.
              </p>

              <p>
                O score operacional é uma simplificação para priorização. Ele
                combina eventos como chuva forte, vento forte, baixa umidade,
                calor elevado e eventos compostos.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-amber-900/60 bg-amber-950/20 p-4">
            <h2 className="text-base font-bold text-amber-200">
              Limitações do protótipo
            </h2>

            <div className="mt-3 space-y-3 text-xs leading-relaxed text-amber-100/80">
              <p>
                O EcoGrid é um protótipo demonstrativo. Os alertas não
                substituem sistemas oficiais de defesa civil, operação elétrica
                ou meteorologia.
              </p>

              <p>
                A validação fina depende da integração com ocorrências reais,
                ordens de serviço, interrupções georreferenciadas e parâmetros
                calibrados por especialistas.
              </p>

              <p>
                Os indicadores DEC/FEC são úteis para validação regulatória
                agregada, mas não substituem dados operacionais evento a evento.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-bold text-slate-100">
              Autoria e versão
            </h2>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Projeto
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  EcoGrid — Monitoramento climático operacional urbano
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Autor
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Victor — Norven
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Versão
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  v1.0 — Protótipo funcional
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Status
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Em validação metodológica e operacional
                </p>
              </div>
            </div>
          </section>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900/90 backdrop-blur border-t border-slate-800 py-3 px-6 flex justify-around shadow-xl z-50">
          <Link href="/" className={linkClass('/')}>
            <span>◼</span>
            <span>Painel</span>
          </Link>

          <Link href="/configuracao" className={linkClass('/configuracao')}>
            <span>◆</span>
            <span>Dados</span>
          </Link>

          <Link href="/analise" className={linkClass('/analise')}>
            <span>▲</span>
            <span>Análise</span>
          </Link>

          <Link href="/sobre" className={linkClass('/sobre')}>
            <span>?</span>
            <span>Sobre</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}