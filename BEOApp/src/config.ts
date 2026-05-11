// ── Central API config ────────────────────────────────────────────────────────
// In dev we derive the backend host from Expo's manifest (hostUri) so the app
// always points at whichever LAN IP the bundler is currently using. Production
// falls back to a placeholder that should be replaced before shipping a build.
import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

const DJANGO_PORT = 8000;
const PRODUCTION_FALLBACK = 'http://192.168.50.90:8000';

function tryExtractHost(s: string | null | undefined): string | null {
  if (!s) return null;
  // Matches "http://HOST:PORT/...", "exp://HOST:PORT/", or "HOST:PORT".
  const m = s.match(/(?:^|:\/\/)([a-zA-Z0-9.-]+)(?::\d+)?/);
  return m ? m[1] : null;
}

function resolveBaseUrl(): string {
  if (!__DEV__) return PRODUCTION_FALLBACK;

  // Each source format we look at, in order. The first to give a host wins.
  const candidates: { label: string; value: string | undefined | null }[] = [
    { label: 'expoConfig.hostUri',           value: Constants.expoConfig?.hostUri },
    { label: 'expoGoConfig.debuggerHost',    value: (Constants as any).expoGoConfig?.debuggerHost },
    { label: 'manifest2.extra.expoGo.debuggerHost', value: (Constants as any).manifest2?.extra?.expoGo?.debuggerHost },
    { label: 'NativeModules.SourceCode.scriptURL',  value: NativeModules.SourceCode?.scriptURL },
  ];

  for (const c of candidates) {
    const host = tryExtractHost(c.value);
    if (host) {
      const url = `http://${host}:${DJANGO_PORT}`;
      // eslint-disable-next-line no-console
      console.log(`[config] BASE_URL → ${url} (source: ${c.label}=${c.value})`);
      return url;
    }
  }

  // eslint-disable-next-line no-console
  console.warn(
    `[config] no host source resolved — using fallback ${PRODUCTION_FALLBACK}. ` +
    `Candidates were: ${JSON.stringify(candidates.map((c) => ({ [c.label]: c.value })))}`,
  );
  return PRODUCTION_FALLBACK;
}

export const BASE_URL = resolveBaseUrl();
