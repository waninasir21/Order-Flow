import type { Product } from "@prisma/client";
import { prisma } from "./prisma";

export const typeDefs = /* GraphQL */ `#graphql
  type Outlet {
    id: ID!
    name: String!
    address: String!
    ownerName: String!
    phone: String!
  }

  type Product {
    id: ID!
    name: String!
    sku: String!
    price: Float!
    stockQuantity: Int!
  }

  type Query {
    outlets: [Outlet!]!
    products: [Product!]!
  }
`;

export const resolvers = {
  Query: {
    outlets: () => prisma.outlet.findMany({ orderBy: { createdAt: "asc" } }),
    products: () => prisma.product.findMany({ orderBy: { createdAt: "asc" } }),
  },
  Product: {
    // Prisma returns Decimal; GraphQL Float needs a number.
    price: (p: Product) => p.price.toNumber(),
  },
};
