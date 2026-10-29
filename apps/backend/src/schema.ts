import { authMutations, authQueries } from "./resolvers/auth";
import { analyticsQueries } from "./resolvers/analytics";
import { catalogMutations, catalogQueries, productFields } from "./resolvers/catalog";
import { subscriptions } from "./resolvers/subscriptions";
import { makeExecutableSchema } from "@graphql-tools/schema";
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

  type DailyOrders {
    # YYYY-MM-DD in the business time zone (Asia/Kolkata by default)
    date: String!
    count: Int!
  }

  type TopProduct {
    product: Product!
    totalQuantityOrdered: Int!
  }

  type AnalyticsSummary {
    # Orders placed in the last 7 days, today included (the sum of ordersPerDay(days: 7))
    ordersThisWeek: Int!
    pendingApprovals: Int!
    # 1-9 units left
    lowStockProducts: Int!
    outOfStockProducts: Int!
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
    order(id: ID!): Order!
    # ADMIN only. One row per day (zeros included), oldest first. days: 1-90.
    ordersPerDay(days: Int = 14): [DailyOrders!]!
    # ADMIN only. Best sellers by units, rejected orders excluded. limit: 1-20.
    topProducts(limit: Int = 5): [TopProduct!]!
    # ADMIN only.
    analyticsSummary: AnalyticsSummary!
  }

  type Mutation {
    login(phone: String!, password: String!): AuthPayload!
    refreshTokens(refreshToken: String!): AuthPayload!
    logout(refreshToken: String!): Boolean!
    # clientId makes the call idempotent: repeating it with the same clientId returns the
    # original order instead of creating (and charging stock for) a second one.
    createOrder(outletId: ID!, items: [OrderItemInput!]!, clientId: ID): Order!
    updateOrderStatus(orderId: ID!, status: OrderStatus!): Order!
    # ADMIN only. Sets stock to an absolute value; rejects negatives.
    updateProductStock(productId: ID!, stockQuantity: Int!): Product!
  }

  type Subscription {
    # Fires after an order's status changes. Reps receive only their own orders; admins
    # receive all. outletId narrows the stream to one outlet.
    orderStatusChanged(outletId: ID): Order!
  }
`;

export const resolvers = {
  Query: { ...authQueries, ...catalogQueries, ...orderQueries, ...analyticsQueries },
  Mutation: { ...authMutations, ...orderMutations, ...catalogMutations },
  Subscription: subscriptions,
  Product: productFields,
  Order: orderFields,
  OrderItem: orderItemFields,
};


// One executable schema shared by the HTTP (Apollo) and WebSocket (graphql-ws) servers.
export const schema = makeExecutableSchema({ typeDefs, resolvers });
