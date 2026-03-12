
ALTER TABLE public.subscribers
  ADD COLUMN first_name text,
  ADD COLUMN last_name text,
  ADD COLUMN preferred_hour integer DEFAULT 7;

CREATE POLICY "Anyone can select subscribers by email"
  ON public.subscribers FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update subscribers"
  ON public.subscribers FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
