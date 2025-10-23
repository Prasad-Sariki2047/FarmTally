import { UserRole, WidgetType } from './common.types';
import { Permission } from './permission.model';

export interface DashboardConfig {
  role: UserRole;
  widgets: DashboardWidget[];
  permissions: Permission[];
  navigation: NavigationItem[];
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  dataSource: string;
  permissions: string[];
  config: any;
}

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  permissions: string[];
  children?: NavigationItem[];
}