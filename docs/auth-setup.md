# Supabase Auth setup

Three settings live in the Supabase dashboard, not in this repo. The code in
`infra/pre-testers` assumes all three. Until they are applied, sign-in works in
the same partial way it does today.

Project `jnytmankztlqozolizdt` → **Authentication**.

---

## Why this document exists

`+tom2`: `email_confirmed_at` 14:28:55, `last_sign_in_at` **null**, zero rows in
`auth.sessions`. `+tom3`, 2026-08-08 07:08:32: `/verify` returned 303 with
`action: login`, then `POST /token` with `grant_type=pkce` returned **400
`bad_code_verifier`** — *"code challenge does not match previously saved code
verifier"*.

Read those together and the shape is clear: **Auth signed the user in; the app
could not exchange the code.** The one-time token was consumed either way, so the
user ended up with neither a session nor a usable link.

The cause is not the device. It is the **origin**. The PKCE verifier is written
to browser storage on the origin that requested the link. The link came back to
`SITE_URL` = `https://studsly.vercel.app`, a different origin, where that
verifier does not exist. Different origin ⇒ the exchange cannot succeed, on any
device.

And the app was already sending the right thing: `signInWithOtp` has passed
`emailRedirectTo: ${window.location.origin}/auth/callback` since `c8277dc`. That
is what §2 below is about — **Supabase silently substitutes `SITE_URL` when the
requested `redirect_to` is not on the allowlist.** An allowlist that does not
cover the preview hosts turns a correct request into a cross-origin failure.

So: §2 is the fix for the bug. §1 and §3 are what make the fix survive someone
opening the mail on their phone.

---

## 1. Email template — lead with the code

**Authentication → Emails → Magic Link.**

Subject:

```
Your Studsly sign-in code
```

Body — replace the template wholesale:

```html
<h2 style="font:600 18px/1.3 system-ui,sans-serif;color:#111827;margin:0 0 8px">
  Sign in to Studsly
</h2>

<p style="font:400 14px/1.5 system-ui,sans-serif;color:#4b5563;margin:0 0 20px">
  Enter this code in the browser where you asked to sign in:
</p>

<p style="font:700 40px/1.1 system-ui,sans-serif;letter-spacing:10px;
          color:#111827;background:#f3f4f6;border-radius:12px;
          padding:20px 12px;text-align:center;margin:0 0 20px">
  {{ .Token }}
</p>

<p style="font:400 13px/1.5 system-ui,sans-serif;color:#6b7280;margin:0 0 24px">
  The code works from any device — read this on your phone and type it on your
  laptop if that is easier. It expires in about an hour and works once.
</p>

<hr style="border:0;border-top:1px solid #e5e7eb;margin:0 0 20px">

<p style="font:400 13px/1.5 system-ui,sans-serif;color:#6b7280;margin:0 0 8px">
  Or open this link instead:
</p>

<p style="margin:0 0 24px">
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email"
     style="font:600 14px/1 system-ui,sans-serif;color:#2E5FA3">
    Sign in to Studsly
  </a>
</p>

<p style="font:400 12px/1.5 system-ui,sans-serif;color:#9ca3af;margin:0">
  Didn't request this? Ignore this email — nothing will happen.
</p>
```

Two things matter here and both are deliberate:

- **`{{ .Token }}` leads.** It is the only path that does not care where the mail
  is read. The link is the alternative, not the headline.
- **The link points at `/auth/confirm`, not `/auth/callback`.** `/auth/confirm`
  calls `verifyOtp` with `token_hash` on the *server*. No PKCE verifier is
  involved, so it works from any device — including the phone case that broke
  `+tom2`. Do not change it back to a `{{ .ConfirmationURL }}` link; that is the
  PKCE path and it reintroduces the bug.

## 2. Redirect allowlist — this is the actual bug fix

**Authentication → URL Configuration → Redirect URLs.**

Add all three:

```
https://studsly-*-christian-stenbo-s-projects.vercel.app/**
https://www.studsly.com/**
http://localhost:3000/**
```

⚠️ **Never add `https://*.vercel.app/**`.** That wildcard covers every Vercel
deployment on the internet, so anyone's project could be handed a Studsly token.
Scope it to the team subdomain, exactly as written above.

When a requested `redirect_to` is **not** on this list, Supabase does not error —
it quietly substitutes `SITE_URL`. That substitution is what sent `+tom3`'s link
to `studsly.vercel.app` while the verifier sat on the preview origin.

## 3. Site URL

**Authentication → URL Configuration → Site URL.**

```
https://studsly-git-infra-pre-testers-christian-stenbo-s-projects.vercel.app
```

`SITE_URL` is two things: the `{{ .SiteURL }}` in the template above, and the
fallback when a `redirect_to` is rejected. Both should point at the surface
testers actually use (see [deploys.md](deploys.md)). Pointing it at
`studsly.vercel.app` — a `main` build with every flag off — means a fallback
lands a tester on an app that looks broken to them.

Move it to `https://www.studsly.com` when this batch merges to `main`.

---

## Verifying it

After applying all three, in order:

1. **Code, same browser.** Request a code, type it in the same browser. Expect a
   session. `select last_sign_in_at from auth.users where email = …` is set, and
   `select count(*) from auth.sessions where user_id = …` is ≥ 1.
2. **Link, different device.** Request on a laptop, open the emailed link on a
   phone. Expect the phone signed in. This is the test `+tom2` failed.
3. **Link, same browser (regression).** Request and click in the same browser.
   The PKCE path must still work — it is untouched by design.
4. **Cross-origin link (negative).** Request on `localhost:3000`, open the link
   on the preview host. Expect a named error and the code field already open —
   not "Access denied", and not a dead end.

The built-in Supabase sender allows roughly **two emails an hour**. Space these
out; hammering the endpoint just rate-limits you and proves nothing.

## What is in code, not here

- `emailRedirectTo` is always `${window.location.origin}/auth/callback`, set
  explicitly at `signInWithOtp` — `SITE_URL` is never relied on
  (`app/login/login-form.tsx`).
- `/auth/confirm` — server-side `verifyOtp`, no PKCE, any device.
- `/auth/callback` — unchanged PKCE path, plus a `token_hash` branch for links
  already in inboxes. On failure it redirects to `/login` with a named cause and
  never falls back to another provider.
- `lib/auth-errors.ts` — one classifier for every auth failure. Expired, used,
  wrong code, incomplete code, rate-limited, network, cross-origin and
  missing-token each get their own message; "something went wrong" is reserved
  for what genuinely cannot be classified.
