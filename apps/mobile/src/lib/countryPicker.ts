/** Whether the Country picker is on screen. Kept outside React so the drawer, which closes as it opens it, can ask for it. */
let open = false;
const listeners = new Set<() => void>();

function set(next: boolean): void {
  if (next === open) return;
  open = next;
  listeners.forEach((l) => l());
}

export const openCountryPicker = (): void => set(true);
export const closeCountryPicker = (): void => set(false);
export const isCountryPickerOpen = (): boolean => open;

export function subscribeCountryPicker(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
