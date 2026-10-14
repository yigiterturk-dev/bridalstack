-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  BridalStack — RLS Hardening + RBAC + Trial Cohort Migration                  ║
-- ║  Idempotent. Mevcut canlı DB üzerinde GÜVENLE tekrar çalıştırılabilir.        ║
-- ║                                                                                ║
-- ║  NEDEN: Mevcut tenant politikaları yalnızca USING içeriyor; WITH CHECK yok.   ║
-- ║  Bu durumda bir kullanıcı INSERT/UPDATE ile satırı BAŞKA bir tenant_id'ye     ║
-- ║  yazabilir (yazma izolasyonu eksik). Bu migration FOR ALL politikalarına      ║
-- ║  WITH CHECK ekleyerek workspace (tenant) izolasyonunu yazma yönünde de        ║
-- ║  zorunlu kılar (fail-closed).                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ───────────────────────────────────────────────────────────────────────────────
-- Yardımcı fonksiyon: geçerli kullanıcının üye olduğu tenant'lar
-- SECURITY DEFINER ile tenant_members üzerindeki RLS özyinelemesinden kaçınılır.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.user_tenant_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.user_tenant_ids() TO authenticated, anon;

-- ───────────────────────────────────────────────────────────────────────────────
-- RLS'i tüm tenant tablolarında etkinleştir (idempotent)
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'tenants','tenant_members','customers','products','orders','appointments',
    'contracts','workflows','trunk_shows','trunk_show_items',
    'services','staff_schedules','staff_services','bookings','staff_time_off',
    'try_ons','product_lifecycle_log','portal_tokens'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END IF;
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- Doğrudan tenant_id taşıyan tablolar için WITH CHECK'li politikalar.
-- Eski (yalnız USING) politikaları düşürüp, USING + WITH CHECK ile yeniden kurar.
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec record;
  -- tablo adı -> eski politika adı
  scoped jsonb := jsonb_build_object(
    'customers','tenant_customers',
    'products','tenant_products',
    'orders','tenant_orders',
    'appointments','tenant_appointments',
    'contracts','tenant_contracts',
    'workflows','tenant_workflows',
    'trunk_shows','tenant_trunk_shows',
    'services','tenant_services',
    'staff_schedules','tenant_staff_schedules',
    'bookings','tenant_bookings',
    'staff_time_off','tenant_time_off',
    'try_ons','tenant_try_ons',
    'product_lifecycle_log','tenant_lifecycle_log',
    'portal_tokens','tenant_portal_tokens'
  );
  tbl text;
  oldpol text;
