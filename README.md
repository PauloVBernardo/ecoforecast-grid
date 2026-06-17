# 🌤️ EcoGrid Maps — Sala de Situação Climática Operacional

> **Aplicação de inteligência climática e validação regulatória para a área urbana de Goiânia**  
> **Deploy:** https://ecoforecast-grid.vercel.app/  
> **Stack:** Next.js + TypeScript + Supabase + PostgreSQL + H3 + Leaflet + Open-Meteo

---

## 1. Problema

Eventos climáticos extremos, como chuva intensa, vento forte, calor elevado e períodos de ar seco, não afetam a cidade de forma homogênea. Mesmo dentro de um mesmo município, alguns trechos urbanos podem concentrar maior pressão climática e maior potencial de impacto operacional.

No setor elétrico, essa leitura territorial é especialmente relevante porque eventos climáticos podem aumentar a frequência de ocorrências, pressionar equipes de campo e afetar a continuidade do serviço. Porém, boa parte dos monitoramentos tradicionais ainda trabalha com informações agregadas no nível municipal, o que limita a capacidade de antecipação e priorização operacional.

O **EcoGrid Maps** foi desenvolvido como uma sala de situação climática mobile-first para apoiar a leitura operacional da área urbana de Goiânia. A aplicação divide o território em quadrantes H3, acompanha histórico e previsão climática, calcula alertas e compara os resultados com indicadores regulatórios de continuidade da ANEEL, especialmente DEC e FEC.

---

## 2. Objetivo da aplicação

O objetivo do projeto é transformar dados climáticos públicos em indicadores operacionais simples, acionáveis e visualmente compreensíveis.

A aplicação busca responder perguntas como:

- Quais quadrantes urbanos apresentam maior pressão climática prevista?
- Há previsão de chuva forte, vento, calor elevado ou eventos compostos?
- A condição climática atual se afasta do padrão histórico daquele quadrante?
- Meses com maior pressão climática operacional coincidem com pior desempenho de continuidade elétrica?
- O score climático do EcoGrid apresenta aderência temporal com DEC/FEC?

---

## 3. Fontes dos dados

### 3.1 Dados climáticos históricos

Os dados climáticos históricos são consumidos via **Open-Meteo Historical / Archive API** e persistidos no Supabase na tabela `climate_series`.

Variáveis utilizadas:

- Temperatura máxima diária
- Temperatura mínima diária
- Precipitação acumulada
- Velocidade do vento
- Umidade relativa
- Radiação solar de onda curta
- Evapotranspiração
- Umidade do solo na camada de 0 a 7 cm, quando disponível

Esses dados são usados para formar a linha de base histórica de cada quadrante H3.

### 3.2 Dados climáticos de previsão

As previsões são consumidas via **Open-Meteo Forecast API** e persistidas na tabela `climate_forecasts`.

A previsão é usada para compor a sala de situação operacional, os cards por quadrante e os indicadores de risco dos próximos dias.

### 3.3 Grade espacial H3

A malha analítica está armazenada na tabela `analysis_grid`.

Cada célula possui:

- Código do quadrante
- Índice H3
- Latitude e longitude central
- Geometria do polígono em GeoJSON
- Indicador de ativação para uso na aplicação

A adoção de H3 permite representar a cidade em células geográficas padronizadas, facilitando agregação, visualização em mapa e comparação entre regiões urbanas.

### 3.4 Dados regulatórios ANEEL — DEC/FEC

Para validação temporal, o projeto utiliza a base pública de **Indicadores Coletivos de Continuidade de Energia Elétrica** da ANEEL.

Os dados foram processados para a tabela `aneel_dec_fec_monthly`, contendo:

- Ano de competência
- Mês de competência
- Distribuidora
- Identificador do conjunto de unidades consumidoras
- Nome do conjunto
- DEC apurado
- FEC apurado
- DEC limite, quando disponível
- FEC limite, quando disponível

Na versão atual, a validação utiliza dados da **Equatorial GO** e compara os indicadores regulatórios com a pressão climática mensal agregada do EcoGrid.

---

## 4. Abordagem técnica

### 4.1 Pipeline de ingestão

O projeto possui scripts e rotinas para preparar a base espacial, carregar histórico climático, atualizar previsões e processar dados regulatórios.

Principais scripts:

```bash
scripts/seed-analysis-grid.ts
scripts/ingest-analysis-grid-history.ts
scripts/update-forecast-anomalies.ts
scripts/aneel_inspecionar_arquivos.py
scripts/aneel_preparar_dec_fec.py
```

Fluxo geral:

1. Criação da grade H3 da área urbana de Goiânia.
2. Carga histórica por quadrante.
3. Atualização de previsões climáticas.
4. Cálculo de anomalias e indicadores operacionais.
5. Preparação da base ANEEL DEC/FEC.
6. Agregação mensal para validação temporal.

### 4.2 Linha de base estatística

