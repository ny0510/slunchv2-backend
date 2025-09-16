import { status } from 'elysia';
import { ERROR_MESSAGES } from '../constants';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function throwBadRequest(message: string): never {
  throw status(400, { message });
}

export function throwNotFound(message: string = ERROR_MESSAGES.NO_DATA): never {
  throw status(404, { message });
}

export function throwUnauthorized(message: string = ERROR_MESSAGES.UNAUTHORIZED): never {
  throw status(403, { message });
}

export function throwConflict(message: string): never {
  throw status(409, { message });
}

export function throwServerError(message: string = ERROR_MESSAGES.UNKNOWN_ERROR): never {
  throw status(500, { message });
}

export function handleNeisError(error: Error): never {
  const message = error.message.replace(/INFO-\d+\s*/g, '');

  if (message === ERROR_MESSAGES.NO_DATA) {
    throwNotFound(message);
  } else {
    throwBadRequest(message);
  }
}

export function handleComciganError(error: Error): never {
  const message = error.message;

  if (message === "undefined is not an object (evaluating 'teachers.length')") {
    throwNotFound(ERROR_MESSAGES.SCHOOL_NOT_FOUND);
  } else if (message === "undefined is not an object (evaluating 'raw[grade - 1][cls - 1][day - 1]')") {
    throwNotFound(ERROR_MESSAGES.TIMETABLE_NOT_FOUND);
  } else {
    throwServerError(ERROR_MESSAGES.UNKNOWN_ERROR);
  }
}