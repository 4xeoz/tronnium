---
# 2026-05-05 — Semantic CPE Matching with Vector Embeddings

## The Problem We Started With

Tronnium is a vulnerability management platform. At its core, it needs to answer one question: *given an asset in someone's infrastructure, which CVEs apply to it?*

The bridge between an asset and its CVEs is the **CPE (Common Platform Enumeration)** identifier — a standardised naming scheme maintained by NIST. Every piece of software in the NVD vulnerability database is tagged with a CPE like `cpe:2.3:a:apache:http_server:2.4.51:*:*:*:*:*:*:*`. If you know an asset's CPE, you can query the NVD and get every known vulnerability for it.

The problem is that users don't speak CPE. They type things like `"httpd 2.4.51"`, `"IIS 10"`, or `"Windows Defender"`. The system has to figure out which CPE they mean.
---
## The Original Approach and Why It Was Weak

The existing pipeline worked in three steps:

1. **Parse** the user's input — extract vendor, product, version using regex and a hardcoded list of known vendor names
2. **Search** NVD's API with that extracted text as a keyword query
3. **Rank** the returned candidates using a weighted scoring formula

The ranking formula used two classical string similarity algorithms:

**Jaccard Similarity** — treats two strings as bags of tokens and measures overlap:

```
jaccard({"apache", "http"}, {"http", "server"}) = |intersection| / |union| = 1/3 = 0.33
```

**Levenshtein Distance** — counts the minimum number of character edits (insertions, deletions, substitutions) to transform one string into another:

```
levenshtein("httpd", "http_server") = 5 edits → ratio = 1 - (5/11) = 0.54
```

These algorithms work reasonably well when strings are similar in form. They completely fail when the same concept has different surface representations — abbreviations, synonyms, partial names. `"httpd"` and `"Apache HTTP Server"` share almost no tokens and have a large edit distance, despite being the same software.

The final score formula was:

```
score = vendor×0.25 + product×0.35 + version×0.25 + tokenOverlap×0.15
```

Purely surface-level string comparison. No semantic understanding whatsoever.

---

## The First Idea: Embed and Rerank

The first instinct was to keep the existing NVD keyword search to retrieve candidates, then add an embedding model on top to rerank those candidates by semantic similarity rather than string similarity.

**What are embeddings?** A sentence embedding model is a neural network that maps any text string to a fixed-size vector of floating point numbers — in our case, 384 numbers. The key property is that the model is trained so that *semantically similar strings land close together in this 384-dimensional space*, regardless of their surface form.

```
"Apache HTTP Server" → [0.021, -0.134, 0.887, ...]
"httpd"             → [0.019, -0.128, 0.881, ...]
"PostgreSQL"        → [-0.412, 0.331, -0.021, ...]
```

The first two vectors point in nearly the same direction. The third points somewhere completely different. **Cosine similarity** — the dot product of two normalised vectors — captures this: it returns 1.0 for identical direction, 0.0 for perpendicular, -1.0 for opposite.

The model we chose was `all-MiniLM-L6-v2` — a 22 million parameter transformer, fine-tuned specifically for semantic textual similarity tasks on over a billion sentence pairs. It is compact (22MB), fast on CPU, and available as an ONNX model runnable in Node.js via `@xenova/transformers`.

**The flaw in this approach** was identified during planning. If the NVD keyword search fails to return the correct CPE as a candidate — which it does for abbreviations like `"IIS"` or `"httpd"` — then the embedding reranker never sees the right answer. You cannot rerank a result that was never retrieved. The retrieval step was the broken part, and patching the ranking step did not fix it.

---

## The Decision: Replace Retrieval, Not Just Reranking

The correct architecture is well-established in information retrieval: **embed the entire corpus offline, then do semantic nearest-neighbour search at query time**. This bypasses keyword matching entirely.

The corpus is the NVD CPE dictionary — 1.55 million entries, each with a machine-readable identifier and a human-readable title like `"Apache HTTP Server 2.4.51"`.

**The plan:**

