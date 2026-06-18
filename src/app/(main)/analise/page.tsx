'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

type ModoAnalise = 'municipio' | 'quadrante';

type GridCell = {
  id: string;
  code: string;
  center_latitude: number;
  center_longitude: number;
};

type ForecastRow = {
  forecast_date: string;
  max_temperature: number | null;
  min_temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  relative_humidity: number | null;
  shortwave_radiation: number | null;
  evapotranspiration: number | null;
  soil_moisture_0_to_7cm: number | null;
  fetched_at: string;
};

type HistoricalRow = {
  measurement_date: string;
  max_temperature: number | null;
  min_temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  relative_humidity: number | null;
  shortwave_radiation: number | null;
  evapotranspiration: number | null;
  soil_moisture_0_to_7cm: number | null;
};

type AnomalyRow = {
  anomaly_date: string;
  variable_name: string;
  observed_value: number | null;
  historical_mean: number | null;
  standard_deviation: number | null;
  sigma_score: number | null;
  risk_level: 'Alto' | 'Crítico' | string;
  message: string | null;
};

type ChartDataItem = {
  data: string;
  dataCompleta: string;
  temperatureMax: number | null;
  temperatureMin: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  humidity: number | null;
  humidityAttention: number;
  humidityCritical: number;
  shortwaveRadiation: number | null;
  evapotranspiration: number | null;
  temperatureMaxHistoricalMean: number | null;
  temperatureMaxHistoricalUpper: number | null;
  precipitationHistoricalMean: number | null;
  precipitationHistoricalP95: number | null;
  windHistoricalMean: number | null;
  windHistoricalP95: number | null;
};

type RiskByDate = {
  dateIso: string;
  data: string;
  riskLevel: 'Estável' | 'Atenção' | 'Alto' | 'Crítico';
  variables: string[];
};

type CompositeScoreItem = {
  data: string;
  dataCompleta: string;
  score: number | null;
  threshold95: number | null;
  riskLevel: string;
};

type MunicipalitySummaryRow = {
  total_active_quadrants: number;
  quadrants_with_forecast: number;
  quadrants_with_operational_risk: number;
  heavy_rain_quadrants: number;
  high_wind_quadrants: number;
  rain_wind_compound_quadrants: number;
  dry_air_quadrants: number;
  hot_dry_quadrants: number;
  max_temperature: number | null;
  max_wind_speed: number | null;
  min_relative_humidity: number | null;
  max_daily_precipitation: number | null;
  avg_accumulated_precipitation: number | null;
  max_operational_risk_score: number | null;
  accumulated_operational_risk_score: number | null;
};

type MunicipalityDailyRow = {
  forecast_date: string;
  quadrants_with_forecast: number;
  avg_max_temperature: number | null;
  max_temperature: number | null;
  avg_precipitation: number | null;
  max_daily_precipitation: number | null;
  avg_wind_speed: number | null;
  max_wind_speed: number | null;
  avg_relative_humidity: number | null;
  min_relative_humidity: number | null;
  heavy_rain_quadrants: number;
  high_wind_quadrants: number;
  dry_air_quadrants: number;
  rain_wind_compound_quadrants: number;
  hot_dry_quadrants: number;
  max_operational_risk_score: number | null;
  accumulated_operational_risk_score: number | null;
  risk_level: 'normal' | 'atencao' | 'alto' | 'critico' | string;
};

type MunicipalityRankingRow = {
  grid_cell_id: string;
  code: string;
  forecast_days: number;
  heavy_rain_days: number;
  high_wind_days: number;
  dry_air_days: number;
  rain_wind_compound_days: number;
  hot_dry_days: number;
  max_daily_precipitation: number | null;
  avg_daily_precipitation?: number | null;
  accumulated_precipitation: number | null;
  max_wind_speed: number | null;
  min_relative_humidity: number | null;
  max_temperature: number | null;
  max_operational_risk_score: number | null;
  accumulated_operational_risk_score: number | null;
  score_op_quadrante: number | null;
  nivel_risco_quadrante: string | null;
};

type MunicipalityChartItem = {
  data: string;
  dataCompleta: string;
  avgMaxTemperature: number | null;
  maxTemperature: number | null;
  avgPrecipitation: number | null;
  maxDailyPrecipitation: number | null;
  avgWindSpeed: number | null;
  maxWindSpeed: number | null;
  minHumidity: number | null;
  maxOperationalRiskScore: number | null;
};

type Mensagem = {
  tipo: 'sucesso' | 'erro' | '';
  texto: string;
};

type StatResult = {
  media: number;
  desvioPadrao: number;
  limiteSuperior: number;
  limiteInferior: number;
  p95: number;
};

type MonthlyHistoricalStats = {
  temperaturaMaxima: StatResult | null;
  temperaturaMinima: StatResult | null;
  precipitacao: StatResult | null;
  vento: StatResult | null;
  umidade: StatResult | null;
};

type OperationalAlertPresentation = {
  title: string;
  category: 'Energia e infraestrutura' | 'Condição ambiental' | 'Saúde pública';
  condition: string;
  impact: string;
  action: string;
  metricLabel: string;
  metricValue: string;
  limitLabel: string;
  limitValue: string;
  cardClass: string;
  badgeClass: string;
};

const LIMITE_UMIDADE_ATENCAO = 40;
const LIMITE_UMIDADE_CRITICA = 30;

const chartMargin = { top: 8, right: 8, left: -20, bottom: 32 };

const legendStyle = {
  paddingTop: '10px',
  fontSize: '12px',
  color: '#cbd5e1'
};

const tooltipStyle = {
  backgroundColor: '#0f172a',
  borderColor: '#334155',
  color: '#f8fafc'
};

const formatarDataCurta = (dataString: string) =>
  new Date(`${dataString}T00:00:00`)
    .toLocaleDateString('pt-BR')
    .substring(0, 5);

