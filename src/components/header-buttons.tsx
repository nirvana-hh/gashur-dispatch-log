import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Accent } from '@/constants/theme';
import { useNotifications } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';

export function BellButton() {
  const theme = useTheme();
  const unread = useNotifications().filter((n) => !n.read).length;
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

export function AddButton({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable hitSlop={12} accessibilityLabel={label} style={styles.button}>
        <Text style={styles.addText}>+ New</Text>
      </Pressable>
    </Link>
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
  addText: {
    fontSize: 17,
    fontWeight: '600',
    color: Accent,
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
