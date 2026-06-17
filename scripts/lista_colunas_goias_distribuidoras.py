import pandas as pd

arquivo = "data/indicadores-continuidade-coletivos-2020-2029.parquet"

df = pd.read_parquet(arquivo)

print(df.columns)
print(df.head())

colunas_texto = df.select_dtypes(include="object").columns

for coluna in colunas_texto:
    valores = df[df[coluna].astype(str).str.contains("GOIAS|GOIÁS|GOIANIA|GOIÂNIA|EQUATORIAL|ENEL", case=False, na=False)][coluna].unique()
    if len(valores) > 0:
        print("\n", coluna)
        print(valores[:30])