const formatarDataCompleta = (dataString: string) =>
  new Date(`${dataString}T00:00:00`).toLocaleDateString('pt-BR');

const toNumberOrNull = (value: unknown) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

const formatarNumero = (
  value: unknown,
  decimals = 1,
  fallback = '--'
): string => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed.toFixed(decimals);
};

function getTodayIsoDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);

  return localDate.toISOString().slice(0, 10);
}

function calcularPercentil(values: number[], percentile: number) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;

  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function getMonthKey(dateString: string) {
  return new Date(`${dateString}T00:00:00`).getMonth() + 1;
}

function calcularEstatisticaHistorica(values: unknown[]): StatResult | null {
  const valoresValidos = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (valoresValidos.length === 0) {
    return null;
  }

  const media =
    valoresValidos.reduce((acc, value) => acc + value, 0) /
    valoresValidos.length;

  const variancia =
    valoresValidos.reduce((acc, value) => acc + Math.pow(value - media, 2), 0) /
    valoresValidos.length;

  const desvioPadrao = Math.sqrt(variancia);

  return {
    media,
    desvioPadrao,
    limiteSuperior: media + 2 * desvioPadrao,
    limiteInferior: media - 2 * desvioPadrao,
    p95: calcularPercentil(valoresValidos, 95)
  };
}

function getVariableLabel(variableName: string) {
  const labels: Record<string, string> = {
    temperature_forecast: 'Temperatura',
    precipitation_forecast: 'Precipitação',
    humidity_forecast: 'Umidade',
    multivariate_weather_forecast: 'Evento composto'
  };

  return labels[variableName] || variableName;
}

function getRiskCardClass(riskLevel: RiskByDate['riskLevel']) {
  if (riskLevel === 'Crítico') {
    return 'border-rose-800 bg-rose-950/30 text-rose-200';
  }

  if (riskLevel === 'Alto') {
    return 'border-amber-800 bg-amber-950/30 text-amber-200';
  }

  if (riskLevel === 'Atenção') {
    return 'border-yellow-800 bg-yellow-950/20 text-yellow-200';
  }

  return 'border-slate-800 bg-slate-900 text-slate-400';
}

function getOperationalAlertPresentation(
  anomalia: AnomalyRow
): OperationalAlertPresentation {
  const isCritical = anomalia.risk_level === 'Crítico';

  const baseClasses = isCritical
    ? {
        cardClass: 'border-rose-900/60 bg-rose-950/30',
        badgeClass: 'bg-rose-500 text-white'
      }
    : {
        cardClass: 'border-amber-900/50 bg-amber-950/20',
        badgeClass: 'bg-amber-500 text-slate-950'
      };

  const metricValue = formatarNumero(anomalia.observed_value, 2);
  const limitValue = formatarNumero(anomalia.historical_mean, 2);

  if (anomalia.variable_name === 'multivariate_weather_forecast') {
    return {
      title: `${isCritical ? '🚨' : '⚠️'} Alerta ${
        isCritical ? 'Crítico' : 'Alto'
      } · Evento composto`,
      category: 'Energia e infraestrutura',
      condition:
        'Combinação anômala de variáveis climáticas projetada para o quadrante.',
      impact:
        'Eventos compostos podem aumentar a pressão sobre a infraestrutura urbana, especialmente quando envolvem chuva, vento ou calor elevado. A interpretação deve considerar a combinação das variáveis, não uma variável isolada.',
      action:
        'Priorizar o quadrante no monitoramento preventivo e verificar se a condição prevista envolve chuva forte, vento elevado ou calor intenso.',
      metricLabel: 'Distância estatística',
      metricValue,
      limitLabel: 'Limite estatístico',
      limitValue,
      ...baseClasses
    };
  }

  if (anomalia.variable_name === 'temperature_forecast') {
    return {
      title: `${isCritical ? '🚨' : '⚠️'} Alerta ${
        isCritical ? 'Crítico' : 'Alto'
      } · Temperatura elevada`,
      category: 'Energia e infraestrutura',
      condition:
        'Temperatura prevista acima do padrão histórico esperado para o quadrante.',
      impact:
        'Temperaturas elevadas podem aumentar a demanda por resfriamento, ampliar o estresse térmico em equipamentos e dificultar atividades de campo.',
      action:
        'Monitorar áreas com equipamentos sensíveis ao calor e avaliar reforço de prontidão operacional em períodos de pico térmico.',
      metricLabel: 'Temperatura ou desvio',
      metricValue,
      limitLabel: 'Referência histórica',
      limitValue,
      ...baseClasses
    };
  }

  if (anomalia.variable_name === 'precipitation_forecast') {
    return {
      title: `${isCritical ? '🚨' : '⚠️'} Alerta ${
        isCritical ? 'Crítico' : 'Alto'
      } · Chuva intensa`,
      category: 'Energia e infraestrutura',
      condition:
        'Precipitação prevista acima do padrão histórico esperado para o quadrante.',
      impact:
        'Chuva intensa pode aumentar risco de alagamentos pontuais, queda de galhos, instabilidade de solo, dificuldade de deslocamento e restrição de acesso das equipes.',
      action:
        'Priorizar monitoramento de áreas críticas, rotas de atendimento e pontos de infraestrutura expostos a alagamento ou queda de vegetação.',
      metricLabel: 'Precipitação ou desvio',
      metricValue,
      limitLabel: 'Referência histórica',
      limitValue,
      ...baseClasses
    };
  }

  if (anomalia.variable_name === 'wind_forecast') {
    return {
      title: `${isCritical ? '🚨' : '⚠️'} Alerta ${
        isCritical ? 'Crítico' : 'Alto'
      } · Vento elevado`,
      category: 'Energia e infraestrutura',
      condition:
        'Velocidade do vento prevista acima do padrão esperado para o quadrante.',
      impact:
        'Vento elevado pode aumentar risco de queda de galhos, objetos sobre a rede, dificuldade de deslocamento e ocorrências em estruturas expostas.',
      action:
        'Reforçar atenção em áreas arborizadas, redes expostas e regiões com histórico de ocorrências associadas a vento.',
      metricLabel: 'Vento ou desvio',
      metricValue,
      limitLabel: 'Referência histórica',
      limitValue,
      ...baseClasses
    };
  }

  if (anomalia.variable_name === 'humidity_forecast') {
    return {
      title: `${isCritical ? '🚨' : '⚠️'} Alerta ${
        isCritical ? 'Crítico' : 'Alto'
      } · Umidade baixa`,
      category: 'Condição ambiental',
      condition:
        'Umidade relativa projetada abaixo do padrão esperado para o quadrante.',
      impact:
        'A umidade baixa, isoladamente, não indica risco direto de interrupção de energia. Ela sinaliza condição ambiental seca, relevante para saúde pública, vegetação e risco potencial de incêndios quando combinada com outros fatores.',
      action:
        'Tratar como alerta ambiental auxiliar. Para risco elétrico, avaliar em conjunto com vento, calor, vegetação seca ou registros de incêndio.',
      metricLabel: 'Umidade ou desvio',
      metricValue,
      limitLabel: 'Referência histórica',
      limitValue,
      cardClass: 'border-yellow-900/50 bg-yellow-950/20',
      badgeClass: 'bg-yellow-500 text-slate-950'
    };
  }

  return {
    title: `${isCritical ? '🚨' : '⚠️'} Alerta ${
      isCritical ? 'Crítico' : 'Alto'
    } · ${getVariableLabel(anomalia.variable_name)}`,
    category: 'Energia e infraestrutura',
    condition:
      'Desvio estatístico relevante foi identificado na previsão do quadrante.',
    impact:
      'O desvio pode indicar aumento de pressão operacional sobre a infraestrutura monitorada.',
    action:
      'Acompanhar a evolução da previsão e priorizar o quadrante no monitoramento preventivo.',
    metricLabel: 'Valor observado',
    metricValue,
    limitLabel: 'Referência',
    limitValue,
    ...baseClasses
  };
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 px-4 text-slate-300">
      <p className="animate-pulse text-center text-sm font-medium">{label}</p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = 'text-slate-200'
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <p className="text-xs font-bold uppercase leading-tight text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-lg font-black ${tone}`}>{value}</p>
    </div>
  );
}

function ChartShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        {description}
      </p>
      <div className="h-[260px] min-h-[260px] w-full min-w-0 overflow-hidden text-xs">
        {children}
      </div>
    </div>
  );
}

function EcoForecastAnalysisContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium transition-colors ${
      pathname === path
        ? 'text-sky-400 font-bold'
        : 'text-slate-400 hover:text-slate-200'
    }`;

  const modoUrl = searchParams.get('modo');
  const gridCellIdUrl = searchParams.get('gridCellId');

  const [modoAnalise, setModoAnalise] = useState<ModoAnalise>(
    modoUrl === 'quadrante' ? 'quadrante' : 'municipio'
  );

  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [selectedGridCell, setSelectedGridCell] = useState(gridCellIdUrl || '');

  const [forecastRows, setForecastRows] = useState<ForecastRow[]>([]);
  const [historicalRows, setHistoricalRows] = useState<HistoricalRow[]>([]);
  const [anomalyRows, setAnomalyRows] = useState<AnomalyRow[]>([]);

  const [municipalitySummary, setMunicipalitySummary] =
    useState<MunicipalitySummaryRow | null>(null);

  const [municipalityDailyRows, setMunicipalityDailyRows] = useState<
    MunicipalityDailyRow[]
  >([]);

  const [municipalityRankingRows, setMunicipalityRankingRows] = useState<
    MunicipalityRankingRow[]
  >([]);

  const [carregandoOpcoes, setCarregandoOpcoes] = useState(true);
  const [carregandoAnalise, setCarregandoAnalise] = useState(false);
  const [mensagem, setMensagem] = useState<Mensagem>({ tipo: '', texto: '' });

  useEffect(() => {
    const novoModo = searchParams.get('modo');
    const novoGridCellId = searchParams.get('gridCellId');

    if (novoModo === 'quadrante') {
      setModoAnalise('quadrante');
    }

    if (novoGridCellId) {
      setSelectedGridCell(novoGridCellId);
    }
  }, [searchParams]);

  useEffect(() => {
    async function obterOpcoesAnalise() {
      try {
        setCarregandoOpcoes(true);

        const { data: gridCellsData, error: gridCellsError } = await supabase
          .from('analysis_grid')
          .select('id, code, center_latitude, center_longitude')
          .eq('is_active', true)
          .order('code');

        if (gridCellsError) {
          throw gridCellsError;
        }

        if (gridCellsData && gridCellsData.length > 0) {
          setGridCells(gridCellsData);

          setSelectedGridCell((valorAtual) => {
            if (
              valorAtual &&
              gridCellsData.some((cell) => cell.id === valorAtual)
            ) {
              return valorAtual;
            }

            if (
              gridCellIdUrl &&
              gridCellsData.some((cell) => cell.id === gridCellIdUrl)
            ) {
              return gridCellIdUrl;
            }

            return gridCellsData[0].id;
          });
        }
      } catch (error: any) {
        console.error('Erro ao carregar opções de análise:', error.message);

        setMensagem({
          tipo: 'erro',
          texto: 'Erro ao carregar os quadrantes ativos.'
        });
      } finally {
        setCarregandoOpcoes(false);
      }
    }

    obterOpcoesAnalise();
  }, [gridCellIdUrl]);

  const alvoNome = useMemo(() => {
    if (modoAnalise === 'quadrante') {
      return (
        gridCells.find((cell) => cell.id === selectedGridCell)?.code ||
        'Quadrante'
      );
    }

    return 'Área urbana de Goiânia';
  }, [gridCells, modoAnalise, selectedGridCell]);

  const carregarAnalise = async () => {
    try {
      setCarregandoAnalise(true);
      setMensagem({ tipo: '', texto: '' });

      setForecastRows([]);
      setHistoricalRows([]);
      setAnomalyRows([]);
      setMunicipalitySummary(null);
      setMunicipalityDailyRows([]);
      setMunicipalityRankingRows([]);

      if (modoAnalise === 'municipio') {
        const { data: summaryData, error: summaryError } = await supabase
          .from('climate_forecast_municipality_summary')
          .select('*')
          .maybeSingle();

        if (summaryError) {
          throw summaryError;
        }

        const { data: dailyData, error: dailyError } = await supabase
          .from('climate_forecast_municipality_daily_summary')
          .select('*')
          .order('forecast_date');

        if (dailyError) {
          throw dailyError;
        }

        const { data: rankingData, error: rankingError } = await supabase
          .from('climate_forecast_quadrant_ranking')
          .select(
            'grid_cell_id, code, forecast_days, heavy_rain_days, high_wind_days, dry_air_days, rain_wind_compound_days, hot_dry_days, max_daily_precipitation, avg_daily_precipitation, accumulated_precipitation, max_wind_speed, min_relative_humidity, max_temperature, max_operational_risk_score, accumulated_operational_risk_score, score_op_quadrante, nivel_risco_quadrante'
          )
          .order('score_op_quadrante', { ascending: false })
          .order('accumulated_operational_risk_score', { ascending: false })
          .order('max_operational_risk_score', { ascending: false })
          .order('max_daily_precipitation', { ascending: false })
          .order('max_wind_speed', { ascending: false })
          .limit(10);

        if (rankingError) {
          throw rankingError;
        }

        const rankingOrdenado = [...(rankingData || [])].sort((a, b) => {
          const scoreA = Number(a.score_op_quadrante ?? 0);
          const scoreB = Number(b.score_op_quadrante ?? 0);

          if (scoreB !== scoreA) {
            return scoreB - scoreA;
          }

          const acumuladoA = Number(a.accumulated_operational_risk_score ?? 0);
          const acumuladoB = Number(b.accumulated_operational_risk_score ?? 0);

          if (acumuladoB !== acumuladoA) {
            return acumuladoB - acumuladoA;
          }

          const maxScoreA = Number(a.max_operational_risk_score ?? 0);
          const maxScoreB = Number(b.max_operational_risk_score ?? 0);

          if (maxScoreB !== maxScoreA) {
            return maxScoreB - maxScoreA;
          }

          const chuvaA = Number(a.max_daily_precipitation ?? 0);
          const chuvaB = Number(b.max_daily_precipitation ?? 0);

          if (chuvaB !== chuvaA) {
            return chuvaB - chuvaA;
          }

          const ventoA = Number(a.max_wind_speed ?? 0);
          const ventoB = Number(b.max_wind_speed ?? 0);

          return ventoB - ventoA;
        });

        setMunicipalitySummary(summaryData as MunicipalitySummaryRow | null);
        setMunicipalityDailyRows((dailyData || []) as MunicipalityDailyRow[]);
        setMunicipalityRankingRows(rankingOrdenado as MunicipalityRankingRow[]);

        if (!dailyData || dailyData.length === 0) {
          setMensagem({
            tipo: 'erro',
            texto:
              'Ainda não há previsão consolidada para a área urbana de Goiânia. Execute o job diário para atualizar os quadrantes ativos.'
          });
        }

        return;
      }

      if (!selectedGridCell) {
        throw new Error('Selecione um quadrante válido.');
      }

      const todayIso = getTodayIsoDate();

      const { data: forecasts, error: forecastError } = await supabase
        .from('climate_forecasts')
        .select(
          'forecast_date, max_temperature, min_temperature, precipitation, wind_speed, relative_humidity, shortwave_radiation, evapotranspiration, soil_moisture_0_to_7cm, fetched_at'
        )
        .eq('grid_cell_id', selectedGridCell)
        .gte('forecast_date', todayIso)
        .order('forecast_date');

      if (forecastError) {
        throw forecastError;
      }

      const { data: historical, error: historicalError } = await supabase
        .from('climate_series')
        .select(
          'measurement_date, max_temperature, min_temperature, precipitation, wind_speed, relative_humidity, shortwave_radiation, evapotranspiration, soil_moisture_0_to_7cm'
        )
        .eq('grid_cell_id', selectedGridCell)
        .range(0, 5000);

      if (historicalError) {
        throw historicalError;
      }

      const { data: anomalies, error: anomaliesError } = await supabase
        .from('grid_anomalies')
        .select(
          'anomaly_date, variable_name, observed_value, historical_mean, standard_deviation, sigma_score, risk_level, message'
        )
        .eq('grid_cell_id', selectedGridCell)
        .gte('anomaly_date', todayIso)
        .order('anomaly_date');

      if (anomaliesError) {
        throw anomaliesError;
      }

      setForecastRows((forecasts || []) as ForecastRow[]);
      setHistoricalRows((historical || []) as HistoricalRow[]);
      setAnomalyRows((anomalies || []) as AnomalyRow[]);

      if (!forecasts || forecasts.length === 0) {
        setMensagem({
          tipo: 'erro',
          texto:
            'Ainda não há previsão salva para este quadrante. Execute o job diário ou acesse a tela Dados para atualizar.'
        });
      }
    } catch (error: any) {
      console.error(error);

      setMensagem({
        tipo: 'erro',
        texto: error.message || 'Erro inesperado ao carregar análise.'
      });
    } finally {
      setCarregandoAnalise(false);
    }
  };

  useEffect(() => {
    if (carregandoOpcoes) return;

    if (modoAnalise === 'municipio') {
      carregarAnalise();
      return;
    }

    if (modoAnalise === 'quadrante' && selectedGridCell) {
      carregarAnalise();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoOpcoes, modoAnalise, selectedGridCell]);

  const statsByMonth = useMemo(() => {
    const months = Array.from(
      new Set(forecastRows.map((row) => getMonthKey(row.forecast_date)))
    );

    const result = new Map<number, MonthlyHistoricalStats>();

    months.forEach((month) => {
      const rowsOfMonth = historicalRows.filter(
        (row) =>
          row.measurement_date && getMonthKey(row.measurement_date) === month
      );

      result.set(month, {
        temperaturaMaxima: calcularEstatisticaHistorica(
          rowsOfMonth.map((row) => row.max_temperature)
        ),
        temperaturaMinima: calcularEstatisticaHistorica(
          rowsOfMonth.map((row) => row.min_temperature)
        ),
        precipitacao: calcularEstatisticaHistorica(
          rowsOfMonth.map((row) => row.precipitation)
        ),
        vento: calcularEstatisticaHistorica(
          rowsOfMonth.map((row) => row.wind_speed)
        ),
        umidade: calcularEstatisticaHistorica(
          rowsOfMonth.map((row) => row.relative_humidity)
        )
      });
    });

    return result;
  }, [forecastRows, historicalRows]);

  const chartData = useMemo<ChartDataItem[]>(() => {
    return forecastRows.map((row) => {
      const monthStats = statsByMonth.get(getMonthKey(row.forecast_date));

      return {
        data: formatarDataCurta(row.forecast_date),
        dataCompleta: formatarDataCompleta(row.forecast_date),
        temperatureMax: toNumberOrNull(row.max_temperature),
        temperatureMin: toNumberOrNull(row.min_temperature),
        precipitation: toNumberOrNull(row.precipitation),
        windSpeed: toNumberOrNull(row.wind_speed),
        humidity: toNumberOrNull(row.relative_humidity),
        humidityAttention: LIMITE_UMIDADE_ATENCAO,
        humidityCritical: LIMITE_UMIDADE_CRITICA,
        shortwaveRadiation: toNumberOrNull(row.shortwave_radiation),
        evapotranspiration: toNumberOrNull(row.evapotranspiration),
        temperatureMaxHistoricalMean:
          monthStats?.temperaturaMaxima?.media ?? null,
        temperatureMaxHistoricalUpper:
          monthStats?.temperaturaMaxima?.limiteSuperior ?? null,
        precipitationHistoricalMean: monthStats?.precipitacao?.media ?? null,
        precipitationHistoricalP95: monthStats?.precipitacao?.p95 ?? null,
        windHistoricalMean: monthStats?.vento?.media ?? null,
        windHistoricalP95: monthStats?.vento?.p95 ?? null
      };
    });
  }, [forecastRows, statsByMonth]);

  const municipalityChartData = useMemo<MunicipalityChartItem[]>(() => {
    return municipalityDailyRows.map((row) => ({
      data: formatarDataCurta(row.forecast_date),
      dataCompleta: formatarDataCompleta(row.forecast_date),
      avgMaxTemperature: toNumberOrNull(row.avg_max_temperature),
      maxTemperature: toNumberOrNull(row.max_temperature),
      avgPrecipitation: toNumberOrNull(row.avg_precipitation),
      maxDailyPrecipitation: toNumberOrNull(row.max_daily_precipitation),
      avgWindSpeed: toNumberOrNull(row.avg_wind_speed),
      maxWindSpeed: toNumberOrNull(row.max_wind_speed),
      minHumidity: toNumberOrNull(row.min_relative_humidity),
      maxOperationalRiskScore: toNumberOrNull(row.max_operational_risk_score)
    }));
  }, [municipalityDailyRows]);

  const riskByDate = useMemo<RiskByDate[]>(() => {
    return forecastRows.map((forecast) => {
      const anomaliesForDate = anomalyRows.filter(
        (anomalia) => anomalia.anomaly_date === forecast.forecast_date
      );

      const hasCritical = anomaliesForDate.some(
        (anomalia) => anomalia.risk_level === 'Crítico'
      );

      const hasHigh = anomaliesForDate.some(
        (anomalia) => anomalia.risk_level === 'Alto'
      );

      const riskLevel = hasCritical ? 'Crítico' : hasHigh ? 'Alto' : 'Estável';

      return {
        dateIso: forecast.forecast_date,
        data: formatarDataCurta(forecast.forecast_date),
        riskLevel,
        variables: anomaliesForDate.map((anomalia) =>
          getVariableLabel(anomalia.variable_name)
        )
      };
    });
  }, [anomalyRows, forecastRows]);

  const municipalityRiskByDate = useMemo<RiskByDate[]>(() => {
    return municipalityDailyRows.map((row) => {
      const riskLevelMap: Record<string, RiskByDate['riskLevel']> = {
        normal: 'Estável',
        atencao: 'Atenção',
        alto: 'Alto',
        critico: 'Crítico'
      };

      const variables: string[] = [];

      if (Number(row.heavy_rain_quadrants || 0) > 0) {
        variables.push(
          `${row.heavy_rain_quadrants} quadrante(s) com chuva forte`
        );
      }

      if (Number(row.high_wind_quadrants || 0) > 0) {
        variables.push(
          `${row.high_wind_quadrants} quadrante(s) com vento forte`
        );
      }

      if (Number(row.rain_wind_compound_quadrants || 0) > 0) {
        variables.push(
          `${row.rain_wind_compound_quadrants} quadrante(s) com chuva + vento`
        );
      }

      return {
        dateIso: row.forecast_date,
        data: formatarDataCurta(row.forecast_date),
        riskLevel: riskLevelMap[row.risk_level] || 'Estável',
        variables
      };
    });
  }, [municipalityDailyRows]);

  const compositeScoreData = useMemo<CompositeScoreItem[]>(() => {
    return anomalyRows
      .filter(
        (anomalia) => anomalia.variable_name === 'multivariate_weather_forecast'
      )
      .map((anomalia) => ({
        data: formatarDataCurta(anomalia.anomaly_date),
        dataCompleta: formatarDataCompleta(anomalia.anomaly_date),
        score: toNumberOrNull(anomalia.observed_value),
        threshold95: toNumberOrNull(anomalia.historical_mean),
        riskLevel: anomalia.risk_level
      }));
  }, [anomalyRows]);

  const resumo = useMemo(() => {
    const temperaturas = forecastRows
      .map((row) => toNumberOrNull(row.max_temperature))
      .filter((value): value is number => value !== null);

    const chuvas = forecastRows
      .map((row) => toNumberOrNull(row.precipitation))
      .filter((value): value is number => value !== null);

    const umidades = forecastRows
      .map((row) => toNumberOrNull(row.relative_humidity))
      .filter((value): value is number => value !== null);

    const ventos = forecastRows
      .map((row) => toNumberOrNull(row.wind_speed))
      .filter((value): value is number => value !== null);

    const compositeScores = compositeScoreData
      .map((item) => item.score)
      .filter((value): value is number => value !== null);

    return {
      maiorTemperatura:
        temperaturas.length > 0 ? Math.max(...temperaturas) : null,
      maiorVento: ventos.length > 0 ? Math.max(...ventos) : null,
      chuvaAcumulada:
        chuvas.length > 0
          ? chuvas.reduce((acc, value) => acc + value, 0)
          : null,
      menorUmidade: umidades.length > 0 ? Math.min(...umidades) : null,
      maiorScoreMultivariado:
        compositeScores.length > 0 ? Math.max(...compositeScores) : null,
      alertasCriticos: anomalyRows.filter(
        (anomalia) => anomalia.risk_level === 'Crítico'
      ).length,
      alertasAltos: anomalyRows.filter(
        (anomalia) => anomalia.risk_level === 'Alto'
      ).length
    };
  }, [anomalyRows, compositeScoreData, forecastRows]);

  if (carregandoOpcoes) {
    return <LoadingScreen label="Carregando dados estatísticos preditivos..." />;
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-md border-x border-slate-800 bg-slate-950 px-4 py-6 pb-24 font-sans text-slate-100 shadow-2xl">
      <header className="mb-6 border-b border-slate-800 pb-4">
        <h1 className="text-lg font-bold text-sky-400">
          Análise Operacional
        </h1>

        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Avaliação diária de risco climático por visão consolidada e por
          quadrante.
        </p>
      </header>

      {mensagem.texto && (
        <div
          className={`mb-4 rounded-xl border p-3 text-xs font-medium leading-relaxed ${
            mensagem.tipo === 'sucesso'
              ? 'border-emerald-800 bg-emerald-950/50 text-emerald-300'
              : 'border-rose-800 bg-rose-950/50 text-rose-300'
          }`}
        >
          {mensagem.texto}
        </div>
      )}

      <section className="mb-5 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
          Tipo de análise
        </label>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setModoAnalise('municipio')}
            className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase transition-colors ${
              modoAnalise === 'municipio'
                ? 'border-sky-500 bg-sky-600 text-white'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-sky-700 hover:text-slate-200'
            }`}
          >
            Visão geral
          </button>

          <button
            type="button"
            onClick={() => setModoAnalise('quadrante')}
            className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase transition-colors ${
              modoAnalise === 'quadrante'
                ? 'border-sky-500 bg-sky-600 text-white'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-sky-700 hover:text-slate-200'
            }`}
          >
            Quadrante
          </button>
        </div>

        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
          {modoAnalise === 'quadrante'
            ? 'Selecione o quadrante H3'
            : 'Área consolidada'}
        </label>

        <div className="flex gap-2">
          {modoAnalise === 'quadrante' ? (
            <select
              value={selectedGridCell}
              onChange={(event) => setSelectedGridCell(event.target.value)}
              className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              {gridCells.map((cell) => (
                <option key={cell.id} value={cell.id}>
                  {cell.code}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              Área urbana de Goiânia
            </div>
          )}

          <button
            type="button"
            onClick={carregarAnalise}
            disabled={carregandoAnalise}
            className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-colors hover:bg-sky-500 active:bg-sky-700 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {carregandoAnalise ? 'Carregando...' : 'Carregar'}
          </button>
        </div>

        <p className="mt-3 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-500">
          Alvo atual: {alvoNome}
        </p>
      </section>

      {modoAnalise === 'municipio' && municipalitySummary && (
        <section className="space-y-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-bold text-sky-300">
              Visão consolidada da área urbana de Goiânia
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Esta visão consolida os quadrantes H3 ativos do protótipo. Os
              indicadores traduzem a previsão dos próximos dias em leitura
              executiva para priorização operacional.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <KpiCard
              label="Quadrantes ativos"
              value={municipalitySummary.total_active_quadrants}
              tone="text-sky-300"
            />
            <KpiCard
              label="Com previsão"
              value={municipalitySummary.quadrants_with_forecast}
              tone="text-emerald-300"
            />
            <KpiCard
              label="Com risco op."
              value={municipalitySummary.quadrants_with_operational_risk}
              tone="text-amber-300"
            />
            <KpiCard
              label="Chuva + vento"
              value={municipalitySummary.rain_wind_compound_quadrants}
              tone="text-rose-300"
            />
            <KpiCard
              label="Maior temp."
              value={
                municipalitySummary.max_temperature !== null
                  ? `${formatarNumero(municipalitySummary.max_temperature)}°C`
                  : '--'
              }
              tone="text-sky-300"
            />
            <KpiCard
              label="Maior vento"
              value={
                municipalitySummary.max_wind_speed !== null
                  ? `${formatarNumero(
                      municipalitySummary.max_wind_speed
                    )} km/h`
                  : '--'
              }
              tone="text-cyan-300"
            />
            <KpiCard
              label="Menor umid."
              value={
                municipalitySummary.min_relative_humidity !== null
                  ? `${formatarNumero(
                      municipalitySummary.min_relative_humidity
                    )}%`
                  : '--'
              }
              tone="text-amber-300"
            />
            <KpiCard
              label="Score op."
              value={
                municipalitySummary.max_operational_risk_score !== null
                  ? formatarNumero(
                      municipalitySummary.max_operational_risk_score,
                      0
                    )
                  : '--'
              }
              tone="text-fuchsia-300"
            />
          </div>

          {municipalityRiskByDate.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
                Régua diária municipal
              </h3>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {municipalityRiskByDate.map((item) => (
                  <div
                    key={item.dateIso}
                    className={`min-w-[88px] rounded-lg border p-2 text-center ${getRiskCardClass(
                      item.riskLevel
                    )}`}
                    title={item.variables.join(', ') || 'Sem risco operacional'}
                  >
                    <p className="text-xs font-bold">{item.data}</p>
                    <p className="mt-1 text-xs uppercase">{item.riskLevel}</p>
                  </div>
                ))}
              </div>

              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                A régua resume o maior nível de risco operacional observado
                entre os quadrantes ativos em cada dia.
              </p>
            </section>
          )}

          {municipalityChartData.length > 0 && (
            <>
              <ChartShell
                title="Temperatura municipal agregada"
                description="Compara a média dos quadrantes com a maior temperatura prevista na área urbana."
              >
                <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
                  <LineChart data={municipalityChartData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="data" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend verticalAlign="bottom" wrapperStyle={legendStyle} />
                    <Line
                      type="linear"
                      dataKey="avgMaxTemperature"
                      name="Média dos quadrantes"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot
                    />
                    <Line
                      type="linear"
                      dataKey="maxTemperature"
                      name="Maior valor previsto"
                      stroke="#fb7185"
                      strokeWidth={2}
                      dot
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartShell>

              <ChartShell
                title="Precipitação municipal agregada"
                description="Mostra a precipitação média dos quadrantes e o maior valor diário previsto."
              >
                <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
                  <ComposedChart data={municipalityChartData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="data" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend verticalAlign="bottom" wrapperStyle={legendStyle} />
                    <Bar
                      dataKey="avgPrecipitation"
                      name="Média dos quadrantes"
                      fill="#22c55e"
                    />
                    <Line
                      type="linear"
                      dataKey="maxDailyPrecipitation"
                      name="Maior valor previsto"
                      stroke="#fb7185"
                      strokeWidth={2}
                      dot
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartShell>

              <ChartShell
                title="Vento municipal agregado"
                description="Mostra a média dos quadrantes e o maior vento previsto na área urbana."
              >
                <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
                  <LineChart data={municipalityChartData} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="data" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend verticalAlign="bottom" wrapperStyle={legendStyle} />
                    <Line
                      type="linear"
                      dataKey="avgWindSpeed"
                      name="Média dos quadrantes"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot
                    />
                    <Line
                      type="linear"
                      dataKey="maxWindSpeed"
                      name="Maior valor previsto"
                      stroke="#fb7185"
                      strokeWidth={2}
                      dot
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartShell>
            </>
          )}

          {municipalityRankingRows.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
                Quadrantes mais relevantes no consolidado
              </h3>

              <div className="space-y-3">
                {municipalityRankingRows.map((row) => (
                  <div
                    key={row.grid_cell_id}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-bold text-slate-100">
                        {row.code}
                      </p>

                      <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-300">
                        Score{Number(row.score_op_quadrante ?? 0)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs leading-relaxed text-slate-400">
                      <p>Chuva forte: {row.heavy_rain_days} dia(s)</p>
                      <p>Vento forte: {row.high_wind_days} dia(s)</p>
                      <p>
                        Chuva + vento: {row.rain_wind_compound_days} dia(s)
                      </p>
                      <p>
                        Vento máx:{' '}
                        {row.max_wind_speed !== null
                          ? `${formatarNumero(row.max_wind_speed)} km/h`
                          : '--'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>
      )}

      {modoAnalise === 'quadrante' && forecastRows.length > 0 && (
        <section className="mb-5 grid grid-cols-2 gap-2">
          <KpiCard
            label="Maior temp."
            value={
              resumo.maiorTemperatura !== null
                ? `${resumo.maiorTemperatura.toFixed(1)}°C`
                : '--'
            }
            tone="text-sky-300"
          />
          <KpiCard
            label="Chuva acum."
            value={
              resumo.chuvaAcumulada !== null
                ? `${resumo.chuvaAcumulada.toFixed(1)} mm`
                : '--'
            }
            tone="text-emerald-300"
          />
          <KpiCard
            label="Menor umid."
            value={
              resumo.menorUmidade !== null
                ? `${resumo.menorUmidade.toFixed(1)}%`
                : '--'
            }
            tone="text-amber-300"
          />
          <KpiCard
            label="Maior vento"
            value={
              resumo.maiorVento !== null
                ? `${resumo.maiorVento.toFixed(1)} km/h`
                : '--'
            }
            tone="text-cyan-300"
          />
          <KpiCard
            label="Score comp."
            value={
              resumo.maiorScoreMultivariado !== null
                ? resumo.maiorScoreMultivariado.toFixed(1)
                : '--'
            }
            tone="text-fuchsia-300"
          />
          <KpiCard
            label="Alertas"
            value={`${resumo.alertasCriticos}C / ${resumo.alertasAltos}A`}
            tone="text-rose-300"
          />
        </section>
      )}

      {modoAnalise === 'quadrante' && riskByDate.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
            Régua diária de risco
          </h3>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {riskByDate.map((item) => (
              <div
                key={item.dateIso}
                className={`min-w-[88px] rounded-lg border p-2 text-center ${getRiskCardClass(
                  item.riskLevel
                )}`}
                title={item.variables.join(', ') || 'Sem anomalia'}
              >
                <p className="text-xs font-bold">{item.data}</p>
                <p className="mt-1 text-xs uppercase">{item.riskLevel}</p>
              </div>
            ))}
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            A régua mostra o maior nível de risco calculado para cada dia,
            considerando alertas univariados e anomalia composta.
          </p>
        </section>
      )}

      {modoAnalise === 'quadrante' && chartData.length > 0 && (
        <section className="space-y-5">
          <ChartShell
            title="Temperatura projetada"
            description="Compara a temperatura prevista com a média e o limite histórico do mesmo mês."
          >
            <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
              <LineChart data={chartData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" wrapperStyle={legendStyle} />
                <Line
                  type="linear"
                  dataKey="temperatureMaxHistoricalMean"
                  name="Média histórica"
                  stroke="#64748b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="linear"
                  dataKey="temperatureMaxHistoricalUpper"
                  name="Limite histórico"
                  stroke="#fb7185"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="linear"
                  dataKey="temperatureMax"
                  name="Temperatura máxima"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot
                />
                <Line
                  type="linear"
                  dataKey="temperatureMin"
                  name="Temperatura mínima"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartShell>

          <ChartShell
            title="Precipitação projetada"
            description="Mostra a chuva diária prevista em comparação com a média e o P95 histórico do mesmo mês."
          >
            <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
              <ComposedChart data={chartData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" wrapperStyle={legendStyle} />
                <Line
                  type="linear"
                  dataKey="precipitationHistoricalMean"
                  name="Média histórica"
                  stroke="#64748b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="linear"
                  dataKey="precipitationHistoricalP95"
                  name="P95 histórico"
                  stroke="#fb7185"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Bar
                  dataKey="precipitation"
                  name="Precipitação"
                  fill="#22c55e"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartShell>

          <ChartShell
            title="Vento máximo projetado"
            description="Compara o vento previsto com a média e o P95 histórico do mesmo mês."
          >
            <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
              <LineChart data={chartData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" wrapperStyle={legendStyle} />
                <Line
                  type="linear"
                  dataKey="windHistoricalMean"
                  name="Média histórica"
                  stroke="#64748b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="linear"
                  dataKey="windHistoricalP95"
                  name="P95 histórico"
                  stroke="#fb7185"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="linear"
                  dataKey="windSpeed"
                  name="Vento previsto"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartShell>

          <ChartShell
            title="Umidade relativa projetada"
            description="Mostra quando a umidade projetada se aproxima de faixas de atenção e criticidade."
          >
            <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
              <LineChart data={chartData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" stroke="#64748b" />
                <YAxis stroke="#64748b" domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" wrapperStyle={legendStyle} />
                <Line
                  type="linear"
                  dataKey="humidityAttention"
                  name="Atenção 40%"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="linear"
                  dataKey="humidityCritical"
                  name="Crítico 30%"
                  stroke="#fb7185"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="linear"
                  dataKey="humidity"
                  name="Umidade relativa"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartShell>
        </section>
      )}

      {modoAnalise === 'quadrante' && compositeScoreData.length > 0 && (
        <div className="mt-5">
          <ChartShell
            title="Score multivariado de anomalia"
            description="Representa quanto a combinação de variáveis projetadas se afasta do padrão histórico do quadrante."
          >
            <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
              <ComposedChart data={compositeScoreData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" wrapperStyle={legendStyle} />
                <Bar
                  dataKey="score"
                  name="Score multivariado"
                  fill="#fb7185"
                />
                <Line
                  type="linear"
                  dataKey="threshold95"
                  name="Limite histórico"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>
      )}

      {modoAnalise === 'quadrante' && (
        <section className="mt-6 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Alertas calculados
          </h3>

          {anomalyRows.length === 0 ? (
            <div className="rounded-xl border border-slate-900 bg-slate-900/40 p-4 text-center">
              <p className="text-xs leading-relaxed text-slate-500">
                🌤️ Nenhuma anomalia salva para este quadrante no horizonte de
                previsão atual.
              </p>
            </div>
          ) : (
            anomalyRows.map((anomalia, idx) => {
              const alert = getOperationalAlertPresentation(anomalia);

              return (
                <div
                  key={`${anomalia.anomaly_date}-${anomalia.variable_name}-${idx}`}
                  className={`space-y-4 rounded-xl border p-4 shadow-sm ${alert.cardClass}`}
                >
                  <div className="space-y-1">
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs font-bold uppercase ${alert.badgeClass}`}
                    >
                      {alert.title}
                    </span>

                    <p className="text-xs font-medium text-slate-400">
                      Projeção: {formatarDataCompleta(anomalia.anomaly_date)}
                    </p>
                  </div>

                  <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                    <div>
                      <p className="font-bold text-slate-100">Condição prevista</p>
                      <p>{alert.condition}</p>
                    </div>

                    <div>
                      <p className="font-bold text-slate-100">Impacto esperado</p>
                      <p>{alert.impact}</p>
                    </div>

                    <div>
                      <p className="font-bold text-slate-100">Ação recomendada</p>
                      <p>{alert.action}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs font-bold uppercase ${alert.badgeClass}`}
                    >
                      {alert.title}
                    </span>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-300">
                        {alert.category}
                      </span>

                      <span className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-400">
                        Projeção: {formatarDataCompleta(anomalia.anomaly_date)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                    <span className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-400">
                      {alert.metricLabel}: {alert.metricValue}
                    </span>

                    <span className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-400">
                      {alert.limitLabel}: {alert.limitValue}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

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

export default function EcoForecastAnalysisPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Carregando análise climática..." />}>
      <EcoForecastAnalysisContent />
    </Suspense>
  );
}
