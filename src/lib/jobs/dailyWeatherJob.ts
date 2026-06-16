import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calcularAnomaliasMultivariadas,
  type ClimateVector,
  type MultivariateForecastRow
} from '@/lib/statistics/multivariateAnomaly';

type GridCell = {
  id: string;
  code: string;
  center_latitude: number;
  center_longitude: number;
};

type RiskLevel = 'Alto' | 'Crítico';

type WeatherVariableName =
  | 'temperature_forecast'
  | 'precipitation_forecast'
  | 'humidity_forecast'
  | 'multivariate_weather_forecast';

type FutureAnomaly = {
  date_iso: string;
  data: string;
  variable_name: WeatherVariableName;
  variable_label: string;
  risk_level: RiskLevel;
  message: string;
  observed_value: number;
  historical_mean: number;
  standard_deviation: number;
  sigma_score: number;
  reference_value: number;
};

type ForecastApiLocation = {
  daily?: {
    time?: string[];
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    precipitation_sum?: Array<number | null>;
    wind_speed_10m_max?: Array<number | null>;
    shortwave_radiation_sum?: Array<number | null>;
    et0_fao_evapotranspiration?: Array<number | null>;
    relative_humidity_2m_mean?: Array<number | null>;
  };
};

type ForecastDbRow = {
  grid_cell_id: string;
  forecast_date: string;
  max_temperature: number | null;
  min_temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  relative_humidity: number | null;
  shortwave_radiation: number | null;
  evapotranspiration: number | null;
  soil_moisture_0_to_7cm: number | null;
  model_source: string;
  fetched_at: string;
};

type JobOptions = {
  supabase: SupabaseClient;
  batchSize?: number;
  maxCells?: number;
  startFromCode?: string | null;
  onlyCode?: string | null;
  forecastDays?: number;
  source?: string;
};

const DAILY_VARIABLES =
  'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,shortwave_radiation_sum,et0_fao_evapotranspiration,relative_humidity_2m_mean';

const LIMITE_SIGMA_TEMPERATURA = 2;
const LIMITE_SIGMA_PRECIPITACAO = 2;
const LIMITE_PRECIPITACAO_DANOS_MM = 50;
const LIMITE_UMIDADE_MINIMA_SAUDE = 40;
const LIMITE_UMIDADE_CRITICA = 30;

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatarDataCompleta(dataString: string) {
  return new Date(`${dataString}T00:00:00`).toLocaleDateString('pt-BR');
}

function calcularEstatisticas(valores: unknown[]) {
  const valoresValidos = valores
    .map((valor) => Number(valor))
    .filter((valor) => Number.isFinite(valor));

  if (valoresValidos.length === 0) {
    return null;
  }

  const media =
    valoresValidos.reduce((acc, valor) => acc + valor, 0) /
    valoresValidos.length;

  const variancia =
    valoresValidos.reduce(
      (acc, valor) => acc + Math.pow(valor - media, 2),
      0
    ) / valoresValidos.length;

  const desvioPadrao = Math.sqrt(variancia);

  return {
    media,
    desvioPadrao,
    limiteAlto: media + 2 * desvioPadrao
  };
}

function normalizarRespostaForecast(json: unknown): ForecastApiLocation[] {
  if (Array.isArray(json)) {
    return json as ForecastApiLocation[];
  }

  return [json as ForecastApiLocation];
}

async function fetchForecastBatch(params: {
  cells: GridCell[];
  forecastDays: number;
}) {
  const latitude = params.cells
    .map((cell) => String(cell.center_latitude))
    .join(',');

  const longitude = params.cells
    .map((cell) => String(cell.center_longitude))
    .join(',');

    const queryParams = new URLSearchParams({
    latitude,
    longitude,
    daily: DAILY_VARIABLES,
    forecast_days: String(params.forecastDays),
    timezone: 'America/Sao_Paulo',
    precipitation_unit: 'mm',
    wind_speed_unit: 'kmh'
  });

  const url = `https://api.open-meteo.com/v1/forecast?${queryParams.toString()}`;

  const response = await fetch(url);

  if (response.status === 429) {
    const detail = await response.text();

    throw new Error(`Limite da Open-Meteo atingido. ${detail}`);
  }

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `Falha ao consultar previsão futura. Status ${response.status}. ${detail}`
    );
  }

  const json = await response.json();

  return normalizarRespostaForecast(json);
}

