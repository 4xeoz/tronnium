# Prisma Schema Analysis & Improvement Plan

This document outlines identified issues, proposed improvements, implementation priorities, and migration strategy for enhancing the Prisma schema—especially around relationships, vulnerabilities, and risk modeling.

---

## 1. Problems Identified

### 1.1 Missing Relationship Model
- ❌ Relationship model referenced but not defined in `prisma/schema.prisma`
- ✅ Must be added with proper indexes and constraints

---

### 1.2 Asset Type Should Be Enum

**Problem:** Currently defined as:
```prisma
// type String @default("unknown")
```

- No type safety
- Allows invalid values

**Improved Version:**
```prisma
enum AssetType {
  SERVER
  DATABASE
  NETWORK
  FIREWALL
  IOT
  ROUTER
  SWITCH
  STORAGE
  LOAD_BALANCER
  UNKNOWN
}
```

---

### 1.3 Asset Status Should Be Enum

**Problem:**
```prisma
// status String?
```

**Improved Version:**
```prisma
enum AssetStatus {
  ACTIVE
  INACTIVE
  MAINTENANCE
  DECOMMISSIONED
  UNKNOWN
}
```

---

### 1.4 Relationship Type – Bidirectional Query Consideration

- If asset A `DEPENDS_ON` asset B, backward queries must be efficient.
- Model is valid conceptually, but service-layer query patterns must support reverse traversal.

---

### 1.5 Missing Vulnerability Model (Security Feature)

```prisma
model Vulnerability {
  id        String   @id @default(uuid()) @db.Uuid
  cveId     String   @unique
  cvssScore Float
  severity  String

  assetVulnerabilities AssetVulnerability[]
}

model AssetVulnerability {
  id              String        @id @default(uuid()) @db.Uuid
  assetId         String        @db.Uuid
  asset           Asset         @relation(fields: [assetId], references: [id], onDelete: Cascade)
  vulnerabilityId String        @db.Uuid
  vulnerability   Vulnerability @relation(fields: [vulnerabilityId], references: [id])

  detectedAt      DateTime      @default(now())
  remediated      Boolean       @default(false)
  remediatedAt    DateTime?

  @@unique([assetId, vulnerabilityId])
  @@index([assetId])
}
```

---

### 1.6 Missing Scan History (Vulnerability Scanning)

```prisma
model VulnerabilityScan {
  id            String      @id @default(uuid()) @db.Uuid
  environmentId String      @db.Uuid
  environment   Environment @relation(fields: [environmentId], references: [id])

  status        ScanStatus
  startedAt     DateTime    @default(now())
  completedAt   DateTime?

  vulnerabilitiesFound Int @default(0)
  criticalCount        Int @default(0)
  highCount            Int @default(0)

  assetScans AssetScan[]
}

enum ScanStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

model AssetScan {
  id                 String            @id @default(uuid()) @db.Uuid
  assetId            String            @db.Uuid
  asset              Asset             @relation(fields: [assetId], references: [id])
  scanId             String            @db.Uuid
  scan               VulnerabilityScan @relation(fields: [scanId], references: [id])

  vulnerabilitiesFound Int      @default(0)
  scannedAt            DateTime @default(now())

  @@unique([assetId, scanId])
}
```

---

### 1.7 Missing Risk Score Tracking

```prisma
model RiskScore {
  id               String   @id @default(uuid()) @db.Uuid
  assetId          String   @db.Uuid
  asset            Asset    @relation(fields: [assetId], references: [id])

  overallScore     Float
  cveImpact        Float
  dependencyImpact Float
  exposureScore    Float

  calculatedAt     DateTime @default(now())

  @@unique([assetId])
  @@index([assetId])
  @@index([overallScore])
}
```

---

### 1.8 Relationship Criticality – Enum or Scale

