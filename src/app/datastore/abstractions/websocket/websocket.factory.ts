import type { NgZone } from '@angular/core';
import type { Subscriber } from 'rxjs';
import { Observable, Subject, Subscription } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { RepetitiveSubscription } from 'src/operators/repetitiveSubscription';
import { SockMessageSend } from './message-send-model';
import { SockMessageRawEvent } from './socket.types';

/**
 * This error is thrown in the "close" event listener of the WebSocket connection,
 * when the "wasClean" property of the CloseEvent object is false, indicating that
 * the WebSocket connection was closed unexpectedly.
 */
export class NonCleanDisconnectError extends Error {}

/**
 * This class is responsible for creating an observable that maintains
 * the connection and sends messages to the backend after the WebSocket
 * connection has been established.
 *
 * The WebSocket connection can be established by passing in a string
 * representing the URL of the WebSocket server, or by passing in a
 * Socket object representing an established WebSocket connection.
 *
 * When the ObservableWebSocket is subscribed to, it sets up the
 * WebSocket connection and sends messages to the server. It also
 * listens for messages from the server and emits them as values of
 * the ObservableWebSocket.
 *
 * The ObservableWebSocket can be unsubscribed from, which will close
 * the WebSocket connection.
 */
// eslint-disable-next-line rxjs/no-subclass
export class ObservableWebSocket extends Observable<
  Observable<SockMessageRawEvent>
> {
  // Sock-js will send heartbeat every 25s
  public static readonly HEARTBEAT_MISSING_THRESHOLD = 60;

  @RepetitiveSubscription()
  private messagesStreamSubscription?: Subscription;
  private socket!: Socket;

  /**
   * Constructor for the ObservableWebSocket class.
   *
   * @param webSocketUrlOrSocket - a string representing the URL of the WebSocket server,
   *                               or a Socket object representing an established WebSocket connection
   * @param ngZone - an Angular NgZone object, used to run code inside or outside Angular's zone
   * @param handleMissingHeartBeat - a function that is called when the WebSocket connection's heartbeat is missing
   */
  constructor(
    private webSocketUrlOrSocket: string | Socket,
    private ngZone: NgZone
  ) {
    super();
  }

  /**
   * A method that is called when the ObservableWebSocket is subscribed to.
   * It is responsible for setting up the WebSocket connection and sending
   * messages to the server.
   *
   * @param observer - the observer to be notified of the WebSocket connection and messages
   * @returns a function that can be called to unsubscribe from the ObservableWebSocket
   */
  _subscribe(
    observer: Subscriber<Observable<SockMessageRawEvent>>
  ): () => void {
    // return the action for unsbscribe
    return this.ngZone.runOutsideAngular(() => {
      if (typeof this.webSocketUrlOrSocket === 'string') {
        this.socket = io(this.webSocketUrlOrSocket);
      } else {
        this.socket = this.webSocketUrlOrSocket;
      }
      let isClosed = false;
      let forcedClose = false;
      let heartbeatListener: EventListener;
      const serverResponseSubject$ = new Subject<SockMessageRawEvent>();

      /**
       * The event listener for the "open" event of the WebSocket connection.
       * It is called when the WebSocket connection is established.
       *
       * If the connection was closed by calling the unsubscribe method,
       * the WebSocket connection is closed. Otherwise, the
       * serverResponseSubject$ is emitted as the next value of the
       * ObservableWebSocket, the heartbeat listener function is set up,
       * and the heartbeat listener is added to the WebSocket connection.
       */
      this.socket.on('connect', () => {
        this.ngZone.run(() => {
          if (forcedClose) {
            this.socket.close();
          } else {
            observer.next(serverResponseSubject$);
          }
        });
      });

      // Listen to reconnection events
      this.socket.on('reconnecting', (attemptNumber: number) => {
        console.log(`Attempting to reconnect (attempt ${attemptNumber})...`);
      });

      this.socket.on('reconnect', (attemptNumber: number) => {
        console.log(`Reconnected successfully after ${attemptNumber} attempts`);
      });

      this.socket.on('reconnect_failed', () => {
        console.log('Failed to reconnect after multiple attempts');
        observer.error(new NonCleanDisconnectError());
      });

      /**
       * The event listener for the "error" event of the WebSocket connection.
       * It is called when an error occurs on the WebSocket connection.
       *
       * The isClosed flag is set to true and the error is emitted as an
       * error value of the ObservableWebSocket.
       */
      this.socket.on('error', (e) => {
        this.ngZone.run(() => {
          isClosed = true;
          observer.error(e);
        });
      });

      /**
       * The event listener for the "close" event of the WebSocket connection.
       * It is called when the WebSocket connection is closed.
       *
       * The isClosed flag is set to true. If the WebSocket connection was
       * closed in a clean way or by calling the unsubscribe method, the
       * ObservableWebSocket is completed. If the WebSocket connection was
       * closed unexpectedly, a NonCleanDisconnectError is emitted as an
       * error value of the ObservableWebSocket.
       */
      this.socket.on('disconnect', (e) => {
        this.ngZone.run(() => {
          // prevent observer.complete() being called after observer.error(...)
          if (isClosed) {
            return;
          }

          isClosed = true;
          observer.complete();
          serverResponseSubject$.complete();
        });
      });

      /**
       * The event listener for the "message" event of the WebSocket connection.
       * It is called when a message is received from the WebSocket server.
       *
       * The message is emitted as a value of the serverResponseSubject$.
       */
      this.socket.on('message', (data: any) => {
        this.ngZone.run(() => {
          serverResponseSubject$.next(data);
        });
      });

      return (): void => {
        this.ngZone.run(() => {
          forcedClose = true;

          this.unsubscribe();

          if (!isClosed) {
            this.ngZone.runOutsideAngular(() => {
              this.socket.close();
            });
          }
        });
      };
    });
  }

  /**
   * This function is responsible for sending messages to the backend
   * by subscribing to the messagesStream$ stream and whenever this
   * stream gets an emission, the emitted value is sent to the
   * backend.
   *
   * @param messagesStream$ - a stream of messages to be sent to the backend
   */
  send(messagesStream$: Observable<SockMessageSend>): void {
    this.messagesStreamSubscription = messagesStream$.subscribe((data) => {
      this.ngZone.runOutsideAngular(() => this.socket.send(data));
    });
  }

  private unsubscribe(): void {
    this.messagesStreamSubscription?.unsubscribe();
  }
}
