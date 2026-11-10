-- ==========================================
-- 1. CLEANUP EXISTING OBJECTS (IF RE-RUNNING)
-- ==========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP TABLE IF EXISTS public.rental_requests CASCADE;
DROP TABLE IF EXISTS public.admin CASCADE;
DROP TABLE IF EXISTS public.drivers CASCADE;
DROP TABLE IF EXISTS public.passengers CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ==========================================
-- 2. CREATE TABLES
-- ==========================================

-- USERS TABLE
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('passenger', 'driver', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PASSENGERS TABLE
CREATE TABLE public.passengers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userid UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    first_name TEXT,
    middle_name TEXT,
    last_name TEXT,
    suffix_name TEXT,
    age INTEGER,
    phonenumber TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DRIVERS TABLE
CREATE TABLE public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userid UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    first_name TEXT,
    middle_name TEXT,
    last_name TEXT,
    suffix_name TEXT,
    age INTEGER,
    licensenumber TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    isavailableforrental BOOLEAN DEFAULT FALSE,
    rentalrate NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADMIN TABLE
CREATE TABLE public.admin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userid UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    first_name TEXT,
    middle_name TEXT,
    last_name TEXT,
    suffix_name TEXT,
    age INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RENTAL REQUESTS TABLE
CREATE TABLE public.rental_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID REFERENCES public.passengers(userid) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
    pickup_location TEXT NOT NULL,
    destination TEXT NOT NULL,
    agreed_rate NUMERIC,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_requests ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. RLS POLICIES
-- ==========================================

-- Users Policies
CREATE POLICY "Allow authenticated users to read users" ON public.users
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to insert their own user record" ON public.users
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to update their own user record" ON public.users
    FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Allow users or admins to delete user records" ON public.users
    FOR DELETE TO authenticated USING (true);


-- Passengers Policies
CREATE POLICY "Allow read access to passengers" ON public.passengers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow passenger insert" ON public.passengers
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = userid);

CREATE POLICY "Allow admin or owner update passengers" ON public.passengers
    FOR UPDATE TO authenticated
    USING (auth.uid() = userid OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (auth.uid() = userid OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Allow admin or owner delete passengers" ON public.passengers
    FOR DELETE TO authenticated
    USING (auth.uid() = userid OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));


-- Drivers Policies
CREATE POLICY "Allow read access to drivers" ON public.drivers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow driver insert" ON public.drivers
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = userid);

CREATE POLICY "Allow admin or owner update drivers" ON public.drivers
    FOR UPDATE TO authenticated
    USING (auth.uid() = userid OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (auth.uid() = userid OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Allow admin or owner delete drivers" ON public.drivers
    FOR DELETE TO authenticated
    USING (auth.uid() = userid OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));


-- Admin Policies
CREATE POLICY "Allow read access to admin" ON public.admin
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin insert" ON public.admin
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = userid);

CREATE POLICY "Allow admin update" ON public.admin
    FOR UPDATE TO authenticated USING (auth.uid() = userid);

CREATE POLICY "Allow admin delete" ON public.admin
    FOR DELETE TO authenticated USING (true);


-- Rental Requests Policies
CREATE POLICY "Allow users to view their rental requests" ON public.rental_requests
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow passengers to create rental requests" ON public.rental_requests
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = passenger_id);

CREATE POLICY "Allow users to update rental requests" ON public.rental_requests
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow users to delete rental requests" ON public.rental_requests
    FOR DELETE TO authenticated USING (
      passenger_id IN (SELECT userid FROM passengers WHERE userid = auth.uid())
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );


-- ==========================================
-- 5. AUTOMATIC SIGNUP TRIGGER FUNCTION
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
BEGIN
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'passenger');

    -- Insert into public.users
    INSERT INTO public.users (id, email, role)
    VALUES (NEW.id, NEW.email, user_role);

    -- Insert profile metadata based on role
    IF user_role = 'driver' THEN
        INSERT INTO public.drivers (
            userid, first_name, middle_name, last_name, suffix_name, age, licensenumber
        )
        VALUES (
            NEW.id,
            NEW.raw_user_meta_data->>'first_name',
            NEW.raw_user_meta_data->>'middle_name',
            NEW.raw_user_meta_data->>'last_name',
            NEW.raw_user_meta_data->>'suffix_name',
            COALESCE((NEW.raw_user_meta_data->>'age')::integer, 0),
            NEW.raw_user_meta_data->>'licensenumber'
        );

    ELSIF user_role = 'passenger' THEN
        INSERT INTO public.passengers (
            userid, first_name, middle_name, last_name, suffix_name, age, phonenumber, address
        )
        VALUES (
            NEW.id,
            NEW.raw_user_meta_data->>'first_name',
            NEW.raw_user_meta_data->>'middle_name',
            NEW.raw_user_meta_data->>'last_name',
            NEW.raw_user_meta_data->>'suffix_name',
            COALESCE((NEW.raw_user_meta_data->>'age')::integer, 0),
            NEW.raw_user_meta_data->>'phonenumber',
            NEW.raw_user_meta_data->>'address'
        );

    ELSIF user_role = 'admin' THEN
        INSERT INTO public.admin (userid)
        VALUES (NEW.id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 6. REALTIME REPLICATION
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;