import { Component, OnInit } from '@angular/core';
import { Observable, take } from 'rxjs';
import { CartService } from '../cart.service';
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
      <button class="fetch-summary-btn" (click)="fetchLatestCartItems()">
        Get Summary
      </button>
    </div>
  `,
  styleUrls: ['./cart-summary.component.css'],
})
export class CartSummaryComponent implements OnInit {
  formatCurrency = formatCurrency;

  cartItems$: Observable<any> | undefined;

  constructor(private cartService: CartService) {}

  ngOnInit() {
    this.cartItems$ = this.cartService.fetchCartItems();
  }

  getTotalCost(cartItems: any) {
    return cartItems.reduce(
      (acc: any, item: any) => acc + item.price * item.quantity,
      0
    );
  }

  fetchLatestCartItems() {
    // Fetch the latest cart items and refresh the cartItems$ observable
    this.cartItems$ = this.cartService.fetchCartItems().pipe(take(1));
  }
}
