import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState as RNAppState, Platform } from 'react-native';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { LogEntry, Med } from './store';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** true when the Supabase keys are set in .env — otherwise the app runs in local-only mode */
export const cloudEnabled = Boolean(url && key);

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, key!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  RNAppState.addEventListener('change', (s) => {
    if (s === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

function db() {
  if (!supabase) throw new Error('cloud disabled');
  return supabase;
}

/** Every phone gets an anonymous account — no email or password for the elder. */
async function ensureSession() {
  const sb = db();
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signed, error } = await sb.auth.signInAnonymously();
  if (error || !signed.user) throw error ?? new Error('sign-in failed');
  return signed.user.id;
}

function timeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export async function createCircle(elderName: string, deadlineHour: number) {
  await ensureSession();
  const { data, error } = await db().rpc('create_circle', {
    p_elder_name: elderName,
    p_deadline: deadlineHour,
    p_tz: timeZone(),
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { circle_id: string; code: string };
  return { circleId: row.circle_id, code: row.code };
}

export async function joinCircle(code: string, myName: string) {
  await ensureSession();
  const { data, error } = await db().rpc('join_circle', { p_code: code, p_name: myName });
  if (error) throw error;
  return data as string;
}

export async function sendEvent(circleId: string, e: LogEntry, medName?: string) {
  const userId = await ensureSession();
  const { error } = await db().from('events').insert({
    circle_id: circleId,
    type: e.type,
    med_id: e.medId ?? null,
    med_name: medName ?? null,
    at: new Date(e.at).toISOString(),
    user_id: userId,
  });
  if (error) throw error;
}

export async function upsertMed(circleId: string, m: Med) {
  await ensureSession();
  await db().from('meds').upsert({ id: m.id, circle_id: circleId, name: m.name, hour: m.hour, minute: m.minute });
}

export async function deleteMed(id: string) {
  await ensureSession();
  await db().from('meds').delete().eq('id', id);
}

export async function updateDeadline(circleId: string, hour: number) {
  await ensureSession();
  await db().from('circles').update({ deadline_hour: hour }).eq('id', circleId);
}

export type CircleSnapshot = {
  elderName: string;
  deadlineHour: number;
  meds: Med[];
  log: LogEntry[];
};

export async function fetchCircle(circleId: string): Promise<CircleSnapshot> {
  await ensureSession();
  const sb = db();
  const since = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  const [c, m, e] = await Promise.all([
    sb.from('circles').select('elder_name, deadline_hour').eq('id', circleId).single(),
    sb.from('meds').select('id, name, hour, minute').eq('circle_id', circleId),
    sb.from('events').select('type, at, med_id').eq('circle_id', circleId).gte('at', since).order('at'),
  ]);
  if (c.error) throw c.error;
  return {
    elderName: c.data.elder_name,
    deadlineHour: c.data.deadline_hour,
    meds: (m.data ?? []) as Med[],
    log: (e.data ?? []).map((r: any) => ({ type: r.type, at: Date.parse(r.at), medId: r.med_id ?? undefined })),
  };
}

/** Calls onChange whenever a new event lands in this circle (live dashboard). */
export function watchCircle(circleId: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  const ch: RealtimeChannel = supabase
    .channel(`circle-${circleId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `circle_id=eq.${circleId}` }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}

/** Saves this phone's Expo push token so the server can notify the family. */
export async function registerPush(circleId: string) {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  try {
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return;
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return; // needs `eas init` — see README
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const userId = await ensureSession();
    await db().from('members').update({ push_token: token }).eq('circle_id', circleId).eq('user_id', userId);
  } catch {
    // push is best-effort; dashboard still works without it
  }
}
