import { Component, OnInit } from '@angular/core';
import { BehaviorSubject, filter, map, Observable } from 'rxjs';
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

      <div
        *ngFor="let product of productsWithQuantity$ | async"
        class="product-card"
      >
        <div class="product-image">
          <img [src]="'assets/' + product.id + '.png'" />
        </div>
        <h3>{{ product.name }}</h3>
        <div class="product-controls">
          <button (click)="modifyCart(cartItems, product, '+')">+</button>
          <span>
            {{ product.quantity }}
          </span>
          <ng-container>
            <button
              [disabled]="!isProductInCart(cartItems, product)"
              (click)="modifyCart(cartItems, product, '-')"
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
  productsWithQuantity$: Observable<any> | undefined;

  cartItems$: Observable<any> | undefined;

  selectedCategory$ = new BehaviorSubject<any>('');

  selectedCategory = '';

  constructor(private datastore: Datastore) {}

  ngOnInit() {
    this.cartItems$ = this.datastore
      .documents<ExampleCollection>('example', (query) =>
        query
          .where('id', 'in', [1, 2, 3, 4])
          .where('category', '==', this.selectedCategory$)
      )
      .valueChanges();

    this.productsWithQuantity$ = this.cartItems$.pipe(
      filter((x) => x.length),
      map((cartItems) => {
        const productsWithQuantity: any[] = [];
        this.products.forEach((product) => {
          const selectedProduct = cartItems.find(
            (item: any) => product.id === item.id
          );
          if (selectedProduct) {
            productsWithQuantity.push(selectedProduct);
          }
        });
        return productsWithQuantity;
      })
    );
  }

  async modifyCart(cartItems: any, product: any, action: string) {
    const currentQuantity = this.getProductQuantity(cartItems, product);
    this.datastore
      .documents<ExampleCollection>('example', (query) =>
        query.where('id', '==', 1)
      )
      .update(product.id, {
        ...product,
        quantity: action === '+' ? currentQuantity + 1 : currentQuantity - 1,
      });
  }

  isProductInCart(cartItems: any, product: any) {
    return !!cartItems.find((item: any) => item.id === product.id);
  }

  getProductQuantity(cartItems: any, product: any) {
    return cartItems.find((item: any) => item.id === product.id)?.quantity ?? 0;
  }

  fetchProductsByCategory(category: string): void {
    this.selectedCategory$.next(category);
  }
}
