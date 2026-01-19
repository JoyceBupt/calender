import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { EventDetailScreen } from '../screens/EventDetailScreen';
import { EventEditorScreen } from '../screens/EventEditorScreen';
import { SubscriptionsScreen } from '../screens/SubscriptionsScreen';
import { HomeTabs } from './HomeTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeTabs} options={{ title: '日历' }} />
      <Stack.Screen
        name="EventEditor"
        component={EventEditorScreen}
        options={({ route }) => ({
          title: route.params?.eventId ? '编辑日程' : '新建日程',
        })}
      />
      <Stack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ title: '日程详情' }}
      />
      <Stack.Screen
        name="Subscriptions"
        component={SubscriptionsScreen}
        options={{ title: '订阅管理' }}
      />
    </Stack.Navigator>
  );
}

