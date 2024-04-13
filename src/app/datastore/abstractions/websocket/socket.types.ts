export interface SockMessageRawEvent extends SockBaseRawEvent {
  readonly data: string;
}
export interface SockBaseRawEvent {
  readonly type: string;
}