function montarForecastRows(params: {
  cell: GridCell;
  location: ForecastApiLocation;
  fetchedAt: string;
}) {
  const daily = params.location.daily;

  if (!daily?.time || !Array.isArray(daily.time)) {
    return {
      dbRows: [] as ForecastDbRow[],
      analysisRows: [] as MultivariateForecastRow[]
    };
  }

  const dbRows: ForecastDbRow[] = [];
  const analysisRows: MultivariateForecastRow[] = [];

  daily.time.forEach((dateIso, index) => {
    const row = {
      max_temperature: toNumber(daily.temperature_2m_max?.[index]),
      min_temperature: toNumber(daily.temperature_2m_min?.[index]),
      precipitation: toNumber(daily.precipitation_sum?.[index]),
      wind_speed: toNumber(daily.wind_speed_10m_max?.[index]),
      relative_humidity: toNumber(daily.relative_humidity_2m_mean?.[index]),
      shortwave_radiation: toNumber(daily.shortwave_radiation_sum?.[index]),
      evapotranspiration: toNumber(
        daily.et0_fao_evapotranspiration?.[index]
      ),
      soil_moisture_0_to_7cm: null
    };

    dbRows.push({
      grid_cell_id: params.cell.id,
      forecast_date: dateIso,
      ...row,
      model_source: 'open-meteo',
      fetched_at: params.fetchedAt
    });

    analysisRows.push({
      date_iso: dateIso,
      data: formatarDataCompleta(dateIso),
      ...row
    });
  });

  return {
    dbRows,
    analysisRows
  };
}

function calcularAnomaliasUnivariadas(params: {
  historicalRows: ClimateVector[];
  forecastRows: MultivariateForecastRow[];
}) {
  const estatisticasTemperatura = calcularEstatisticas(
    params.historicalRows.map((row) => row.max_temperature)
  );

  const estatisticasPrecipitacao = calcularEstatisticas(
    params.historicalRows.map((row) => row.precipitation)
  );

  const anomalies: FutureAnomaly[] = [];

  params.forecastRows.forEach((forecastRow) => {
    if (estatisticasTemperatura && forecastRow.max_temperature !== null) {
      const temp = Number(forecastRow.max_temperature);

      const sigmaScore =
        estatisticasTemperatura.desvioPadrao > 0
          ? (temp - estatisticasTemperatura.media) /
            estatisticasTemperatura.desvioPadrao
          : 0;

      if (sigmaScore >= LIMITE_SIGMA_TEMPERATURA) {
        const riskLevel: RiskLevel = sigmaScore >= 3 ? 'Crítico' : 'Alto';

        anomalies.push({
          date_iso: forecastRow.date_iso,
          data: forecastRow.data,
          variable_name: 'temperature_forecast',
          variable_label: 'Temperatura',
          risk_level: riskLevel,
          observed_value: Number(temp.toFixed(1)),
          historical_mean: Number(estatisticasTemperatura.media.toFixed(1)),
          standard_deviation: Number(
            estatisticasTemperatura.desvioPadrao.toFixed(1)
          ),
          sigma_score: Number(sigmaScore.toFixed(2)),
          reference_value: Number(estatisticasTemperatura.limiteAlto.toFixed(1)),
          message: `ALERTA PREDITIVO: Projeção aponta pico de ${temp.toFixed(
            1
          )}°C (${sigmaScore.toFixed(
            1
          )}σ acima do padrão histórico). Alta probabilidade de ilha de calor e picos de consumo elétrico urbano doméstico.`
        });
      }
    }

    if (estatisticasPrecipitacao && forecastRow.precipitation !== null) {
      const precipitation = Number(forecastRow.precipitation);

      const sigmaScore =
        estatisticasPrecipitacao.desvioPadrao > 0
          ? (precipitation - estatisticasPrecipitacao.media) /
            estatisticasPrecipitacao.desvioPadrao
          : 0;

      const anomaliaEstatistica =
        sigmaScore >= LIMITE_SIGMA_PRECIPITACAO;

      const riscoDeDano =
        precipitation >= LIMITE_PRECIPITACAO_DANOS_MM;

      if (anomaliaEstatistica || riscoDeDano) {
        const riskLevel: RiskLevel =
          riscoDeDano || sigmaScore >= 3 ? 'Crítico' : 'Alto';

        const motivo = riscoDeDano
          ? `acima do limite operacional de ${LIMITE_PRECIPITACAO_DANOS_MM} mm/dia`
          : `${sigmaScore.toFixed(1)}σ acima do padrão histórico`;

        anomalies.push({
          date_iso: forecastRow.date_iso,
          data: forecastRow.data,
          variable_name: 'precipitation_forecast',
          variable_label: 'Precipitação',
          risk_level: riskLevel,
          observed_value: Number(precipitation.toFixed(1)),
          historical_mean: Number(estatisticasPrecipitacao.media.toFixed(1)),
          standard_deviation: Number(
            estatisticasPrecipitacao.desvioPadrao.toFixed(1)
          ),
          sigma_score: Number(sigmaScore.toFixed(2)),
          reference_value: LIMITE_PRECIPITACAO_DANOS_MM,
          message: `ALERTA DE PRECIPITAÇÃO: Projeção indica ${precipitation.toFixed(
            1
          )} mm de chuva acumulada no dia, ${motivo}. Há possibilidade de alagamentos, enxurradas localizadas ou danos urbanos dependendo da drenagem da região.`
        });
      }
    }

    if (forecastRow.relative_humidity !== null) {
      const humidity = Number(forecastRow.relative_humidity);

      if (humidity < LIMITE_UMIDADE_MINIMA_SAUDE) {
        const riskLevel: RiskLevel =
          humidity < LIMITE_UMIDADE_CRITICA ? 'Crítico' : 'Alto';

        anomalies.push({
          date_iso: forecastRow.date_iso,
          data: forecastRow.data,
          variable_name: 'humidity_forecast',
          variable_label: 'Umidade',
          risk_level: riskLevel,
          observed_value: Number(humidity.toFixed(1)),
          historical_mean: LIMITE_UMIDADE_MINIMA_SAUDE,
          standard_deviation: 0,
          sigma_score: 0,
          reference_value: LIMITE_UMIDADE_MINIMA_SAUDE,
          message: `ALERTA DE UMIDADE: Projeção aponta umidade média diária de ${humidity.toFixed(
            1
          )}%, abaixo do limite mínimo ideal de ${LIMITE_UMIDADE_MINIMA_SAUDE}%. Condição associada a desconforto, ressecamento e maior atenção para exposição prolongada ao ar seco.`
        });
      }
    }
  });

  return anomalies;
}

