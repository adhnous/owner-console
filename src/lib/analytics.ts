import { db } from './firebase';
import { collection, getDocs, query, where, limit as fsLimit } from 'firebase/firestore';

export type StatsDaily = {
  serviceId: string;
  providerUid: string;
  yyyymmdd: string; // e.g. 20250101
  views?: number;
  ctas?: number;
  messages?: number;
};

function daysAgoYYYYMMDD(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

export async function listProviderDailyStats(providerUid: string, days = 30): Promise<StatsDaily[]> {
  const col = collection(db, 'stats_daily');
  // NOTE: To avoid composite index requirements, we only filter by providerUid here; we filter dates client-side
  const q = query(col, where('providerUid', '==', providerUid), fsLimit(400));
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => d.data() as StatsDaily);
  const threshold = daysAgoYYYYMMDD(days);
  const filtered = rows.filter((r) => (r.yyyymmdd || '') >= threshold);
  // Sort ascending by date for nice charting
  return filtered.sort((a, b) => (a.yyyymmdd || '').localeCompare(b.yyyymmdd || ''));
}
