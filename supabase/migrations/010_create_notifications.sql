-- Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('success', 'info', 'warning', 'error')),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
    ON public.notifications FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for all users"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Enable update for all users"
    ON public.notifications FOR UPDATE
    USING (true);
