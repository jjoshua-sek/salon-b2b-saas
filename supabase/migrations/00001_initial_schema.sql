-- ============================================================
-- SALON B2B SAAS — Initial Database Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('customer', 'admin', 'stylist');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
CREATE TYPE booking_source AS ENUM ('online', 'walk_in');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'gcash', 'maya');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded');
CREATE TYPE proficiency_level AS ENUM ('beginner', 'skilled', 'expert');
CREATE TYPE loyalty_tier AS ENUM ('bronze', 'silver', 'gold');

-- ============================================================
-- TABLES
-- ============================================================

-- Users (extends Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'customer',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stylists (extends users with salon-specific data)
CREATE TABLE stylists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  avatar_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  years_experience INTEGER,
  personality_tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Services catalog
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  category TEXT NOT NULL,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  source booking_source NOT NULL DEFAULT 'online',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Prevent double-booking: no overlapping bookings for the same stylist
CREATE INDEX idx_bookings_stylist_time ON bookings (stylist_id, start_time, end_time);

CREATE OR REPLACE FUNCTION check_no_double_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE stylist_id = NEW.stylist_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
      AND status NOT IN ('cancelled', 'no_show')
      AND start_time < NEW.end_time
      AND end_time > NEW.start_time
  ) THEN
    RAISE EXCEPTION 'Double booking: stylist already has an appointment during this time';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_double_booking
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION check_no_double_booking();

-- Transactions (payments)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  payment_method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  reference_number TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Portfolio items (stylist work gallery)
CREATE TABLE portfolio_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stylist specializations (many-to-many: stylists <-> services)
CREATE TABLE stylist_specializations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  proficiency proficiency_level NOT NULL DEFAULT 'skilled',
  UNIQUE (stylist_id, service_id)
);

-- AI recommendations
CREATE TABLE ai_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  face_shape TEXT NOT NULL,
  preferences JSONB,
  recommended_styles JSONB NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer loyalty
CREATE TABLE customer_loyalty (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  total_points_earned INTEGER NOT NULL DEFAULT 0 CHECK (total_points_earned >= 0),
  tier loyalty_tier NOT NULL DEFAULT 'bronze',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Loyalty transactions
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  points_change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_reviews_stylist ON reviews(stylist_id);
CREATE INDEX idx_portfolio_stylist ON portfolio_items(stylist_id);
CREATE INDEX idx_ai_recs_customer ON ai_recommendations(customer_id);
CREATE INDEX idx_loyalty_tx_customer ON loyalty_transactions(customer_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stylists ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stylist_specializations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get stylist id for current user
CREATE OR REPLACE FUNCTION auth.stylist_id()
RETURNS UUID AS $$
  SELECT id FROM public.stylists WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS POLICIES: users
-- ============================================================

-- Everyone can read basic user info (for stylist profiles etc.)
CREATE POLICY "Users: public read" ON users
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users: self update" ON users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin can do everything
CREATE POLICY "Users: admin all" ON users
  FOR ALL USING (auth.is_admin());

-- ============================================================
-- RLS POLICIES: stylists
-- ============================================================

-- Everyone can read stylist profiles (public listing)
CREATE POLICY "Stylists: public read" ON stylists
  FOR SELECT USING (true);

-- Stylists can update their own profile
CREATE POLICY "Stylists: self update" ON stylists
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin can manage all stylists
CREATE POLICY "Stylists: admin all" ON stylists
  FOR ALL USING (auth.is_admin());

-- ============================================================
-- RLS POLICIES: services
-- ============================================================

-- Everyone can read active services
CREATE POLICY "Services: public read" ON services
  FOR SELECT USING (is_active = true OR auth.is_admin());

-- Admin can manage services
CREATE POLICY "Services: admin all" ON services
  FOR ALL USING (auth.is_admin());

-- ============================================================
-- RLS POLICIES: bookings
-- ============================================================

-- Customers see their own bookings
CREATE POLICY "Bookings: customer read own" ON bookings
  FOR SELECT USING (customer_id = auth.uid());

-- Stylists see bookings assigned to them
CREATE POLICY "Bookings: stylist read own" ON bookings
  FOR SELECT USING (stylist_id = auth.stylist_id());

-- Customers can create bookings
CREATE POLICY "Bookings: customer create" ON bookings
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Customers can cancel their own pending bookings
CREATE POLICY "Bookings: customer cancel" ON bookings
  FOR UPDATE USING (customer_id = auth.uid() AND status = 'pending')
  WITH CHECK (status = 'cancelled');

-- Admin can do everything with bookings
CREATE POLICY "Bookings: admin all" ON bookings
  FOR ALL USING (auth.is_admin());

-- ============================================================
-- RLS POLICIES: transactions
-- ============================================================

-- Customers can see their own transactions (via booking)
CREATE POLICY "Transactions: customer read own" ON transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = transactions.booking_id AND bookings.customer_id = auth.uid())
  );

