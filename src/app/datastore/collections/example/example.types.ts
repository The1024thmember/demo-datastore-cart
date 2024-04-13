import { ExampleResultApi } from './example.backend.model';
import { Example } from './example.model';

export interface ExampleCollection {
  readonly Name: 'example';
  readonly DocumentType: Example;
  readonly Backend: {
    readonly Fetch: {
      // get request, no payload needed
      readonly PayloadType: never;
      readonly ReturnType: ExampleResultApi;
      readonly ErrorType: never;
    };
    readonly Push: never;
    readonly Set: never;
    readonly Update: {
      readonly PayloadType: ExampleRawPayload;
      readonly ReturnType: ExampleResultApi;
      readonly ErrorType: unknown; // need to fix this type error, change it backt to never
    };
    readonly Delete: never;
    readonly WebsocketType: never;
  };
  readonly HasTotalCount: true;
}

export interface ExampleRawPayload {
  quantity?: number;
}
