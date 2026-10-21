import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { typeDefs, resolvers } from "./schema";
import { buildContext, type Context } from "./context";

async function start() {
  const app = express();
  const server = new ApolloServer<Context>({ typeDefs, resolvers });
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
  app.listen(port, () => {
    console.log(`GraphQL ready at http://localhost:${port}/graphql`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
