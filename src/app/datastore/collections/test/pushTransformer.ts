import { PushDocumentType } from 'src/app/datastore/abstractions/store.model';
import { generateId } from 'src/util';
import { Example, ExampleCollection } from '../example';
import { addPushTransformer } from './documentCreator';

export function addPushTransformers(): void {
  addPushTransformer<ExampleCollection>(
    'example',
    addExampleCollectionComputedFields
  );
}

export function addExampleCollectionComputedFields(
  authUid: number,
  document: PushDocumentType<ExampleCollection>
): Example {
  return {
    ...document,
    id: generateId(),
    createTime: generateId(),
  };
}
