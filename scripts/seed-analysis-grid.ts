import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { cellToBoundary, cellToLatLng, polygonToCells } from 'h3-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.'
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

/**
 * Mantemos resolução 6 para o protótipo.
 *
 * Observação metodológica:
 * os quadrantes H3 não representam medições microclimáticas
 * independentes de escala de rua. Eles representam unidades espaciais
 * de agregação e visualização compatíveis com a ordem de grandeza
 * dos dados climáticos utilizados.
 */
const H3_RESOLUTION = 6;

/**
 * Recorte urbano piloto de Goiânia.
 *
 * Este polígono é uma aproximação operacional da mancha urbana de Goiânia
 * para fins de protótipo. Ele reduz o número de quadrantes processados
 * e concentra a análise em uma área mais adequada para demonstração.
 *
 * Importante:
 * - Não é o limite oficial do município.
 * - Não é o perímetro urbano oficial.
 * - Para produção, o ideal é substituir este polígono por um GeoJSON oficial.
 *
 * Formato exigido pelo h3-js:
 * [latitude, longitude]
 */
const GOIANIA_URBAN_PILOT_POLYGON_LAT_LNG: [number, number][][] = [
  [
    [-16.535, -49.345],
    [-16.535, -49.255],
    [-16.565, -49.185],
    [-16.635, -49.145],
    [-16.720, -49.155],
    [-16.785, -49.205],
    [-16.815, -49.290],
    [-16.790, -49.370],
    [-16.715, -49.420],
    [-16.620, -49.410],
    [-16.560, -49.375],
    [-16.535, -49.345]
  ]
];

type ExistingGridCell = {
  id: string;
  code: string;
  h3_index: string;
};

async function getExistingCodeByH3Index() {
  const { data, error } = await supabase
    .from('analysis_grid')
    .select('id, code, h3_index');

  if (error) {
    throw error;
  }

  const map = new Map<string, ExistingGridCell>();

  (data || []).forEach((row) => {
    if (row.h3_index) {
      map.set(row.h3_index, row as ExistingGridCell);
    }
  });

  return map;
}

function criarBoundaryGeojson(h3Index: string) {
  const boundaryLatLng = cellToBoundary(h3Index);

  /**
   * GeoJSON usa [longitude, latitude].
   * O h3-js retorna [latitude, longitude].
   */
  const boundaryLngLat = boundaryLatLng.map(([lat, lng]) => [lng, lat]);

  /**
   * Fecha o polígono repetindo o primeiro ponto no final.
   */
  boundaryLngLat.push(boundaryLngLat[0]);

  return {
    type: 'Polygon',
    coordinates: [boundaryLngLat]
  };
}

async function main() {
  const existingCodeByH3Index = await getExistingCodeByH3Index();

  const activeH3Indexes = polygonToCells(
    GOIANIA_URBAN_PILOT_POLYGON_LAT_LNG,
    H3_RESOLUTION
  );

  const activeH3Set = new Set(activeH3Indexes);

  /**
   * Primeiro desativa todos os quadrantes.
   * Depois reativa apenas os quadrantes do recorte urbano piloto.
   *
   * Isso preserva histórico, previsões e anomalias já existentes,
   * pois não apagamos linhas de analysis_grid nem dados relacionados.
   */
  const { error: deactivateError } = await supabase
    .from('analysis_grid')
    .update({ is_active: false })
    .neq('is_active', false);

  if (deactivateError) {
    throw deactivateError;
  }

  const rows = activeH3Indexes
    .map((h3Index, index) => {
      const [centerLat, centerLon] = cellToLatLng(h3Index);
      const existing = existingCodeByH3Index.get(h3Index);

      return {
        code: existing?.code || `GYN${String(index + 1).padStart(3, '0')}`,
        h3_index: h3Index,
        center_latitude: centerLat,
        center_longitude: centerLon,
        boundary_geojson: criarBoundaryGeojson(h3Index),
        is_active: true
      };
    })
    .sort((a, b) => {
      if (b.center_latitude !== a.center_latitude) {
        return b.center_latitude - a.center_latitude;
      }

      return a.center_longitude - b.center_longitude;
    });

  const { error: upsertError } = await supabase.from('analysis_grid').upsert(
    rows.map((row) => ({
      ...row,
      is_active: activeH3Set.has(row.h3_index)
    })),
    {
      onConflict: 'h3_index'
    }
  );

  if (upsertError) {
    throw upsertError;
  }

  console.log('Recorte urbano piloto de Goiânia aplicado com sucesso.');
  console.log(`Resolução H3 utilizada: ${H3_RESOLUTION}`);
  console.log(`Quadrantes ativos no recorte piloto: ${rows.length}`);
  console.log(
    'Quadrantes fora do recorte foram preservados, mas marcados como is_active = false.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});