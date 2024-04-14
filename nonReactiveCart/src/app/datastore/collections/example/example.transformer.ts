import { ExampleResultApi } from './example.backend.model';
import { Example } from './example.model';

export function exampleTransformer(example: ExampleResultApi): Example {
  return {
    id: example.id,
    quantity: example.quantity,
    name: example.name,
    price: example.price,
    category: example.category,
  };
}
