import { supabase } from "@/integrations/supabase/client";

type MutationOperation = "insert" | "update" | "delete";

type RootCause =
  | "missing_or_expired_session"
  | "invalid_backend_config"
  | "possible_cors_or_preview_network"
  | "possible_auth_header_issue"
  | "unknown";

interface MutationDebugContext {
  table: string;
  operation: MutationOperation;
  payload?: unknown;
  userId?: string;
  companyId?: string;
  maxRetries?: number;
}

interface MutationSessionInfo {
  hasSession: boolean;
  hasAccessToken: boolean;
  expiresAt?: number;
  refreshError?: string;
}

interface MutationResult<T> {
  data: T;
  error: unknown;
  status?: number;
  statusText?: string;
}

const NETWORK_ERROR_MESSAGE = "Network error – please check connection or refresh session";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorText = (err: unknown) => {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === "object") {
    const obj = err as Record<string, unknown>;
    return [obj.message, obj.details, obj.hint, obj.error_description, obj.name]
      .filter((value): value is string => typeof value === "string")
      .join(" | ");
  }
  return String(err);
};

export const isNetworkMutationError = (err: unknown) => {
  if (err instanceof TypeError) return true;
  if (err && typeof err === "object") {
    const maybeErr = err as { status?: number; code?: string };
    if (maybeErr.status === 0) return true;
    if (maybeErr.code === "NETWORK_ERROR") return true;
  }

  const text = getErrorText(err).toLowerCase();
  return (
    text.includes("failed to fetch") ||
    text.includes("networkerror") ||
    text.includes("fetch failed") ||
    text.includes("load failed")
  );
};

const detectRootCause = ({
  err,
  session,
  hasConfig,
}: {
  err: unknown;
  session: MutationSessionInfo;
  hasConfig: boolean;
}): RootCause => {
  if (!hasConfig) return "invalid_backend_config";
  if (!session.hasSession || !session.hasAccessToken) return "missing_or_expired_session";

  const text = getErrorText(err).toLowerCase();
  if (text.includes("jwt") || text.includes("authorization") || text.includes("auth")) {
    return "possible_auth_header_issue";
  }

  if (isNetworkMutationError(err)) {
    return "possible_cors_or_preview_network";
  }

  return "unknown";
};

const refreshSessionIfNeeded = async (): Promise<MutationSessionInfo> => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  let session = sessionData.session;
  let refreshError: string | undefined = sessionError?.message;

  const nowSec = Math.floor(Date.now() / 1000);
  const isExpiredOrNearExpiry = session?.expires_at ? session.expires_at <= nowSec + 30 : false;

  if (!session || isExpiredOrNearExpiry) {
    const { data: refreshedData, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) {
      refreshError = refreshErr.message;
    } else {
      session = refreshedData.session;
    }
  }

  const sessionInfo: MutationSessionInfo = {
    hasSession: !!session,
    hasAccessToken: !!session?.access_token,
    expiresAt: session?.expires_at,
    refreshError,
  };

  console.log("SESSION", {
    hasSession: sessionInfo.hasSession,
    hasAccessToken: sessionInfo.hasAccessToken,
    expiresAt: sessionInfo.expiresAt,
    refreshError: sessionInfo.refreshError || null,
  });

  return sessionInfo;
};

export async function runMutationWithRetry<T>(
  context: MutationDebugContext,
  mutation: (attempt: number) => Promise<MutationResult<T>>,
): Promise<T> {
  const maxRetries = context.maxRetries ?? 3;
  const hasConfig = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

  const session = await refreshSessionIfNeeded();

  if (!hasConfig || !session.hasSession || !session.hasAccessToken) {
    const rootCause = detectRootCause({ err: null, session, hasConfig });
    console.error("NETWORK ERROR", {
      table: context.table,
      operation: context.operation,
      rootCause,
      hint: "Check backend URL/key configuration and auth session state.",
    });
    throw new Error(rootCause === "missing_or_expired_session" ? "Session expired. Please log in again." : "Invalid backend configuration.");
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log("REQUEST START", {
      table: context.table,
      operation: context.operation,
      payload: context.payload ?? null,
      userId: context.userId ?? null,
      companyId: context.companyId ?? null,
      attempt,
      maxRetries,
    });

    try {
      const response = await mutation(attempt);
      console.log("RESPONSE", {
        table: context.table,
        operation: context.operation,
        attempt,
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        error: response.error,
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    } catch (err) {
      lastError = err;
      const rootCause = detectRootCause({ err, session, hasConfig });
      console.error("NETWORK ERROR", {
        table: context.table,
        operation: context.operation,
        attempt,
        rootCause,
        error: err,
      });

      if (!isNetworkMutationError(err) || attempt === maxRetries) {
        break;
      }

      await sleep(500 * 2 ** (attempt - 1));
    }
  }

  const rootCause = detectRootCause({ err: lastError, session, hasConfig });
  const finalError = isNetworkMutationError(lastError)
    ? new Error(NETWORK_ERROR_MESSAGE)
    : new Error(getErrorText(lastError) || "Mutation failed");

  (finalError as Error & { rootCause?: RootCause }).rootCause = rootCause;
  throw finalError;
}

export function getMutationErrorMessage(err: unknown) {
  if (isNetworkMutationError(err)) return NETWORK_ERROR_MESSAGE;
  if (err instanceof Error && err.message) return err.message;
  return "Request failed. Please try again.";
}
