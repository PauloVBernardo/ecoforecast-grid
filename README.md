# 🌤️ EcoGrid Maps — Sala de Situação Preditiva e Inteligência Climática por Microgrid
> **Desafio de Inovação em Ciência de Dados — Entrega Oficial (22/06/2026)**  
> **Link do Aplicativo:** [Substitua Pelo Seu Link da Vercel]  
> **Repositório:** `https://github.com[SEU_USUARIO]/ecoforecast-grid`

---

## 🎯 1. Definição do Problema e Contexto Urbano
Eventos climáticos extremos (ondas de calor severas, vendavais e tempestades localizadas) não afetam o território de forma homogênea. Na Região Metropolitana de Goiânia (RMG), a conurbação acelerada cria **Ilhas de Calor Urbano** e zonas de alta vulnerabilidade logística. 

Concessionárias de energia e órgãos de defesa civil sofrem com monitoramentos meteorológicos municipais genéricos. O **EcoGrid Maps** resolve essa dor ao atuar como uma **Sala de Situação Mobile-First**, dividindo o território em quadrantes espaciais conurbados de alta resolução, processando séries temporais para antecipar desvios operacionais brutos nos próximos 7 dias.

---

## 🧠 2. Componente de Ciência de Dados (Profundidade & Correção — Peso 30%)
Em estrito alinhamento com as exigências do edital, este projeto foca com profundidade técnica em **Séries Temporais e Previsão**, **Pipeline de Ingestão de Dados** e **Detecção de Anomalias Multivariadas**.

### A. Proveniência e Assimilação de Dados (Data Ingestion Pipeline)
* **Histórico (Baseline de 3 anos):** O pipeline consome dados de reanálise atmosférica do modelo **ERA5**, operado pelo **ECMWF (European Centre for Medium-Range Weather Forecasts)**. Diferente de estações físicas pontuais (INMET) que sofrem com falta de dados (*missing data*), o ERA5 utiliza assimilação de dados por satélite e modelos físicos, garantindo séries históricas contínuas, estáveis e padronizadas.
* **Previsão Futura (7 dias):** Integração em tempo real com os modelos numéricos globais **GFS (NOAA)** e **ICON (DWD)** via Open-Meteo API.
* **Resolução Espacial:** Grade analítica de **11 km (0.1 graus)**, onde cada coordenada geográfica cadastrada no Supabase isola o comportamento climático do seu "pixel" correspondente.

### B. Motor Estatístico de Detecção de Anomalias (Lógica Local)
A aplicação rejeita modelos do tipo caixa-preta, implementando um motor estatístico determinístico em TypeScript que processa o fluxo de dados em duas etapas:
1. **Modelagem de Linha de Base Estável:** Computa a Média Aritmética Histórica ($\mu$) e o Desvio Padrão ($\sigma$) de cada quadrante com base nas milhares de linhas do histórico de 3 anos do Supabase.
2. **Cálculo do Sigma Score ($z$-score) Multivariado:** Para cada dia da janela preditiva de 7 dias, o sistema avalia as variáveis de Temperatura Máxima ($2m$) e Precipitação Acumulada ($mm$) através da padronização:
   $$Sigma\ Score = \frac{Valor\ Projetado - \mu}{\sigma}$$
3. **Limiares de Risco de Processo (CEP):** Desvios de $\ge 2\sigma$ são classificados programaticamente como *Risco Alto* e $\ge 3\sigma$ como *Risco Crítico*, acionando gatilhos visuais e cartões descritivos automatizados no front-end.

---

## 🗄️ 3. Modelagem de Dados no Supabase (Peso 15%)
O ecossistema de banco de dados utiliza tabelas relacionais normalizadas associadas a **Views Operacionais Avançadas** no PostgreSQL, transferindo a complexidade de agregação matemática para o banco e aliviando a CPU do cliente:

* `public.regions_grid`: Cadastro da malha de quadrantes geográficos estratégicos conurbados da RMG.
* `public.climate_series`: Tabela de séries temporais contendo o histórico bruto coletado por coordenadas.
* `public.grid_anomalies`: Registro persistido dos insights e desvios críticos calculados pelo algoritmo.
* `Views Operacionais Computadas (`climate_forecast_operational_indicators`, `summary`, `municipality_summary`):` Views nativas que calculam dinamicamente **indicadores de risco compostos** (ex: dias com calor extremo associado a baixíssima umidade relativa, e tempestades com ventos severos combinados) e atribuem uma pontuação unificada de risco (`operational_risk_score`).

---

## 💻 4. Aplicação de Ponta a Ponta & UX (Peso 25% + 15%)
A aplicação foi construída em **Next.js (TypeScript)** com visualizações interativas responsivas via **Recharts** e estruturada em três módulos principais acessíveis por um menu global fixo:
* **📊 Painel (Dashboard):** Sala de situação executiva que exibe o status de resiliência e alertas ativos de toda a Região Metropolitana de Goiânia.
* **📥 Ingestão:** Interface de controle do pipeline para disparo e carga dos lotes históricos de satélite no Supabase.
* **🧠 Análise:** Painel científico multivariável (Temperatura e Chuva) com plotagem gráfica interativa das linhas de controle ($\mu$ e $2\sigma$) contra as projeções futuras.

---

## ⚠️ 5. Limitações Conhecidas do Protótipo
* **Abordagem Unidimensional de Variância:** Embora aplique limiares rigorosos de desvio padrão por variável, o cálculo atual avalia os desvios de forma isolada, não computando a covariância total das matrizes climáticas.
* **Resolução Topográfica:** A grade de 11km absorve macro-tendências urbanas, mas desconsidera efeitos microclimáticos de relevo acentuado e sombreamento de edifícios (*urban canyons*).
* **Heurísticas Teóricas:** Os gatilhos operacionais de risco (ex: vento a $60km/h$) baseiam-se em referências da literatura técnica e não foram calibrados com o histórico real de sinistros de redes elétricas da região.

---

## 🗺️ 6. Roadmap de Expansão (Visão de Futuro e Negócios)
Como próximos passos para evolução do MVP em uma plataforma corporativa SaaS voltada a grandes concessionárias (ex: Equatorial/Enel) e municípios, mapeia-se:

1. **Indexação por Hexágonos H3 (Uber):** Substituir a grade genérica pela malha discreta global H3 (Resolução 6 ou 7) para unificar divisões espaciais e permitir a agregação de unidades administrativas internas das empresas usuárias.
2. **Camada de Ativos Sensíveis:** Adicionar o cruzamento espacial de transformadores, subestações e linhas de distribuição no mapa, correlacionando a proximidade da anomalia climática com o nível de criticidade do ativo elétrico.
3. **Ciência de Dados Colaborativa (Crowdsourcing):** Criar canais para que operadores em campo ou usuários reportem eventos reais (queda de cabos, alagamentos) via coordenadas, alimentando o banco para futura calibração algorítmica.
4. **Variáveis Biogeográficas (NDVI):** Integrar índices de vegetação obtidos por imagens de satélite (Sentinel/Landsat) para mapear a densidade arbórea sobreposta à rede elétrica, refinando o risco de queda de galhos em tempestades.
5. **Modelagem Multivariada Avançada:** Substituir o Sigma Score linear por uma **Análise de Componentes Principais (PCA)** integrada ao cálculo de **Distância de Mahalanobis**, traçando limites de controle qui-quadrado ($\chi^2$) sobre a matriz climática.
6. **Validação por Dados Oficiais (ANEEL):** Importar o histórico de indicadores DEC e FEC da ANEEL para realizar a validação e retroalimentação preditiva do modelo.
