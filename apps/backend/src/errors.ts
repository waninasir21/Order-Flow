import { GraphQLError } from "graphql";

// Clients branch on extensions.code (e.g. mobile refreshes the token on UNAUTHENTICATED).
function makeError(code: string) {
  return (message: string, extra: Record<string, unknown> = {}) =>
    new GraphQLError(message, { extensions: { code, ...extra } });
}

export const unauthenticated = makeError("UNAUTHENTICATED");
export const forbidden = makeError("FORBIDDEN");
export const badInput = makeError("BAD_USER_INPUT");
export const notFound = makeError("NOT_FOUND");
export const conflict = makeError("CONFLICT");
export const insufficientStock = makeError("INSUFFICIENT_STOCK");
