-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily notifications at 8 AM local time
-- This will run every day at 8 AM and call the edge function
SELECT cron.schedule(
  'daily-bills-notification',
  '0 8 * * *', -- 8 AM every day
  $$
  SELECT
    net.http_post(
        url:='https://nbetcemynduklddhqgyu.supabase.co/functions/v1/daily-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iZXRjZW15bmR1a2xkZGhxZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0Mzk3MjksImV4cCI6MjA3MzAxNTcyOX0.v7WQX5uFdPm4t35V6x6SZmRl2dcGHYzIDU75subZdZQ"}'::jsonb,
        body:='{"scheduled": true, "time": "08:00"}'::jsonb
    ) as request_id;
  $$
);