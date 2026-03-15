# Planner Ascentra

## Working rules

- Always inspect relevant files before changing code.
- Explain the plan briefly before making non-trivial changes.
- Prefer small, targeted edits over large rewrites.
- Preserve the existing architecture unless explicitly asked otherwise.
- After code changes, always run:
  - npm run lint
  - npm run build
  - npm run test
- If a command fails, inspect the root cause and fix it before continuing.
- For UI work, preserve premium styling and avoid regressions.
- Do not make broad refactors without explicit approval.

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript 5**
- **Prisma 6** → PostgreSQL (Neon, production) / Cloudflare D1 (edge)
- **iron-session 8** — encrypted HttpOnly cookie auth (no JWT)
- **bcryptjs 3** — password hashing
- **Tailwind CSS v4** — utility CSS with custom design-system tokens in `globals.css`
- **Framer Motion 12** — animations
- **nodemailer 8** — transactional email with retry queue
- **Vitest 2** — testing

## Project structure

```
src/app/              Routes and route-level logic (App Router)
  api/auth/           Login, logout, forgot-password endpoints
  api/delivery/       Cron-triggered email queue processing
  dashboard/          KPI analytics page
  planning/           2D shift-assignment grid (core feature)
  employees/          Legacy employee CRUD
  workforce/          Employees + Skill Matrix views
  shifts/             Shift template management
  settings/           Users, teams, processes, masterdata, delivery
  audit/              Audit log viewer
  login/              Public login page
  invite/[token]/     Account activation
src/components/       Reusable UI components
  ui/                 Design-system primitives (Button, Card, Table, Toast, etc.)
  planning/           PlanningGrid, OperationsView, AiAssist, Forecast (~27 files)
  settings/           ProcessWizard, DepartmentGraph, TeamsView, etc.
  workforce/          SkillMatrixView, BulkImport, SkillLevelPicker
  employees/          EmployeeTable, EmployeeForm (legacy)
  Sidebar.tsx         App navigation + notification bell
src/lib/              Business logic, auth, data access
  auth/               session.ts, context.ts, bootstrap.ts
  db/client.ts        Prisma singleton (+ D1 adapter for production)
  queries/            Data-access by domain (employees, assignments, teams, etc.)
  email/              service.ts (SMTP queue), templates.ts
  scoring.ts          Candidate recommendation engine
  autofill.ts         Auto-fill shift assignments
  staffing.ts         Staffing analysis & gap detection
  manpower.ts         Demand resolution (requirement → template fallback)
  compliance.ts       Contract-hours & weekly compliance
  teams.ts            Team rotation logic
  analytics.ts        KPI metric computation (pure functions)
  forecasting.ts      Weekday-pattern demand forecast
  ops.ts              OpsSnapshot computation
  audit.ts            Audit log helpers
  notify.ts           In-app notification + email delivery helpers
prisma/schema.prisma  Database schema (15 models)
prisma/migrations/    9 migrations (init → process planning fields)
```

## Database models (key relationships)

- **Organization** → top-level tenant; all data scoped by `organizationId`
- **User** → global account; linked via **OrganizationMembership** (role: admin|planner|viewer)
- **Employee** → belongs to Org; optional Location, Department, EmployeeFunction, Team
- **Skill** / **EmployeeSkill** → many-to-many competency tags
- **Process** / **EmployeeProcessScore** → capability levels 0–4 per process
- **ShiftTemplate** → reusable shift (startTime/endTime as "HH:MM")
- **ShiftRequirement** → org-level demand override per shift
- **RosterDay** → calendar date; **Assignment** → who works which shift on which date
- **Team** → rotation group (ploeg) with anchor date + rotation slots
- **Notification** / **DeliveryLog** → in-app alerts + email queue with retry

## Critical areas

Treat these files/modules with extra care:

- Planning logic (`scoring.ts`, `autofill.ts`, `staffing.ts`, `manpower.ts`, `compliance.ts`)
- Auth/session/context logic (`session.ts`, `context.ts`, `bootstrap.ts`, `middleware.ts`)
- Employee and organization filtering (all queries filter by `organizationId`)
- Team rotation logic (`teams.ts`, `TeamRotationSlot`)
- Prisma data access (all files in `src/lib/queries/`)

## Auth flow

1. Login POST → validate credentials → set iron-session cookie (`userId`, `orgId`)
2. Middleware checks cookie **existence** for protected routes
3. `getCurrentContext()` decrypts cookie → resolves role from OrganizationMembership
4. If session invalid/empty → destroys cookie → redirects to `/login`
5. All queries receive `orgId` from context — never trust client-provided org

## Key commands

```bash
npm run dev            # Start dev server (next dev)
npm run build          # prisma generate + next build
npm run start          # Production server
npm run lint           # ESLint
npm run test           # Vitest

npm run db:generate    # Regenerate Prisma client
npm run db:push        # Push schema to database (no migration)
npm run db:migrate     # Apply migrations (prisma migrate deploy)
npm run db:studio      # Prisma Studio (visual DB browser)
```

## Environment variables

```
DATABASE_URL           PostgreSQL connection string (Neon)
SESSION_SECRET         ≥32 chars for iron-session encryption
SEED_ADMIN_PASSWORD    Bootstrap admin password (default: admin123)
APP_URL                Base URL for email links
SMTP_HOST/PORT/USER/PASS/MAIL_FROM   Email delivery
CRON_SECRET            Bearer token for /api/delivery/process
```

## Default login (dev)

- Email: `admin@default.local`
- Password: value of `SEED_ADMIN_PASSWORD` env var (or `admin123`)
