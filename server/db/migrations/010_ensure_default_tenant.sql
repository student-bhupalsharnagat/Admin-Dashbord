-- Migration 010: Ensure default tenant vertex-default exists for live backfill and projections
INSERT INTO tenants (
  id, name, code, subdomain, custom_domain, plan, status,
  owner_name, owner_email, region, user_count, max_users,
  monthly_volume, monthly_revenue
) VALUES (
  'vertex-default', 'Vertex Default', 'VERTEX-DEFAULT', 'vertex-default',
  'trade.vertex-default.com', 'ENTERPRISE', 'ACTIVE',
  'Platform Admin', 'admin@tradematrix.com', 'ap-south-1', 1000, 10000,
  '₹100M', '₹1.0M'
)
ON CONFLICT (id) DO UPDATE SET
  status = 'ACTIVE',
  updated_at = CURRENT_TIMESTAMP;

-- Ensure tenant branding exists
INSERT INTO tenant_branding (
  id, tenant_id, company_name, portal_name, tagline, logo_url, favicon_url, primary_color, accent_color
) VALUES (
  'BRD-vertex-default', 'vertex-default', 'Vertex Default', 'Vertex Default Admin',
  'Next-Gen Multi-Asset Institutional Execution',
  'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=128&q=80',
  'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=32&q=80',
  '#3b82f6', '#10b981'
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Ensure platform settings exist
INSERT INTO platform_settings (
  id, tenant_id, web_trading_enabled, web_version, web_maintenance_mode,
  mobile_android_enabled, mobile_android_version, mobile_ios_enabled, mobile_ios_version,
  api_enabled, api_rate_limit, ip_whitelist_enabled, allowed_ips
) VALUES (
  'SET-vertex-default', 'vertex-default', true, 'v4.8.2-stable', false,
  true, 'v2.14.0', true, 'v2.14.0',
  true, 120, false, ARRAY[]::TEXT[]
)
ON CONFLICT (tenant_id) DO NOTHING;
