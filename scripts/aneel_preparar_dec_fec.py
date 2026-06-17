from pathlib import Path
import unicodedata
import zipfile
import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data" / "aneel"
OUTPUT_DIR = DATA_DIR / "processado"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


USAR_APENAS_ULTIMA_DECADA = True

# Ajuste conforme o menor ano existente em public.climate_series.
# Se o seu climate_series começar em 2023, mantenha 2023.
ANO_INICIAL_VALIDACAO = 2023

# Para validação temporal robusta, use agente_goias.
# Depois podemos fazer uma segunda versão com goiania_keywords.
MODO_FILTRO_GEOGRAFICO = "agente_goias"


AGENTES_GOIAS_KEYWORDS = [
    "EQUATORIAL GO",
    "EQUATORIAL GOIAS",
    "EQUATORIAL GOIÁS",
    "ENEL GO",
    "ENEL GOIAS",
    "ENEL GOIÁS",
    "CELG",
    "CELG-D",
]


CONJUNTOS_GOIANIA_KEYWORDS = [
    "GOIANIA",
    "GOIÂNIA",
    "AP. DE GOIANIA",
    "AP. DE GOIÂNIA",
    "APARECIDA DE GOIANIA",
    "APARECIDA DE GOIÂNIA",
    "AEROPORTO",
    "ATLANTICO",
    "CAMPINAS",
    "FERROVIARIO",
    "GARAVELLO",
    "GOIA",
    "GOYA",
]


COLUNAS_INDICADORES = [
    "DatGeracaoConjuntoDados",
    "IdeConjUndConsumidoras",
    "DscConjUndConsumidoras",
    "SigAgente",
    "NumCNPJ",
    "SigIndicador",
    "AnoIndice",
    "NumPeriodoIndice",
    "VlrIndiceEnviado",
]


COLUNAS_LIMITES = [
    "DatGeracaoConjuntoDados",
    "SigAgente",
    "NumCNPJ",
    "IdeConjUndConsumidoras",
    "DscConjUndConsumidoras",
    "SigIndicador",
    "AnoLimiteQualidade",
    "VlrLimite",
]


def normalize_text(value: object) -> str:
    text = "" if value is None else str(value)
    text = text.strip().upper()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))

    return " ".join(text.split())


def parse_decimal_br(value):
    if value is None:
        return None

    text = str(value).strip().replace('"', "").replace("'", "")

    if text == "" or text.lower() in {"nan", "none", "null"}:
        return None

    if text.startswith(","):
        text = f"0{text}"

    text = text.replace(".", "").replace(",", ".")

    try:
        return float(text)
    except ValueError:
        return None


def read_text_file(path: Path):
    encodings = ["utf-8-sig", "latin1", "cp1252"]

    for encoding in encodings:
        try:
            with open(path, "r", encoding=encoding, errors="strict") as file:
                return file.read().splitlines()
        except UnicodeDecodeError:
            continue

    with open(path, "r", encoding="latin1", errors="ignore") as file:
        return file.read().splitlines()

def decode_bytes_to_lines(content: bytes) -> list[str]:
    encodings = ["utf-8-sig", "latin1", "cp1252"]

    for encoding in encodings:
        try:
            return content.decode(encoding).splitlines()
        except UnicodeDecodeError:
            continue

    return content.decode("latin1", errors="ignore").splitlines()


def read_zip_file(path: Path, tipo: str) -> pd.DataFrame:
    frames = []

    with zipfile.ZipFile(path, "r") as zip_file:
        members = [
            member
            for member in zip_file.namelist()
            if not member.endswith("/")
            and not member.startswith("__MACOSX/")
            and member.lower().endswith((".csv", ".txt"))
        ]

        if not members:
            raise ValueError(f"Nenhum CSV/TXT encontrado dentro do ZIP: {path}")

        print(f"Arquivos encontrados dentro do ZIP {path.name}:")
        for member in members:
            print(f"  - {member}")

        for member in members:
            with zip_file.open(member) as file:
                content = file.read()

            lines = decode_bytes_to_lines(content)
            lines = [line.strip() for line in lines if line and line.strip()]

            if not lines:
                continue

            data_lines = lines[1:]

            if tipo == "indicadores":
                parsed_rows = [split_indicador_line(line) for line in data_lines]
                df = pd.DataFrame(parsed_rows, columns=COLUNAS_INDICADORES)
            elif tipo == "limites":
                parsed_rows = [split_limite_line(line) for line in data_lines]
                df = pd.DataFrame(parsed_rows, columns=COLUNAS_LIMITES)
            else:
                raise ValueError(f"Tipo de arquivo não suportado: {tipo}")

            df["source_member"] = member
            frames.append(df)

    if not frames:
        return pd.DataFrame()

    return pd.concat(frames, ignore_index=True)

