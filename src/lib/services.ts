import { auth, db, storage } from './firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export type ServiceImage = {
  url: string;
  hint?: string;
  publicId?: string; // Cloudinary public_id if available
};

export type SubService = {
  id: string;
  title: string;
  price: number;
  unit?: string;
  description?: string;
};

  export type Service = {
    id?: string;
    title: string;
    description: string;
    price: number;
    category: string;
    city: string;
    area: string;
    availabilityNote?: string;
    images: ServiceImage[];
    contactPhone?: string;
    contactWhatsapp?: string;
    videoUrl?: string;
    // New: multiple YouTube links (preferred) and social links
    videoUrls?: string[];
    facebookUrl?: string;
    telegramUrl?: string;
    // Optional map URL to external maps (Google Maps/OSM)
    mapUrl?: string;
    providerId: string;
    providerName?: string | null;
    providerEmail?: string | null;
    subservices?: SubService[];
    status?: 'pending' | 'approved' | 'rejected';
    // Optional geolocation for map; when absent, UI falls back to city centroid
    lat?: number;
    lng?: number;
    // Boosting / promotion flags
    featured?: boolean;      // manually featured
    priority?: number;       // 0..N, higher floats to top client-side
    // Simple share metric (owner-incremented client-side)
    shareCount?: number;     // total times owner pressed Share
    createdAt?: unknown;
  };

export async function uploadServiceImages(
  providerId: string,
  files: File[]
): Promise<ServiceImage[]> {
  const uploads = files.map(async (file: File, index: number) => {
    const path = `services/${providerId}/${Date.now()}_${index}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { url } as ServiceImage;
  });
  return Promise.all(uploads);
}

// Internal fallback used when API is not available
export async function createServiceDirect(data: Omit<Service, 'id' | 'createdAt'>) {
  const colRef = collection(db, 'services');
  const payload = {
    ...data,
    subservices: Array.isArray((data as any).subservices) ? (data as any).subservices : [],
    providerName: (data as any).providerName ?? null,
    providerEmail: (data as any).providerEmail ?? null,
    status: 'pending',
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(colRef, payload);
  return docRef.id;
}

// Default creation path: call server API to enforce provider limits
export async function createService(data: Omit<Service, 'id' | 'createdAt'>) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  let res: Response;
  try {
    const token = await user.getIdToken(/* forceRefresh */ true);
    res = await fetch('/api/services/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  } catch {
    // Network/route unavailable: allow dev fallback
    return await createServiceDirect(data);
  }
  let json: any = {};
  try { json = await res.json(); } catch {}
  if (!res.ok) {
    // Do NOT fallback on server-declared errors (e.g., limit_exceeded)
    const msg = json?.error || res.statusText || 'create_failed';
    throw new Error(msg);
  }
  return String(json.id);
}

export async function getServiceById(id: string): Promise<Service | null> {
  const docRef = doc(db, 'services', id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Service) };
}

export async function listServices(count = 12): Promise<Service[]> {
  const colRef = collection(db, 'services');
  const q = query(colRef, where('status', '==', 'approved'), orderBy('createdAt', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Service) }));
}

export async function listServicesByProvider(
  providerId: string,
  count = 50
): Promise<Service[]> {
  // Avoid composite index requirement by querying only by providerId.
  // Client-side we can sort by createdAt if needed.
  const colRef = collection(db, 'services');
  const q = query(colRef, where('providerId', '==', providerId), limit(count));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Service) }));
  // Sort newest first if createdAt is present
  return items.sort((a, b) => {
    const av = (a as any).createdAt?.toMillis?.() ?? 0;
    const bv = (b as any).createdAt?.toMillis?.() ?? 0;
    return bv - av;
  });
}

export async function updateService(
  id: string,
  data: Partial<Omit<Service, 'id' | 'createdAt' | 'providerId'>>
) {
  const docRef = doc(db, 'services', id);
  await updateDoc(docRef, data as any);
}

export async function deleteService(id: string, reason?: string) {
  // Route all client-side deletes through the moderated request flow
  return requestServiceDelete(id, reason);
}

// Provider-side delete: create a deletion request instead of direct delete
export async function requestServiceDelete(id: string, reason?: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  const token = await user.getIdToken(true);
  const res = await fetch('/api/services/request-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id, reason }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || res.statusText || 'request_failed');
}

export type ListFilters = {
  category?: string;
  city?: string;
  maxPrice?: number;
  limit?: number;
};

// Filtered listing helper with graceful fallbacks if Firestore needs composite indexes
export async function listServicesFiltered(filters: ListFilters = {}): Promise<Service[]> {
  const { category, city, maxPrice, limit: take = 24 } = filters;
  const colRef = collection(db, 'services');

  // Build primary query with as many constraints as possible
  let q: any;
  try {
    const wheres: any[] = [];
    wheres.push(where('status', '==', 'approved'));
    if (category) wheres.push(where('category', '==', category));
    if (city && city.toLowerCase() !== 'all cities') wheres.push(where('city', '==', city));
    if (typeof maxPrice === 'number') wheres.push(where('price', '<=', maxPrice));
    q = query(colRef, ...wheres, orderBy('createdAt', 'desc'), limit(take));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Service) }));
  } catch (err) {
    // Fallback 1: drop orderBy
    try {
      const wheres: any[] = [];
      wheres.push(where('status', '==', 'approved'));
      if (category) wheres.push(where('category', '==', category));
      if (city && city.toLowerCase() !== 'all cities') wheres.push(where('city', '==', city));
      if (typeof maxPrice === 'number') wheres.push(where('price', '<=', maxPrice));
      q = query(colRef, ...wheres, limit(take));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Service) }));
      // Sort newest first client-side
      return rows.sort((a, b) => {
        const av = (a as any).createdAt?.toMillis?.() ?? 0;
        const bv = (b as any).createdAt?.toMillis?.() ?? 0;
        return bv - av;
      });
    } catch (err2) {
      // Fallback 2: fetch recent and filter client-side
      const base = await listServices(take);
      return base.filter((s) => {
        if (category && s.category !== category) return false;
        if (city && city.toLowerCase() !== 'all cities' && s.city !== city) return false;
        if (typeof maxPrice === 'number' && (s.price ?? 0) > maxPrice) return false;
        return true;
      });
    }
  }
}
