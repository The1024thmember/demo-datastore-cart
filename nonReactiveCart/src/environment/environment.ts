import { EnvironmentConfig } from './environment.interface';

export const environment: EnvironmentConfig = {
  httpConfig: {
    baseUrl: 'http://localhost:3000', // 'https://www.sophiazhang.com',
  },
  datastoreConfig: {
    webSocketUrl: 'http://localhost:3100',
    enableStoreFreeze: true,
  },
};
