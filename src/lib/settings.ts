import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, DocumentData } from 'firebase/firestore';

export type FeaturesSettings = {
  pricingEnabled: boolean;
  showForProviders: boolean;
  showForSeekers: boolean;
  enforceAfterMonths: number;
  lockAllToPricing?: boolean;
  lockProvidersToPricing?: boolean;
  lockSeekersToPricing?: boolean;
};

export const DEFAULT_FEATURES: FeaturesSettings = {
  pricingEnabled: true,
  showForProviders: false,
  showForSeekers: false,
  enforceAfterMonths: 3,
  lockAllToPricing: false,
  lockProvidersToPricing: false,
  lockSeekersToPricing: false,
};

// Type guard to validate FeaturesSettings
function isValidFeaturesSettings(data: any): data is Partial<FeaturesSettings> {
  if (typeof data !== 'object' || data === null) return false;
  
  // Check that all properties are the correct type if they exist
  if (data.pricingEnabled !== undefined && typeof data.pricingEnabled !== 'boolean') return false;
  if (data.showForProviders !== undefined && typeof data.showForProviders !== 'boolean') return false;
  if (data.showForSeekers !== undefined && typeof data.showForSeekers !== 'boolean') return false;
  if (data.enforceAfterMonths !== undefined && typeof data.enforceAfterMonths !== 'number') return false;
  if (data.lockAllToPricing !== undefined && typeof data.lockAllToPricing !== 'boolean') return false;
  if (data.lockProvidersToPricing !== undefined && typeof data.lockProvidersToPricing !== 'boolean') return false;
  if (data.lockSeekersToPricing !== undefined && typeof data.lockSeekersToPricing !== 'boolean') return false;
  
  return true;
}

export async function getFeatures(): Promise<FeaturesSettings> {
  try {
    const ref = doc(db, 'settings', 'features');
    const snap = await getDoc(ref);
    
    if (!snap.exists()) {
      console.log('Features settings document does not exist, using defaults');
      return DEFAULT_FEATURES;
    }

    const data = snap.data();
    
    // Validate the data structure
    if (!isValidFeaturesSettings(data)) {
      console.warn('Invalid features settings data structure, using defaults:', data);
      return DEFAULT_FEATURES;
    }

    // Merge with defaults, ensuring all required fields are present
    const mergedFeatures: FeaturesSettings = {
      pricingEnabled: data.pricingEnabled ?? DEFAULT_FEATURES.pricingEnabled,
      showForProviders: data.showForProviders ?? DEFAULT_FEATURES.showForProviders,
      showForSeekers: data.showForSeekers ?? DEFAULT_FEATURES.showForSeekers,
      enforceAfterMonths: data.enforceAfterMonths ?? DEFAULT_FEATURES.enforceAfterMonths,
      lockAllToPricing: data.lockAllToPricing ?? DEFAULT_FEATURES.lockAllToPricing,
      lockProvidersToPricing: data.lockProvidersToPricing ?? DEFAULT_FEATURES.lockProvidersToPricing,
      lockSeekersToPricing: data.lockSeekersToPricing ?? DEFAULT_FEATURES.lockSeekersToPricing,
    };

    console.log('Loaded features settings:', mergedFeatures);
    return mergedFeatures;

  } catch (error) {
    console.error('Error fetching features settings:', error);
    
    // Don't throw errors that would break the app - return defaults instead
    return DEFAULT_FEATURES;
  }
}

export async function saveFeatures(next: Partial<FeaturesSettings>): Promise<void> {
  try {
    // Validate the input data
    if (!isValidFeaturesSettings(next)) {
      throw new Error('Invalid features settings data provided');
    }

    const ref = doc(db, 'settings', 'features');
    
    // Get current settings to preserve any missing fields
    const current = await getFeatures();
    const mergedSettings = { ...current, ...next };
    
    await setDoc(ref, mergedSettings, { merge: true });
    console.log('Features settings saved successfully:', mergedSettings);
    
  } catch (error) {
    console.error('Error saving features settings:', error);
    throw new Error(`Failed to save features settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to check if pricing should be shown to a specific user type
export function shouldShowPricing(
  features: FeaturesSettings, 
  userType: 'provider' | 'seeker' | 'all'
): boolean {
  if (!features.pricingEnabled) return false;
  
  switch (userType) {
    case 'provider':
      return features.showForProviders;
    case 'seeker':
      return features.showForSeekers;
    case 'all':
      return features.showForProviders || features.showForSeekers;
    default:
      return false;
  }
}

// Helper function to check if user should be locked to pricing
export function shouldLockToPricing(
  features: FeaturesSettings,
  userRole?: string,
  userPlan?: string
): boolean {
  // Don't lock paid users
  if (userPlan && userPlan !== 'free') return false;

  if (features.lockAllToPricing) return true;
  
  if (userRole === 'provider' && features.lockProvidersToPricing) return true;
  if (userRole === 'seeker' && features.lockSeekersToPricing) return true;
  
  return false;
}

// Helper to get feature description for UI
export function getFeatureDescription(features: FeaturesSettings): string {
  const parts: string[] = [];
  
  if (features.lockAllToPricing) parts.push('All users locked to pricing');
  if (features.lockProvidersToPricing) parts.push('Providers locked to pricing');
  if (features.lockSeekersToPricing) parts.push('Seekers locked to pricing');
  
  if (parts.length === 0) parts.push('No active pricing locks');
  
  return parts.join(', ');
}