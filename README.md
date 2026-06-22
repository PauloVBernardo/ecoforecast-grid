# 🌤️ EcoGrid Maps — Sala de Situação Climática Operacional

> **Aplicação de inteligência climática e validação regulatória para a área urbana de Goiânia** > **Deploy:** https://ecoforecast-grid.vercel.app/  
> **Stack:** Next.js + TailwindCSS + Supabase (PostgreSQL) + H3 + Leaflet + Open-Meteo

---

## 1. O Problema

Eventos climáticos extremos — como chuvas torrenciais, ventanias, ondas de calor e ar seco — não afetam uma cidade de maneira uniforme, principalmente quando falamos de grandes cidades e metrópoles como Goiânia. Mesmo dentro de um único município, diferentes bairros sofrem pressões ambientais completamente distintas.

No setor de distribuição de energia elétrica ou até mesmo para o tabalho de uma prefeitura, essa visão territorial é crítica. O estresse climático é um dos maiores causadores de falhas físicas na rede (quedas de galhos, rompimentos de cabos, sobrecarga de transformadores), o que aumenta a frequência de interrupções, pressiona o despacho de equipes de campo e afeta diretamente a continuidade do serviço prestado à população.

Apesar disso, a maioria dos sistemas de monitoramento ainda olha para o clima de forma macro (a tradicional "previsão para a cidade"), dificultando uma antecipação cirúrgica por parte das equipas operacionais. O **EcoGrid Maps** nasce para resolver essa lacuna: é um protótipo *mobile-first* que divide a cidade em pequenos polígonos (quadrantes H3) e cruza o histórico de cada pedaço da cidade com a previsão futura, transformando a meteorologia bruta em uma **priorização operacional acionável**.

---

## 2. Fontes dos Dados

Para construir a inteligência do EcoGrid, unimos dados de três naturezas diferentes:

1. **Dados Climáticos (Open-Meteo API):** * **Histórico:** Consumimos a *Archive API* (baseada nos modelos globais reanalisados, como o ERA5) para construir uma linha de base (*baseline*) de 3 anos de comportamento climático diário para cada quadrante monitorado.
   * **Previsão:** Consumimos a *Forecast API* para mapear o horizonte dos próximos 7 dias em tempo real.
   * *Variáveis coletadas:* Temperatura (máxima e mínima), Precipitação, Velocidade do Vento, Umidade Relativa, Radiação Solar, Evapotranspiração e Umidade do Solo.
2. **Grade Espacial (Uber H3):** * Utilizamos o sistema global de indexação H3 para fatiar a área urbana de Goiânia em hexágonos padronizados. Diferente de um grid quadrado comum, o hexágono garante distâncias idênticas do centro para todas as suas bordas, otimizando análises de raio geográfico e adjacência.
3. **Indicadores Regulatórios (ANEEL):** * Para validar se a nossa matemática de risco climático fazia sentido na vida real da rede elétrica, utilizamos a base pública de Continuidade (DEC e FEC) da Equatorial GO (Disponível no site da ANEEL), compreendendo o período de junho de 2023 a abril de 2026.

---

## 3. Abordagem Técnica: O Motor Analítico

O coração do EcoGrid não está apenas em mostrar a previsão do tempo, mas em interpretá-la sob a ótica do impacto. A aplicação processa os dados em **três camadas analíticas complementares**:

### Camada 1: O Termômetro (Análise Estatística Univariada)
Nós olhamos para cada variável isoladamente e perguntamos: *isto é normal para este quadrante nesta época do ano?* O sistema calcula o Desvio Padrão e o Score Padronizado (Z-Score) da previsão contra a média histórica daquele ponto geográfico. É aqui que usamos os limites percentis para definir anomalias de forma bicaudal:
* **O que é o P95 (Percentil 95)?** Se uma variável (como a temperatura) atinge a faixa do P95, significa que o valor previsto é superior a 95% de todos os dias já registrados na história daquele quadrante. É um evento raro que acende um **Alerta Alto**.
* **O que é o P99 (Percentil 99)?** É o extremo do extremo. Uma condição meteorológica tão severa que supera 99% de todo o histórico local, gerando um **Alerta Crítico**.
* *Nota:* O sistema também monitora o limite inferior (**P05**) para identificar anomalias de frio extremo de forma simétrica.

