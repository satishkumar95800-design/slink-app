export interface Tenant {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantBranding {
  logoUrl: string | null;
  coverPhotoUrls: string[];
  primaryColor: string;
  accentColor: string;
  schoolName: string;
  address: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
}

export interface TenantFeatureFlags {
  installmentPlans: boolean;
  inAppMessaging: boolean;
  transportFeeModule: boolean;
  photoGallery: boolean;
}

export interface CreateTenantDto {
  slug: string;
  name: string;
  timezone?: string;
}

export interface UpdateTenantBrandingDto {
  logoUrl?: string;
  coverPhotoUrls?: string[];
  primaryColor?: string;
  accentColor?: string;
  address?: string;
  contactPhone?: string;
  contactEmail?: string;
  websiteUrl?: string;
}
