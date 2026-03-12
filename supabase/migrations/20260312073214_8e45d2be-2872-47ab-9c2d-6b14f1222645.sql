
-- Create subscriber_preferences table
CREATE TABLE public.subscriber_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid REFERENCES public.subscribers(id) ON DELETE CASCADE NOT NULL,
  topic text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(subscriber_id, topic)
);

-- Enable RLS
ALTER TABLE public.subscriber_preferences ENABLE ROW LEVEL SECURITY;

-- Allow public insert (matching subscriber pattern)
CREATE POLICY "Anyone can insert preferences"
ON public.subscriber_preferences
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow public select by subscriber_id (needed for manage page)
CREATE POLICY "Anyone can view preferences by subscriber"
ON public.subscriber_preferences
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow public update (for toggling preferences)
CREATE POLICY "Anyone can update preferences"
ON public.subscriber_preferences
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Allow public delete
CREATE POLICY "Anyone can delete preferences"
ON public.subscriber_preferences
FOR DELETE
TO anon, authenticated
USING (true);
