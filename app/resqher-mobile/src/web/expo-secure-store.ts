const isBrowser = typeof window !== 'undefined';

async function getItemAsync(key: string): Promise<string | null> {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setItemAsync(key: string, value: string): Promise<void> {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

async function deleteItemAsync(key: string): Promise<void> {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    return;
  }
}

export { getItemAsync, setItemAsync, deleteItemAsync };
