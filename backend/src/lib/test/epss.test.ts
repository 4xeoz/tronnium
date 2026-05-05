import axios from "axios";
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Re-import after mock so the module uses the mocked axios.
// We use jest.isolateModules per test group that needs a fresh cache.
import {
  getEpssPriority,
  fetchEpssForCves,
} from "../epss.service";
import {
  epssAdjustedCvss,
  calculateEpssRiskScore,
} from "../severity";

// ---------------------------------------------------------------------------
// getEpssPriority — pure function, no I/O
// ---------------------------------------------------------------------------
describe("getEpssPriority", () => {
  it("IMMEDIATE when cvss >= 7 and epssPercentile >= 0.5", () => {
    expect(getEpssPriority(9.0, 0.75)).toBe("IMMEDIATE");
    expect(getEpssPriority(7.0, 0.5)).toBe("IMMEDIATE");
  });

  it("SCHEDULE when cvss >= 7 and epssPercentile < 0.5", () => {
    expect(getEpssPriority(8.5, 0.3)).toBe("SCHEDULE");
    expect(getEpssPriority(7.0, 0.49)).toBe("SCHEDULE");
  });

  it("MONITOR when cvss < 7 and epssPercentile >= 0.5", () => {
    expect(getEpssPriority(5.0, 0.8)).toBe("MONITOR");
    expect(getEpssPriority(6.9, 0.5)).toBe("MONITOR");
  });

  it("BACKLOG when cvss < 7 and epssPercentile < 0.5", () => {
    expect(getEpssPriority(4.0, 0.1)).toBe("BACKLOG");
    expect(getEpssPriority(6.9, 0.49)).toBe("BACKLOG");
  });

  it("treats null cvss as 0 → only high EPSS can reach MONITOR", () => {
    expect(getEpssPriority(null, 0.9)).toBe("MONITOR");
    expect(getEpssPriority(null, 0.1)).toBe("BACKLOG");
  });

  it("treats null percentile as 0 → high CVSS lands in SCHEDULE", () => {
    expect(getEpssPriority(9.0, null)).toBe("SCHEDULE");
    expect(getEpssPriority(5.0, null)).toBe("BACKLOG");
  });

  it("both null → BACKLOG", () => {
    expect(getEpssPriority(null, null)).toBe("BACKLOG");
  });
});

// ---------------------------------------------------------------------------
// epssAdjustedCvss — pure function
// ---------------------------------------------------------------------------
describe("epssAdjustedCvss", () => {
  it("multiplies cvss by (1 + epss)", () => {
    expect(epssAdjustedCvss(8.0, 0.5)).toBeCloseTo(12.0);
  });

  it("no EPSS score → no adjustment (factor of 1)", () => {
    expect(epssAdjustedCvss(8.0, 0)).toBe(8.0);
  });

  it("null cvss falls back to 5.0", () => {
    expect(epssAdjustedCvss(null, 0.0)).toBe(5.0);
    expect(epssAdjustedCvss(null, 1.0)).toBe(10.0);
  });

  it("null epss treats score as 0", () => {
    expect(epssAdjustedCvss(7.0, null)).toBe(7.0);
  });

  it("both null → 5.0 * 1 = 5.0", () => {
    expect(epssAdjustedCvss(null, null)).toBe(5.0);
  });
});

// ---------------------------------------------------------------------------
// calculateEpssRiskScore — pure function
// ---------------------------------------------------------------------------
describe("calculateEpssRiskScore", () => {
  it("returns 0 for empty vulnerability list", () => {
    expect(calculateEpssRiskScore([], 5)).toBe(0);
  });

  it("sums adjusted CVSS and divides by asset count", () => {
    // epssAdjustedCvss(10, 0) = 10  → total = 10, assets = 2 → 5
    const vulns = [{ cvssScore: 10, epssScore: 0 }];
    expect(calculateEpssRiskScore(vulns, 2)).toBe(5);
  });

  it("caps at 100", () => {
    // 10 * (1 + 1.0) = 20 per vuln × 10 vulns = 200, / 1 asset → capped at 100
    const vulns = Array.from({ length: 10 }, () => ({ cvssScore: 10, epssScore: 1.0 }));
    expect(calculateEpssRiskScore(vulns, 1)).toBe(100);
  });

  it("handles totalAssets = 0 (no division by zero)", () => {
    const vulns = [{ cvssScore: 5, epssScore: 0.2 }];
    expect(() => calculateEpssRiskScore(vulns, 0)).not.toThrow();
    expect(calculateEpssRiskScore(vulns, 0)).toBeLessThanOrEqual(100);
  });

  it("aggregates mixed null and real scores correctly", () => {
    // epssAdjustedCvss(null, null) = 5.0 * 1 = 5
    // epssAdjustedCvss(10, 0) = 10
    // total = 15, assets = 1 → 15
    const vulns = [
      { cvssScore: null, epssScore: null },
      { cvssScore: 10, epssScore: 0 },
    ];
    expect(calculateEpssRiskScore(vulns, 1)).toBeCloseTo(15);
  });
});

