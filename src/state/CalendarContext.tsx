import React, { createContext, useContext, useMemo, useState } from 'react';

import { getTodayISODateLocal } from '../utils/date';

type CalendarContextValue = {
  selectedDate: string;
  setSelectedDate: (isoDate: string) => void;
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(getTodayISODateLocal());

  const value = useMemo(
    () => ({ selectedDate, setSelectedDate }),
    [selectedDate],
  );

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const value = useContext(CalendarContext);
  if (!value) {
    throw new Error('useCalendar 必须在 CalendarProvider 内使用');
  }
  return value;
}

