import { db } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  Timestamp,
  DocumentData 
} from 'firebase/firestore';
import type { FieldValue } from 'firebase/firestore';

export type UserRole = 'seeker' | 'provider' | 'admin' | 'owner';

export interface UserProfile {
  uid: string;
  email: string | null;
  role: UserRole;
  displayName?: string;
  photoURL?: string;
  phone?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  createdAt?: Timestamp | FieldValue | null;
  plan?: 'free' | 'basic' | 'pro' | 'enterprise';
  status?: 'active' | 'disabled' | 'pending';
  pricingGate?: {
    mode?: 'force_show' | 'force_hide' | null;
    showAt?: Timestamp | null;
    enforceAfterMonths?: number | null;
  } | null;
}

export async function createUserProfile(
  uid: string,
  email: string,
  role: UserRole = 'seeker'
): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    const data: UserProfile = {
      uid,
      email,
      role,
      displayName: email.split('@')[0],
      createdAt: serverTimestamp(),
      plan: 'free',
      status: 'active',
    };
    await setDoc(userRef, data);
    console.log(`User profile created for UID: ${uid}`);
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw new Error(`Failed to create user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    
    // Check if document exists first
    const docSnap = await getDoc(userRef);
    
    if (docSnap.exists()) {
      // Document exists, update it
      await updateDoc(userRef, {
        ...data,
        // Ensure uid is not overwritten
        uid: docSnap.data().uid
      });
    } else {
      // Document doesn't exist, create it with merge
      await setDoc(userRef, { 
        uid, 
        ...data,
        createdAt: serverTimestamp(),
        plan: data.plan || 'free',
        status: data.status || 'active',
        role: data.role || 'seeker'
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw new Error(`Failed to update user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Validate that we have the required fields
      if (!data.uid || !data.role) {
        console.warn(`User profile for UID: ${uid} is missing required fields`);
        return null;
      }
      
      return {
        uid: data.uid,
        email: data.email || null,
        role: data.role as UserRole,
        displayName: data.displayName,
        photoURL: data.photoURL,
        phone: data.phone || null,
        whatsapp: data.whatsapp || null,
        city: data.city || null,
        createdAt: data.createdAt || null,
        plan: data.plan || 'free',
        status: data.status || 'active',
        pricingGate: data.pricingGate || null,
      };
    } else {
      console.warn(`No user profile found for UID: ${uid}`);
      return null;
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

// Helper function to check if user has specific role
export function hasRole(userProfile: UserProfile | null, role: UserRole | UserRole[]): boolean {
  if (!userProfile) return false;
  
  const rolesToCheck = Array.isArray(role) ? role : [role];
  return rolesToCheck.includes(userProfile.role);
}

// Helper function to check if user is active
export function isUserActive(userProfile: UserProfile | null): boolean {
  return userProfile?.status === 'active';
}

// Helper function to get user display name
export function getUserDisplayName(userProfile: UserProfile | null): string {
  if (!userProfile) return 'Unknown User';
  return userProfile.displayName || userProfile.email?.split('@')[0] || 'Unknown User';
}