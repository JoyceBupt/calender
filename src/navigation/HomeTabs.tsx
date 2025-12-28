import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

import { DayScreen } from '../screens/DayScreen';
import { MonthScreen } from '../screens/MonthScreen';
import { WeekScreen } from '../screens/WeekScreen';
import { CalendarProvider } from '../state/CalendarContext';
import type { HomeTabParamList } from './types';

const Tab = createMaterialTopTabNavigator<HomeTabParamList>();

export function HomeTabs() {
  return (
    <CalendarProvider>
      <Tab.Navigator>
        <Tab.Screen name="Month" component={MonthScreen} options={{ title: '月' }} />
        <Tab.Screen name="Week" component={WeekScreen} options={{ title: '周' }} />
        <Tab.Screen name="Day" component={DayScreen} options={{ title: '日' }} />
      </Tab.Navigator>
    </CalendarProvider>
  );
}

