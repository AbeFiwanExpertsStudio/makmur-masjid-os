# 🕌 Project Makmur — Beginner's Guide

> A complete explanation of how this project works, written for someone new to Next.js.

---

## 🗂️ Table of Contents

1. [What Languages Are Used?](#1-what-languages-are-used)
2. [Frontend vs Backend — Where is Everything?](#2-frontend-vs-backend--where-is-everything)
3. [File Map — What Each File Does](#3-file-map--what-each-file-does)
4. [Files You Should NOT Touch](#4-files-you-should-not-touch)
5. [How Next.js Works (Simple Explanation)](#5-how-nextjs-works-simple-explanation)
6. [How to Start the System](#6-how-to-start-the-system)
7. [How to Connect the Missing Backend Wiring](#7-how-to-connect-the-missing-backend-wiring)

---

## 1. What Languages Are Used?

This project uses **3 languages / technologies**:

| Language | Where | What It Does |
|----------|-------|--------------|
| **TypeScript (.tsx, .ts)** | `src/` folder | The main language. Like JavaScript but safer. Builds all the pages and logic. |
| **CSS** | `src/app/globals.css` | Controls colours, fonts, layout, animations (the look). |
| **Python (.py)** | `ai-predictor/` folder | A separate mini program that predicts crowd size using AI/ML. |
| **SQL** | `supabase/*.sql` | Database instructions. Used to create tables in Supabase (your database). |

> **TSX** = TypeScript + JSX (HTML inside JavaScript). This is how React components are written.

---

## 2. Frontend vs Backend — Where is Everything?

In Next.js, **frontend and backend live in the SAME project**. This is the key thing that confuses beginners.

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR BROWSER (What users see)                 │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              FRONTEND  (src/app/*.tsx files)            │   │
│   │   The HTML pages, buttons, forms, maps, QR codes        │   │
│   │   Written in TypeScript + React (TSX)                   │   │
│   └────────────────────────────┬────────────────────────────┘   │
└────────────────────────────────┼───────────────────────────────┘
                                 │ sends/receives data
             ┌───────────────────┼────────────────────┐
             │                   │                    │
    ┌────────▼──────┐   ┌────────▼──────┐   ┌────────▼──────┐
    │  SUPABASE     │   │  AI Predictor │   │  (Future)     │
    │  (Database +  │   │  Python/Fast  │   │  Stripe API   │
    │   Auth)       │   │  API :8000    │   │  Payments     │
    │               │   │               │   │               │
    │  This IS your │   │  This is a    │   │  Not built    │
    │  backend!     │   │  separate     │   │  yet          │
    │  Supabase     │   │  mini-server  │   │               │
    │  runs it for  │   │  you run      │   │               │
    │  you online.  │   │  yourself     │   │               │
    └───────────────┘   └───────────────┘   └───────────────┘
```

### 🟢 FRONTEND (what users see in the browser)
**Location:** `src/app/` and `src/components/`

These are the **pages and visual components**. They display data on screen and handle clicks/forms. Every file ending in `page.tsx` is a webpage.

| File | What Users See |
|------|---------------|
| `src/app/page.tsx` | The home page (Hero, live stats, feature cards) |
| `src/app/e-kupon/page.tsx` | The food coupon page |
| `src/app/gigs/page.tsx` | The volunteer gigs page |
| `src/app/crowdfunding/page.tsx` | The fundraising page |
| `src/app/zakat/page.tsx` | The Zakat map page |
| `src/app/dashboard/page.tsx` | The AI crowd dashboard |
| `src/app/admin/page.tsx` | The admin control panel |

### 🔵 BACKEND (the data & logic behind the scenes)

This project uses **Supabase as the backend**. Supabase is a service (like Firebase) that gives you:
- **Database** (PostgreSQL) — stores all data (kupons, gigs, donations, users)
- **Authentication** — handles login, signup, anonymous users
- **Real-time** — pushes live updates (e.g., remaining kupon count) to all browsers instantly
- **Security (RLS)** — controls who can read/write which data

You **do not write a traditional backend server** for this project. Supabase handles it.

The only "backend code you wrote yourself" is the **AI Predictor** in the `ai-predictor/` folder (Python).

---

## 3. File Map — What Each File Does

```
makmur-masjid-os/
│
├── 📁 src/app/                    ← ALL YOUR PAGES LIVE HERE
│   ├── layout.tsx                 ← The "shell" that wraps EVERY page (Navbar + Footer)
│   ├── globals.css                ← All colours, buttons, card styles for the whole app
│   ├── page.tsx                   ← HOME page ( / )
│   ├── e-kupon/page.tsx           ← FOOD COUPON page ( /e-kupon )
│   ├── gigs/page.tsx              ← VOLUNTEER page ( /gigs )
│   ├── crowdfunding/page.tsx      ← FUNDRAISING page ( /crowdfunding )
│   ├── zakat/page.tsx             ← ZAKAT MAP page ( /zakat )
│   ├── dashboard/page.tsx         ← AI DASHBOARD page ( /dashboard )
│   └── admin/page.tsx             ← ADMIN PANEL page ( /admin )
│
├── 📁 src/components/             ← REUSABLE BUILDING BLOCKS
│   ├── auth/AuthModal.tsx         ← The login/signup popup
│   ├── layout/Navbar.tsx          ← The top navigation bar
│   ├── layout/BottomNav.tsx       ← The bottom tab bar (mobile only)
│   ├── providers/AuthContext.tsx  ← Manages who is logged in (used everywhere)
│   ├── providers/GuestProvider.tsx← Helper for anonymous session
│   └── zakat/MapComponent.tsx     ← The Leaflet map (only used in /zakat)
│
├── 📁 src/hooks/                  ← "SMART FUNCTIONS" that fetch live data
│   ├── useLiveStats.ts            ← Fetches homepage stats (pack count, volunteers, etc.)
│   └── useLiveFoodEvents.ts       ← Fetches & listens for live food event updates
│
├── 📁 src/lib/                    ← HELPER UTILITY FUNCTIONS
│   ├── ai/getAiPrediction.ts      ← Calls Python AI predictor API
│   ├── mutations/claims.ts        ← claimKupon() and claimGig() functions
│   └── supabase/client.ts         ← Creates the Supabase connection (used everywhere)
│
├── 📁 ai-predictor/               ← PYTHON AI SERVER (run separately)
│   ├── main.py                    ← The AI crowd prediction server
│   └── requirements.txt           ← Python packages to install
│
├── 📁 supabase/                   ← DATABASE SETUP FILES
│   ├── schema.sql                 ← Run this ONCE in Supabase to create all tables
│   └── seed.sql                   ← Sample data for testing
│
├── 📁 public/                     ← STATIC FILES (images, icons)
│   └── manifest.json              ← PWA settings (for install-to-phone)
│
├── .env.local                     ← 🔑 YOUR SECRET KEYS (create this yourself!)
├── package.json                   ← List of all npm packages used
├── next.config.ts                 ← Next.js settings
└── tsconfig.json                  ← TypeScript settings
```

---

## 4. Files You Should NOT Touch

Some files are **auto-generated or configuration files** that you should leave alone unless you know exactly what you're doing.

### ❌ DO NOT TOUCH — Auto-generated or System Files

| File/Folder | Why? |
|-------------|------|
| `package-lock.json` | Auto-generated by npm. It records exact versions of every package. Never edit manually. |
| `.git/` folder | Git version history. Touching this can break your project history. |
| `node_modules/` folder | All the installed packages. Never edit these. Re-run `npm install` if missing. |
| `.next/` folder | Next.js build cache. Auto-generated. Delete and re-run `npm run dev` if weird. |
| `tsconfig.json` | TypeScript settings. Leave as-is unless you're a TypeScript expert. |
| `next.config.ts` | Next.js config. Only touch if you need to add image domains or redirects. |
| `eslint.config.mjs` | Code style checker. Leave as-is. |
| `postcss.config.mjs` | TailwindCSS processor. Leave as-is. |

### ⚠️ CAREFUL — Touch only if you understand the impact

| File | Why Be Careful? |
|------|----------------|
| `src/app/globals.css` | This CSS affects EVERY page. One wrong change breaks the entire look. |
| `src/app/layout.tsx` | This wraps EVERY page. Breaking it breaks all pages. |
| `src/components/providers/AuthContext.tsx` | This manages login state for the whole app. Bugs here affect every page. |
| `supabase/schema.sql` | This modifies your database. Running it incorrectly can delete data. |
| `src/lib/supabase/client.ts` | This is the database connection. Don't change it. |

### ✅ SAFE TO EDIT — Your main working files

Everything in `src/app/*/page.tsx` — these are your pages and safe to edit.

---

## 5. How Next.js Works (Simple Explanation)

Think of Next.js like a **smart file organizer for webpages**.

### Rule 1: Folder = URL

The folder structure inside `src/app/` maps directly to website URLs:

```
src/app/page.tsx              → yourdomain.com/
src/app/e-kupon/page.tsx      → yourdomain.com/e-kupon
src/app/gigs/page.tsx         → yourdomain.com/gigs
src/app/zakat/page.tsx        → yourdomain.com/zakat
src/app/dashboard/page.tsx    → yourdomain.com/dashboard
src/app/admin/page.tsx        → yourdomain.com/admin
```

**To add a new page**, just create a new folder with a `page.tsx` inside it. That's it!

### Rule 2: layout.tsx wraps everything

`src/app/layout.tsx` is like a picture frame. Every page loads inside it. This is where the Navbar and BottomNav live — that's why they appear on every page automatically.

### Rule 3: "use client" vs Server Components

You'll see `"use client"` at the top of most files in this project. This means:
- **`"use client"`** → The code runs in the **user's browser** (can use clicks, state, hooks)
- **No `"use client"`** → The code runs on the **server** before sending HTML to the browser

In this project, almost everything is `"use client"` because the pages need user interaction.

### Rule 4: Components are like custom HTML tags

When you see `<Navbar />` or `<AuthModal />` in code, those are **components** — reusable pieces of UI. They're defined in `src/components/` and imported where needed.

### Rule 5: Hooks are smart data-fetchers

Functions that start with `use` (like `useAuth()`, `useLiveStats()`) are called **React Hooks**. They run automatically and give your component live data. When the data changes, the component re-renders.

---

## 6. How to Start the System

### Step 1 — Get your Supabase keys

1. Go to [supabase.com](https://supabase.com) and open your project
2. Go to **Settings → API**
3. Copy the **Project URL** and the **anon/public key**

### Step 2 — Create your `.env.local` file

In the project root folder (`makmur-masjid-os/`), create a new file called **`.env.local`**

Paste this inside:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_AI_API_URL=http://localhost:8000
```

Replace the values with your actual Supabase URL and key.

> ⚠️ This file is already in `.gitignore`. It will NOT be pushed to GitHub. Good — it contains secret keys.

### Step 3 — Set up your database

1. Go to your **Supabase Dashboard → SQL Editor**
2. Click **"New Query"**
3. Open the file `supabase/schema.sql` in this project
4. Copy ALL the content and paste it into the SQL editor
5. Click **Run**
6. (Optional) Do the same with `supabase/seed.sql` to add sample data

### Step 4 — Install dependencies

Open a terminal in the project folder and run:
```bash
npm install
```

### Step 5 — Start the website

```bash
npm run dev
```

Open your browser and go to: **http://localhost:3000**

The site is now running! 🎉

### Step 6 (Optional) — Start the AI Predictor

In a **second terminal window**:
```bash
cd ai-predictor
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The AI predictor is now running at: **http://localhost:8000**

### Step 7 — Make yourself an admin

1. Visit `http://localhost:3000` and click **Sign Up** to create an account with your email
2. Go to **Supabase Dashboard → SQL Editor** and run this (replace the email):
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'your-email@example.com';
```
3. Sign out and sign back in — you'll now see the **Dashboard** and **Admin Panel** cards

---

## 7. How to Connect the Missing Backend Wiring

There are **4 features** that have the UI built but are not yet connected to real data/services. Here's how to connect each one.

---

### 🔌 Wiring #1 — Connect AI Dashboard to the Real AI Predictor

**Problem:** The dashboard (`/dashboard`) shows hardcoded values (Tier 2, 87%, etc.)

**File to edit:** `src/app/dashboard/page.tsx`

**Step 1:** Import the AI function at the top of the file:
```typescript
import { getAiCrowdPrediction } from "@/lib/ai/getAiPrediction";
```

**Step 2:** Add state to store the prediction result, and add a "Predict" button handler:
```typescript
const [prediction, setPrediction] = useState<any>(null);
const [isPredicting, setIsPredicting] = useState(false);

const handlePredict = async () => {
  setIsPredicting(true);
  try {
    const result = await getAiCrowdPrediction(selectedDate, 1, isWeekend);
    setPrediction(result);
  } catch (err) {
    console.error("AI error:", err);
  }
  setIsPredicting(false);
};
```

**Step 3:** Add a button to the date picker card, and replace the hardcoded values:
```tsx
<button onClick={handlePredict} className="w-full py-3 btn-primary mt-4 text-sm">
  {isPredicting ? "Predicting..." : "Run AI Forecast"}
</button>

{/* Replace "2" with prediction?.predicted_tier */}
{/* Replace "87%" with prediction?.confidence */}
{/* Replace "500 Iftar packs" with prediction?.recommendation */}
```

> ✅ **AI Predictor must be running** (`uvicorn main:app --port 8000`) for this to work.

---

### 🔌 Wiring #2 — Connect Volunteer Gigs to Supabase Database

**Problem:** The gigs page (`/gigs`) uses hardcoded mock data in the file.

**File to edit:** `src/app/gigs/page.tsx`

**Step 1:** Remove the `initialGigs` constant (the hardcoded list at the top).

**Step 2:** Replace with a Supabase fetch inside `useEffect`:
```typescript
import { createClient } from "@/lib/supabase/client";

// Inside the component:
const [gigs, setGigs] = useState([]);

useEffect(() => {
  const supabase = createClient();
  supabase
    .from("volunteer_gigs")
    .select("*, gig_claims(count)")
    .then(({ data }) => {
      if (data) setGigs(data);
    });
}, []);
```

**Step 3:** Make the "Add Gig" modal actually save to Supabase. In `AddGigModal`, replace the fake `setTimeout` in `handleSave`:
```typescript
const supabase = createClient();
const { error } = await supabase.from("volunteer_gigs").insert({
  title,
  description,
  required_pax: parseInt(requiredPax) || 10,
  created_by: user.id,  // need to pass user from props
});
if (error) { alert(error.message); return; }
```

---

### 🔌 Wiring #3 — Connect Admin Broadcast to Supabase

**Problem:** The broadcast box in `/admin` just calls `alert()` — no data is saved.

**File to edit:** `src/app/admin/page.tsx`

**Replace** the broadcast button onClick with this:
```typescript
const handleBroadcast = async () => {
  if (!broadcastMsg.trim()) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("system_broadcasts")
    .insert({ message: broadcastMsg, is_active: true });
  if (error) {
    alert("Failed: " + error.message);
  } else {
    alert("Broadcast sent!");
    setBroadcastMsg("");
  }
};
```

> The database trigger `trg_deactivate_old_broadcasts` automatically deactivates any old broadcasts when a new one is inserted. This is already set up in your `schema.sql`.

---

### 🔌 Wiring #4 — Connect Admin QR Scanner to Supabase

**Problem:** The scanner in `/admin` only updates local state. No database record is marked as scanned.

**File to edit:** `src/app/admin/page.tsx`

**Replace** the `handleScan` function with this:
```typescript
const handleScan = async () => {
  if (!scanInput.trim()) return;
  const supabase = createClient();
  
  // Call the scan_kupon database function
  const { data, error } = await supabase.rpc("scan_kupon", {
    p_claim_id: scanInput,  // user must enter their claim UUID
  });

  if (error) {
    setScanHistory(prev => [{ id: scanInput, status: "❌ Error" }, ...prev]);
  } else if (data?.success) {
    setScanHistory(prev => [{ id: scanInput, status: "✅ Scanned" }, ...prev]);
  } else {
    setScanHistory(prev => [{ id: scanInput, status: "⚠️ " + data?.error }, ...prev]);
  }
  setScanInput("");
};
```

> The `scan_kupon` PostgreSQL function is already written in your `schema.sql`. It marks the kupon as scanned AND decrements `remaining_capacity` in `food_events` automatically.

---

## Quick Reference Cheat Sheet

```
COMMAND                  WHAT IT DOES
─────────────────────────────────────────────────────
npm run dev              Start the website (localhost:3000)
npm run build            Build for production
npm run lint             Check for code errors

uvicorn main:app         Start AI predictor (localhost:8000)
  --reload --port 8000

NEXT.JS RULE: folder = URL
  src/app/gigs/page.tsx  →  /gigs
  src/app/zakat/page.tsx →  /zakat

TO ADD A NEW PAGE:
  1. Create folder: src/app/my-page/
  2. Create file:   src/app/my-page/page.tsx
  3. Add "use client" at top
  4. Export default function MyPage() { return <div>Hello</div> }
  5. Visit: localhost:3000/my-page  ✅

SUPABASE:
  createClient()         → get DB connection
  .from("table_name")    → select a table
  .select("*")           → get all rows
  .insert({ ... })       → add a row
  .update({ ... })       → change a row
  .eq("column", value)   → filter rows
```

---

*Project Makmur — Mosque OS · Ramadan 1447H*