### Camada 2: O Radar (Distância de Mahalanobis / Multivariada)
A natureza age em sinergia. Às vezes, o vento previsto não quebrou recordes, a chuva não foi torrencial e o calor parece suportável de forma isolada. Contudo, a ocorrência dessas variáveis *exatamente ao mesmo tempo* pode formar uma combinação climática altamente atípica e estressante para o ambiente urbano. 
Implementamos a lógica da **Distância de Mahalanobis** no backend (`src/lib/statistics/multivariateAnomaly.ts`). Através da matriz de covariância do histórico padronizado, o modelo identifica essas "anomalias compostas", calculando a forma quadrática $D^2 = z^T \Sigma^{-1} z$ para capturar riscos que passariam invisíveis por radares univariados comuns.

### Camada 3: A Triagem (Score Operacional Heurístico)
A anomalia estatística diz o quão *raro* o clima está, mas a operação de campo precisa saber o que *danifica a infraestrutura*. O Score Operacional traduz a previsão numa escala prática de priorização:
* Atribui penalidades diretas para chuva forte ($\ge 50\text{mm/dia}$) e ventânia ($\ge 60\text{km/h}$).
* Aplica um multiplicador de **Bónus de Sinergia** caso ambos ocorram no mesmo dia (evento composto de chuva e vento), simulando o efeito ecológico de fatores limitantes combinados.
* O resultado gera um ranking em tempo real de quais quadrantes exigem atenção imediata ou mobilização preventiva de equipas de manutenção.

> 📊 **Nota de Interface (UX):** A aplicação possui uma aba "**Sobre**" que contém uma galeria interativa de infográficos expansíveis (*componentes `<details>` estilizados no tema Dark*). Eles detalham visualmente toda esta engrenagem matemática (curva Gaussiana de percentis, elipse de covariância e a validação do negócio) para garantir uma leitura clara tanto para engenheiros como para diretores executivos.

---

## 4. Validação Regulatória (DEC / FEC)

Para comprovar a eficácia e o valor de negócio do protótipo, testamos o modelo contra o histórico real de interrupções da distribuidora local obtido na base da ANEEL.

* **Metodologia de Cruzamento:** Como os dados da ANEEL são publicados por "Conjuntos Elétricos" (irregularidades topológicas das subestações) e o EcoGrid trabalha com hexágonos padronizados, evitou-se um cruzamento espacial direto sem o cadastro GIS completo da rede. A validação foi feita de forma **temporal e agregada**, calculando a correlação entre o estresse climático médio mensal da cidade e as médias de interrupção em Goiânia ao longo de **35 meses**.
* **Resultados da Correlação de Pearson ($r$):**
  * **Score EcoGrid × FEC (Frequência):** $0,441$ (Correlação positiva moderada — a maior aderência observada).
  * **Score EcoGrid × DEC (Duração):** $0,375$ (Correlação positiva moderada).
  * *Controle:* A correlação da chuva pura isolada com o DEC/FEC ficou próxima de zero ($0,195$ e $-0,026$).
* **Interpretação Prática:** Os resultados provam que a abordagem multivariada do EcoGrid descreve o estresse real da rede muito melhor do que olhar apenas para a chuva isolada. O modelo correlaciona-se melhor com o **FEC**, confirmando a hipótese de que o clima severo é o gatilho que quebra as estruturas físicas e causa a queda. Já o **DEC** (tempo que a energia fica desligada) sofre influência de fatores externos ao clima, como a logística, tamanho da frota nas ruas e o tempo de deslocamento das equipas.

---

## 5. Limitações do Protótipo

Com o rigor científico necessário para o desenvolvimento do projeto, foram mapeadas as seguintes limitações que delimitam o escopo atual do protótipo:

