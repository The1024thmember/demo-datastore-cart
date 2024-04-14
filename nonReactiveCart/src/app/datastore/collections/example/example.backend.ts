import { Backend } from 'src/app/datastore/abstractions/backend';
import { getQueryParamValue } from 'src/app/datastore/abstractions/store.helpers';
import {
  BackendFetchGetRequest,
  BackendUpdateRequest,
} from 'src/app/datastore/abstractions/store.model';
import { ExampleCollection } from './example.types';

export function exampleBackend(): Backend<ExampleCollection> {
  return {
    fetch(authUid, ids, query): BackendFetchGetRequest {
      // all the params that backend supports

      const params = {
        category: getQueryParamValue(query, 'category'),
      };
      return {
        endpoint: 'cart',
        params,
      };
    },
    push: undefined,
    set: undefined,
    update(authUid, delta, original): BackendUpdateRequest<ExampleCollection> {
      let payload = delta;

      return {
        endpoint: `cart`,
        method: 'POST',
        payload,
      };
    },
    remove: undefined,
  };
}
