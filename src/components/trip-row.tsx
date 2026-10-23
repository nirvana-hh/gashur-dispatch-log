import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Badge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useClients } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import {
  BillingInfo,
  billingStatus,
  figures,
  formatMoney,
  formatShortDate,
  needsReview,
  StageInfo,
  stageOf,
  UrgencyColors,
} from '@/lib/calc';
import type { Trip } from '@/lib/store';

/** A compact trip card: the full details live on the trip screen. */
export function TripRow({ trip }: { trip: Trip }) {
  const theme = useTheme();
  const client = useClients().find((c) => c.id === trip.clientId);
  // An overdue invoice matters more than the stage, so it takes the badge.
  const status = billingStatus(trip, client) === 'overdue' ? BillingInfo.overdue : StageInfo[stageOf(trip)];
  const revenue = figures(trip)?.revenue;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trips/[id]', params: { id: trip.id } })}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.card, borderColor: theme.cardBorder, opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={[styles.stripe, { backgroundColor: status.color }]} />
      <View style={styles.content}>
        <View style={styles.line}>
          <Text style={[styles.date, { color: theme.textSecondary }]}>{formatShortDate(trip.dispatchedAt)}</Text>
          <Badge label={status.label} color={status.color} />
        </View>
        <Text style={[styles.client, { color: theme.text }]} numberOfLines={1}>
          {client?.name ?? 'Unknown client'}
        </Text>
        <View style={styles.line}>
          <Text style={[styles.route, { color: theme.textSecondary }]} numberOfLines={1}>
            {trip.origin} → {trip.destination}
          </Text>
          {revenue !== undefined && <Text style={[styles.money, { color: theme.text }]}>{formatMoney(revenue)}</Text>}
        </View>
        {needsReview(trip) && (
          <View style={[styles.review, { backgroundColor: `${UrgencyColors.overdue}18` }]}>
            <Icon name="warning" size={14} color={UrgencyColors.overdue} />
            <Text style={[styles.reviewText, { color: UrgencyColors.overdue }]}>Needs review</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
  },
  stripe: {
    width: 5,
  },
  content: {
    flex: 1,
    padding: Spacing.three,
    gap: 6,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  date: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  client: {
    fontSize: 17,
    fontWeight: '700',
  },
  route: {
    fontSize: 14,
    flexShrink: 1,
  },
  money: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  review: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  reviewText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
