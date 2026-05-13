# Attack Path Analysis System
## Project Documentation — May 12, 2026

**Author:** Engineering Team  
**Status:** Complete (Phases 1–6)  
**Scope:** Full-stack blast radius computation, visualization, and dashboard integration

---

## 1. Executive Summary

We built an **attack path analysis engine** that computes how far an attacker can propagate through an asset graph starting from externally-facing entry points. The system combines vulnerability data, relationship topology, and a weighted graph traversal to produce:

- **Entry point detection** — which assets are reachable from the internet AND have exploitable network-pivot vulnerabilities
- **Blast radius per asset** — every asset reachable from a chosen source, with compromise scores
- **Environment-wide risk map** — aggregated maximum compromise/knowledge scores across all entry points
- **Map visualization** — color-coded nodes showing risk intensity, gated paths, and analysis source
- **Dashboard summary** — at-a-glance entry point count and highest-risk asset

---

## 2. Technical Architecture

### 2.1 Backend Layers (bottom-up)

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 7: API Controllers                                   │
│  relationship.controller.ts                                 │
│    GET /:envId/blast-radius        → EnvironmentRiskMap     │
│    GET /:envId/blast-radius/:id    → BlastRadiusResult      │
│    GET /:envId/entry-points        → EntryPoint[]           │
├─────────────────────────────────────────────────────────────┤
│  Layer 6: Aggregation                                       │
│  graph-traversal.service.ts                                 │
│    computeEnvironmentBlastRadius()   → max across entry pts │
│    runWeightedTraversal()            → Dijkstra-like BFS    │
├─────────────────────────────────────────────────────────────┤
│  Layer 5: Graph Traversal Core                              │
│  graph-traversal.service.ts                                 │
│    PriorityQueue (min-heap)            O(log n) per op      │
│    Two-score propagation: compromise + knowledge            │
│    Knowledge discount: cost × (1 − knowledge × 0.3)         │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Edge Cost + Gate                                  │
│  graph-data.service.ts                                      │
│    calculateEdgeCost()               → base × vuln × crit   │
│    checkExploitabilityGate()         → edge-type checks     │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Data Loaders                                      │
│  graph-data.service.ts                                      │
│    loadAssetVulnProfiles()           → Map<assetId, profile>│
│    loadAdjacencyList()               → Map<assetId, neighbors│
│    findEntryPoints()                 → externally-facing + pivot│
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Vulnerability Classification                      │
│  cvss-parser.ts + vuln-classifier.ts                        │
│    parseCvssVector()                 → structured CVSS fields│
│    classifyVuln()                    → boolean flags         │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Schema Extensions                                 │
│  Prisma schema                                              │
│    isExternallyFacing (Asset)                               │
│    RelationType enum (6 values)                             │
│    securityCriticality (Relationship)                       │
│    operationalCriticality (Relationship, renamed)           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Key Files

| Layer | File | Responsibility |
|-------|------|---------------|
| Schema | `prisma/schema.prisma` | Asset, Relationship, SecurityScan, AssetScan, AssetVulnerability, VulnerabilityWorkflow |
| Parser | `backend/src/lib/cvss-parser.ts` | `CVSS:3.1/` prefix handling, vector → structured object |
| Classifier | `backend/src/lib/vuln-classifier.ts` | `isNetworkPivot`, `isCredentialTheft`, `isInjection`, `isPhysicalAccessOnly` |
| Data | `backend/src/lib/graph-data.service.ts` | Profile loader, adjacency loader, entry point detector, edge cost, exploitability gate |
| Traversal | `backend/src/lib/graph-traversal.service.ts` | `runWeightedTraversal`, `computeEnvironmentBlastRadius` |
| API | `backend/src/modules/asset-relationships/relationship.controller.ts` | Handlers for blast-radius, entry-points endpoints |
| Dev tools | `backend/src/modules/developer-tools/dev.controller.ts` | Test vulnerability creation (mock scan pipeline) |

