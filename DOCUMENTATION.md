# 📖 Project Makmur — Mosque OS: Complete Documentation & Developer Manual

> **Version:** 0.1.0 · **Stack:** Next.js 16 · TypeScript · Supabase · TailwindCSS v4 · FastAPI (Python)
> **Context:** Centralized Mosque Operating System built for Ramadan 1447H operations.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Tech Stack](#4-tech-stack)
5. [Environment Setup](#5-environment-setup)
6. [Feature Modules](#6-feature-modules)
   - [6.1 Home / Landing Page](#61-home--landing-page)
   - [6.2 E-Kupon (Digital Food Coupons)](#62-e-kupon-digital-food-coupons)
   - [6.3 Volunteer Gigs](#63-volunteer-gigs)
   - [6.4 Crowdfunding](#64-crowdfunding)
   - [6.5 Zakat Locator](#65-zakat-locator)
   - [6.6 AI Resource Dashboard](#66-ai-resource-dashboard)
   - [6.7 AJK Admin Panel](#67-ajk-admin-panel)
7. [Authentication System](#7-authentication-system)
8. [Database Schema (Supabase)](#8-database-schema-supabase)
9. [AI Predictor Microservice](#9-ai-predictor-microservice)
10. [Real-time & Live Data](#10-real-time--live-data)
11. [Design System](#11-design-system)
12. [Key Components & Hooks](#12-key-components--hooks)
13. [Running the Project Locally](#13-running-the-project-locally)
14. [Deployment Notes](#14-deployment-notes)
15. [Known Limitations & Future Work](#15-known-limitations--future-work)

---

## 1. Project Overview

**Project Makmur** is a full-stack, mobile-first Mosque Operating System designed to digitize and streamline mosque operations during Ramadan. It serves two distinct user groups:

| User Type | Description | Access Level |
|-----------|-------------|--------------|
| **Public / Jemaah** | General mosque-goers, anonymous or registered | E-Kupon, Zakat Locator, Gigs, Crowdfunding |
| **AJK Admin** | Mosque committee (Jawatankuasa) staff | All public features + Dashboard + Admin Panel |

### Core Value Propositions
- **E-Kupon System** — Eliminate physical food queue tickets via digital QR coupons
- **AI Crowd Prediction** — ML-powered crowd forecasting to optimize Iftar food preparation
- **Volunteer Coordination** — Digital gig board replacing WhatsApp-based task assignment
- **Transparent Crowdfunding** — Live campaign progress visible to all donors
- **Zakat Locator** — Interactive map of active zakat collection counters

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER / PWA                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Next.js 16 Frontend (React 19)             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │   │
│  │  │ E-Kupon  │ │ Gigs     │ │Dashboard │ │ Zakat  │ │   │
│  │  │  /e-kupon│ │  /gigs   │ │/dashboard│ │/zakat  │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │   │
│  │         │            │           │            │      │   │
│  │         └────────────┴───────────┴────────────┘      │   │
│  │                      │                               │   │
│  │           AuthContext (Supabase Auth)                 │   │
│  └──────────────────────┼───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │
           ┌──────────────┴─────────────┐
           │                            │
   ┌───────▼────────┐          ┌────────▼───────┐
   │  Supabase BaaS │          │ AI Predictor   │
   │  (PostgreSQL)  │          │ (Python/FastAPI)│
   │                │          │ Port :8000      │
   │ - Auth         │          │                │
   │ - RLS Policies │          │ POST /predict- │
   │ - Realtime     │          │      crowd      │
   │ - RPC Functions│          │ GET  /health   │
   └────────────────┘          └────────────────┘
```

**Data Flow Summary:**
1. On first visit, user is silently signed in anonymously (`supabase.auth.signInAnonymously()`)
2. Anonymous users can browse; they need to sign up/log in to claim gigs or view personalised features
3. AJK users authenticate with email/password; their `user_roles` row (role = `'admin'`) unlocks admin features
4. Realtime subscriptions on `food_events` push live capacity updates to all connected clients
5. The AI Predictor microservice runs independently; the dashboard calls it via `NEXT_PUBLIC_AI_API_URL`

---

## 3. Directory Structure

```
makmur-masjid-os/
│
├── ai-predictor/                 # Python FastAPI microservice
│   ├── main.py                   # App entry point + /predict-crowd endpoint
│   ├── requirements.txt          # Python dependencies
│   └── model/                    # (not committed) Place crowd_model.joblib here
│
├── public/                       # Static assets
│   ├── manifest.json             # PWA manifest
│   └── *.svg                     # Icons
│
├── supabase/
│   ├── schema.sql                # Full PostgreSQL schema + RLS + triggers
│   └── seed.sql                  # Sample seed data for development
│
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── layout.tsx            # Root layout (Navbar, BottomNav, AuthProvider)
│   │   ├── globals.css           # Design system (CSS custom properties + utilities)
│   │   ├── page.tsx              # Home / Landing page
│   │   ├── admin/page.tsx        # AJK Admin Panel
│   │   ├── crowdfunding/page.tsx # Crowdfunding campaigns
│   │   ├── dashboard/page.tsx    # AI Resource Dashboard
│   │   ├── e-kupon/page.tsx      # Digital food coupon system
│   │   ├── gigs/page.tsx         # Volunteer gig board
│   │   └── zakat/page.tsx        # Zakat counter locator map
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthModal.tsx     # Login/signup modal (email+password)
│   │   ├── layout/
│   │   │   ├── Navbar.tsx        # Top navigation bar
│   │   │   └── BottomNav.tsx     # Mobile bottom tab bar
│   │   ├── providers/
│   │   │   ├── AuthContext.tsx   # Global auth state provider
│   │   │   └── GuestProvider.tsx # Guest session helper
│   │   └── zakat/
│   │       └── MapComponent.tsx  # Leaflet interactive map
│   │
│   ├── hooks/
│   │   ├── useLiveStats.ts       # Fetches homepage live statistics from Supabase
│   │   └── useLiveFoodEvents.ts  # Fetches + subscribes to food_events realtime
│   │
│   └── lib/
│       ├── ai/
│       │   └── getAiPrediction.ts  # Helper to call AI Predictor API
│       ├── mutations/
│       │   └── claims.ts           # claimKupon() + claimGig() Supabase mutations
│       └── supabase/
│           └── client.ts           # Singleton Supabase browser client factory
│
├── next.config.ts                # Next.js configuration
├── package.json                  # NPM dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
└── eslint.config.mjs             # ESLint configuration
```

---

## 4. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js | 16.1.6 | App Router, SSR/SSG, routing |
| **UI Library** | React | 19.2.3 | Component model |
| **Language** | TypeScript | ^5 | Type safety |
| **Styling** | TailwindCSS | v4 | Utility-first CSS |
| **Database / Auth / Realtime** | Supabase | ^2.97.0 | PostgreSQL BaaS + Auth + Realtime |
| **SSR Supabase Client** | @supabase/ssr | ^0.8.0 | Cookie-based Supabase sessions |
| **Mapping** | Leaflet + React-Leaflet | ^1.9.4 / ^5.0.0 | Interactive maps for Zakat locator |
| **QR Codes** | react-qr-code | ^2.0.18 | Generate QR codes for E-Kupon |
| **Icons** | lucide-react | ^0.575.0 | Icon set |
| **UUID** | uuid | ^13.0.0 | Client-side UUID generation |
| **AI Microservice** | FastAPI + scikit-learn | Python | Crowd prediction |
| **AI Server** | Uvicorn | Python | ASGI server for FastAPI |

---

## 5. Environment Setup

### 5.1 Required Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# AI Predictor URL (optional, defaults to localhost:8000)
NEXT_PUBLIC_AI_API_URL=http://localhost:8000
```

You can find your Supabase keys at: **Supabase Dashboard → Settings → API**

### 5.2 Supabase Database Setup

1. Go to your **Supabase Dashboard → SQL Editor**
2. Run `supabase/schema.sql` to create all tables, RLS policies, and functions
3. Optionally run `supabase/seed.sql` to populate sample data

### 5.3 Installing Project Dependencies

```bash
npm install
```

### 5.4 Setting up the AI Predictor (Optional)

```bash
cd ai-predictor
pip install fastapi uvicorn scikit-learn joblib pydantic numpy
uvicorn main:app --reload --port 8000
```

> **Note:** If no trained model file (`model/crowd_model.joblib`) is present, the service falls back to a deterministic mock model.

---

## 6. Feature Modules

### 6.1 Home / Landing Page

**File:** `src/app/page.tsx`

The landing page serves as the app's entry point and adapts based on the user's role:

**Public users see:**
- Hero section with a Ramadan badge, headline, and CTA buttons ("Claim E-Kupon", "Volunteer Gigs")
- Live statistics bar (Iftar Packs Distributed, Active Volunteers, Donations Collected, Zakat Counters Live)
- Feature cards: E-Kupon, Zakat Locator, Volunteer Gigs, Crowdfunding

**Admin users additionally see:**
- Admin-only feature cards: AI Dashboard, AJK Admin Panel
- CTA buttons change to "Open Dashboard" and "AJK Admin Panel"

**Key logic:**
```tsx
const { isAdmin } = useAuth();
const stats = useLiveStats();
const features = isAdmin ? [...adminFeatures, ...publicFeatures] : publicFeatures;
```

**Live stats** are fetched from Supabase on mount via the `useLiveStats` hook, with graceful fallback values displayed immediately while data loads.

---

### 6.2 E-Kupon (Digital Food Coupons)

**File:** `src/app/e-kupon/page.tsx`

Replaces physical food queue tickets with a digital QR-code system.

**User Flow:**
1. Page loads and fetches active/scheduled food events from Supabase via `useLiveFoodEvents` hook
2. Each event is displayed as a `KuponCard` showing name, date/time, live availability counter, and progress bar
3. Users click **"Claim Now"** → `claimKupon(eventId, userId)` is called
4. On success, a QR code is generated from the user's Supabase user ID
5. Users show the QR code to the volunteer at the food counter
6. Claim state is persisted to `localStorage` so the QR remains after page reload

**Admin extras:**
- "Add E-Kupon" button opens the `AddEKuponModal` to create new food distribution events

**Claim deduplication:**
- PostgreSQL `UNIQUE (event_id, guest_uuid)` constraint on `kupon_claims` prevents double-claiming
- Error code `23505` (unique violation) → "You have already claimed this kupon"
- 5-second timeout guard with graceful local fallback

**Real-time capacity:**
- Supabase Realtime subscription on `food_events` table pushes `UPDATE` events to all clients
- When admin scans a QR (via `scan_kupon` RPC), `remaining_capacity` decrements and all clients see the live update

---

### 6.3 Volunteer Gigs

**File:** `src/app/gigs/page.tsx`

A digital task board for Ramadan volunteer coordination.

**Default Gig Data (hardcoded for demo):**
| Task | Volunteers Required | Time |
|------|---------------------|------|
| Kacau Bubur Lambuk | 15 | 3:00 PM - 5:00 PM |
| Tarawih Traffic Control | 10 | 7:30 PM - 9:00 PM |
| Susun Sejadah & Saf | 5 | 6:00 PM - 7:00 PM |
| Clean Up Kitchen | 8 | 8:00 PM - 9:30 PM |

**User Flow:**
1. Anonymous users see gigs but must log in to claim
2. Signed-in users click **"Claim Task"** → `claimGig(gigId, userId)` inserts into `gig_claims`
3. The progress bar and counter update immediately in local state
4. Full gigs show "Fully Booked" with an amber progress bar

**Admin extras:**
- "Add Gig" button opens the `AddGigModal` to create new volunteer tasks
- In production, admin creation should call `supabase.from('volunteer_gigs').insert(...)`

**RLS Policy:** Only non-anonymous (registered) users can insert gig claims.

---

### 6.4 Crowdfunding

**File:** `src/app/crowdfunding/page.tsx`

Transparent mosque fundraising with live progress tracking.

**Demo Campaigns:**
| Campaign | Target | Raised |
|----------|--------|--------|
| Tabung Iftar Asnaf | RM 15,000 | RM 8,450 |
| Repair Aircond Dewan Solat | RM 5,000 | RM 1,200 |
| Sadaqah Jariyah Anak Yatim | RM 10,000 | RM 4,500 |

**Current State:** UI is complete with mock data. The "Donate" button opens a modal with preset amounts (RM20, RM50, RM100) and a "Simulated Stripe Checkout" note. Full Stripe integration is pending.

**Production Integration Required:**
- Route `/api/stripe/checkout` to create a Stripe Checkout session
- Stripe webhook to update `donations` table and `crowdfund_campaigns.current_amount`

---

### 6.5 Zakat Locator

**File:** `src/app/zakat/page.tsx`  
**Map Component:** `src/components/zakat/MapComponent.tsx`

Interactive map showing active and scheduled zakat collection counters.

**Data Flow:**
1. On mount, fetches all records from `zakat_counters` table
2. Computes real-time status for each counter based on `start_date`, `end_date`, `start_time`, `end_time`
3. Filters out `expired` counters
4. Displays counter list in left sidebar; clicking a counter highlights it on the map

**Status Logic:**
```
if current_date < start_date         → "scheduled"
if current_date > end_date           → "expired"
if within date range:
  if current_time < start_time       → "scheduled"
  if current_time > end_time         → "expired"
  else                               → "active"
if no dates set AND is_active=false  → "expired"
```

**Leaflet Map:**
- Dynamically imported (`next/dynamic` with `ssr: false`) because Leaflet requires `window`
- Admin users can click the map to add a new counter pin, filling in a form (name, address, dates, times)
- New counters are immediately inserted into Supabase and appear on the map

---

### 6.6 AI Resource Dashboard

**File:** `src/app/dashboard/page.tsx`  
**API Helper:** `src/lib/ai/getAiPrediction.ts`

**Purpose:** Helps mosque management predict crowd sizes and optimize Iftar food preparation quantities.

**Current State (UI Demo):**
- Date picker (defaults to today)
- Detects if selected date is a weekend
- Displays hardcoded predictions (Tier 2, 500-1000 crowd, 28°C, 87% confidence)
- Historical attendance bar chart for the past 7 days using inline pixel heights

**Production Integration:**
To wire up the actual AI predictor:
```typescript
import { getAiCrowdPrediction } from "@/lib/ai/getAiPrediction";

const prediction = await getAiCrowdPrediction(
  selectedDate,          // "2026-03-15"
  weatherConditionId,    // WMO code from Open-Meteo API
  isWeekend              // boolean
);
// prediction.predicted_tier   → 1, 2, or 3
// prediction.tier_label       → "Low" | "Medium" | "High"
// prediction.recommended_food_packs → 150 | 300 | 500
// prediction.recommendation   → human-readable string
```

**Crowd Tier Mapping:**
| Tier | Label | Recommended Packs |
|------|-------|-------------------|
| 1 | Low | 150 |
| 2 | Medium | 300 |
| 3 | High | 500 |

---

### 6.7 AJK Admin Panel

**File:** `src/app/admin/page.tsx`

Central operations hub for mosque committee (AJK) staff. Accessible only to admin-role users.

**Features:**

| Panel | Description | Status |
|-------|-------------|--------|
| **Financials Overview** | Total donations collected via Stripe, broken down by campaign | Mock data |
| **Community Broadcast** | Send push notification text to all registered users | UI only (alert()) |
| **E-Kupon Scanner** | Text input to simulate scanning a QR reservation ID | Local state only |
| **User & Gig Management** | Mark gigs as complete (award points), ban users | Mock data |

**Sidebar Navigation:** The admin panel includes a full desktop sidebar with links to all system pages, active state highlighting, and a sign-out button.

**Production Integrations Required:**
- Broadcast: Call a Supabase `system_broadcasts` insert + push notification service (e.g., Firebase FCM)
- Scanner: Call `supabase.rpc('scan_kupon', { p_claim_id: uuid })` to mark QR as scanned and decrement capacity
- User management: Read from `user_roles` table; update or delete entries

---

## 7. Authentication System

**File:** `src/components/providers/AuthContext.tsx`

The application uses **Supabase Auth** with a guest-first strategy.

### Auth Flow

```
App loads
    │
    ├─→ localStorage["makmur_signed_out"] === "true"?
    │       YES → skip session check, create anonymous session
    │       NO  → check supabase.auth.getSession()
    │               └─→ Non-anonymous session found?
    │                       YES → use existing session + checkAdminRole()
    │                       NO  → supabase.auth.signInAnonymously()
    │
    └─→ setIsLoading(false)
```

### Context API

```typescript
interface AuthContextType {
  user: User | null;          // Current Supabase user object
  isLoading: boolean;         // True during initial auth bootstrap
  isAnonymous: boolean;       // user.is_anonymous ?? true
  isAdmin: boolean;           // True if user_roles.role === 'admin'
  showLoginModal: boolean;    // Controls AuthModal visibility
  setShowLoginModal: (v: boolean) => void;
  signInWithEmail: (email, password) => Promise<string | null>;  // returns error message or null
  signUp: (email, password, name) => Promise<string | null>;     // returns error message or null
  signOut: () => Promise<void>;
}
```

### Admin Role Check

```typescript
// Reads from user_roles table in Supabase
const { data } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", userId)
  .single();

isAdmin = data?.role === "admin";
```

To grant admin privileges, manually insert into the `user_roles` table:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('your-user-uuid-here', 'admin');
```

### AuthModal

The `AuthModal` (`src/components/auth/AuthModal.tsx`) is a slide-up modal providing:
- **Sign In** tab: email + password
- **Sign Up** tab: full name, email, password
- Error display
- Controlled by `showLoginModal` state in `AuthContext`

---

## 8. Database Schema (Supabase)

**File:** `supabase/schema.sql`

All tables use Row-Level Security (RLS). The `public.is_admin()` helper function centralizes admin checks.

### Tables Summary

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `user_roles` | Maps users to roles (admin/volunteer) | `user_id`, `role` |
| `volunteer_gigs` | Volunteer tasks posted by admin | `title`, `description`, `required_pax` |
| `gig_claims` | Records which user claimed which gig | `gig_id`, `guest_uuid` — UNIQUE together |
| `crowdfund_campaigns` | Fundraising campaigns | `title`, `target_amount`, `current_amount` |
| `donations` | Individual donation records | `campaign_id`, `amount`, `stripe_session_id` |
| `food_events` | Iftar food distribution events | `name`, `total_capacity`, `remaining_capacity`, `event_date` |
| `kupon_claims` | Records QR kupon claims | `event_id`, `guest_uuid`, `is_scanned` — UNIQUE together |
| `zakat_counters` | Zakat collection point locations | `latitude`, `longitude`, `start_date`, `end_date`, `is_active` |
| `system_broadcasts` | Push notification messages | `message`, `is_active` (only one active at a time) |

### RLS Policies Pattern

```
Public READ  → Anyone authenticated (incl. anonymous)
Admin WRITE  → Only rows where public.is_admin() = true
Own row      → User can only modify their own records (auth.uid() = guest_uuid)
```

### Key Database Functions / Triggers

| Name | Type | Purpose |
|------|------|---------|
| `public.is_admin()` | Function | Returns true if current user has admin role |
| `public.scan_kupon(p_claim_id)` | RPC Function | Marks kupon as scanned + decrements remaining_capacity |
| `public.decrement_kupon_capacity()` | Trigger Function | Auto-decrements food_events.remaining_capacity on kupon claim insert |
| `public.deactivate_old_broadcasts()` | Trigger Function | Deactivates old broadcasts when a new one is inserted |

### Realtime Tables

The following tables have Supabase Realtime enabled:
- `food_events` — powers live capacity counter in E-Kupon page
- `system_broadcasts` — powers live broadcast banner (future implementation)

---

## 9. AI Predictor Microservice

**Directory:** `ai-predictor/`  
**File:** `ai-predictor/main.py`

A standalone Python microservice providing crowd prediction for mosque resource planning.

### Running the Service

```bash
cd ai-predictor
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### API Endpoints

#### `POST /predict-crowd`

Predicts the crowd tier for a given date and weather condition.

**Request Body:**
```json
{
  "target_date": "2026-03-15",
  "weather_condition_id": 1,
  "is_weekend": false
}
```

**Response:**
```json
{
  "target_date": "2026-03-15",
  "predicted_tier": 2,
  "tier_label": "Medium",
  "recommended_food_packs": 300,
  "recommendation": "Expected Tier 2 (Medium) crowd. Prepare 300 Bubur Lambuk packs."
}
```

**Input Features:**
| Feature | Type | Description |
|---------|------|-------------|
| `target_date` | date (YYYY-MM-DD) | The date to forecast |
| `weather_condition_id` | integer | WMO weather code (0 = clear sky, higher = worse) |
| `is_weekend` | boolean | Whether the date falls on Saturday/Sunday |

The service internally extracts `day_of_week` (0=Monday, 6=Sunday) from `target_date`.

#### `GET /health`

Returns `{ "status": "ok", "model_loaded": true }` — useful for uptime monitoring.

### Model Strategy

1. **Production:** Place a trained `scikit-learn` model at `ai-predictor/model/crowd_model.joblib`
   - Model must accept features: `[day_of_week, weather_condition_id, is_weekend]`
   - Model must predict crowd tier: `1`, `2`, or `3`

2. **Development (Mock):** If no `.joblib` file is found, a deterministic mock model is used:
   ```python
   if is_weekend and weather <= 2: tier = 3  # High
   elif is_weekend or weather <= 1: tier = 2  # Medium
   else: tier = 1  # Low
   ```

### CORS Configuration

The AI predictor allows requests from:
- `http://localhost:3000` (Next.js dev)
- `https://your-production-domain.com` (update this for production)

### Python Dependencies

```
fastapi
uvicorn
scikit-learn
joblib
pydantic
numpy
```

---

## 10. Real-time & Live Data

### Live Food Events (`useLiveFoodEvents`)

**File:** `src/hooks/useLiveFoodEvents.ts`

- Fetches all `food_events` on mount
- Computes status (`active`/`scheduled`/`expired`) dynamically based on current time
- Filters out expired events, sorts active first
- Subscribes to Supabase Realtime `UPDATE` events on `food_events`
- Falls back to demo data if DB is unreachable or empty
- 4-second hard timeout to prevent infinite loading spinner

### Live Homepage Stats (`useLiveStats`)

**File:** `src/hooks/useLiveStats.ts`

Runs 4 parallel Supabase queries on mount:

| Stat | Query |
|------|-------|
| **Iftar Packs Distributed** | `SUM(total_capacity - remaining_capacity)` from `food_events` |
| **Active Volunteers** | `COUNT(*)` from `user_roles` WHERE `role = 'volunteer'` |
| **Donations Collected** | `SUM(amount)` from `donations` |
| **Zakat Counters Live** | Counts `zakat_counters` where current date/time is within active window |

Fallback values are shown immediately (1200 packs, 85 volunteers, RM 12,000, 5 counters) to avoid blank states.

### Claim Mutations (`claims.ts`)

Both `claimKupon()` and `claimGig()` use a **race pattern** with a 5-second timeout:

```typescript
const result = await Promise.race([
  supabase.from("kupon_claims").insert(...),
  new Promise(resolve => setTimeout(() => resolve({ error: { code: "TIMEOUT" } }), 5000))
]);
```

- **Duplicate (23505):** "You have already claimed this."
- **Permission error (42501) / Timeout:** Falls back to local-only claim (optimistic UI)
- **Network error:** Falls back to local-only claim

---

## 11. Design System

**File:** `src/app/globals.css`

The app uses a custom Islamic-inspired design system defined in the CSS `@theme` block (Tailwind v4).

### Color Palette

| Token | HEX | Usage |
|-------|-----|-------|
| `--color-primary` | `#1B6B4A` | Deep forest green — primary actions |
| `--color-primary-light` | `#2D8F65` | Hover states, gradients |
| `--color-primary-dark` | `#0F4A33` | Pressed states |
| `--color-gold` | `#D4A843` | Islamic gold — badges, accents, highlights |
| `--color-gold-dark` | `#B8922F` | Gold hover |
| `--color-surface` | `#FFFFFF` | Card backgrounds |
| `--color-surface-alt` | `#F8FAF9` | Page background |
| `--color-text` | `#1A2E2A` | Primary text |
| `--color-text-secondary` | `#5A7068` | Body text |
| `--color-text-muted` | `#8FA39B` | Labels, timestamps |

### Utility Classes

| Class | Purpose |
|-------|---------|
| `.hero-gradient` | `linear-gradient(135deg, #0F4A33 → #1B6B4A → #2D8F65)` |
| `.card` | White card with border, hover lift + green border glow |
| `.btn-primary` | Primary green button with hover lift |
| `.btn-outline` | Outlined button with green text |
| `.icon-box` | 48×48 rounded icon container |
| `.icon-box-primary` | Green-tinted icon box |
| `.icon-box-gold` | Gold-tinted icon box |
| `.badge` | Small pill badge |
| `.progress-bar` / `.progress-fill` | Gradient progress bar |
| `.animate-live` | Pulsing dot animation (2s loop) |
| `.glass` | Frosted glass effect |
| `.pattern-bg` | Subtle Islamic geometric SVG pattern |

---

## 12. Key Components & Hooks

### `AuthContext` (Global Provider)
Wraps the entire app. Provides `user`, `isAdmin`, `isAnonymous`, `signInWithEmail`, `signUp`, `signOut`.

### `Navbar` (`src/components/layout/Navbar.tsx`)
Responsive top navigation. Shows the Makmur logo, dynamic page links, user avatar, and login/logout controls.

### `BottomNav` (`src/components/layout/BottomNav.tsx`)
Mobile-only bottom tab bar. Hides on `md:` and above (`md:hidden`).

### `AuthModal` (`src/components/auth/AuthModal.tsx`)
Slide-up modal with Sign In / Sign Up tabs. Triggered by `setShowLoginModal(true)`.

### `MapComponent` (`src/components/zakat/MapComponent.tsx`)
Leaflet map with custom markers, popups, and an admin "pin mode" to add new zakat counters.

### `useLiveFoodEvents` Hook
Returns `{ events: FoodEvent[], isLoading: boolean }`. Manages Supabase Realtime subscription lifecycle.

### `useLiveStats` Hook
Returns `{ iftarPacksDistributed, activeVolunteers, donationsCollected, zakatCountersLive, isLoading }`.

---

## 13. Running the Project Locally

### Prerequisites
- Node.js 20+ and npm
- Python 3.9+ (for AI Predictor)
- A Supabase project with schema applied

### Steps

```bash
# 1. Clone and install
git clone <repo-url>
cd makmur-masjid-os
npm install

# 2. Create .env.local
cp .env.example .env.local
# Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Apply database schema
# → Go to Supabase Dashboard → SQL Editor
# → Paste and run: supabase/schema.sql
# → Optionally run: supabase/seed.sql

# 4. Start the Next.js frontend
npm run dev
# → http://localhost:3000

# 5. (Optional) Start the AI predictor
cd ai-predictor
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → http://localhost:8000/docs  (Swagger UI)
```

### Creating an Admin User

1. Register a new account through the app UI
2. In the Supabase SQL Editor, run:
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'your-admin-email@example.com';
```
3. Sign in with that account — admin features will appear

---

## 14. Deployment Notes

### Frontend (Next.js)
- Recommended: **Vercel** (zero-config for Next.js)
- Add all `NEXT_PUBLIC_*` environment variables in the Vercel dashboard
- Update `NEXT_PUBLIC_AI_API_URL` to point to your deployed AI Predictor

### AI Predictor (FastAPI)
- Recommended: **Railway**, **Render**, or **fly.io** (Docker supported)
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Update CORS `allow_origins` in `main.py` to include your production frontend domain

### Supabase
- Enable Realtime for `food_events` and `system_broadcasts` tables
- Ensure Email Auth is enabled in Supabase Auth settings
- Configure RLS policies (already done via `schema.sql`)

### PWA
- `public/manifest.json` is configured for PWA (installable on mobile)
- Theme color: `#3D6D63` (set in `layout.tsx` `viewport` export)

---

## 15. Known Limitations & Future Work

### Current Limitations

| Area | Limitation |
|------|-----------|
| **Crowdfunding** | Stripe integration is UI-only; no real payment processing |
| **Admin Broadcast** | Broadcast UI uses `alert()` instead of real push notifications |
| **Admin Scanner** | QR scanner is a text input; no camera-based scan |
| **Dashboard AI** | Dashboard shows hardcoded values; not connected to AI predictor yet |
| **Gigs** | Gig data is hardcoded; not yet read from `volunteer_gigs` table |
| **Admin User Management** | Ban/award points buttons are UI only, no Supabase calls |
| **Weather Integration** | Dashboard shows "Connected" but doesn't call Open-Meteo API |

### Recommended Next Steps

1. **Connect Dashboard to AI API** — Wire `getAiCrowdPrediction()` into `/dashboard/page.tsx` with real weather data from Open-Meteo
2. **Stripe Crowdfunding** — Add a Next.js API route for Stripe Checkout + webhook to update `donations` table
3. **Real Push Notifications** — Use Supabase Realtime + FCM to deliver `system_broadcasts` to mobile clients
4. **Camera QR Scanner** — Replace text input in Admin Scanner with a camera-based QR reader (e.g., `html5-qrcode`)
5. **Gigs from Supabase** — Replace hardcoded `initialGigs` with query from `volunteer_gigs` table
6. **Volunteer Points System** — Implement point awarding after gig completion
7. **Notification History** — Show past broadcasts in admin panel
8. **Analytics Dashboard** — Add charts for kupon claims over time, peak hours, most popular gigs
9. **Multi-Mosque Support** — Add `mosque_id` foreign key across tables to support multiple mosques
10. **Malay Language (i18n)** — Add Bahasa Malaysia translations using `next-intl`

---

*Documentation generated: 22 February 2026 | Project Makmur v0.1.0*
