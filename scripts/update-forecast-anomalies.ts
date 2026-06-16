import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { runDailyWeatherJob } from '../src/lib/jobs/dailyWeatherJob';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.'
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
const startFromArg = process.argv.find((arg) => arg.startsWith('--start-from='));
const maxCellsArg = process.argv.find((arg) => arg.startsWith('--max-cells='));

const onlyCode = onlyArg ? onlyArg.replace('--only=', '').trim() : null;

const startFromCode = startFromArg
  ? startFromArg.replace('--start-from=', '').trim()
  : null;

const maxCells = maxCellsArg
  ? Number(maxCellsArg.replace('--max-cells=', '').trim())
  : undefined;

async function main() {
  const result = await runDailyWeatherJob({
    supabase,
    onlyCode,
    startFromCode,
    maxCells,
    batchSize: 20,
    forecastDays: 7,
    source: 'manual-script'
  });

  console.log('Job finalizado:', result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});