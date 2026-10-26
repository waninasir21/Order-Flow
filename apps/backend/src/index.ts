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
import { buildContext, buildWsContext, type Context } from "./context";

// Application close code (4000-4999 is free for apps). NOT 4401: graphql-ws clients treat 4401
// as fatal and never reconnect. 4408 is retried; the client treats it as
// "refresh your access token, then reconnect".
const WS_TOKEN_EXPIRED = 4408;

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
    cors(),
    express.json(),
    expressMiddleware(server, { context: async ({ req }) => buildContext(req) })
  );

  const port = Number(process.env.PORT ?? 4000);
  httpServer.listen(port, () => {
    console.log(`GraphQL ready at http://localhost:${port}/graphql`);
    console.log(`Subscriptions ready at ws://localhost:${port}/graphql`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
