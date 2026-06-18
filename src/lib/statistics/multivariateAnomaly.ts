export type ClimateVector = {
  max_temperature: number | null;
  min_temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  relative_humidity: number | null;
  shortwave_radiation: number | null;
  evapotranspiration: number | null;
  soil_moisture_0_to_7cm: number | null;
};

export type MultivariateForecastRow = ClimateVector & {
  date_iso: string;
  data: string;
};

export type MultivariateAnomaly = {
  date_iso: string;
  data: string;
  risk_level: 'Alto' | 'Crítico';
  distance: number;
  threshold95: number;
  threshold99: number;
  mainDrivers: string[];
  message: string;
};

const VARIABLES: {
  key: keyof ClimateVector;
  label: string;
}[] = [
  { key: 'max_temperature', label: 'temperatura máxima' },
  { key: 'min_temperature', label: 'temperatura mínima' },
  { key: 'precipitation', label: 'precipitação' },
  { key: 'wind_speed', label: 'vento máximo' },
  { key: 'relative_humidity', label: 'umidade relativa' },
  { key: 'shortwave_radiation', label: 'radiação solar' },
  { key: 'evapotranspiration', label: 'evapotranspiração' },
  { key: 'soil_moisture_0_to_7cm', label: 'umidade do solo superficial' }
];

const RIDGE = 0.05;

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function vectorFromRow(row: ClimateVector): number[] | null {
  const vector = VARIABLES.map((variable) => toNumber(row[variable.key]));

  if (vector.some((value) => value === null)) {
    return null;
  }

  return vector as number[];
}

function mean(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function std(values: number[], average: number) {
  const variance =
    values.reduce((acc, value) => acc + Math.pow(value - average, 2), 0) /
    values.length;

  const result = Math.sqrt(variance);

  return result > 0 ? result : 1;
}

function transpose(matrix: number[][]) {
  return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
}

function covarianceMatrix(matrix: number[][]) {
  const rows = matrix.length;
  const cols = matrix[0].length;

  const cov: number[][] = Array.from({ length: cols }, () =>
    Array.from({ length: cols }, () => 0)
  );

  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      let sum = 0;

      for (let r = 0; r < rows; r += 1) {
        sum += matrix[r][i] * matrix[r][j];
      }

      cov[i][j] = sum / Math.max(rows - 1, 1);
    }
  }

  for (let i = 0; i < cols; i += 1) {
    cov[i][i] += RIDGE;
  }

  return cov;
}

function invertMatrix(matrix: number[][]) {
  const n = matrix.length;

  const augmented = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  ]);

  for (let i = 0; i < n; i += 1) {
    let pivot = augmented[i][i];

    if (Math.abs(pivot) < 1e-12) {
      let swapRow = i + 1;

      while (swapRow < n && Math.abs(augmented[swapRow][i]) < 1e-12) {
        swapRow += 1;
      }

      if (swapRow === n) {
        throw new Error(
          'Matriz de covariância singular. Não foi possível calcular Mahalanobis.'
        );
      }

      [augmented[i], augmented[swapRow]] = [augmented[swapRow], augmented[i]];
      pivot = augmented[i][i];
    }

    for (let j = 0; j < 2 * n; j += 1) {
      augmented[i][j] /= pivot;
    }

    for (let r = 0; r < n; r += 1) {
      if (r === i) continue;

      const factor = augmented[r][i];

      for (let c = 0; c < 2 * n; c += 1) {
        augmented[r][c] -= factor * augmented[i][c];
      }
    }
  }

  return augmented.map((row) => row.slice(n));
}

function quadraticForm(vector: number[], inverseCovariance: number[][]) {
  let sum = 0;

  for (let i = 0; i < vector.length; i += 1) {
    for (let j = 0; j < vector.length; j += 1) {
      sum += vector[i] * inverseCovariance[i][j] * vector[j];
    }
  }

  return sum;
}

function quantile(values: number[], q: number) {
  const sorted = [...values].sort((a, b) => a - b);

  if (sorted.length === 0) return 0;

  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;

  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }

  return sorted[base];
}

function standardizeVector(
  vector: number[],
  averages: number[],
  deviations: number[]
) {
  return vector.map((value, index) => {
    return (value - averages[index]) / deviations[index];
  });
}

function getMainDrivers(zVector: number[]) {
  return zVector
    .map((value, index) => ({
      label: VARIABLES[index].label,
      score: Math.abs(value)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.label);
}


export function calcularAnomaliasMultivariadas(params: {
  historicalRows: ClimateVector[];
  forecastRows: MultivariateForecastRow[];
}): MultivariateAnomaly[] {
  const historicalVectors = params.historicalRows
    .map(vectorFromRow)
    .filter((vector): vector is number[] => Boolean(vector));

  if (historicalVectors.length < 30) {
    return [];
  }

  const columns = transpose(historicalVectors);

  const averages = columns.map(mean);

  const deviations = columns.map((column, index) =>
    std(column, averages[index])
  );

  const standardizedHistorical = historicalVectors.map((vector) =>
    standardizeVector(vector, averages, deviations)
  );

  const cov = covarianceMatrix(standardizedHistorical);
  const inverseCov = invertMatrix(cov);

  const historicalDistances = standardizedHistorical.map((zVector) =>
    quadraticForm(zVector, inverseCov)
  );

  const threshold95 = quantile(historicalDistances, 0.95);
  const threshold99 = quantile(historicalDistances, 0.99);

  const anomalies: MultivariateAnomaly[] = [];

  params.forecastRows.forEach((forecastRow) => {
    const forecastVector = vectorFromRow(forecastRow);

    if (!forecastVector) return;

    const zVector = standardizeVector(forecastVector, averages, deviations);
    const distance = quadraticForm(zVector, inverseCov);

    if (distance <= threshold95) return;

    const riskLevel = distance > threshold99 ? 'Crítico' : 'Alto';
    const mainDrivers = getMainDrivers(zVector);

    anomalies.push({
      date_iso: forecastRow.date_iso,
      data: forecastRow.data,
      risk_level: riskLevel,
      distance: Number(distance.toFixed(2)),
      threshold95: Number(threshold95.toFixed(2)),
      threshold99: Number(threshold99.toFixed(2)),
      mainDrivers,
      message: `ANOMALIA ESTATÍSTICA COMPOSTA: A combinação projetada de ${mainDrivers.join(
        ', '
      )} apresenta distância multivariada de ${distance.toFixed(
        2
      )}, acima do limite estatístico histórico ${
        riskLevel === 'Crítico' ? 'P99' : 'P95'
      }. Este resultado indica uma combinação climática atípica para o padrão histórico do quadrante. A classificação é estatística e deve ser interpretada como sinal complementar, não como confirmação automática de chuva forte, vento severo, umidade crítica ou calor extremo. A avaliação operacional deve considerar também os gráficos individuais e o score operacional do quadrante.`
    });
  });

  return anomalies;
}