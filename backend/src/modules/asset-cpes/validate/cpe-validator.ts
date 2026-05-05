import type { ParsedCpe, CpeProduct, CpeValidationResult } from "../cpe.types";
import { queryNvdApi } from "../nvd-client";

// CPE 2.3 has exactly 13 colon-separated components:
// cpe : 2.3 : part : vendor : product : version : update : edition : language : sw_edition : target_sw : target_hw : other
const CPE_COMPONENT_COUNT = 13;

// Use a higher page size so the exact CPE is likely in the returned set.
// NVD cpeMatchString does prefix matching, so a precise string may return many
// similar CPEs before the exact one.
const VALIDATION_RESULTS_PER_PAGE = 100;

function buildResult(
  isValid: boolean,
  existsInNvd: boolean,
  exactMatch: boolean,
  deprecated: boolean,
  parsed: ParsedCpe,
  matches: CpeProduct[],
  message: string
): CpeValidationResult {
  return { isValid, existsInNvd, exactMatch, deprecated, parsed, matches, message };
}

export function parseCpe(cpeString: string): ParsedCpe {
  const base: ParsedCpe = {
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
    return { ...base, error: "CPE string is empty or invalid" };
  }

  const trimmed = cpeString.trim().toLowerCase();

  if (!trimmed.startsWith("cpe:2.3:")) {
    const error = trimmed.startsWith("cpe:/")
      ? "CPE 2.2 format detected. Please use CPE 2.3 format (cpe:2.3:)"
      : 'Invalid CPE format. Must start with "cpe:2.3:"';
    return { ...base, error };
  }

  const parts = trimmed.split(":");

  if (parts.length !== CPE_COMPONENT_COUNT) {
    return {
      ...base,
      error: `Invalid CPE format: expected ${CPE_COMPONENT_COUNT} components, got ${parts.length}`,
    };
  }

  const partValue = parts[2];
  if (!["a", "o", "h"].includes(partValue)) {
    return {
      ...base,
      error: `Invalid CPE part: "${partValue}". Must be 'a' (application), 'o' (OS), or 'h' (hardware)`,
    };
  }

  const field = (i: number) => (parts[i] && parts[i] !== "*" ? parts[i] : null);

  const vendor = field(3);
  if (!vendor) {
    return { ...base, error: "CPE must have a vendor specified" };
  }

  return {
    ...base,
    valid: true,
    part: partValue,
    vendor,
    product: field(4),
    version: field(5),
    update: field(6),
    edition: field(7),
    language: field(8),
    swEdition: field(9),
    targetSw: field(10),
    targetHw: field(11),
    other: field(12),
  };
}

export async function validateCpe(cpeString: string): Promise<CpeValidationResult> {
  const parsed = parseCpe(cpeString);

  if (!parsed.valid) {
    return buildResult(false, false, false, false, parsed, [], `Invalid CPE format: ${parsed.error}`);
  }

  try {
    const nvdData = await queryNvdApi(
      cpeString.toLowerCase(),
      "",
      undefined,
      VALIDATION_RESULTS_PER_PAGE
    );
    
    const products: CpeProduct[] = nvdData.products || [];
    const totalResults = nvdData.totalResults || 0;

    if (totalResults === 0) {
      return buildResult(
        true, false, false, false, parsed, [],
        "CPE format is valid but no matching entries found in NVD database"
      );
    }

    const normalizedInput = cpeString.toLowerCase().trim();
    const exactProduct = products.find(
      (p) => p.cpe?.cpeName?.toLowerCase() === normalizedInput
    );

    if (exactProduct) {
      const deprecated = exactProduct.cpe?.deprecated === true;
      return buildResult(
        true, true, true, deprecated, parsed, products,
        deprecated ? "CPE exists in NVD but is DEPRECATED" : "CPE is valid and exists in NVD database"
      );
    }

    return buildResult(
      true, true, false, false, parsed, products,
      `CPE format valid. No exact match, but ${totalResults} similar CPEs found`
    );
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;

    if (status === 404) {
      return buildResult(
        true, false, false, false, parsed, [],
        "CPE format is valid but no matching entries were found in NVD database"
      );
    }

    console.error("[CPE Validation] NVD API error:", error);
    return buildResult(
      true, false, false, false, parsed, [],
      `CPE format valid but NVD lookup failed: ${String(error)}`
    );
  }
}

export async function cpeExists(cpeString: string): Promise<boolean> {
  const result = await validateCpe(cpeString);
  return result.existsInNvd;
}
