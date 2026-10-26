// Every GraphQL document the dashboard sends. Kept as plain strings (no client library): the
// server components call the backend directly. Types are hand-written until codegen goes into
// packages/shared-types (see DECISIONS.md).

export type Role = "REP" | "ADMIN";
export type OrderStatus = "PLACED" | "APPROVED" | "REJECTED" | "FULFILLED";

export const LOGIN = /* GraphQL */ `
  mutation Login($phone: String!, $password: String!) {
    login(phone: $phone, password: $password) {
      accessToken
      refreshToken
      employee { id name role }
    }
  }
`;

export const REFRESH_TOKENS = /* GraphQL */ `
  mutation RefreshTokens($refreshToken: String!) {
    refreshTokens(refreshToken: $refreshToken) {
      accessToken
      refreshToken
    }
  }
`;

export const LOGOUT = /* GraphQL */ `
  mutation Logout($refreshToken: String!) {
    logout(refreshToken: $refreshToken)
  }
`;

export const ME = /* GraphQL */ `
  query Me {
    me { id name phone role }
  }
`;

// The list only needs the unit count, so it asks for `items { quantity }`, not full line items.
export const ORDERS = /* GraphQL */ `
  query Orders {
    orders {
      id
      status
      total
      createdAt
      outlet { id name }
      employee { id name }
      items { quantity }
    }
  }
`;

export const ORDER = /* GraphQL */ `
  query Order($id: ID!) {
    order(id: $id) {
      id
      status
      total
      clientId
      createdAt
      updatedAt
      outlet { id name address ownerName phone }
      employee { id name phone role }
      items {
        id
        quantity
        priceAtOrder
        product { id name sku }
      }
    }
  }
`;

export const PRODUCTS = /* GraphQL */ `
  query Products {
    products { id name sku price stockQuantity }
  }
`;

export const UPDATE_ORDER_STATUS = /* GraphQL */ `
  mutation UpdateOrderStatus($orderId: ID!, $status: OrderStatus!) {
    updateOrderStatus(orderId: $orderId, status: $status) {
      id
      status
    }
  }
`;

export const UPDATE_PRODUCT_STOCK = /* GraphQL */ `
  mutation UpdateProductStock($productId: ID!, $stockQuantity: Int!) {
    updateProductStock(productId: $productId, stockQuantity: $stockQuantity) {
      id
      stockQuantity
    }
  }
`;

export interface Me { id: string; name: string; phone: string; role: Role }

export interface LoginData {
  login: { accessToken: string; refreshToken: string; employee: { id: string; name: string; role: Role } };
}

export interface RefreshData {
  refreshTokens: { accessToken: string; refreshToken: string };
}

export interface OrdersData {
  orders: {
    id: string;
    status: OrderStatus;
    total: number;
    createdAt: string;
    outlet: { id: string; name: string };
    employee: { id: string; name: string };
    items: { quantity: number }[];
  }[];
}

export interface OrderData {
  order: {
    id: string;
    status: OrderStatus;
    total: number;
    clientId: string | null;
    createdAt: string;
    updatedAt: string;
    outlet: { id: string; name: string; address: string; ownerName: string; phone: string };
    employee: { id: string; name: string; phone: string; role: Role };
    items: {
      id: string;
      quantity: number;
      priceAtOrder: number;
      product: { id: string; name: string; sku: string };
    }[];
  };
}

export interface ProductsData {
  products: { id: string; name: string; sku: string; price: number; stockQuantity: number }[];
}
