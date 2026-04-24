-- 1. Create the app_data table
CREATE TABLE public.app_data (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    water_data JSONB DEFAULT '{}'::jsonb,
    mood_data JSONB DEFAULT '{}'::jsonb,
    habits_data JSONB DEFAULT '[]'::jsonb,
    tasks_data JSONB DEFAULT '{}'::jsonb,
    calendar_data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Enable Row Level Security (RLS) for security
ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

-- 3. Create Policy: Users can only select their own data
CREATE POLICY "Users can view own app data"
ON public.app_data
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Create Policy: Users can insert their own data
CREATE POLICY "Users can insert own app data"
ON public.app_data
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 5. Create Policy: Users can update their own data
CREATE POLICY "Users can update own app data"
ON public.app_data
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
