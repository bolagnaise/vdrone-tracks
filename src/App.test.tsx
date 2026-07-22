import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const response = {
  tracks: [{ source: "official", id: 2131, name: "QTFPV Memorial Race", sceneId: 33, sceneName: "DynamicWeather", version: 1, publishedAt: "2026-07-08 02:56:48", type: 2, rating: 4.7778, ratingCount: 18, downloadAvailable: true }],
  facets: { sceneries: [{ name: "DynamicWeather", count: 1 }], types: [{ type: 2, count: 1 }] },
  page: 1, limit: 50, total: 1, pages: 1, lastSyncAt: "2026-07-10T00:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("track board", () => {
  it("uses the downloader name", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 })));
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "VDRONE Track Downloader" })).toBeInTheDocument();
  });

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

  it("switches to community search and shows creator metadata", async () => {
    const community = {
      ...response,
      tracks: [{ source: "community", id: 37452, name: "Backyard Rush", creator: "Rotor Pilot", sceneId: 33, sceneName: "DynamicWeather", publishedAt: "2026-07-21 00:00:00", type: 2, typeLabel: "Intermediate", rating: 4.5, ratingCount: 4, downloadAvailable: true }],
      facets: { sceneries: [{ id: 33, name: "DynamicWeather", count: 1 }], types: [{ type: 2, count: 1 }] },
      resultLimitReached: false,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(community), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByText("QTFPV Memorial Race");
    fireEvent.click(screen.getByRole("button", { name: "Community" }));
    expect(await screen.findByText("Backyard Rush")).toBeInTheDocument();
    expect(screen.getByText("Rotor Pilot")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toMatch(/^\/api\/community-tracks\?/);
    fireEvent.click(screen.getByText("Backyard Rush"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Intermediate");
    expect(screen.getByRole("dialog")).toHaveTextContent("Rotor Pilot");
  });
});
