import React from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { AppState, LogEntry, fmtClock, fmtTime, medTakenToday, todayCheckin } from '../store';
import { Btn, Card, Row, T, notifyUser } from '../ui';
import { C } from '../theme';

type Props = {
  state: AppState;
  addLog: (e: LogEntry) => void;
  openSettings: () => void;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 18) return 'نهارك سعيد';
  return 'مسا الخير';
}

export default function ElderHome({ state, addLog, openSettings }: Props) {
  const checkin = todayCheckin(state.log);

  const onCheckin = () => {
    if (checkin) return;
    addLog({ type: 'checkin', at: Date.now() });
    notifyUser('الله يسعدك 💚', 'وصل للعيلة إنك بخير اليوم.');
  };

  const onSOS = async () => {
    addLog({ type: 'sos', at: Date.now() });
    const first = state.contacts[0];
    if (!first) {
      notifyUser('ما في أرقام', 'ضيف رقم حدا من العيلة من الإعدادات.');
      return;
    }
    if (Platform.OS === 'web') {
      notifyUser('🚨 طوارئ', `بالموبايل رح يتصل هلّق بـ ${first.name} (${first.phone}).`);
      return;
    }
    const phones = state.contacts.map((c) => c.phone).join(Platform.OS === 'ios' ? ',' : ';');
    const body = encodeURIComponent(`🚨 ${state.elderName} بحاجة مساعدة! (من تطبيق طمّنّي)`);
    try {
      await Linking.openURL(`sms:${phones}${Platform.OS === 'ios' ? '&' : '?'}body=${body}`);
    } catch {}
    try {
      await Linking.openURL(`tel:${first.phone}`);
    } catch {}
  };

  return (
    <View style={{ gap: 16 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <T size={26} bold>{greeting()} يا {state.elderName} 🌿</T>
          <T color={C.muted}>{new Date().toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' })}</T>
        </View>
        <Pressable onPress={openSettings} accessibilityLabel="الإعدادات" hitSlop={12}>
          <T size={30}>⚙️</T>
        </Pressable>
      </Row>

      <Pressable
        accessibilityRole="button"
        onPress={onCheckin}
        style={({ pressed }) => ({
          alignSelf: 'center',
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: checkin ? C.greenSoft : C.green,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 10,
          borderColor: checkin ? C.green : C.greenSoft,
          transform: [{ scale: pressed ? 0.96 : 1 }],
          marginVertical: 8,
        })}
      >
        <T size={60} style={{ textAlign: 'center' }}>{checkin ? '✅' : '👋'}</T>
        <T size={32} bold color={checkin ? C.greenDark : '#fff'} style={{ textAlign: 'center' }}>
          {checkin ? 'طمّنتهم' : 'أنا بخير'}
        </T>
        {checkin && (
          <T color={C.greenDark} style={{ textAlign: 'center' }}>الساعة {fmtClock(checkin.at)}</T>
        )}
      </Pressable>

      <Card>
        <T bold size={22}>💊 أدوية اليوم</T>
        {state.meds.length === 0 && <T color={C.muted}>ما في أدوية مضافة.</T>}
        {[...state.meds]
          .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
          .map((m) => {
            const taken = medTakenToday(state.log, m.id);
            return (
              <Row key={m.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <T size={20} bold>{m.name}</T>
                  <T color={C.muted}>الساعة {fmtTime(m.hour, m.minute)}</T>
                </View>
                <Btn
                  label={taken ? '✓ أخدتها' : 'أخدتها'}
                  color={taken ? C.greenSoft : C.green}
                  textColor={taken ? C.greenDark : '#fff'}
                  onPress={() => !taken && addLog({ type: 'med', at: Date.now(), medId: m.id })}
                />
              </Row>
            );
          })}
      </Card>

      <Btn label="🚨  طوارئ — اتصل بالعيلة" color={C.red} big onPress={onSOS} />
    </View>
  );
}
