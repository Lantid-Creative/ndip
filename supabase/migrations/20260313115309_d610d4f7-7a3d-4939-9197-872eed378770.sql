SELECT net.http_post(
  url := 'https://xucoadixeyuowowcrkwg.supabase.co/functions/v1/daily-report',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Y29hZGl4ZXl1b3dvd2Nya3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODAzNTQsImV4cCI6MjA4ODg1NjM1NH0.zH4eBeJg4PB3a70HD7DBw4eJobebnrvdTv8DvOUwGHY"}'::jsonb,
  body := '{}'::jsonb
) AS request_id;