async function calcularESalvarAnomalias(params: {
  supabase: SupabaseClient;
  cell: GridCell;
  forecastRows: MultivariateForecastRow[];
}) {
  const { data: historicalRows, error: historicalError } = await params.supabase
    .from('climate_series')
    .select(
      'max_temperature, min_temperature, precipitation, wind_speed, relative_humidity, shortwave_radiation, evapotranspiration, soil_moisture_0_to_7cm'
    )
    .eq('grid_cell_id', params.cell.id);

  if (historicalError) {
    throw historicalError;
  }

  if (!historicalRows || historicalRows.length < 30) {
    await params.supabase
      .from('grid_anomalies')
      .delete()
      .eq('grid_cell_id', params.cell.id);

    return {
      anomaliesCount: 0,
      skipped: true
    };
  }

  const climateRows = historicalRows as ClimateVector[];

  const anomalies: FutureAnomaly[] = [
    ...calcularAnomaliasUnivariadas({
      historicalRows: climateRows,
      forecastRows: params.forecastRows
    })
  ];

  const multivariateAnomalies = calcularAnomaliasMultivariadas({
    historicalRows: climateRows,
    forecastRows: params.forecastRows
  });

  multivariateAnomalies.forEach((anomaly) => {
    anomalies.push({
      date_iso: anomaly.date_iso,
      data: anomaly.data,
      variable_name: 'multivariate_weather_forecast',
      variable_label: 'Anomalia composta',
      risk_level: anomaly.risk_level,
      observed_value: anomaly.distance,
      historical_mean: anomaly.threshold95,
      standard_deviation: 0,
      sigma_score: anomaly.distance,
      reference_value:
        anomaly.risk_level === 'Crítico'
          ? anomaly.threshold99
          : anomaly.threshold95,
      message: anomaly.message
    });
  });

  const { error: deleteError } = await params.supabase
    .from('grid_anomalies')
    .delete()
    .eq('grid_cell_id', params.cell.id);

  if (deleteError) {
    throw deleteError;
  }

  if (anomalies.length > 0) {
    const rows = anomalies.map((anomaly) => ({
      grid_cell_id: params.cell.id,
      anomaly_date: anomaly.date_iso,
      variable_name: anomaly.variable_name,
      observed_value: anomaly.observed_value,
      historical_mean: anomaly.historical_mean,
      standard_deviation: anomaly.standard_deviation,
      sigma_score: anomaly.sigma_score,
      risk_level: anomaly.risk_level,
      message: anomaly.message
    }));

    const { error: insertError } = await params.supabase
      .from('grid_anomalies')
      .insert(rows);

    if (insertError) {
      throw insertError;
    }
  }

  return {
    anomaliesCount: anomalies.length,
    skipped: false
  };
}

