// import { HttpClient } from '@angular/common/http';
// import { Injectable } from '@angular/core';
// import { Observable } from 'rxjs';

// @Injectable({
//   providedIn: 'root',
// })
// export class CartService {
//   private baseUrl = 'http://localhost:3000/cart';

//   constructor(private http: HttpClient) {}

//   getCartItems(): Observable<any[]> {
//     return this.http.get<any[]>(this.baseUrl);
//   }

//   addItem(item: any): Observable<any> {
//     return this.http.post(this.baseUrl, item);
//   }

//   removeItem(itemId: string): Observable<any> {
//     return this.http.delete(`${this.baseUrl}/${itemId}`);
//   }
// }

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

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
        map(async (r: any) => {
          await firstValueFrom(this.fetchCartItems()); // Refresh the cart items after adding
          return r.status;
        })
      )
    );
  }

  removeItem(itemId: string): Promise<any> {
    return firstValueFrom(
      this.http
        .delete(`${this.baseUrl}/${itemId}`, { observe: 'response' })
        .pipe(
          map(async (r: any) => {
            await firstValueFrom(this.fetchCartItems()); // Refresh the cart items after adding
            return r.status;
          })
        )
    );
  }
}
