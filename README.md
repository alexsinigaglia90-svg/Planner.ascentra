# Planner — Ascentra

High-end workforce scheduling platform.

## Stack

- **Next.js 15** (App Router)
- **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Prisma 6** with SQLite (dev) → **Cloudflare D1** (production)

## Project structure

```
src/
├── app/
│   ├── dashboard/       # Dashboard page
│   ├── employees/       # Employees page
│   ├── planning/        # Planning page
│   ├── shifts/          # Shifts page
│   ├── layout.tsx       # Root layout (sidebar shell)
│   ├── page.tsx         # Redirects → /dashboard
│   └── globals.css
├── components/
│   ├── Sidebar.tsx      # App navigation
│   ├── ui/              # Shared primitive components
│   ├── planning/        # Planning-specific components
│   └── employees/       # Employee-specific components
└── lib/
    ├── db/
    │   └── client.ts    # Prisma client (dev) / D1 adapter (prod)
    └── queries/         # Data-access functions by domain

prisma/
└── schema.prisma        # SQLite schema (compatible with Cloudflare D1)
```

## Getting started

```bash
cp .env.example .env
npm install
npm run db:push       # apply schema to local SQLite
npm run dev
```

## Cloudflare D1 (production)

1. Create a D1 database via the Cloudflare dashboard or `wrangler d1 create <name>`
2. Add the binding to `wrangler.toml`
3. Use `getDb(env)` pattern in Server Actions / Route Handlers (see `src/lib/db/client.ts`)
4. Deploy via `@cloudflare/next-on-pages`

