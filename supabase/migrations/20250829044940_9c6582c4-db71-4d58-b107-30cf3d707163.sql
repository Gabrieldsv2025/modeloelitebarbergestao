-- Recriar as extensões no schema extensions
-- Primeiro, recriar o cron job referenciando as extensões no schema correto

-- Primeiro, cancelar o cron job existente
SELECT cron.unschedule('promocoes-automation-daily');

-- Remover as extensões do schema public
DROP EXTENSION IF EXISTS pg_cron CASCADE;
DROP EXTENSION IF EXISTS pg_net CASCADE;

-- Criar o schema extensions se não existir  
CREATE SCHEMA IF NOT EXISTS extensions;

-- Recriar as extensões no schema extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Recriar o cron job usando as funções do schema extensions
SELECT extensions.cron.schedule(
  'promocoes-automation-daily',
  '0 6 * * *', -- Todo dia às 6:00 AM
  $$
  SELECT
    extensions.net.http_post(
        url:='https://coodawnbnakvugwngtju.supabase.co/functions/v1/promocoes-automation',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvb2Rhd25ibmFrdnVnd25ndGp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNzc4MzksImV4cCI6MjA4Njk1MzgzOX0.8yK_MeokFt6Vzpr03RNYClkDPmBJo-Q6fr00gN6ehi4"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);