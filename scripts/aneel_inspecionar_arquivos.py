from pathlib import Path
import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data" / "aneel"


def parse_decimal_br(value):
    if value is None:
        return None

    text = str(value).strip().replace('"', '').replace("'", "")

    if text == "" or text.lower() in {"nan", "none", "null"}:
        return None

    # Casos como ",89" devem virar "0,89"
    if text.startswith(","):
        text = f"0{text}"

    # Casos pt-BR: "1.234,56" -> "1234.56"
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


def read_aneel_file(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".parquet":
        return pd.read_parquet(path)

    lines = read_text_file(path)

    lines = [line.strip() for line in lines if line and line.strip()]

    if not lines:
        return pd.DataFrame()

    header = lines[0].lstrip("\ufeff")

    # A base pode vir com vírgula, mas valores decimais também usam vírgula.
    # Por isso fazemos split limitado pelo número de colunas do cabeçalho.
    sep = "," if header.count(",") >= header.count(";") else ";"
    columns = [col.strip() for col in header.split(sep)]
    max_splits = len(columns) - 1

    rows = []

    for line in lines[1:]:
        parts = line.split(sep, max_splits)

        if len(parts) < len(columns):
            parts = parts + [None] * (len(columns) - len(parts))

        rows.append([part.strip() if isinstance(part, str) else part for part in parts])

    return pd.DataFrame(rows, columns=columns)


def normalizar_df(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(col).strip() for col in df.columns]

    for col in df.columns:
        if df[col].dtype == "object":
            df[col] = df[col].astype(str).str.strip()

    return df


def inspecionar():
    if not DATA_DIR.exists():
        raise FileNotFoundError(f"Pasta não encontrada: {DATA_DIR}")

    arquivos = sorted(
        [
            *DATA_DIR.glob("*.csv"),
            *DATA_DIR.glob("*.txt"),
            *DATA_DIR.glob("*.parquet"),
        ]
    )

    if not arquivos:
        raise FileNotFoundError(f"Nenhum arquivo encontrado em: {DATA_DIR}")

    print("\nArquivos encontrados:")
    for arquivo in arquivos:
        print(f"- {arquivo.name}")

    for arquivo in arquivos:
        print("\n" + "=" * 80)
        print(f"Arquivo: {arquivo.name}")

        df = normalizar_df(read_aneel_file(arquivo))

        print("\nColunas:")
        print(list(df.columns))

        print("\nAmostra:")
        print(df.head(5))

        colunas_texto = df.select_dtypes(include="object").columns

        for coluna in colunas_texto:
            serie = df[coluna].astype(str)

            mask = serie.str.contains(
                "GOIAS|GOIÁS|GOIANIA|GOIÂNIA|EQUATORIAL|ENEL|CELG",
                case=False,
                na=False,
            )

            valores = sorted(serie[mask].dropna().unique().tolist())

            if valores:
                print(f"\nValores possivelmente relevantes na coluna [{coluna}]:")
                for valor in valores[:50]:
                    print(f"  - {valor}")

    print("\nInspeção concluída.")


if __name__ == "__main__":
    inspecionar()