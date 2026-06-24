
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('customer', 'rider', 'admin');
CREATE TYPE public.order_status AS ENUM (
  'created','payment_pending','paid','rider_assigned','heading_to_pickup',
  'picked_up','in_transit','out_for_delivery','delivered','cancelled'
);
CREATE TYPE public.delivery_type AS ENUM ('standard','express','same_day','scheduled');
CREATE TYPE public.payment_status AS ENUM ('pending','success','failed');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  credits_kes NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Riders
CREATE TABLE public.riders (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  national_id TEXT,
  bike_registration TEXT,
  license_number TEXT,
  id_photo_url TEXT,
  license_photo_url TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  online BOOLEAN NOT NULL DEFAULT false,
  current_lat NUMERIC(10,6),
  current_lng NUMERIC(10,6),
  rating NUMERIC(3,2) DEFAULT 5.0,
  total_deliveries INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.riders TO authenticated;
GRANT ALL ON public.riders TO service_role;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

-- Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL DEFAULT ('UC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'created',
  delivery_type public.delivery_type NOT NULL DEFAULT 'standard',

  pickup_address TEXT NOT NULL,
  pickup_lat NUMERIC(10,6) NOT NULL,
  pickup_lng NUMERIC(10,6) NOT NULL,
  pickup_contact_name TEXT NOT NULL,
  pickup_phone TEXT NOT NULL,

  dropoff_address TEXT NOT NULL,
  dropoff_lat NUMERIC(10,6) NOT NULL,
  dropoff_lng NUMERIC(10,6) NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,

  package_category TEXT,
  package_weight_kg NUMERIC(6,2) NOT NULL DEFAULT 1,
  package_size TEXT,
  fragile BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,

  distance_km NUMERIC(8,2) NOT NULL DEFAULT 0,
  eta_minutes INT NOT NULL DEFAULT 0,
  fare_kes NUMERIC(10,2) NOT NULL DEFAULT 0,

  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  mpesa_checkout_request_id TEXT,
  mpesa_receipt TEXT,

  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Order stops
CREATE TABLE public.order_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stop_order INT NOT NULL,
  address TEXT NOT NULL,
  lat NUMERIC(10,6) NOT NULL,
  lng NUMERIC(10,6) NOT NULL,
  recipient_name TEXT,
  recipient_phone TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_stops TO authenticated;
GRANT ALL ON public.order_stops TO service_role;
ALTER TABLE public.order_stops ENABLE ROW LEVEL SECURITY;

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_kes NUMERIC(10,2) NOT NULL,
  phone TEXT NOT NULL,
  checkout_request_id TEXT,
  merchant_request_id TEXT,
  mpesa_receipt TEXT,
  status public.payment_status NOT NULL DEFAULT 'pending',
  result_desc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Delivery proofs
CREATE TABLE public.delivery_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  photo_url TEXT,
  recipient_name TEXT,
  signature_url TEXT,
  notes TEXT,
  gps_lat NUMERIC(10,6),
  gps_lng NUMERIC(10,6),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.delivery_proofs TO authenticated;
GRANT ALL ON public.delivery_proofs TO service_role;
ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY;

-- Coverage areas
CREATE TABLE public.coverage_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  active BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT ON public.coverage_areas TO anon, authenticated;
GRANT ALL ON public.coverage_areas TO service_role;
ALTER TABLE public.coverage_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coverage areas public read" ON public.coverage_areas FOR SELECT USING (true);

INSERT INTO public.coverage_areas (name, lat, lng) VALUES
('CBD',-1.2864,36.8172),('Westlands',-1.2676,36.8108),('Kilimani',-1.2906,36.7820),
('Kileleshwa',-1.2772,36.7795),('South B',-1.3094,36.8331),('South C',-1.3196,36.8244),
('Embakasi',-1.3247,36.8939),('Umoja',-1.2833,36.8917),('Kasarani',-1.2204,36.8965),
('Roysambu',-1.2192,36.8856),('Zimmerman',-1.2128,36.8939),('Rongai',-1.3933,36.7426),
('Karen',-1.3194,36.7077),('Ruaka',-1.2089,36.7779),('Syokimau',-1.3611,36.9261),
('Kitengela',-1.4737,36.9596),('Ngong',-1.3526,36.6529);

-- Profiles RLS
CREATE POLICY "Profiles self select" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Profiles self insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles self update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- User roles RLS
CREATE POLICY "Roles self read" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Riders RLS
CREATE POLICY "Rider self read" ON public.riders FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'customer'));
CREATE POLICY "Rider self insert" ON public.riders FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Rider self update" ON public.riders FOR UPDATE USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));

-- Orders RLS
CREATE POLICY "Order customer read" ON public.orders FOR SELECT
  USING (auth.uid() = customer_id OR auth.uid() = rider_id OR public.has_role(auth.uid(),'admin')
         OR (rider_id IS NULL AND public.has_role(auth.uid(),'rider') AND status IN ('paid','rider_assigned')));
CREATE POLICY "Order customer create" ON public.orders FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Order update" ON public.orders FOR UPDATE
  USING (auth.uid() = customer_id OR auth.uid() = rider_id OR public.has_role(auth.uid(),'admin'));

-- Order stops RLS
CREATE POLICY "Stops read via order" ON public.order_stops FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.customer_id=auth.uid() OR o.rider_id=auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "Stops manage by customer" ON public.order_stops FOR ALL USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id=auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id=auth.uid())
);

-- Payments RLS
CREATE POLICY "Payments self read" ON public.payments FOR SELECT USING (auth.uid() = customer_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Payments self insert" ON public.payments FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Delivery proofs RLS
CREATE POLICY "Proofs read via order" ON public.delivery_proofs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.customer_id=auth.uid() OR o.rider_id=auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "Proofs insert by rider" ON public.delivery_proofs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.rider_id=auth.uid())
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_riders_updated BEFORE UPDATE ON public.riders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile + customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    'REF-' || upper(substr(replace(NEW.id::text,'-',''),1,6))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
