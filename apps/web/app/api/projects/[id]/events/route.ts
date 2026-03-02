import { runtimeListProjectEvents } from "@/lib/runtime";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function sseLine(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const startCursor = Number(req.nextUrl.searchParams.get("cursor") ?? "0");

  let cursor = Number.isFinite(startCursor) && startCursor >= 0 ? startCursor : 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      const pushDiff = async () => {
        const events = await runtimeListProjectEvents(id);
        if (events.length > cursor) {
          const next = events.slice(cursor);
          cursor = events.length;
          controller.enqueue(encoder.encode(sseLine("events", { cursor, events: next })));
        }
      };

      controller.enqueue(encoder.encode(sseLine("ready", { projectId: id, cursor })));
      void pushDiff();

      const interval = setInterval(() => {
        void pushDiff();
      }, 1000);

      const timeout = setTimeout(() => {
        controller.enqueue(encoder.encode(sseLine("complete", { cursor })));
        clearInterval(interval);
        controller.close();
      }, 45_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearTimeout(timeout);
        try {
          controller.close();
        } catch {
          // stream closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
    },
  });
}
