import { Button, Card, CardContent, CardHeader } from "@poc/design-system";
import type { ShellEvent } from "./types";

const MAX_EVENTS = 40;

type Props = {
  events: ShellEvent[];
  onClear: () => void;
};

export function EventLog({ events, onClear }: Props) {
  return (
    <Card aria-label="Event log" role="region" data-testid="event-log-panel">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <h2 className="m-0 text-base font-semibold">Event / debug log (bounded)</h2>
        <Button variant="outline" size="sm" data-testid="clear-events" onClick={onClear}>
          Clear
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <ol
          data-testid="event-log"
          tabIndex={0}
          aria-label="Events"
          className="m-0 max-h-56 list-none overflow-auto rounded-md border border-solid border-border bg-muted p-2 font-mono text-xs text-foreground"
        >
          {events.length === 0 ? <li className="text-muted-foreground">No events yet.</li> : null}
          {events.map((event) => (
            <li key={event.id} className="py-0.5 break-words">
              <code className="text-muted-foreground">{event.at}</code> · <strong>{event.type}</strong>
              {event.detail !== undefined ? <> — {safeDetail(event.detail)}</> : null}
            </li>
          ))}
        </ol>
        <p className="m-0 text-xs text-muted-foreground">
          Keeps the newest {MAX_EVENTS} entries. Never logs credentials.
        </p>
      </CardContent>
    </Card>
  );
}

export function appendEvent(events: ShellEvent[], type: string, detail?: unknown): ShellEvent[] {
  const next: ShellEvent = {
    id: (events.at(-1)?.id ?? 0) + 1,
    at: new Date().toISOString(),
    type,
    detail,
  };
  return [...events, next].slice(-MAX_EVENTS);
}

function safeDetail(detail: unknown): string {
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}
