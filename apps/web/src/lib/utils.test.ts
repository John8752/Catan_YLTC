import { describe, expect, it } from "vitest";
import { cn } from "./utils.js";

describe("semantic typography classes", () => {
  it("preserves text size when a component supplies a color", () => {
    expect(cn("text-ui font-medium", "text-[#123456]")).toBe("text-ui font-medium text-[#123456]");
    expect(cn("text-body", "text-muted-foreground")).toBe("text-body text-muted-foreground");
    expect(cn("text-caption", "text-red-500")).toBe("text-caption text-red-500");
  });

  it("lets a local size override the semantic default without dropping its color", () => {
    expect(cn("text-ui text-white", "text-base")).toBe("text-white text-base");
    expect(cn("text-sm", "text-caption")).toBe("text-caption");
    expect(cn("font-sans font-medium", "font-display font-semibold")).toBe("font-display font-semibold");
  });
});
