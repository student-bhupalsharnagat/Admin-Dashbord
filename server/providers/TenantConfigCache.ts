/**
 * Tenant Configuration & White Label Cache Abstraction
 * Caches active published branding and platform configuration for low-latency delivery.
 * Supports domain lookup indexing and invalidation on publish.
 */

import { WhiteLabelConfig, TenantPlatformConfig, TenantDomain } from '../../src/types';

export interface ITenantConfigCache {
  getBranding(tenantId: string): WhiteLabelConfig | null;
  setBranding(tenantId: string, branding: WhiteLabelConfig): void;
  invalidateBranding(tenantId: string): void;

  getPlatformConfig(tenantId: string): TenantPlatformConfig | null;
  setPlatformConfig(tenantId: string, config: TenantPlatformConfig): void;
  invalidatePlatformConfig(tenantId: string): void;

  getTenantIdByDomain(domain: string): string | null;
  mapDomainToTenant(domain: string, tenantId: string): void;
  removeDomainMapping(domain: string): void;

  clearAll(): void;
}

export class MemoryTenantConfigCache implements ITenantConfigCache {
  private brandingCache: Map<string, { data: WhiteLabelConfig; cachedAt: number }> = new Map();
  private configCache: Map<string, { data: TenantPlatformConfig; cachedAt: number }> = new Map();
  private domainIndex: Map<string, string> = new Map(); // domain (lowercase) -> tenantId

  private TTL_MS = 10 * 60 * 1000; // 10 minutes default TTL

  getBranding(tenantId: string): WhiteLabelConfig | null {
    const entry = this.brandingCache.get(tenantId);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.TTL_MS) {
      this.brandingCache.delete(tenantId);
      return null;
    }
    return entry.data;
  }

  setBranding(tenantId: string, branding: WhiteLabelConfig): void {
    this.brandingCache.set(tenantId, {
      data: { ...branding },
      cachedAt: Date.now()
    });
  }

  invalidateBranding(tenantId: string): void {
    this.brandingCache.delete(tenantId);
  }

  getPlatformConfig(tenantId: string): TenantPlatformConfig | null {
    const entry = this.configCache.get(tenantId);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.TTL_MS) {
      this.configCache.delete(tenantId);
      return null;
    }
    return entry.data;
  }

  setPlatformConfig(tenantId: string, config: TenantPlatformConfig): void {
    this.configCache.set(tenantId, {
      data: { ...config },
      cachedAt: Date.now()
    });
  }

  invalidatePlatformConfig(tenantId: string): void {
    this.configCache.delete(tenantId);
  }

  getTenantIdByDomain(domain: string): string | null {
    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').split(':')[0];
    return this.domainIndex.get(cleanDomain) || null;
  }

  mapDomainToTenant(domain: string, tenantId: string): void {
    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').split(':')[0];
    this.domainIndex.set(cleanDomain, tenantId);
  }

  removeDomainMapping(domain: string): void {
    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').split(':')[0];
    this.domainIndex.delete(cleanDomain);
  }

  clearAll(): void {
    this.brandingCache.clear();
    this.configCache.clear();
    this.domainIndex.clear();
  }
}

export const tenantConfigCache = new MemoryTenantConfigCache();
