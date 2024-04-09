import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private baseUrl = 'http://localhost:3000/cart';

  constructor(private http: HttpClient) {}

  fetchCartItems(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }

  modifyItem(item: any): Promise<any> {
    return firstValueFrom(
      this.http
        .post(this.baseUrl, item, { observe: 'response' })
        .pipe(map((r) => r.status))
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
