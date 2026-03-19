# SchoolTime Portal

Browser-based secondary school LMS. Built on Supabase + Netlify + React + Vite.

## Live infrastructure

| Layer       | Service                              | Status |
|-------------|--------------------------------------|--------|
| Database    | Supabase `oiimnofrbfscmpfcarqc`      | ✅ Live |
| Hosting     | Netlify `schooltime-portal`          | ✅ Created |
| App URL     | https://schooltime-portal.netlify.app | ⏳ Deploy needed |

## First deploy (run locally)

```bash
# 1. Unzip and enter the project
unzip schooltime.zip && cd schooltime

# 2. Install, build, deploy (one command)
bash deploy.sh
```

If you don't have Netlify CLI auth set up:
```bash
npm install
npm run build
npx netlify-cli login         # opens browser to authenticate
npx netlify-cli deploy --prod --dir=dist --site=78a91e21-b48f-469c-92c6-1f7ccdf3f410
```

## HOD login (demo school: Gaborone Private Academy)

```
Email:    hod@gpa.ac.bw
Password: Admin@1234
```

**Change this password immediately** after first login:
Supabase Dashboard → Authentication → Users → find `hod@gpa.ac.bw` → Reset password

## Adding a real school

1. Log into [supabase.com](https://supabase.com) → your project → SQL editor
2. Run:
```sql
INSERT INTO schools (name, grading_type, grading_config, terms_per_year, active_term, active_year, sms_sender_id)
VALUES ('Your School Name', 'percentage', '{"pass_mark": 50}', 3, 1, 2026, 'YourSchool');
```
3. Create the HOD auth user via Authentication → Users → Add user
4. Then link them:
```sql
INSERT INTO profiles (id, school_id, role, full_name, id_number)
VALUES ('<auth-user-id>', '<school-id>', 'hod', 'HOD Name', 'HOD-001');
```

## User roles

| Role    | How to create              | What they can do |
|---------|---------------------------|------------------|
| HOD     | Manually in Supabase       | Everything: teachers, students, subjects, reports |
| Teacher | HOD creates from dashboard | Post tasks, mark, enter grades |
| Student | HOD creates from dashboard | Attempt tasks, view grades, portfolio |

## HOD workflow (first day)

1. Log in → Teachers → Add teachers (they get email + temp password)  
2. Students → Add students (parent phone stored for SMS later)  
3. Subjects → Create subjects → Assign teacher → Enroll students  
4. Teachers can now post tasks. Students can now attempt them.  
5. End of term: Reports → Lock term → Review → Publish report cards  

## Environment variables (already set in Netlify)

```
VITE_SUPABASE_URL=https://oiimnofrbfscmpfcarqc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...NrI8
```

## Project structure

```
schooltime/
├── src/
│   ├── contexts/AuthContext.jsx      # Auth + profile session
│   ├── lib/supabase.js               # Supabase client
│   ├── components/
│   │   ├── Layout.jsx                # Sidebar + page wrapper
│   │   ├── Sidebar.jsx               # Role-aware nav
│   │   └── ui/index.jsx              # Shared UI components
│   └── pages/
│       ├── Login.jsx
│       ├── hod/                      # Dashboard, Teachers, Students, Subjects, Reports, Notices
│       ├── teacher/                  # Dashboard, Tasks, TaskDetail, Grades, Leaderboard, Notices
│       └── student/                  # Dashboard, Tasks, Grades, Leaderboard, Portfolio
├── netlify/functions/                # (empty — ready for SMS function later)
├── netlify.toml                      # SPA redirect + build settings
├── vite.config.js
├── tailwind.config.js
└── deploy.sh
```

## SMS (Africa's Talking — Phase 2)

When ready, add to `netlify/functions/send-sms.mts`:
```typescript
import type { Context } from "@netlify/functions"

export default async (req: Request, context: Context) => {
  const { phone, message } = await req.json()
  const res = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      'apiKey': Netlify.env.get('AT_API_KEY'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ username: 'schooltime', to: phone, message })
  })
  return new Response(JSON.stringify(await res.json()))
}

export const config = { path: '/api/send-sms' }
```

Add `AT_API_KEY` to Netlify env vars. Call `/api/send-sms` from the HOD Reports page on publish.
