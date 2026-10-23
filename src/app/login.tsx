import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Input } from '@/components/ui';
import { Accent, HeadingFont, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signIn } from '@/lib/session';

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const canSubmit = email.includes('@') && password.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(undefined);
    const message = await signIn(email, password);
    // On success the root layout swaps this screen for the app.
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
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>G</Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Gashur Dispatch Log</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Sign in with your staff account</Text>
        </View>

        <Field label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@gashur.example"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
          />
        </Field>
        <Field label="Password">
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </Field>

        {error && <Text style={styles.error}>{error}</Text>}

        {busy ? <ActivityIndicator color={Accent} style={styles.spinner} /> : <Button label="Sign in" onPress={submit} disabled={!canSubmit} />}

        <Pressable onPress={() => router.push('/reset-password')} hitSlop={8} style={styles.forgot}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Pressable>

        <Text style={[styles.note, { color: theme.textSecondary }]}>
          Accounts are created by a manager. Ask one if you need access.
        </Text>
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
  brand: {
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: Accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontFamily: HeadingFont,
    fontSize: 32,
  },
  title: {
    fontFamily: HeadingFont,
    fontSize: 26,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
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
  forgot: {
    alignSelf: 'center',
  },
  forgotText: {
    color: Accent,
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    fontSize: 13,
    textAlign: 'center',
  },
});