def split_indicador_line(line: str) -> list[str | None]:
    """
    Arquivo de indicadores:
    DatGeracaoConjuntoDados,
    IdeConjUndConsumidoras,
    DscConjUndConsumidoras,
    SigAgente,
    NumCNPJ,
    SigIndicador,
    AnoIndice,
    NumPeriodoIndice,
    VlrIndiceEnviado

    O problema é que VlrIndiceEnviado usa vírgula decimal.
    Por isso usamos split com limite de 8 separações.
    """
    parts = line.split(",", 8)

    if len(parts) < len(COLUNAS_INDICADORES):
        parts = parts + [None] * (len(COLUNAS_INDICADORES) - len(parts))

    return [part.strip() if isinstance(part, str) else part for part in parts]


def split_limite_line(line: str) -> list[str | None]:
    """
    Arquivo de limites:
    DatGeracaoConjuntoDados,
    SigAgente,
    NumCNPJ,
    IdeConjUndConsumidoras,
    DscConjUndConsumidoras,
    SigIndicador,
    AnoLimiteQualidade,
    VlrLimite

    VlrLimite também pode usar vírgula decimal.
    """
    parts = line.split(",", 7)

    if len(parts) < len(COLUNAS_LIMITES):
        parts = parts + [None] * (len(COLUNAS_LIMITES) - len(parts))

    return [part.strip() if isinstance(part, str) else part for part in parts]


def expand_single_column_parquet(df: pd.DataFrame, tipo: str) -> pd.DataFrame:
    """
    Alguns arquivos parquet da ANEEL vêm com uma única coluna.
    O nome da coluna é o cabeçalho CSV e cada célula é uma linha CSV.
    """
    if df.empty or len(df.columns) != 1:
        return df

    rows = df.iloc[:, 0].astype(str).tolist()

    if tipo == "indicadores":
        parsed_rows = [split_indicador_line(row) for row in rows if row.strip()]
        return pd.DataFrame(parsed_rows, columns=COLUNAS_INDICADORES)

    if tipo == "limites":
        parsed_rows = [split_limite_line(row) for row in rows if row.strip()]
        return pd.DataFrame(parsed_rows, columns=COLUNAS_LIMITES)

    return df


def read_delimited_file(path: Path, tipo: str) -> pd.DataFrame:
    lines = read_text_file(path)
    lines = [line.strip() for line in lines if line and line.strip()]

    if not lines:
        return pd.DataFrame()

    data_lines = lines[1:]

    if tipo == "indicadores":
        parsed_rows = [split_indicador_line(line) for line in data_lines]
        return pd.DataFrame(parsed_rows, columns=COLUNAS_INDICADORES)

    if tipo == "limites":
        parsed_rows = [split_limite_line(line) for line in data_lines]
        return pd.DataFrame(parsed_rows, columns=COLUNAS_LIMITES)

    raise ValueError(f"Tipo de arquivo não suportado: {tipo}")


def read_aneel_file(path: Path, tipo: str) -> pd.DataFrame:
    suffix = path.suffix.lower()

    if suffix == ".zip":
        return read_zip_file(path, tipo)

    if suffix == ".parquet":
        df = pd.read_parquet(path)
        return expand_single_column_parquet(df, tipo)

    if suffix in {".csv", ".txt"}:
        return read_delimited_file(path, tipo)

    raise ValueError(f"Formato não suportado: {path}")


