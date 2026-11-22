// screen-id.ts — `getId` for Stack.Screen. React Navigation treats two pushes with the same id as
// the same screen and goes back to the existing one instead of stacking a copy, so a rapid
// double/triple tap on a card opens ONE sub page (and one Back returns), not three.
// The id is the route params, so opening a *different* item (other classId / id) still stacks.
export function screenId({ params }: { params?: Record<string, unknown> }): string {
  if (!params) return "singleton";
  const keys = Object.keys(params).sort();
  return keys.length === 0 ? "singleton" : keys.map((k) => `${k}=${String(params[k])}`).join("&");
}
