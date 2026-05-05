# users

Thin data-access layer for managing `UserAccount` records.

## Purpose

Centralizes all Prisma queries related to users and exposes a singleton service (`userService`) that other modules consume. Handles:
- Reading users by ID, email, or Google subject ID
- Google OAuth user provisioning (create-or-update / account-linking)
- Stripping sensitive fields to produce a `PublicUser` view
- Toggling developer mode
- Updating profile information
- Deleting users

## Files

| File | Role |
|------|------|
| `user.service.ts` | Defines the `UserService` class and exports singleton `userService`. All Prisma CRUD for `UserAccount`. |

## How it links together

```
authentication/passport.ts
  → userService.findById() (for JWT validation)
  → userService.findOrCreateByGoogleProfile() (for Google OAuth)
  → userService.toPublic() (for PublicUser on req.user)

authentication/auth.controller.ts
  → userService.findById() (for fresh profile data)
  → userService.toggleDevMode()
  → userService.toPublic()
```

## Key concepts

### `UserService` methods

| Method | Logic |
|--------|-------|
| `findById(id)` | `prisma.userAccount.findUnique({ where: { id } })` |
| `findByEmail(email)` | `prisma.userAccount.findUnique({ where: { email } })` |
| `findByGoogleSubjectId(googleSubjectId)` | `prisma.userAccount.findUnique({ where: { googleSubjectId } })` |
| `findOrCreateByGoogleProfile(profile)` | 1. Check by `googleSubjectId` → update name/avatar.<br>2. Else check by email → **link** Google account.<br>3. Else **create** new user with `role: "user"`. |
| `toPublic(user)` | Maps `UserAccount` → `PublicUser` (strips secrets). |
| `toggleDevMode(id)` | Reads current `devMode`, flips boolean. |

### `PublicUser`

The canonical safe representation returned by API endpoints:
```ts
interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl?: string | null;
  devMode: boolean;
}
```

### Account linking

If a user exists by email but has no `googleSubjectId`, logging in with Google links the two accounts automatically.
