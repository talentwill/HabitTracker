import { describe, it, expect } from "vitest";
import { getFirstTextChar } from "./utils";

describe("getFirstTextChar", () => {
  it("returns empty string for empty input", () => {
    expect(getFirstTextChar("")).toBe("");
  });

  it("returns first alphanumeric character", () => {
    expect(getFirstTextChar("hello")).toBe("h");
  });

  it("returns first Chinese character", () => {
    expect(getFirstTextChar("你好世界")).toBe("你");
  });

  it("skips leading emoji and returns first text char", () => {
    expect(getFirstTextChar("🏃 running")).toBe("r");
  });

  it("returns first char if no alphanumeric found", () => {
    expect(getFirstTextChar("!@#")).toBe("!");
  });
});
