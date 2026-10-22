import { ApolloError } from "@apollo/client";
import { API_URL } from "@/config";

// Turns any Apollo failure into a message a person can act on.
export function describeError(error: unknown): string {
  if (error instanceof ApolloError) {
    const first = error.graphQLErrors[0];
    if (first) return first.message;
    if (error.networkError) {
      // The server answered with an HTTP error (e.g. 400 for a bad query): show its message.
      const net = error.networkError as {
        statusCode?: number;
        result?: { errors?: { message?: string }[] } | string;
      };
      if (net.statusCode !== undefined) {
        const detail = typeof net.result === "object" ? net.result?.errors?.[0]?.message : undefined;
        return detail ?? `The server returned an error (${net.statusCode})`;
      }
      return `Can't reach the server at ${API_URL}. Is the backend running, and is the phone on the same Wi-Fi?`;
    }
  }
  return error instanceof Error ? error.message : "Something went wrong";
}

// True when the request never got a real answer from our server, so the outcome is
// unknown and trying again later is the right move: offline, unreachable, timed out, or
// a 5xx. False for anything the server definitively answered (including 4xx and any
// GraphQL error such as INSUFFICIENT_STOCK), which will not change by retrying.
export function isNetworkFailure(error: unknown): boolean {
  if ((error as { isTimeout?: boolean } | null)?.isTimeout === true) return true;
  if (!(error instanceof ApolloError)) return false;
  if (error.graphQLErrors.length > 0) return false;
  const net = error.networkError;
  if (!net) return false;
  const status = (net as { statusCode?: number }).statusCode;
  return status === undefined || status >= 500;
}

export function errorCode(error: unknown): string | undefined {
  if (error instanceof ApolloError) {
    const code = error.graphQLErrors[0]?.extensions?.code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function formatMoney(value: number): string {
  return `₹${value.toFixed(2)}`;
}
