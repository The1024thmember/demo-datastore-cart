export interface EnvironmentConfig {
  httpConfig: {
    baseUrl: string;
  };
  datastoreConfig: {
    webSocketUrl: string;
    enableStoreFreeze: boolean;
  };
}
