import {
  HttpClient,
  HttpEvent,
  HttpHeaders,
  HttpParams,
  HttpResponse,
} from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, map, of, switchMap, take, tap } from 'rxjs';
import { ResponseData } from 'src/app/datastore/abstractions/store.model';
import {
  HTTP_CONFIG,
  HttpAdapter,
  HttpConfig,
  RawSuccessResponseData,
} from './httpsService.interface';

/**
 * Request options that serves as an alias for request options for HttpClient
 * methods (because they don't export them) plus a couple .
 * These are limited to currently the commonly used options for a direct
 * HTTP request. If you're missing anything that HttpClient has, please check
 * the docs on HttpClient requests and see if they are shared between all CRUD
 * methods first, then you're free to add it in.
 */
export interface RequestOptions<E> {
  service?: HttpsService;
  serializeBody?: boolean;
  params?: HttpParams;
  headers?: HttpHeaders;
}

@Injectable()
export class HttpsService implements HttpAdapter {
  private baseUrl: string;
  constructor(
    private http: HttpClient,
    @Inject(HTTP_CONFIG)
    private httpConfig: HttpConfig
  ) {
    this.baseUrl = this.httpConfig.baseUrl;
  }

  /**
   * Construct a GET request to the backend.
   * @param endpoint The endpoint
   * @param options Request options
   */
  get<T = any, E = any>(
    endpoint: string,
    options?: RequestOptions<E | 'UNKNOWN_ERROR'>
  ): Observable<ResponseData<T, E | 'UNKNOWN_ERROR'>>;
  get<T = any, E = any>(
    endpoint: string,
    options?: RequestOptions<E | 'UNKNOWN_ERROR'>
  ): Observable<HttpEvent<ResponseData<T, E | 'UNKNOWN_ERROR'>>>;
  get<T = any, E = any>(
    endpoint: string,
    options: RequestOptions<E | 'UNKNOWN_ERROR'> = {}
  ):
    | Observable<ResponseData<T, 'UNKNOWN_ERROR' | E>>
    | Observable<HttpEvent<ResponseData<T, 'UNKNOWN_ERROR' | E>>> {
    return this.getHeaders().pipe(
      take(1),
      map((headers) => ({
        endpoint,
        headers,
      })),
      tap((_) => {}),
      switchMap(({ endpoint: requestEndpoint, headers }) =>
        this.http.get<RawSuccessResponseData<T>>(
          `${this.baseUrl}/${requestEndpoint}`,
          {
            observe: 'response',
            params: options.params, // please note that options is already the params itself, it doesn't have param field
            headers: options.headers,
          }
        )
      ),
      map((response) => {
        return this.formatResponseBody<T, E>(response);
      })
      // catchError((error: HttpErrorResponse) =>
      //   console.error(error);
      // ),
    );
  }

  /**
   * Construct a POST request to the backend
   * @param endpoint The endpoint
   * @param body Request body
   * @param options Request options
   */
  post<T = any, E = any>(
    endpoint: string,
    body: any | null,
    options?: RequestOptions<E | 'UNKNOWN_ERROR'>
  ): Observable<ResponseData<T, E | 'UNKNOWN_ERROR'>>;
  post<T = any, E = any>(
    endpoint: string,
    body: any | null,
    options?: RequestOptions<E | 'UNKNOWN_ERROR'>
  ): Observable<HttpEvent<ResponseData<T, E | 'UNKNOWN_ERROR'>>>;
  post<T = any, E = any>(
    endpoint: string,
    body: any | null,
    options: RequestOptions<E | 'UNKNOWN_ERROR'> = {}
  ):
    | Observable<ResponseData<T, E | 'UNKNOWN_ERROR'>>
    | Observable<HttpEvent<ResponseData<T, E | 'UNKNOWN_ERROR'>>> {
    return this.getHeaders().pipe(
      take(1),
      map((headers) => ({
        endpoint,
        headers,
      })),
      switchMap(({ endpoint: requestEndpoint, headers }) =>
        this.http.post<RawSuccessResponseData<T>>(
          `${this.baseUrl}/${requestEndpoint}`,
          body,
          {
            observe: 'response',
            params: options.params,
            headers: options.headers,
          }
        )
      ),
      map((response) => this.formatResponseBody<T, E>(response))
      // catchError((error: HttpErrorResponse) =>
      //   console.error(error);
      // ),
    );
  }