### 2.3 Frontend Components

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                                                  │
│    AttackExposureCard        → entry points + highest risk  │
│    StatCard (grid)           → total assets, CPE coverage   │
│      └─ includes attack entry point count                   │
├─────────────────────────────────────────────────────────────┤
│  Map Page                                                   │
│    ReactFlow canvas                                           │
│      AssetNode               → risk tint, score badge, lock │
│      DependencyEdge          → relationship visualization   │
│    Panels                                                     │
│      Entry point legend      → bottom-left                  │
│      Analysis active banner  → top-center ( dismissible )   │
│    Sidebars                                                   │
│      MapSidebar              → asset details + Analyze btn  │
│      BlastRadiusSidebar      → ranked list, path expander   │
│      RelationshipSidebar     → edge CRUD                    │
├─────────────────────────────────────────────────────────────┤
│  Hooks                                                      │
│    useBlastRadius            → single-asset blast radius    │
│    useEntryPoints            → externally-facing pivots     │
│    useEnvironmentRiskMap     → aggregated environment map   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Mathematical Foundations

### 3.1 Entry Point Detection

An asset is an **entry point** iff:

```
isEntryPoint(asset) = asset.isExternallyFacing ∧ vulnProfile(asset).hasNetworkPivot
```

Where `hasNetworkPivot` is derived from vulnerability classification:
```
hasNetworkPivot = ∃ v ∈ asset.vulnerabilities : classify(v).isNetworkPivot
```

### 3.2 Edge Cost

```
calculateEdgeCost(edgeType, securityCriticality, sourceVulnProfile):
    base = 10.0

    # Edge-type base multiplier
    if edgeType == NETWORK_CONNECTS_TO:     multiplier = 1.0
    if edgeType == AUTHENTICATES_VIA:       multiplier = 0.7
    if edgeType == SHARES_CREDENTIALS_WITH: multiplier = 0.6
    if edgeType == MANAGED_BY:              multiplier = 1.2
    if edgeType == EXECUTES_CODE_FROM:      multiplier = 0.8
    if edgeType == RECEIVES_DATA_FROM:      multiplier = 1.1

    # Vulnerability multiplier (source asset)
    vulnMultiplier = 1.0
    if sourceVulnProfile.hasNetworkPivot:      vulnMultiplier -= 0.25
    if sourceVulnProfile.hasCredentialTheft:   vulnMultiplier -= 0.20
    if sourceVulnProfile.hasInjection:         vulnMultiplier -= 0.15

    # Criticality discount (easier to cross critical edges)
    criticalityDiscount = 1.0
    if securityCriticality == CRITICAL:  criticalityDiscount = 0.7
    if securityCriticality == HIGH:      criticalityDiscount = 0.85
    if securityCriticality == MEDIUM:    criticalityDiscount = 1.0
    if securityCriticality == LOW:       criticalityDiscount = 1.15

    return base × multiplier × vulnMultiplier × criticalityDiscount
```

### 3.3 Exploitability Gate

An edge **passes the gate** iff:

```
checkExploitabilityGate(edgeType, sourceVulnProfile):
    if edgeType == NETWORK_CONNECTS_TO:
        passes = sourceVulnProfile.hasNetworkPivot
        reason = "Source lacks network-pivot vulnerability"

    if edgeType == AUTHENTICATES_VIA:
        passes = sourceVulnProfile.hasCredentialTheft
        reason = "Source lacks credential-theft vulnerability"

    if edgeType == SHARES_CREDENTIALS_WITH:
        passes = sourceVulnProfile.hasCredentialTheft
        reason = "Source lacks credential-theft vulnerability"

    if edgeType in [MANAGED_BY, EXECUTES_CODE_FROM, RECEIVES_DATA_FROM]:
        passes = true   # No special gate

    return { passes, reason }
```

### 3.4 Weighted BFS (Dijkstra Variant)

