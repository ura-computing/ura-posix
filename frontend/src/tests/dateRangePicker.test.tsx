import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DateRangePicker } from "@/components/ui/dateRangePicker";

const renderPicker = (overrides: Partial<React.ComponentProps<typeof DateRangePicker>> = {}) => {
  const onFromChange = vi.fn();
  const onToChange = vi.fn();
  const utils = render(
    <DateRangePicker
      from=""
      to=""
      onFromChange={onFromChange}
      onToChange={onToChange}
      {...overrides}
    />,
  );
  return { onFromChange, onToChange, ...utils };
};

const segs = (label: string) => ({
  d: screen.getByLabelText(`${label} jour`) as HTMLInputElement,
  m: screen.getByLabelText(`${label} mois`) as HTMLInputElement,
  y: screen.getByLabelText(`${label} année`) as HTMLInputElement,
});

const type = (input: HTMLInputElement, value: string) => {
  fireEvent.change(input, { target: { value } });
};

describe("DateRangePicker — segmented input", () => {
  it("typing day=2, month=6, year=2026 commits the ISO date", () => {
    const { onFromChange } = renderPicker();
    const du = segs("Du");
    type(du.d, "02");
    type(du.m, "06");
    type(du.y, "2026");
    expect(onFromChange).toHaveBeenCalledWith("2026-06-02");
  });

  it("auto-advances from day to month when single digit is 4-9", () => {
    renderPicker();
    const du = segs("Du");
    du.d.focus();
    type(du.d, "5");
    expect(document.activeElement).toBe(du.m);
    expect(du.d.value).toBe("05");
  });

  it("auto-advances from month to year when single digit is 2-9", () => {
    renderPicker();
    const du = segs("Du");
    du.m.focus();
    type(du.m, "3");
    expect(document.activeElement).toBe(du.y);
    expect(du.m.value).toBe("03");
  });

  it("does not commit invalid date (31/02/2026) and marks aria-invalid", () => {
    const { onFromChange } = renderPicker();
    const du = segs("Du");
    type(du.d, "31");
    type(du.m, "02");
    type(du.y, "2026");
    expect(onFromChange).not.toHaveBeenCalled();
    expect(du.d.closest("[aria-invalid]")).toHaveAttribute("aria-invalid", "true");
  });

  it("backspace on empty month moves focus to day", () => {
    renderPicker();
    const du = segs("Du");
    du.m.focus();
    fireEvent.keyDown(du.m, { key: "Backspace" });
    expect(document.activeElement).toBe(du.d);
  });

  it("escape reverts to props", () => {
    const { rerender, onFromChange } = renderPicker({ from: "2025-05-10" });
    const du = segs("Du");
    expect(du.d.value).toBe("10");
    expect(du.m.value).toBe("05");
    expect(du.y.value).toBe("2025");
    type(du.d, "99");
    fireEvent.keyDown(du.d, { key: "Escape" });
    expect(du.d.value).toBe("10");
    rerender(
      <DateRangePicker
        from="2025-05-10"
        to=""
        onFromChange={onFromChange}
        onToChange={vi.fn()}
      />,
    );
    expect(du.d.value).toBe("10");
  });

  it("syncs segments when props change externally (preset)", () => {
    const { rerender } = renderPicker();
    rerender(
      <DateRangePicker
        from="2026-01-01"
        to="2026-01-31"
        onFromChange={vi.fn()}
        onToChange={vi.fn()}
      />,
    );
    expect(segs("Du").d.value).toBe("01");
    expect(segs("Du").y.value).toBe("2026");
    expect(segs("Au").d.value).toBe("31");
  });

  it("ArrowUp increments the day", () => {
    const { onFromChange } = renderPicker({ from: "2026-06-15", to: "2026-06-20" });
    const du = segs("Du");
    du.d.focus();
    fireEvent.keyDown(du.d, { key: "ArrowUp" });
    expect(onFromChange).toHaveBeenLastCalledWith("2026-06-16");
  });

  it("clears commit when all segments are emptied", () => {
    const { onFromChange } = renderPicker({ from: "2026-06-15" });
    const du = segs("Du");
    type(du.d, "");
    type(du.m, "");
    type(du.y, "");
    expect(onFromChange).toHaveBeenLastCalledWith("");
  });

  it("typing in Au commits to onToChange", () => {
    const { onToChange } = renderPicker({ from: "2026-06-01" });
    const au = segs("Au");
    type(au.d, "30");
    type(au.m, "06");
    type(au.y, "2026");
    expect(onToChange).toHaveBeenCalledWith("2026-06-30");
  });

  it("typing single 0 in day does not auto-advance (could be 0X)", () => {
    renderPicker();
    const du = segs("Du");
    du.d.focus();
    type(du.d, "0");
    expect(document.activeElement).toBe(du.d);
    expect(du.d.value).toBe("0");
  });
});

describe("DateRangePicker — popover presets", () => {
  it("clicking a preset fires both callbacks and closes the popover", async () => {
    const { onFromChange, onToChange } = renderPicker();
    const trigger = screen.getByLabelText("Ouvrir le calendrier");
    await act(async () => {
      fireEvent.click(trigger);
    });
    const preset = screen.getByText("Mois actuel");
    await act(async () => {
      fireEvent.click(preset);
    });
    expect(onFromChange).toHaveBeenCalledTimes(1);
    expect(onToChange).toHaveBeenCalledTimes(1);
    const fromArg = onFromChange.mock.calls[0]![0];
    const toArg = onToChange.mock.calls[0]![0];
    expect(fromArg).toMatch(/^\d{4}-\d{2}-01$/);
    expect(toArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