Para cada quadrante, o sistema compara valores previstos com o comportamento histórico. A lógica usa média histórica e desvio padrão para identificar desvios relevantes.

A leitura estatística segue a ideia de um score padronizado:

```text
z = (valor observado ou previsto - média histórica) / desvio padrão histórico
```

Desvios mais altos indicam maior afastamento do padrão esperado para aquele local e período.

### 4.3 Score operacional climático

Além da detecção estatística, o projeto utiliza um score operacional voltado à priorização de risco para infraestrutura urbana e continuidade elétrica.

O score principal considera:

- Chuva forte
- Vento forte
- Evento composto de chuva com vento
- Temperatura elevada

Variáveis como umidade baixa, radiação elevada, evapotranspiração e solo seco são tratadas como camada ambiental auxiliar. Elas ajudam a interpretar contexto de saúde pública, vegetação e condição ambiental, mas não são consideradas isoladamente como risco elétrico direto.

### 4.4 Views operacionais no PostgreSQL

Parte importante da lógica analítica foi movida para views no Supabase/PostgreSQL, permitindo que o front-end consuma dados já agregados e consistentes.

Views principais:

```text
climate_forecast_operational_indicators
climate_forecast_operational_summary
climate_forecast_municipality_daily_summary
climate_forecast_municipality_summary
ecogrid_monthly_operational_pressure
ecogrid_monthly_operational_pressure_seasonal
aneel_dec_fec_monthly_agg
ecogrid_aneel_validation_monthly
ecogrid_aneel_validation_summary
ecogrid_aneel_validation_ranked_months
ecogrid_aneel_critical_months
ecogrid_aneel_validation_diagnostics
```

---

## 5. Validação regulatória com DEC/FEC

A validação regulatória foi incluída para verificar se meses com maior pressão climático-operacional também apresentam pior desempenho nos indicadores de continuidade.

A comparação é **temporal e agregada**, não espacial por quadrante.

### 5.1 Período comparável

Após a preparação dos dados, foram identificados **35 meses comparáveis** entre EcoGrid e ANEEL:

```text
junho/2023 a abril/2026
```

Meses não comparáveis:

- Janeiro/2023 a maio/2023: sem histórico climático suficiente no EcoGrid.
- Maio/2026 e junho/2026: sem DEC/FEC disponível na base importada.

### 5.2 Resultado da correlação

Resultado obtido na validação:

| Métrica | Correlação |
|---|---:|
| Score EcoGrid x DEC médio apurado | 0,375 |
| Score EcoGrid x FEC médio apurado | 0,441 |
| Precipitação x DEC médio apurado | 0,195 |
| Precipitação x FEC médio apurado | -0,026 |

A validação utilizou o tipo:

```text
apurado_medio_sem_limite
```

Isso significa que, nesta versão, a comparação considera DEC e FEC apurados médios, pois os limites regulatórios não foram integrados à base final.

### 5.3 Interpretação

O resultado indica uma **correlação positiva moderada** entre o score climático-operacional do EcoGrid e os indicadores de continuidade, com aderência mais forte para FEC.

A leitura é coerente com a hipótese operacional: eventos climáticos tendem a influenciar mais diretamente a frequência de ocorrências do que a duração média das interrupções. A duração também depende de fatores operacionais, logísticos e estruturais, como tempo de atendimento, disponibilidade de equipe, acesso ao local e complexidade da falha.

O resultado não demonstra causalidade, mas fornece evidência exploratória de aderência temporal entre pressão climática e desempenho de continuidade.

---

## 6. Modelagem de dados

Principais tabelas:

### `analysis_grid`

Tabela com os quadrantes H3 da área urbana analisada.

Campos principais:

- `id`
- `code`
- `h3_index`
- `center_latitude`
- `center_longitude`
- `boundary_geojson`
- `is_active`
- `last_history_ingestion_at`
- `last_forecast_update_at`

### `climate_series`

Histórico climático diário por quadrante.

Campos principais:

- `grid_cell_id`
- `measurement_date`
- `max_temperature`
- `min_temperature`
- `precipitation`
- `wind_speed`
- `relative_humidity`
- `shortwave_radiation`
- `evapotranspiration`
- `soil_moisture_0_to_7cm`

### `climate_forecasts`

Previsões climáticas por quadrante.

Campos principais:

- `grid_cell_id`
- `forecast_date`
- `max_temperature`
- `min_temperature`
- `precipitation`
- `wind_speed`
- `relative_humidity`
- `shortwave_radiation`
- `evapotranspiration`
- `soil_moisture_0_to_7cm`
- `model_source`
- `fetched_at`

### `grid_anomalies`

Tabela de alertas e anomalias calculadas.

Campos principais:

- `grid_cell_id`
- `anomaly_date`
- `variable_name`
- `observed_value`
- `historical_mean`
- `standard_deviation`
- `sigma_score`
- `risk_level`
- `message`

### `aneel_dec_fec_monthly`

