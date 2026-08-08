# Where to test Studsly, and why a button is grey

If you are new to this project and someone asked you to try Studsly, read the
first two sections and stop. The rest is for whoever maintains the deploys.

---

## 1. The test surface

**Test here:**

```
https://studsly-git-infra-pre-testers-christian-stenbo-s-projects.vercel.app
```

That is the `infra/pre-testers` branch. It is the only surface where sign-in, the
empty states and the Phase 1b flows are all current at once. Nothing else is a
test surface, whatever it looks like.

You do not need a Vercel account. Deployment Protection is off. Sign in with your
email: you get a six-digit code and a link, and either one works — the code works
even if you read the mail on a different device from the one you asked on.

## 2. Why a button is grey

A grey button or a "Coming soon" tile means one of exactly two things, and they
are not the same thing:

**a) The flow is built, but not switched on for you.** Every Phase 1b flow sits
behind a feature flag. Flags are off by default, including in production, and are
turned on per person. Ask to be added and you will be — it takes one database
insert and no new deploy (see §5). Once added, reload the page.

**b) The flow is not built yet.** Some tiles say "Coming soon" with no flag
behind them at all. Those are genuinely not written.

Which is which, as of 2026-08-08:

| Surface | Behind a flag? | State |
|---|---|---|
| Collection ▸ Individual parts (free pool) | `FF_POOL` | Built |
| Set ▸ Contents & condition (CIB) | `FF_COMPONENTS` | Built |
| Set ▸ inline Parts/Figures, MOD editor | `FF_MOD` | Built |
| Register ▸ Individual parts | `FF_POOL` | Built |
| Register ▸ Instructions or a box | `FF_COMPONENTS` | Built |
| Register ▸ A MOC | — | **Not built.** No flag; the tile is inert |
| Buy list, CMF, value ledger | `FF_BUYLIST`, `FF_CMF`, `FF_VALUE_LEDGER` | **Not built.** Flags reserved, no UI |

Every page shows an environment badge in the header carrying the branch kind, the
flags that are on for you, and the short commit SHA. Paste that SHA into any bug
report — it is the only unambiguous way to say which build you saw.

---

## 3. The surfaces

Four URLs are in circulation. They run different code and different flags, which
is how a working feature came to be reported as missing.

| URL | Branch | Flags | Use it for |
|---|---|---|---|
| `www.studsly.com` | `main` | all off | Production. Not a test surface. |
| `studsly.vercel.app` | `main` | all off | Vercel's default alias for the same `main` build as above. **Not a separate app**, and not a test surface. |
| `studsly-git-infra-pre-testers-…` | `infra/pre-testers` | per-person | **The test surface.** |
| `studsly-git-preview-flow1-pool-…` | `preview/flow1-pool` | on for the owner's email | Stale. Superseded — see §6. |

`…` is `christian-stenbo-s-projects.vercel.app` in every case.

### The trap this table exists to prevent

`studsly.vercel.app/register` showed "COMING SOON" on Individual parts,
Instructions/box and MOC, and that was read as *those features are missing*. Two
separate things were true:

- `studsly.vercel.app` **is** `main`, where every flag is off by design. So flagged
  flows are correctly invisible there. It is not a preview of anything.
- The three register tiles were **hardcoded** "Coming soon" with no flag check at
  all — so they read the same on every surface, flags on or off. Two of the three
  are now flag-gated properly; MOC is still genuinely unbuilt.

Flows 1 (free pool, `b794072`, M10+M11), 2 (MOD, `5a83d4c`) and 3 (contents/CIB,
`afc451d`) have been on `main` since 21–28 July. They were never missing.

### The host must not change while you navigate

Reported 2026-08-08: starting on a preview deploy and navigating internally
ended up on production, where every flag is off — so the preview deploys could
not be tested at all beyond their landing page.

**It is not coming from app code.** That was checked and measured, not assumed:

- No hardcoded host exists anywhere in `web/` — no `studsly.com`, no
  `studsly.vercel.app`, no absolute `href`, `router.push` or `redirect`. Every
  internal link is a relative `<Link href="/…">`. `next.config.ts` is empty and
  no environment variable sets a base URL.
- Every server redirect emits a **relative** `Location`. Measured against the
  running app: the middleware auth gate returns `Location: /login`, and
  `/auth/callback` and `/auth/confirm` return `/login?error=…`.
- Those stay relative **with `Host` and `x-forwarded-host` both spoofed to
  `www.studsly.com`**. A proxy cannot rewrite a host that is not in the response.
