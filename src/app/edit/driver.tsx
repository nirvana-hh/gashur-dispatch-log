import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Button, Field, Input } from '@/components/ui';
import { formStyles } from '@/components/form-styles';
import { useDrivers, useTrips } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, showMessage } from '@/lib/confirm';
import { isValidDate, localDate } from '@/lib/calc';
import { removeDriver, saveDriver, type Driver } from '@/lib/store';

export default function DriverFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const driver = useDrivers().find((d) => d.id === id);
  return <DriverForm key={driver?.id ?? 'new'} driver={driver} />;
}

function DriverForm({ driver }: { driver?: Driver }) {
  const theme = useTheme();
  const inUse = useTrips().some((t) => t.driverId === driver?.id);
  const [name, setName] = useState(driver?.name ?? '');
  const [phone, setPhone] = useState(driver?.phone ?? '');
  const [licenseNo, setLicenseNo] = useState(driver?.licenseNo ?? '');
  const [licenseExpiry, setLicenseExpiry] = useState(driver?.licenseExpiry ?? localDate(365));

  const canSave = name.trim() !== '' && licenseNo.trim() !== '' && isValidDate(licenseExpiry);

  function save() {
    if (!canSave) return;
    saveDriver({ id: driver?.id, name: name.trim(), phone: phone.trim(), licenseNo: licenseNo.trim().toUpperCase(), licenseExpiry });
    router.back();
  }

  function confirmRemove() {
    if (inUse) {
      showMessage("Can't remove this driver", 'They are on recorded trips. Delete those trips first.');
      return;
    }
    confirmAction(`Remove ${driver!.name}?`, undefined, 'Remove', () => {
      router.back();
      removeDriver(driver!.id);
    });
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={formStyles.container}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: driver ? driver.name : 'New driver' }} />
      <Field label="Full name">
        <Input value={name} onChangeText={setName} autoCapitalize="words" placeholder="e.g. Musa Abdullahi" />
      </Field>
      <Field label="Phone">
        <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0772 000 000" />
      </Field>
      <Field label="License number">
        <Input value={licenseNo} onChangeText={setLicenseNo} autoCapitalize="characters" autoCorrect={false} />
      </Field>
      <Field label="License expires" hint="YYYY-MM-DD">
        <Input value={licenseExpiry} onChangeText={setLicenseExpiry} autoCorrect={false} />
      </Field>
      <Button label="Save driver" onPress={save} disabled={!canSave} />
      {driver && <Button label="Remove driver" variant="destructive" onPress={confirmRemove} />}
    </ScrollView>
  );
}
