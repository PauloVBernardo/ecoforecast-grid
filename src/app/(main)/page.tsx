'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { PixelSummary } from '@/components/EcoGridLeafletMap';

type RiskStatus = 'Sem histórico' | 'Normal' | 'Alto' | 'Crítico' | string;

type StatusFilter =
  | 'todos'
  | 'sem_historico'
  | 'estavel'
  | 'alerta'
  | 'Alto'
  | 'Crítico';

type OperationalSummary = {
  grid_cell_id: string;
  code: string;
  forecast_days: number;
  heavy_rain_days: number;
  high_wind_days: number;
  dry_air_days: number;
  rain_wind_compound_days: number;
  hot_dry_days: number;
  max_daily_precipitation: number | null;
  accumulated_precipitation: number | null;
  max_wind_speed: number | null;
  min_relative_humidity: number | null;
  max_temperature: number | null;
  max_operational_risk_score: number | null;
  accumulated_operational_risk_score: number | null;
};

type EcoGridLeafletMapProps = {
  pixels: PixelSummary[];
  selectedPixelId: string | null;
  onSelectPixel: (pixelId: string) => void;
};

const EcoGridLeafletMap = dynamic<EcoGridLeafletMapProps>(
  () => import('@/components/EcoGridLeafletMap').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-slate-900 text-slate-400 text-xs">
        Carregando mapa operacional...
      </div>
    )
  }
);

function getTodayIsoDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);

  return localDate.toISOString().slice(0, 10);
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: unknown, decimals = 1) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return '--';
  }

  return parsed.toFixed(decimals);
}

function getPrioridadeStatus(status: RiskStatus) {
  if (status === 'Crítico') return 1;
  if (status === 'Alto') return 2;
  if (status === 'Sem histórico') return 3;
  if (status === 'Normal') return 4;
  return 5;
}

function getPrioridadeOperacional(
  pixel: PixelSummary,
  operational?: OperationalSummary
) {
  const scoreMaximo = toNumber(operational?.max_operational_risk_score);
  const scoreAcumulado = toNumber(
    operational?.accumulated_operational_risk_score
  );

  const diasChuvaVento = toNumber(operational?.rain_wind_compound_days);
  const diasVentoForte = toNumber(operational?.high_wind_days);
  const diasChuvaForte = toNumber(operational?.heavy_rain_days);

  if (pixel.status === 'Crítico') {
    return 10000 + scoreAcumulado + scoreMaximo;
  }

  if (pixel.status === 'Alto') {
    return 8000 + scoreAcumulado + scoreMaximo;
  }

  if (diasChuvaVento > 0) {
    return 7000 + scoreAcumulado + scoreMaximo;
  }

  if (diasVentoForte > 0) {
    return 6000 + scoreAcumulado + scoreMaximo;
  }

  if (diasChuvaForte > 0) {
    return 5000 + scoreAcumulado + scoreMaximo;
  }

  if (scoreMaximo > 0) {
    return 4000 + scoreAcumulado + scoreMaximo;
  }

  if (pixel.status === 'Sem histórico') {
    return 2000;
  }

  return 1000 - getPrioridadeStatus(pixel.status);
}

