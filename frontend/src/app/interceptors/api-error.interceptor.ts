import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * Normalises HTTP error responses into a plain Error with a human-readable
 * message. Components and services can rely on `err.message` without
 * inspecting HttpErrorResponse internals.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const serverMsg = (err.error as { error?: string } | null)?.error;
        const message = serverMsg ?? err.message ?? 'An unexpected error occurred';
        return throwError(() => new Error(message));
      }
      return throwError(() => err);
    }),
  );
