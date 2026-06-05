import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloneReel } from "./use-clone-reel";
import type { ReelTemplate } from "@/types/reel";
import type { Video } from "@/types/video";

// A Supabase query builder is a thenable (.then) but has NO .catch method.
// Reproduce that faithfully so the test catches the regression where the
// rollback called .catch() directly and threw, stranding the UI on "building".
function thenableWithoutCatch<T>(value: T) {
  return { then: (onFulfilled: (v: T) => unknown) => Promise.resolve(value).then(onFulfilled) };
}

vi.mock("@/lib/storage", () => ({ uploadToR2: vi.fn() }));

vi.mock("@/lib/supabase", () => {
  const reelsTable = {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({ data: { id: "11111111-1111-4111-8111-111111111111" }, error: null })
        ),
      })),
    })),
    // Rollback path: delete(...).eq(...) returns a thenable WITHOUT .catch.
    delete: vi.fn(() => ({ eq: vi.fn(() => thenableWithoutCatch({ error: null })) })),
  };
  return {
    getCurrentUserId: vi.fn(() => Promise.resolve("user-1")),
    supabase: {
      from: vi.fn(() => reelsTable),
      functions: {
        // Force buildReel into its catch block: clone returns zero segments.
        invoke: vi.fn(() => Promise.resolve({ data: { segments: [] }, error: null })),
      },
    },
  };
});

describe("useCloneReel.buildReel failure handling", () => {
  it("lands on 'error' (not stuck on 'building') when the clone fails", async () => {
    const { result } = renderHook(() => useCloneReel());

    act(() => {
      result.current.useFromTemplate({ totalDurationSeconds: 30 } as ReelTemplate);
    });

    await act(async () => {
      await expect(
        result.current.buildReel("Test", [{ id: "vid-1", analysis: { mood: "chill" } } as unknown as Video])
      ).rejects.toBeTruthy();
    });

    // The rollback must complete and set the error state — never strand "building".
    expect(result.current.step).toBe("error");
  });
});
