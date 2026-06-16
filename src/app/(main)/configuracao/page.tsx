'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type GridCell = {
  id: string;
  code: string;
  center_latitude: number;
  center_longitude: number;
  history_count: number;
  forecast_count: number;
  last_forecast_update_at: string | null;
};

type JobRun = {
  id: string;
  job_name: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  processed_count: number;
  failed_count: number;
  message: string | null;
};

type Mensagem = {
  tipo: 'sucesso' | 'erro' | '';
  texto: string;
};

function EcoForecastConfigurationContent() {
  const searchParams = useSearchParams();
  const gridCellIdParam = searchParams.get('gridCellId');

  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [jobRuns, setJobRuns] = useState<JobRun[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [executandoJob, setExecutandoJob] = useState(false);
  const [mensagem, setMensagem] = useState<Mensagem>({ tipo: '', texto: '' });

  const totalPendentes = useMemo(
    () => gridCells.filter((cell) => cell.history_count === 0).length,
    [gridCells]
  );

  const totalComHistorico = useMemo(
    () => gridCells.filter((cell) => cell.history_count > 0).length,
    [gridCells]
  );

  const totalComForecast = useMemo(
    () => gridCells.filter((cell) => cell.forecast_count > 0).length,
    [gridCells]
  );

  async function carregarDados() {
    try {
      setCarregando(true);
      setMensagem({ tipo: '', texto: '' });

      const { data, error } = await supabase
        .from('analysis_grid')
        .select(
          'id, code, center_latitude, center_longitude, last_forecast_update_at'
        )
        .eq('is_active', true)
        .order('code');

      if (error) {
        throw error;
      }

      if (!data) {
        setGridCells([]);
        return;
      }

      const quadrantesComStatus = await Promise.all(
        data.map(async (cell) => {
          const { count: historyCount, error: historyError } = await supabase
            .from('climate_series')
            .select('id', { count: 'exact', head: true })
            .eq('grid_cell_id', cell.id);

          if (historyError) {
            throw historyError;
          }

          const { count: forecastCount, error: forecastError } = await supabase
            .from('climate_forecasts')
            .select('id', { count: 'exact', head: true })
            .eq('grid_cell_id', cell.id);

          if (forecastError) {
            throw forecastError;
          }

          return {
            id: cell.id,
            code: cell.code,
            center_latitude: Number(cell.center_latitude),
            center_longitude: Number(cell.center_longitude),
            history_count: Number(historyCount || 0),
            forecast_count: Number(forecastCount || 0),
            last_forecast_update_at: cell.last_forecast_update_at
          };
        })
      );

      setGridCells(quadrantesComStatus);

      const { data: jobsData, error: jobsError } = await supabase
        .from('weather_job_runs')
        .select(
          'id, job_name, status, started_at, finished_at, processed_count, failed_count, message'
        )
        .order('started_at', { ascending: false })
        .limit(5);

      if (jobsError) {
        throw jobsError;
      }

      setJobRuns((jobsData || []) as JobRun[]);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error.message);

      setMensagem({
        tipo: 'erro',
        texto: `Erro ao carregar dados: ${error.message}`
      });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executarAtualizacaoForecast = async () => {
    try {
      setExecutandoJob(true);
      setMensagem({ tipo: '', texto: '' });

      const response = await fetch('/api/jobs/daily-weather?maxCells=10');
      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json.error || 'Falha ao executar job.');
      }

      setMensagem({
        tipo: 'sucesso',
        texto:
          'Job de previsão/anomalias executado para um lote de até 10 quadrantes. Atualize novamente para processar mais lotes ou aguarde o agendamento diário.'
      });

      await carregarDados();
    } catch (error: any) {
      console.error(error);

      setMensagem({
        tipo: 'erro',
        texto: error.message || 'Erro inesperado ao executar job.'
      });
    } finally {
      setExecutandoJob(false);
    }
  };

  const formatarDataHora = (date?: string | null) => {
    if (!date) return 'Sem registro';

    return new Date(date).toLocaleString('pt-BR');
  };

  if (carregando) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-slate-300">
        <p className="font-medium animate-pulse">
          Carregando painel de dados...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 px-4 py-6 font-sans text-slate-100 max-w-md mx-auto shadow-2xl border-x border-slate-800 pb-24">
      <header className="mb-6 border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-sky-400">Dados</h1>

        <p className="text-xs text-slate-400">
          Administração, dados, atualização e auditoria dos dados climáticos
        </p>
      </header>

      {mensagem.texto && (
        <div
          className={`mb-4 p-3 rounded-xl text-xs font-medium border ${
            mensagem.tipo === 'sucesso'
              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800'
              : 'bg-rose-950/50 text-rose-300 border-rose-800'
          }`}
        >
          {mensagem.texto}
        </div>
      )}

      <section className="mb-5 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <h2 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wider">
          Status dos Dados
        </h2>

        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-center">
            <p className="text-xs font-bold uppercase text-slate-500">
              Total
            </p>
            <p className="text-lg font-black text-slate-200">
              {gridCells.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-center">
            <p className="text-xs font-bold uppercase text-slate-500">
              Hist.
            </p>
            <p className="text-lg font-black text-emerald-400">
              {totalComHistorico}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-center">
            <p className="text-xs font-bold uppercase text-slate-500">
              Prev.
            </p>
            <p className="text-lg font-black text-sky-400">
              {totalComForecast}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-center">
            <p className="text-xs font-bold uppercase text-slate-500">
              Pend.
            </p>
            <p className="text-lg font-black text-amber-400">
              {totalPendentes}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={executarAtualizacaoForecast}
          disabled={executandoJob}
          className="w-full bg-sky-600 text-white px-3 py-2 rounded-lg text-xs font-bold uppercase hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-600 transition-colors shadow-md"
        >
          {executandoJob
            ? 'Atualizando lote...'
            : 'Atualizar previsão/anomalias agora'}
        </button>

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Esta tela é administrativa. O painel operacional deve apenas ler os
          dados já processados no Supabase.
        </p>
      </section>

      <section className="mb-5 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
          Últimas execuções
        </h2>

        {jobRuns.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nenhuma execução registrada ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {jobRuns.map((job) => (
              <div
                key={job.id}
                className="rounded-lg border border-slate-800 bg-slate-950/50 p-2"
              >
                <div className="flex justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-200">
                    {job.job_name}
                  </p>

                  <span className="text-[10px] text-sky-300 uppercase font-bold">
                    {job.status}
                  </span>
                </div>

                <p className="text-[10px] text-slate-500 mt-1">
                  Início: {formatarDataHora(job.started_at)}
                </p>

                <p className="text-[10px] text-slate-500">
                  Fim: {formatarDataHora(job.finished_at)}
                </p>

                <p className="text-[10px] text-slate-500">
                  Processados: {job.processed_count} · Falhas:{' '}
                  {job.failed_count}
                </p>

                {job.message && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Mensagem: {job.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wider">
          Quadrantes H3
        </h2>

        <div className="space-y-3">
          {gridCells.map((cell) => {
            const destacado = gridCellIdParam === cell.id;
            const temHistorico = cell.history_count > 0;
            const temForecast = cell.forecast_count > 0;

            return (
              <div
                key={cell.id}
                className={`bg-slate-900 p-3 rounded-xl border shadow-sm ${
                  destacado
                    ? 'border-sky-500 ring-1 ring-sky-500'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-200">
                        {cell.code}
                      </h3>

                      <span
                        className={`text-[9px] font-bold uppercase rounded-full border px-2 py-0.5 ${
                          temHistorico
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                            : 'bg-amber-950/40 text-amber-300 border-amber-800'
                        }`}
                      >
                        {temHistorico ? 'Histórico OK' : 'Histórico pendente'}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500 font-mono mt-1">
                      Lat: {Number(cell.center_latitude).toFixed(4)} | Lon:{' '}
                      {Number(cell.center_longitude).toFixed(4)}
                    </p>

                    <p className="text-[10px] text-slate-500 mt-1">
                      Histórico: {cell.history_count} registros · Previsão:{' '}
                      {cell.forecast_count} registros
                    </p>

                    <p className="text-[10px] text-slate-500 mt-1">
                      Última previsão:{' '}
                      {formatarDataHora(cell.last_forecast_update_at)}
                    </p>
                  </div>

                  <span
                    className={`h-fit text-[9px] font-bold uppercase rounded-full border px-2 py-0.5 ${
                      temForecast
                        ? 'bg-sky-950/40 text-sky-300 border-sky-800'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {temForecast ? 'Previsão OK' : 'Sem previsão'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function ConfiguracaoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-300">
          <p className="font-medium animate-pulse">
            Carregando dados da aplicação...
          </p>
        </div>
      }
    >
      <EcoForecastConfigurationContent />
    </Suspense>
  );
}