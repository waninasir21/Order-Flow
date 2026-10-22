import { ApolloError } from "@apollo/client";
import { API_URL } from "@/config";

// Turns any Apollo failure into a message a person can act on.
export function describeError(error: unknown): string {
  if (error instanceof ApolloError) {
    const first = error.graphQLErrors[0];
    if (first) return first.message;
    if (error.networkError) {
      return `Can't reach the server at ${API_URL}. Is the backend running, and is the phone on the same Wi-Fi?`;
    }
  }
  return error instanceof Error ? error.message : "Something went wrong";
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
