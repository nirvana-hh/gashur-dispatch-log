import { MaterialSymbols_400Regular } from '@expo-google-fonts/material-symbols/400Regular';
import { Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { useSession } from '@/hooks/use-session';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({ Poppins_700Bold, MaterialSymbols_400Regular });
  const session = useSession();
  // Wait for the heading and icon fonts so titles don't jump and icons don't show as boxes,
  // and for the stored session (read from the device, no network) so the login screen
  // doesn't flash for someone already signed in.
  if (!fontsLoaded || session.status === 'loading') return null;

  const signedIn = session.status === 'signedIn' || session.status === 'local';

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Back' }} />
          <Stack.Screen name="trips/[id]" options={{ title: 'Trip' }} />
          <Stack.Screen name="trips/form" options={{ title: 'Trip', presentation: 'modal' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications', presentation: 'modal' }} />
          <Stack.Screen name="account" options={{ title: 'Account', presentation: 'modal' }} />
          <Stack.Screen name="change-password" options={{ title: 'Change password', presentation: 'modal' }} />
          <Stack.Screen name="staff" options={{ title: 'Staff' }} />
          <Stack.Screen name="edit/staff" options={{ title: 'Person', presentation: 'modal' }} />
          <Stack.Screen name="edit/truck" options={{ title: 'Truck', presentation: 'modal' }} />
          <Stack.Screen name="edit/driver" options={{ title: 'Driver', presentation: 'modal' }} />
          <Stack.Screen name="edit/client" options={{ title: 'Client', presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
