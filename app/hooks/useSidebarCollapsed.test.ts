import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarCollapsed } from "./useSidebarCollapsed";

describe("useSidebarCollapsed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("默认展开（collapsed = false）", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(false);
  });

  it("toggle 切换 collapsed 状态", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
  });

  it("toggle 后状态持久化到 localStorage", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current.toggle());
    expect(localStorage.getItem("sidebarCollapsed")).toBe("true");
    act(() => result.current.toggle());
    expect(localStorage.getItem("sidebarCollapsed")).toBe("false");
  });

  it("从 localStorage 读取已保存的收起状态", () => {
    localStorage.setItem("sidebarCollapsed", "true");
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(true);
  });
});
