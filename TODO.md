# TODO — Fix stuck M-Pesa pending payments

- [x] Inspect current admin/dashboard payment & order UI/routes to understand existing status rendering

- [x] Update Supabase schema (migrations) (start): confirm current enum lacks CANCELLED/EXPIRED and must be expanded

- [x] Update Supabase schema (migrations):
  - [x] Expand `public.payment_status` enum to include processing/success/failed/cancelled/expired
  - [x] Ensure `payments.status` and `orders.payment_status` defaults/constraints match


- [x] Implement payment state mapping in M-Pesa callback:
  - [x] `ResultCode = 0` => SUCCESS
  - [x] `ResultCode = 1032` (cancelled by user) => CANCELLED
  - [x] Wrong PIN / non-zero => FAILED
  - [ ] Timeout / no response => EXPIRED
  - [x] Make callback idempotent for terminal states

- [x] Update STK push initiation and retry:
  - [x] When retrying, create a new STK push request (new checkout id)
  - [ ] Mark any previous non-terminal attempts as EXPIRED or CANCELLED

- [ ] Add background reconciliation (prevents permanent pending):
  - [ ] Implement a reconciler endpoint/function to expire old pending/processing payments (e.g. older than 3 minutes)
  - [ ] Update corresponding orders for retryability

- [x] Update customer payment screen (`payment/$orderId.tsx`):
  - [x] When payment is pending, show: "Waiting for M-Pesa Confirmation..."
  - [x] Add buttons: Refresh Status + Cancel Request
  - [x] Cancel Request moves payment to CANCELLED and releases order for retry
  - [ ] Retry button for FAILED/CANCELLED/EXPIRED creates a completely new STK push

- [x] Update payments list / dashboard to show buckets:
  - [x] Pending, Successful, Cancelled, Failed, Expired


- [ ] Test cases:
  - [ ] Cancel on phone => CANCELLED
  - [ ] Ignore STK => EXPIRED after timeout window
  - [ ] Wrong PIN => FAILED
  - [ ] Pay successfully => SUCCESS and order becomes PAID
  - [ ] Retry after cancellation => new STK push created; no payment remains permanently in PENDING

