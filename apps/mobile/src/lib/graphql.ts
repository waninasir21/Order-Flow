import { gql } from "@apollo/client";

export type Role = "REP" | "ADMIN";
export type OrderStatus = "PLACED" | "APPROVED" | "REJECTED" | "FULFILLED";
export type Outlet = {
  id: string;
  name: string;
  address: string;
  ownerName: string;
  phone: string;
};
export type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
};
export type Order = {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  outlet: { id: string; name: string };
  items: {
    id: string;
    quantity: number;
    priceAtOrder: number;
    product: { id: string; name: string };
  }[];
};
export type LoginData = {
  login: {
    accessToken: string;
    refreshToken: string;
    employee: { id: string; name: string; role: Role };
  };
};

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

const ORDER_FIELDS = `
  id status total createdAt
  outlet { id name }
  items { id quantity priceAtOrder product { id name } }`;
export const ORDERS = gql`query Orders { orders { ${ORDER_FIELDS} } }`;
export const CREATE_ORDER = gql`
  mutation CreateOrder($outletId: ID!, $items: [OrderItemInput!]!) {
    createOrder(outletId: $outletId, items: $items) { ${ORDER_FIELDS} }
  }`;
