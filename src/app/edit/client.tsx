import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Chip } from '@/components/chip';
import { Button, Field, Input, NumberInput } from '@/components/ui';
import { formStyles } from '@/components/form-styles';
import { useClients, useTrips } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, showMessage } from '@/lib/confirm';
import { Currency } from '@/lib/calc';
import { removeClient, saveClient, type Client } from '@/lib/store';

const TermPresets = [7, 14, 21, 30, 45];

export default function ClientFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const client = useClients().find((c) => c.id === id);
  return <ClientForm key={client?.id ?? 'new'} client={client} />;
}

function ClientForm({ client }: { client?: Client }) {
  const theme = useTheme();
  const inUse = useTrips().some((t) => t.clientId === client?.id);
  const [name, setName] = useState(client?.name ?? '');
  const [contact, setContact] = useState(client?.contact ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [email, setEmail] = useState(client?.email ?? '');
  const [address, setAddress] = useState(client?.address ?? '');
  const [rate, setRate] = useState(String(client?.ratePerLitre ?? ''));
  const [creditDays, setCreditDays] = useState(String(client?.creditDays ?? 30));

  const canSave = name.trim() !== '' && Number(rate) > 0 && creditDays !== '';

  function save() {
    if (!canSave) return;
    saveClient({
      id: client?.id,
      name: name.trim(),
      contact: contact.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      ratePerLitre: Number(rate),
      creditDays: Number(creditDays),
    });
    router.back();
  }

  function confirmRemove() {
    if (inUse) {
      showMessage("Can't remove this client", 'They have recorded trips. Delete those trips first.');
      return;
    }
    confirmAction(`Remove ${client!.name}?`, undefined, 'Remove', () => {
      router.back();
      removeClient(client!.id);
    });
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={formStyles.container}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: client ? client.name : 'New client' }} />
      <Field label="Company name">
        <Input value={name} onChangeText={setName} placeholder="e.g. Northstar Filling Stations" />
      </Field>
      <Field label="Billing contact">
        <Input value={contact} onChangeText={setContact} autoCapitalize="words" />
      </Field>
      <Field label="Phone">
        <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </Field>
      <Field label="Billing email">
        <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label="Delivery address">
        <Input value={address} onChangeText={setAddress} placeholder="City or site" />
      </Field>
      <Field label={`Haulage rate (${Currency} per litre)`}>
        <NumberInput value={rate} onChangeText={setRate} decimal placeholder="0.06" />
      </Field>
      <Field label="Credit terms (days)" hint="Unpaid invoices become overdue after this many days.">
        {TermPresets.map((d) => (
          <Chip key={d} label={`${d}`} selected={String(d) === creditDays} onPress={() => setCreditDays(String(d))} compact />
        ))}
        <NumberInput value={creditDays} onChangeText={setCreditDays} style={formStyles.smallInput} />
      </Field>
      <Button label="Save client" onPress={save} disabled={!canSave} />
      {client && <Button label="Remove client" variant="destructive" onPress={confirmRemove} />}
    </ScrollView>
  );
}
