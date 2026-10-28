import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkerLoops } from "../../apps/worker/src/worker-loops";

describe("worker loop drain", () => {
  afterEach(() => vi.useRealTimers());
  it("avoids overlapping scheduler runs and drains both started cycles", async () => {
    vi.useFakeTimers();
    let finishJobs!: () => void;
    let finishSchedule!: () => void;
    const jobs = vi.fn(() => new Promise<void>((resolve) => { finishJobs = resolve; }));
    const schedule = vi.fn(() => new Promise<void>((resolve) => { finishSchedule = resolve; }));
    const loops = createWorkerLoops({ pollMs: 10, schedulerMs: 10, processJobs: jobs, schedule, onError: vi.fn() });
    loops.start();
    await vi.advanceTimersByTimeAsync(50);
    expect(jobs).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledTimes(1);
    let drained = false;
    const stopped = loops.stop().then(() => { drained = true; });
    await vi.advanceTimersByTimeAsync(50);
    expect(drained).toBe(false);
    expect(jobs).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledTimes(1);
    finishJobs();
    await Promise.resolve();
    expect(drained).toBe(false);
    finishSchedule();
    await stopped;
    expect(drained).toBe(true);
  });
  it("surfaces failure and prevents future starts after shutdown", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const schedule = vi.fn(async () => { throw new Error("synthetic"); });
    const loops = createWorkerLoops({ pollMs: 10, schedulerMs: 10, processJobs: vi.fn(), schedule, onError });
    loops.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledOnce();
    await loops.stop();
    loops.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(schedule).toHaveBeenCalledTimes(1);
  });
});
