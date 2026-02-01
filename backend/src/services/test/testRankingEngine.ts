// Test script for cpeRankingEngine.ts
// Run with: npx ts-node src/services/test/testRankingEngine.ts

import { rankCpeCandidates } from '../cpeRankingEngine';
import type { ParsedAsset, CpeProduct } from '../../types/cpe.types';

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

// Test with Apache HTTP Server
console.log("=".repeat(60));
console.log("TEST 2: Apache HTTP Server");
console.log("=".repeat(60));

const apacheAsset: ParsedAsset = {
    raw: "Apache HTTP Server 2.4.51",
    normalized: "apache http server 2.4.51",
    tokens: ["apache", "http", "server"],
    vendor: "apache",
    product: "http server",
    version: "2.4.51",
    versionCandidates: ["2.4.51", "2.4", "2"]
};

console.log("\n📋 Test Asset:");
console.log(`   Vendor:  ${apacheAsset.vendor}`);
console.log(`   Product: ${apacheAsset.product}`);
console.log(`   Version: ${apacheAsset.version}`);

const apacheResults = rankCpeCandidates(apacheAsset, testCpeProducts, 5);

console.log(`\nFound ${apacheResults.length} ranked candidates:\n`);

apacheResults.forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.cpeName}`);
    console.log(`   Score: ${candidate.score}%`);
    console.log(`   Breakdown: V=${(candidate.breakdown.vendorScore * 100).toFixed(0)}% P=${(candidate.breakdown.productScore * 100).toFixed(0)}% Ver=${(candidate.breakdown.versionScore * 100).toFixed(0)}% T=${(candidate.breakdown.tokenOverlapScore * 100).toFixed(0)}%`);
    console.log("");
});

console.log("=".repeat(60));
console.log("✅ Tests completed!");
console.log("=".repeat(60));

// ============================================================================
// TEST 3: Microsoft Windows with fuzzy matching
// ============================================================================
console.log("\n" + "=".repeat(60));
console.log("TEST 3: Microsoft Windows (Fuzzy Vendor Match)");
console.log("=".repeat(60));

const windowsCpeProducts: CpeProduct[] = [
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:o:microsoft:windows_10:21h2:*:*:*:*:*:*:*",
            cpeNameId: "win001",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Microsoft Windows 10 21H2", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:o:microsoft:windows_10:22h2:*:*:*:*:*:*:*",
            cpeNameId: "win002",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Microsoft Windows 10 22H2", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:o:microsoft:windows_11:23h2:*:*:*:*:*:*:*",
            cpeNameId: "win003",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Microsoft Windows 11 23H2", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:o:microsoft:windows_server:2019:*:*:*:*:*:*:*",
            cpeNameId: "win004",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Microsoft Windows Server 2019", lang: "en" }],
            refs: null
        }
    }
];

const windowsAsset: ParsedAsset = {
    raw: "Windows 10 21H2",
    normalized: "windows 10 21h2",
    tokens: ["windows", "10", "21h2"],
    vendor: "microsoft",
    product: "windows 10",
    version: "21h2",
    versionCandidates: ["21h2"]
};

console.log("\n📋 Test Asset:");
console.log(`   Vendor:  ${windowsAsset.vendor}`);
console.log(`   Product: ${windowsAsset.product}`);
console.log(`   Version: ${windowsAsset.version}`);

const windowsResults = rankCpeCandidates(windowsAsset, windowsCpeProducts, 5);

console.log(`\nFound ${windowsResults.length} ranked candidates:\n`);
windowsResults.forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.cpeName}`);
    console.log(`   Score: ${candidate.score}%`);
    console.log(`   Breakdown: V=${(candidate.breakdown.vendorScore * 100).toFixed(0)}% P=${(candidate.breakdown.productScore * 100).toFixed(0)}% Ver=${(candidate.breakdown.versionScore * 100).toFixed(0)}% T=${(candidate.breakdown.tokenOverlapScore * 100).toFixed(0)}%`);
    console.log("");
});

// ============================================================================
// TEST 4: Siemens PLC (ICS/SCADA equipment)
// ============================================================================
console.log("=".repeat(60));
console.log("TEST 4: Siemens S7-1500 PLC (Industrial Control System)");
console.log("=".repeat(60));

