import AsyncStorage from '@react-native-async-storage/async-storage';

export type Role = 'elder' | 'family';

export type Contact = { id: string; name: string; phone: string };

export type Med = {
  id: string;
  name: string;
  hour: number;
  minute: number;
  notificationId?: string;
};

export type LogEntry = {
  type: 'checkin' | 'med' | 'sos' | 'missed';
  at: number; // timestamp
  medId?: string;
};

export type AppState = {
  role: Role | null;
  elderName: string;
  checkinDeadlineHour: number; // if no check-in by this hour -> alert family
  contacts: Contact[];
  meds: Med[];
  log: LogEntry[];
  circleId?: string; // shared family circle in the cloud
  circleCode?: string; // 6-letter code the family types to link
  pending?: LogEntry[]; // events not yet sent to the cloud (offline)
};

export const defaultState: AppState = {
  role: null,
  elderName: '',
  checkinDeadlineHour: 11,
  contacts: [],
  meds: [],
  log: [],
};

const KEY = 'tammenni:state:v1';

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState;
  } catch {
    return defaultState;
  }
}

export async function saveState(s: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore storage failures in prototype
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function isSameDay(a: number, b: number) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function todayCheckin(log: LogEntry[]) {
  const now = Date.now();
  return log.find((l) => l.type === 'checkin' && isSameDay(l.at, now));
}

export function medTakenToday(log: LogEntry[], medId: string) {
  const now = Date.now();
  return log.some((l) => l.type === 'med' && l.medId === medId && isSameDay(l.at, now));
}

export const fmtTime = (h: number, m: number) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

export const fmtClock = (ts: number) => {
  const d = new Date(ts);
  return fmtTime(d.getHours(), d.getMinutes());
};
