import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Btn, Card, Field, T } from '../ui';
import { C } from '../theme';
import { Role } from '../store';
import { cloudEnabled } from '../cloud';

type Props = {
  /** returns an error message to show, or null on success */
  onDone: (role: Role, name: string, code?: string) => Promise<string | null>;
};

export default function Welcome({ onDone }: Props) {
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linking = role === 'family' && cloudEnabled;

  const submit = async () => {
    if (!role || !name.trim()) return;
    if (linking && code.trim().length < 6) {
      setError('اكتب الكود (٦ أحرف) اللي ظاهر بموبايل أهلك.');
      return;
    }
    setBusy(true);
    setError(null);
    const err = await onDone(role, name.trim(), linking ? code.trim().toUpperCase() : undefined);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <View style={{ gap: 18 }}>
      <View style={{ alignItems: 'center', gap: 6, marginTop: 30 }}>
        <T size={56} style={{ textAlign: 'center' }}>💚</T>
        <T size={40} bold color={C.greenDark} style={{ textAlign: 'center' }}>طمّنّي</T>
        <T color={C.muted} style={{ textAlign: 'center' }}>كبسة وحدة كل يوم… وكل العيلة بتطمّن</T>
      </View>

      <Card>
        <T bold size={20}>مين رح يستعمل هالموبايل؟</T>
        <Btn
          label="👴 أنا (الشخص اللي بدّه يطمّن أهله)"
          color={role === 'elder' ? C.green : C.greenSoft}
          textColor={role === 'elder' ? '#fff' : C.greenDark}
          onPress={() => { setRole('elder'); setError(null); }}
        />
        <Btn
          label="👨‍👩‍👧 أنا من العيلة (بدي أطمّن عليه)"
          color={role === 'family' ? C.green : C.greenSoft}
          textColor={role === 'family' ? '#fff' : C.greenDark}
          onPress={() => { setRole('family'); setError(null); }}
        />
      </Card>

      {role && (
        <Card>
          {linking ? (
            <>
              <T bold>كود العيلة</T>
              <T color={C.muted} size={15}>بتلاقيه بموبايل أهلك: ⚙️ الإعدادات ← كود العيلة</T>
              <Field
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="مثلاً: K7M2QX"
                autoCapitalize="characters"
                maxLength={6}
                style={{ textAlign: 'center', letterSpacing: 6, fontSize: 24 }}
              />
              <T bold>شو اسمك؟</T>
              <Field value={name} onChangeText={setName} placeholder="مثلاً: سارة" />
            </>
          ) : (
            <>
              <T bold>{role === 'elder' ? 'شو اسمك؟' : 'شو اسم الشخص اللي بدك تطمّن عليه؟'}</T>
              <Field value={name} onChangeText={setName} placeholder="مثلاً: أبو محمد" />
            </>
          )}
          {error && <T color={C.red}>{error}</T>}
          {busy ? (
            <ActivityIndicator color={C.green} size="large" />
          ) : (
            <Btn label={linking ? 'اربطني بالعيلة' : 'يلّا نبلّش'} onPress={submit} />
          )}
        </Card>
      )}
    </View>
  );
}
