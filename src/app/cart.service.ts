import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private baseUrl = 'http://localhost:3000/cart';
  private cartSubject = new BehaviorSubject<any[]>([]); // Private field so only inside the service, the data is mutable.
  cart$ = this.cartSubject.asObservable(); // Public observable for components to subscribe to

  constructor(private http: HttpClient) {}

  fetchCartItems(): void {
    this.http.get<any[]>(this.baseUrl).subscribe((items) => {
      this.cartSubject.next(items);
      this.getCartSubjectValue();
    });
  }

  addItem(item: any): Observable<any> {
    return this.http.post(this.baseUrl, item).pipe(
      tap(() => {
        this.fetchCartItems(); // Refresh the cart items after adding
      })
    );
  }

  removeItem(itemId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${itemId}`).pipe(
      tap(() => {
        this.fetchCartItems(); // Refresh the cart items after removing
      })
    );
  }

  // Get the result for the cart subject value
  getCartSubjectValue() {
    console.log('cartService value:', this.cartSubject.value);
  }
}
