// Test script for cpe-ranking.service.ts
// Run with: npx ts-node src/modules/asset-cpes/search/cpe-ranking.service.test.ts

import { rankCpeCandidates } from './cpe-ranking.service';
import type { ParsedAsset, CpeProduct } from '../cpe.types';

// Sample ParsedAsset (simulating what cpe.ts would produce)
const testAsset: ParsedAsset = {
    raw: "eWon eWon Firmware 10.0s0",
    normalized: "ewon ewon firmware 10.0s0",
    tokens: ["ewon", "firmware"],
    vendor: "ewon",
    product: "firmware",
    version: "10.0s0",
    versionCandidates: ["10.0s0", "10.0", "10"]
};

// Sample CpeProducts (simulating NVD API response)
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

console.log("=".repeat(60));
console.log("CPE RANKING ENGINE TEST");
console.log("=".repeat(60));

console.log("\n📋 Test Asset:");
console.log(`   Vendor:  ${testAsset.vendor}`);
console.log(`   Product: ${testAsset.product}`);
console.log(`   Version: ${testAsset.version}`);
console.log(`   Tokens:  [${testAsset.tokens.join(", ")}]`);

console.log("\n🔍 Testing rankCpeCandidates()...\n");

const results = rankCpeCandidates(testAsset, testCpeProducts, 5);

console.log(`Found ${results.length} ranked candidates:\n`);

results.forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.cpeName}`);
    console.log(`   Title: ${candidate.title || "N/A"}`);
    console.log(`   Score: ${candidate.score}%`);
    console.log(`   Breakdown:`);
    console.log(`     - Vendor:  ${(candidate.breakdown.vendorScore * 100).toFixed(1)}%`);
    console.log(`     - Product: ${(candidate.breakdown.productScore * 100).toFixed(1)}%`);
    console.log(`     - Version: ${(candidate.breakdown.versionScore * 100).toFixed(1)}%`);
    console.log(`     - Tokens:  ${(candidate.breakdown.tokenOverlapScore * 100).toFixed(1)}%`);
    console.log("");
});
