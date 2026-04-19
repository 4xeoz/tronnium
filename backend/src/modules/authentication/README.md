# authentication

OAuth 2.0 login via Google, JWT-based session management, and authenticated user profile operations.

## Purpose

Acts as the gatekeeper for the entire backend. Nearly every other module imports `jwtAuthGuard` from here to protect its routes.

## Files

| File | Role |
|------|------|
| `passport.ts` | Configures Passport strategies (JWT + Google OAuth 2.0). Exports `jwtAuthGuard()` middleware. |
| `auth.controller.ts` | HTTP handlers: Google callback, profile, logout, dev-mode toggle. |
| `auth.routes.ts` | Express router. Maps auth endpoints to handlers. |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/google` | Redirect to Google OAuth |
| `GET` | `/google/callback` | Google OAuth callback — issues JWT cookie |
| `GET` | `/me` | Get current user profile |
| `POST` | `/logout` | Clear JWT cookie |
| `POST` | `/dev-mode` | Toggle `devMode` flag on user |

## How it links together

```
auth.routes.ts
  → passport.authenticate("google")        (for OAuth)
  → jwtAuthGuard() → auth.controller.ts
      → userService (from ../users)
      → jsonwebtoken (sign JWTs)
```

`app.ts` calls `configurePassport()` once at boot to register the two strategies on the global `passport` instance.

## Key concepts

### JWT Strategy

Validates tokens extracted from:
- `req.cookies.token` (primary — cookie extractor)
- `Authorization: Bearer <token>` header (fallback)

On success, fetches the user from DB and attaches `PublicUser` to `req.user`.

### Google OAuth 2.0 Strategy

Redirects users to Google, then on callback calls `userService.findOrCreateByGoogleProfile()` to link or create an account.

### JWT Session

After OAuth, a JWT is signed and stored in an **httpOnly cookie** (`token`). Settings:
- `secure` in production
- `sameSite: "lax"`
- `path: "/"`
- 1-hour TTL

### `jwtAuthGuard()`

A factory that returns Express middleware wrapping `passport.authenticate("jwt", { session: false })`. Returns `401` for missing/invalid tokens, `500` for internal auth errors. Used by almost every route module in the backend.

### `PublicUser`

`userService.toPublic()` strips sensitive DB fields and exposes only: `id`, `email`, `name`, `role`, `avatarUrl`, `devMode`.

### Account linking

If a user already exists by email but has no `googleSubjectId`, logging in with Google links the two accounts.
