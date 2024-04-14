import { Observable } from 'rxjs';

export interface AuthState {
  userId: string;
  token: string;
}

export interface AuthServiceInterface {
  authState$: Observable<AuthState | undefined>;
  getAuthUid(): Observable<string>;
}
