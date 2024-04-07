import { Component, OnInit } from '@angular/core';
import { CartService } from '../cart.service';

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
        <tbody>
          <tr *ngFor="let item of cartItems">
            <td>{{ item.name }}</td>
            <td>{{ item.quantity }}</td>
            <td>{{ formatCurrency(item.price) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="total-line">
            <td colspan="2" class="total-amount">Total Amount:</td>
            <td class="total-amount">{{ formatCurrency(getTotalCost()) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `,
  styleUrls: ['./cart-summary.component.css'],
})
export class CartSummaryComponent implements OnInit {
  cartItems: any[] = [];

  constructor(private cartService: CartService) {}

  ngOnInit() {
    this.fetchCartItems();
  }

  fetchCartItems() {
    this.cartService.cart$.subscribe((items) => {
      this.cartItems = items;
    });
  }

  removeItem(itemId: string) {
    this.cartService.removeItem(itemId).subscribe(() => {
      this.fetchCartItems(); // Refresh the cart items list
    });
  }

  getTotalCost() {
    return this.cartItems.reduce(
      (acc: any, item: any) => acc + item.price * item.quantity,
      0
    );
  }

  formatCurrency(value: number) {
    return `$${value.toFixed(2)}`;
  }
}
