import { InjectionToken } from '@angular/core';
import type { Router } from '@angular/router';
import { AuthServiceInterface } from 'src/services/authService/authService.interface';
import { DatastoreInterface } from '../abstractions/datastore';
import { DatastoreFake } from './datastore';

export type DatastoreInitializer = (
  auth: AuthServiceInterface,
  datastore: DatastoreInterface,
  datastoreController: DatastoreFake,
  router: Router
) => Promise<void>;

export interface DatastoreFakeConfig {
  readonly debug: boolean;
  readonly initializer?: DatastoreInitializer;
}

export const DATASTORE_FAKE_CONFIG = new InjectionToken<DatastoreFakeConfig>(
  'DatastoreFake Configuration'
);
