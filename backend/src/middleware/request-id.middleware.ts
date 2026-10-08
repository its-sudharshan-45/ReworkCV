import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Accept a client-supplied id only if it is a safe token; otherwise mint
  // one. Raw reflection would allow log forgery and response-header attacks.
  const incomingId = req.header('x-request-id');
  const requestId =
    incomingId && /^[A-Za-z0-9_-]{1,64}$/.test(incomingId) ? incomingId : randomUUID();

  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
