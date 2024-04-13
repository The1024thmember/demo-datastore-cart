export type SockMessageSend =
  | AuthSubMessage
  | OnlineOfflineSubUnsubMessage
  | ResourceSubMessage
  | ResourceUnsubMessage;

export interface AuthSubMessage {
  readonly channel: 'auth';
  readonly body: {
    readonly hash2: string;
    readonly user_id: number;
  };
}
export interface OnlineOfflineSubUnsubMessage {
  readonly channel: 'onlineoffline';
  readonly body: {
    readonly route: 'getsub' | 'unsub'; // unsub isn't implemented yet.
    readonly users: readonly number[];
  };
}

export type WebsocketResourceChannel = string;

export interface WebsocketUnsubResource {
  readonly id: number;
  readonly type: number;
}

export interface ResourceSubMessage {
  readonly channel: 'channels';
  readonly body: {
    readonly channels: readonly WebsocketResourceChannel[];
  };
}

export interface ResourceUnsubMessage {
  readonly channel: 'resource';
  readonly body: {
    readonly route: 'unsub';
    readonly resources: readonly WebsocketUnsubResource[];
  };
}
