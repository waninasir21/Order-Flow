import { authMutations, authQueries } from "./resolvers/auth";
import { catalogQueries, productFields } from "./resolvers/catalog";
import { orderFields, orderItemFields, orderMutations, orderQueries } from "./resolvers/orders";

export const typeDefs = /* GraphQL */ `#graphql
  enum Role {
    REP
    ADMIN
  }

  enum OrderStatus {
    PLACED
    APPROVED
    REJECTED
    FULFILLED
  }

  type Employee {
    id: ID!
    name: String!
    phone: String!
    role: Role!
  }

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

  type OrderItem {
    id: ID!
    product: Product!
    quantity: Int!
    priceAtOrder: Float!
  }

  type Order {
    id: ID!
    outlet: Outlet!
    employee: Employee!
    status: OrderStatus!
    clientId: ID
    items: [OrderItem!]!
    total: Float!
    createdAt: String!
    updatedAt: String!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    employee: Employee!
  }

  input OrderItemInput {
    productId: ID!
    quantity: Int!
  }

  type Query {
    me: Employee!
    outlets: [Outlet!]!
    products: [Product!]!
    orders(outletId: ID, status: OrderStatus): [Order!]!
  }

  type Mutation {
    login(phone: String!, password: String!): AuthPayload!
    refreshTokens(refreshToken: String!): AuthPayload!
    logout(refreshToken: String!): Boolean!
    # clientId makes the call idempotent: repeating it with the same clientId returns the
    # original order instead of creating (and charging stock for) a second one.
    createOrder(outletId: ID!, items: [OrderItemInput!]!, clientId: ID): Order!
    updateOrderStatus(orderId: ID!, status: OrderStatus!): Order!
  }
`;

export const resolvers = {
  Query: { ...authQueries, ...catalogQueries, ...orderQueries },
  Mutation: { ...authMutations, ...orderMutations },
  Product: productFields,
  Order: orderFields,
  OrderItem: orderItemFields,
};
