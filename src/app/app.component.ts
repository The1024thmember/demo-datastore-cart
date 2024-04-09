import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: ` <div style="text-align:center">
      <h1>Welcome to A Non-Reactive Shopping Cart</h1>
    </div>
    <app-product-list class="products-container"></app-product-list>
    <app-cart-summary class="cart-summary"></app-cart-summary>`,
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'nonReactiveCart';
}
