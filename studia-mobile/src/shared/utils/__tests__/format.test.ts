import { addDaysIso, dayChipLabel, dueLabel, isOverdue, toLocalIso } from "@/shared/utils/format";

describe("toLocalIso", () => {
  it("uses the local calendar day, not the UTC day", () => {
    // 6 AM local on the 16th is still the 15th in UTC for UTC+8; the local date must win.
    const d = new Date(2026, 10, 16, 6, 0, 0);
    expect(toLocalIso(d)).toBe("2026-11-16");
  });
});

describe("addDaysIso", () => {
  it("rolls over month ends", () => {
    expect(addDaysIso("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysIso("2026-12-01", -1)).toBe("2026-11-30");
  });
});

describe("dayChipLabel", () => {
  it("is short: weekday + day number", () => {
    expect(dayChipLabel("2026-11-15")).toMatch(/^\w{3} 15$/);
  });
});

describe("overdue / dueLabel", () => {
  const due = "2026-11-20T10:00:00.000Z";
  const before = Date.parse("2026-11-19T10:00:00.000Z");
  const after = Date.parse("2026-11-21T10:00:00.000Z");

  it("flags a past due date", () => {
    expect(isOverdue(due, before)).toBe(false);
    expect(isOverdue(due, after)).toBe(true);
    expect(isOverdue("not a date", after)).toBe(false);
  });

  it("prefixes overdue items and pins the time to Manila", () => {
    expect(dueLabel(due, before)).toMatch(/^Due Nov 20, 6:00 PM$/);
    expect(dueLabel(due, after)).toMatch(/^Overdue · was due Nov 20, 6:00 PM$/);
  });
});
