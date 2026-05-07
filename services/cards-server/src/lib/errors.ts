/**
 * Domain errors — caught by serviceErrorHandler from @mana/shared-hono
 * and translated to JSON responses with the right status code.
 */

export class HttpError extends Error {
	constructor(
		public status: number,
		message: string,
		public code?: string,
		public details?: unknown
	) {
		super(message);
		this.name = 'HttpError';
	}
}

export class UnauthorizedError extends HttpError {
	constructor(message = 'Unauthorized') {
		super(401, message, 'unauthorized');
		this.name = 'UnauthorizedError';
	}
}

export class ForbiddenError extends HttpError {
	constructor(message = 'Forbidden') {
		super(403, message, 'forbidden');
		this.name = 'ForbiddenError';
	}
}

export class NotFoundError extends HttpError {
	constructor(message = 'Not found') {
		super(404, message, 'not_found');
		this.name = 'NotFoundError';
	}
}

export class ConflictError extends HttpError {
	constructor(message = 'Conflict') {
		super(409, message, 'conflict');
		this.name = 'ConflictError';
	}
}

export class BadRequestError extends HttpError {
	constructor(message = 'Bad request', details?: unknown) {
		super(400, message, 'bad_request', details);
		this.name = 'BadRequestError';
	}
}
