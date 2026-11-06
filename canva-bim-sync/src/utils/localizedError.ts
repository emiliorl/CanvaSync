import type { IntlShape, MessageDescriptor } from "react-intl";

/** Keep service errors independent of React; translate at the native UI boundary. */
export class LocalizedError extends Error {
  constructor(
    readonly descriptor: MessageDescriptor,
    fallback: string,
    readonly values?: Record<string, string | number>,
  ) {
    super(fallback);
    this.name = "LocalizedError";
  }
}

export function formatAppError(
  intl: Pick<IntlShape, "formatMessage">,
  error: unknown,
  fallback: string,
): string {
  if (error instanceof LocalizedError)
    return intl.formatMessage(error.descriptor, error.values);
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
