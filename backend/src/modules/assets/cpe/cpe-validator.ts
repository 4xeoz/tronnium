import type {
  ParsedCpe,
  CpeProduct,
  CpeValidationResult,
} from "../../../types/cpe.types";
import { queryNvdApi } from "./nvd-client";

export function parseCpe(cpeString: string): ParsedCpe {
  const result: ParsedCpe = {
    valid: false,
    raw: cpeString,
    part: null,
    vendor: null,
    product: null,
    version: null,
    update: null,
    edition: null,
    language: null,
    swEdition: null,
    targetSw: null,
    targetHw: null,
    other: null,
  };

  if (!cpeString || typeof cpeString !== "string") {
    result.error = "CPE string is empty or invalid";
    return result;
  }

  const trimmed = cpeString.trim().toLowerCase();

  if (!trimmed.startsWith("cpe:2.3:")) {
    if (trimmed.startsWith("cpe:/")) {
      result.error = "CPE 2.2 format detected. Please use CPE 2.3 format (cpe:2.3:)";
      return result;
    }
    result.error = 'Invalid CPE format. Must start with "cpe:2.3:"';
    return result;
  }

  const parts = trimmed.split(":");

  if (parts.length < 5) {
    result.error = `Invalid CPE format: expected at least 5 components, got ${parts.length}`;
    return result;
  }

  const partValue = parts[2];
  if (!["a", "o", "h"].includes(partValue)) {
    result.error = `Invalid CPE part: "${partValue}". Must be 'a' (application), 'o' (OS), or 'h' (hardware)`;
    return result;
  }

  result.part = partValue;
  result.vendor = parts[3] && parts[3] !== "*" ? parts[3] : null;
  result.product = parts[4] && parts[4] !== "*" ? parts[4] : null;
  result.version = parts[5] && parts[5] !== "*" ? parts[5] : null;
  result.update = parts[6] && parts[6] !== "*" ? parts[6] : null;
  result.edition = parts[7] && parts[7] !== "*" ? parts[7] : null;
  result.language = parts[8] && parts[8] !== "*" ? parts[8] : null;
  result.swEdition = parts[9] && parts[9] !== "*" ? parts[9] : null;
  result.targetSw = parts[10] && parts[10] !== "*" ? parts[10] : null;
  result.targetHw = parts[11] && parts[11] !== "*" ? parts[11] : null;
  result.other = parts[12] && parts[12] !== "*" ? parts[12] : null;

  if (!result.vendor) {
    result.error = "CPE must have a vendor specified";
    return result;
  }

  result.valid = true;
  return result;
}

export async function validateCpe(cpeString: string): Promise<CpeValidationResult> {
  console.log(`[CPE Validation] Validating: "${cpeString}"`);

  const parsed = parseCpe(cpeString);

  if (!parsed.valid) {
    return {
      isValid: false,
      existsInNvd: false,
      exactMatch: false,
      parsed,
      matches: [],
      deprecated: false,
      message: `Invalid CPE format: ${parsed.error}`,
    };
  }

  console.log(
    `[CPE Validation] Format valid. Vendor: ${parsed.vendor}, Product: ${parsed.product}, Version: ${parsed.version}`
  );

  try {
    const nvdData = await queryNvdApi(cpeString.toLowerCase(), "");
    const products: CpeProduct[] = nvdData.products || [];
    const totalResults = nvdData.totalResults || 0;

    console.log(`[CPE Validation] NVD returned ${totalResults} results`);

    if (totalResults === 0) {
      return {
        isValid: true,
        existsInNvd: false,
        exactMatch: false,
        parsed,
        matches: [],
        deprecated: false,
        message: "CPE format is valid but no matching entries found in NVD database",
      };
    }

    const normalizedInput = cpeString.toLowerCase().trim();
    const exactMatch = products.find(
      (p) => p.cpe?.cpeName?.toLowerCase() === normalizedInput
    );

    const isDeprecated = exactMatch?.cpe?.deprecated === true;

    if (exactMatch) {
      return {
        isValid: true,
        existsInNvd: true,
        exactMatch: true,
        parsed,
        matches: products,
        deprecated: isDeprecated,
        message: isDeprecated
          ? "CPE exists in NVD but is DEPRECATED"
          : "CPE is valid and exists in NVD database",
      };
    }

    return {
      isValid: true,
      existsInNvd: true,
      exactMatch: false,
      parsed,
      matches: products,
      deprecated: false,
      message: `CPE format valid. No exact match, but ${totalResults} similar CPEs found`,
    };
  } catch (error) {
    console.error(`[CPE Validation] NVD API error:`, error);
    return {
      isValid: true,
      existsInNvd: false,
      exactMatch: false,
      parsed,
      matches: [],
      deprecated: false,
      message: `CPE format valid but NVD lookup failed: ${String(error)}`,
    };
  }
}

export async function cpeExists(cpeString: string): Promise<boolean> {
  const result = await validateCpe(cpeString);
  return result.existsInNvd;
}

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
  const escape = (s: string | undefined) => s?.replace(/:/g, "\\:") || "*";

  return [
    "cpe",
    "2.3",
    options.part,
    escape(options.vendor.toLowerCase()),
    escape(options.product.toLowerCase()),
    escape(options.version),
    escape(options.update),
    escape(options.edition),
    escape(options.language),
    escape(options.swEdition),
    escape(options.targetSw),
    escape(options.targetHw),
    escape(options.other),
  ].join(":");
}
