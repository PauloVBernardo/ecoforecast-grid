import { createClient } from '@supabase/supabase-js';
import { runDailyWeatherJob } from '@/lib/jobs/dailyWeatherJob';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function criarSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function validarAutorizacao(request: Request) {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (isDevelopment) {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return false;
  }

  const authorization = request.headers.get('authorization');
  const url = new URL(request.url);
  const secretParam = url.searchParams.get('secret');

  return (
    authorization === `Bearer ${cronSecret}` || secretParam === cronSecret
  );
}

export async function GET(request: Request) {
  try {
    if (!validarAutorizacao(request)) {
      return Response.json(
        {
          ok: false,
          error:
            'Não autorizado. Em produção, informe o CRON_SECRET no header Authorization ou no parâmetro secret.'
        },
        {
          status: 401
        }
      );
    }

    const url = new URL(request.url);

    const onlyCode = url.searchParams.get('only');
    const startFromCode = url.searchParams.get('startFrom');
    const maxCellsRaw = url.searchParams.get('maxCells');

    const maxCells = maxCellsRaw ? Number(maxCellsRaw) : undefined;

    const supabase = criarSupabaseAdmin();

    const result = await runDailyWeatherJob({
      supabase,
      onlyCode,
      startFromCode,
      maxCells,
      batchSize: 20,
      forecastDays: 7,
      source: 'api-cron-daily-weather'
    });

    return Response.json({
      ok: true,
      message: 'Job diário executado com sucesso.',
      result
    });
  } catch (error) {
    console.error('Erro na rota /api/jobs/daily-weather:', error);

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      {
        status: 500
      }
    );
  }
}