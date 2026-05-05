import type { AssetCpe } from "@prisma/client";

export interface CpeCandidate {
  cpeName: string;
  cpeNameId: string;
  title: string;
  score: number;
  vendor: string;
  product: string;
  version: string;
  breakdown: {
    vendor: number;
    product: number;
    version: number;
    tokenOverlap: number;
  };
}

export function toCpeCandidate(cpe: AssetCpe): CpeCandidate {
  return {
    cpeName: cpe.cpeName,
    cpeNameId: cpe.cpeNameId ?? "",
    title: cpe.title,
    score: cpe.score,
    vendor: cpe.vendor ?? "",
    product: cpe.product ?? "",
    version: cpe.version ?? "",
    breakdown: {
      vendor: Math.round(cpe.vendorScore ?? 0),
      product: Math.round(cpe.productScore ?? 0),
      version: Math.round(cpe.versionScore ?? 0),
      tokenOverlap: Math.round(cpe.tokenOverlapScore ?? 0),
    },
  };
}
