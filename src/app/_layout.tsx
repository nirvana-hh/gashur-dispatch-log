import { MaterialSymbols_400Regular } from '@expo-google-fonts/material-symbols/400Regular';
import { Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({ Poppins_700Bold, MaterialSymbols_400Regular });
  // Wait for the heading and icon fonts so titles don't jump and icons don't show as boxes.
  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Back' }} />
        <Stack.Screen name="trips/[id]" options={{ title: 'Trip' }} />
        <Stack.Screen name="trips/form" options={{ title: 'Trip', presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications', presentation: 'modal' }} />
        <Stack.Screen name="edit/truck" options={{ title: 'Truck', presentation: 'modal' }} />
        <Stack.Screen name="edit/driver" options={{ title: 'Driver', presentation: 'modal' }} />
        <Stack.Screen name="edit/client" options={{ title: 'Client', presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
