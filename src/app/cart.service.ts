import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private baseUrl = 'http://localhost:3000/cart';

  constructor(private http: HttpClient) {}

  getCartItems(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }

  addItem(item: any): Observable<any> {
    return this.http.post(this.baseUrl, item);
  }

  removeItem(itemId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${itemId}`);
  }
}
