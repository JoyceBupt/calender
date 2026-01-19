export type RootStackParamList = {
  Home: undefined;
  EventEditor: { eventId?: string; initialDate?: string } | undefined;
  EventDetail: { eventId: string };
  Subscriptions: undefined;
};

export type HomeTabParamList = {
  Month: undefined;
  Week: undefined;
  Day: undefined;
};

