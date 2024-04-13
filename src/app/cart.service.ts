import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  firstValueFrom,
  map,
  Observable,
  switchMap,
  tap,
} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private baseUrl = 'http://localhost:3000/cart';

  private cartSubject = new BehaviorSubject<any[]>([]);
  cart$ = this.cartSubject.asObservable().pipe(); // Public observable for components to subscribe to

  constructor(private http: HttpClient) {}

  fetchCartItems(): Observable<any> {
    return this.http.get<any[]>(this.baseUrl).pipe(
      tap((items) => {
        this.cartSubject.next(items);
      }),
      switchMap(() => this.cart$.pipe())
    );
  }

  fetchProductsByCategory(category: string): Observable<any[]> {
    // Construct the query parameter string based on category

    console.log('category:', category);
    const queryParam = category ? `?category=${category}` : '';
    console.log('queryParamL:', queryParam);
    // Fetch the items with the category query parameter
    return this.http.get<any[]>(`${this.baseUrl}${queryParam}`);
  }

  modifyItem(item: any): Promise<any> {
    return firstValueFrom(
      this.http.post(this.baseUrl, item, { observe: 'response' }).pipe(
        tap(() => {
          const updatedItems = this.cartSubject.value.map((orignalItem) => {
            if (orignalItem.id === item.id) {
              return item;
            }
            return orignalItem;
          });
          this.cartSubject.next(updatedItems);
        }),
        map((r) => r.status)
      )
    );
  }

  removeItem(itemId: string): Promise<any> {
    return firstValueFrom(
      this.http
        .delete(`${this.baseUrl}/${itemId}`, { observe: 'response' })
        .pipe(map((r) => r.status))
    );
  }
}
