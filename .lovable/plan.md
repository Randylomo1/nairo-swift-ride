# Production-Grade Delivery Platform — Build Plan

M-Pesa STK Push stays untouched. Everything else gets rebuilt around a real order lifecycle, a unified navigation shell, and a polished, mobile-first UI.

## 1. Data model additions (single migration)

Add the fields that the lifecycle requires. No destructive changes.

- `orders`: `archived_by_customer boolean default false`, `scheduled_for timestamptz null`, `cancelled_at timestamptz`, `cancelled_by uuid`, `cancel_reason text`, `recipient_name text`, `recipient_phone text`.
- `payments`: ensure `cancelled`/`expired`/`failed` statuses exist; add `expires_at timestamptz` (default `now() + interval '3 minutes'`).
- `notifications` table: `id, user_id, type, title, body, order_id, read_at, created_at` with RLS scoped to `auth.uid()`.
- `support_tickets` table: `id, user_id, order_id, subject, message, status, created_at` with owner-only RLS + admin read.
- `rider_ratings` table: `id, order_id unique, rider_id, customer_id, rating int check 1..5, comment, created_at` with policies (customer inserts own, rider reads own aggregates via view).
- View `rider_public_stats` for average rating + completion rate (SECURITY INVOKER).
- RPCs (SECURITY DEFINER, authenticated only):
  - `cancel_order(_order_id)` — only if unpaid & no rider; sets `status='cancelled'`, `cancelled_at`, cancels pending payment rows.
  - `archive_order(_order_id)` — only if terminal (`delivered`/`cancelled`); sets `archived_by_customer=true`.
  - `expire_stale_payments()` — marks pending payments older than `expires_at` as `expired` and releases the order back to `created`.
- Trigger to auto-create a notification on key `orders.status` transitions and on payment terminal states.
- GRANTs + RLS updates for every new table.

## 2. Navigation shell

New `AppShell` layout used by every authenticated route:

- Top bar: logo, breadcrumb, notifications bell (unread count), profile menu.
- Sidebar (desktop) / bottom nav (mobile): Dashboard, Orders, Payments, Notifications, Support, Profile.
- Universal `BackButton` component using router history; falls back to role home (`/dashboard`, `/rider`, `/admin`).
- Applied via `_authenticated/route.tsx` so no page can be orphaned.

## 3. Customer surface

- `/dashboard` — summary cards (Active, Pending Payment, Scheduled, Completed, Cancelled, Total, Spent, Referral), quick actions, recent activity, unread notifications.
- `/orders` — tabbed view (Pending Payment, Awaiting Rider, Active, Scheduled, Completed, Cancelled, Expired) with search + filter + archive toggle.
- `/orders/$id` — full detail: timeline, live map (when active), rider card w/ rating + phone (only while assigned), payment status, contextual action buttons (Edit / Cancel / Pay / Retry / Archive / Contact Support / Download Receipt).
- `/payments` — buckets (Pending, Completed, Cancelled, Expired) with per-row Retry / Cancel / Download Receipt / View Order.
- `/notifications` — list + mark-as-read (single + all).
- `/support` — ticket list + new ticket form tied to an order.
- `/profile` — name, phone, referral code, wallet credit, sign-out.

## 4. Order lifecycle rules

- Unpaid + unassigned → customer can Edit / Cancel / Retry Payment / Delete Draft.
- Payment pending → poll status + Cancel Request (calls `cancel_order`).
- Payment cancelled/expired/failed → Retry Payment creates a fresh STK push (existing function untouched).
- Paid + no rider → Contact Support / View Receipt.
- Rider assigned → Track / Contact Rider / Contact Support (no cancel).
- Delivered → Archive / Rate Rider / Download Receipt.
- Financial records are never hard-deleted; deletion for drafts/cancelled/expired uses `archived_by_customer`.
- Stale pending payments auto-expire via `expire_stale_payments` invoked on dashboard load and payment page mount (cheap RPC; sandbox has no cron).

## 5. Rider portal

- Cards: Today / Weekly / Monthly earnings, Rating, Acceptance %, Completion %, Available Jobs, Current Delivery.
- Job tabs: Available, Active, Scheduled, Completed, Cancelled.
- Active delivery view: map with pickup + drop, status action buttons (Arrived at Pickup → Package Collected → Start Delivery → Complete Delivery → Upload Proof).
- Uses existing `get_available_jobs` + `accept_order` RPCs.

## 6. Admin operations center

- Live counters: Active Orders, Riders Online, Awaiting Assignment, Revenue Today, Failed Payments, Cancelled Orders, Open Tickets.
- Filterable tables: Orders, Riders, Payments, Tickets.
- Manual assign / cancel actions (admin-gated via `has_role`).

## 7. Design system

Refresh `src/styles.css` tokens (navy / emerald / warning already exist) into a cohesive scale: typography ramp, spacing, elevation, motion. Reusable primitives:

- `PageHeader`, `BackButton`, `StatCard`, `EmptyState`, `Skeleton`, `Timeline`, `StatusPill`, `TabBar`, `DataTable`, `SearchBar`, `FilterChips`.
- Mobile-first responsive using existing grid rules from knowledge.

## 8. Realtime + polling

- Supabase realtime channels for `orders` (customer + rider views) and `notifications`.
- Payment page polls `checkPaymentStatus` every 4s while `pending` (already exists).

## 9. Cleanup

- Remove all placeholder/demo strings.
- Every button wired to a real action or hidden.
- Every route reachable through nav + has back navigation.

## Technical notes

```text
_authenticated/
  route.tsx          → AppShell + auth gate (existing)
  dashboard.tsx      → rebuilt
  orders.index.tsx   → tabbed list  (new)
  orders.$id.tsx     → detail + timeline (replaces track.$orderId; alias kept)
  payments.index.tsx → buckets (rewrite of payment.index)
  payments.$id.tsx   → STK status + retry (rewrite of payment.$orderId, no STK logic change)
  notifications.tsx  → new
  support.tsx        → new
  profile.tsx        → new
  rider.tsx          → rebuilt
  admin.tsx          → rebuilt
```

`src/lib/mpesa.functions.ts` is not modified. New RPCs (`cancel_order`, `archive_order`, `expire_stale_payments`) are called via typed wrappers in `src/lib/orders.functions.ts`.

## Scope confirmation

This is a large multi-file change (~1 migration + ~20 files). I'll implement it in one pass, then verify with a build and a targeted Playwright smoke on `/dashboard`, `/orders`, `/payments`.

Approve to proceed, or tell me which phases to drop/defer.
