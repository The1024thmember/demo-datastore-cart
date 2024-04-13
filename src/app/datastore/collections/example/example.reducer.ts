import { CollectionActions } from 'src/app/datastore/abstractions/action';
import {
  documentTransformer,
  mergeDocument,
} from 'src/app/datastore/abstractions/store.helpers';
import { CollectionStateSlice } from 'src/app/datastore/abstractions/store.model';
import { exampleTransformer } from './example.transformer';
import { ExampleCollection } from './example.types';

export function exampleReducer(
  state: CollectionStateSlice<ExampleCollection> = {},
  action: CollectionActions<ExampleCollection>
): CollectionStateSlice<ExampleCollection> {
  // Fetch reqeust, coming from documents.valueChanges()
  switch (action.type) {
    case 'API_FETCH_SUCCESS':
      if (action.payload.collection === 'example') {
        const { result, ref } = action.payload;

        return mergeDocument<ExampleCollection>(
          state,
          documentTransformer(result, exampleTransformer),
          ref
        );
      }
      return state;

    // Update reqeust, coming from documents.update()
    case 'API_UPDATE_SUCCESS':
      if (action.payload.collection === 'example') {
        const { result, ref } = action.payload;
        return mergeDocument<ExampleCollection>(
          state,
          documentTransformer([result], exampleTransformer), // ensure the result is coming as a list, since push normally return one object, while the transformer expects it to be a list
          ref
        );
      }

      return state;

    default:
      return state;
  }
}
