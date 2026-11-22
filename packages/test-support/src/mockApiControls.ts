const MOCK_API_CONTROLS_URL = "http://127.0.0.1:4010/__controls";

export class MockApiControls {
  private async post(path: string, body?: unknown): Promise<void> {
    const response = await fetch(`${MOCK_API_CONTROLS_URL}/${path}`, {
      method: "POST",
      ...(body === undefined ? {} : {
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
    if (!response.ok) {
      throw new Error(`Mock API control ${path} failed with HTTP ${response.status}`);
    }
  }

  /** Delay mock-api responses; `routes` limits the delay to those exact paths (all routes when omitted). */
  delay(ms: number, routes?: string[]): Promise<void> {
    return this.post("delay", { ms, ...(routes === undefined ? {} : { routes }) });
  }

  failNext(route: string, status?: number): Promise<void> {
    return this.post("fail-next", { route, ...(status === undefined ? {} : { status }) });
  }

  cleanupFail(enabled: boolean): Promise<void> {
    return this.post("cleanup-fail", { enabled });
  }

  reset(): Promise<void> {
    return this.post("reset");
  }
}