```
runWeightedTraversal(entryPoints, adjList, vulnProfiles, budget):
    pq = PriorityQueue() ordered by (cost, hops)
    reached = Map<assetId, ReachedNode>()
    gatedEdges = []

    for ep in entryPoints:
        profile = vulnProfiles.get(ep)
        baseRisk = epssAdjustedCvss(profile.maxCvss, profile.maxEpss)
        pq.push({
            assetId: ep,
            cost: 0,
            hops: 0,
            path: [ep],
            compromiseScore: baseRisk,
            knowledgeScore: 0
        })

    while pq not empty:
        current = pq.pop()   # lowest cost

        if current.cost > budget:
            continue

        if reached.has(current.assetId):
            continue   # Already visited with lower cost

        reached.set(current.assetId, current)

        for neighbor in adjList.get(current.assetId) || []:
            gate = checkExploitabilityGate(neighbor.edgeType, vulnProfiles.get(current.assetId))
            if not gate.passes:
                gatedEdges.push({ fromAssetId: current.assetId, toAssetId: neighbor.neighborId, reason: gate.reason })
                continue

            edgeCost = calculateEdgeCost(neighbor.edgeType, neighbor.securityCriticality, vulnProfiles.get(current.assetId))

            # Knowledge discount
            effectiveCost = edgeCost × (1 − current.knowledgeScore × 0.3)

            newCost = current.cost + effectiveCost
            newHops = current.hops + 1

            # Compromise score decays by criticality
            decay = neighbor.securityCriticality == CRITICAL ? 0.70 :
                    neighbor.securityCriticality == HIGH    ? 0.80 :
                    neighbor.securityCriticality == MEDIUM  ? 0.90 : 0.95
            newCompromise = current.compromiseScore × decay

            # Knowledge score increments on credential edges
            newKnowledge = current.knowledgeScore
            if neighbor.edgeType in [AUTHENTICATES_VIA, SHARES_CREDENTIALS_WITH]:
                if vulnProfiles.get(current.assetId)?.hasCredentialTheft:
                    newKnowledge += 1

            pq.push({
                assetId: neighbor.neighborId,
                cost: newCost,
                hops: newHops,
                path: [...current.path, neighbor.neighborId],
                compromiseScore: newCompromise,
                knowledgeScore: newKnowledge
            })

    return { reached, gatedEdges, entryPoints, budget, nodesVisited: reached.size, edgesGated: gatedEdges.length }
```

**Complexity:** `O(E log V)` where `E` = edges, `V` = assets. All graph data is pre-loaded into Maps — zero DB queries in the hot loop.

### 3.5 Environment-Wide Aggregation

```
computeEnvironmentBlastRadius(envId, config):
    vulnProfiles = loadAssetVulnProfiles(envId)
    adjList      = loadAdjacencyList(envId)
    entryPoints  = findEntryPoints(envId, vulnProfiles)

    perRunResults = entryPoints.map(ep =>
        runWeightedTraversal([ep], adjList, vulnProfiles, config.budget)
    )

    assetRisks = new Map()
    for run in perRunResults:
        ep = run.entryPoints[0]
        for [assetId, node] in run.reached:
            if not assetRisks.has(assetId):
                assetRisks.set(assetId, {
                    assetId,
                    maxCompromiseScore: 0,
                    maxKnowledgeScore: 0,
                    reachableFromEntryPoints: []
                })
            risk = assetRisks.get(assetId)
            risk.maxCompromiseScore = max(risk.maxCompromiseScore, node.compromiseScore)
            risk.maxKnowledgeScore  = max(risk.maxKnowledgeScore, node.knowledgeScore)
            if not risk.reachableFromEntryPoints.includes(ep):
                risk.reachableFromEntryPoints.push(ep)

    return {
        environmentId: envId,
        assetRisks,
        entryPoints,
        runs: perRunResults.length,
        totalAssetsReached: assetRisks.size
    }
```

