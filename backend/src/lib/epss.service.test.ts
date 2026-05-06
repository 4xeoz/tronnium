import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import axios from "axios";

jest.mock("axios");

import {
  fetchEpssForCves,
  getEpssPriority,
  type EpssResult,
} from "./epss.service";
import {
  epssAdjustedCvss,
  calculateEpssRiskScore,
} from "./severity";

// ─── getEpssPriority ─────────────────────────────────────────────────────────

describe("getEpssPriority", () => {
  it("IMMEDIATE when CVSS >= 7 and EPSS percentile >= 0.5", () => {
    expect(getEpssPriority(9.0, 0.8)).toBe("IMMEDIATE");
    expect(getEpssPriority(7.0, 0.5)).toBe("IMMEDIATE");
  });

  it("SCHEDULE when CVSS >= 7 and EPSS percentile < 0.5", () => {
    expect(getEpssPriority(8.0, 0.2)).toBe("SCHEDULE");
    expect(getEpssPriority(7.0, 0.0)).toBe("SCHEDULE");
  });

  it("MONITOR when CVSS < 7 and EPSS percentile >= 0.5", () => {
    expect(getEpssPriority(5.0, 0.9)).toBe("MONITOR");
    expect(getEpssPriority(0.0, 0.5)).toBe("MONITOR");
  });

  it("BACKLOG when CVSS < 7 and EPSS percentile < 0.5", () => {
    expect(getEpssPriority(4.0, 0.1)).toBe("BACKLOG");
    expect(getEpssPriority(0.0, 0.0)).toBe("BACKLOG");
  });

  it("treats null CVSS as 0", () => {
    expect(getEpssPriority(null, 0.8)).toBe("MONITOR");
    expect(getEpssPriority(null, 0.1)).toBe("BACKLOG");
  });

  it("treats null EPSS percentile as 0", () => {
    expect(getEpssPriority(9.0, null)).toBe("SCHEDULE");
    expect(getEpssPriority(4.0, null)).toBe("BACKLOG");
  });

  it("treats both null as BACKLOG", () => {
    expect(getEpssPriority(null, null)).toBe("BACKLOG");
  });
});

// ─── epssAdjustedCvss ────────────────────────────────────────────────────────

describe("epssAdjustedCvss", () => {
  it("scales CVSS by (1 + epssScore)", () => {
    expect(epssAdjustedCvss(8.0, 0.5)).toBeCloseTo(12.0);
    expect(epssAdjustedCvss(5.0, 0.0)).toBeCloseTo(5.0);
    expect(epssAdjustedCvss(10.0, 1.0)).toBeCloseTo(20.0);
  });

  it("falls back to CVSS 5.0 when cvssScore is null", () => {
    expect(epssAdjustedCvss(null, 0.0)).toBeCloseTo(5.0);
    expect(epssAdjustedCvss(null, 1.0)).toBeCloseTo(10.0);
  });

  it("treats null epssScore as 0 (no boost)", () => {
    expect(epssAdjustedCvss(7.0, null)).toBeCloseTo(7.0);
  });

  it("treats both null as 5.0", () => {
    expect(epssAdjustedCvss(null, null)).toBeCloseTo(5.0);
  });
});

// ─── calculateEpssRiskScore ──────────────────────────────────────────────────

describe("calculateEpssRiskScore", () => {
  it("returns 0 for an empty vulnerability list", () => {
    expect(calculateEpssRiskScore([], 5)).toBe(0);
  });

  it("caps the score at 100", () => {
    const vulns = Array(200).fill({ cvssScore: 10.0, epssScore: 1.0 });
    expect(calculateEpssRiskScore(vulns, 1)).toBe(100);
  });

  it("scales down with more total assets", () => {
    const vulns = [{ cvssScore: 8.0, epssScore: 0.5 }];
    const fewAssets  = calculateEpssRiskScore(vulns, 1);
    const manyAssets = calculateEpssRiskScore(vulns, 10);
    expect(fewAssets).toBeGreaterThan(manyAssets);
  });

  it("higher EPSS produces a higher risk score than lower EPSS at same CVSS", () => {
    const highEpss = [{ cvssScore: 7.0, epssScore: 0.9 }];
    const lowEpss  = [{ cvssScore: 7.0, epssScore: 0.1 }];
    expect(calculateEpssRiskScore(highEpss, 1)).toBeGreaterThan(
      calculateEpssRiskScore(lowEpss, 1)
    );
  });

  it("falls back gracefully when fields are null", () => {
    const vulns = [{ cvssScore: null, epssScore: null }];
    const score = calculateEpssRiskScore(vulns, 1);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ─── fetchEpssForCves ─────────────────────────────────────────────────────────

describe("fetchEpssForCves", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns parsed EPSS data for valid CVE IDs", async () => {
    jest.spyOn(axios, "get").mockResolvedValueOnce({
      data: {
        data: [
          { cve: "CVE-2023-0001", epss: "0.8500", percentile: "0.9500" },
          { cve: "CVE-2023-0002", epss: "0.1200", percentile: "0.4000" },
        ],
      },
    } as any);

    const results = await fetchEpssForCves(["CVE-2023-0001", "CVE-2023-0002"]);

    expect(results.size).toBe(2);

    const first = results.get("CVE-2023-0001") as EpssResult;
    expect(first.cveId).toBe("CVE-2023-0001");
    expect(first.epssScore).toBeCloseTo(0.85);
    expect(first.percentile).toBeCloseTo(0.95);

    const second = results.get("CVE-2023-0002") as EpssResult;
    expect(second.epssScore).toBeCloseTo(0.12);
    expect(second.percentile).toBeCloseTo(0.4);
  });

  it("returns an empty map when given no CVE IDs", async () => {
    const getSpy = jest.spyOn(axios, "get");
    const results = await fetchEpssForCves([]);
    expect(results.size).toBe(0);
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("does not throw when the EPSS API fails — returns partial results", async () => {
    jest.spyOn(axios, "get").mockRejectedValueOnce(new Error("Network error"));

    const results = await fetchEpssForCves(["CVE-2023-9999"]);
    // EPSS is optional enrichment — a failed fetch yields an empty map, not an exception
    expect(results.size).toBe(0);
  });

  it("handles missing CVEs in the response gracefully", async () => {
    // API returns data for only one of the two requested CVEs
    jest.spyOn(axios, "get").mockResolvedValueOnce({
      data: {
        data: [{ cve: "CVE-2023-0001", epss: "0.5", percentile: "0.7" }],
      },
    } as any);

    const results = await fetchEpssForCves(["CVE-2023-0001", "CVE-2023-XXXX"]);
    expect(results.has("CVE-2023-0001")).toBe(true);
    expect(results.has("CVE-2023-XXXX")).toBe(false);
  });
});
