import { describe, it, expect } from "@jest/globals";
import { classifyVuln, CvssVectorParseResult, parseCvssVector } from "../cvss-parser";

describe("parseCvssVector", () => {
  // -------------------------------------------------------------------------
  // Real NVD vectors
  // -------------------------------------------------------------------------

  it("parses a Network / RCE vector (Log4Shell-style)", () => {
    const result = parseCvssVector(
      "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
    );
    expect(result).toEqual({
      attackVector: "N",
      userInteraction: "N",
      scope: "U",
      confidentiality: "H",
      integrity: "H",
      availability: "H",
    });
  });

  it("parses a Physical-only vector", () => {
    const result = parseCvssVector(
      "CVSS:3.1/AV:P/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N"
    );
    expect(result).toEqual({
      attackVector: "P",
      userInteraction: "N",
      scope: "U",
      confidentiality: "L",
      integrity: "N",
      availability: "N",
    });
  });

  it("parses a DoS-only vector (availability impact only)", () => {
    const result = parseCvssVector(
      "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
    );
    expect(result).toEqual({
      attackVector: "N",
      userInteraction: "N",
      scope: "U",
      confidentiality: "N",
      integrity: "N",
      availability: "H",
    });
  });

  it("parses a bare vector without CVSS:3.1 prefix", () => {
    const result = parseCvssVector("AV:A/AC:H/PR:L/UI:R/S:C/C:L/I:L/A:N");
    expect(result).toEqual({
      attackVector: "A",
      userInteraction: "R",
      scope: "C",
      confidentiality: "L",
      integrity: "L",
      availability: "N",
    });
  });

  // -------------------------------------------------------------------------
  // Null / missing vectors
  // -------------------------------------------------------------------------

  it("returns null for null input", () => {
    expect(parseCvssVector(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseCvssVector(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseCvssVector("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(parseCvssVector("   ")).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Malformed vectors
  // -------------------------------------------------------------------------

  it("returns null for completely malformed string", () => {
    expect(parseCvssVector("not-a-vector")).toBeNull();
  });

  it("returns null for random sentence", () => {
    expect(parseCvssVector("high severity remote code execution")).toBeNull();
  });

  it("returns null for string with colons but no valid metrics", () => {
    expect(parseCvssVector("foo:bar/baz:qux")).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Partial / edge-case vectors
  // -------------------------------------------------------------------------

  it("returns null fields for missing metrics in an otherwise valid vector", () => {
    const result = parseCvssVector("AV:N");
    expect(result).toEqual({
      attackVector: "N",
      userInteraction: null,
      scope: null,
      confidentiality: null,
      integrity: null,
      availability: null,
    });
  });

  it("ignores invalid metric values (falls back to null)", () => {
    const result = parseCvssVector("AV:X/UI:Z/S:9/C:Q/I:9/A:Z");
    expect(result).toEqual({
      attackVector: null,
      userInteraction: null,
      scope: null,
      confidentiality: null,
      integrity: null,
      availability: null,
    });
  });


  
});



describe("classifyVuln", () => {
  // -------------------------------------------------------------------------
  // Helpers to keep tests readable
  // -------------------------------------------------------------------------

  const makeParsed = (overrides: Partial<CvssVectorParseResult>) => ({
    attackVector: null,
    userInteraction: null,
    scope: null,
    confidentiality: null,
    integrity: null,
    availability: null,
    ...overrides,
  });

  // -------------------------------------------------------------------------
  // Null input
  // -------------------------------------------------------------------------

  it("returns null when parsed vector is null", () => {
    expect(classifyVuln(null, 0.8, 9.8)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // enablesNetworkPivot
  // -------------------------------------------------------------------------

  it("enablesNetworkPivot = true for AV:N + I:H", () => {
    const c = classifyVuln(makeParsed({ attackVector: "N", integrity: "H" }), 0, 0);
    expect(c?.enablesNetworkPivot).toBe(true);
  });

  it("enablesNetworkPivot = true for AV:A + S:C", () => {
    const c = classifyVuln(makeParsed({ attackVector: "A", scope: "C" }), 0, 0);
    expect(c?.enablesNetworkPivot).toBe(true);
  });

  it("enablesNetworkPivot = false for AV:P + I:H", () => {
    const c = classifyVuln(makeParsed({ attackVector: "P", integrity: "H" }), 0, 0);
    expect(c?.enablesNetworkPivot).toBe(false);
  });

  it("enablesNetworkPivot = false for AV:N + I:L", () => {
    const c = classifyVuln(makeParsed({ attackVector: "N", integrity: "L" }), 0, 0);
    expect(c?.enablesNetworkPivot).toBe(false);
  });

  // -------------------------------------------------------------------------
  // enablesCredentialTheft
  // -------------------------------------------------------------------------

  it("enablesCredentialTheft = true when C:H", () => {
    const c = classifyVuln(makeParsed({ confidentiality: "H" }), 0, 0);
    expect(c?.enablesCredentialTheft).toBe(true);
  });

  it("enablesCredentialTheft = false when C:L", () => {
    const c = classifyVuln(makeParsed({ confidentiality: "L" }), 0, 0);
    expect(c?.enablesCredentialTheft).toBe(false);
  });

  it("enablesCredentialTheft = false when C:N", () => {
    const c = classifyVuln(makeParsed({ confidentiality: "N" }), 0, 0);
    expect(c?.enablesCredentialTheft).toBe(false);
  });

  // -------------------------------------------------------------------------
  // enablesInjection
  // -------------------------------------------------------------------------

  it("enablesInjection = true when I:H", () => {
    const c = classifyVuln(makeParsed({ integrity: "H" }), 0, 0);
    expect(c?.enablesInjection).toBe(true);
  });

  it("enablesInjection = false when I:L", () => {
    const c = classifyVuln(makeParsed({ integrity: "L" }), 0, 0);
    expect(c?.enablesInjection).toBe(false);
  });

  // -------------------------------------------------------------------------
  // isPhysicalOnly
  // -------------------------------------------------------------------------

  it("isPhysicalOnly = true for AV:P (even CVSS 9.8)", () => {
    const c = classifyVuln(
      makeParsed({ attackVector: "P" }),
      0.9,
      9.8
    );
    expect(c?.isPhysicalOnly).toBe(true);
    expect(c?.enablesNetworkPivot).toBe(false);
  });

  it("isPhysicalOnly = false for AV:N", () => {
    const c = classifyVuln(makeParsed({ attackVector: "N" }), 0, 0);
    expect(c?.isPhysicalOnly).toBe(false);
  });

  it("isPhysicalOnly = false when attackVector is null", () => {
    const c = classifyVuln(makeParsed({}), 0, 0);
    expect(c?.isPhysicalOnly).toBe(false);
  });

  // -------------------------------------------------------------------------
  // requiresUserInteraction
  // -------------------------------------------------------------------------

  it("requiresUserInteraction = true when UI:R", () => {
    const c = classifyVuln(makeParsed({ userInteraction: "R" }), 0, 0);
    expect(c?.requiresUserInteraction).toBe(true);
  });

  it("requiresUserInteraction = false when UI:N", () => {
    const c = classifyVuln(makeParsed({ userInteraction: "N" }), 0, 0);
    expect(c?.requiresUserInteraction).toBe(false);
  });

  // -------------------------------------------------------------------------
  // isHighConfidence
  // -------------------------------------------------------------------------

  it("isHighConfidence = true when EPSS ≥ 0.5 AND CVSS ≥ 7.0", () => {
    const c = classifyVuln(makeParsed({}), 0.75, 8.5);
    expect(c?.isHighConfidence).toBe(true);
  });

  it("isHighConfidence = false when EPSS < 0.5", () => {
    const c = classifyVuln(makeParsed({}), 0.3, 8.5);
    expect(c?.isHighConfidence).toBe(false);
  });

  it("isHighConfidence = false when CVSS < 7.0", () => {
    const c = classifyVuln(makeParsed({}), 0.9, 6.9);
    expect(c?.isHighConfidence).toBe(false);
  });

  it("isHighConfidence = false when EPSS is null", () => {
    const c = classifyVuln(makeParsed({}), null, 9.0);
    expect(c?.isHighConfidence).toBe(false);
  });

  it("isHighConfidence = false when CVSS is null", () => {
    const c = classifyVuln(makeParsed({}), 0.9, null);
    expect(c?.isHighConfidence).toBe(false);
  });

  // -------------------------------------------------------------------------
  // isDoSOnly
  // -------------------------------------------------------------------------

  it("isDoSOnly = true for A:H, C:N, I:N", () => {
    const c = classifyVuln(
      makeParsed({ availability: "H", confidentiality: "N", integrity: "N" }),
      0,
      0
    );
    expect(c?.isDoSOnly).toBe(true);
    expect(c?.enablesNetworkPivot).toBe(false);
    expect(c?.enablesCredentialTheft).toBe(false);
    expect(c?.enablesInjection).toBe(false);
  });

  it("isDoSOnly = false for A:H, C:H, I:N", () => {
    const c = classifyVuln(
      makeParsed({ availability: "H", confidentiality: "H", integrity: "N" }),
      0,
      0
    );
    expect(c?.isDoSOnly).toBe(false);
  });

  it("isDoSOnly = false when availability is null", () => {
    const c = classifyVuln(
      makeParsed({ confidentiality: "N", integrity: "N" }),
      0,
      0
    );
    expect(c?.isDoSOnly).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Combined scenarios from the spec
  // -------------------------------------------------------------------------

  it("C:H, I:N, A:N → credential theft true, not DoS, not pivot", () => {
    const c = classifyVuln(
      makeParsed({ confidentiality: "H", integrity: "N", availability: "N" }),
      0,
      0
    );
    expect(c?.enablesCredentialTheft).toBe(true);
    expect(c?.isDoSOnly).toBe(false);
    expect(c?.enablesNetworkPivot).toBe(false);
  });

  it("A:H, C:N, I:N → DoS-only true, all pivot flags false", () => {
    const c = classifyVuln(
      makeParsed({ availability: "H", confidentiality: "N", integrity: "N" }),
      0,
      0
    );
    expect(c?.isDoSOnly).toBe(true);
    expect(c?.enablesNetworkPivot).toBe(false);
    expect(c?.enablesCredentialTheft).toBe(false);
    expect(c?.enablesInjection).toBe(false);
  });
});



