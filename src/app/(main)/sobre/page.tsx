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
      'Unidade espacial padronizada que divide a área urbana em polígonos hexagonais. Permite o cruzamento preciso de dados climáticos com infraestrutura local.'
  },
  {
    term: 'Histórico climático (Baseline)',
    description:
      'Série de dados meteorológicos passados que atua como assinatura natural do quadrante, servindo de base para identificar desvios futuros.'
  },
  {
    term: 'Anomalia Estatística',
    description:
      'Desvio matemático (z-score) entre a previsão meteorológica e o padrão histórico esperado. Indica condições atípicas para aquele trecho da cidade.'
  },
  {
    term: 'Score Operacional',
    description:
      'Indicador de priorização de risco focado na resiliência da rede. Combina intensidade de chuvas, ventos e calor para alertar sobre potenciais danos físicos (FEC).'
  },
  {
    term: 'Evento Composto (Compound Event)',
    description:
      'Ocorrência simultânea de variáveis extremas (ex: tempestade com ventania). Historicamente, são os eventos que mais estressam as equipes de campo e a defesa civil.'
  },
  {
    term: 'Extremo Histórico (P95)',
    description:
      'Valor de referência que representa o topo da série histórica. Indica que a condição prevista supera 95% de tudo o que já foi registrado no local.'
  },
  {
    term: 'Indicadores ANEEL (DEC/FEC)',
    description:
      'Métricas regulatórias de continuidade do serviço elétrico. São cruzados temporalmente com os alertas do EcoGrid para validar a eficácia do monitoramento.'
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
        ? 'text-sky-600 font-bold'
        : 'text-slate-500 hover:text-slate-800'
    }`;

  return (
    <div className="bg-slate-950 min-h-screen">
      <div className="min-h-screen w-full bg-slate-950 px-4 py-6 font-sans text-slate-100 max-w-md mx-auto shadow-2xl border-x border-slate-800 pb-24">
        <header className="mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold text-purple-500">Sobre o EcoGrid</h1>

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
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-black text-white">
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
                  Validação regulatória ANEEL DEC/FEC
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Os indicadores DEC e FEC são usados como validação temporal agregada.
                  Como esses dados são mensais e associados a conjuntos de unidades
                  consumidoras, eles não validam diretamente cada quadrante H3. A comparação
                  proposta avalia se meses com maior pressão climática operacional no EcoGrid
                  coincidem com meses de pior desempenho relativo de continuidade.
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
                O score operacional é uma simplificação para priorização de
                risco climático voltado à infraestrutura urbana e continuidade
                elétrica. Ele considera principalmente chuva forte, vento forte,
                eventos compostos e temperatura elevada. Umidade baixa isolada
                é tratada como condição ambiental auxiliar, não como risco
                elétrico direto.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-sky-900/60 bg-sky-950/20 p-4">
            <h2 className="text-base font-bold text-sky-200">
              Validação regulatória
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              A validação com DEC/FEC foi realizada de forma temporal e
              agregada, comparando meses com dados simultâneos do EcoGrid e da
              base pública da ANEEL para a Equatorial GO.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Período comparável
                </p>
                <p className="mt-1 text-sm font-black text-sky-300">
                  35 meses
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  jun/2023 a abr/2026
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Base regulatória
                </p>
                <p className="mt-1 text-sm font-black text-sky-300">
                  DEC/FEC
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Equatorial GO
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Score x DEC
                </p>
                <p className="mt-1 text-sm font-black text-emerald-300">
                  0,375
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Correlação positiva moderada
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Score x FEC
                </p>
                <p className="mt-1 text-sm font-black text-emerald-300">
                  0,441
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Melhor aderência observada
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <details className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-100">
                  Como interpretar o resultado?
                </summary>

                <div className="mt-3 space-y-3 text-xs leading-relaxed text-slate-400">
                  <p>
                    A correlação positiva indica que meses com maior pressão
                    climático-operacional no EcoGrid tendem a coincidir com
                    meses de maior DEC e FEC médio apurado.
                  </p>

                  <p>
                    A aderência foi mais forte com FEC, o que é coerente com a
                    hipótese de que eventos climáticos elevam a frequência de
                    ocorrências. Já o DEC depende também de fatores como tempo
                    de atendimento, logística, acesso às áreas afetadas e
                    complexidade da falha.
                  </p>
                </div>
              </details>

              <details className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-100">
                  O que foi comparado?
                </summary>

                <div className="mt-3 space-y-3 text-xs leading-relaxed text-slate-400">
                  <p>
                    O EcoGrid foi agregado mensalmente a partir do histórico
                    climático dos quadrantes H3 ativos. Esse agregado foi
                    comparado com os indicadores DEC e FEC mensais importados da
                    base pública da ANEEL.
                  </p>

                  <p>
                    A comparação não é espacial por quadrante, pois DEC/FEC são
                    divulgados por conjuntos de unidades consumidoras e por mês.
                    Portanto, a validação é temporal e exploratória.
                  </p>
                </div>
              </details>

              <details className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-100">
                  Limitações da validação
                </summary>

                <div className="mt-3 space-y-3 text-xs leading-relaxed text-slate-400">
                  <p>
                    Nesta versão, a validação utiliza DEC e FEC apurados médios,
                    pois os limites regulatórios não foram integrados à base
                    final. Assim, o resultado não usa DEC/FEC relativo ao limite
                    regulatório.
                  </p>

                  <p>
                    A análise não demonstra causalidade direta. Ela indica
                    aderência temporal entre pressão climática-operacional e
                    desempenho de continuidade, mas fatores operacionais e
                    estruturais também influenciam os indicadores.
                  </p>

                  <p>
                    Os meses de jan/2023 a mai/2023 não foram comparados por
                    ausência de histórico climático no EcoGrid, e os meses de
                    mai/2026 e jun/2026 não foram comparados por ausência de
                    DEC/FEC disponível.
                  </p>
                </div>
              </details>
            </div>
          </section>

          <section className="rounded-2xl border border-purple-900/50 bg-purple-950/20 p-4">
            <h2 className="text-base font-bold text-purple-300">
              Limitações do protótipo
            </h2>

            <div className="mt-3 space-y-3 text-xs leading-relaxed text-slate-300">
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

              <p>
                Eventos climáticos de grande escala, como El Niño e La Niña,
                ainda não são usados como variáveis explícitas do modelo. Nesta
                versão, a sazonalidade é tratada pela comparação mensal do
                histórico climático, e a inclusão de índices climáticos externos
                fica como evolução metodológica futura.
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
                  Paulo Vitor Bernardo — paulo.bernardo@norven.com.br
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

        <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto grid max-w-md grid-cols-3 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-xl backdrop-blur">
          <Link href="/" className={linkClass('/')}>
            <span className="text-base leading-none mb-1">📊</span>
            <span className="truncate">Painel</span>
          </Link>

          <Link href="/analise" className={linkClass('/analise')}>
            <span className="text-base leading-none mb-1">🧠</span>
            <span className="truncate">Análise</span>
          </Link>

          <Link href="/sobre" className={linkClass('/sobre')}>
            <span className="text-base leading-none mb-1">?</span>
            <span className="truncate">Sobre</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}