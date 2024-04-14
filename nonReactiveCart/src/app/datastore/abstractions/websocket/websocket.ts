import { Inject, Injectable, NgZone, OnDestroy } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  fromEvent,
  map,
  Observable,
  Subject,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import { AuthService } from 'src/services/authService/authService';
import { AuthState } from 'src/services/authService/authService.interface';
import { isDefined } from 'src/util';
import { TypedAction } from '../action';
import { DATASTORE_CONFIG } from '../backend.interface';
import { DatastoreConfig, StoreState } from '../store.model';
import {
  WebsocketMessage,
  WebsocketServerEvent,
  WebsocketServerEventTParam,
} from './server-event.model';
import { BaseServerMessage } from './server.types';
import { SockMessageRawEvent } from './socket.types';
import { ObservableWebSocket } from './websocket.factory';

export interface WebSocketResponse {
  readonly serverResponse: SockMessageRawEvent;
  readonly authState: AuthState;
}

enum ConnectionStatus {
  CLOSED,
  OPEN,
}

@UntilDestroy()
@Injectable({
  providedIn: 'root',
})
export class WebSocketService implements OnDestroy {
  private serverResponseSubscription?: Subscription;

  private connectionStatusSubject$ = new BehaviorSubject<ConnectionStatus>(
    ConnectionStatus.CLOSED
  );

  /**
   * This observable wraps the underlying web socket connection. When subscribed to, it:
   *  - Opens the web socket connection
   *  - Emits an observable that will emit server responses
   *  - Closes the connection when the observable is unsubscribed from
   *
   * ! here means to let typescript this value will be initialized properly
   */
  private _websocket$!: ObservableWebSocket;

  /**
   * This is a behavior subject that is used to request a reconnection of the web socket in certain cases:
   *  - When the native app is brought to the foreground and the connection is closed
   *  - After unsubscribing from channels
   *  - On a missing heartbeat
   *
   *  ! here means to let typescript this value will be initialized properly
   */
  private _requestReconnectionSubject$!: BehaviorSubject<void>;

  private fromServerStreamSubject$ = new Subject<
    WebsocketServerEvent<WebsocketServerEventTParam>
  >();
  fromServerStream$ = this.fromServerStreamSubject$.asObservable();

  constructor(
    private auth: AuthService,
    @Inject(DATASTORE_CONFIG) private datastoreConfig: DatastoreConfig,
    private ngZone: NgZone,
    private store$: Store<StoreState>
  ) {
    this.serverResponseSubscription = this.serverResponse$.subscribe({
      next: ({ serverResponse, authState }) => {
        const serverResponseData = JSON.parse(serverResponse.data);
        this.processServerResponse(
          serverResponseData,
          Number(authState.userId)
        );
      },
      error: (error) => {
        console.log('websocket error');
      },
      complete: () => {
        this.fromServerStreamSubject$.complete();
        this.connectionStatusSubject$.next(ConnectionStatus.CLOSED);
      },
    });
  }

  get websocket$(): ObservableWebSocket {
    if (!this._websocket$) {
      this._websocket$ = new ObservableWebSocket(
        this.datastoreConfig.webSocketUrl,
        this.ngZone
      );
    }
    return this._websocket$;
  }

  get serverResponse$(): Observable<WebSocketResponse> {
    return combineLatest([
      this.auth.authState$,
      this.requestReconnectionSubject$,
    ]).pipe(
      map(([authState]) => authState),
      // Mark the connection as closed
      tap(() => {
        this.connectionStatusSubject$.next(ConnectionStatus.CLOSED);
      }),
      filter(isDefined),
      // Hook onto the websocket
      switchMap((authState) =>
        this.websocket$.pipe(
          map((serverResponse$) => ({ serverResponse$, authState }))
        )
      ),
      // the observable produces a value once the websocket has been opened
      switchMap(({ serverResponse$, authState }) => {
        // ...

        // Subscribe to the serverResponse$ observable to get the response from the server
        return serverResponse$.pipe(
          map((serverResponse) => ({ serverResponse, authState }))
        );
      })
    );
  }

  // eslint-disable-next-line rxjs/no-exposed-subjects
  get requestReconnectionSubject$(): BehaviorSubject<void> {
    if (!this._requestReconnectionSubject$) {
      this._requestReconnectionSubject$ = new BehaviorSubject<void>(undefined);
    }
    return this._requestReconnectionSubject$;
  }

  // When the browser connects to the internet: https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event
  get onlineEvent$(): Observable<Event> {
    return fromEvent(window, 'online');
  }

  private isWebsocketMessage<C>(
    event: WebsocketServerEvent<WebsocketServerEventTParam>
  ): event is WebsocketMessage<C> {
    return event.channel === 'user';
  }

  private processServerResponse(
    serverResponseData: WebsocketServerEvent<WebsocketServerEventTParam>,
    userId: number
  ) {
    // Process websocket message
    if (this.isWebsocketMessage<BaseServerMessage>(serverResponseData)) {
      // prepare the action and dispatch the event
      const { body } = serverResponseData;

      const action: TypedAction = {
        type: 'WS_MESSAGE',
        payload: {
          ...body,
          toUserId: userId, // all WebSocket messages are tied to the current user
        },
      };
      this.store$.dispatch(action);
    }
  }

  ngOnDestroy(): void {
    this.serverResponseSubscription?.unsubscribe();
  }
}
