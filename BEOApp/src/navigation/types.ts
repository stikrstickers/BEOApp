// Typed navigation param lists. Each tab has its own native stack.

import type { NavigatorScreenParams } from '@react-navigation/native';

export type CalendarStackParamList = {
  Calendar: undefined;
  EventDetail: { id: number };
};

export type EventsStackParamList = {
  EventsHome: undefined;
  EventRequestDetail: { id: number };
  Calendar: undefined;
  EventDetail: { id: number };
};

export type ContactsStackParamList = {
  ContactsHome: undefined;
  ContactDetail: { id: number };
  CompanyDetail: { id: number };
};

export type InventoryStackParamList = {
  InventoryHome: undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  SitesHome: undefined;
  SiteDetail: { id: number };
  TeammatesHome: undefined;
  TemplatesHome: undefined;
  TemplateEditor: { id?: number };
  Workspace: undefined;
};

export type AdminTabParamList = {
  CalendarTab:  NavigatorScreenParams<CalendarStackParamList>;
  EventsTab:    NavigatorScreenParams<EventsStackParamList>;
  ContactsTab:  NavigatorScreenParams<ContactsStackParamList>;
  InventoryTab: NavigatorScreenParams<InventoryStackParamList>;
  MoreTab:      NavigatorScreenParams<MoreStackParamList>;
};