  /**
   * Construct a PUT request to the backend
   * @param endpoint The endpoint
   * @param body Request body
   * @param options Request options
   */
  put<T = any, E = any>(
    endpoint: string,
    body: any | null,
    options?: RequestOptions<E | 'UNKNOWN_ERROR'>
  ): Observable<ResponseData<T, E | 'UNKNOWN_ERROR'>>;
  put<T = any, E = any>(
    endpoint: string,
    body: any | null,
    options?: RequestOptions<E | 'UNKNOWN_ERROR'>
  ): Observable<HttpEvent<ResponseData<T, E | 'UNKNOWN_ERROR'>>>;
  put<T = any, E = any>(
    endpoint: string,
    body: any | null,
    options: RequestOptions<E | 'UNKNOWN_ERROR'> = {}
  ):
    | Observable<ResponseData<T, E | 'UNKNOWN_ERROR'>>
    | Observable<HttpEvent<ResponseData<T, E | 'UNKNOWN_ERROR'>>> {
    return this.getHeaders().pipe(
      take(1),
      map((headers) => ({
        endpoint,
        headers,
      })),
      switchMap(({ endpoint: requestEndpoint, headers }) =>
        this.http.put<RawSuccessResponseData<T>>(
          `${this.baseUrl}/${requestEndpoint}`,
          body,
          {
            observe: 'response',
            params: options.params,
            headers: options.headers,
          }
        )
      ),
      map((response) => this.formatResponseBody<T, E>(response))
      // catchError((error: HttpErrorResponse) =>
      //   console.error(error);
      // ),
    );
  }

  /**
   * Construct a DELETE request to the backend
   * @param endpoint The endpoint
   * @param options Request options
   */
  delete<T = any, E = any>(
    endpoint: string,
    options?: RequestOptions<E | 'UNKNOWN_ERROR'>
  ): Observable<ResponseData<T, E | 'UNKNOWN_ERROR'>>;
  delete<T = any, E = any>(
    endpoint: string,
    options?: RequestOptions<E | 'UNKNOWN_ERROR'>
  ): Observable<HttpEvent<ResponseData<T, E | 'UNKNOWN_ERROR'>>>;
  delete<T = any, E = any>(
    endpoint: string,
    options: RequestOptions<E | 'UNKNOWN_ERROR'> = {}
  ):
    | Observable<ResponseData<T, 'UNKNOWN_ERROR' | E>>
    | Observable<HttpEvent<ResponseData<T, 'UNKNOWN_ERROR' | E>>> {
    return this.getHeaders().pipe(
      take(1),
      map((headers) => ({
        endpoint,
        headers,
      })),
      switchMap(({ endpoint: requestEndpoint, headers }) =>
        this.http.delete<RawSuccessResponseData<T>>(
          `${this.baseUrl}/${requestEndpoint}`,
          {
            observe: 'response',
            params: options.params,
            headers: options.headers,
          }
        )
      ),
      map((response) => this.formatResponseBody<T, E>(response))
      // catchError((error: HttpErrorResponse) =>
      //   console.error(error);
      // )
    );
  }

  private getHeaders() {
    return of('');
  }

  /**
   * Format response body to the interface that we want to return.
   * For now it's only adding a status code into the response body.
   * @param response The HttpResponse object.
   */
  private formatResponseBody<T, E>(
    response: HttpResponse<RawSuccessResponseData<T>>
  ): ResponseData<T, E | 'UNKNOWN_ERROR'> {
    if (response.body === null) {
      console.error('No response body', response);
      return {
        status: 'error',
        errorCode: 'UNKNOWN_ERROR',
      };
    }

    if (response.body.status !== 'success') {
      console.error('Malformed backend response', response.body);
      return {
        status: 'error',
        errorCode: 'UNKNOWN_ERROR',
      };
    }

    return {
      status: response.body.status,
      result: response.body.result,
      requestId: response.body.request_id,
    };
  }
}
