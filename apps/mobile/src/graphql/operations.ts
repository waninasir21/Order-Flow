import { gql } from "@apollo/client";

// One shared selection so the createOrder result has every field the Orders list
// needs. That lets us push the new order into the cached list without a refetch.
export const ORDER_FIELDS = gql`
  fragment OrderFields on Order {
    id
    status
    clientId
    total
    createdAt
    outlet {
      id
      name
    }
    items {
      id
      quantity
      priceAtOrder
      product {
        id
        name
      }
    }
  }
`;

export const LOGIN = gql`
  mutation Login($phone: String!, $password: String!) {
    login(phone: $phone, password: $password) {
      accessToken
      refreshToken
      employee {
        id
        name
        role
      }
    }
  }
`;

// Used by plain fetch in the Apollo error link (not through Apollo itself).
export const REFRESH_TOKENS_DOCUMENT = `
  mutation RefreshTokens($refreshToken: String!) {
    refreshTokens(refreshToken: $refreshToken) {
      accessToken
      refreshToken
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout($refreshToken: String!) {
    logout(refreshToken: $refreshToken)
  }
`;

export const OUTLETS = gql`
  query Outlets {
    outlets {
      id
      name
      address
      ownerName
      phone
    }
  }
`;

export const PRODUCTS = gql`
  query Products {
    products {
      id
      name
      sku
      price
      stockQuantity
    }
  }
`;

export const ORDERS = gql`
  query Orders {
    orders {
      ...OrderFields
    }
  }
  ${ORDER_FIELDS}
`;

export const CREATE_ORDER = gql`
  mutation CreateOrder($outletId: ID!, $items: [OrderItemInput!]!, $clientId: ID) {
    createOrder(outletId: $outletId, items: $items, clientId: $clientId) {
      ...OrderFields
    }
  }
  ${ORDER_FIELDS}
`;

// Fires when an admin approves / rejects / fulfils an order. The rep only receives their own
// orders (the server filters), and the selection matches the Orders list so the payload can
// replace the cached copy as-is.
export const ORDER_STATUS_CHANGED = gql`
  subscription OrderStatusChanged {
    orderStatusChanged {
      ...OrderFields
    }
  }
  ${ORDER_FIELDS}
`;
