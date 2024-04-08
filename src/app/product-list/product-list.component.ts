import { Component, OnInit } from '@angular/core';
import { Observable, startWith } from 'rxjs';
import { CartService } from '../cart.service';
import { formatCurrency } from '../helper';

@Component({
  selector: 'app-product-list',
  template: `
    <div>
      <h2>Products</h2>
      <div *ngFor="let product of products" class="product-card">
        <div class="product-image">
          <img [src]="'assets/' + product.id + '.png'" />
        </div>
        <h3>{{ product.name }}</h3>
        <p>{{ formatCurrency(product.price) }}</p>
        <div *ngIf="cartItems$ | async as cartItems" class="product-controls">
          <button (click)="addToCart(cartItems, product)">+</button>
          <span>
            {{ getProductQuantity(cartItems, product) }}
          </span>
          <ng-container>
            <button
              [disabled]="!isProductInCart(cartItems, product)"
              (click)="removeFromCart(product, cartItems)"
            >
              -
            </button>
          </ng-container>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./product-list.component.css'],
})
export class ProductListComponent implements OnInit {
  formatCurrency = formatCurrency;

  products = [
    { id: '1', name: 'Elegant Desk Lamp', price: 49.99 },
    { id: '2', name: 'Modern Armchair', price: 149.99 },
    // More products...
  ];

  cartItems$: Observable<any> | undefined;

  constructor(private cartService: CartService) {}

  ngOnInit() {
    this.cartItems$ = this.cartService.fetchCartItems().pipe(startWith([]));
  }

  async addToCart(cartItems: any, product: any) {
    const currentQuantity = this.getProductQuantity(cartItems, product);
    product.quantity = currentQuantity + 1;
    this.cartService.modifyItem(product).then((status) => {
      console.log('adding  item status:', status);
    });
  }

  isProductInCart(cartItems: any, product: any) {
    return !!cartItems.find((item: any) => item.id === product.id);
  }

  getProductQuantity(cartItems: any, product: any) {
    return cartItems.find((item: any) => item.id === product.id)?.quantity ?? 0;
  }

  removeFromCart(product: any, cartItems: any) {
    const cartItem = cartItems.find((item: any) => item.id === product.id);
    if (cartItem && cartItem.quantity > 0) {
      const currentQuantity = this.getProductQuantity(cartItems, product);
      product.quantity = currentQuantity - 1;
    }
    this.cartService.modifyItem(product).then((status) => {
      console.log('adding  item status:', status);
    });
  }
}
