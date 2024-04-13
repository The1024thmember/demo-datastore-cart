import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { environment } from 'src/environment/environment';
import { HTTP_CONFIG } from 'src/services/httpsService';
import { AppComponent } from './app.component';
import { CartSummaryComponent } from './cart-summary/cart-summary.component';
import { DatastoreModule } from './datastore/abstractions/datastore.module';
import { DatastoreExampleModule } from './datastore/collections';
import { ProductListComponent } from './product-list/product-list.component';

@NgModule({
  declarations: [AppComponent, CartSummaryComponent, ProductListComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    DatastoreExampleModule,
    DatastoreModule.initialize({
      webSocketUrl: environment.datastoreConfig.webSocketUrl,
      enableStoreFreeze: environment.datastoreConfig.enableStoreFreeze,
      requestData: {},
    }),
  ],
  providers: [
    {
      provide: HTTP_CONFIG,
      useValue: {
        baseUrl: environment.httpConfig.baseUrl,
      },
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
