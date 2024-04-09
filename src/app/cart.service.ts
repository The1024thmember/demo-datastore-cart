import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { mapTo, switchMap, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private baseUrl = 'http://localhost:3000/cart';
  private cartSubject = new BehaviorSubject<any[]>([]);
  cart$ = this.cartSubject.asObservable(); // Public observable for components to subscribe to

  constructor(private http: HttpClient) {}

  fetchCartItems(): Observable<any> {
    return this.http.get<any[]>(this.baseUrl).pipe(
      tap((items) => this.cartSubject.next(items)),
      switchMap(() => this.cart$)
    );
  }

  modifyItem(item: any): Promise<any> {
    return firstValueFrom(
      this.http.post(this.baseUrl, item, { observe: 'response' }).pipe(
        switchMap((response) => {
          return this.fetchCartItems().pipe(
            // Ignore the result of fetchCartItems, just pass the original response through
            mapTo(response.status)
          );
        })
      )
    );
  }

  removeItem(itemId: string): Promise<any> {
    return firstValueFrom(
      this.http
        .delete(`${this.baseUrl}/${itemId}`, { observe: 'response' })
        .pipe(
          switchMap((response) => {
            return this.fetchCartItems().pipe(
              // Ignore the result of fetchCartItems, just pass the original response through
              mapTo(response.status)
            );
          })
        )
    );
  }
}
