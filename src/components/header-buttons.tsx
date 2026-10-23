import { Link, router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Accent } from '@/constants/theme';
import { useMe, useSession, useSyncStatus } from '@/hooks/use-session';
import { useNotifications, useReadAt } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';

export function BellButton() {
  const theme = useTheme();
  const readAt = useReadAt();
  const unread = useNotifications().filter((n) => n.at > readAt).length;
  return (
    <Link href="/notifications" asChild>
      <Pressable hitSlop={12} accessibilityLabel={`Notifications, ${unread} unread`} style={styles.button}>
        <Icon name="bell" color={theme.text} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

/** The primary action in a tab header: a filled pill so it reads as a button, not a link. */
export function AddButton({ href, label }: { href: Href; label: string }) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.add, { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <Icon name="plus" size={18} color="#ffffff" />
      <Text style={styles.addText}>New</Text>
    </Pressable>
  );
}

/** The signed-in person's initials; opens the account screen. A dot shows sync trouble. */
export function AccountButton() {
  const theme = useTheme();
  const session = useSession();
  const me = useMe();
  const sync = useSyncStatus();
  if (session.status !== 'signedIn') return null;
  const name = me?.name || session.email;
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
  const warn = sync.phase === 'offline' || sync.pending > 0;
  return (
    <Pressable
      onPress={() => router.push('/account')}
      hitSlop={8}
      accessibilityLabel={`Account${warn ? ', changes waiting to sync' : ''}`}
      style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
      <Text style={[styles.avatarText, { color: theme.text }]}>{initials}</Text>
      {warn && <View style={[styles.syncDot, { borderColor: theme.background }]} />}
    </Pressable>
  );
}

export function HeaderActions({ children }: { children: React.ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
  },
  button: {
    paddingHorizontal: 2,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Accent,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 7,
    boxShadow: '0 2px 6px rgba(234, 88, 12, 0.35)',
  },
  addText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  syncDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: '#F59E0B',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
