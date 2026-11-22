import { defaultDueDate, presetDue, validateDue } from "@/features/instructor/logic/assignment-schedule";

describe("assignment due rules", () => {
  const now = new Date(2026, 10, 22, 9, 0, 0);

  it("defaults to tomorrow 11:59 PM", () => {
    const d = defaultDueDate(now);
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([23, 23, 59]);
  });

  it("presets add whole days", () => {
    expect(presetDue(7, now).getDate()).toBe(29);
  });

  it("blocks a past due date on create but allows it on edit (to extend a deadline)", () => {
    const past = new Date(2026, 10, 1);
    expect(validateDue(past, "create", now.getTime())).not.toBeNull();
    expect(validateDue(past, "edit", now.getTime())).toBeNull();
  });

  it("rejects an invalid date", () => {
    expect(validateDue(new Date("x"), "edit")).not.toBeNull();
  });
});
