import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Datastore } from '../datastore/abstractions/datastore';
import { ExampleCollection } from '../datastore/collections';
import { formatCurrency } from '../helper';

@Component({
  selector: 'app-cart-summary',
  template: `
    <div>
      <h2>Cart Summary</h2>
      <table class="summary-table">
        <thead>
          <tr>
            <th>Product Name</th>
            <th>Quantity</th>
            <th>Cost</th>
          </tr>
        </thead>
        <ng-container *ngIf="cartItems$ | async as cartItems">
          <tbody>
            <tr *ngFor="let item of cartItems">
              <ng-container *ngIf="item.quantity > 0">
                <td>{{ item.name }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ formatCurrency(item.price * item.quantity) }}</td>
              </ng-container>
            </tr>
          </tbody>
          <tfoot>
            <tr class="total-line">
              <td colspan="2" class="total-amount">Total Amount:</td>
              <td class="total-amount">
                {{ formatCurrency(getTotalCost(cartItems)) }}
              </td>
            </tr>
          </tfoot>
        </ng-container>
      </table>
    </div>
  `,
  styleUrls: ['./cart-summary.component.css'],
})
export class CartSummaryComponent implements OnInit {
  formatCurrency = formatCurrency;

  cartItems$: Observable<any> | undefined;

  constructor(private datastore: Datastore) {}

  ngOnInit() {
    this.cartItems$ = this.datastore
      .documents<ExampleCollection>('example', (query) =>
        query.where('id', 'in', [1, 2, 3, 4])
      )
      .valueChanges();
  }

  getTotalCost(cartItems: any) {
    return cartItems.reduce(
      (acc: any, item: any) => acc + item.price * item.quantity,
      0
    );
  }
}
