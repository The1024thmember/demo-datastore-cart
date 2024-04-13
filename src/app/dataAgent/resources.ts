import { map, Observable } from 'rxjs';
import { BackendService } from './backendService';

export class Resources {
  private value$: Observable;
  constructor(
    private ref$: Observable,
    private queryResults$: Observable,
    public status$: Observable,
    private backendService: BackendService
  ) {
    this.value$ = this.queryResults$.pipe(
      map((queryResults) =>
        queryResults.map((queryResult) => queryResult.rawDocument)
      )
    );
  }

  value() {}

  update() {}

  // other methods
}
