import "dotenv/config";
import http from "node:http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { schema } from "./schema";
import { prisma } from "./prisma";
import { buildContext, buildWsContext, type Context } from "./context";

// Application close code (4000-4999 is free for apps). NOT 4401: graphql-ws clients treat 4401
// as fatal and never reconnect. 4408 is retried; the client treats it as
// "refresh your access token, then reconnect".
const WS_TOKEN_EXPIRED = 4408;

const isProduction = process.env.NODE_ENV === "production";

// Browsers only enforce CORS for pages calling the API directly. The web dashboard calls it
// from the Next.js server (Server Actions) and the mobile app is not a browser, so neither
// needs CORS today; the allowlist exists for any future browser client (and for the GraphQL
// sandbox). In production nothing cross-origin is allowed unless CORS_ORIGINS lists it
// (comma-separated, e.g. "https://orderflow.vercel.app"). In development everything is.
function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}
const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);

async function start() {
  const app = express();
  const httpServer = http.createServer(app);

  // WebSocket endpoint for subscriptions, on the same port and path as HTTP GraphQL.
  const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });
  const wsCleanup = useServer(
    {
      schema,
      // Runs once per connection. Returning false rejects the handshake (close 4403).
      onConnect: (ctx) => {
        const params = ctx.connectionParams as { accessToken?: unknown } | undefined;
        const auth = buildWsContext(params?.accessToken).auth;
        if (!auth) return false;

        // Access tokens last 15 minutes but a socket can live for hours, so close it when
        // the token expires. The client refreshes its token and reconnects.
        if (auth.exp !== undefined) {
          const socket = ctx.extra.socket;
          const ms = Math.max(0, auth.exp * 1000 - Date.now());
          const timer = setTimeout(() => socket.close(WS_TOKEN_EXPIRED, "Token expired"), ms);
          socket.once("close", () => clearTimeout(timer));
        }
        return true;
      },
      // Resolver context for every operation on this connection.
      context: (ctx): Context =>
        buildWsContext((ctx.connectionParams as { accessToken?: unknown } | undefined)?.accessToken),
    },
    wsServer
  );

  const server = new ApolloServer<Context>({
    schema,
    // Schema introspection is a map of the API for anyone who finds the URL. Off in production
    // unless explicitly enabled (ENABLE_INTROSPECTION=true), e.g. to demo from a GraphQL client.
    introspection: !isProduction || process.env.ENABLE_INTROSPECTION === "true",
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await wsCleanup.dispose();
            },
          };
        },
      },
    ],
  });
  await server.start();

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(
    "/graphql",
    cors({ origin: isProduction ? corsOrigins : true }),
    express.json(),
    expressMiddleware(server, { context: async ({ req }) => buildContext(req) })
  );

  const port = Number(process.env.PORT ?? 4000);
  httpServer.listen(port, () => {
    console.log(`GraphQL ready at http://localhost:${port}/graphql`);
    console.log(`Subscriptions ready at ws://localhost:${port}/graphql`);
  });

  // Hosts stop a container with SIGTERM before replacing it. Drain in-flight requests and close
  // WebSockets cleanly (the drain plugins above), then release the database connections.
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal} received, shutting down`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    try {
      await server.stop();
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown", err);
      process.exit(1);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
