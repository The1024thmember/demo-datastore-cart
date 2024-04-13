import type { DatastoreFake } from './datastore';
import {
  disableDebugMode,
  enableDebugMode,
} from './datastore.testing.interface';
// eslint-disable-next-line local-rules/no-enable-debug-mode

/** Make datastore methods available in the browser */
export function publishGlobalUtils(datastore: DatastoreFake): void {
  putObjectsOnWindow({
    datastore: {
      // These types are a lie
      documents: (...args: [any]) => datastore.documents(...args),
      createDocument: (...args: [any, any]) =>
        datastore.createDocument(...args),
      resetState: (...args: [any]) => datastore.resetState(...args),
      enableDebugMode: () => enableDebugMode(),
      disableDebugMode: () => disableDebugMode(),
    },
  });
}

/** Make datastore collection factory methods available in the browser */
export function publishDatastoreCollectionFactoryFunctions(
  datastoreFunctions: Object
): void {
  putObjectsOnWindow(datastoreFunctions);
}

function putObjectsOnWindow(object: object): void {
  Object.entries(object).forEach(([name, fn]) => {
    (window as any)[name] = fn;
  });
}
