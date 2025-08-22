import { describe, it, expect } from "bun:test";
import { appRouter } from "../../routers/index";

describe("API Router", () => {
  it("should have appRouter defined", () => {
    expect(appRouter).toBeDefined();
  });

  it("should create caller without errors", () => {
    const caller = appRouter.createCaller({});
    expect(caller).toBeDefined();
  });
});