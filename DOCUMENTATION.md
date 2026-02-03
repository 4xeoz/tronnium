# Tronnium - Security Platform Documentation

## Overview

Tronnium is a modern security platform built with Next.js (frontend) and Express.js (backend). It provides environment-based security monitoring with asset management, vulnerability scanning, and real-time insights.

## Tech Stack

### Frontend
- **Framework**: Next.js 16.0.6 (App Router with Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom theme system
- **Icons**: react-icons (Feather Icons)
- **State Management**: React Context API

### Backend
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Prisma
- **Authentication**: Passport.js (Google OAuth + JWT)

## Project Structure

```
tronnium/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── asset.controller.ts
│   │   │   └── environment.controller.ts
│   │   ├── routes/
│   │   │   ├── index.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── asset.routes.ts
│   │   │   ├── environment.routes.ts
│   │   │   └── health.routes.ts
│   │   ├── services/
│   │   │   ├── user.service.ts
│   │   │   ├── environment.service.ts
│   │   │   └── llm.service.ts
│   │   ├── middleware/
│   │   │   └── logger.ts
│   │   ├── auth/
│   │   │   └── passport.ts
│   │   ├── config/
│   │   │   └── config.ts
│   │   ├── lib/
│   │   │   └── prisma.ts
│   │   ├── app.ts
│   │   └── index.ts
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx             # Root layout with ThemeProvider
│   │   ├── page.tsx               # Landing page
│   │   ├── globals.css            # Global styles & theme variables
│   │   ├── api/
│   │   │   └── logout/route.ts    # Logout API route
│   │   └── environments/
│   │       ├── layout.tsx         # App layout with sidebar
│   │       ├── page.tsx           # Environments list page
│   │       └── [envId]/
│   │           └── dashboard/
│   │               └── page.tsx   # Environment dashboard
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppLayout.tsx      # Main app shell with sidebar
│   │   ├── ui/
│   │   │   └── ThemeToggle.tsx    # Light/dark theme switcher
│   │   └── environments/
│   │       └── CreateEnvironmentSlideOver.tsx
│   ├── lib/
│   │   ├── api/
│   │   │   ├── index.ts           # API exports
│   │   │   ├── client.ts          # Base fetch client
│   │   │   ├── auth.ts            # Auth API functions
│   │   │   ├── environments.ts    # Environment API functions
│   │   │   └── health.ts          # Health check API
│   │   └── UserContext.tsx        # User context provider
│   └── package.json
│
└── DOCUMENTATION.md
```

## Features

### Authentication
- Google OAuth login via Passport.js
- JWT-based session management
- Secure cookie handling
- Auto-redirect after login to `/environments`

### Environments
- Create, read, update, delete environments
- Environment-specific dashboards
- Asset count tracking
- Labels and descriptions
- Search and filter functionality

### UI/UX
- **Theme System**: Light/dark mode with CSS variables
- **Responsive Design**: Mobile-first approach
- **Sidebar Navigation**: Collapsible sidebar with quick actions
- **Stats Dashboard**: Real-time metrics display

## Theme System

The app uses CSS custom properties for theming. Colors are defined in `globals.css`:

```css
:root {
  --color-background: #ffffff;
  --color-surface: #ffffff;
  --color-surface-secondary: #f5f5f5;
  --color-border: #e5e5e5;
  --color-text-primary: #0a0a0a;
  --color-text-secondary: #525252;
  --color-text-muted: #a3a3a3;
  --color-brand-1: #c8ff00;  /* Neon green - primary brand */
  --color-brand-2: #0a0a0a;  /* Dark - contrast for brand */
}

[data-theme="dark"] {
  --color-background: #0a0a0a;
  --color-surface: #171717;
  /* ... dark theme overrides */
}
```

## API Endpoints

### Authentication
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Environments
- `GET /api/environments` - List all environments
- `GET /api/environments/:id` - Get environment by ID
- `POST /api/environments` - Create environment
- `PUT /api/environments/:id` - Update environment
- `DELETE /api/environments/:id` - Delete environment

### Health
- `GET /api/health` - Health check endpoint

## Running the Application

### Prerequisites
- Node.js 18+
- PostgreSQL database (or Supabase account)
- Google OAuth credentials

### Environment Variables

**Backend (.env)**:
```
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
JWT_SECRET=...
FRONTEND_URL=http://localhost:3001
```

**Frontend (.env.local)**:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Development

```bash
# Backend
cd backend
npm install
npm run dev  # Runs on port 4000

# Frontend
cd frontend
npm install
npm run dev  # Runs on port 3001
```

### Production Build

```bash
# Frontend
cd frontend
npm run build
npm start
```

## Design Principles

1. **Clean & Minimal**: Professional, enterprise-grade UI
2. **Consistent**: Reusable components with consistent styling
3. **Accessible**: Proper contrast, focus states, and semantic HTML
4. **Performant**: Server components where possible, optimized client bundles
5. **Type-Safe**: Full TypeScript coverage

## Recent Updates (February 2026)

- Migrated to list-based environment view for cleaner UX
- Added stats row with key metrics
- Implemented dropdown menu for environment actions
- Removed gradients, using subtle solid colors
- Brand color (neon green) reserved for primary buttons only
- Added search functionality with real-time filtering

---

*Last updated: February 3, 2026*
