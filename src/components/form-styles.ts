import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';

export const formStyles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  smallInput: {
    flex: 0,
    minWidth: 80,
    paddingVertical: 6,
  },
});
