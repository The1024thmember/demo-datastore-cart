import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Interface } from '../abstractions/datastore';
import {
  WebsocketServerEvent,
  WebsocketServerEventTParam,
} from '../abstractions/websocket/server-event.model';
import {
  WebSocketResponse,
  WebSocketService,
} from '../abstractions/websocket/websocket';
import { ObservableWebSocket } from '../abstractions/websocket/websocket.factory';

@Injectable()
export class WebSocketServiceFake
  implements OnDestroy, Interface<WebSocketService>
{
  get fromServerStream$(): Observable<
    WebsocketServerEvent<WebsocketServerEventTParam>
  > {
    throw new Error('Method not implemented.');
  }

  get websocket$(): ObservableWebSocket {
    throw new Error('Method not implemented.');
  }

  get serverResponse$(): Observable<WebSocketResponse> {
    throw new Error('Method not implemented.');
  }

  get requestReconnectionSubject$(): BehaviorSubject<void> {
    throw new Error('Method not implemented.');
  }

  get onlineEvent$(): Observable<Event> {
    throw new Error('Method not implemented.');
  }

  ngOnDestroy(): void {
    // Empty
  }
}