Tabela com os indicadores DEC/FEC tratados para validação.

Campos principais:

- `ano`
- `mes`
- `distribuidora`
- `ide_conj_und_consumidoras`
- `conjunto`
- `municipio_referencia`
- `dec_apurado`
- `dec_limite`
- `fec_apurado`
- `fec_limite`

---

## 7. Aplicação e experiência de uso

A aplicação foi construída com foco mobile-first e leitura rápida em campo ou em sala de situação.

Principais páginas:

### Painel

Visão executiva com mapa, quadrantes, alertas e cards de situação operacional.

### Dados

Página de apoio para sincronização e acompanhamento das cargas de dados.

### Análise

Página com leitura técnica por quadrante, gráficos climáticos, anomalias e interpretação operacional.

### Sobre

Página de documentação, metodologia, fontes dos dados, validação e limitações do protótipo.

---

## 8. Como executar localmente

### 8.1 Instalar dependências

```bash
npm install
```

### 8.2 Configurar variáveis de ambiente

Crie ou ajuste o arquivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

### 8.3 Executar em desenvolvimento

```bash
npm run dev
```

Se houver erro local com Turbopack, use Webpack:

```bash
npx next dev --webpack
```

### 8.4 Build de produção

```bash
npm run build
```

### 8.5 Executar preparação ANEEL

```bash
python scripts/aneel_inspecionar_arquivos.py
python scripts/aneel_preparar_dec_fec.py
```

### 8.6 Atualizar previsões e anomalias

```bash
npx tsx scripts/update-forecast-anomalies.ts
```

### 8.7 Carregar histórico climático

```bash
npx tsx scripts/ingest-analysis-grid-history.ts
```

---

## 9. Limitações

### 9.1 Validação temporal, não espacial

A validação com DEC/FEC é agregada por mês. Os indicadores da ANEEL são publicados por conjuntos de unidades consumidoras, enquanto o EcoGrid trabalha com quadrantes H3. Portanto, a validação não comprova impacto específico de um quadrante sobre um conjunto elétrico.

### 9.2 Ausência de causalidade direta

A correlação positiva entre score climático e DEC/FEC indica aderência temporal, mas não demonstra causalidade. A continuidade elétrica também depende de topologia de rede, manutenção, equipes disponíveis, acessibilidade, falhas internas e outros fatores não modelados nesta versão.

### 9.3 Limites regulatórios incompletos

Nesta versão, a validação usa DEC/FEC apurados médios porque os limites regulatórios não foram integrados de forma completa à base final. A comparação com DEC/FEC relativo ao limite fica como evolução futura.

### 9.4 Cobertura temporal limitada

O período comparável da validação regulatória é de 35 meses, entre junho/2023 e abril/2026. Meses sem dados simultâneos entre EcoGrid e ANEEL foram excluídos.

### 9.5 Dados climáticos indiretos

Os dados climáticos vêm de APIs meteorológicas públicas e modelos/reanálises, não de sensores locais instalados em cada quadrante. Isso permite cobertura espacial padronizada, mas pode não capturar microeventos locais.

### 9.6 Score operacional heurístico

O score foi definido com regras técnicas simples e interpretáveis. Ele ainda não foi calibrado com ocorrências reais georreferenciadas de rede elétrica, como quedas de cabos, rompimentos, vegetação sobre rede ou ordens de serviço.

### 9.7 Eventos climáticos de grande escala

Fenômenos como El Niño e La Niña ainda não entram como variáveis explícitas do modelo. Nesta versão, a sazonalidade é tratada pela comparação mensal do histórico climático.

### 9.8 Ativos elétricos não integrados

O modelo ainda não cruza os quadrantes H3 com ativos físicos da rede, como alimentadores, transformadores, subestações, chaves, trechos de rede ou vegetação próxima.

---

## 10. Roadmap

Evoluções previstas:

1. Integrar limites regulatórios de DEC/FEC para calcular indicadores relativos ao limite.
2. Criar uma tela dedicada de validação regulatória.
3. Cruzar quadrantes H3 com ativos elétricos e ocorrências operacionais reais.
4. Incluir dados de vegetação, como NDVI, para risco de queda de galhos.
5. Incorporar índices climáticos externos, como ENSO, para análise de contexto sazonal.
6. Calibrar o score operacional com histórico real de ocorrências.
7. Evoluir a detecção estatística para métodos multivariados, como distância de Mahalanobis.
8. Adicionar camada de priorização operacional por criticidade de ativo.

---

## 11. Síntese executiva

O EcoGrid Maps demonstra que é possível transformar dados climáticos públicos em uma leitura operacional territorializada para apoiar decisões em infraestrutura urbana e continuidade elétrica.

A validação com DEC/FEC mostra aderência temporal positiva entre o score climático-operacional e os indicadores regulatórios da Equatorial GO, especialmente FEC. Isso reforça o potencial da aplicação como ferramenta exploratória de antecipação, priorização e inteligência climática urbana.
