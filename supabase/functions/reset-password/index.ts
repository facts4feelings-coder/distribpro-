import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Step 1: get the security question for a username (no answer verification).
    if (body.action === "get-question") {
      const { data: qRow, error: qErr } = await adminClient
        .from("app_users")
        .select("recovery_question")
        .ilike("username", String(body.username ?? "").trim())
        .maybeSingle();
      if (qErr) {
        return new Response(JSON.stringify({ error: "Could not load the question. Please try again." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!qRow || !qRow.recovery_question) {
        return new Response(JSON.stringify({ error: "No recovery question is set for this username. Ask an admin to set one in Settings." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ question: qRow.recovery_question }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { username, answer, new_password } = body;
    if (!username || !answer || !new_password) {
      return new Response(JSON.stringify({ error: "Username, answer and new password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof new_password !== "string" || new_password.length < 6) {
      return new Response(JSON.stringify({ error: "New password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cleanUsername = String(username).trim();

    const { data: row, error: lookupErr } = await adminClient
      .from("app_users")
      .select("id, recovery_question, recovery_answer_hash")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (lookupErr) {
      return new Response(JSON.stringify({ error: "Reset failed. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!row) {
      // Do not reveal whether the username exists.
      return new Response(JSON.stringify({ error: "No recovery question is set for this username" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!row.recovery_question || !row.recovery_answer_hash) {
      return new Response(JSON.stringify({ error: "No recovery question is set for this username. Ask an admin to set one in Settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: max 5 failed answers per username per 15 minutes.
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await adminClient
      .from("password_reset_attempts")
      .select("id", { count: "exact", head: true })
      .eq("username", cleanUsername.toLowerCase())
      .eq("success", false)
      .gte("created_at", fifteenMinAgo);

    if ((count ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: "Too many attempts. Please try again in 15 minutes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const answerHash = await sha256Hex(String(answer));
    if (answerHash !== row.recovery_answer_hash) {
      await adminClient.from("password_reset_attempts").insert({ username: cleanUsername.toLowerCase(), success: false });
      return new Response(JSON.stringify({ error: "The answer is not correct" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await adminClient.auth.admin.updateUserById(row.id, {
      password: String(new_password),
    });

    if (updErr) {
      return new Response(JSON.stringify({ error: "Could not reset password. Please try again." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("password_reset_attempts").insert({ username: cleanUsername.toLowerCase(), success: true });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_err) {
    return new Response(JSON.stringify({ error: "Reset failed. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
