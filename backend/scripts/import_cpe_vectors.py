import pandas as pd
import psycopg2
import os, sys
from dotenv import dotenv_values

config = dotenv_values(".env")
conn = psycopg2.connect(config["VECTOR_DATABASE_URL"])
cur = conn.cursor()

file_path = sys.argv[1]
print(f"Reading {file_path}...")
df = pd.read_parquet(file_path)  # works with any parquet version
print(f"Loaded {len(df):,} rows\n")

BATCH = 2000
for i in range(0, len(df), BATCH):
    batch = df.iloc[i:i+BATCH]
    values = [
        (row.cpe_name, row.title, row.embed_text, f"[{','.join(str(v) for v in row.embedding)}]")
        for row in batch.itertuples()
    ]
    cur.executemany("""
        INSERT INTO cpe_vectors (cpe_name, title, embed_text, embedding)
        VALUES (%s, %s, %s, %s::vector)
        ON CONFLICT (cpe_name) DO NOTHING
    """, values)
    conn.commit()
    print(f"  {i + len(batch):,} / {len(df):,}")

cur.close()
conn.close()
print("Done.")