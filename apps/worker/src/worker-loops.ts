type Options = {
  pollMs: number;
  schedulerMs: number;
  processJobs: () => Promise<void>;
  schedule: () => Promise<void>;
  onError: (scope: string, error: unknown) => void;
};

// A local drain prevents new work after SIGTERM and waits for started batches.
// It does not provide cross-instance exclusivity or exactly-once side effects.
export function createWorkerLoops(options: Options) {
  let stopping = false;
  let started = false;
  let processing: Promise<void> | undefined;
  let scheduling: Promise<void> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let schedulerTimer: ReturnType<typeof setInterval> | undefined;

  const run = (kind: "processing" | "scheduling") => {
    if (stopping || (kind === "processing" ? processing : scheduling)) return;
    const promise = Promise.resolve().then(kind === "processing" ? options.processJobs : options.schedule)
      .catch((error) => options.onError(kind === "processing" ? "process-jobs" : "scheduler", error))
      .finally(() => {
        if (kind === "processing") processing = undefined;
        else scheduling = undefined;
      });
    if (kind === "processing") processing = promise;
    else scheduling = promise;
  };

  return {
    start() {
      if (started || stopping) return;
      started = true;
      pollTimer = setInterval(() => run("processing"), options.pollMs);
      run("scheduling");
      schedulerTimer = setInterval(() => run("scheduling"), options.schedulerMs);
    },
    async stop() {
      stopping = true;
      clearInterval(pollTimer);
      clearInterval(schedulerTimer);
      await Promise.all([processing, scheduling]);
    },
  };
}
