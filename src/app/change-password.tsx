import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';

import { formStyles } from '@/components/form-styles';
import { Button, Field, Input } from '@/components/ui';
import { Accent } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { showMessage } from '@/lib/confirm';
import { changePassword } from '@/lib/session';

export default function ChangePasswordScreen() {
  const theme = useTheme();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const mismatch = confirm !== '' && confirm !== next;
  const canSave = current !== '' && next.length >= 8 && next === confirm && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(undefined);
    const message = await changePassword(current, next);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    router.back();
    showMessage('Password changed', 'Use your new password next time you sign in.');
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={formStyles.container}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <Field label="Current password">
        <Input value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" />
      </Field>
      <Field label="New password" hint="At least 8 characters.">
        <Input value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      </Field>
      <Field label="Repeat new password" hint={mismatch ? "The passwords don't match." : undefined}>
        <Input value={confirm} onChangeText={setConfirm} secureTextEntry returnKeyType="go" onSubmitEditing={save} />
      </Field>
      {error && <Text style={styles.error}>{error}</Text>}
      {busy ? <ActivityIndicator color={Accent} style={styles.spinner} /> : <Button label="Change password" onPress={save} disabled={!canSave} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  spinner: {
    paddingVertical: 16,
  },
});
