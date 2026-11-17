import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppState, Med, Role, fmtTime, uid } from '../store';
import { Btn, Card, Field, Row, T } from '../ui';
import { C } from '../theme';

type Props = {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  addMed: (m: Med) => void;
  removeMed: (id: string) => void;
  setDeadline: (h: number) => void;
  switchRole: (r: Role) => void;
  reset: () => void;
  close: () => void;
};

export default function Settings({ state, update, addMed, removeMed, setDeadline, switchRole, reset, close }: Props) {
  const linkedFamily = state.role === 'family' && Boolean(state.circleId);
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [mName, setMName] = useState('');
  const [mTime, setMTime] = useState('08:00');

  const addContact = () => {
    if (!cName.trim() || !cPhone.trim()) return;
    update({ contacts: [...state.contacts, { id: uid(), name: cName.trim(), phone: cPhone.trim() }] });
    setCName('');
    setCPhone('');
  };

  const onAddMed = () => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(mTime.trim());
    if (!mName.trim() || !match) return;
    const hour = Math.min(23, Number(match[1]));
    const minute = Math.min(59, Number(match[2]));
    addMed({ id: uid(), name: mName.trim(), hour, minute });
    setMName('');
  };

  return (
    <View style={{ gap: 16 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T size={26} bold>الإعدادات</T>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="رجوع">
          <T size={22} color={C.green} bold>رجوع ←</T>
        </Pressable>
      </Row>

      {state.role === 'elder' && state.circleCode && (
        <Card style={{ backgroundColor: C.greenSoft, alignItems: 'center' }}>
          <T bold size={20} style={{ textAlign: 'center' }}>🔗 كود العيلة</T>
          <T size={40} bold color={C.greenDark} style={{ textAlign: 'center', letterSpacing: 8 }}>
            {state.circleCode}
          </T>
          <T color={C.muted} style={{ textAlign: 'center' }}>
            خلّي أولادك ينزّلوا «طمّنّي»، يختاروا «أنا من العيلة» ويكتبوا هالكود
          </T>
        </Card>
      )}
      {linkedFamily && (
        <Card style={{ backgroundColor: C.greenSoft }}>
          <T bold>🔗 مربوط مع {state.elderName}</T>
          <T color={C.muted}>الأدوية ووقت الطمأنة بيتعدّلوا من موبايل {state.elderName}.</T>
        </Card>
      )}

      <Card>
        <T bold size={20}>👨‍👩‍👧 أرقام العيلة (للطوارئ)</T>
        {state.contacts.map((c) => (
          <Row key={c.id} style={{ justifyContent: 'space-between' }}>
            <T>{c.name} — {c.phone}</T>
            <Pressable onPress={() => update({ contacts: state.contacts.filter((x) => x.id !== c.id) })}>
              <T color={C.red}>حذف</T>
            </Pressable>
          </Row>
        ))}
        <Field placeholder="الاسم (مثلاً: سارة)" value={cName} onChangeText={setCName} />
        <Field placeholder="رقم الموبايل" keyboardType="phone-pad" value={cPhone} onChangeText={setCPhone} />
        <Btn label="+ ضيف رقم" onPress={addContact} />
      </Card>

      {!linkedFamily && (<>
      <Card>
        <T bold size={20}>💊 الأدوية</T>
        {state.meds.map((m) => (
          <Row key={m.id} style={{ justifyContent: 'space-between' }}>
            <T>{m.name} — {fmtTime(m.hour, m.minute)}</T>
            <Pressable onPress={() => removeMed(m.id)}>
              <T color={C.red}>حذف</T>
            </Pressable>
          </Row>
        ))}
        <Field placeholder="اسم الدوا (مثلاً: حبّة الضغط)" value={mName} onChangeText={setMName} />
        <Field placeholder="الوقت 08:00" value={mTime} onChangeText={setMTime} />
        <Btn label="+ ضيف دوا" onPress={onAddMed} />
      </Card>

      <Card>
        <T bold size={20}>⏰ آخر وقت للطمأنة</T>
        <T color={C.muted}>إذا ما كبس «أنا بخير» لهالساعة، بننبّه العيلة.</T>
        <Row style={{ justifyContent: 'center' }}>
          <Btn label="−" onPress={() => setDeadline(Math.max(6, state.checkinDeadlineHour - 1))} />
          <T size={28} bold>{state.checkinDeadlineHour}:00</T>
          <Btn label="+" onPress={() => setDeadline(Math.min(22, state.checkinDeadlineHour + 1))} />
        </Row>
      </Card>
      </>)}

      <Card>
        <T bold size={20}>طريقة الاستعمال</T>
        {!state.circleId && <Btn
          label={state.role === 'elder' ? 'بدّل لشاشة العيلة' : 'بدّل لشاشة الكبير بالعمر'}
          color={C.greenSoft}
          textColor={C.greenDark}
          onPress={() => switchRole(state.role === 'elder' ? 'family' : 'elder')}
        />}
        <Btn label="مسح كل البيانات" color={C.redSoft} textColor={C.red} onPress={reset} />
      </Card>
    </View>
  );
}
