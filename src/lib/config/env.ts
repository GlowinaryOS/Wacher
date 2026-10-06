import "server-only";

/**
 * Server-only configuration. Nothing in this module may be imported by a
 * client component — the `server-only` import makes that a build error.
 */

export type DataBackend = "local" | "supabase";
export type MarketDataProviderId = "mock" | "none";
export type AnalysisProviderId = "mock" | "none";
export type NewsProviderId = "none";
export type SentimentProviderId = "none";

const isProduction = process.env.NODE_ENV === "production";

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function oneOf<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const v = read(name);
  if (!v) return fallback;
  if ((allowed as readonly string[]).includes(v)) return v as T;
  throw new Error(`${name}="${v}" is not one of: ${allowed.join(", ")}`);
}

export const mockAllowed = !isProduction || read("WATCHER_ALLOW_MOCK_IN_PRODUCTION") === "true";

function guardMock<T extends string>(name: string, id: T): T {
  if (id === "mock" && !mockAllowed) {
    throw new Error(
      `${name}=mock is refused in a production build. Configure a real provider, ` +
        `use "none", or set WATCHER_ALLOW_MOCK_IN_PRODUCTION=true for a private demo.`,
    );
  }
  return id;
}

export function getConfig() {
  const defaultMock = isProduction ? "none" : "mock";
  return {
    dataBackend: oneOf<DataBackend>("WATCHER_DATA_BACKEND", ["local", "supabase"], "local"),
    localDataDir: read("WATCHER_LOCAL_DATA_DIR") ?? ".watcher-data",
    supabase: {
      url: read("NEXT_PUBLIC_SUPABASE_URL"),
      serviceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
      ownerUserId: read("WATCHER_OWNER_USER_ID"),
    },
    marketDataProvider: guardMock(
      "MARKET_DATA_PROVIDER",
      oneOf<MarketDataProviderId>("MARKET_DATA_PROVIDER", ["mock", "none"], defaultMock),
    ),
    analysisProvider: guardMock(
      "ANALYSIS_PROVIDER",
      oneOf<AnalysisProviderId>("ANALYSIS_PROVIDER", ["mock", "none"], defaultMock),
    ),
    newsProvider: oneOf<NewsProviderId>("NEWS_PROVIDER", ["none"], "none"),
    sentimentProvider: oneOf<SentimentProviderId>("SENTIMENT_PROVIDER", ["none"], "none"),
    anthropicConfigured: Boolean(read("ANTHROPIC_API_KEY")),
    basicAuthEnabled: Boolean(read("WATCHER_BASIC_AUTH_USER") && read("WATCHER_BASIC_AUTH_PASSWORD")),
  };
}

export type WatcherConfig = ReturnType<typeof getConfig>;