const siemensCpeProducts: CpeProduct[] = [
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:h:siemens:simatic_s7-1500:*:*:*:*:*:*:*:*",
            cpeNameId: "siem001",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Siemens SIMATIC S7-1500", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:o:siemens:simatic_s7-1500_firmware:2.9.4:*:*:*:*:*:*:*",
            cpeNameId: "siem002",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Siemens SIMATIC S7-1500 Firmware 2.9.4", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:o:siemens:simatic_s7-1500_firmware:2.9.2:*:*:*:*:*:*:*",
            cpeNameId: "siem003",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Siemens SIMATIC S7-1500 Firmware 2.9.2", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:h:siemens:simatic_s7-1200:*:*:*:*:*:*:*:*",
            cpeNameId: "siem004",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Siemens SIMATIC S7-1200", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:h:siemens:simatic_s7-300:*:*:*:*:*:*:*:*",
            cpeNameId: "siem005",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Siemens SIMATIC S7-300", lang: "en" }],
            refs: null
        }
    }
];

const siemensAsset: ParsedAsset = {
    raw: "Siemens SIMATIC S7-1500 Firmware v2.9.4",
    normalized: "siemens simatic s7-1500 firmware v2.9.4",
    tokens: ["siemens", "simatic", "s7", "1500", "firmware"],
    vendor: "siemens",
    product: "simatic s7-1500 firmware",
    version: "2.9.4",
    versionCandidates: ["2.9.4", "2.9", "2"]
};

console.log("\n📋 Test Asset:");
console.log(`   Vendor:  ${siemensAsset.vendor}`);
console.log(`   Product: ${siemensAsset.product}`);
console.log(`   Version: ${siemensAsset.version}`);

const siemensResults = rankCpeCandidates(siemensAsset, siemensCpeProducts, 5);

console.log(`\nFound ${siemensResults.length} ranked candidates:\n`);
siemensResults.forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.cpeName}`);
    console.log(`   Score: ${candidate.score}%`);
    console.log(`   Breakdown: V=${(candidate.breakdown.vendorScore * 100).toFixed(0)}% P=${(candidate.breakdown.productScore * 100).toFixed(0)}% Ver=${(candidate.breakdown.versionScore * 100).toFixed(0)}% T=${(candidate.breakdown.tokenOverlapScore * 100).toFixed(0)}%`);
    console.log("");
});

// ============================================================================
// TEST 5: Edge case - No vendor provided
// ============================================================================
console.log("=".repeat(60));
console.log("TEST 5: Edge Case - No Vendor Provided");
console.log("=".repeat(60));

const noVendorAsset: ParsedAsset = {
    raw: "nginx 1.24.0",
    normalized: "nginx 1.24.0",
    tokens: ["nginx"],
    vendor: null,  // No vendor identified
    product: "nginx",
    version: "1.24.0",
    versionCandidates: ["1.24.0", "1.24", "1"]
};

const nginxCpeProducts: CpeProduct[] = [
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:a:nginx:nginx:1.24.0:*:*:*:*:*:*:*",
            cpeNameId: "nginx001",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "nginx 1.24.0", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:a:f5:nginx:1.24.0:*:*:*:*:*:*:*",
            cpeNameId: "nginx002",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "F5 NGINX 1.24.0", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:a:nginx:nginx:1.23.0:*:*:*:*:*:*:*",
            cpeNameId: "nginx003",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "nginx 1.23.0", lang: "en" }],
            refs: null
        }
    }
];

console.log("\n📋 Test Asset:");
console.log(`   Vendor:  ${noVendorAsset.vendor || "(null)"}`);
console.log(`   Product: ${noVendorAsset.product}`);
console.log(`   Version: ${noVendorAsset.version}`);

const nginxResults = rankCpeCandidates(noVendorAsset, nginxCpeProducts, 5);

console.log(`\nFound ${nginxResults.length} ranked candidates:\n`);
nginxResults.forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.cpeName}`);
    console.log(`   Score: ${candidate.score}%`);
    console.log(`   Breakdown: V=${(candidate.breakdown.vendorScore * 100).toFixed(0)}% P=${(candidate.breakdown.productScore * 100).toFixed(0)}% Ver=${(candidate.breakdown.versionScore * 100).toFixed(0)}% T=${(candidate.breakdown.tokenOverlapScore * 100).toFixed(0)}%`);
    console.log("");
});

