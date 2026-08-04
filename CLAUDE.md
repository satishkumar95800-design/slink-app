# School Connect — Monorepo

Multi-tenant school management app: parent fee payments, teacher progress reports, admin finance console.

## Repo layout

```
apps/api          NestJS REST API (Node 22, Prisma 5, PostgreSQL)
apps/web-admin    Next.js 16 admin console (Accounts/Admin staff)
apps/mobile       Flutter 3 mobile app (Parents + Teachers)
packages/types    Shared TypeScript types & DTOs
packages/config   Shared ESLint / Prettier / tsconfig base
infra/            docker-compose (local dev), Terraform (prod)
```

## Prerequisites

- Node 22, pnpm 9
- Docker (for local Postgres + Redis + LocalStack)
- Flutter 3.x (for mobile; not required for API/web work)

## Local dev setup

```bash
pnpm install
pnpm docker:up          # starts postgres:16, redis:7, localstack
cp .env.example apps/api/.env
pnpm db:generate        # runs prisma generate
pnpm db:migrate         # runs prisma migrate dev
pnpm dev                # starts all apps in parallel via Turborepo
```

API runs on http://localhost:3000/v1  
Admin runs on http://localhost:3001  
Health check: GET http://localhost:3000/v1/health

## Key architectural invariants

1. `tenant_id` is NEVER trusted from the request body. It is resolved by `TenantMiddleware` from the `X-Tenant-ID` header or subdomain only.
2. Parent role NEVER queries students directly — always via `student_parents` joined on `parent_id = req.user.id`.
3. Payment webhook handlers MUST verify the gateway HMAC signature before processing. Reject unverified requests with 401.
4. Refresh tokens are stored as bcrypt hashes. The raw token is returned to the client once only.
5. Payment gateway credentials per tenant are stored in AWS Secrets Manager — never in the `tenants` table.
6. All money values: `Decimal` / `NUMERIC(12,2)` in DB; integer paise/pence arithmetic in application code.

## Package manager

pnpm only — never use npm or yarn in this repo.

## Database

PostgreSQL 16. Schema managed by Prisma 5 (pinned — do not upgrade to v6+ until Node 22 compat is confirmed).

After editing `prisma/schema.prisma`:
```bash
pnpm db:migrate    # dev: creates migration + applies it
pnpm db:generate   # regenerates the Prisma client
```

## Feature modules (apps/api/src/modules/)

| Module | Status | Responsibility |
|---|---|---|
| health | done | GET /health |
| tenants | done | Tenant CRUD, branding, feature flags, super_admin + admin self-management |
| auth | done | Phone OTP via Firebase, JWT issue/refresh/revoke |
| users | done | User profiles |
| students | done | Student records, parent linkage |
| fees | done | Fee structures, student fee assignments, offline payments, adjustments |
| payments | done | Razorpay gateway, webhook handler, idempotency |
| reports | done | Teacher → student → parent progress reports, read receipts |
| notifications | done | FCM push (multicast), Twilio SMS, broadcast, audit log, FCM token management |
| files | done | S3 upload/download, presigned URLs, tenant-isolated key paths |

## Tech decisions (do not revisit without discussion)

- **Flutter** over React Native (native rendering, Flutter Flavors for tenant theming)
- **NestJS** over Django (TypeScript end-to-end, first-class Razorpay/Firebase Node SDKs)
- **Prisma 5** over TypeORM/Drizzle (schema-as-source-of-truth, typed client)
- **REST** over GraphQL (screen-driven data, simpler webhook/payment audit surface)
- **Shared tables + tenant_id** over schema-per-tenant (operational simplicity at startup scale)
- **Firebase Phone Auth** for OTP (carrier routing, rate limiting, Android SMS auto-read)
