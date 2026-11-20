import { describe, expect, it } from "vitest";
import { navFromRemotes, routesFromRemotes } from "./remotes";

describe("routesFromRemotes", () => {
  it("maps each remote route prefix to its id", () => {
    expect(
      routesFromRemotes([
        { id: "react", route: "/orders" },
        { id: "vue", route: "/summary" },
      ]),
    ).toEqual({ "/orders": "react", "/summary": "vue" });
  });
});

describe("navFromRemotes", () => {
  it("builds chrome nav from remotes that declare nav", () => {
    expect(
      navFromRemotes([
        { id: "react", route: "/orders", nav: { id: "orders", label: "Orders" } },
        { id: "vue", route: "/summary", nav: { id: "summary", label: "Summary" } },
        { id: "hidden", route: "/hidden" },
      ]),
    ).toEqual([
      { id: "orders", label: "Orders", path: "/orders", remoteId: "react" },
      { id: "summary", label: "Summary", path: "/summary", remoteId: "vue" },
    ]);
  });

  it("omits remotes without nav", () => {
    expect(navFromRemotes([{ id: "events", route: "/events" }])).toEqual([]);
  });
});
