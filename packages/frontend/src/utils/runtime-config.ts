function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_URL ||
    `${window.location.protocol}//${window.location.hostname}:3001`,
);

export const WS_URL = trimTrailingSlash(
  import.meta.env.VITE_WS_URL ||
    `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:3001`,
);
