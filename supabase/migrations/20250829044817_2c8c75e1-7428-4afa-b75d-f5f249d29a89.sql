-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar o cron job para automação de promoções (executa diariamente às 6:00 AM)
SELECT cron.schedule(
  'promocoes-automation-daily',
  '0 6 * * *', -- Todo dia às 6:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://coodawnbnakvugwngtju.supabase.co/functions/v1/promocoes-automation',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvb2Rhd25ibmFrdnVnd25ndGp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNzc4MzksImV4cCI6MjA4Njk1MzgzOX0.8yK_MeokFt6Vzpr03RNYClkDPmBJo-Q6fr00gN6ehi4"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);