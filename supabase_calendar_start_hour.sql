-- Supabase SQL Editor'da bir kez çalıştır: takvim senkronu timeline slotu (ör. 9, 9.5) için gerekli.
-- Uygulama calendar_events satırlarını start_hour ile yazar; sütun yoksa insert başarısız olur.

ALTER TABLE public.calendar_events
    ADD COLUMN IF NOT EXISTS start_hour DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.calendar_events.start_hour IS 'Gün içi zaman çizelgesi slotu (örn. 9 = 09:00, 9.5 = 09:30).';
