-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  BridalStack — Multi-tenant modüler CRM altyapısı                            ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. TENANTS (Kiracılar / İşletmeler)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tenants (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  owner_id        uuid NOT NULL REFERENCES auth.users(id),
  packs           text[] DEFAULT '{base}',
  plan            text DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth', 'enterprise')),
  settings        jsonb DEFAULT '{}'::jsonb,
  logo_url        text,
  primary_color   text DEFAULT '#0A0A0C',
  accent_color    text DEFAULT '#8a6a3f',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. TENANT MEMBERS (Üyelikler)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. CUSTOMERS (Tenant-scoped)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.customers (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  phone         text,
  email         text,
  status        text DEFAULT 'new',
  notes         text,
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. PRODUCTS (Tenant-scoped)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.products (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  barcode         text,
  sku             text,
  category        text,
  price           numeric(12,2) DEFAULT 0,
  cost            numeric(12,2) DEFAULT 0,
  stock_quantity  integer DEFAULT 0,
  description     text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. ORDERS (Tenant-scoped)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.orders (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ref_no            text NOT NULL,
  customer_id       uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_type        text DEFAULT 'sale',
  status            text DEFAULT 'draft',
  order_date        date DEFAULT CURRENT_DATE,
  delivery_date     date,
  sales_person      text,
  list_total        numeric(12,2) DEFAULT 0,
  discounted_total  numeric(12,2) DEFAULT 0,
  deposit_amount    numeric(12,2) DEFAULT 0,
  remaining_balance numeric(12,2) DEFAULT 0,
  notes             text,
  metadata          jsonb DEFAULT '{}'::jsonb,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(tenant_id, ref_no)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. APPOINTMENTS (Tenant-scoped)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.appointments (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id       uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title             text,
  description       text,
  appointment_date  timestamptz NOT NULL,
  status            text DEFAULT 'pending',
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS Policies — Tenant Isolation
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Tenant members can see their tenant
CREATE POLICY "tenant_member_access" ON public.tenants
  FOR ALL USING (
    id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
  );

-- Members can see their membership
CREATE POLICY "own_membership" ON public.tenant_members
  FOR ALL USING (user_id = auth.uid());

-- Tenant-scoped data access via membership
CREATE POLICY "tenant_customers" ON public.customers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
  );

CREATE POLICY "tenant_products" ON public.products
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
  );

CREATE POLICY "tenant_orders" ON public.orders
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
  );

CREATE POLICY "tenant_appointments" ON public.appointments
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON public.tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON public.appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
