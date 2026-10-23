import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Button, Field, Input } from '@/components/ui';
import { Accent, HeadingFont, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { resetWithCode, sendResetCode } from '@/lib/session';

/** Forgot password: email a code, then enter it with a new password. Signs in on success. */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const mismatch = confirm !== '' && confirm !== password;
  const canSend = email.includes('@') && !busy;
  const canReset = /^\d{6,8}$/.test(code.trim()) && password.length >= 8 && password === confirm && !busy;

  async function send() {
    if (!canSend) return;
    setBusy(true);
    setError(undefined);
    const message = await sendResetCode(email);
    setBusy(false);
    if (message) setError(message);
    else setStep('code');
  }

  async function reset() {
    if (!canReset) return;
    setBusy(true);
    setError(undefined);
    // On success the root layout opens the app.
    const message = await resetWithCode(email, code, password);
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: theme.text }]}>Reset your password</Text>

        {step === 'email' ? (
          <>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {"Enter the email you sign in with. We'll email you a code to set a new password."}
            </Text>
            <Field label="Email">
              <Input
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="send"
                onSubmitEditing={send}
              />
            </Field>
          </>
        ) : (
          <>
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              If {email.trim()} has an account, a code is on its way. It can take a minute; check spam too.
            </Text>
            <Field label="Code from the email">
              <Input
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={8}
              />
            </Field>
            <Field label="New password" hint="At least 8 characters.">
              <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
            </Field>
            <Field label="Repeat new password" hint={mismatch ? "The passwords don't match." : undefined}>
              <Input value={confirm} onChangeText={setConfirm} secureTextEntry returnKeyType="go" onSubmitEditing={reset} />
            </Field>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {busy ? (
          <ActivityIndicator color={Accent} style={styles.spinner} />
        ) : step === 'email' ? (
          <Button label="Email me a code" onPress={send} disabled={!canSend} />
        ) : (
          <>
            <Button label="Set new password" onPress={reset} disabled={!canReset} />
            <Button label="Send a new code" variant="secondary" onPress={send} />
          </>
        )}

        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))} hitSlop={8} style={styles.back}>
          <Text style={styles.link}>Back to sign in</Text>
        </Pressable>
        <Text style={[styles.note, { color: theme.textSecondary }]}>No email? A manager can set a new password for you.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontFamily: HeadingFont,
    fontSize: 24,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: -Spacing.two,
  },
  error: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  spinner: {
    paddingVertical: 16,
  },
  back: {
    alignSelf: 'center',
  },
  link: {
    color: Accent,
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    fontSize: 13,
    textAlign: 'center',
  },
});
