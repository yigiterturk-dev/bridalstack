-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  BridalStack — Analytics + Public Booking (pending) + Installment Automation  ║
-- ║  IDEMPOTENT. Mevcut canlı DB üzerinde GÜVENLE tekrar çalıştırılabilir.        ║
-- ║                                                                                ║
-- ║  SAHİBİN UYGULAMASI GEREKİR (owner applies). Bu dosya:                         ║
-- ║   1) bookings.status CHECK kısıtına 'pending' ekler (public booking onay      ║
-- ║      bekleyen kayıt yazsın diye).                                              ║
-- ║   2) installments + installment_reminders tablolarını oluşturur (taksit       ║
-- ║      planı otomasyonu için), RLS + index ile.                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. bookings.status: 'pending' değerini destekle (online rezervasyon onay bekler)
--    Eski CHECK kısıtı yalnızca confirmed/completed/cancelled/no_show içeriyordu.
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  conname text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bookings') THEN
    -- Mevcut status CHECK kısıtını bul ve düşür (idempotent)
    FOR conname IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = 'public'
        AND rel.relname = 'bookings'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%status%'
    LOOP
      EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT %I', conname);
    END LOOP;

    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_status_check
      CHECK (status IN ('pending','confirmed','completed','cancelled','no_show'));
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. Installments (taksit planı) + reminders (hatırlatma kuyruğu)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.installments (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id        uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id     uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  installment_no  integer NOT NULL DEFAULT 1,
  total_count     integer NOT NULL DEFAULT 1,
  amount          numeric(12,2) NOT NULL DEFAULT 0,
  due_date        date NOT NULL,
  paid_at         timestamptz,
  -- pending: ödenmedi, ileri tarihli | due: bugün/yakın | overdue: gecikti | paid: ödendi | cancelled
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','due','overdue','paid','cancelled')),
  -- Stripe ile otomatik tahsilat env'e bağlı; şimdilik schedule/reminder kurulur.
  stripe_subscription_item_id text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.installment_reminders (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  installment_id  uuid NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  -- upcoming: vadeden önce | due_today | overdue
  kind            text NOT NULL DEFAULT 'upcoming'
                    CHECK (kind IN ('upcoming','due_today','overdue')),
  sent_at         timestamptz DEFAULT now(),
  channel         text DEFAULT 'email',
  UNIQUE (installment_id, kind)
);

-- RLS
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- installments: tenant izolasyonu (USING + WITH CHECK), fail-closed
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='installments' AND policyname='tenant_installments') THEN
    EXECUTE 'CREATE POLICY "tenant_installments" ON public.installments
             FOR ALL
             USING (tenant_id IN (SELECT public.user_tenant_ids()))
             WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()))';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='installment_reminders' AND policyname='tenant_installment_reminders') THEN
    EXECUTE 'CREATE POLICY "tenant_installment_reminders" ON public.installment_reminders
             FOR ALL
             USING (tenant_id IN (SELECT public.user_tenant_ids()))
             WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()))';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_installments_tenant ON public.installments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_installments_due ON public.installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments(status);
CREATE INDEX IF NOT EXISTS idx_installment_reminders_tenant ON public.installment_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_installment_reminders_inst ON public.installment_reminders(installment_id);

-- ───────────────────────────────────────────────────────────────────────────────
-- NOT: user_tenant_ids() fonksiyonu 2026-rls-hardening.sql ile gelir. Eğer bu
-- migration ondan ÖNCE çalıştırılırsa, yedek olarak inline alt-sorgulu politikalar
-- üretmek yerine önce 2026-rls-hardening.sql çalıştırın.
-- ───────────────────────────────────────────────────────────────────────────────
