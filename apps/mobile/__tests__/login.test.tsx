import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { GraphQLError } from "graphql";
import LoginScreen from "../app/login";
import { LOGIN } from "@/graphql/operations";
import { useAuthStore } from "@/stores/auth";

jest.mock("expo-router", () => ({ Redirect: () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});

const EMPLOYEE = { id: "e1", name: "Asha", role: "REP" as const };

function success(phone: string, password: string): MockedResponse {
  return {
    request: { query: LOGIN, variables: { phone, password } },
    result: {
      data: {
        login: {
          __typename: "AuthPayload",
          accessToken: "access-1",
          refreshToken: "refresh-1",
          employee: { __typename: "Employee", ...EMPLOYEE },
        },
      },
    },
  };
}

async function renderLogin(mocks: MockedResponse[] = []) {
  await render(
    <MockedProvider mocks={mocks}>
      <LoginScreen />
    </MockedProvider>
  );
  return userEvent.setup();
}

const signIn = () => screen.getByRole("button", { name: "Sign in" });
const isDisabled = () => signIn().props.accessibilityState?.disabled === true;

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, refreshToken: null, employee: null, hydrated: true });
});

describe("login form validation", () => {
  it("starts with Sign in disabled", async () => {
    await renderLogin();
    expect(isDisabled()).toBe(true);
  });

  it("stays disabled until both phone and password are filled", async () => {
    const user = await renderLogin();
    await user.type(screen.getByLabelText("Phone number"), "+919900000001");
    expect(isDisabled()).toBe(true);
    await user.type(screen.getByLabelText("Password"), "secret");
    expect(isDisabled()).toBe(false);
  });

  it("treats a whitespace-only phone as empty", async () => {
    const user = await renderLogin();
    await user.type(screen.getByLabelText("Phone number"), "   ");
    await user.type(screen.getByLabelText("Password"), "secret");
    expect(isDisabled()).toBe(true);
  });

  it("does not submit when pressed while disabled", async () => {
    const user = await renderLogin(); // no mocks: any request would error out
    await user.press(signIn());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(useAuthStore.getState().employee).toBeNull();
  });
});

describe("login submit", () => {
  it("sends the trimmed phone and stores the session on success", async () => {
    const user = await renderLogin([success("+919900000001", "secret")]);
    await user.type(screen.getByLabelText("Phone number"), "  +919900000001 ");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.press(signIn());

    await waitFor(() => expect(useAuthStore.getState().employee).toMatchObject(EMPLOYEE));
    expect(useAuthStore.getState()).toMatchObject({ accessToken: "access-1", refreshToken: "refresh-1" });
  });

  it("shows the server's message for wrong credentials and stores nothing", async () => {
    const user = await renderLogin([
      {
        request: { query: LOGIN, variables: { phone: "+919900000001", password: "wrong" } },
        result: { errors: [new GraphQLError("Invalid phone or password", { extensions: { code: "UNAUTHENTICATED" } })] },
      },
    ]);
    await user.type(screen.getByLabelText("Phone number"), "+919900000001");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.press(signIn());

    expect((await screen.findByRole("alert")).props.children).toBe("Invalid phone or password");
    expect(useAuthStore.getState().employee).toBeNull();
  });

  it("explains an unreachable server in plain words", async () => {
    const user = await renderLogin([
      {
        request: { query: LOGIN, variables: { phone: "+919900000001", password: "pw" } },
        error: new Error("Network request failed"),
      },
    ]);
    await user.type(screen.getByLabelText("Phone number"), "+919900000001");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.press(signIn());

    expect(String((await screen.findByRole("alert")).props.children)).toMatch(/Can't reach the server/);
  });
});

