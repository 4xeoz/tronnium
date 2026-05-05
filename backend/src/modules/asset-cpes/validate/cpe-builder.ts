export function buildCpe(options: {
  part: "a" | "o" | "h";
  vendor: string;
  product: string;
  version?: string;
  update?: string;
  edition?: string;
  language?: string;
  swEdition?: string;
  targetSw?: string;
  targetHw?: string;
  other?: string;
}): string {
  const field = (s: string | undefined) => s?.replace(/:/g, "\\:") || "*";

  return [
    "cpe",
    "2.3",
    options.part,
    field(options.vendor.toLowerCase()),
    field(options.product.toLowerCase()),
    field(options.version),
    field(options.update),
    field(options.edition),
    field(options.language),
    field(options.swEdition),
    field(options.targetSw),
    field(options.targetHw),
    field(options.other),
  ].join(":");
}