export default function EcoForecastDashboardPage() {
  const pathname = usePathname();

  const [summary, setSummary] = useState<PixelSummary[]>([]);
  const [operationalSummary, setOperationalSummary] = useState<
    Record<string, OperationalSummary>
  >({});
  const [carregando, setCarregando] = useState(true);
  const [totalAnomalias, setTotalAnomalias] = useState(0);
  const [selectedPixelId, setSelectedPixelId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [busca, setBusca] = useState('');
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(
    null
  );

  const linkClass = (path: string) =>
    `flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium transition-colors ${
      pathname === path
        ? 'text-sky-400 font-bold'
        : 'text-slate-400 hover:text-slate-200'
    }`;

  const handleSelectPixel = useCallback((pixelId: string) => {
    setSelectedPixelId(pixelId);
  }, []);

  useEffect(() => {
    async function carregarResumoVisaoGeral() {
      try {
        setCarregando(true);
        const todayIso = getTodayIsoDate();
        const { data: gridCells, error: errGrid } = await supabase
          .from('analysis_grid')
          .select(
            'id, code, center_latitude, center_longitude, boundary_geojson, last_forecast_update_at'
          )
          .eq('is_active', true)
          .order('code');

        if (errGrid) {
          throw errGrid;
        }

        if (!gridCells || gridCells.length === 0) {
          setSummary([]);
          setOperationalSummary({});
          setTotalAnomalias(0);
          return;
        }

        const { data: operationalData, error: operationalError } =
          await supabase
            .from('climate_forecast_operational_summary')
            .select(
              'grid_cell_id, code, forecast_days, heavy_rain_days, high_wind_days, dry_air_days, rain_wind_compound_days, hot_dry_days, max_daily_precipitation, accumulated_precipitation, max_wind_speed, min_relative_humidity, max_temperature, max_operational_risk_score, accumulated_operational_risk_score'
            );

        if (operationalError) {
          throw operationalError;
        }

        const operationalMap = Object.fromEntries(
          ((operationalData || []) as OperationalSummary[]).map((item) => [
            item.grid_cell_id,
            item
          ])
        );

        setOperationalSummary(operationalMap);

        const datasAtualizacao = gridCells
          .map((cell) => cell.last_forecast_update_at)
          .filter(Boolean)
          .sort();

        setUltimaAtualizacao(
          datasAtualizacao.length > 0
            ? datasAtualizacao[datasAtualizacao.length - 1]
            : null
        );

        const listaResumos = await Promise.all(
          gridCells.map(async (cell) => {
            const { count: totalHistorico, error: errHistorico } =
              await supabase
                .from('climate_series')
                .select('id', { count: 'exact', head: true })
                .eq('grid_cell_id', cell.id);

            if (errHistorico) {
              throw errHistorico;
            }

            const temHistorico = Number(totalHistorico || 0) > 0;

            if (!temHistorico) {
              return {
                id: cell.id,
                code: cell.code,
                name: cell.code,
                latitude: Number(cell.center_latitude),
                longitude: Number(cell.center_longitude),
                status: 'Sem histórico',
                variable_name: null,
                anomaly_date: null,
                boundary_geojson: cell.boundary_geojson
              } as PixelSummary;
            }

            const { data: anomalias, error: errAnomalias } = await supabase
              .from('grid_anomalies')
              .select('risk_level, variable_name, anomaly_date')
              .eq('grid_cell_id', cell.id)
              .gte('anomaly_date', todayIso)
              .order('anomaly_date', { ascending: false })
              .limit(1);

            if (errAnomalias) {
              throw errAnomalias;
            }

            const temAlerta = anomalias && anomalias.length > 0;

            return {
              id: cell.id,
              code: cell.code,
              name: cell.code,
              latitude: Number(cell.center_latitude),
              longitude: Number(cell.center_longitude),
              status: temAlerta ? anomalias[0].risk_level : 'Normal',
              variable_name: temAlerta ? anomalias[0].variable_name : null,
              anomaly_date: temAlerta ? anomalias[0].anomaly_date : null,
              boundary_geojson: cell.boundary_geojson
            } as PixelSummary;
          })
        );

        setSummary(listaResumos);

        setTotalAnomalias(
          listaResumos.filter(
            (quadrante) =>
              quadrante.status === 'Alto' || quadrante.status === 'Crítico'
          ).length
        );
      } catch (error) {
        console.error('Erro ao montar visão geral:', error);
      } finally {
        setCarregando(false);
      }
    }

    carregarResumoVisaoGeral();
  }, []);

  const summaryFiltrado = useMemo(() => {
    let resultado = summary;

    if (statusFilter === 'sem_historico') {
      resultado = resultado.filter((pixel) => pixel.status === 'Sem histórico');
    } else if (statusFilter === 'estavel') {
      resultado = resultado.filter((pixel) => pixel.status === 'Normal');
    } else if (statusFilter === 'alerta') {
      resultado = resultado.filter(
        (pixel) => pixel.status === 'Alto' || pixel.status === 'Crítico'
      );
    } else if (statusFilter !== 'todos') {
      resultado = resultado.filter((pixel) => pixel.status === statusFilter);
    }

    if (busca.trim()) {
      const termo = busca.trim().toLowerCase();

      resultado = resultado.filter((pixel) =>
        pixel.code.toLowerCase().includes(termo)
      );
    }

    return resultado;
  }, [busca, statusFilter, summary]);

  const quadrantesPriorizados = useMemo(() => {
    return [...summaryFiltrado].sort((a, b) => {
      const prioridadeA = getPrioridadeOperacional(a, operationalSummary[a.id]);
      const prioridadeB = getPrioridadeOperacional(b, operationalSummary[b.id]);

      if (prioridadeA !== prioridadeB) {
        return prioridadeB - prioridadeA;
      }

      return a.code.localeCompare(b.code);
    });
  }, [operationalSummary, summaryFiltrado]);

  const quadrantesExibidos = mostrarTodos
    ? quadrantesPriorizados
    : quadrantesPriorizados.slice(0, 12);

  useEffect(() => {
    if (!selectedPixelId) return;

    const selectedStillVisible = summaryFiltrado.some(
      (pixel) => pixel.id === selectedPixelId
    );

    if (!selectedStillVisible) {
      setSelectedPixelId(null);
    }
  }, [selectedPixelId, summaryFiltrado]);

  const selectedPixel = useMemo(
    () => summary.find((pixel) => pixel.id === selectedPixelId) || null,
    [summary, selectedPixelId]
  );

  const totalSemHistorico = useMemo(
    () => summary.filter((pixel) => pixel.status === 'Sem histórico').length,
    [summary]
  );

  const totalEstaveis = useMemo(
    () => summary.filter((pixel) => pixel.status === 'Normal').length,
    [summary]
  );

  const totalAlto = useMemo(
    () => summary.filter((pixel) => pixel.status === 'Alto').length,
    [summary]
  );

  const totalCritico = useMemo(
    () => summary.filter((pixel) => pixel.status === 'Crítico').length,
    [summary]
  );

  const resumoOperacional = useMemo(() => {
    const values = Object.values(operationalSummary);

    return {
      quadrantesComPrevisao: values.length,
      chuvaForte: values.reduce(
        (acc, item) => acc + toNumber(item.heavy_rain_days),
        0
      ),
      ventoForte: values.reduce(
        (acc, item) => acc + toNumber(item.high_wind_days),
        0
      ),
      chuvaVento: values.reduce(
        (acc, item) => acc + toNumber(item.rain_wind_compound_days),
        0
      ),
      maiorScore: values.reduce(
        (acc, item) =>
          Math.max(acc, toNumber(item.max_operational_risk_score)),
        0
      ),
      scoreAcumulado: values.reduce(
        (acc, item) =>
          acc + toNumber(item.accumulated_operational_risk_score),
        0
      )
    };
  }, [operationalSummary]);

  const getVariableLabel = (variableName?: string | null) => {
    if (!variableName) return 'Sem anomalia';

    const labels: Record<string, string> = {
      temperature_forecast: 'Temperatura',
      precipitation_forecast: 'Precipitação',
      humidity_forecast: 'Umidade',
      multivariate_weather_forecast: 'Anomalia composta'
    };

    return labels[variableName] || variableName;
  };

  const getStatusLabel = (status: RiskStatus) => {
    if (status === 'Normal') return 'Estável';
    return status;
  };

  const getStatusUi = (status: RiskStatus) => {
    if (status === 'Sem histórico') {
      return {
        badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
        dotClass: 'bg-slate-500',
        markerClass: 'bg-slate-600 border-slate-300 shadow-slate-500/30',
        cardClass: 'border-slate-800 bg-slate-900/50'
      };
    }

    if (status === 'Crítico') {
      return {
        badgeClass: 'bg-rose-950/40 text-rose-400 border-rose-800',
        dotClass: 'bg-rose-500',
        markerClass: 'bg-rose-500 border-rose-200 shadow-rose-500/50',
        cardClass: 'border-rose-900/50 bg-rose-950/20'
      };
    }

    if (status === 'Alto') {
      return {
        badgeClass: 'bg-amber-950/40 text-amber-400 border-amber-800',
        dotClass: 'bg-amber-500',
        markerClass: 'bg-amber-500 border-amber-200 shadow-amber-500/50',
        cardClass: 'border-amber-900/50 bg-amber-950/20'
      };
    }

    return {
      badgeClass: 'bg-emerald-950/40 text-emerald-400 border-emerald-800',
      dotClass: 'bg-emerald-500',
      markerClass: 'bg-emerald-500 border-emerald-200 shadow-emerald-500/50',
      cardClass: 'border-slate-800 bg-slate-900'
    };
  };

  const getFilterButtonClass = (filter: StatusFilter) =>
    `rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
      statusFilter === filter
        ? 'bg-sky-500 text-white border-sky-400'
        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-sky-700 hover:text-slate-200'
    }`;

  const formatarData = (date?: string | null) => {
    if (!date) return 'Sem registro';

    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
  };

  const formatarDataHora = (date?: string | null) => {
    if (!date) return 'Sem atualização';

    return new Date(date).toLocaleString('pt-BR');
  };

  if (carregando) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-300">
        <p className="font-medium animate-pulse">
          Carregando sala de situação urbana...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 min-h-screen">
      <div className="min-h-screen w-full bg-slate-950 px-4 py-6 font-sans text-slate-100 max-w-md mx-auto shadow-2xl border-x border-slate-800 pb-24">
        <header className="mb-6 border-b border-slate-800 pb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-sky-400">EcoGrid</h1>

            <span className="text-xs bg-slate-800 text-slate-400 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Sala de Situação
            </span>
          </div>

          <p className="text-xs text-slate-400 mt-1">
            Monitoramento urbano por quadrantes da área urbana de Goiânia
          </p>

          <p className="text-xs text-slate-500 mt-2">
            Última atualização: {formatarDataHora(ultimaAtualizacao)}
          </p>
        </header>

        <div
          className={`p-4 rounded-2xl mb-4 border transition-colors ${
            totalAnomalias > 0 || resumoOperacional.maiorScore > 0
              ? 'bg-rose-950/20 border-rose-900/50'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Status Operacional Urbano
          </h2>

          <p className="text-2xl font-black mt-1 text-slate-100">
            {totalAnomalias === 0 && resumoOperacional.maiorScore === 0
              ? 'Operação Estável'
              : `${totalAnomalias} Alertas Ativos`}
          </p>

          <p className="text-xs text-slate-400 mt-1">
            {totalSemHistorico > 0
              ? `${totalSemHistorico} quadrantes ainda não possuem histórico climático ingerido.`
              : totalAnomalias === 0 && resumoOperacional.maiorScore === 0
                ? 'Nenhum desvio crítico detectado nos quadrantes monitorados.'
                : 'Quadrantes priorizados por anomalia estatística e risco operacional previsto.'}
          </p>

          <div className="grid grid-cols-4 gap-2 mt-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-center">
              <p className="text-xs text-slate-500 uppercase font-bold">
                Sem hist.
              </p>
              <p className="text-lg font-black text-slate-400">
                {totalSemHistorico}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-center">
              <p className="text-xs text-slate-500 uppercase font-bold">
                Estáveis
              </p>
              <p className="text-lg font-black text-emerald-400">
                {totalEstaveis}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-center">
              <p className="text-xs text-slate-500 uppercase font-bold">
                Alto
              </p>
              <p className="text-lg font-black text-amber-400">{totalAlto}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-center">
              <p className="text-xs text-slate-500 uppercase font-bold">
                Crítico
              </p>
              <p className="text-lg font-black text-rose-400">
                {totalCritico}
              </p>
            </div>
          </div>
        </div>

        <section className="mb-5 bg-slate-900 p-4 rounded-2xl border border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Prontidão Operacional Prevista
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs text-slate-500 uppercase font-bold">
                Quadrantes com previsão
              </p>
              <p className="text-lg font-black text-sky-300">
                {resumoOperacional.quadrantesComPrevisao}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs text-slate-500 uppercase font-bold">
                Maior score op.
              </p>
              <p className="text-lg font-black text-fuchsia-300">
                {formatNumber(resumoOperacional.maiorScore, 0)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs text-slate-500 uppercase font-bold">
                Dias chuva forte
              </p>
              <p className="text-lg font-black text-emerald-300">
                {resumoOperacional.chuvaForte}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs text-slate-500 uppercase font-bold">
                Dias vento forte
              </p>
              <p className="text-lg font-black text-cyan-300">
                {resumoOperacional.ventoForte}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs text-slate-500 uppercase font-bold">
                Chuva + vento
              </p>
              <p className="text-lg font-black text-amber-300">
                {resumoOperacional.chuvaVento}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs text-slate-500 uppercase font-bold">
                Score acum.
              </p>
              <p className="text-lg font-black text-rose-300">
                {formatNumber(resumoOperacional.scoreAcumulado, 0)}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            Os indicadores operacionais priorizam quadrantes com previsão de
            chuva forte, vento forte, eventos compostos e maior pressão
            acumulada na janela futura.
          </p>
        </section>

        <section className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Filtro de exibição
            </h3>

            <span className="text-xs text-slate-500 font-mono">
              {summaryFiltrado.length}/{summary.length}
            </span>
          </div>

          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar quadrante. Ex: Q013"
            className="w-full mb-3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('todos')}
              className={getFilterButtonClass('todos')}
            >
              Todos
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('sem_historico')}
              className={getFilterButtonClass('sem_historico')}
            >
              Sem histórico
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('estavel')}
              className={getFilterButtonClass('estavel')}
            >
              Estáveis
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('alerta')}
              className={getFilterButtonClass('alerta')}
            >
              Alertas
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('Alto')}
              className={getFilterButtonClass('Alto')}
            >
              Alto
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('Crítico')}
              className={getFilterButtonClass('Crítico')}
            >
              Crítico
            </button>
          </div>
        </section>

        <section className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Mapa Operacional
              </h3>

              <p className="text-xs text-slate-500 mt-0.5">
                Quadrantes H3 analisados
              </p>
            </div>

            <span className="text-xs text-slate-500 font-mono">
              {summaryFiltrado.length} quadrantes
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
            <div className="h-[420px] w-full">
              <EcoGridLeafletMap
                pixels={summaryFiltrado}
                selectedPixelId={selectedPixelId}
                onSelectPixel={handleSelectPixel}
              />
            </div>

            <div className="grid grid-cols-4 gap-2 p-3 border-t border-slate-800 bg-slate-950/80">
              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                <span className="text-xs text-slate-400">Sem hist.</span>
              </div>

              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-slate-400">Estável</span>
              </div>

              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-xs text-slate-400">Alto</span>
              </div>

              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-xs text-slate-400">Crítico</span>
              </div>
            </div>
          </div>

          {selectedPixel && (
            <div className="mt-3 rounded-xl border border-sky-900/50 bg-sky-950/20 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-300">
                Quadrante selecionado
              </p>

              <div className="flex items-center justify-between gap-3 mt-1">
                <div>
                  <p className="text-sm font-semibold text-slate-100">
                    {selectedPixel.code}
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Status:{' '}
                    <span className="text-slate-200">
                      {getStatusLabel(selectedPixel.status)}
                    </span>{' '}
                    · Variável:{' '}
                    <span className="text-slate-200">
                      {getVariableLabel(selectedPixel.variable_name)}
                    </span>{' '}
                    · Último registro:{' '}
                    <span className="text-slate-200">
                      {formatarData(selectedPixel.anomaly_date)}
                    </span>
                  </p>
                </div>

                <Link
                  href={
                    selectedPixel.status === 'Sem histórico'
                      ? `/configuracao?gridCellId=${selectedPixel.id}`
                      : `/analise?modo=quadrante&gridCellId=${selectedPixel.id}`
                  }
                  className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold uppercase text-white hover:bg-sky-500 transition-colors"
                >
                  {selectedPixel.status === 'Sem histórico'
                    ? 'Dados'
                    : 'Analisar'}
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Quadrantes prioritários
              </h3>

              <p className="text-xs text-slate-500 mt-0.5">
                Ordenados por anomalia e risco operacional previsto
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMostrarTodos((atual) => !atual)}
              className="text-xs font-bold uppercase text-sky-400 hover:text-sky-300"
            >
              {mostrarTodos ? 'Mostrar menos' : 'Ver todos'}
            </button>
          </div>

          {quadrantesExibidos.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl text-center">
              <p className="text-xs text-slate-400">
                Nenhum quadrante encontrado para o filtro selecionado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {quadrantesExibidos.map((pixel) => {
                const ui = getStatusUi(pixel.status);
                const isSelected = selectedPixelId === pixel.id;
                const destino =
                  pixel.status === 'Sem histórico'
                    ? `/configuracao?gridCellId=${pixel.id}`
                    : `/analise?modo=quadrante&gridCellId=${pixel.id}`;

                const operational = operationalSummary[pixel.id];

                return (
                  <div
                    key={pixel.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPixelId(pixel.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors hover:border-sky-700 cursor-pointer ${
                      isSelected ? 'ring-1 ring-sky-500 border-sky-700' : ''
                    } ${ui.cardClass}`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-7 min-w-7 px-1 rounded-md border ${ui.markerClass} flex items-center justify-center text-xs font-black text-white`}
                          >
                            {pixel.code}
                          </span>

                          <div>
                            <h4 className="text-sm font-semibold text-slate-200">
                              {pixel.code}
                            </h4>

                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                              Lat: {Number(pixel.latitude).toFixed(3)} | Lon:{' '}
                              {Number(pixel.longitude).toFixed(3)}
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 mt-2">
                          Variável monitorada:{' '}
                          <span className="text-slate-300">
                            {getVariableLabel(pixel.variable_name)}
                          </span>
                        </p>

                        <p className="text-xs text-slate-500">
                          Último registro:{' '}
                          <span className="text-slate-300">
                            {formatarData(pixel.anomaly_date)}
                          </span>
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${ui.badgeClass}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${ui.dotClass}`}
                        />

                        {getStatusLabel(pixel.status)}
                      </span>
                    </div>

                    {operational ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                          <p className="uppercase text-slate-500 font-bold">
                            Chuva forte
                          </p>
                          <p className="text-slate-200">
                            {toNumber(operational.heavy_rain_days)} dia(s)
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                          <p className="uppercase text-slate-500 font-bold">
                            Vento forte
                          </p>
                          <p className="text-slate-200">
                            {toNumber(operational.high_wind_days)} dia(s)
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                          <p className="uppercase text-slate-500 font-bold">
                            Chuva + vento
                          </p>
                          <p className="text-slate-200">
                            {toNumber(operational.rain_wind_compound_days)}{' '}
                            dia(s)
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                          <p className="uppercase text-slate-500 font-bold">
                            Score op.
                          </p>
                          <p className="text-slate-200">
                            {formatNumber(
                              operational.accumulated_operational_risk_score,
                              0
                            )}
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                          <p className="uppercase text-slate-500 font-bold">
                            Chuva acum.
                          </p>
                          <p className="text-slate-200">
                            {formatNumber(
                              operational.accumulated_precipitation,
                              1
                            )}{' '}
                            mm
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                          <p className="uppercase text-slate-500 font-bold">
                            Vento máx.
                          </p>
                          <p className="text-slate-200">
                            {formatNumber(operational.max_wind_speed, 1)} km/h
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                        <p className="text-xs text-slate-500">
                          Sem previsão operacional salva para este quadrante.
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <Link
                        href={destino}
                        onClick={(event) => event.stopPropagation()}
                        className="rounded-lg border border-sky-800 bg-sky-950/40 px-3 py-1.5 text-xs font-bold uppercase text-sky-300 hover:bg-sky-900/60 hover:text-sky-200 transition-colors"
                      >
                        {pixel.status === 'Sem histórico'
                          ? 'Ver dados'
                          : 'Ver tendência futura'}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto grid max-w-md grid-cols-4 border-t border-slate-800 bg-slate-900/95 px-2 py-2 shadow-xl backdrop-blur">
        <Link href="/" className={linkClass('/')}>
          <span className="text-base leading-none">📊</span>
          <span className="truncate">Painel</span>
        </Link>

        <Link href="/configuracao" className={linkClass('/configuracao')}>
          <span className="text-base leading-none">🗄️</span>
          <span className="truncate">Dados</span>
        </Link>

        <Link href="/analise" className={linkClass('/analise')}>
          <span className="text-base leading-none">🧠</span>
          <span className="truncate">Análise</span>
        </Link>

        <Link href="/sobre" className={linkClass('/sobre')}>
          <span className="text-base leading-none">?</span>
          <span className="truncate">Sobre</span>
        </Link>
      </nav>
    </div>
  );
}