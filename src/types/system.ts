export type AppPlatform = 'ios' | 'android' | 'web';
export type AppEnvironment = 'production' | 'staging' | 'development';

export interface AppStatus {
  id: string;
  platform: 'any' | 'android' | 'ios';
  environment: string;
  is_maintenance: boolean;
  maintenance_message?: string;
  maintenance_started_at?: string;
  maintenance_expected_end_at?: string;
  requires_update: boolean;
  min_version_code?: number;
  min_version_name?: string;
  update_url_android?: string;
  update_url_ios?: string;
  changed_at: string;
}