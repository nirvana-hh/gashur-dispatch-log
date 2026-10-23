import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';

import { Chip } from '@/components/chip';
import { formStyles } from '@/components/form-styles';
import { Button, Field, Input } from '@/components/ui';
import { Accent } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useStaff } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/confirm';
import { manageStaff, type StaffRequest } from '@/lib/staff-admin';
import type { Role, Staff } from '@/lib/store';

export default function StaffFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const person = useStaff().find((s) => s.id === id);
  return <StaffForm key={person?.id ?? 'new'} person={person} />;
}

function StaffForm({ person }: { person?: Staff }) {
  const theme = useTheme();
  const session = useSession();
  const isMe = session.status === 'signedIn' && person?.id === session.userId;

  const [name, setName] = useState(person?.name ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(person?.role ?? 'dispatcher');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const passwordOk = person ? password === '' || password.length >= 8 : password.length >= 8;
  const canSave = name.trim() !== '' && passwordOk && (person ? true : email.includes('@')) && !busy;

  async function send(request: StaffRequest) {
    setBusy(true);
    setError(undefined);
    const message = await manageStaff(request);
    setBusy(false);
    if (message) setError(message);
    else router.back();
  }

  function save() {
    if (!canSave) return;
    if (!person) {
      void send({ action: 'create', email: email.trim(), password, fullName: name.trim(), role });
      return;
    }
    void send({
      action: 'update',
      id: person.id,
      fullName: name.trim() !== person.name ? name.trim() : undefined,
      role: role !== person.role ? role : undefined,
      password: password || undefined,
    });
  }

  function toggleAccess() {
    if (!person) return;
    if (person.active) {
      confirmAction(
        `Remove ${person.name || person.email}'s access?`,
        "They'll be signed out and can't sign in again. Their name stays on the records they made.",
        'Remove access',
        () => void send({ action: 'update', id: person.id, active: false }),
      );
    } else {
      void send({ action: 'update', id: person.id, active: true });
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={formStyles.container}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: person ? person.name || person.email : 'Add person' }} />

      <Field label="Full name">
        <Input value={name} onChangeText={setName} autoCapitalize="words" placeholder="e.g. Grace Achieng" />
      </Field>
      {person ? (
        <Field label="Email">
          <Text style={[styles.value, { color: theme.text }]}>{person.email}</Text>
        </Field>
      ) : (
        <Field label="Email" hint="They sign in with this.">
          <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </Field>
      )}
      <Field
        label={person ? 'New password' : 'Starting password'}
        hint={person ? 'Leave empty to keep their current password.' : 'At least 8 characters. Share it with them privately.'}>
        <Input value={password} onChangeText={setPassword} secureTextEntry={!!person} autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field
        label="Role"
        hint={
          isMe
            ? "You can't change your own role. Ask another manager."
            : 'Managers can also delete records, clear fuel-loss flags and manage staff.'
        }>
        {(['dispatcher', 'manager'] as const).map((r) => (
          <Chip
            key={r}
            label={r === 'manager' ? 'Manager' : 'Dispatcher'}
            selected={role === r}
            disabled={isMe}
            onPress={() => setRole(r)}
          />
        ))}
      </Field>

      {error && <Text style={styles.error}>{error}</Text>}
      {busy ? (
        <ActivityIndicator color={Accent} style={styles.spinner} />
      ) : (
        <>
          <Button label={person ? 'Save changes' : 'Add person'} onPress={save} disabled={!canSave} />
          {person && !isMe && (
            <Button
              label={person.active ? 'Remove access' : 'Give access again'}
              variant={person.active ? 'destructive' : 'secondary'}
              onPress={toggleAccess}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  value: {
    fontSize: 17,
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
});
