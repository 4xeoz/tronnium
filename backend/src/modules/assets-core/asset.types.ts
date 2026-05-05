export interface CpeInput {
  cpeName: string;
  cpeNameId: string;
  title: string;
  score: number;
  vendor?: string;
  product?: string;
  version?: string;
  breakdown: {
    vendor: number;
    product: number;
    version: number;
    tokenOverlap: number;
  };
}
