import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { AuditLine, Button, Field, Input, NumberInput } from '@/components/ui';
import { formStyles } from '@/components/form-styles';
import { useTrips, useTrucks } from '@/hooks/use-store';
import { useCanManage, useStaffName } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, showMessage } from '@/lib/confirm';
import { isValidDate, localDate } from '@/lib/calc';
import { removeTruck, saveTruck, type Truck } from '@/lib/store';

export default function TruckFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const truck = useTrucks().find((t) => t.id === id);
  return <TruckForm key={truck?.id ?? 'new'} truck={truck} />;
}

function TruckForm({ truck }: { truck?: Truck }) {
  const theme = useTheme();
  const canManage = useCanManage();
  const staffName = useStaffName();
  const inUse = useTrips().some((t) => t.truckId === truck?.id);
  const [plate, setPlate] = useState(truck?.plate ?? '');
  const [capacity, setCapacity] = useState(String(truck?.capacityLitres ?? 33000));
  const [odometer, setOdometer] = useState(String(truck?.odometerKm ?? ''));
  const [nextService, setNextService] = useState(String(truck?.nextServiceKm ?? ''));
  const [insurance, setInsurance] = useState(truck?.insuranceExpiry ?? localDate(365));
  const [inspection, setInspection] = useState(truck?.inspectionExpiry ?? localDate(180));

  const canSave =
    plate.trim() !== '' && Number(capacity) > 0 && odometer !== '' && Number(nextService) > 0 && isValidDate(insurance) && isValidDate(inspection);

  function save() {
    if (!canSave) return;
    saveTruck({
      id: truck?.id,
      plate: plate.trim().toUpperCase(),
      capacityLitres: Number(capacity),
      odometerKm: Number(odometer),
      nextServiceKm: Number(nextService),
      insuranceExpiry: insurance,
      inspectionExpiry: inspection,
    });
    router.back();
  }

  function confirmRemove() {
    if (inUse) {
      showMessage("Can't remove this truck", 'It is on recorded trips. Delete those trips first.');
      return;
    }
    confirmAction(`Remove ${truck!.plate}?`, undefined, 'Remove', () => {
      router.back();
      removeTruck(truck!.id);
    });
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={formStyles.container}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: truck ? truck.plate : 'New truck' }} />
      <Field label="Plate number">
        <Input value={plate} onChangeText={setPlate} autoCapitalize="characters" autoCorrect={false} placeholder="UBK 120A" />
      </Field>
      <Field label="Tank capacity (litres)">
        <NumberInput value={capacity} onChangeText={setCapacity} />
      </Field>
      <Field label="Odometer (km)">
        <NumberInput value={odometer} onChangeText={setOdometer} placeholder="0" />
      </Field>
      <Field label="Next service at (km)">
        <NumberInput value={nextService} onChangeText={setNextService} placeholder="10000" />
      </Field>
      <Field label="Insurance expires" hint="YYYY-MM-DD">
        <Input value={insurance} onChangeText={setInsurance} autoCorrect={false} />
      </Field>
      <Field label="Inspection expires" hint="YYYY-MM-DD">
        <Input value={inspection} onChangeText={setInspection} autoCorrect={false} />
      </Field>
      <Button label="Save truck" onPress={save} disabled={!canSave} />
      {truck && canManage && <Button label="Remove truck" variant="destructive" onPress={confirmRemove} />}
      <AuditLine createdBy={staffName(truck?.createdBy)} updatedBy={staffName(truck?.updatedBy)} />
    </ScrollView>
  );
}
