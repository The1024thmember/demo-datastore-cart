import { BaseServerData, WebsocketResource } from './server.types';

export interface WebsocketMessage<C>
  extends BaseServerData<C>,
    WebsocketServerEvent<BaseMessageBody<C>> {
  readonly channel: 'user';
}

interface BaseMessageBody<C> extends BaseServerData<C> {
  readonly message: string;
  readonly targets: readonly any[];
}

export type WebsocketServerEventTParam =
  | 'OK'
  | ExpiringSubscriptionData
  | BaseMessageBody<any>;

export interface WebsocketServerEvent<T extends WebsocketServerEventTParam> {
  readonly channel: string;
  readonly body: T;
}

interface ExpiringSubscriptionData {
  readonly state: 'expiring';
  readonly resources: readonly WebsocketResource[];
}
