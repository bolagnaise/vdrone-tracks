import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const response = {
  tracks: [{ id: 2131, name: "QTFPV Memorial Race", sceneId: 33, sceneName: "DynamicWeather", version: 1, publishedAt: "2026-07-08 02:56:48", type: 2, rating: 4.7778, ratingCount: 18, downloadAvailable: true }],
  facets: { sceneries: [{ name: "DynamicWeather", count: 1 }], types: [{ type: 2, count: 1 }] },
  page: 1, limit: 50, total: 1, pages: 1, lastSyncAt: "2026-07-10T00:00:00Z",
};

afterEach(() => vi.restoreAllMocks());

describe("track board", () => {
  it("renders results and opens accessible details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 })));
    render(<App />);
    expect(await screen.findByText("QTFPV Memorial Race")).toBeInTheDocument();
    fireEvent.click(screen.getByText("QTFPV Memorial Race"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download .trk/i })).toBeEnabled();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows a directed empty state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...response, tracks: [], total: 0 }), { status: 200 })));
    render(<App />);
    expect(await screen.findByText("No tracks on this line")).toBeInTheDocument();
  });
});
