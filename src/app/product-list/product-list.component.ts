import { Component } from '@angular/core';
import { CartService } from '../cart.service';

@Component({
  selector: 'app-product-list',
  template: `<section>
    <div>
      <h2>Products</h2>
      <ul>
        <li *ngFor="let product of products">
          {{ product.name }} - {{ product.price }}
          <button (click)="addToCart(product)">Add to Cart</button>
        </li>
      </ul>
    </div>
  </section>`,
  styleUrls: ['./product-list.component.css'],
})
export class ProductListComponent {
  products = [
    { id: '1', name: 'Product 1', price: 100 },
    { id: '2', name: 'Product 2', price: 200 },
  ];

  constructor(private cartService: CartService) {}

  // Within ProductListComponent
  addToCart(product: any) {
    this.cartService.addItem(product).subscribe();
  }
}
