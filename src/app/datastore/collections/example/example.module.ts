import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { BackendModule } from 'src/app/datastore/abstractions/backend';
import { exampleBackend } from './example.backend';
import { exampleReducer } from './example.reducer';

@NgModule({
  imports: [
    StoreModule.forFeature('example', exampleReducer),
    BackendModule.forFeature('example', exampleBackend),
  ],
})
export class DatastoreExampleModule {}
