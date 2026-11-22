import { useState } from "react";
import { Button, Card, CardContent, CardHeader, Checkbox } from "@poc/design-system";
import { MockApiControls } from "@poc/test-support";

type Props = {
  forceCleanupFail: boolean;
  onForceCleanupFailChange: (enabled: boolean) => void;
  onEvent: (type: string, detail?: unknown) => void;
};

const controls = new MockApiControls();

export function ScenarioControls({ forceCleanupFail, onForceCleanupFailChange, onEvent }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(`${label}: ok`);
      onEvent("scenario.ok", { label });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setMessage(`${label}: ${text}`);
      onEvent("scenario.error", { label, error: text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card aria-label="Scenario controls" role="region" data-testid="scenario-controls">
      <CardHeader>
        <h2 className="m-0 text-base font-semibold">Scenario controls (fictional mock-api)</h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            data-testid="delay-orders"
            disabled={busy}
            onClick={() => run("delay orders 2500ms", () => controls.delay(2500))}
          >
            Delay REST orders 2.5s
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-testid="delay-graphql"
            disabled={busy}
            onClick={() => run("delay graphql 2500ms", () => controls.delay(2500))}
          >
            Delay GraphQL 2.5s
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-testid="fail-next-orders"
            disabled={busy}
            onClick={() => run("fail next orders", () => controls.failNext("/api/orders", 500))}
          >
            Fail next /api/orders
          </Button>
          <Button
            variant="secondary"
            size="sm"
            data-testid="reset-controls"
            disabled={busy}
            onClick={() => run("reset controls", () => controls.reset())}
          >
            Reset mock controls
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            data-testid="force-cleanup-fail"
            checked={forceCleanupFail}
            onChange={(event) => {
              onForceCleanupFailChange(event.target.checked);
              onEvent("scenario.force_cleanup_fail", { enabled: event.target.checked });
            }}
          />
          Force remote cleanup failure on next remount
        </label>
        {message ? (
          <p data-testid="scenario-message" className="m-0 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