// ---------------------------------------------------------------------------
// fetchEpssForCves — I/O, uses module-level cache
// ---------------------------------------------------------------------------
describe("fetchEpssForCves", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  it("returns an empty map when called with no CVEs", async () => {
    const result = await fetchEpssForCves([]);
    expect(result.size).toBe(0);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("maps API response to EpssResult objects", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        data: [
          { cve: "CVE-2024-0001", epss: "0.12345", percentile: "0.87654" },
          { cve: "CVE-2024-0002", epss: "0.00123", percentile: "0.23456" },
        ],
      },
    });

    const result = await fetchEpssForCves(["CVE-2024-0001", "CVE-2024-0002"]);

    expect(result.size).toBe(2);
    expect(result.get("CVE-2024-0001")).toMatchObject({
      cveId: "CVE-2024-0001",
      epssScore: expect.closeTo(0.12345, 4),
      percentile: expect.closeTo(0.87654, 4),
    });
    expect(result.get("CVE-2024-0002")).toMatchObject({
      cveId: "CVE-2024-0002",
      epssScore: expect.closeTo(0.00123, 4),
      percentile: expect.closeTo(0.23456, 4),
    });
  });

  it("does not re-fetch CVEs that are already in cache", async () => {
    // First call populates cache for CVE-2024-0003
    mockedAxios.get.mockResolvedValueOnce({
      data: { data: [{ cve: "CVE-2024-0003", epss: "0.5", percentile: "0.9" }] },
    });
    await fetchEpssForCves(["CVE-2024-0003"]);

    mockedAxios.get.mockReset();

    // Second call for the same CVE should hit cache, not the API
    const result = await fetchEpssForCves(["CVE-2024-0003"]);
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(result.get("CVE-2024-0003")?.epssScore).toBeCloseTo(0.5);
  });

  it("sends multiple API requests when CVE list exceeds batch size (30)", async () => {
    const cveIds = Array.from({ length: 35 }, (_, i) => `CVE-2099-${String(i).padStart(4, "0")}`);

    mockedAxios.get
      .mockResolvedValueOnce({ data: { data: [] } }) // batch 1 (30 CVEs)
      .mockResolvedValueOnce({ data: { data: [] } }); // batch 2 (5 CVEs)

    await fetchEpssForCves(cveIds);

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);

    const firstCallParams = mockedAxios.get.mock.calls[0][1]?.params as { cve: string } | undefined;
    expect(firstCallParams?.cve.split(",")).toHaveLength(30);

    const secondCallParams = mockedAxios.get.mock.calls[1][1]?.params as { cve: string } | undefined;
    expect(secondCallParams?.cve.split(",")).toHaveLength(5);
  });

  it("does not throw on network error — returns partial results", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("Network timeout"));

    // Should not throw
    const result = await fetchEpssForCves(["CVE-2025-9999"]);

    // No results since the fetch failed, but no exception
    expect(result).toBeInstanceOf(Map);
  });

  it("parses malformed epss/percentile strings as 0", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        data: [{ cve: "CVE-2024-BADNUM", epss: "not-a-number", percentile: "" }],
      },
    });

    const result = await fetchEpssForCves(["CVE-2024-BADNUM"]);
    expect(result.get("CVE-2024-BADNUM")).toMatchObject({
      epssScore: 0,
      percentile: 0,
    });
  });

  it("handles an empty data array in the API response", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } });

    const result = await fetchEpssForCves(["CVE-2024-UNKNOWN"]);
    expect(result.size).toBe(0);
  });

  it("handles missing data field in API response gracefully", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: {} });

    await expect(fetchEpssForCves(["CVE-2024-NODATA"])).resolves.toBeInstanceOf(Map);
  });
});