export async function runDailyWeatherJob(options: JobOptions) {
  const batchSize = options.batchSize ?? 20;
  const forecastDays = options.forecastDays ?? 7;

  const { data: jobRun, error: jobError } = await options.supabase
    .from('weather_job_runs')
    .insert({
      job_name: options.source || 'daily-weather',
      status: 'running',
      message: 'Atualização diária de previsão e anomalias iniciada.'
    })
    .select('id')
    .single();

  if (jobError) {
    throw jobError;
  }

  const jobRunId = jobRun.id as string;

  let processedCount = 0;
  let failedCount = 0;

  try {
    const { data: gridCells, error: gridError } = await options.supabase
      .from('analysis_grid')
      .select('id, code, center_latitude, center_longitude')
      .eq('is_active', true)
      .order('code');

    if (gridError) {
      throw gridError;
    }

    let cells = (gridCells || []) as GridCell[];

    if (options.onlyCode) {
      cells = cells.filter((cell) => cell.code === options.onlyCode);
    }

    if (options.startFromCode) {
      cells = cells.filter(
        (cell) => cell.code.localeCompare(options.startFromCode || '') >= 0
      );
    }

    if (options.maxCells && options.maxCells > 0) {
      cells = cells.slice(0, options.maxCells);
    }

    const batches = chunkArray(cells, batchSize);

    for (const batch of batches) {
      const fetchedAt = new Date().toISOString();

      const locations = await fetchForecastBatch({
        cells: batch,
        forecastDays
      });

      const allForecastRows: ForecastDbRow[] = [];
      const forecastByCell = new Map<string, MultivariateForecastRow[]>();

      batch.forEach((cell, index) => {
        const location = locations[index];

        if (!location) {
          failedCount += 1;
          return;
        }

        const { dbRows, analysisRows } = montarForecastRows({
          cell,
          location,
          fetchedAt
        });

        allForecastRows.push(...dbRows);
        forecastByCell.set(cell.id, analysisRows);
      });

      if (allForecastRows.length > 0) {
        const { error: upsertError } = await options.supabase
          .from('climate_forecasts')
          .upsert(allForecastRows, {
            onConflict: 'grid_cell_id,forecast_date'
          });

        if (upsertError) {
          throw upsertError;
        }
      }

      for (const cell of batch) {
        try {
          const forecastRows = forecastByCell.get(cell.id) || [];

          await calcularESalvarAnomalias({
            supabase: options.supabase,
            cell,
            forecastRows
          });

          await options.supabase
            .from('analysis_grid')
            .update({
              last_forecast_update_at: new Date().toISOString()
            })
            .eq('id', cell.id);

          processedCount += 1;
        } catch (error) {
          failedCount += 1;
          console.error(`Falha ao calcular anomalias de ${cell.code}:`, error);
        }
      }
    }

    await options.supabase
      .from('weather_job_runs')
      .update({
        status: failedCount > 0 ? 'partial_success' : 'success',
        finished_at: new Date().toISOString(),
        processed_count: processedCount,
        failed_count: failedCount,
        message: `Job finalizado. Processados: ${processedCount}. Falhas: ${failedCount}.`
      })
      .eq('id', jobRunId);

    return {
      status: failedCount > 0 ? 'partial_success' : 'success',
      processedCount,
      failedCount
    };
  } catch (error) {
    await options.supabase
      .from('weather_job_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        processed_count: processedCount,
        failed_count: failedCount,
        message: error instanceof Error ? error.message : String(error)
      })
      .eq('id', jobRunId);

    throw error;
  }
}