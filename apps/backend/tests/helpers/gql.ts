import { graphql, type ExecutionResult } from "graphql";
import { schema } from "../../src/schema";
import type { Context } from "../../src/context";
import type { AccessPayload } from "../../src/auth/tokens";

// Runs an operation through the real executable schema (validation, resolvers, field
// resolvers, error formatting) without HTTP. Auth is passed as the context the HTTP layer
// would have built from a verified token; tests of the token itself live in the unit suite.
export async function run<T = Record<string, unknown>>(
  source: string,
  variables: Record<string, unknown> = {},
  auth: AccessPayload | null = null
): Promise<ExecutionResult<T>> {
  const contextValue: Context = { auth };
  return graphql({ schema, source, variableValues: variables, contextValue }) as Promise<
    ExecutionResult<T>
  >;
}

export function errorCode(result: ExecutionResult): string | undefined {
  return result.errors?.[0]?.extensions?.code as string | undefined;
}

export const CREATE_ORDER = /* GraphQL */ `
  mutation ($outletId: ID!, $items: [OrderItemInput!]!, $clientId: ID) {
    createOrder(outletId: $outletId, items: $items, clientId: $clientId) {
      id
      status
      clientId
      total
      items { quantity priceAtOrder product { id } }
    }
  }
`;

export const UPDATE_STATUS = /* GraphQL */ `
  mutation ($orderId: ID!, $status: OrderStatus!) {
    updateOrderStatus(orderId: $orderId, status: $status) { id status }
  }
`;