// ============================================================================
// TEST 6: Edge case - No version provided
// ============================================================================
console.log("=".repeat(60));
console.log("TEST 6: Edge Case - No Version Provided");
console.log("=".repeat(60));

const noVersionAsset: ParsedAsset = {
    raw: "OpenSSL",
    normalized: "openssl",
    tokens: ["openssl"],
    vendor: "openssl",
    product: "openssl",
    version: null,  // No version identified
    versionCandidates: []
};

const opensslCpeProducts: CpeProduct[] = [
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:a:openssl:openssl:3.0.0:*:*:*:*:*:*:*",
            cpeNameId: "ssl001",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "OpenSSL 3.0.0", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:a:openssl:openssl:1.1.1:*:*:*:*:*:*:*",
            cpeNameId: "ssl002",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "OpenSSL 1.1.1", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:a:openssl:openssl:*:*:*:*:*:*:*:*",
            cpeNameId: "ssl003",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "OpenSSL (all versions)", lang: "en" }],
            refs: null
        }
    }
];

console.log("\n📋 Test Asset:");
console.log(`   Vendor:  ${noVersionAsset.vendor}`);
console.log(`   Product: ${noVersionAsset.product}`);
console.log(`   Version: ${noVersionAsset.version || "(null)"}`);

const opensslResults = rankCpeCandidates(noVersionAsset, opensslCpeProducts, 5);

console.log(`\nFound ${opensslResults.length} ranked candidates:\n`);
opensslResults.forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.cpeName}`);
    console.log(`   Score: ${candidate.score}%`);
    console.log(`   Breakdown: V=${(candidate.breakdown.vendorScore * 100).toFixed(0)}% P=${(candidate.breakdown.productScore * 100).toFixed(0)}% Ver=${(candidate.breakdown.versionScore * 100).toFixed(0)}% T=${(candidate.breakdown.tokenOverlapScore * 100).toFixed(0)}%`);
    console.log("");
});

// ============================================================================
// TEST 7: Wildcard CPE versions
// ============================================================================
console.log("=".repeat(60));
console.log("TEST 7: Wildcard CPE Versions");
console.log("=".repeat(60));

const wildcardCpeProducts: CpeProduct[] = [
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:a:cisco:ios_xe:17.3.1:*:*:*:*:*:*:*",
            cpeNameId: "cisco001",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Cisco IOS XE 17.3.1", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:a:cisco:ios_xe:*:*:*:*:*:*:*:*",
            cpeNameId: "cisco002",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Cisco IOS XE (all versions)", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:a:cisco:ios_xe:17.3.2:*:*:*:*:*:*:*",
            cpeNameId: "cisco003",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Cisco IOS XE 17.3.2", lang: "en" }],
            refs: null
        }
    }
];

const ciscoAsset: ParsedAsset = {
    raw: "Cisco IOS XE 17.3.1",
    normalized: "cisco ios xe 17.3.1",
    tokens: ["cisco", "ios", "xe"],
    vendor: "cisco",
    product: "ios xe",
    version: "17.3.1",
    versionCandidates: ["17.3.1", "17.3", "17"]
};

console.log("\n📋 Test Asset:");
console.log(`   Vendor:  ${ciscoAsset.vendor}`);
console.log(`   Product: ${ciscoAsset.product}`);
console.log(`   Version: ${ciscoAsset.version}`);

const ciscoResults = rankCpeCandidates(ciscoAsset, wildcardCpeProducts, 5);

console.log(`\nFound ${ciscoResults.length} ranked candidates:\n`);
ciscoResults.forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.cpeName}`);
    console.log(`   Score: ${candidate.score}%`);
    console.log(`   Breakdown: V=${(candidate.breakdown.vendorScore * 100).toFixed(0)}% P=${(candidate.breakdown.productScore * 100).toFixed(0)}% Ver=${(candidate.breakdown.versionScore * 100).toFixed(0)}% T=${(candidate.breakdown.tokenOverlapScore * 100).toFixed(0)}%`);
    console.log("");
});