def normalizar_df(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(col).strip() for col in df.columns]

    for col in df.columns:
        if df[col].dtype == "object":
            df[col] = df[col].astype(str).str.strip()

    return df


def encontrar_arquivos_indicadores():
    arquivos = []

    for arquivo in DATA_DIR.glob("*"):
        nome = arquivo.name.lower()

        if not arquivo.is_file():
            continue

        if "limite" in nome or "atributo" in nome or "dicionario" in nome:
            continue

        if arquivo.suffix.lower() not in {".csv", ".txt", ".parquet", ".zip"}:
            continue

        if USAR_APENAS_ULTIMA_DECADA:
            if "2020-2029" in nome:
                arquivos.append(arquivo)
        else:
            if "2010-2019" in nome or "2020-2029" in nome:
                arquivos.append(arquivo)

    # Prioridade: ZIP > CSV/TXT > PARQUET.
    # O seu parquet 2020-2029 veio somente com 2020, então o ZIP deve ser preferido.
    zips = [arquivo for arquivo in arquivos if arquivo.suffix.lower() == ".zip"]
    if zips:
        return sorted(zips)

    csvs = [
        arquivo
        for arquivo in arquivos
        if arquivo.suffix.lower() in {".csv", ".txt"}
    ]
    if csvs:
        return sorted(csvs)

    return sorted(arquivos)


def encontrar_arquivo_limite():
    for arquivo in DATA_DIR.glob("*"):
        nome = arquivo.name.lower()

        if "limite" in nome and arquivo.suffix.lower() in {".csv", ".txt", ".parquet"}:
            return arquivo

    return None


def diagnosticar_base_indicadores(df: pd.DataFrame, etapa: str):
    print("\n" + "-" * 80)
    print(f"Diagnóstico indicadores - {etapa}")
    print(f"Total de registros: {len(df)}")

    if df.empty:
        print("Base vazia nesta etapa.")
        return

    if "SigAgente" in df.columns:
        agentes = sorted(df["SigAgente"].dropna().astype(str).str.strip().unique().tolist())
        print(f"Total de agentes: {len(agentes)}")
        print("Agentes com GO/GOIAS/CELG/EQUATORIAL/ENEL:")
        for agente in agentes:
            agente_norm = normalize_text(agente)
            if (
                "GO" in agente_norm
                or "GOIAS" in agente_norm
                or "CELG" in agente_norm
                or "EQUATORIAL" in agente_norm
                or "ENEL" in agente_norm
            ):
                print(f"  - {agente}")

    if "SigIndicador" in df.columns:
        indicadores = sorted(df["SigIndicador"].dropna().astype(str).str.strip().unique().tolist())
        print(f"Indicadores encontrados, amostra: {indicadores[:50]}")

    if "AnoIndice" in df.columns:
        anos = sorted(pd.to_numeric(df["AnoIndice"], errors="coerce").dropna().astype(int).unique().tolist())
        print(f"Anos encontrados: {anos}")


def carregar_indicadores_apurados() -> pd.DataFrame:
    arquivos = encontrar_arquivos_indicadores()

    if not arquivos:
        raise FileNotFoundError(
            "Nenhum arquivo de indicadores encontrado. "
            "Verifique se indicadores-continuidade-coletivos-2020-2029.parquet "
            "está em data/aneel."
        )

    frames = []

    for arquivo in arquivos:
        print(f"Lendo indicadores: {arquivo.name}")

        df = normalizar_df(read_aneel_file(arquivo, tipo="indicadores"))

        if "source_member" not in df.columns:
            df["source_member"] = None

        df["source_file"] = arquivo.name

        frames.append(df)

    df = pd.concat(frames, ignore_index=True)

    faltantes = [col for col in COLUNAS_INDICADORES if col not in df.columns]

    if faltantes:
        raise ValueError(
            "Colunas esperadas não encontradas na base de indicadores: "
            f"{faltantes}. Colunas encontradas: {list(df.columns)}"
        )

    diagnosticar_base_indicadores(df, "após leitura bruta")

    colunas_extras = [
        col for col in ["source_file", "source_member"] if col in df.columns
    ]

    df = df[COLUNAS_INDICADORES + colunas_extras].copy()

    df["IdeConjUndConsumidoras"] = df["IdeConjUndConsumidoras"].astype(str).str.strip()
    df["DscConjUndConsumidoras"] = df["DscConjUndConsumidoras"].astype(str).str.strip()
    df["SigAgente"] = df["SigAgente"].astype(str).str.strip()
    df["SigIndicador"] = df["SigIndicador"].astype(str).str.strip().str.upper()

    df["AnoIndice"] = pd.to_numeric(df["AnoIndice"], errors="coerce").astype("Int64")
    df["NumPeriodoIndice"] = pd.to_numeric(
        df["NumPeriodoIndice"], errors="coerce"
    ).astype("Int64")

    df["VlrIndiceEnviado"] = df["VlrIndiceEnviado"].apply(parse_decimal_br)

    df = df[df["AnoIndice"].notna()]
    df = df[df["NumPeriodoIndice"].notna()]

    diagnosticar_base_indicadores(df, "após converter ano e período")

    df = df[df["SigIndicador"].isin(["DEC", "FEC"])]

    diagnosticar_base_indicadores(df, "após filtrar somente DEC/FEC")

    return df


