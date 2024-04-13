import type { ModuleWithProviders } from '@angular/core';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { Router } from '@angular/router';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { BackendFakeModule } from './backend';
import { DatastoreFake } from './datastore';
import type { DatastoreFakeConfig } from './datastore.config';
import { DATASTORE_FAKE_CONFIG } from './datastore.config';
// eslint-disable-next-line local-rules/no-enable-debug-mode
import { AuthServiceInterface } from 'src/services/authService/authService.interface';
import { Datastore } from '../abstractions/datastore';
import { WebSocketService } from '../abstractions/websocket/websocket';
import {
  DatastoreTestingInterface,
  enableDebugMode,
} from './datastore.testing.interface';
import { publishGlobalUtils } from './global-utils';
import { WebSocketServiceFake } from './websocketFake';

function initializeDatastoreFake(
  config: DatastoreFakeConfig,
  datastore: DatastoreFake,
  auth: AuthServiceInterface,
  router: Router
): () => void {
  return () => {
    publishGlobalUtils(datastore);

    if (config.debug) {
      enableDebugMode();
    }

    return config.initializer
      ? config.initializer(auth, datastore, datastore, router)
      : undefined;
  };
}

@NgModule({
  imports: [
    StoreModule.forRoot({}),
    EffectsModule.forRoot([]),
    BackendFakeModule.forRoot(),
  ],
  providers: [
    DatastoreFake,
    { provide: Datastore, useExisting: DatastoreFake },
    { provide: DatastoreTestingInterface, useExisting: DatastoreFake },
    { provide: WebSocketService, useClass: WebSocketServiceFake },
  ],
})
export class DatastoreFakeModule {
  static initialize(
    config: DatastoreFakeConfig
  ): ModuleWithProviders<DatastoreFakeModule> {
    return {
      ngModule: DatastoreFakeModule,
      providers: [
        {
          provide: DATASTORE_FAKE_CONFIG,
          useValue: config,
        },
        config.initializer
          ? {
              // Initialise store state on application bootstrap so route guards
              // have access to datastore
              provide: APP_INITIALIZER,
              useFactory: initializeDatastoreFake,
              deps: [DATASTORE_FAKE_CONFIG, DatastoreFake, Router],
              multi: true,
            }
          : [],
      ],
    };
  }
}
