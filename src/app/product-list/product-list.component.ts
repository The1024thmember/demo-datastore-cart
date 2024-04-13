import { Component, OnInit } from '@angular/core';
import { Observable, take, tap } from 'rxjs';
import { Datastore } from '../datastore/abstractions/datastore';
import { ExampleCollection } from '../datastore/collections';
import { formatCurrency } from '../helper';

@Component({
  selector: 'app-product-list',
  template: `
    <div *ngIf="cartItems$ | async as cartItems">
      <h2>Product Items</h2>
      <!-- product-list.component.html -->
      <div>
        <select
          [(ngModel)]="selectedCategory"
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
              (click)="addToCart(product, cartItems)"
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

  constructor(private datastore: Datastore) {}

  ngOnInit() {
    this.cartItems$ = this.datastore
      .documents<ExampleCollection>('example', (query) =>
        query.where('id', 'in', [1, 2, 3, 4])
      )
      .valueChanges()
      .pipe(
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
    this.datastore
      .documents<ExampleCollection>('example', (query) =>
        query.where('id', '==', 1)
      )
      .update(product.id, { ...product, quantity: currentQuantity + 1 });

    console.log('{ ...product, quantity: currentQuantity + 1 }:', {
      ...product,
      quantity: currentQuantity + 1,
    });
    // const currentQuantity = this.getProductQuantity(cartItems, product);
    // product.quantity = currentQuantity + 1;
    // this.cartService.modifyItem(product).then((status) => {
    //   console.log('adding  item status:', status);
    // });
  }

  isProductInCart(cartItems: any, product: any) {
    return !!cartItems.find((item: any) => item.id === product.id);
  }

  getProductQuantity(cartItems: any, product: any) {
    return cartItems.find((item: any) => item.id === product.id)?.quantity ?? 0;
  }

  fetchProductsByCategory(category: string): void {
    this.cartItems$ = this.datastore
      .documents<ExampleCollection>('example', (query) =>
        query.where('category', '==', category)
      )
      .valueChanges()
      .pipe(
        tap((cartItems) => {
          this.productsWithQuantity = [];
          this.products.forEach((product) => {
            const selectedProduct = cartItems.find(
              (item: any) => product.id === item.id
            );
            if (selectedProduct) {
              this.productsWithQuantity.push(selectedProduct);
            }
          });
        }),
        take(1)
      );
  }
}