1. **Ausência de Causalidade Direta:** A correlação de Pearson comprova a aderência estatística temporal (quando a pressão climática sobe, as falhas sobem), mas não dita uma relação de causa e efeito isolada, visto que fatores estruturais da rede e manutenções preventivas também alteram os indicadores.
2. **Resolução Espacial da Validação:** Devido à natureza opaca dos dados públicos da ANEEL (consolidados por mês e por conjunto), a validação atesta a inteligência do modelo no tempo (meses críticos), mas carece de uma validação georreferenciada micro (evento a evento por quadrante).
3. **Calibração Heurística:** O Score Operacional utiliza pesos fixos baseados em regras de negócio iniciais. Para ambiente de produção real, estes limiares devem ser refinados via algoritmos de aprendizado de máquina treinados com o histórico de Ordens de Serviço (OS) da concessionária.
4. **Simplificação da Malha Física:** O grid H3 analisa estritamente a atmosfera e o solo da coordenada. O modelo atual não sabe o volume de ativos (transformadores, quilómetros de cabos nus ou subestações) presentes dentro de cada hexágono.
5. **PCA como Evolução Futura:** O sistema implementa com sucesso a Distância de Mahalanobis para anomalias estatísticas compostas. A Análise de Componentes Principais (PCA) não foi integrada nesta versão, permanecendo no *roadmap* como melhoria futura para redução de dimensionalidade e eliminação de redundâncias entre as 8 variáveis climáticas.

---

## 6. Como Executar Localmente

### Pré-requisitos
* Node.js (v18 ou superior)
* Instância do Supabase ativa (PostgreSQL)

### Instalação

```bash
# Clone o repositório e instale as dependências
npm install

# Configure as variáveis de ambiente no ficheiro .env.local
# NEXT_PUBLIC_SUPABASE_URL=seu_link_supabase
# NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima
# SUPABASE_SERVICE_ROLE_KEY=sua_chave_role_service

# Execute o ambiente de desenvolvimento
npm run dev

## Estrutura do Repositório

```text
ecogrid-maps/
├── public/                          # Arquivos estáticos e assets visuais
│   ├── metodologia-mahalanobis.png  # Infográficos metodológicos da aba "Sobre"
│   ├── metodologia-score.png
│   ├── metodologia-univariada.png
│   └── metodologia-validacao.png
├── scripts/                         # Pipeline de dados, ETL e rotinas em background
│   ├── aneel_inspecionar...py       
│   ├── aneel_preparar_dec_fec.py    # Processamento em Python da base ANEEL (DEC/FEC)
│   ├── ingest-analysis-grid-history.ts
│   ├── lista_colunas_goias_distribuidoras.py # Script para filtragem de dados da ANEEL de DEC/FEC
│   ├── seed-analysis-grid.ts        # Script de geração da malha espacial H3
│   └── update-forecast-anomalies.ts # Rotina de atualização de previsões e anomalias
├── src/
│   ├── app/                         # Frontend da aplicação (Next.js App Router)
│   │   ├── (main)/                  # Grupo de rotas da aplicação logada
│   │   │   ├── analise/page.tsx     # Tela de gráficos individuais e diagnóstico
│   │   │   ├── apresentacao/page.tsx# Rota de demonstração interativa para a banca
│   │   │   ├── configuracao/page.tsx# Ajustes e parametrizações operacionais
│   │   │   └── sobre/page.tsx       # Documentação metodológica e glossário
│   │   ├── api/                     # Rotas de API internas (Serverless Functions)
│   │   ├── globals.css              # Configurações globais do TailwindCSS
│   │   └── layout.tsx               # Layout principal da interface
│   ├── components/                  # Componentes React reutilizáveis
│   │   ├── charts/                  # Gráficos dinâmicos (Recharts)
│   │   ├── ui/                      # Elementos base de interface (shadcn/ui ou custom)
│   │   └── EcoGridLeafletMap.tsx    # Componente central do mapa georreferenciado
│   ├── lib/                         # Lógicas de negócio, serviços e utilitários
│   │   ├── jobs/
│   │   │   └── dailyWeatherJob.ts   # Processamento diário e chamada do motor estatístico
│   │   ├── statistics/
│   │   │   └── multivariateAnomaly.ts # Motor matemático (Mahalanobis e Covariância)
│   │   └── supabase/                # Clientes, tipagens e conexão com o PostgreSQL
│   └── types/                       # Definições estritas de tipagem do TypeScript
├── supabase/                        # Configurações, schema e migrations do Supabase
├── .env.local                       # Variáveis de ambiente secretas (chaves de API)
├── next.config.ts                   # Configurações de compilação do Next.js
├── package.json                     # Dependências do projeto (Recharts, Leaflet, H3, etc.)
└── README.md                        # Documentação principal do repositório