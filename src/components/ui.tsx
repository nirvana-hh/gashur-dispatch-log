import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { Accent, HeadingFont, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/** A colored pill, e.g. a trip stage or billing status. */
export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeLabel, { color }]}>{label}</Text>
    </View>
  );
}

/** A labelled form field; children are laid out in a wrapping row. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.options}>{children}</View>
      {hint && <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text>}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }, props.style]}
    />
  );
}

/** A numeric input that keeps only digits (and one decimal point when `decimal` is set). */
export function NumberInput({ value, onChangeText, decimal, ...props }: { value: string; onChangeText: (text: string) => void; decimal?: boolean } & Omit<TextInputProps, 'value' | 'onChangeText'>) {
  return (
    <Input
      value={value}
      onChangeText={(text) => onChangeText(decimal ? keepFirstDot(text.replace(/[^0-9.]/g, '')) : text.replace(/[^0-9]/g, ''))}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      {...props}
    />
  );
}

function keepFirstDot(text: string) {
  const dot = text.indexOf('.');
  return dot === -1 ? text : text.slice(0, dot + 1) + text.slice(dot + 1).replace(/\./g, '');
}

export function Button({ label, onPress, disabled, variant = 'primary' }: { label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'destructive' }) {
  const theme = useTheme();
  const background = variant === 'primary' ? Accent : variant === 'secondary' ? theme.backgroundElement : 'transparent';
  const color = variant === 'primary' ? '#ffffff' : variant === 'secondary' ? theme.text : '#EF4444';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}>
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** A label/value pair in a two-column grid. */
export function Detail({ label, value, color, wide }: { label: string; value: string; color?: string; wide?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.detail, wide && { width: '100%' }]}>
      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: color ?? theme.text }]}>{value}</Text>
    </View>
  );
}

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.details}>{children}</View>;
}

export function EmptyText({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.empty, { color: theme.textSecondary }]}>{children}</Text>;
}

export const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: HeadingFont,
    fontSize: 19,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  field: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 13,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minWidth: 120,
    fontSize: 17,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.three,
  },
  detail: {
    width: '50%',
    gap: 2,
    paddingRight: Spacing.two,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  empty: {
    fontSize: 15,
  },
});
