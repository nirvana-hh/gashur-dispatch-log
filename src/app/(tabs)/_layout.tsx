import { Tabs } from 'expo-router';

import { AccountButton, AddButton, BellButton, HeaderActions } from '@/components/header-buttons';
import { Icon } from '@/components/icon';
import { Accent, HeadingFont } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Accent,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontFamily: HeadingFont, fontSize: 28 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Icon name="dashboard" color={color} />,
          headerRight: () => (
            <HeaderActions>
              <AddButton href="/trips/form" label="New trip" />
              <BellButton />
              <AccountButton />
            </HeaderActions>
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarIcon: ({ color }) => <Icon name="trips" color={color} />,
          headerRight: () => (
            <HeaderActions>
              <AddButton href="/trips/form" label="New trip" />
              <BellButton />
              <AccountButton />
            </HeaderActions>
          ),
        }}
      />
      <Tabs.Screen
        name="fleet"
        options={{
          title: 'Fleet',
          tabBarIcon: ({ color }) => <Icon name="fleet" color={color} />,
          headerRight: () => (
            <HeaderActions>
              <BellButton />
              <AccountButton />
            </HeaderActions>
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ color }) => <Icon name="clients" color={color} />,
          headerRight: () => (
            <HeaderActions>
              <AddButton href="/edit/client" label="New client" />
              <BellButton />
              <AccountButton />
            </HeaderActions>
          ),
        }}
      />
    </Tabs>
  );
}
