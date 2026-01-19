import type { ISODate, ISODateTime } from './event';

export type Subscription = {
  id: string;
  name: string;
  url: string;
  color: string;
  lastSyncedAt: ISODateTime | null;
  createdAt: ISODateTime;
};

export type SubscriptionEvent = {
  id: string;
  subscriptionId: string;
  uid: string;
  title: string;
  notes: string | null;
  location: string | null;
} & (
  | {
      isAllDay: true;
      startDate: ISODate;
      endDate: ISODate;
    }
  | {
      isAllDay: false;
      startAt: ISODateTime;
      endAt: ISODateTime;
    }
);
