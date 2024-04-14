import { ExampleCollection } from '../example';
import { addUpdateTransformer } from './documentCreator';

export function addUpdateTransformers(): void {
  addUpdateTransformer<ExampleCollection>('example', (_, document, delta) => {
    return { ...document, ...delta };
  });
}
