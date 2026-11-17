import React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { C } from './theme';

export function notifyUser(title: string, msg: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n\n${msg}`);
  } else {
    Alert.alert(title, msg);
  }
}

export function T({ children, style, size = 18, bold, color = C.text }: {
  children: React.ReactNode; style?: any; size?: number; bold?: boolean; color?: string;
}) {
  return (
    <Text style={[{ fontSize: size, color, textAlign: 'right', writingDirection: 'rtl', fontWeight: bold ? '700' : '400' }, style]}>
      {children}
    </Text>
  );
}

export function Btn({ label, onPress, color = C.green, textColor = '#fff', style, big }: {
  label: string; onPress: () => void; color?: string; textColor?: string; style?: ViewStyle; big?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: color, opacity: pressed ? 0.8 : 1, paddingVertical: big ? 22 : 14 }, style]}
    >
      <Text style={{ color: textColor, fontSize: big ? 24 : 18, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Field(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={C.muted} {...props} style={[s.input, props.style]} />;
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }, style]}>{children}</View>;
}

const s = StyleSheet.create({
  btn: { borderRadius: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.border, gap: 10 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, fontSize: 18,
    backgroundColor: '#fff', textAlign: 'right', writingDirection: 'rtl', color: C.text,
  },
});