-- Admin can manage all transactions
CREATE POLICY "Transactions: admin all" ON transactions
  FOR ALL USING (auth.is_admin());

-- ============================================================
-- RLS POLICIES: reviews
-- ============================================================

-- Everyone can read reviews (public)
CREATE POLICY "Reviews: public read" ON reviews
  FOR SELECT USING (true);

-- Customers can create reviews for their completed bookings
CREATE POLICY "Reviews: customer create" ON reviews
  FOR INSERT WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = reviews.booking_id
        AND bookings.customer_id = auth.uid()
        AND bookings.status = 'completed'
    )
  );

-- Admin can manage all reviews
CREATE POLICY "Reviews: admin all" ON reviews
  FOR ALL USING (auth.is_admin());

-- ============================================================
-- RLS POLICIES: portfolio_items
-- ============================================================

-- Everyone can read portfolio items (public gallery)
CREATE POLICY "Portfolio: public read" ON portfolio_items
  FOR SELECT USING (true);

-- Stylists can manage their own portfolio
CREATE POLICY "Portfolio: stylist manage own" ON portfolio_items
  FOR ALL USING (stylist_id = auth.stylist_id());

-- Admin can manage all portfolios
CREATE POLICY "Portfolio: admin all" ON portfolio_items
  FOR ALL USING (auth.is_admin());

-- ============================================================
-- RLS POLICIES: stylist_specializations
-- ============================================================

-- Everyone can read specializations
CREATE POLICY "Specializations: public read" ON stylist_specializations
  FOR SELECT USING (true);

-- Admin can manage specializations
CREATE POLICY "Specializations: admin all" ON stylist_specializations
  FOR ALL USING (auth.is_admin());

-- ============================================================
-- RLS POLICIES: ai_recommendations
-- ============================================================

-- Customers can read their own recommendations
CREATE POLICY "AI Recs: customer read own" ON ai_recommendations
  FOR SELECT USING (customer_id = auth.uid());

-- Stylists can read recommendations for customers they have bookings with
CREATE POLICY "AI Recs: stylist read for booked customers" ON ai_recommendations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.customer_id = ai_recommendations.customer_id
        AND bookings.stylist_id = auth.stylist_id()
    )
  );

-- Customers can create their own recommendations
CREATE POLICY "AI Recs: customer create" ON ai_recommendations
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Admin can read all recommendations
CREATE POLICY "AI Recs: admin all" ON ai_recommendations
  FOR ALL USING (auth.is_admin());

-- ============================================================
-- RLS POLICIES: customer_loyalty
-- ============================================================

-- Customers can read their own loyalty data
CREATE POLICY "Loyalty: customer read own" ON customer_loyalty
  FOR SELECT USING (customer_id = auth.uid());

-- Admin can manage all loyalty data
CREATE POLICY "Loyalty: admin all" ON customer_loyalty
  FOR ALL USING (auth.is_admin());

-- ============================================================
-- RLS POLICIES: loyalty_transactions
-- ============================================================

-- Customers can read their own loyalty transactions
CREATE POLICY "Loyalty TX: customer read own" ON loyalty_transactions
  FOR SELECT USING (customer_id = auth.uid());

-- Admin can manage all loyalty transactions
CREATE POLICY "Loyalty TX: admin all" ON loyalty_transactions
  FOR ALL USING (auth.is_admin());

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer')
  );

  -- Auto-create loyalty record for customers
  IF COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer') = 'customer' THEN
    INSERT INTO public.customer_loyalty (customer_id)
    VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- AUTO-CREATE STYLIST RECORD WHEN ROLE IS STYLIST
-- ============================================================

CREATE OR REPLACE FUNCTION handle_stylist_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'stylist' AND NOT EXISTS (SELECT 1 FROM stylists WHERE user_id = NEW.id) THEN
    INSERT INTO stylists (user_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_role_stylist
  AFTER INSERT OR UPDATE OF role ON users
  FOR EACH ROW
  WHEN (NEW.role = 'stylist')
  EXECUTE FUNCTION handle_stylist_role();
