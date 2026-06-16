import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

type GridCell = {
  id: string;
  code: string;
  center_latitude: number;
  center_longitude: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.'
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const force = process.argv.includes('--force');

const START_FROM_CODE_ARG = process.argv.find((arg) =>
  arg.startsWith('--start-from=')
);

const ONLY_CODE_ARG = process.argv.find((arg) => arg.startsWith('--only='));

const startFromCode = START_FROM_CODE_ARG
  ? START_FROM_CODE_ARG.replace('--start-from=', '').trim()
  : null;

const onlyCode = ONLY_CODE_ARG
  ? ONLY_CODE_ARG.replace('--only=', '').trim()
  : null;

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function baixarHistoricoQuadrante(cell: GridCell) {
  const hoje = new Date();
  const dataFim = formatDate(hoje);

  const tresAnosAtras = new Date();
  tresAnosAtras.setFullYear(hoje.getFullYear() - 3);
  const dataInicio = formatDate(tresAnosAtras);

  /**
   * Importante:
   * Não usamos mais `hourly` aqui.
   *
   * O histórico em massa para 165 quadrantes com variáveis horárias gera
   * volume muito alto e pode estourar o limite da Open-Meteo.
   *
   * Usamos variáveis diárias documentadas:
   * - temperature_2m_max
   * - temperature_2m_min
   * - precipitation_sum
   * - wind_speed_10m_max
   * - shortwave_radiation_sum
   * - et0_fao_evapotranspiration
   * - relative_humidity_2m_mean
   * - soil_moisture_0_to_7cm_mean
   */
  const params = new URLSearchParams({
    latitude: String(cell.center_latitude),
    longitude: String(cell.center_longitude),
    start_date: dataInicio,
    end_date: dataFim,
    daily:
      'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,shortwave_radiation_sum,et0_fao_evapotranspiration,relative_humidity_2m_mean,soil_moisture_0_to_7cm_mean',
    timezone: 'America/Sao_Paulo',
    precipitation_unit: 'mm'
  });

  const urlAPI = `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;

  const resposta = await fetch(urlAPI);

  if (resposta.status === 429) {
    const detalhe = await resposta.text();

    throw new Error(
      `Limite da Open-Meteo atingido para ${cell.code}. Aguarde a janela de limite resetar e rode novamente. Detalhe: ${detalhe}`
    );
  }

  if (!resposta.ok) {
    const detalhe = await resposta.text();

    throw new Error(
      `Falha na Open-Meteo para ${cell.code}. Status ${resposta.status}. ${detalhe}`
    );
  }

  const dadosClima = await resposta.json();

  if (!dadosClima.daily) {
    throw new Error(`Resposta climática inválida para ${cell.code}.`);
  }

  const datas = dadosClima.daily.time;
  const tempMax = dadosClima.daily.temperature_2m_max;
  const tempMin = dadosClima.daily.temperature_2m_min;
  const chuva = dadosClima.daily.precipitation_sum;
  const vento = dadosClima.daily.wind_speed_10m_max;
  const radiacao = dadosClima.daily.shortwave_radiation_sum;
  const evapotranspiracao = dadosClima.daily.et0_fao_evapotranspiration;
  const umidadeRelativa = dadosClima.daily.relative_humidity_2m_mean;
  const umidadeSolo = dadosClima.daily.soil_moisture_0_to_7cm_mean;

  if (!datas || !Array.isArray(datas)) {
    throw new Error(`A API não retornou datas válidas para ${cell.code}.`);
  }

  const registrosParaInserir = datas.map(
    (dataString: string, index: number) => ({
      grid_cell_id: cell.id,
      measurement_date: dataString,
      max_temperature: Number(tempMax?.[index]) || 0,
      min_temperature: Number(tempMin?.[index]) || 0,
      precipitation: Number(chuva?.[index]) || 0,
      wind_speed: Number(vento?.[index]) || 0,
      relative_humidity:
        umidadeRelativa?.[index] !== null &&
        umidadeRelativa?.[index] !== undefined
          ? Number(umidadeRelativa[index])
          : null,
      shortwave_radiation: Number(radiacao?.[index]) || 0,
      evapotranspiration: Number(evapotranspiracao?.[index]) || 0,
      soil_moisture_0_to_7cm:
        umidadeSolo?.[index] !== null && umidadeSolo?.[index] !== undefined
          ? Number(umidadeSolo[index])
          : null
    })
  );

  const { error: deleteError } = await supabase
    .from('climate_series')
    .delete()
    .eq('grid_cell_id', cell.id);

  if (deleteError) {
    throw deleteError;
  }

  const tamanhoBloco = 400;

  for (let i = 0; i < registrosParaInserir.length; i += tamanhoBloco) {
    const bloco = registrosParaInserir.slice(i, i + tamanhoBloco);

    const { error: insertError } = await supabase
      .from('climate_series')
      .insert(bloco);

    if (insertError) {
      throw insertError;
    }
  }

  return registrosParaInserir.length;
}

async function main() {
  const { data: gridCells, error } = await supabase
    .from('analysis_grid')
    .select('id, code, center_latitude, center_longitude')
    .eq('is_active', true)
    .order('code');

  if (error) {
    throw error;
  }

  if (!gridCells || gridCells.length === 0) {
    console.log('Nenhum quadrante ativo encontrado em analysis_grid.');
    return;
  }

  let cellsToProcess = gridCells as GridCell[];

  if (onlyCode) {
    cellsToProcess = cellsToProcess.filter((cell) => cell.code === onlyCode);
  }

  if (startFromCode) {
    cellsToProcess = cellsToProcess.filter(
      (cell) => cell.code.localeCompare(startFromCode) >= 0
    );
  }

  console.log(`Quadrantes ativos encontrados: ${gridCells.length}`);
  console.log(`Quadrantes que serão avaliados agora: ${cellsToProcess.length}`);

  if (onlyCode) {
    console.log(`Filtro aplicado: somente ${onlyCode}`);
  }

  if (startFromCode) {
    console.log(`Filtro aplicado: iniciar a partir de ${startFromCode}`);
  }

  console.log(
    force
      ? 'Modo --force ativo: quadrantes selecionados serão reprocessados.'
      : 'Modo padrão: somente quadrantes sem histórico serão processados.'
  );

  let processados = 0;
  let ignorados = 0;
  let falhas = 0;

  for (const cell of cellsToProcess) {
    try {
      const { count, error: countError } = await supabase
        .from('climate_series')
        .select('id', { count: 'exact', head: true })
        .eq('grid_cell_id', cell.id);

      if (countError) {
        throw countError;
      }

      const jaTemHistorico = Number(count || 0) > 0;

      if (jaTemHistorico && !force) {
        ignorados += 1;

        console.log(
          `Ignorando ${cell.code}: já possui ${count} registros históricos.`
        );

        continue;
      }

      console.log(`Ingerindo histórico diário ampliado de ${cell.code}...`);

      const totalRegistros = await baixarHistoricoQuadrante(cell);

      processados += 1;

      console.log(
        `OK ${cell.code}: ${totalRegistros} registros históricos inseridos.`
      );

      /**
       * Pausa conservadora para evitar pressão na API.
       * Como removemos `hourly`, a carga por chamada fica bem menor.
       */
      await sleep(1200);
    } catch (error) {
      falhas += 1;

      console.error(`Falha em ${cell.code}:`, error);

      const mensagem = error instanceof Error ? error.message : String(error);

      if (
        mensagem.includes('429') ||
        mensagem.toLowerCase().includes('limite da open-meteo') ||
        mensagem.toLowerCase().includes('limit')
      ) {
        console.log(
          'Limite da Open-Meteo atingido. Encerrando para evitar novas falhas em sequência.'
        );
        console.log(
          'Rode novamente mais tarde. O script continuará ignorando quadrantes já processados se você não usar --force.'
        );

        break;
      }
    }
  }

  console.log('Finalizado.');
  console.log(`Processados: ${processados}`);
  console.log(`Ignorados: ${ignorados}`);
  console.log(`Falhas: ${falhas}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});