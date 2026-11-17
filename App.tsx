import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState as RNAppState, SafeAreaView, ScrollView, StatusBar as RNStatusBar, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppState, LogEntry, Med, Role, defaultState, loadState, saveState } from './src/store';
import { cancel, scheduleDaily, setupNotifications } from './src/notify';
import * as cloud from './src/cloud';
import { C } from './src/theme';
import Welcome from './src/screens/Welcome';
import ElderHome from './src/screens/ElderHome';
import FamilyHome from './src/screens/FamilyHome';
import Settings from './src/screens/Settings';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [screen, setScreen] = useState<'home' | 'settings'>('home');
  const checkinReminder = useRef<string | undefined>(undefined);
  const stateRef = useRef<AppState | null>(null);
  stateRef.current = state;

  useEffect(() => {
    loadState().then(setState);
  }, []);

  const update = useCallback((patch: Partial<AppState>) => {
    setState((prev) => {
      const next = { ...(prev ?? defaultState), ...patch };
      saveState(next);
      return next;
    });
  }, []);

  // ── Elder phone: create the family circle (retries until online) ──
  useEffect(() => {
    if (!cloud.cloudEnabled || state?.role !== 'elder' || state.circleId) return;
    let alive = true;
    (async () => {
      try {
        const s = stateRef.current!;
        const { circleId, code } = await cloud.createCircle(s.elderName, s.checkinDeadlineHour);
        for (const m of s.meds) await cloud.upsertMed(circleId, m);
        if (alive) update({ circleId, circleCode: code });
      } catch {
        // offline — will retry next launch
      }
    })();
    return () => { alive = false; };
  }, [state?.role, state?.circleId, update]);

  // ── Elder phone: flush events that failed to send (offline outbox) ──
  const flushing = useRef(false);
  const flush = useCallback(async () => {
    const s = stateRef.current;
    if (flushing.current || !s?.circleId || !s.pending?.length) return;
    flushing.current = true;
    const sent = new Set<LogEntry>();
    for (const e of s.pending) {
      try {
        await cloud.sendEvent(s.circleId, e, s.meds.find((m) => m.id === e.medId)?.name);
        sent.add(e);
      } catch {
        break; // offline — try again later
      }
    }
    // remove only what was sent; keep anything added meanwhile
    setState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, pending: (prev.pending ?? []).filter((e) => !sent.has(e)) };
      saveState(next);
      return next;
    });
    flushing.current = false;
  }, []);

  useEffect(() => {
    if (state?.role !== 'elder' || !state.circleId) return;
    flush();
    const sub = RNAppState.addEventListener('change', (st) => st === 'active' && flush());
    return () => sub.remove();
  }, [state?.role, state?.circleId, flush]);

  // ── Family phone: load the elder's data, live-update, register for push ──
  const refreshFamily = useCallback(async () => {
    const s = stateRef.current;
    if (!s?.circleId) return;
    try {
      const snap = await cloud.fetchCircle(s.circleId);
      update({ elderName: snap.elderName, checkinDeadlineHour: snap.deadlineHour, meds: snap.meds, log: snap.log });
    } catch {}
  }, [update]);

  useEffect(() => {
    if (state?.role !== 'family' || !state.circleId) return;
    refreshFamily();
    cloud.registerPush(state.circleId);
    const stopWatch = cloud.watchCircle(state.circleId, refreshFamily);
    const timer = setInterval(refreshFamily, 60_000);
    const sub = RNAppState.addEventListener('change', (st) => st === 'active' && refreshFamily());
    return () => { stopWatch(); clearInterval(timer); sub.remove(); };
  }, [state?.role, state?.circleId, refreshFamily]);

  // ── Elder phone: daily morning reminder to press "أنا بخير" ──
  useEffect(() => {
    if (state?.role !== 'elder') return;
    (async () => {
      await setupNotifications();
      await cancel(checkinReminder.current);
      checkinReminder.current = await scheduleDaily(
        'صباح الخير 🌿',
        'طمّن أهلك… اكبس «أنا بخير»',
        Math.max(6, state.checkinDeadlineHour - 2),
        0,
      );
    })();
  }, [state?.role, state?.checkinDeadlineHour]);

  if (!state) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.green} size="large" />
      </View>
    );
  }

  const onWelcome = async (role: Role, name: string, code?: string): Promise<string | null> => {
    if (role === 'family' && code) {
      try {
        const circleId = await cloud.joinCircle(code, name);
        update({ role, circleId, circleCode: code });
        return null;
      } catch (e: any) {
        return String(e?.message ?? '').includes('bad code')
          ? 'الكود مش صحيح. تأكّد منه بموبايل أهلك.'
          : 'ما قدرنا نتصل. تأكّد من الإنترنت وجرّب مرة تانية.';
      }
    }
    update({ role, elderName: name });
    return null;
  };

  const addLog = (e: LogEntry) => {
    update({
      log: [...state.log, e].slice(-500),
      pending: cloud.cloudEnabled ? [...(state.pending ?? []), e].slice(-200) : [],
    });
    setTimeout(flush, 300); // after the state above has rendered
  };

  const addMed = async (m: Med) => {
    await setupNotifications();
    const notificationId = await scheduleDaily('💊 وقت الدوا', `وقت ${m.name}`, m.hour, m.minute);
    update({ meds: [...state.meds, { ...m, notificationId }] });
    if (state.circleId) cloud.upsertMed(state.circleId, m).catch(() => {});
  };

  const removeMed = async (id: string) => {
    const m = state.meds.find((x) => x.id === id);
    await cancel(m?.notificationId);
    update({ meds: state.meds.filter((x) => x.id !== id) });
    if (state.circleId) cloud.deleteMed(id).catch(() => {});
  };

  const setDeadline = (h: number) => {
    update({ checkinDeadlineHour: h });
    if (state.circleId) cloud.updateDeadline(state.circleId, h).catch(() => {});
  };

  const reset = async () => {
    for (const m of state.meds) await cancel(m.notificationId);
    await cancel(checkinReminder.current);
    update({ ...defaultState, circleId: undefined, circleCode: undefined, pending: [] });
    setScreen('home');
  };

  let content: React.ReactNode;
  if (!state.role) {
    content = <Welcome onDone={onWelcome} />;
  } else if (screen === 'settings') {
    content = (
      <Settings
        state={state}
        update={update}
        addMed={addMed}
        removeMed={removeMed}
        setDeadline={setDeadline}
        switchRole={(role) => { update({ role }); setScreen('home'); }}
        reset={reset}
        close={() => setScreen('home')}
      />
    );
  } else if (state.role === 'elder') {
    content = <ElderHome state={state} addLog={addLog} openSettings={() => setScreen('settings')} />;
  } else {
    content = <FamilyHome state={state} openSettings={() => setScreen('settings')} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, paddingTop: RNStatusBar.currentHeight ?? 0 }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        {content}
      </ScrollView>
    </SafeAreaView>
  );
}
