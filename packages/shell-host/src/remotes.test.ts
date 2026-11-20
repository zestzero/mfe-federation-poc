import { describe, expect, it } from "vitest";
import {
  EVENTS_REMOTE,
  EVENTS_SHELL_REMOTES,
  REACT_REMOTE,
  STANDARD_SHELL_REMOTES,
  VUE_REMOTE,
  bindMount,
} from "./remotes";

describe("remote catalog", () => {
  it("keeps ids, mfNames, and routes unique", () => {
    const remotes = EVENTS_SHELL_REMOTES;
    expect(new Set(remotes.map((r) => r.id)).size).toBe(remotes.length);
    expect(new Set(remotes.map((r) => r.mfName)).size).toBe(remotes.length);
    expect(new Set(remotes.map((r) => r.route)).size).toBe(remotes.length);
  });

  it("describes the react and vue remotes used by every shell", () => {
    expect(REACT_REMOTE).toMatchObject({
      id: "react",
      mfName: "reactRemote",
      manifestUrl: "http://localhost:5001/mf-manifest.json",
      title: "React + TanStack Query (fictional orders)",
      route: "/orders",
      nav: { id: "orders", label: "Orders" },
    });
    expect(VUE_REMOTE).toMatchObject({
      id: "vue",
      mfName: "vueRemote",
      manifestUrl: "http://localhost:5002/mf-manifest.json",
      title: "Vue + Apollo (fictional summary)",
      route: "/summary",
      nav: { id: "summary", label: "Summary" },
    });
    expect(STANDARD_SHELL_REMOTES).toEqual([REACT_REMOTE, VUE_REMOTE]);
  });

  it("describes the events remote for shells that opt in", () => {
    expect(EVENTS_REMOTE).toMatchObject({
      id: "events",
      mfName: "eventsRemote",
      manifestUrl: "http://localhost:5003/mf-manifest.json",
      title: "Signals remote (events)",
      route: "/events",
      nav: { id: "events", label: "Events" },
    });
    expect(EVENTS_SHELL_REMOTES).toEqual([REACT_REMOTE, VUE_REMOTE, EVENTS_REMOTE]);
  });

  it("bindMount attaches a loader without changing the spec", () => {
    const load = async () => ({});
    const bound = bindMount(REACT_REMOTE, load);
    expect(bound.load).toBe(load);
    expect(bound.id).toBe("react");
    expect(bound.mfName).toBe("reactRemote");
  });
});
