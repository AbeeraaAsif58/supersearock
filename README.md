# CRM App Starter  
 
Next.js starter using:  

- `src/app` directory structure (App Router)
- `shadcn/ui` components 
- Supabase for Auth, Database access and Edge Function invocations 

## 1) Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 2) Configure Supabase

Copy environment variables and update them with your project values:

```bash
cp .env.example .env.local
```

Required env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SMTP_GMAIL_USER` (gmail account for SMTP reminder sending)
- `SMTP_GMAIL_APP_PASSWORD` (gmail app password)
- `REMINDER_EMAIL_FROM` (sender email)

## 3) Setup auth schema (required)

Run SQL from:

- `supabase/schema.sql`

This creates:

- `profiles` table with roles (`admin`, `agent`)
- status modes (`active`, `readonly`, `blocked`)
- single-primary-admin guard
- RLS policies for profile access

## 4) Auth routes

- `/login` (email/password only)
- `/forgot-password` (send reset link)
- `/reset-password` (set new password from email link)
- `/dashboard` (protected user page)
- `/admin/agents` (primary admin only; create/manage agents)

## 5) Project structure

- `src/lib/supabase/client.ts` browser Supabase client
- `src/lib/supabase/server.ts` server Supabase client (cookies/session)
- `src/lib/supabase/admin.ts` service-role client for admin operations
- `src/lib/supabase/middleware.ts` session refresh middleware helper
- `src/lib/supabase/functions.ts` helper to invoke Supabase Edge Functions
- `src/lib/auth/guards.ts` role/status guards
- `middleware.ts` wires middleware for protected/session-aware routes

## 6) shadcn/ui

Initialized and ready. Example components are in `src/components/ui`.

To add more:

```bash
npx shadcn@latest add <component-name>
```

## 7) Phase 7 Realtime + Automation

- Dashboard live updates use Supabase realtime subscriptions (leads, follow-up tasks, profiles).
- Edge Functions included:
  - `automated-reminders` (implemented; sends reminder emails)
  - `assignment-automation` (future scaffold)
  - `scheduled-summary` (future scaffold)

Deploy functions:

```bash
supabase functions deploy automated-reminders
supabase functions deploy assignment-automation
supabase functions deploy scheduled-summary
```

Set function secrets in Supabase:

```bash
supabase secrets set SMTP_GMAIL_USER="your-gmail@gmail.com" SMTP_GMAIL_APP_PASSWORD="your-app-password" REMINDER_EMAIL_FROM="your-gmail@gmail.com"
```
# ai-crm
# ai-crm
# ai-crm
# ai-crm
