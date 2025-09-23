-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to run daily notifications every day at 8 AM (Brazil timezone)
SELECT cron.schedule(
  'daily-bills-notifications',
  '0 11 * * *', -- 11 AM UTC = 8 AM Brazil (GMT-3)
  $$
  SELECT
    net.http_post(
        url:='https://nbetcemynduklddhqgyu.supabase.co/functions/v1/daily-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iZXRjZW15bmR1a2xkZGhxZ3l1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQzOTcyOSwiZXhwIjoyMDczMDE1NzI5fQ.vbU3jJ6SCZV7yNz_gJPqGCCRMz2y-5Yt6QKsZMUOm3Y"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);