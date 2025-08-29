import { describe, it, expect } from "vitest";
import { appRouter } from "../../routers/index";
import { createCallerFactory } from "../../lib/trpc";

describe("API Router", () => {
  it("should have appRouter defined", () => {
    expect(appRouter).toBeDefined();
  });

  it("should create caller without errors", () => {
    const createCaller = createCallerFactory(appRouter);
    const caller = createCaller({ session: null });
    expect(caller).toBeDefined();
  });
});