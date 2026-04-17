-- ============================================================
-- Backfill: sync auth.users -> public.users for accounts that
-- pre-date the signup trigger in 00002.
--
-- Symptom this fixes: booking insert fails with
--   "insert or update on table bookings violates foreign key
--    constraint bookings_customer_id_fkey"
-- because auth.users has the signed-in user but public.users
-- does not, so bookings.customer_id -> public.users(id) breaks.
--
-- Safe to re-run.
-- ============================================================

-- 1. Mirror auth.users rows that have no matching public.users row
INSERT INTO public.users (id, email, full_name, phone, role)
SELECT
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    split_part(au.email, '@', 1)
  ) AS full_name,
  NULLIF(au.raw_user_meta_data->>'phone', '') AS phone,
  COALESCE(
    NULLIF(au.raw_user_meta_data->>'role', '')::user_role,
    'customer'
  ) AS role
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL
  AND au.email IS NOT NULL;

-- 2. Seed missing customer_loyalty rows for customers
--    (the trigger in 00002 handles this on insert, but existing
--    customers backfilled above still need their loyalty record)
INSERT INTO public.customer_loyalty (customer_id)
SELECT u.id
FROM public.users u
LEFT JOIN public.customer_loyalty l ON l.customer_id = u.id
WHERE u.role = 'customer'
  AND l.customer_id IS NULL;
