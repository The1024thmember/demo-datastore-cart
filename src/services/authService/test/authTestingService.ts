import { Observable, of } from 'rxjs';
import { AuthServiceInterface, AuthState } from '../authService.interface';

export class AuthTestingService implements AuthServiceInterface {
  get authState$(): Observable<AuthState | undefined> {
    return of({
      userId: String(1),
      token: '',
    });
  }
  getAuthUid() {
    return of(String(1));
  }
}
