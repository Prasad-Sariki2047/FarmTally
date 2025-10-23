// Main application entry point
export * from './models';
export * from './services';
export * from './repositories';
export * from './api';
export * from './utils';

// Application configuration
export interface AppConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  magicLinkSecret: string;
  otpSecret: string;
  smtpConfig: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  smsConfig: {
    apiKey: string;
    apiUrl: string;
  };
  googleOAuth: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
}

// Application factory interface
export interface FarmTallyApp {
  start(): Promise<void>;
  stop(): Promise<void>;
  getConfig(): AppConfig;
}