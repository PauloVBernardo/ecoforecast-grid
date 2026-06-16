'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart
} from 'recharts';

type ModoAnalise = 'municipio' | 'quadrante';

type Region = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

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

const LIMITE_UMIDADE_ATENCAO = 40;
const LIMITE_UMIDADE_CRITICA = 30;

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
    multivariate_weather_forecast: 'Anomalia composta'
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

export default function EcoForecastAnalysisPage() {
  const searchParams = useSearchParams();

  const modoUrl = searchParams.get('modo');
  const gridCellIdUrl = searchParams.get('gridCellId');

  const [modoAnalise, setModoAnalise] = useState<ModoAnalise>(
    modoUrl === 'quadrante' ? 'quadrante' : 'municipio'
  );

  const [regions, setRegions] = useState<Region[]>([]);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);

  const [selectedRegion, setSelectedRegion] = useState('');
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

        const { data: regioesData, error: regioesError } = await supabase
          .from('regions_grid')
          .select('id, name, latitude, longitude')
          .order('name');

        if (regioesError) {
          throw regioesError;
        }

        const { data: gridCellsData, error: gridCellsError } = await supabase
          .from('analysis_grid')
          .select('id, code, center_latitude, center_longitude')
          .eq('is_active', true)
          .order('code');

        if (gridCellsError) {
          throw gridCellsError;
        }

        if (regioesData && regioesData.length > 0) {
          setRegions(regioesData);
          setSelectedRegion((valorAtual) => valorAtual || regioesData[0].id);
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
          texto: 'Erro ao carregar municípios e quadrantes.'
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
          .from('climate_forecast_operational_summary')
          .select(
            'grid_cell_id, code, forecast_days, heavy_rain_days, high_wind_days, dry_air_days, rain_wind_compound_days, hot_dry_days, max_daily_precipitation, avg_daily_precipitation, accumulated_precipitation, max_wind_speed, min_relative_humidity, max_temperature, max_operational_risk_score, accumulated_operational_risk_score'
          )
          .order('max_operational_risk_score', { ascending: false })
          .order('accumulated_operational_risk_score', { ascending: false })
          .limit(10);

        if (rankingError) {
          throw rankingError;
        }

        setMunicipalitySummary(summaryData as MunicipalitySummaryRow | null);
        setMunicipalityDailyRows((dailyData || []) as MunicipalityDailyRow[]);
        setMunicipalityRankingRows(
          (rankingData || []) as MunicipalityRankingRow[]
        );

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

    const maiorTemperatura =
      temperaturas.length > 0 ? Math.max(...temperaturas) : null;

    const maiorVento = ventos.length > 0 ? Math.max(...ventos) : null;

    const chuvaAcumulada =
      chuvas.length > 0
        ? chuvas.reduce((acc, value) => acc + value, 0)
        : null;

    const menorUmidade = umidades.length > 0 ? Math.min(...umidades) : null;

    const maiorScoreMultivariado =
      compositeScores.length > 0 ? Math.max(...compositeScores) : null;

    const alertasCriticos = anomalyRows.filter(
      (anomalia) => anomalia.risk_level === 'Crítico'
    ).length;

    const alertasAltos = anomalyRows.filter(
      (anomalia) => anomalia.risk_level === 'Alto'
    ).length;

    return {
      maiorTemperatura,
      maiorVento,
      chuvaAcumulada,
      menorUmidade,
      maiorScoreMultivariado,
      alertasCriticos,
      alertasAltos
    };
  }, [anomalyRows, compositeScoreData, forecastRows]);

  if (carregandoOpcoes) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-300">
        <p className="font-medium animate-pulse">
          Carregando dados estatísticos preditivos...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 px-4 py-6 font-sans text-slate-100 max-w-md mx-auto shadow-2xl border-x border-slate-800 pb-20">
      <header className="mb-6 border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-sky-400">
          Previsão de Desvios
        </h1>

        <p className="text-xs text-slate-400">
          Leitura das previsões, referências históricas e anomalias processadas
          no Supabase
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

      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-4 shadow-sm">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Tipo de análise
        </label>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setModoAnalise('municipio')}
            className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase transition-colors ${
              modoAnalise === 'municipio'
                ? 'bg-sky-600 border-sky-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-sky-700 hover:text-slate-200'
            }`}
          >
            Município
          </button>

          <button
            type="button"
            onClick={() => setModoAnalise('quadrante')}
            className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase transition-colors ${
              modoAnalise === 'quadrante'
                ? 'bg-sky-600 border-sky-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-sky-700 hover:text-slate-200'
            }`}
          >
            Quadrante
          </button>
        </div>

        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          {modoAnalise === 'quadrante'
            ? 'Selecione o Quadrante H3'
            : 'Área consolidada'}
        </label>

        <div className="flex gap-2">
          {modoAnalise === 'quadrante' ? (
            <select
              value={selectedGridCell}
              onChange={(e) => setSelectedGridCell(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 text-slate-200"
            >
              {gridCells.map((cell) => (
                <option key={cell.id} value={cell.id}>
                  {cell.code}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
              Área urbana de Goiânia
            </div>
          )}

          <button
            onClick={carregarAnalise}
            disabled={carregandoAnalise}
            className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md active:bg-sky-700 transition-colors disabled:bg-slate-800 disabled:text-slate-500"
          >
            {carregandoAnalise ? 'Carregando...' : 'Carregar'}
          </button>
        </div>

        <p className="text-[10px] text-slate-500 mt-3 font-mono">
          Alvo atual: {alvoNome}
        </p>
      </div>

      {modoAnalise === 'municipio' && municipalitySummary && (
        <section className="space-y-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-sm font-bold text-sky-300">
              Visão consolidada da área urbana de Goiânia
            </h2>

            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              Esta visão consolida os quadrantes H3 ativos do protótipo. Os
              indicadores representam uma leitura executiva da previsão
              operacional para os próximos dias.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-[9px] text-slate-500 uppercase font-bold">
                Quadrantes ativos
              </p>
              <p className="text-lg font-black text-sky-300">
                {municipalitySummary.total_active_quadrants}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-[9px] text-slate-500 uppercase font-bold">
                Com previsão
              </p>
              <p className="text-lg font-black text-emerald-300">
                {municipalitySummary.quadrants_with_forecast}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-[9px] text-slate-500 uppercase font-bold">
                Com risco op.
              </p>
              <p className="text-lg font-black text-amber-300">
                {municipalitySummary.quadrants_with_operational_risk}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-[9px] text-slate-500 uppercase font-bold">
                Chuva + vento
              </p>
              <p className="text-lg font-black text-rose-300">
                {municipalitySummary.rain_wind_compound_quadrants}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-[9px] text-slate-500 uppercase font-bold">
                Maior temp.
              </p>
              <p className="text-lg font-black text-sky-300">
                {municipalitySummary.max_temperature !== null
                  ? `${formatarNumero(municipalitySummary.max_temperature)}°C`
                  : '--'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-[9px] text-slate-500 uppercase font-bold">
                Maior vento
              </p>
              <p className="text-lg font-black text-cyan-300">
                {municipalitySummary.max_wind_speed !== null
                  ? `${formatarNumero(
                      municipalitySummary.max_wind_speed
                    )} km/h`
                  : '--'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-[9px] text-slate-500 uppercase font-bold">
                Menor umid.
              </p>
              <p className="text-lg font-black text-amber-300">
                {municipalitySummary.min_relative_humidity !== null
                  ? `${formatarNumero(
                      municipalitySummary.min_relative_humidity
                    )}%`
                  : '--'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-[9px] text-slate-500 uppercase font-bold">
                Score op.
              </p>
              <p className="text-lg font-black text-fuchsia-300">
                {municipalitySummary.max_operational_risk_score !== null
                  ? formatarNumero(
                      municipalitySummary.max_operational_risk_score,
                      0
                    )
                  : '--'}
              </p>
            </div>
          </div>

          {municipalityRiskByDate.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Régua diária municipal
              </h3>

              <div className="grid grid-cols-7 gap-1.5">
                {municipalityRiskByDate.map((item) => (
                  <div
                    key={item.dateIso}
                    className={`rounded-lg border p-2 text-center ${getRiskCardClass(
                      item.riskLevel
                    )}`}
                    title={item.variables.join(', ') || 'Sem risco operacional'}
                  >
                    <p className="text-[9px] font-bold">{item.data}</p>
                    <p className="text-[9px] uppercase mt-1">
                      {item.riskLevel}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-slate-500 mt-2">
                A régua resume o maior nível de risco operacional observado
                entre os quadrantes ativos em cada dia.
              </p>
            </section>
          )}

          {municipalityChartData.length > 0 && (
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Temperatura municipal agregada
              </h3>

              <p className="text-[10px] text-slate-500 mb-3">
                Compara a média dos quadrantes com a maior temperatura prevista
                na área urbana.
              </p>

              <div className="h-[260px] min-h-[260px] w-full min-w-0 overflow-hidden text-[10px]">
                <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
                  <LineChart
                    data={municipalityChartData}
                    margin={{ top: 5, right: 5, left: -25, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="data" stroke="#64748b" />
                    <YAxis stroke="#64748b" />

                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        color: '#f8fafc'
                      }}
                    />

                    <Legend
                      verticalAlign="bottom"
                      wrapperStyle={{
                        paddingTop: '10px',
                        fontSize: '10px',
                        color: '#cbd5e1'
                      }}
                    />

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
              </div>
            </div>
          )}

          {municipalityChartData.length > 0 && (
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Precipitação municipal agregada
              </h3>

              <p className="text-[10px] text-slate-500 mb-3">
                Mostra a precipitação média dos quadrantes e o maior valor
                diário previsto.
              </p>

              <div className="h-[260px] min-h-[260px] w-full min-w-0 overflow-hidden text-[10px]">
                <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
                  <ComposedChart
                    data={municipalityChartData}
                    margin={{ top: 5, right: 5, left: -25, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="data" stroke="#64748b" />
                    <YAxis stroke="#64748b" />

                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        color: '#f8fafc'
                      }}
                    />

                    <Legend
                      verticalAlign="bottom"
                      wrapperStyle={{
                        paddingTop: '10px',
                        fontSize: '10px',
                        color: '#cbd5e1'
                      }}
                    />

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
              </div>
            </div>
          )}

          {municipalityChartData.length > 0 && (
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Vento municipal agregado
              </h3>

              <p className="text-[10px] text-slate-500 mb-3">
                Mostra a média dos quadrantes e o maior vento previsto na área
                urbana.
              </p>

              <div className="h-[260px] min-h-[260px] w-full min-w-0 overflow-hidden text-[10px]">
                <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
                  <LineChart
                    data={municipalityChartData}
                    margin={{ top: 5, right: 5, left: -25, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="data" stroke="#64748b" />
                    <YAxis stroke="#64748b" />

                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        color: '#f8fafc'
                      }}
                    />

                    <Legend
                      verticalAlign="bottom"
                      wrapperStyle={{
                        paddingTop: '10px',
                        fontSize: '10px',
                        color: '#cbd5e1'
                      }}
                    />

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
              </div>
            </div>
          )}

          {municipalityRankingRows.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Quadrantes mais relevantes no consolidado
              </h3>

              <div className="space-y-2">
                {municipalityRankingRows.map((row) => (
                  <div
                    key={row.grid_cell_id}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-3"
                  >
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-bold text-slate-100">
                        {row.code}
                      </p>

                      <span className="text-[10px] rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-slate-300">
                        Score{' '}
                        {row.max_operational_risk_score !== null
                          ? formatarNumero(
                              row.max_operational_risk_score,
                              0
                            )
                          : 0}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
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
        <section className="grid grid-cols-2 gap-2 mb-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-[9px] text-slate-500 uppercase font-bold">
              Maior temp.
            </p>
            <p className="text-lg font-black text-sky-300">
              {resumo.maiorTemperatura !== null
                ? `${resumo.maiorTemperatura.toFixed(1)}°C`
                : '--'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-[9px] text-slate-500 uppercase font-bold">
              Chuva acum.
            </p>
            <p className="text-lg font-black text-emerald-300">
              {resumo.chuvaAcumulada !== null
                ? `${resumo.chuvaAcumulada.toFixed(1)} mm`
                : '--'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-[9px] text-slate-500 uppercase font-bold">
              Menor umid.
            </p>
            <p className="text-lg font-black text-amber-300">
              {resumo.menorUmidade !== null
                ? `${resumo.menorUmidade.toFixed(1)}%`
                : '--'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-[9px] text-slate-500 uppercase font-bold">
              Maior vento
            </p>
            <p className="text-lg font-black text-cyan-300">
              {resumo.maiorVento !== null
                ? `${resumo.maiorVento.toFixed(1)} km/h`
                : '--'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-[9px] text-slate-500 uppercase font-bold">
              Score comp.
            </p>
            <p className="text-lg font-black text-fuchsia-300">
              {resumo.maiorScoreMultivariado !== null
                ? resumo.maiorScoreMultivariado.toFixed(1)
                : '--'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-[9px] text-slate-500 uppercase font-bold">
              Alertas
            </p>
            <p className="text-lg font-black text-rose-300">
              {resumo.alertasCriticos}C / {resumo.alertasAltos}A
            </p>
          </div>
        </section>
      )}

      {modoAnalise === 'quadrante' && riskByDate.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Régua diária de risco
          </h3>

          <div className="grid grid-cols-7 gap-1.5">
            {riskByDate.map((item) => (
              <div
                key={item.dateIso}
                className={`rounded-lg border p-2 text-center ${getRiskCardClass(
                  item.riskLevel
                )}`}
                title={item.variables.join(', ') || 'Sem anomalia'}
              >
                <p className="text-[9px] font-bold">{item.data}</p>
                <p className="text-[9px] uppercase mt-1">{item.riskLevel}</p>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-slate-500 mt-2">
            A régua mostra o maior nível de risco calculado para cada dia,
            considerando alertas univariados e anomalia composta.
          </p>
        </section>
      )}

      {modoAnalise === 'quadrante' && chartData.length > 0 && (
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 mb-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Temperatura projetada
          </h3>

          <p className="text-[10px] text-slate-500 mb-3">
            Compara a temperatura prevista com a média e o limite histórico do
            mesmo mês.
          </p>

          <div className="h-[260px] min-h-[260px] w-full min-w-0 overflow-hidden text-[10px]">
            <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 5, left: -25, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" stroke="#64748b" />
                <YAxis stroke="#64748b" />

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    color: '#f8fafc'
                  }}
                />

                <Legend
                  verticalAlign="bottom"
                  wrapperStyle={{
                    paddingTop: '10px',
                    fontSize: '10px',
                    color: '#cbd5e1'
                  }}
                />

                <Line
                  type="linear"
                  dataKey="temperatureMaxHistoricalMean"
                  name="Média histórica do mês"
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
          </div>
        </div>
      )}

      {modoAnalise === 'quadrante' && chartData.length > 0 && (
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 mb-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Precipitação projetada
          </h3>

          <p className="text-[10px] text-slate-500 mb-3">
            Mostra a chuva diária prevista em comparação com a média e o P95
            histórico do mesmo mês.
          </p>

          <div className="h-[260px] min-h-[260px] w-full min-w-0 overflow-hidden text-[10px]">
            <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
              <ComposedChart
                data={chartData}
                margin={{ top: 5, right: 5, left: -25, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" stroke="#64748b" />
                <YAxis stroke="#64748b" />

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    color: '#f8fafc'
                  }}
                />

                <Legend
                  verticalAlign="bottom"
                  wrapperStyle={{
                    paddingTop: '10px',
                    fontSize: '10px',
                    color: '#cbd5e1'
                  }}
                />

                <Line
                  type="linear"
                  dataKey="precipitationHistoricalMean"
                  name="Média histórica do mês"
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
          </div>
        </div>
      )}

      {modoAnalise === 'quadrante' && chartData.length > 0 && (
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 mb-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Vento máximo projetado
          </h3>

          <p className="text-[10px] text-slate-500 mb-3">
            Compara o vento previsto com a média e o P95 histórico do mesmo
            mês.
          </p>

          <div className="h-[260px] min-h-[260px] w-full min-w-0 overflow-hidden text-[10px]">
            <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 5, left: -25, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" stroke="#64748b" />
                <YAxis stroke="#64748b" />

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    color: '#f8fafc'
                  }}
                />

                <Legend
                  verticalAlign="bottom"
                  wrapperStyle={{
                    paddingTop: '10px',
                    fontSize: '10px',
                    color: '#cbd5e1'
                  }}
                />

                <Line
                  type="linear"
                  dataKey="windHistoricalMean"
                  name="Média histórica do mês"
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
          </div>
        </div>
      )}

      {modoAnalise === 'quadrante' && chartData.length > 0 && (
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 mb-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Umidade relativa projetada
          </h3>

          <p className="text-[10px] text-slate-500 mb-3">
            Mostra quando a umidade projetada se aproxima de faixas de atenção
            e criticidade.
          </p>

          <div className="h-[260px] min-h-[260px] w-full min-w-0 overflow-hidden text-[10px]">
            <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 5, left: -25, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" stroke="#64748b" />
                <YAxis stroke="#64748b" domain={[0, 100]} />

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    color: '#f8fafc'
                  }}
                />

                <Legend
                  verticalAlign="bottom"
                  wrapperStyle={{
                    paddingTop: '10px',
                    fontSize: '10px',
                    color: '#cbd5e1'
                  }}
                />

                <Line
                  type="linear"
                  dataKey={() => LIMITE_UMIDADE_ATENCAO}
                  name="Atenção 40%"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />

                <Line
                  type="linear"
                  dataKey={() => LIMITE_UMIDADE_CRITICA}
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
          </div>
        </div>
      )}

      {modoAnalise === 'quadrante' && compositeScoreData.length > 0 && (
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 mb-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Score multivariado de anomalia
          </h3>

          <p className="text-[10px] text-slate-500 mb-3">
            Representa quanto a combinação de variáveis projetadas se afasta do
            padrão histórico do quadrante.
          </p>

          <div className="h-[260px] min-h-[260px] w-full min-w-0 overflow-hidden text-[10px]">
            <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1}>
              <ComposedChart
                data={compositeScoreData}
                margin={{ top: 5, right: 5, left: -25, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" stroke="#64748b" />
                <YAxis stroke="#64748b" />

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    color: '#f8fafc'
                  }}
                />

                <Legend
                  verticalAlign="bottom"
                  wrapperStyle={{
                    paddingTop: '10px',
                    fontSize: '10px',
                    color: '#cbd5e1'
                  }}
                />

                <Bar
                  dataKey="score"
                  name="Score multivariado"
                  fill="#fb7185"
                />

                <Line
                  type="linear"
                  dataKey="threshold95"
                  name="Limite histórico P95"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {modoAnalise === 'quadrante' && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Alertas calculados e salvos
          </h3>

          {anomalyRows.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl text-center">
              <p className="text-xs text-slate-500">
                🌤️ Nenhuma anomalia salva para este quadrante no horizonte de
                previsão atual.
              </p>
            </div>
          ) : (
            anomalyRows.map((anomalia, idx) => (
              <div
                key={`${anomalia.anomaly_date}-${anomalia.variable_name}-${idx}`}
                className={`p-3 rounded-xl border shadow-sm ${
                  anomalia.risk_level === 'Crítico'
                    ? 'bg-rose-950/30 border-rose-900/50'
                    : 'bg-amber-950/20 border-amber-900/40'
                }`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                      anomalia.risk_level === 'Crítico'
                        ? 'bg-rose-500 text-white'
                        : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    {anomalia.risk_level} ·{' '}
                    {getVariableLabel(anomalia.variable_name)}
                  </span>

                  <span className="text-[10px] text-slate-400 font-mono">
                    Projeção: {formatarDataCompleta(anomalia.anomaly_date)}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {anomalia.message}
                </p>

                <div className="mt-2 text-[9px] text-slate-500 font-mono bg-slate-950/50 p-1 rounded border border-slate-900/50">
                  Valor: {anomalia.observed_value ?? '--'} | Referência:{' '}
                  {anomalia.historical_mean ?? '--'} | Indicador:{' '}
                  {anomalia.sigma_score ?? '--'}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}