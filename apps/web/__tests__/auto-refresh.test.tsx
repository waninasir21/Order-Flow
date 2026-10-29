import { act, render } from "@testing-library/react";
import { AutoRefresh } from "@/components/auto-refresh";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
}

beforeEach(() => {
  jest.useFakeTimers();
  refresh.mockClear();
  setVisibility("visible");
});
afterEach(() => jest.useRealTimers());

describe("AutoRefresh", () => {
  it("re-renders the server components every interval while the tab is visible", () => {
    render(<AutoRefresh intervalMs={10_000} />);
    expect(refresh).not.toHaveBeenCalled();
    act(() => void jest.advanceTimersByTime(10_000));
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => void jest.advanceTimersByTime(20_000));
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("does nothing while the tab is hidden, and refreshes as soon as it is visible again", () => {
    render(<AutoRefresh intervalMs={10_000} />);
    setVisibility("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      jest.advanceTimersByTime(60_000);
    });
    expect(refresh).not.toHaveBeenCalled();

    setVisibility("visible");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("stops polling when it unmounts", () => {
    const { unmount } = render(<AutoRefresh intervalMs={10_000} />);
    unmount();
    act(() => void jest.advanceTimersByTime(60_000));
    expect(refresh).not.toHaveBeenCalled();
  });
});
