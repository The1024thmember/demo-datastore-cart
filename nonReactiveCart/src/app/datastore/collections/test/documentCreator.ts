import {
  DatastoreCollectionType,
  DatastorePushCollectionType,
  DatastoreUpdateCollectionType,
} from 'src/app/datastore/abstractions/store.model';
import { DatastoreTestingInterface } from 'src/app/datastore/test/datastore.testing.interface';
import {
  MutationPropagator,
  PushTransformer,
  UpdateTransformer,
} from 'src/app/datastore/test/store.model';
import { AuthServiceInterface } from 'src/services/authService/authService.interface';
import { ExampleCollection } from '../example';
import {
  generateExampleObject,
  generateExampleObjects,
} from '../example/example.seed';

let globalAuth: AuthServiceInterface | undefined;
let globalDatastoreController: DatastoreTestingInterface | undefined;

function getDatastoreController(): DatastoreTestingInterface {
  if (!globalDatastoreController) {
    throw new Error(
      'Missing Datastore. Did you forget to call `setDatastoreController()?`'
    );
  }

  return globalDatastoreController;
}

export function setDatastoreController(
  datastoreController: DatastoreTestingInterface
): void {
  globalDatastoreController = datastoreController;
}
function getAuth(): AuthServiceInterface {
  if (!globalAuth) {
    throw new Error('Missing Auth. Did you forget to call `setAuth()?`');
  }

  return globalAuth;
}

export function setAuth(auth: AuthServiceInterface): void {
  globalAuth = auth;
}

export function addMutationPropagator<
  C1 extends DatastoreCollectionType & DatastorePushCollectionType,
  C2 extends DatastoreCollectionType & DatastorePushCollectionType
>(propagator: MutationPropagator<C1, C2>): void {
  return getDatastoreController().addMutationPropagator<C1, C2>(propagator);
}

export function addPushTransformer<
  C extends DatastoreCollectionType & DatastorePushCollectionType
>(collectionName: C['Name'], transformer: PushTransformer<C>): void {
  return getDatastoreController().addPushTransformer<C>(
    collectionName,
    transformer
  );
}

export function addUpdateTransformer<
  C extends DatastoreCollectionType & DatastoreUpdateCollectionType
>(collectionName: C['Name'], transformer: UpdateTransformer<C>): void {
  return getDatastoreController().addUpdateTransformer<C>(
    collectionName,
    transformer
  );
}

async function createDoc<
  C extends DatastoreCollectionType,
  F extends (...args: any) => any
>(
  collectionName: C['Name'],
  generateDocument: (...args: Parameters<F>) => ReturnType<F>,
  ...config: Parameters<F>
): Promise<ReturnType<F>> {
  const docs = generateDocument(...config);
  if (!Array.isArray(docs)) {
    await getDatastoreController().createRawDocument(collectionName, docs);
  } else {
    await Promise.all(
      docs.map((document: C['DocumentType']) =>
        getDatastoreController().createRawDocument(collectionName, document)
      )
    );
  }
  return docs;
}

export async function createExample(
  ...config: Parameters<typeof generateExampleObject>
): Promise<ReturnType<typeof generateExampleObject>> {
  return createDoc<ExampleCollection, typeof generateExampleObject>(
    'example',
    generateExampleObject,
    ...config
  );
}

export async function createExamples(
  ...config: Parameters<typeof generateExampleObjects>
): Promise<ReturnType<typeof generateExampleObjects>> {
  return createDoc<ExampleCollection, typeof generateExampleObjects>(
    'example',
    generateExampleObjects,
    ...config
  );
}
