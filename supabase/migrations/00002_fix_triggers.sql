-- ============================================================
-- FIX: Recreate triggers (replace functions in-place)
-- Safe to re-run. Does NOT drop RLS policies.
-- ============================================================

-- Only drop triggers (not functions — policies depend on them)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_user_role_stylist ON public.users;

-- ============================================================
-- Replace helper functions in-place (no drop needed)
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.stylist_id()
RETURNS UUID AS $$
  SELECT id FROM public.stylists WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Replace signup trigger function & recreate trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'role', '')::user_role,
      'customer'
    )
  );

  -- Auto-create loyalty record for customers
  IF COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'customer') = 'customer' THEN
    INSERT INTO public.customer_loyalty (customer_id)
    VALUES (NEW.id);
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Replace stylist role trigger & recreate trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_stylist_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'stylist' AND NOT EXISTS (SELECT 1 FROM public.stylists WHERE user_id = NEW.id) THEN
    INSERT INTO public.stylists (user_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_role_stylist
  AFTER INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW
  WHEN (NEW.role = 'stylist')
  EXECUTE FUNCTION public.handle_stylist_role();
