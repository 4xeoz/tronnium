# asset-relationships

Manages directed relationships between assets within an environment.

## Purpose

Provides a full CRUD API for creating, reading, updating, and deleting semantic links between two assets (e.g., "Server A **DEPENDS_ON** Server B" with **HIGH** criticality). This enables the platform to model infrastructure topology and dependency graphs.

## Files

| File | Role |
|------|------|
| `relationship.controller.ts` | Express request handlers for CRUD operations. Contains validation, authorization, duplicate/loop prevention, and direct Prisma queries. |
| `relationship.routes.ts` | Express router. Maps HTTP methods and paths to controller handlers. Applies `jwtAuthGuard` and `logRequest`. |
| `relationship.service.ts` | **Unused.** Defines `AssetRelationshipService` wrapping Prisma CRUD, but the controller queries Prisma directly. |

## Endpoints

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/:environmentId` | `getRelationshipsHandler` |
| `POST` | `/:environmentId` | `createRelationshipHandler` |
| `PATCH` | `/:environmentId/:relationshipId` | `updateRelationshipHandler` |
| `DELETE` | `/:environmentId/:relationshipId` | `deleteRelationshipHandler` |

## How it links together

```
relationship.routes.ts
  → jwtAuthGuard() → logRequest() → relationship.controller.ts
      → verifyEnvironment() (from ../environments)
      → prisma.relationship.* (direct queries)
```

## Key concepts

### Data model

```prisma
model Relationship {
  id            String
  environmentId String
  fromAssetId   String
  toAssetId     String
  type          RelationType
  criticality   RelationshipCriticality
}
```

- `RelationType`: `DEPENDS_ON`, `CONTROLS`, `PROVIDES_SERVICE`, `SHARES_DATA_WITH`
- `RelationshipCriticality`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

### Validation rules

- **Self-reference forbidden:** `fromAssetId === toAssetId` → `400`
- **Valid type required:** must be one of the 4 `RelationType` values
- **Valid criticality required:** must be one of `LOW`, `MEDIUM`, `HIGH` (`CRITICAL` is excluded from the controller's `VALID_CRITICALITIES` array even though it exists in the Prisma enum)
- **Asset existence:** both assets must exist in the target environment
- **Duplicate prevention:** same `(fromAssetId, toAssetId, type, environmentId)` → `409 CONFLICT`
- **Closed-loop prevention:** inverse relationship `(toAssetId → fromAssetId, same type)` → `400 INVALID_INPUT`
