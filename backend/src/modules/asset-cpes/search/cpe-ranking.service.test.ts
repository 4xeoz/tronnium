import { describe, it, expect } from "@jest/globals";
import { rankCpeCandidates } from './cpe-ranking.service';
import type { ParsedAsset, CpeProduct } from '../cpe.types';

const testAsset: ParsedAsset = {
    raw: "eWon eWon Firmware 10.0s0",
    normalized: "ewon ewon firmware 10.0s0",
    tokens: ["ewon", "firmware"],
    vendor: "ewon",
    product: "firmware",
    version: "10.0s0",
    versionCandidates: ["10.0s0", "10.0", "10"]
};

const testCpeProducts: CpeProduct[] = [
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:o:ewon:ewon_firmware:10.0s0:*:*:*:*:*:*:*",
            cpeNameId: "abc123",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "eWon Firmware 10.0s0", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:o:ewon:ewon_firmware:10.0:*:*:*:*:*:*:*",
            cpeNameId: "abc124",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "eWon Firmware 10.0", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:o:ewon:ewon_firmware:9.5:*:*:*:*:*:*:*",
            cpeNameId: "abc125",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "eWon Firmware 9.5", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:a:apache:http_server:2.4.51:*:*:*:*:*:*:*",
            cpeNameId: "def456",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Apache HTTP Server 2.4.51", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:h:ewon:cosy_131:*:*:*:*:*:*:*:*",
            cpeNameId: "ghi789",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "eWon Cosy 131", lang: "en" }],
            refs: null
        }
    }
];

describe("CPE Ranking Engine", () => {
    it("ranks exact vendor/product/version matches highest", () => {
        const results = rankCpeCandidates(testAsset, testCpeProducts, 5);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].cpeName).toBe("cpe:2.3:o:ewon:ewon_firmware:10.0s0:*:*:*:*:*:*:*");
        expect(results[0].score).toBeGreaterThan(0);
    });

    it("returns results sorted by descending score", () => {
        const results = rankCpeCandidates(testAsset, testCpeProducts, 5);

        for (let i = 1; i < results.length; i++) {
            expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
    });
});
