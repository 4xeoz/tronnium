import { vectorDb } from "../../../lib/vector-db";
import { parseAsset } from "../search/asset-parser";
import { embedQuery } from "./cpe-embedding.service";

export interface VectorSearchResult {
  cpeName: string;
  title: string;
  similarity: number;
}

export interface VectorSearchResponse {
  queryText: string;
  results: VectorSearchResult[];
}

export async function semanticCpeSearch(
  rawAssetName: string,
  limit: number = 30
): Promise<VectorSearchResponse> {
  // Reuse existing parser to extract vendor/product
  const parsed = await parseAsset(rawAssetName);

  // Build enriched query text — same pattern used in Colab embedding
  // "{vendor} {product} {raw input}" gives the model more signal
  const queryText = [parsed.vendor, parsed.product, parsed.raw]
    .filter(Boolean)
    .join(" ")
    .trim();

  // Embed the query using the same model as Colab
  const vector = await embedQuery(queryText);
  const vectorLiteral = `[${vector.join(",")}]`;

  // ANN search — <=> is pgvector cosine distance operator
  // 1 - distance = similarity (vectors are unit-normalised)
  const { rows } = await vectorDb.query<VectorSearchResult>(
    `
    SELECT
      cpe_name   AS "cpeName",
      title,
      ROUND((1 - (embedding <=> $1::vector))::numeric, 4) AS similarity
    FROM cpe_vectors
    ORDER BY embedding <=> $1::vector
    LIMIT $2
    `,
    [vectorLiteral, limit]
  );

  return { queryText, results: rows };
}


// another implmentaion but without parsiing asset pass it to the model directly raw.
export async function semanticCpeSearchRaw(
  rawAssetName: string,
  limit: number = 30
): Promise<VectorSearchResponse> {
  const queryText = rawAssetName.trim();

  // Embed the query using the same model as Colab
  const vector = await embedQuery(queryText);
  const vectorLiteral = `[${vector.join(",")}]`;

  // ANN search — <=> is pgvector cosine distance operator
  // 1 - distance = similarity (vectors are unit-normalised)
  const { rows } = await vectorDb.query<VectorSearchResult>(
    `
    SELECT
      cpe_name   AS "cpeName",
      title,
      ROUND((1 - (embedding <=> $1::vector))::numeric, 4) AS similarity
    FROM cpe_vectors
    ORDER BY embedding <=> $1::vector
    LIMIT $2
    `,
    [vectorLiteral, limit]
  );

  return { queryText, results: rows }; 
}