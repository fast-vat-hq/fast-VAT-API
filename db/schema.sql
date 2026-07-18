-- Fast-VAT-API schema. Run once in the Supabase SQL editor.

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ip text not null,
  ip_country text,
  bin_country text,
  evidence_match boolean not null,
  customer_country text,
  vat_rate numeric(5, 2),
  amount bigint not null,
  vat_amount bigint,
  vat_number text,
  vies_valid boolean,
  notes text
);

create index if not exists audit_logs_created_at_idx on audit_logs (created_at);

create table if not exists vies_company_cache (
  vat_number text primary key,
  country_code text not null,
  valid boolean not null,
  company_name text,
  checked_at timestamptz not null default now()
);

create table if not exists bin_country_cache (
  bin text primary key,
  country text,
  checked_at timestamptz not null default now()
);
