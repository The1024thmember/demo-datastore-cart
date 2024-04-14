// ////////////////
// Seconds
// ////////////////

/**
 * A timestamp in seconds: 500_000_000 - 5_000_000_000
 * @minimum 500000000
 * @maximum 5000000000
 * @type number
 */
export type TimestampSecondsType = number;

export interface TimestampSeconds {
  readonly timestamp: TimestampSecondsType;
}

export interface BaseServerMessage extends TimestampSeconds {
  readonly id: string;
  readonly type: string;
}

export interface BaseServerData<C> extends BaseServerMessage {
  readonly data: C;
}

export interface WebsocketResource {
  readonly id: number;
  readonly ttl?: number;
}