### 3.6 CVSS + EPSS Risk Score

```
epssAdjustedCvss(cvssScore, epssPercentile):
    return (cvssScore ?? 5.0) × (1 + (epssPercentile ?? 0))

# Example:
# cvss=9.8, epss=0.85 → 9.8 × 1.85 = 18.13
# cvss=5.0, epss=0.0  → 5.0 × 1.0  = 5.0
```

---

## 4. Data Flow

### 4.1 Mock/Test Vulnerability → Analysis

```
User clicks "Add Test Vuln" (dev mode)
  → POST /dev/create-test-vulnerability
    → Prisma: Vulnerability (isMock=true)
    → Prisma: VulnerabilityWorkflow
    → Prisma: SecurityScan (isMock=true, COMPLETED)
    → Prisma: AssetScan → AssetVulnerability
  → Dashboard counts query sees it (via AssetScan chain)
  → BFS loader sees it (via VulnerabilityWorkflow)
  → clearMockVulnerabilities deletes it (via isMock=true)
```

### 4.2 Real Scan → Analysis

```
Scheduler triggers scan
  → scan-core.service.ts fetches CVEs per CPE
    → Prisma: SecurityScan, AssetScan, AssetVulnerability
  → Dashboard queries count via AssetVulnerability
  → BFS loader reads via VulnerabilityWorkflow
```

### 4.3 Map Analysis Interaction

```
User clicks "Analyze Blast Radius" on asset sidebar
  → setAnalysisAssetId(asset.id)
  → useBlastRadius hook enabled → GET /blast-radius/:assetId
    → Backend runs runWeightedTraversal([assetId], ...)
    → Returns { reached, gatedEdges, budget, ... }
  → riskOverlay computed → node data updated → ReactFlow re-renders
    → Source: bright ring + "ORIGIN" label
    → Reachable: tinted background (green/amber/red) + score badge
    → Gated: 40% opacity + lock icon
    → Unrelated: 50% opacity dimming
  → BlastRadiusSidebar slides in
    → Sorted list by compromiseScore descending
    → Path expander shows assetId chain
    → Cost budget slider re-triggers analysis on change
```

---

## 5. API Endpoints

| Method | Path | Response | Description |
|--------|------|----------|-------------|
| GET | `/relationships/:envId/blast-radius` | `EnvironmentRiskMap` | Aggregated per-entry-point max scores |
| GET | `/relationships/:envId/blast-radius/:assetId` | `BlastRadiusResult` | Single-source BFS result |
| GET | `/relationships/:envId/entry-points` | `EntryPoint[]` | Externally-facing + pivot assets sorted by score |
| POST | `/dev/create-test-vulnerability` | `{ vulnerability, workflow, scanId }` | Manual test vuln with mock scan chain |

### 5.1 Response Shapes

```typescript
// GET /blast-radius/:assetId
interface BlastRadiusResult {
  sourceAssetId: string
  budget: number
  nodesVisited: number
  edgesGated: number
  reached: Array<{
    assetId: string
    cost: number
    hops: number
    compromiseScore: number   // 0–100
    knowledgeScore: number    // 0–100
    path: string[]            // assetId chain from source
  }>
  gatedEdges: Array<{
    fromAssetId: string
    toAssetId: string
    edgeType: string
    reason: string
  }>
}

// GET /blast-radius (environment)
interface EnvironmentRiskMap {
  environmentId: string
  entryPoints: EntryPoint[]
  runs: number
  totalAssetsReached: number
  assetRisks: Array<{
    assetId: string
    maxCompromiseScore: number
    maxKnowledgeScore: number
    reachableFromEntryPoints: string[]
  }>
}
```

---

## 6. Database Schema (Relevant Tables)

