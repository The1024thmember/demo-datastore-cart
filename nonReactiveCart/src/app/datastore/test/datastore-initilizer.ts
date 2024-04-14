import { Router } from '@angular/router';
import { AuthTestingService } from 'src/services/authService/test/authTestingService';
import { DatastoreInterface } from '../abstractions/datastore';
import { datastoreFunctions } from '../collections/test/datastoreFunctions';
import {
  setAuth,
  setDatastoreController,
} from '../collections/test/documentCreator';
import { addMutationPropagators } from '../collections/test/mutationPropagator';
import { addPushTransformers } from '../collections/test/pushTransformer';
import { addUpdateTransformers } from '../collections/test/updateTransformer';
import { DatastoreFake } from './datastore';
import { DatastoreInitializer } from './datastore.config';
import { publishDatastoreCollectionFactoryFunctions } from './global-utils';

export function datastoreInitializer(): DatastoreInitializer {
  return async (
    auth: AuthTestingService,
    datastore: DatastoreInterface,
    datastoreController: DatastoreFake,
    router: Router
  ) => {
    setAuth(auth);
    setDatastoreController(datastoreController);

    publishDatastoreCollectionFactoryFunctions(datastoreFunctions);

    addPushTransformers();
    addMutationPropagators();
    addUpdateTransformers();
  };
}
