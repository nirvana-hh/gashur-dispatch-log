import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Row = { id: string; label: string; value: number };

/**
 * Horizontal bars for a single measure, largest first, each labelled with its value.
 * Negative values (e.g. a truck running at a loss) draw in `negativeColor`.
 */
export function BarChart({ rows, color, negativeColor, format }: { rows: Row[]; color: string; negativeColor: string; format: (value: number) => string }) {
  const theme = useTheme();
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.value)));

  return (
    <View style={styles.chart} accessibilityRole="summary">
      {rows.map((row) => (
        <View key={row.id} style={styles.row} accessible accessibilityLabel={`${row.label}: ${format(row.value)}`}>
          <View style={styles.labels}>
            <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
              {row.label}
            </Text>
            <Text style={[styles.value, { color: theme.textSecondary }]}>{format(row.value)}</Text>
          </View>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.fill,
                { width: `${(Math.abs(row.value) / max) * 100}%`, backgroundColor: row.value < 0 ? negativeColor : color },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    gap: Spacing.three,
  },
  row: {
    gap: 6,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  value: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
