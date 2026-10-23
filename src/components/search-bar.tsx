import { StyleSheet, View, type ColorValue } from 'react-native';

import { Icon } from '@/components/icon';
import { Input } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export function SearchBar({
  value,
  onChange,
  placeholder,
  background,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  /** Defaults to the usual input fill; pass one to stand out on a tinted page. */
  background?: ColorValue;
}) {
  const theme = useTheme();
  return (
    <View style={styles.search}>
      <View style={styles.icon}>
        <Icon name="search" size={18} color={theme.textSecondary} />
      </View>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        style={[styles.input, background !== undefined && { backgroundColor: background }]}
      />
    </View>
  );
}

/** Case-insensitive match of a search query against any of the given fields. */
export function matchesQuery(query: string, fields: (string | number | undefined)[]) {
  const needle = query.trim().toLowerCase();
  return !needle || fields.join(' ').toLowerCase().includes(needle);
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  input: {
    paddingLeft: 38,
    paddingVertical: 10,
    fontSize: 16,
  },
});
