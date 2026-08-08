# Studsly

We count studs, not bricks. A LEGO collection tracker where the atomic unit is
the part: every part is either free, or locked inside something assembled.

Next.js 15 · Supabase Postgres 17 (`jnytmankztlqozolizdt`) · Tailwind v4.

## Start here

| | |
|---|---|
| **Where do I test, and why is that button grey?** | [docs/deploys.md](docs/deploys.md) |
| **Sign-in / magic link / Supabase Auth setup** | [docs/auth-setup.md](docs/auth-setup.md) |
| Deploy checklist | [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) |

## Layout

```
web/      Next.js app — the product
db/       Numbered SQL migrations, applied in order
sync/     Excel + BrickLink price sync (Python)
app/      Legacy FastAPI service
```

## Working on it

```bash
cd web && npm install && npm run dev
```

Copy `web/.env.local.example` to `web/.env.local` and fill it in.

Two things that bite:

- **Preview and production share one live database.** A migration is live the
  moment it runs, whatever branch you are on. Migrations merge with their code.
- **Every Phase 1b flow is behind a feature flag**, off by default everywhere
  including production. Turn one on for a person with one insert into
  `feature_access` — no redeploy. See [docs/deploys.md](docs/deploys.md#5-turning-a-flag-on-for-someone).
