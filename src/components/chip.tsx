import { Pressable, StyleSheet, Text } from 'react-native';

import { Accent } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Shown under the label, e.g. a driver's name. */
  detail?: string;
  /** Smaller padding, for filters in tight rows. */
  compact?: boolean;
};

export function Chip({ label, selected, onPress, disabled, detail, compact }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={[
        styles.chip,
        compact && styles.compact,
        { backgroundColor: selected ? Accent : theme.backgroundElement, opacity: disabled ? 0.4 : 1 },
      ]}>
      <Text style={[styles.label, { color: selected ? '#ffffff' : theme.text }]}>{label}</Text>
      {detail && (
        <Text style={[styles.detail, { color: selected ? '#ffffffcc' : theme.textSecondary }]}>{detail}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  compact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  detail: {
    fontSize: 12,
    marginTop: 2,
  },
});