- Unauthenticated navigation on the preview host was walked through in a browser:
  `/register` and `/collection` both redirected to `/login` on the preview host,
  never leaving it.

That leaves two causes outside this repo, in order of likelihood:

1. **Supabase substituting `SITE_URL` at sign-in.** If the preview host is not on
   the redirect allowlist, Supabase does not error — it silently redirects to
   `SITE_URL`, currently `https://studsly.vercel.app`. Sign-in then *completes*
   on that host and sets the session cookie there, so everything after the
   landing page is production. This matches the reported symptom exactly, and it
   is the same root cause as the magic-link failure. Fixed by
   [auth-setup.md §2 and §3](auth-setup.md) — allowlist the preview hosts and
   point `SITE_URL` at the test surface.
2. **A Vercel domain-level redirect** to the production domain. Check
   Project → Settings → Domains for a redirect on the `.vercel.app` domains.

Apply §2/§3 of auth-setup.md first, then re-run the acceptance check below. If
the host still changes after that, it is cause 2 and it is in the Vercel
dashboard.

**Acceptance:** from a preview URL, navigate Home → Collection → Register →
Insights → a set → back, and the host in the address bar never changes.

---

## 4. Branches

| Branch | Pushed | Contains |
|---|---|---|
| `main` | yes | Phase 1a + Flows 1–3. Auto-deploys to production. |
| `infra/pre-testers` | yes | `main` + magic-link/OTP sign-in, empty states, onboarding, this batch |
| `preview/flow1-pool` | yes | `main` + a Flow 1 test checklist. Nothing else. |
| `flow4-components` | **no — local only** | `main` + the Flow 4 registration UI (`81e0e2d`) |

`flow4-components` never left one laptop. That is why Flow 4 was "reported built"
while `object_components.linked` sat at 0: the code was real, and no deployed
surface had it. It is cherry-picked into `infra/pre-testers` as part of this batch.

---

## 5. Turning a flag on for someone

`NEXT_PUBLIC_FF_*` and `NEXT_PUBLIC_FF_ALLOWLIST` are `NEXT_PUBLIC_` variables:
Next.js inlines them into the bundle **at build time**. Editing them in Vercel
does nothing until the next deploy. (A server-only Vercel variable is no better —
that also needs a redeploy.) So the env vars cannot admit a tester.

The `feature_access` table (migration M15) is the switch that can:

```sql
-- Everything on for one tester. Live on their next request; no deploy.
insert into feature_access (email, note)
values ('tester@example.com', 'Pre-tester round 1');

-- Or grant exactly one flow:
insert into feature_access (email, flags) values ('x@y.com', '{FF_POOL}');

-- Revoke:
delete from feature_access where lower(email) = lower('tester@example.com');
```

`flags = '{}'` (the default) means every flag — the normal case for a tester.
Resolution order is in `web/lib/flags.ts`: env var, **or** `feature_access` row,
**or** the legacy `NEXT_PUBLIC_FF_ALLOWLIST`. Any one is enough. The legacy list
still works; it just cannot be changed without a rebuild, so do not use it for new
testers.

RLS lets a signed-in user read only their own row. Writes go through the SQL
editor or the service role — there is no API path to grant yourself a flag.

---

## 6. Proposal: consolidate to two surfaces

Not a decision. Merging to `main` is the CEO's call and nothing here has been
merged.

**Retire `preview/flow1-pool`.** It is `main` plus a checklist document. It
carries no code that `main` lacks, its flags-on-for-owner setup is now handled
better by `feature_access`, and its existence is a large share of the confusion
this document is fixing. Deleting the branch removes the URL.

**Merge `flow4-components` into `infra/pre-testers`, then delete it.** Already
done for the Flow 4 commit in this batch. The branch has no other reason to exist,
and leaving unpushed work on a laptop is how Flow 4 got lost the first time.

**Keep `main` and `infra/pre-testers`, and nothing else.** `main` is production
with flags off; `infra/pre-testers` is the one place testers go. When this batch
has been tested end-to-end, `infra/pre-testers` merges into `main` — flags stay
off on merge, so production behaviour does not change on the day it lands, and
individual testers keep their access through `feature_access`.

**Point `SITE_URL` at the test surface, not at `studsly.vercel.app`.** See
`docs/auth-setup.md`. `SITE_URL` is the fallback Supabase uses when a magic
link's `redirect_to` is not on the allowlist, and the mismatch between the
requesting origin and that fallback is what broke the `+tom3` sign-in.
