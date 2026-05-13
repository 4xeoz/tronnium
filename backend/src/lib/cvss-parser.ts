/**
 * Pure function that parses a CVSS 3.x vector string into structured metric fields.
 *
 * Supports both prefixed (CVSS:3.1/AV:N/...) and bare (AV:N/...) formats.
 * Returns null for missing, empty, or clearly malformed vectors.
 *
 * Example:
 *   parseCvssVector("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H")
 *   // → { attackVector: "N", userInteraction: "N", scope: "U", confidentiality: "H", integrity: "H", availability: "H" }
 */

export type CvssVectorParseResult = {
  attackVector: "N" | "A" | "L" | "P" | null;
  userInteraction: "N" | "R" | null;
  scope: "U" | "C" | null;
  confidentiality: "N" | "L" | "H" | null;
  integrity: "N" | "L" | "H" | null;
  availability: "N" | "L" | "H" | null;
};

export function parseCvssVector(
  vector: string | null | undefined
): CvssVectorParseResult | null {
  if (!vector || typeof vector !== "string" || vector.trim().length === 0) {
    return null;
  }

  const cleaned = vector.trim();

  // Strip CVSS:3.0/ or CVSS:3.1/ prefix if present
  const withoutPrefix = cleaned.replace(/^CVSS:3\.\d\//, "");

  // Sanity check: a CVSS vector must contain colon-delimited metric segments
  if (!withoutPrefix.includes(":")) {
    return null;
  }

  // Parse each segment into a key -> value map
  const metrics: Record<string, string> = {};
  for (const segment of withoutPrefix.split("/")) {
    const [key, value] = segment.split(":");
    if (key && value && value.length === 1) {
      metrics[key] = value;
    }
  }

  // If nothing parseable was found, treat as malformed
  if (Object.keys(metrics).length === 0) {
    return null;
  }

  // Extract and validate each requested metric
  const av = metrics["AV"];
  const attackVector =
    av === "N" || av === "A" || av === "L" || av === "P" ? av : null;

  const ui = metrics["UI"];
  const userInteraction = ui === "N" || ui === "R" ? ui : null;

  const s = metrics["S"];
  const scope = s === "U" || s === "C" ? s : null;

  const c = metrics["C"];
  const confidentiality = c === "N" || c === "L" || c === "H" ? c : null;

  const i = metrics["I"];
  const integrity = i === "N" || i === "L" || i === "H" ? i : null;

  const a = metrics["A"];
  const availability = a === "N" || a === "L" || a === "H" ? a : null;

  return {
    attackVector,
    userInteraction,
    scope,
    confidentiality,
    integrity,
    availability,
  };
}


export type VulnClassification = {
  enablesNetworkPivot: boolean;
  enablesCredentialTheft: boolean;
  enablesInjection: boolean;
  isPhysicalOnly: boolean;
  requiresUserInteraction: boolean;
  isHighConfidence: boolean;
  isDoSOnly: boolean;
};

/**
 * Classify a vulnerability from its parsed CVSS vector + EPSS + CVSS score.
 *
 * @param parsed          Output of parseCvssVector()
 * @param epssPercentile  EPSS percentile (0–1 scale), or null/undefined if absent
 * @param cvssScore       Base CVSS score (0–10), or null/undefined if absent
 */
export function classifyVuln(
  parsed: CvssVectorParseResult | null,
  epssPercentile: number | null | undefined,
  cvssScore: number | null | undefined
): VulnClassification | null {
  if (!parsed) {
    return null;
  }

  const { attackVector, userInteraction, scope, confidentiality, integrity, availability } = parsed;

  // --- Traversal / pivot flags ------------------------------------------------

  const enablesNetworkPivot =
    (attackVector === "N" || attackVector === "A") &&
    (integrity === "H" || scope === "C");

  const enablesCredentialTheft = confidentiality === "H";

  const enablesInjection = integrity === "H";

  const isPhysicalOnly = attackVector === "P";

  const requiresUserInteraction = userInteraction === "R";

  // --- Confidence flag --------------------------------------------------------

  const hasHighEpss =
    typeof epssPercentile === "number" && epssPercentile >= 0.5;
  const hasHighCvss =
    typeof cvssScore === "number" && cvssScore >= 7.0;

  const isHighConfidence = hasHighEpss && hasHighCvss;

  // --- DoS-only flag (no pivot / no data-theft value) -------------------------

  const isDoSOnly =
    availability === "H" && confidentiality === "N" && integrity === "N";

  return {
    enablesNetworkPivot,
    enablesCredentialTheft,
    enablesInjection,
    isPhysicalOnly,
    requiresUserInteraction,
    isHighConfidence,
    isDoSOnly,
  };
}