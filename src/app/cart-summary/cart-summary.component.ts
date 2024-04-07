import { Component, OnInit } from '@angular/core';
import { CartService } from '../cart.service';

@Component({
  selector: 'app-cart-summary',
  template: `
    <div>
      <h2>Cart Summary</h2>
      <ul>
        <li *ngFor="let item of cartItems">
          {{ item.name }} - {{ item.price }}
          <button (click)="removeItem(item.id)">Remove from Cart</button>
        </li>
      </ul>
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
    this.cartService.getCartItems().subscribe((items) => {
      this.cartItems = items;
    });
  }

  removeItem(itemId: string) {
    this.cartService.removeItem(itemId).subscribe(() => {
      this.fetchCartItems(); // Refresh the cart items list
    });
  }
}
