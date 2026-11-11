// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BoardSourceSelector } from "@/components/game/BoardSourceSelector";

afterEach(() => {
  cleanup();
});

describe("BoardSourceSelector", () => {
  it("offers the three board sources and marks the unavailable ones as planned", () => {
    render(<BoardSourceSelector value="virtual" onChange={vi.fn()} />);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios.map((radio) => (radio as HTMLInputElement).value)).toEqual([
      "virtual",
      "camera",
      "smart",
    ]);

    // The available source is the selected one.
    expect((screen.getByRole("radio", { name: "Virtual Board" }) as HTMLInputElement).checked).toBe(
      true,
    );

    // The two planned sources say so, and say why.
    for (const name of ["Camera Board", "Smart Dart"]) {
      expect(screen.getByRole("radio", { name }).getAttribute("aria-disabled")).toBe("true");
    }
    expect(screen.getAllByText("PLANNED")).toHaveLength(2);
  });

  it("does not allow selecting an unavailable board source", () => {
    const onChange = vi.fn();
    const { unmount } = render(<BoardSourceSelector value="virtual" onChange={onChange} />);

    const camera = screen.getByRole("radio", { name: "Camera Board" });
    fireEvent.click(camera);
    expect(onChange).not.toHaveBeenCalled();
    expect((camera as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("radio", { name: "Virtual Board" }) as HTMLInputElement).checked).toBe(
      true,
    );

    const smart = screen.getByRole("radio", { name: "Smart Dart" });
    fireEvent.click(smart);
    expect(onChange).not.toHaveBeenCalled();
    expect((smart as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("radio", { name: "Virtual Board" }) as HTMLInputElement).checked).toBe(
      true,
    );

    // The available source is still selectable.
    unmount();
    render(<BoardSourceSelector value="camera" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Virtual Board" }));
    expect(onChange).toHaveBeenCalledWith("virtual");
  });

  it("keeps the explanation for an unavailable source visible to a keyboard user", () => {
    render(<BoardSourceSelector value="virtual" onChange={vi.fn()} />);

    const camera = screen.getByRole("radio", { name: "Camera Board" });

    // It stays in the tab order: focusable, never the disabled attribute.
    expect((camera as HTMLInputElement).disabled).toBe(false);
    camera.focus();
    expect(document.activeElement).toBe(camera);

    // The reason is visible text the radio points at, not a tooltip.
    const reasonId = camera.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    const reason = document.getElementById(reasonId!);
    expect(reason).not.toBeNull();
    expect(reason?.textContent).toContain("Planned");
    expect(reason?.getAttribute("aria-hidden")).toBeNull();
    expect(reason?.className).not.toContain("sr-only");
  });
});
