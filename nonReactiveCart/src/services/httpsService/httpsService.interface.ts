import { HttpEvent } from '@angular/common/http';
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ResponseData } from 'src/app/datastore/abstractions/store.model';

export interface HttpAdapter {
  get<T, E>(
    endpoint: string,
    options?: unknown
  ): Observable<ResponseData<T, E>>;
  get<T, E>(
    endpoint: string,
    options?: unknown
  ): Observable<HttpEvent<ResponseData<T, E>>>;

  post<T, E>(
    endpoint: string,
    body: any | null,
    options?: unknown
  ): Observable<ResponseData<T, E>>;
  post<T, E>(
    endpoint: string,
    body: any | null,
    options?: unknown
  ): Observable<HttpEvent<ResponseData<T, E>>>;

  put<T, E>(
    endpoint: string,
    body: any | null,
    options?: unknown
  ): Observable<ResponseData<T, E>>;
  put<T, E>(
    endpoint: string,
    body: any | null,
    options?: unknown
  ): Observable<HttpEvent<ResponseData<T, E>>>;

  delete<T, E>(
    endpoint: string,
    options?: unknown
  ): Observable<ResponseData<T, E>>;
  delete<T, E>(
    endpoint: string,
    options?: unknown
  ): Observable<HttpEvent<ResponseData<T, E>>>;
}

export interface RawSuccessResponseData<T> {
  status: 'success';
  result: T;
  request_id?: string;
}

export interface HttpConfig {
  baseUrl: string;
}

export const HTTP_CONFIG = new InjectionToken<HttpConfig>('HttpConfig');