```
Asset
  id, name, type, domain, status, environmentId
  isExternallyFacing: Boolean    ← NEW
  x, y: Float?                   ← map position
  cpes: AssetCpe[]

Relationship
  id, fromAssetId, toAssetId
  type: RelationType             ← ENUM (6 values)
  operationalCriticality: String  ← RENAMED from criticality
  securityCriticality: String    ← NEW (low/medium/high/critical)

SecurityScan
  id, environmentId, status, startedAt, completedAt
  isMock: Boolean                ← distinguishes synthetic scans
  totalAssets, scannedAssets, vulnerabilitiesFound
  criticalCount, highCount, mediumCount, lowCount
  riskScore: Float?

AssetScan
  id, scanId, assetId, scannedAt
  vulnerabilities: AssetVulnerability[]

AssetVulnerability
  id, assetScanId, vulnerabilityId, cpeName

Vulnerability
  id, cveId, description, severity, cvssScore, cvssVector
  epssPercentile: Float?
  isMock: Boolean
  mockPrompt: String?
  createdBy: String?

VulnerabilityWorkflow
  id, environmentId, assetId, vulnerabilityId
  cpeName, status, assigneeId, firstSeenAt
```

---

## 7. Frontend State Model

```typescript
// Map page local state
const [analysisAssetId, setAnalysisAssetId] = useState<string | null>(null)
const [analysisConfig, setAnalysisConfig] = useState<Partial<BlastRadiusConfig>>({})
const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)

// Derived from hook
const { data: blastRadius, isLoading: isAnalyzing } = useBlastRadius(
  envId, analysisAssetId, analysisConfig
)

// Derived overlay
const riskOverlay = useMemo(() => {
  if (!blastRadius) return null
  const map = new Map<string, { compromiseScore, knowledgeScore, hops }>()
  for (const node of blastRadius.reached) {
    map.set(node.assetId, { compromiseScore, knowledgeScore, hops })
  }
  return {
    sourceId: blastRadius.sourceAssetId,
    reachableMap: map,
    gatedIds: new Set(blastRadius.gatedEdges.map(g => g.toAssetId))
  }
}, [blastRadius])

// Node data (per asset)
data: {
  asset,
  isEntryPoint: entryPointIds.has(asset.id),
  riskOverlay: riskOverlay?.reachableMap.get(asset.id),
  isGated: riskOverlay?.gatedIds.has(asset.id),
  isAnalysisSource: analysisAssetId === asset.id,
  isAnalysisModeActive: !!analysisAssetId,
}
```

---

## 8. Testing Checklist

| Phase | Component | Verified |
|-------|-----------|----------|
| 1.1 | `isExternallyFacing` schema + UI | ✅ |
| 1.2 | `RelationType` enum (6 values) | ✅ |
| 1.3 | `securityCriticality` on relationships | ✅ |
| 2.1 | CVSS parser unit tests | ✅ |
| 2.2 | Vuln classifier with EPSS + CVSS | ✅ |
| 2.3 | Asset vuln profile loader | ✅ |
| 3.1 | Adjacency list loader | ✅ |
| 3.2 | Entry point detector | ✅ |
| 4.1 | Edge cost calculator | ✅ |
| 4.2 | Exploitability gate | ✅ |
| 5.1 | Weighted BFS core | ✅ |
| 5.2 | Two-score propagation | ✅ |
| 6.1 | Blast radius aggregation | ✅ |
| 7.1 | Blast radius endpoints | ✅ |
| 7.2 | Entry points endpoint | ✅ |
| 4.1 | Map analysis mode state | ✅ |
| 4.2 | Analyze button in MapSidebar | ✅ |
| 4.3 | AssetNode risk overlay visuals | ✅ |
| 4.4 | Clear analysis banner | ✅ |
| 5.1 | BlastRadiusSidebar component | ✅ |
| 5.2 | Sidebar wired into map page | ✅ |
| 5.3 | Loading state (skeleton overlay) | ✅ |
| 6.1 | Dashboard risk summary | ✅ |
| 6.2 | AttackExposureCard component | ✅ |
| 6.3 | Card placed in dashboard layout | ✅ |
