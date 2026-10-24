import { BACKEND_URL } from "./config";

// "network": we got no usable answer (backend down, timeout, 5xx). The outcome is unknown.
// "graphql": the backend answered and said no; `code` is its extensions.code.
export class BackendError extends Error {
  constructor(
    message: string,
    readonly kind: "network" | "graphql",
    readonly code?: string
  ) {
    super(message);
    this.name = "BackendError";
  }
}

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { message: string; extensions?: { code?: string } }[];
}

const TIMEOUT_MS = 15_000; // Neon's free tier can take several seconds to wake up

// The only function that talks to the backend. Server-side only; shared by the proxy,
// server actions and server components.
export async function backendRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  accessToken?: string
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new BackendError("The backend could not be reached", "network");
  }

  if (res.status >= 500) throw new BackendError(`The backend returned ${res.status}`, "network");

  let body: GraphQLResponse<T>;
  try {
    body = (await res.json()) as GraphQLResponse<T>;
  } catch {
    throw new BackendError("The backend sent an unreadable response", "network");
  }

  const first = body.errors?.[0];
  if (first) throw new BackendError(first.message, "graphql", first.extensions?.code);
  if (!body.data) throw new BackendError("The backend returned no data", "network");
  return body.data;
}
