/* eslint-disable @typescript-eslint/no-explicit-any */
import '@angular/compiler'; // required for Angular HTTP classes in vitest node environment
import { describe, it, expect } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import type { HttpRequest } from '@angular/common/http';
import { throwError, of, lastValueFrom } from 'rxjs';
import { apiErrorInterceptor } from './api-error.interceptor';

// The interceptor only passes req through to next() — shape doesn't matter here.
const req = {} as HttpRequest<unknown>;

describe('apiErrorInterceptor', () => {
  it('passes successful responses through unchanged', async () => {
    const response = { type: 4, body: 'ok' } as any;
    const next = () => of(response);
    const result = await lastValueFrom(apiErrorInterceptor(req, next as any));
    expect(result).toBe(response);
  });

  it('extracts the server-provided error message from the response body', async () => {
    const next = () =>
      throwError(
        () => new HttpErrorResponse({ error: { error: 'Work order not found' }, status: 404 }),
      );
    await expect(lastValueFrom(apiErrorInterceptor(req, next as any))).rejects.toThrow(
      'Work order not found',
    );
  });

  it('falls back to HttpErrorResponse.message when the body has no error field', async () => {
    const next = () =>
      throwError(
        () =>
          new HttpErrorResponse({ error: null, status: 503, statusText: 'Service Unavailable' }),
      );
    const err = await lastValueFrom(apiErrorInterceptor(req, next as any)).catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBeTruthy();
  });

  it('falls back to generic message when body and http message are both absent', async () => {
    const next = () =>
      throwError(() => {
        const e = new HttpErrorResponse({ status: 0 });
        // Override message to simulate an empty/missing message
        Object.defineProperty(e, 'message', { value: undefined });
        return e;
      });
    const err = await lastValueFrom(apiErrorInterceptor(req, next as any)).catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBeTruthy();
  });

  it('passes non-HttpErrorResponse errors through unchanged', async () => {
    const originalError = new TypeError('network failure');
    const next = () => throwError(() => originalError);
    const err = await lastValueFrom(apiErrorInterceptor(req, next as any)).catch(e => e);
    expect(err).toBe(originalError);
  });
});