def carregar_limites() -> pd.DataFrame | None:
    arquivo = encontrar_arquivo_limite()

    if not arquivo:
        print("Arquivo de limites não encontrado. O CSV será gerado sem limites.")
        return None

    print(f"Lendo limites: {arquivo.name}")

    df = normalizar_df(read_aneel_file(arquivo, tipo="limites"))

    faltantes = [col for col in COLUNAS_LIMITES if col not in df.columns]

    if faltantes:
        print("Não foi possível processar o arquivo de limites automaticamente.")
        print(f"Colunas faltantes: {faltantes}")
        print(f"Colunas encontradas: {list(df.columns)}")
        return None

    limite = df[COLUNAS_LIMITES].copy()

    limite["IdeConjUndConsumidoras"] = limite["IdeConjUndConsumidoras"].astype(str).str.strip()
    limite["DscConjUndConsumidoras"] = limite["DscConjUndConsumidoras"].astype(str).str.strip()
    limite["SigAgente"] = limite["SigAgente"].astype(str).str.strip()
    limite["SigIndicador"] = limite["SigIndicador"].astype(str).str.strip().str.upper()

    limite["AnoLimiteQualidade"] = pd.to_numeric(
        limite["AnoLimiteQualidade"], errors="coerce"
    ).astype("Int64")

    limite["VlrLimite"] = limite["VlrLimite"].apply(parse_decimal_br)

    limite = limite[limite["AnoLimiteQualidade"].notna()]
    limite = limite[limite["SigIndicador"].isin(["DEC", "FEC"])]

    limite = limite.rename(columns={"AnoLimiteQualidade": "AnoIndice"})

    return limite


