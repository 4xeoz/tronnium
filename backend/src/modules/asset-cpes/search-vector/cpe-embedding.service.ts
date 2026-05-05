import { pipeline } from "@xenova/transformers";

let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    console.log("[Embedding] Loading model (first time only)...");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("[Embedding] Model ready.");
  }
  return embedder;
}

export async function embedQuery(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}