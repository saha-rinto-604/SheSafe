import * as SecureStore from 'expo-secure-store';

const INDEX_KEY = 'shesafe_inc_index_v1';
const DELETED_KEY = 'shesafe_inc_deleted_v1';

export interface IncidentRecord {
  incidentId: string;
  displayNumber: number;
  lat: number | null;
  lng: number | null;
  address: string;
  createdAt: string;
  status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED';
  resolvedAt?: string;
}

function recordKey(displayNumber: number) {
  return `shesafe_inc_${displayNumber}`;
}

async function getIndex(): Promise<number[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function saveIndex(idx: number[]): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(idx.slice(0, 30)));
}

async function getDeletedIds(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(DELETED_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function addDeletedId(incidentId: string): Promise<void> {
  const ids = await getDeletedIds();
  if (!ids.includes(incidentId)) {
    ids.push(incidentId);
    await SecureStore.setItemAsync(DELETED_KEY, JSON.stringify(ids.slice(-50)));
  }
}

export const incidentHistory = {
  async add(record: IncidentRecord): Promise<void> {
    const idx = await getIndex();
    if (!idx.includes(record.displayNumber)) {
      idx.unshift(record.displayNumber);
      await saveIndex(idx);
    }
    await SecureStore.setItemAsync(
      recordKey(record.displayNumber),
      JSON.stringify(record),
    );
  },

  async updateStatus(
    incidentId: string,
    status: 'RESOLVED' | 'CANCELLED',
  ): Promise<void> {
    const idx = await getIndex();
    for (const n of idx) {
      const raw = await SecureStore.getItemAsync(recordKey(n));
      if (!raw) continue;
      try {
        const rec: IncidentRecord = JSON.parse(raw);
        if (rec.incidentId === incidentId) {
          rec.status = status;
          rec.resolvedAt = new Date().toISOString();
          await SecureStore.setItemAsync(recordKey(n), JSON.stringify(rec));
          return;
        }
      } catch { /* skip corrupt entry */ }
    }
  },

  async getAll(): Promise<IncidentRecord[]> {
    const idx = await getIndex();
    const records: IncidentRecord[] = [];
    for (const n of idx) {
      const raw = await SecureStore.getItemAsync(recordKey(n));
      if (!raw) continue;
      try { records.push(JSON.parse(raw)); } catch { /* skip */ }
    }
    return records;
  },

  async remove(incidentId: string): Promise<void> {
    const idx = await getIndex();
    const kept: number[] = [];
    for (const n of idx) {
      const raw = await SecureStore.getItemAsync(recordKey(n));
      if (!raw) continue;
      try {
        const rec: IncidentRecord = JSON.parse(raw);
        if (rec.incidentId === incidentId) {
          await SecureStore.deleteItemAsync(recordKey(n));
        } else {
          kept.push(n);
        }
      } catch { kept.push(n); }
    }
    await saveIndex(kept);
    await addDeletedId(incidentId); // prevent remote re-fetch from re-adding it
  },

  getDeletedIds,

  async clearAll(): Promise<void> {
    const idx = await getIndex();
    for (const n of idx) {
      await SecureStore.deleteItemAsync(recordKey(n));
    }
    await SecureStore.deleteItemAsync(INDEX_KEY);
    await SecureStore.deleteItemAsync(DELETED_KEY);
    await SecureStore.deleteItemAsync('shesafe_sos_count_v1');
    await SecureStore.deleteItemAsync('shesafe_active_sos_v1');
    await SecureStore.deleteItemAsync('shesafe_sos_autosent_v1');
  },
};
