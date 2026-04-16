const refreshEventTarget = new EventTarget();
const refreshEventName = 'brhp:sidebar-refresh';

export function emitSidebarRefresh(): void {
  refreshEventTarget.dispatchEvent(new Event(refreshEventName));
}

export function subscribeToSidebarRefresh(callback: () => void): () => void {
  const listener = () => callback();
  refreshEventTarget.addEventListener(refreshEventName, listener);

  return () => {
    refreshEventTarget.removeEventListener(refreshEventName, listener);
  };
}
