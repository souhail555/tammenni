import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { AppState, fmtClock, fmtTime, isSameDay, medTakenToday, todayCheckin } from '../store';
import { Btn, Card, Row, T } from '../ui';
import { C } from '../theme';

export default function FamilyHome({ state, openSettings }: { state: AppState; openSettings: () => void }) {
  const checkin = todayCheckin(state.log);
  const nowH = new Date().getHours();
  const late = !checkin && nowH >= state.checkinDeadlineHour;
  const sosToday = state.log.find((l) => l.type === 'sos' && isSameDay(l.at, Date.now()));

  const status = sosToday
    ? { bg: C.redSoft, fg: C.red, icon: '🚨', title: 'طلب مساعدة!', sub: `الساعة ${fmtClock(sosToday.at)}` }
    : checkin
      ? { bg: C.greenSoft, fg: C.greenDark, icon: '✅', title: `${state.elderName} بخير`, sub: `طمّن الساعة ${fmtClock(checkin.at)}` }
      : late
        ? { bg: C.amberSoft, fg: '#8A6200', icon: '⚠️', title: 'لسّا ما طمّن', sub: `عدّى وقت ${state.checkinDeadlineHour}:00 — جرّب تتصل فيه` }
        : { bg: '#fff', fg: C.muted, icon: '⏳', title: 'بانتظار طمأنة اليوم', sub: `الموعد قبل الساعة ${state.checkinDeadlineHour}:00` };

  // last 7 days check-in strip
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ok = state.log.some((l) => l.type === 'checkin' && isSameDay(l.at, d.getTime()));
    return { label: d.toLocaleDateString('ar', { weekday: 'short' }), ok, today: i === 6 };
  });

  const recent = [...state.log].sort((a, b) => b.at - a.at).slice(0, 8);
  const medName = (id?: string) => state.meds.find((m) => m.id === id)?.name ?? 'دوا';

  return (
    <View style={{ gap: 16 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T size={26} bold>لوحة العيلة 👨‍👩‍👧</T>
        <Pressable onPress={openSettings} accessibilityLabel="الإعدادات" hitSlop={12}>
          <T size={30}>⚙️</T>
        </Pressable>
      </Row>

      <Card style={{ backgroundColor: status.bg, alignItems: 'center' }}>
        <T size={48} style={{ textAlign: 'center' }}>{status.icon}</T>
        <T size={26} bold color={status.fg} style={{ textAlign: 'center' }}>{status.title}</T>
        <T color={status.fg} style={{ textAlign: 'center' }}>{status.sub}</T>
        {(late || sosToday) && state.contacts[0] && (
          <Btn label={`📞 اتصل`} color={C.red} onPress={() => Linking.openURL(`tel:${state.contacts[0].phone}`)} />
        )}
      </Card>

      <Card>
        <T bold size={20}>آخر ٧ أيام</T>
        <Row style={{ justifyContent: 'space-between' }}>
          {days.map((d, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  width: 34, height: 34, borderRadius: 17,
                  backgroundColor: d.ok ? C.green : C.border,
                  borderWidth: d.today ? 2 : 0, borderColor: C.greenDark,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <T size={14} color="#fff" style={{ textAlign: 'center' }}>{d.ok ? '✓' : ''}</T>
              </View>
              <T size={12} color={C.muted} style={{ textAlign: 'center' }}>{d.label}</T>
            </View>
          ))}
        </Row>
      </Card>

      <Card>
        <T bold size={20}>💊 الأدوية اليوم</T>
        {state.meds.length === 0 && <T color={C.muted}>ما في أدوية مضافة.</T>}
        {state.meds.map((m) => {
          const taken = medTakenToday(state.log, m.id);
          return (
            <Row key={m.id} style={{ justifyContent: 'space-between' }}>
              <T>{m.name} — {fmtTime(m.hour, m.minute)}</T>
              <T bold color={taken ? C.green : C.muted}>{taken ? '✓ أخدها' : 'لسّا'}</T>
            </Row>
          );
        })}
      </Card>

      <Card>
        <T bold size={20}>آخر النشاطات</T>
        {recent.length === 0 && <T color={C.muted}>ما في نشاط لسّا.</T>}
        {recent.map((l, i) => (
          <T key={i} color={C.muted}>
            {new Date(l.at).toLocaleDateString('ar', { day: 'numeric', month: 'short' })} {fmtClock(l.at)} —{' '}
            {l.type === 'checkin'
              ? '✅ طمّن'
              : l.type === 'med'
                ? `💊 أخد ${medName(l.medId)}`
                : l.type === 'missed'
                  ? '⚠️ ما طمّن بالوقت'
                  : '🚨 طلب مساعدة'}
          </T>
        ))}
      </Card>
    </View>
  );
}