- Embed all 1.55M CPE titles offline, once, on a GPU
- Store the resulting vectors in a vector database
- At query time, embed the user's input and find the nearest vectors
- Return those CPEs as candidates, bypassing NVD's keyword search

This is the architecture the user had in mind from the beginning — we had initially underscoped it to avoid infrastructure complexity, but the reranking-only approach was correctly identified as fundamentally broken.

---

## The Embedding Problem: What Do You Actually Embed?

This required careful thought on both sides of the comparison.

**CPE side (offline):** Each CPE record has two useful fields:

- `cpeName`: `cpe:2.3:a:apache:http_server:2.4.51:*:*:*:*:*:*:*` — structured but not natural language
- `title`: `"Apache HTTP Server 2.4.51"` — human-readable

Embedding only the title works for common software. But to handle abbreviations better, we enriched the text by concatenating the structured CPE name tokens with the human title:

```
vendor tokens:   "apache http server"     (from cpe_name, underscores → spaces)
human title:     "Apache HTTP Server 2.4.51"
embedded text:   "apache http server Apache HTTP Server 2.4.51"
```

This gives the model redundant signals. If `"httpd"` maps via subword tokenisation to `"http" + "##d"`, the `"http"` piece appears multiple times in the CPE text, strengthening the match.

**Query side (runtime):** The user's raw input is passed through the existing `parseAsset()` function — which already existed in the codebase — to extract vendor and product tokens. Those are prepended to the raw input:

```
user types:     "httpd 2.4.51"
parseAsset():   vendor="httpd", product="httpd"
embedded text:  "httpd httpd httpd 2.4.51"
```

This is still weak for pure abbreviations. The honest limitation: `"IIS"` will not reliably find `"Internet Information Services"` because they share no subword tokens. This is a known boundary of the approach.

**The length asymmetry question** was raised during design: does embedding `"httpd 2.4.51"` (7 tokens) next to `"Apache HTTP Server 2.4.51"` (8 tokens) produce comparable vectors given the difference in information content?

The answer: partially. The model uses mean pooling — it averages all token embeddings into a single vector. A short string produces fewer token representations to average over, but the model's training on semantic similarity tasks means it handles common abbreviation-to-full-name pairs well. The failure cases are obscure abbreviations that don't appear frequently in training data.

---

## Infrastructure Decisions

**Where to run the embedding?** A MacBook CPU can embed at roughly 1000–2000 sentences per second with `all-MiniLM-L6-v2`. For 1.55M CPEs that is 12–25 minutes — acceptable but slow. A Google Colab T4 GPU runs the same job in 2–3 minutes, is free, and is exactly what this type of one-time batch job is designed for.

```python
model = SentenceTransformer("all-MiniLM-L6-v2")
embeddings = model.encode(texts, batch_size=512, normalize_embeddings=True)
```

The `normalize_embeddings=True` flag is critical — it ensures all vectors have unit length, which means cosine similarity simplifies to a dot product at search time.

**Where to store the vectors?** The main application database is Supabase. pgvector support on the free Supabase tier was unavailable, so a local Docker container running `pgvector/pgvector:pg16` was used exclusively for the vector table. This created a two-database architecture:

- **Supabase** — all application data (users, assets, vulnerabilities, workflows) managed by Prisma
- **Local Docker pgvector** — only the `cpe_vectors` table, accessed via raw `pg.Pool`

The two databases never join data. Vector search returns CPE name strings, which are just text — no foreign keys, no cross-database relationships.

**Why HNSW and not exact search?** Exact nearest-neighbour search over 1.55M 384-dimensional vectors requires computing the distance from the query to every single stored vector — 1.55M operations per query. HNSW (Hierarchical Navigable Small World) is a graph-based index structure that achieves approximate nearest-neighbour search in sub-linear time by building a multi-layer proximity graph during ingestion. At query time it navigates this graph rather than scanning the full table.

The tradeoff: HNSW can miss the absolute nearest neighbour in rare cases (it is *approximate*). In practice, with `m=16, ef_construction=64` and `ef_search=100`, recall is above 95% — more than sufficient for CPE matching where the user will always review the top candidates anyway.