Option 1 – Enum:
```prisma
enum RelationshipCriticality {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

Option 2 – Scaled Integer:
```prisma
criticality Int? // 1–10 scale
```

---

### 1.9 Relationship Constraints

```prisma
model Relationship {
  // fields omitted

  @@unique([fromAssetId, toAssetId, type])
  @@index([fromAssetId])
  @@index([toAssetId])
}
```

Self-relationship prevention should be handled in the service layer validation.

---

### 1.10 Composite Indexes for Performance

```prisma
@@index([environmentId, assetId])
@@index([fromAssetId, environmentId])
@@index([toAssetId, environmentId])
```

---

# 2. Improvements & Recommendations

## 2.1 Audit Trail (Compliance / SOC)

```prisma
model AuditLog {
  id           String      @id @default(uuid()) @db.Uuid
  userId       String      @db.Uuid
  user         UserAccount @relation(fields: [userId], references: [id])

  action       String
  resourceId   String
  resourceType String

  oldValue     Json?
  newValue     Json?

  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
}
```

---

## 2.2 Alert / Notification System

```prisma
model Alert {
  id              String        @id @default(uuid()) @db.Uuid
  environmentId   String        @db.Uuid

  type            AlertType
  severity        AlertSeverity

  title           String
  message         String

  relatedAssetId  String?
  relatedVulnId   String?

  resolved        Boolean       @default(false)
  resolvedAt      DateTime?

  createdAt       DateTime      @default(now())
}

enum AlertType {
  NEW_VULNERABILITY
  SCAN_COMPLETED
  DEPENDENCY_VULNERABLE
  SCAN_FAILED
  HIGH_RISK_DETECTED
}

enum AlertSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
  INFO
}
```

---

## 2.3 Relationship Metadata (LLM Context Enrichment)

```prisma
model Relationship {
  dataFlow                String?
  bandwidth               String?
  latencySensitive        Boolean @default(false)
  expectedDowntimeMinutes Int?
  notes                   String?
}
```

---

## 2.4 Remediation Tracking

```prisma
model Remediation {
  id              String   @id @default(uuid()) @db.Uuid
  vulnerabilityId String   @db.Uuid
  assetId         String   @db.Uuid

  status          RemediationStatus
  assignedTo      String?
  dueDate         DateTime?
  completedAt     DateTime?

  notes           String?
  priority        Int

  createdAt       DateTime @default(now())
}

enum RemediationStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  DEFERRED
  WONT_FIX
}
```

---

# 3. Implementation Priority

| Priority | Feature | Effort | Impact | Dependencies |
|----------|----------|--------|--------|--------------|
| 🔴 P0 | Add Relationship model | 2h | Critical | None |
| 🔴 P0 | Convert Type/Status to Enums | 3h | High | None |
| 🔴 P0 | Add Vulnerability model | 4h | Critical | Migration |
| 🟠 P1 | Add VulnerabilityScan model | 4h | High | Vulnerability |
| 🟠 P1 | Add RiskScore model | 3h | High | Relationship + Vuln |
| 🟡 P2 | Add AuditLog | 2h | Medium | Middleware |
| 🟡 P2 | Add Alert system | 3h | Medium | Notification infra |
| 🟢 P3 | Remediation tracking | 3h | Low | UI work |

---

# 4. Database Migration Strategy

```bash
# 1. Backup database
pg_dump your_db > backup.sql

# 2. Update schema.prisma

# 3. Create migration
npx prisma migrate dev --name "add_vulnerabilities_and_relationships"

# 4. Review migration SQL

# 5. Seed test data
```

---

# 5. Required Query Patterns

## 5.1 Get Assets Impacted by a Vulnerability

```typescript
const impactedAssets = await prisma.asset.findMany({
  where: {
    assetVulnerabilities: {
      some: {
        vulnerabilityId: vulnId
      }
    }
  },
  include: {
    toRelationships: true
  }
});
```

---

## 5.2 Downstream Impact (Recursive Traversal)

```typescript
const getDownstreamImpact = async (assetId: string) => {
  // Recursive traversal logic
};
```

---

## 5.3 Risk Propagation

```typescript
const updateAssetRiskScore = async (assetId: string) => {
  // 1. Fetch vulnerabilities
  // 2. Fetch relationships
  // 3. Calculate downstream impact
  // 4. Update RiskScore table
};
```

---

# Next Steps

Choose one:

1. Add Relationship model + enums immediately
2. Generate full migration script
3. Build service/query layer
4. Plan UI layer
5. Other

