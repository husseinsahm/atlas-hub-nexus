import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type MutationOperation = "insert" | "update" | "delete";
type MutationFilterOperator = "eq" | "is" | "in";

interface MutationFilter {
  column: string;
  operator?: MutationFilterOperator;
  value: unknown;
}

interface MutationRequest {
  table: string;
  operation: MutationOperation;
  payload?: Record<string, unknown> | Record<string, unknown>[] | null;
  filters?: MutationFilter[];
  select?: string;
  single?: boolean;
}

const applyFilters = (query: any, filters: MutationFilter[]) => {
  return filters.reduce((acc, filter) => {
    const operator = filter.operator ?? "eq";

    if (operator === "eq") return acc.eq(filter.column, filter.value);
    if (operator === "is") return acc.is(filter.column, filter.value);
    if (operator === "in") {
      if (!Array.isArray(filter.value)) {
        throw new Error(`Filter '${filter.column}' with operator 'in' requires an array value`);
      }
      return acc.in(filter.column, filter.value);
    }

    throw new Error(`Unsupported filter operator: ${operator}`);
  }, query);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as MutationRequest;
    const {
      table,
      operation,
      payload = null,
      filters = [],
      select = "*",
      single = false,
    } = body;

    if (!table || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      return new Response(JSON.stringify({ error: "Invalid table name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!operation || !["insert", "update", "delete"].includes(operation)) {
      return new Response(JSON.stringify({ error: "Invalid operation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((operation === "update" || operation === "delete") && filters.length === 0) {
      return new Response(JSON.stringify({ error: "Update/Delete requires at least one filter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = client.from(table as any);

    if (operation === "insert") query = query.insert(payload as any);
    if (operation === "update") query = query.update(payload as any);
    if (operation === "delete") query = query.delete();

    if (filters.length > 0) {
      query = applyFilters(query, filters);
    }

    query = query.select(select);
    if (single) query = query.single();

    const { data, error, status, statusText } = await query;

    if (error) {
      return new Response(JSON.stringify({ data: null, error, status, statusText }), {
        status: status || 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data, error: null, status, statusText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