---

## Problems Faced Along the Way

**Problem 1: Parquet version incompatibility**

The embedding script exported the parquet file using pandas' default settings (Parquet format v2). The Node.js import script used `parquetjs-lite`, which only supports Parquet v1. The error was:

```
Import failed: invalid parquet version
```

**Decision:** Rather than fight the TypeScript parquet ecosystem, the import script was rewritten in Python — which reads any parquet version natively via `pyarrow`:

```python
df = pd.read_parquet(file_path)   # works with v1 and v2, no configuration needed
```

This was the pragmatic choice. The import script is a one-time operation and Python is available on the development machine. The Node.js codebase stays clean.

**Problem 2: TypeScript type declarations missing**

`parquetjs-lite` ships no TypeScript type definitions, causing `ts-node` to error before the script even ran:

```
error TS7016: Could not find a declaration file for module 'parquetjs-lite'
```

**Decision:** Moot after Problem 1, but the general solution is to run `ts-node --transpile-only` for one-off scripts, or add a `declare module 'parquetjs-lite'` stub. Neither solution is needed after switching to Python.

---

## The Final Architecture

```
[Google Colab T4 GPU]
        │
        │  sentence-transformers: all-MiniLM-L6-v2
        │  1.55M CPE titles → 1.55M × 384-dim vectors
        │
        ▼
[cpe_embeddings.parquet]
        │
        │  Python import script
        │  psycopg2 batch inserts (2000 rows/batch)
        │
        ▼
[Docker pgvector:pg16]
  table: cpe_vectors
  index: HNSW (cosine distance)
        │
        │  pg.Pool (raw connection, read-only user)
        │
        ▼
[Express Backend]
  GET /assets/cpe/semantic-search?q=...
        │
        │  1. parseAsset() — extract vendor/product tokens
        │  2. embedQuery()  — Xenova/all-MiniLM-L6-v2 ONNX
        │  3. pgvector ANN  — embedding <=> $1::vector
        │  4. cache hit check (10-min TTL)
        │
        ▼
[Response]
  { queryText, results: [{ cpeName, title, similarity }] }
```

---

## Computer Science Concepts Used

| Concept                                                 | Where it appears                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| **Transformer neural networks**                   | `all-MiniLM-L6-v2` — the embedding model                           |
| **Mean pooling**                                  | Aggregating per-token embeddings into one sentence vector             |
| **Subword tokenisation (WordPiece)**              | How the model handles unknown words and abbreviations                 |
| **Vector space semantics**                        | The 384-dimensional space where similar text clusters together        |
| **Cosine similarity**                             | Measuring directional alignment between query and CPE vectors         |
| **Approximate Nearest Neighbour (ANN)**           | The class of algorithms that make large-scale vector search practical |
| **HNSW index**                                    | Specific ANN graph structure used by pgvector                         |
| **Jaccard similarity**                            | Still used in the legacy pipeline for token overlap scoring           |
| **Levenshtein distance**                          | Still used in the legacy pipeline for edit-distance scoring           |
| **Information retrieval: retrieval vs reranking** | The architectural distinction that drove the key design decision      |
| **Connection pooling**                            | Managing multiple concurrent DB connections efficiently               |
| **In-memory caching with TTL**                    | Avoiding redundant embedding and DB calls for repeated queries        |
| **Rate limiting**                                 | Protecting an expensive endpoint from abuse                           |

---

## What This Changes About the Product

Before: a user typing `"httpd"` might get zero useful CPE matches, or match the wrong product entirely, meaning their asset gets scanned against the wrong set of CVEs — or none at all.

After: `"httpd"` returns `"Apache HTTP Server"` at similarity 0.91. The semantic model understands that these refer to the same software. The vulnerability scan now runs against the correct CVE set.

The improvement is especially significant for OT/ICS assets — devices like Siemens PLCs or Honeywell controllers often have abbreviated or manufacturer-specific names that keyword search handles poorly. Semantic similarity handles these better because the model was trained on technical text that includes vendor documentation, security advisories, and product descriptions where these abbreviations appear alongside their full names.
