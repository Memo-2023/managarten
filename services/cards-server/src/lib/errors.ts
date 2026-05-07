/**
 * Domain errors — caught by `serviceErrorHandler` from @mana/shared-hono.
 *
 * The shared handler only translates Hono `HTTPException`s; anything
 * else degrades to 500. So our errors extend HTTPException directly
 * rather than maintaining a parallel hierarchy.
 *
 * `details` (e.g. zod issue tree) is passed via `cause` because the
 * shared handler picks that up and surfaces it in the JSON body.
 */

import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

function makeException(
	status: ContentfulStatusCode,
	message: string,
	code?: string,
	details?: unknown
) {
	return new HTTPException(status, {
		message,
		cause: details ? { code, details } : code ? { code } : undefined,
	});
}

export class HttpError extends HTTPException {}

export class UnauthorizedError extends HTTPException {
	constructor(message = 'Unauthorized') {
		super(401, { message, cause: { code: 'unauthorized' } });
	}
}

export class ForbiddenError extends HTTPException {
	constructor(message = 'Forbidden') {
		super(403, { message, cause: { code: 'forbidden' } });
	}
}

export class NotFoundError extends HTTPException {
	constructor(message = 'Not found') {
		super(404, { message, cause: { code: 'not_found' } });
	}
}

export class ConflictError extends HTTPException {
	constructor(message = 'Conflict') {
		super(409, { message, cause: { code: 'conflict' } });
	}
}

export class BadRequestError extends HTTPException {
	constructor(message = 'Bad request', details?: unknown) {
		super(400, {
			message,
			cause: details ? { code: 'bad_request', details } : { code: 'bad_request' },
		});
	}
}

// Keep makeException exported in case future code wants the raw factory.
export { makeException };
