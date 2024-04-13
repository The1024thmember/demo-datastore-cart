import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { BackendService } from './backendService';
import { Resources } from './resources';

@Injectable()
export class Datastore {
  constructor(private store$: Store, private backendService: BackendService) {}

  resources(resourceName, query) {
    // get the query
    // construct ref$ object, which is used in `Action` and Documents object
    // construct request object, which generates id of the request and dispatch the request data action
    // fetching the data from datastore based on the request
    // get the request status
    // creates resource object
    return new Resources();
  }
}
