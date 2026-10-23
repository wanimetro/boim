/** Seoul local deadline to epoch milliseconds. Shared by business rules and UI formatting. */
export function deadlineMs(due: string, dueTime = "23:59"): number {
  return Date.parse(`${due}T${dueTime.slice(0, 5)}:00+09:00`);
}
