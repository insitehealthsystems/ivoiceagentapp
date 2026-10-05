/**
 * Typed application error carrying an HTTP status and a stable
 * machine-readable code. Thrown anywhere in the request pipeline and
 * handled centrally by middleware/errorHandler.ts.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const Errors = {
  validation: (message: string) => new ApiError(400, 'VALIDATION_ERROR', message),
  notFound: (message = 'The requested resource does not exist.') => new ApiError(404, 'NOT_FOUND', message),
  // Note: there is no server-side "microphone unavailable" error -- mic
  // access is purely a browser concern (getUserMedia), handled entirely
  // client-side in audioService.ts / MicrophoneUnavailableError.
  speechNotRecognized: () => new ApiError(422, 'SPEECH_NOT_RECOGNIZED', "I didn't catch that. Please try again."),
  speechServiceError: () =>
    new ApiError(503, 'SPEECH_SERVICE_ERROR', 'There was a problem with speech processing. Please try again.'),
  foundryUnavailable: () =>
    new ApiError(503, 'FOUNDRY_UNAVAILABLE', 'iLocate is temporarily unavailable. Please try again.'),
  timeout: () => new ApiError(504, 'TIMEOUT', 'The request took too long. Please try again.'),
  internal: (message = 'Something went wrong. Please try again.') => new ApiError(500, 'INTERNAL_ERROR', message),
};
