import { Component, OnInit } from '@angular/core';
import { Observable, take, tap } from 'rxjs';
import { CartService } from '../cart.service';
import { formatCurrency } from '../helper';

@Component({
  selector: 'app-product-list',
  template: `
    <div *ngIf="cartItems$ | async as cartItems">
      <h2>Product Items</h2>
      <!-- product-list.component.html -->
      <div>
        <select
          #categorySelect
          (change)="fetchProductsByCategory(categorySelect.value)"
        >
          <option value="">All Categories</option>
          <option value="Lighting">Lighting</option>
          <option value="Furniture">Furniture</option>
        </select>
      </div>

      <div *ngFor="let product of productsWithQuantity" class="product-card">
        <div class="product-image">
          <img [src]="'assets/' + product.id + '.png'" />
        </div>
        <h3>{{ product.name }}</h3>
        <div class="product-controls">
          <button (click)="addToCart(cartItems, product)">+</button>
          <span>
            {{ product.quantity }}
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

  // Assuming this is a list of product returned from the backend API
  products = [
    {
      id: '1',
      category: 'Lighting',
      name: 'Elegant Desk Lamp',
      price: 49.99,
      quantity: 0,
    },
    {
      id: '2',
      category: 'Furniture',
      name: 'Modern Armchair',
      price: 149.99,
      quantity: 0,
    },
    {
      id: '3',
      category: 'Lighting',
      name: 'Luminous Floor Lamp',
      price: 89.99,
      quantity: 0,
    },
    {
      id: '4',
      category: 'Furniture',
      name: 'Serenity Chaise Lounge',
      price: 278.99,
      quantity: 0,
    },
  ];

  // The product with quantity, a local front-end in memory array
  productsWithQuantity: any[] = [];

  cartItems$: Observable<any> | undefined;

  selectedCategory = '';

  constructor(private cartService: CartService) {}

  ngOnInit() {
    this.cartItems$ = this.cartService.fetchCartItems().pipe(
      tap((cartItems) => {
        this.products.forEach((product) => {
          const selectedProduct = cartItems.find(
            (item: any) => product.id === item.id
          );
          if (selectedProduct) {
            this.productsWithQuantity.push(selectedProduct);
          } else {
            this.productsWithQuantity.push(product);
          }
        });
      }),
      take(1)
    );
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

  fetchProductsByCategory(category: string): void {
    this.cartService.fetchProductsByCategory(category).subscribe({
      next: (products) => {
        console.log('category:', category);
        this.productsWithQuantity = products;
        console.log('this.productsWithQuantity:', this.productsWithQuantity);
        // Update quantities based on cart items
        // ...
      },
      error: (error) => {
        console.error('There was an error!', error);
      },
    });
  }
}
