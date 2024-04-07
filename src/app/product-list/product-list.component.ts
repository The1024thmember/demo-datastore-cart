import { Component } from '@angular/core';
import { CartService } from '../cart.service';

@Component({
  selector: 'app-product-list',
  template: `
    <div>
      <h2>Products</h2>
      <div *ngFor="let product of products" class="product-card">
        <div class="product-image">
          <!-- Placeholder for product image, could use an actual <img> tag -->
          Image
        </div>
        <h3>{{ product.name }}</h3>
        <p>{{ formatCurrency(product.price) }}</p>
        <div class="product-controls">
          <button (click)="addToCart(product)">Add to Cart</button>
          <span>{{ product.quantity }}</span>
          <button (click)="removeFromCart(product)">Remove</button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./product-list.component.css'],
})
export class ProductListComponent {
  products = [
    { id: '1', name: 'Elegant Desk Lamp', price: 49.99, quantity: 0 },
    { id: '2', name: 'Modern Armchair', price: 149.99, quantity: 0 },
    // More products...
  ];

  cartItems: any = [];

  constructor(private cartService: CartService) {}

  addToCart(product: any) {
    product.quantity++;
    this.cartService.addItem(product).subscribe((items) => {
      this.cartItems = items;
    });
  }

  removeFromCart(product: any) {
    const cartItem = this.cartItems.find((item: any) => item.id === product.id);
    if (cartItem && cartItem.quantity > 0) {
      cartItem.quantity--;
      // Additional logic to handle removing from cart
      if (cartItem.quantity === 0) {
        this.cartItems = this.cartItems.filter(
          (item: any) => item.id !== product.id
        );
      }
      this.updateProductListQuantity(product.id, -1);
    }
  }

  updateProductListQuantity(productId: string, change: number) {
    const product = this.products.find((item) => item.id === productId);
    if (product) {
      product.quantity += change;
    }
  }

  formatCurrency(value: number) {
    return `$${value.toFixed(2)}`;
  }
}
