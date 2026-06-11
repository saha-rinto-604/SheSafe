type Listener = (incidentId?: string) => void;

const listeners = new Set<Listener>();

export const liveVideoNavigation = {
  emit(incidentId?: string | null) {
    listeners.forEach(listener => listener(incidentId ? String(incidentId) : undefined));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
