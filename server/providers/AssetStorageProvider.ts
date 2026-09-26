/**
 * Asset Storage Provider Abstraction
 * Supports Logo, Favicon, Login background, and App icon storage.
 * Designed for local development with drop-in support for S3/GCS in production.
 */

export interface StoredAsset {
  id: string;
  tenant_id: string;
  asset_type: 'logo' | 'logo_light' | 'logo_dark' | 'favicon' | 'app_icon' | 'login_background';
  filename: string;
  mime_type: string;
  size_bytes: number;
  public_url: string;
  contentBuffer?: Buffer;
  created_at: string;
}

export interface IAssetStorageProvider {
  uploadAsset(
    tenantId: string,
    assetType: StoredAsset['asset_type'],
    filename: string,
    mimeType: string,
    contentBase64OrUrl: string
  ): Promise<StoredAsset>;

  getAsset(id: string): Promise<StoredAsset | null>;
  listTenantAssets(tenantId: string): Promise<StoredAsset[]>;
  deleteAsset(id: string): Promise<boolean>;
}

export class LocalAssetStorageProvider implements IAssetStorageProvider {
  private assets: Map<string, StoredAsset> = new Map();

  constructor() {
    // Seed default tenant assets
    this.seedDefaultAssets();
  }

  private seedDefaultAssets() {
    const defaultList: StoredAsset[] = [
      {
        id: 'ast-alpha-logo',
        tenant_id: 'TNT-001',
        asset_type: 'logo',
        filename: 'alpha_prime_logo.svg',
        mime_type: 'image/svg+xml',
        size_bytes: 4096,
        public_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
        created_at: new Date().toISOString()
      },
      {
        id: 'ast-apex-logo',
        tenant_id: 'TNT-002',
        asset_type: 'logo',
        filename: 'apex_securities_logo.svg',
        mime_type: 'image/svg+xml',
        size_bytes: 3800,
        public_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
        created_at: new Date().toISOString()
      },
      {
        id: 'ast-zenith-logo',
        tenant_id: 'TNT-003',
        asset_type: 'logo',
        filename: 'zenith_quant_logo.svg',
        mime_type: 'image/svg+xml',
        size_bytes: 3900,
        public_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
        created_at: new Date().toISOString()
      }
    ];

    defaultList.forEach(a => this.assets.set(a.id, a));
  }

  async uploadAsset(
    tenantId: string,
    assetType: StoredAsset['asset_type'],
    filename: string,
    mimeType: string,
    contentBase64OrUrl: string
  ): Promise<StoredAsset> {
    // Validate supported image MIME types
    const allowedMimes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/jpg', 'image/webp'];
    const cleanMime = (mimeType || '').toLowerCase();
    if (!allowedMimes.includes(cleanMime)) {
      throw new Error(`Unsupported file type: ${mimeType}. Allowed formats: PNG, SVG, JPEG/JPG, WebP.`);
    }

    const id = `ast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    let publicUrl = contentBase64OrUrl;
    let contentBuffer: Buffer | undefined;

    if (contentBase64OrUrl.startsWith('http://') || contentBase64OrUrl.startsWith('https://')) {
      publicUrl = contentBase64OrUrl;
    } else {
      try {
        const base64Data = contentBase64OrUrl.includes(';base64,')
          ? contentBase64OrUrl.split(';base64,')[1]
          : contentBase64OrUrl;
        contentBuffer = Buffer.from(base64Data, 'base64');
        
        // Validate max file size (5MB)
        if (contentBuffer.length > 5 * 1024 * 1024) {
          throw new Error('File size exceeds the 5MB maximum limit.');
        }

        publicUrl = `/api/assets/${id}`;
      } catch (err: any) {
        if (err.message?.includes('File size exceeds')) throw err;
        publicUrl = contentBase64OrUrl;
      }
    }

    const newAsset: StoredAsset & { publicUrl?: string } = {
      id,
      tenant_id: tenantId,
      asset_type: assetType,
      filename,
      mime_type: cleanMime,
      size_bytes: contentBuffer ? contentBuffer.length : Math.round(contentBase64OrUrl.length * 0.75),
      public_url: publicUrl,
      publicUrl,
      contentBuffer,
      created_at: new Date().toISOString()
    };

    this.assets.set(id, newAsset);
    return newAsset;
  }

  async getAsset(id: string): Promise<StoredAsset | null> {
    return this.assets.get(id) || null;
  }

  async listTenantAssets(tenantId: string): Promise<StoredAsset[]> {
    return Array.from(this.assets.values()).filter(a => a.tenant_id === tenantId);
  }

  async deleteAsset(id: string): Promise<boolean> {
    return this.assets.delete(id);
  }
}

export const assetStorage = new LocalAssetStorageProvider();