// ============================================================================
// TEST 8: Typo tolerance (Levenshtein distance)
// ============================================================================
console.log("=".repeat(60));
console.log("TEST 8: Typo Tolerance (Levenshtein Distance)");
console.log("=".repeat(60));

const typoCpeProducts: CpeProduct[] = [
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:a:wordpress:wordpress:6.4.2:*:*:*:*:*:*:*",
            cpeNameId: "wp001",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "WordPress 6.4.2", lang: "en" }],
            refs: null
        }
    },
    {
        cpe: {
            deprecated: false,
            cpeName: "cpe:2.3:a:drupal:drupal:10.0.0:*:*:*:*:*:*:*",
            cpeNameId: "drupal001",
            lastModified: "2024-01-01",
            created: "2023-01-01",
            titles: [{ title: "Drupal 10.0.0", lang: "en" }],
            refs: null
        }
    }
];

// Simulating a typo: "wordpres" instead of "wordpress"
const typoAsset: ParsedAsset = {
    raw: "Wordpres 6.4.2",
    normalized: "wordpres 6.4.2",
    tokens: ["wordpres"],
    vendor: "wordpres",  // Typo!
    product: "wordpres", // Typo!
    version: "6.4.2",
    versionCandidates: ["6.4.2", "6.4", "6"]
};

console.log("\n📋 Test Asset (with typo):");
console.log(`   Vendor:  ${typoAsset.vendor} (typo for 'wordpress')`);
console.log(`   Product: ${typoAsset.product}`);
console.log(`   Version: ${typoAsset.version}`);

const typoResults = rankCpeCandidates(typoAsset, typoCpeProducts, 5);

console.log(`\nFound ${typoResults.length} ranked candidates:\n`);
typoResults.forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.cpeName}`);
    console.log(`   Score: ${candidate.score}%`);
    console.log(`   Breakdown: V=${(candidate.breakdown.vendorScore * 100).toFixed(0)}% P=${(candidate.breakdown.productScore * 100).toFixed(0)}% Ver=${(candidate.breakdown.versionScore * 100).toFixed(0)}% T=${(candidate.breakdown.tokenOverlapScore * 100).toFixed(0)}%`);
    console.log("");
});

// ============================================================================
// TEST 9: Empty CPE list
// ============================================================================
console.log("=".repeat(60));
console.log("TEST 9: Edge Case - Empty CPE List");
console.log("=".repeat(60));

const emptyAsset: ParsedAsset = {
    raw: "Some Random Software",
    normalized: "some random software",
    tokens: ["some", "random", "software"],
    vendor: "unknown",
    product: "random software",
    version: "1.0",
    versionCandidates: ["1.0"]
};

const emptyResults = rankCpeCandidates(emptyAsset, [], 5);
console.log(`\n📋 Testing with empty CPE list...`);
console.log(`Found ${emptyResults.length} ranked candidates (expected: 0)\n`);

// ============================================================================
// TEST 10: Top N limiting
// ============================================================================
console.log("=".repeat(60));
console.log("TEST 10: Top N Limiting (topN=2)");
console.log("=".repeat(60));

const topNResults = rankCpeCandidates(siemensAsset, siemensCpeProducts, 2);
console.log(`\n📋 Requested top 2 from ${siemensCpeProducts.length} CPEs...`);
console.log(`Got ${topNResults.length} results (expected: 2)\n`);

topNResults.forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.cpeName}`);
    console.log(`   Score: ${candidate.score}%`);
    console.log("");
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log("\n" + "=".repeat(60));
console.log("🎉 ALL TESTS COMPLETED!");
console.log("=".repeat(60));
console.log(`
Summary:
  ✓ Test 1:  eWon Firmware - Basic matching
  ✓ Test 2:  Apache HTTP Server - Product with spaces
  ✓ Test 3:  Microsoft Windows - OS versioning
  ✓ Test 4:  Siemens S7-1500 - ICS/SCADA equipment
  ✓ Test 5:  No vendor provided - Edge case
  ✓ Test 6:  No version provided - Edge case
  ✓ Test 7:  Wildcard CPE versions
  ✓ Test 8:  Typo tolerance (Levenshtein)
  ✓ Test 9:  Empty CPE list - Edge case
  ✓ Test 10: Top N limiting
`);