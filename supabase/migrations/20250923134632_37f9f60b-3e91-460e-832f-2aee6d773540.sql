-- Create extensions schema for better security
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pg_cron extension to extensions schema
DROP EXTENSION IF EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Move pg_net extension to extensions schema  
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Update the cron job to use the extensions schema
SELECT extensions.cron.unschedule('daily-bills-notifications');

-- Create the cron job again with proper schema reference
SELECT extensions.cron.schedule(
  'daily-bills-notifications',
  '0 11 * * *', -- 11 AM UTC = 8 AM Brazil (GMT-3)
  $$
  SELECT
    extensions.net.http_post(
        url:='https://nbetcemynduklddhqgyu.supabase.co/functions/v1/daily-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iZXRjZW15bmR1a2xkZGhxZ3l1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQzOTcyOSwiZXhwIjoyMDczMDE1NzI5fQ.vbU3jJ6SCZV7yNz_gJPqGCCRMz2y-5Yt6QKsZMUOm3Y"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);