def filtrar_agente_goias(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    if df.empty:
        print("\nA base recebida para filtro de agente está vazia.")
        return df

    df["_agente_norm"] = df["SigAgente"].apply(normalize_text)

    keywords_norm = [normalize_text(keyword) for keyword in AGENTES_GOIAS_KEYWORDS]

    mask = df["_agente_norm"].apply(
        lambda value: any(keyword in value for keyword in keywords_norm)
    )

    filtrado = df[mask].copy()

    if filtrado.empty:
        print("\nNenhum agente de Goiás foi encontrado com os termos configurados.")
        print("Agentes disponíveis na base DEC/FEC:")
        agentes = sorted(df["SigAgente"].dropna().unique().tolist())
        for agente in agentes[:300]:
            print(f"  - {agente}")

        diagnostico_path = OUTPUT_DIR / "diagnostico_agentes_disponiveis.csv"

        (
            df[["SigAgente", "NumCNPJ"]]
            .drop_duplicates()
            .sort_values(["SigAgente", "NumCNPJ"])
            .to_csv(diagnostico_path, index=False, encoding="utf-8-sig")
        )

        print(f"Diagnóstico salvo em: {diagnostico_path}")

    return filtrado


def filtrar_ano_validacao(df: pd.DataFrame) -> pd.DataFrame:
    filtrado = df[df["AnoIndice"] >= ANO_INICIAL_VALIDACAO].copy()

    if filtrado.empty:
        anos = sorted(df["AnoIndice"].dropna().astype(int).unique().tolist())

        raise ValueError(
            f"Não há registros a partir de {ANO_INICIAL_VALIDACAO}. "
            f"Anos disponíveis para o filtro atual: {anos}. "
            "Ajuste ANO_INICIAL_VALIDACAO ou confira se o arquivo 2020-2029 "
            "baixado contém anos mais recentes."
        )

    return filtrado


def filtrar_conjuntos_goiania(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["_conjunto_norm"] = df["DscConjUndConsumidoras"].apply(normalize_text)

    keywords_norm = [normalize_text(keyword) for keyword in CONJUNTOS_GOIANIA_KEYWORDS]

    mask = df["_conjunto_norm"].apply(
        lambda value: any(keyword in value for keyword in keywords_norm)
    )

    return df[mask].copy()


def preparar_chaves(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["ide_conj_und_consumidoras"] = (
        df["IdeConjUndConsumidoras"].astype(str).str.strip()
    )

    df["_agente_key"] = df["SigAgente"].apply(normalize_text)
    df["_conjunto_key"] = df["DscConjUndConsumidoras"].apply(normalize_text)

    return df


def pivotar_dec_fec_apurado(df: pd.DataFrame) -> pd.DataFrame:
    df = preparar_chaves(df)

    pivot = (
        df.pivot_table(
            index=[
                "AnoIndice",
                "NumPeriodoIndice",
                "SigAgente",
                "ide_conj_und_consumidoras",
                "DscConjUndConsumidoras",
                "_agente_key",
                "_conjunto_key",
            ],
            columns="SigIndicador",
            values="VlrIndiceEnviado",
            aggfunc="mean",
        )
        .reset_index()
        .rename_axis(None, axis=1)
    )

    pivot = pivot.rename(
        columns={
            "AnoIndice": "ano",
            "NumPeriodoIndice": "mes",
            "SigAgente": "distribuidora",
            "DscConjUndConsumidoras": "conjunto",
            "DEC": "dec_apurado",
            "FEC": "fec_apurado",
        }
    )

    return pivot


def pivotar_dec_fec_limite(df: pd.DataFrame) -> pd.DataFrame:
    df = preparar_chaves(df)

    pivot = (
        df.pivot_table(
            index=[
                "AnoIndice",
                "SigAgente",
                "ide_conj_und_consumidoras",
                "DscConjUndConsumidoras",
                "_agente_key",
                "_conjunto_key",
            ],
            columns="SigIndicador",
            values="VlrLimite",
            aggfunc="mean",
        )
        .reset_index()
        .rename_axis(None, axis=1)
    )

    pivot = pivot.rename(
        columns={
            "AnoIndice": "ano",
            "SigAgente": "distribuidora_limite",
            "DscConjUndConsumidoras": "conjunto_limite",
            "DEC": "dec_limite",
            "FEC": "fec_limite",
        }
    )

    return pivot


def gerar_resultado(df_apurado: pd.DataFrame, df_limites: pd.DataFrame | None) -> pd.DataFrame:
    apurado_pivot = pivotar_dec_fec_apurado(df_apurado)

    if df_limites is not None and not df_limites.empty:
        limites_pivot = pivotar_dec_fec_limite(df_limites)

        resultado = apurado_pivot.merge(
            limites_pivot[
                [
                    "ano",
                    "ide_conj_und_consumidoras",
                    "_agente_key",
                    "_conjunto_key",
                    "dec_limite",
                    "fec_limite",
                ]
            ],
            on=[
                "ano",
                "ide_conj_und_consumidoras",
                "_agente_key",
                "_conjunto_key",
            ],
            how="left",
        )
    else:
        resultado = apurado_pivot.copy()
        resultado["dec_limite"] = None
        resultado["fec_limite"] = None

    if MODO_FILTRO_GEOGRAFICO == "agente_goias":
        resultado["municipio_referencia"] = "GOIÁS - AGENTE"
    else:
        resultado["municipio_referencia"] = "GOIÂNIA/GO"

    resultado = resultado[
        [
            "ano",
            "mes",
            "distribuidora",
            "ide_conj_und_consumidoras",
            "conjunto",
            "municipio_referencia",
            "dec_apurado",
            "dec_limite",
            "fec_apurado",
            "fec_limite",
        ]
    ].copy()

    resultado["ano"] = resultado["ano"].astype("Int64")
    resultado["mes"] = resultado["mes"].astype("Int64")

    resultado = resultado.sort_values(
        ["ano", "mes", "distribuidora", "conjunto"]
    )

    return resultado


def salvar_csv(df: pd.DataFrame, path: Path):
    df.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"Arquivo salvo: {path}")
    print(f"Registros: {len(df)}")


def main():
    print("\nConfiguração da preparação ANEEL:")
    print(f"- Usar apenas base 2020-2029: {USAR_APENAS_ULTIMA_DECADA}")
    print(f"- Ano inicial de validação: {ANO_INICIAL_VALIDACAO}")
    print(f"- Modo de filtro geográfico: {MODO_FILTRO_GEOGRAFICO}")

    indicadores = carregar_indicadores_apurados()
    limites = carregar_limites()

    indicadores_goias = filtrar_agente_goias(indicadores)

    if indicadores_goias.empty:
        raise ValueError(
            "Nenhum registro de DEC/FEC encontrado para agentes de Goiás. "
            "Abra data/aneel/processado/diagnostico_agentes_disponiveis.csv "
            "e verifique o nome correto do agente de Goiás na base."
        )

    limites_goias = filtrar_agente_goias(limites) if limites is not None else None

    conjuntos_goias = (
        indicadores_goias[
            ["SigAgente", "IdeConjUndConsumidoras", "DscConjUndConsumidoras"]
        ]
        .drop_duplicates()
        .sort_values(["SigAgente", "DscConjUndConsumidoras"])
    )

    salvar_csv(conjuntos_goias, OUTPUT_DIR / "conjuntos_goias_encontrados_antes_filtro_ano.csv")

    indicadores_goias = filtrar_ano_validacao(indicadores_goias)

    if limites_goias is not None and not limites_goias.empty:
        limites_goias = filtrar_ano_validacao(limites_goias)

    if MODO_FILTRO_GEOGRAFICO == "goiania_keywords":
        indicadores_final = filtrar_conjuntos_goiania(indicadores_goias)
        limites_final = filtrar_conjuntos_goiania(limites_goias) if limites_goias is not None else None

        if indicadores_final.empty:
            raise ValueError(
                "Nenhum conjunto de Goiânia encontrado. "
                "Use MODO_FILTRO_GEOGRAFICO = 'agente_goias'."
            )

        conjuntos_goiania = (
            indicadores_final[
                ["SigAgente", "IdeConjUndConsumidoras", "DscConjUndConsumidoras"]
            ]
            .drop_duplicates()
            .sort_values(["SigAgente", "DscConjUndConsumidoras"])
        )

        salvar_csv(conjuntos_goiania, OUTPUT_DIR / "conjuntos_goiania_encontrados.csv")
    else:
        indicadores_final = indicadores_goias.copy()
        limites_final = limites_goias.copy() if limites_goias is not None else None

    resultado = gerar_resultado(indicadores_final, limites_final)

    output_path = OUTPUT_DIR / "aneel_dec_fec_monthly.csv"
    salvar_csv(resultado, output_path)

    print("\nAmostra do arquivo final:")
    print(resultado.head(20))

    print("\nDistribuidoras no arquivo final:")
    print(sorted(resultado["distribuidora"].dropna().unique().tolist()))

    print("\nAnos no arquivo final:")
    print(sorted(resultado["ano"].dropna().astype(int).unique().tolist()))

    print("\nPeríodo no arquivo final:")
    print(
        f"{resultado['ano'].min()}-{resultado['mes'].min()} até "
        f"{resultado['ano'].max()}-{resultado['mes'].max()}"
    )

    print("\nTotal de conjuntos:")
    print(resultado["ide_conj_und_consumidoras"].nunique())


if __name__ == "__main__":
    main()