BEGIN
  FOR rec IN SELECT * FROM jsonb_each_text(scoped) LOOP
    tbl := rec.key;
    oldpol := rec.value;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', oldpol, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'tenant_isolation_' || tbl, tbl);
      EXECUTE format($f$
        CREATE POLICY %I ON public.%I
          FOR ALL
          USING (tenant_id IN (SELECT public.user_tenant_ids()))
          WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
      $f$, 'tenant_isolation_' || tbl, tbl);
    END IF;
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- tenants: üye erişimi (WITH CHECK ile)
-- ───────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tenant_member_access" ON public.tenants;
DROP POLICY IF EXISTS "tenants_member_access" ON public.tenants;
CREATE POLICY "tenants_member_access" ON public.tenants
  FOR ALL
  USING (id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (id IN (SELECT public.user_tenant_ids()));

-- tenant oluşturma: kimliği doğrulanmış kullanıcı kendi adına workspace açabilir
DROP POLICY IF EXISTS "tenants_owner_insert" ON public.tenants;
CREATE POLICY "tenants_owner_insert" ON public.tenants
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────────
-- tenant_members: kullanıcı yalnızca kendi üyeliklerini görür/yönetir
-- ───────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "own_membership" ON public.tenant_members;
DROP POLICY IF EXISTS "members_self" ON public.tenant_members;
CREATE POLICY "members_self" ON public.tenant_members
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Aynı tenant'taki yöneticiler/sahipler ekibi yönetebilir (rol bazlı)
DROP POLICY IF EXISTS "members_admin_manage" ON public.tenant_members;
CREATE POLICY "members_admin_manage" ON public.tenant_members
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- ───────────────────────────────────────────────────────────────────────────────
-- Üst tablo üzerinden izole edilen yan tablolar (kendi tenant_id'si yok)
-- ───────────────────────────────────────────────────────────────────────────────
-- staff_services: member üzerinden tenant izolasyonu
DROP POLICY IF EXISTS "tenant_staff_services" ON public.staff_services;
DROP POLICY IF EXISTS "staff_services_tenant" ON public.staff_services;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff_services') THEN
    EXECUTE $f$
      CREATE POLICY "staff_services_tenant" ON public.staff_services
        FOR ALL
        USING (member_id IN (
          SELECT id FROM public.tenant_members WHERE tenant_id IN (SELECT public.user_tenant_ids())
        ))
        WITH CHECK (member_id IN (
          SELECT id FROM public.tenant_members WHERE tenant_id IN (SELECT public.user_tenant_ids())
        ));
    $f$;
  END IF;
END $$;

-- trunk_show_items: trunk_show üzerinden tenant izolasyonu
DROP POLICY IF EXISTS "tenant_trunk_show_items" ON public.trunk_show_items;
DROP POLICY IF EXISTS "trunk_show_items_tenant" ON public.trunk_show_items;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='trunk_show_items') THEN
    EXECUTE $f$
      CREATE POLICY "trunk_show_items_tenant" ON public.trunk_show_items
        FOR ALL
        USING (trunk_show_id IN (
          SELECT id FROM public.trunk_shows WHERE tenant_id IN (SELECT public.user_tenant_ids())
        ))
        WITH CHECK (trunk_show_id IN (
          SELECT id FROM public.trunk_shows WHERE tenant_id IN (SELECT public.user_tenant_ids())
        ));
    $f$;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- Genel (public) okuma politikaları — yalnızca SELECT, online rezervasyon/portal için.
-- WITH CHECK'li FOR ALL politikalarıyla birlikte var olabilir (PERMISSIVE).
-- ───────────────────────────────────────────────────────────────────────────────
-- Sözleşme imzalama (token ile) — SELECT herkese açık
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contracts') THEN
    DROP POLICY IF EXISTS "contract_public_read" ON public.contracts;
    EXECUTE 'CREATE POLICY "contract_public_read" ON public.contracts FOR SELECT USING (true);';
  END IF;
END $$;

-- Online booking sayfası: aktif servisler ve programlar herkese açık (SELECT)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='services') THEN
    DROP POLICY IF EXISTS "public_services_read" ON public.services;
    EXECUTE 'CREATE POLICY "public_services_read" ON public.services FOR SELECT USING (true);';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff_schedules') THEN
    DROP POLICY IF EXISTS "public_schedules_read" ON public.staff_schedules;
    EXECUTE 'CREATE POLICY "public_schedules_read" ON public.staff_schedules FOR SELECT USING (true);';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff_services') THEN
    DROP POLICY IF EXISTS "public_staff_services_read" ON public.staff_services;
    EXECUTE 'CREATE POLICY "public_staff_services_read" ON public.staff_services FOR SELECT USING (true);';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bookings') THEN
    DROP POLICY IF EXISTS "public_bookings_insert" ON public.bookings;
    EXECUTE 'CREATE POLICY "public_bookings_insert" ON public.bookings FOR INSERT WITH CHECK (true);';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='portal_tokens') THEN
    DROP POLICY IF EXISTS "portal_public_read" ON public.portal_tokens;
    EXECUTE 'CREATE POLICY "portal_public_read" ON public.portal_tokens FOR SELECT USING (true);';
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- RBAC: rol kısıtını owner/admin/stylist/viewer olarak güncelle
-- Mevcut 'member' kayıtları 'stylist' olarak taşınır.
-- ───────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.tenant_members DROP CONSTRAINT IF EXISTS tenant_members_role_check;
UPDATE public.tenant_members SET role = 'stylist' WHERE role = 'member';
ALTER TABLE public.tenant_members
  ADD CONSTRAINT tenant_members_role_check
  CHECK (role IN ('owner','admin','stylist','viewer'));

-- ───────────────────────────────────────────────────────────────────────────────
-- Trial → Paid funnel: cohort izleme alanları (tenants)
-- ───────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS trial_started_at timestamptz DEFAULT now();
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (now() + interval '14 days');
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS converted_at timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS signup_source text DEFAULT 'direct';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cohort_month text
  DEFAULT to_char(now(), 'YYYY-MM');
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- ───────────────────────────────────────────────────────────────────────────────
-- Onboarding wizard: taslak (draft) saklama
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_drafts (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  step        integer NOT NULL DEFAULT 1,
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE public.onboarding_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_onboarding_draft" ON public.onboarding_drafts;
CREATE POLICY "own_onboarding_draft" ON public.onboarding_drafts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────────
-- Funnel event log (in-app CTA / cohort analitiği)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.funnel_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event       text NOT NULL,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_funnel_events" ON public.funnel_events;
CREATE POLICY "tenant_funnel_events" ON public.funnel_events
  FOR ALL
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE INDEX IF NOT EXISTS idx_funnel_events_tenant ON public.funnel_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_event ON public.funnel_events(event);
CREATE INDEX IF NOT EXISTS idx_tenants_cohort ON public.tenants(cohort_month);
