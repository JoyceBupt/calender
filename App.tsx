import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { migrateDbIfNeeded } from './src/data/db';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ensureAndroidNotificationChannelAsync } from './src/notifications/setup';

export default function App() {
  useEffect(() => {
    void ensureAndroidNotificationChannelAsync();
  }, []);

  return (
    <SQLiteProvider databaseName="calender.db" onInit={migrateDbIfNeeded}>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </SafeAreaProvider>
    </SQLiteProvider>
  );
}
