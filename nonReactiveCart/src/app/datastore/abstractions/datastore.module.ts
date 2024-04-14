import { HttpClientModule } from '@angular/common/http';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { AuthService } from 'src/services/authService/authService';
import { HttpsService } from 'src/services/httpsService';
import { BackendModule } from './backend';
import { DATASTORE_CONFIG } from './backend.interface';
import { Datastore } from './datastore';
import { REQUEST_DATA_INITIAL_CONFIG, RequestDataModule } from './request-data';
import { RequestStatusHandler } from './requestStatusHandler';
import { DatastoreConfig } from './store.model';

@NgModule({
  imports: [
    HttpClientModule, // used in httpService in backend.ts
    StoreModule.forRoot({}), // used in dataastore.documents.ts
    EffectsModule.forRoot([]),
    BackendModule.forRoot(), // used in httpService in backend.ts in dataastore.documents.ts
    RequestDataModule.initialize(),
  ],
  providers: [AuthService, HttpsService, RequestStatusHandler],
})
export class DatastoreModule {
  static initialize(
    config: DatastoreConfig
  ): ModuleWithProviders<DatastoreModule> {
    return {
      ngModule: DatastoreModule,
      providers: [
        Datastore,
        {
          provide: REQUEST_DATA_INITIAL_CONFIG,
          useValue: config.requestData,
        },
        {
          provide: DATASTORE_CONFIG,
          useValue: config,
        },
      ],
    };
  }
}
