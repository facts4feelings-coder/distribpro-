import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VALID_PERMISSIONS = [
  "dashboard", "quick-sale", "customer-invoices", "returns", "supplier-invoices",
  "payment-vouchers", "expense-vouchers", "income-options", "gate-passes",
  "customers", "suppliers", "products", "routes", "reports", "print-records", "salaries", "settings",
];

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,30}$/;

async function hashAnswer(answer: string): Promise<string> {
  const data = new TextEncoder().encode(answer.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function makeEmailForUsername(username: string): string {
  // Deterministic hidden email — never shown to users.
  const slug = username.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${slug || "user"}-${crypto.randomUUID().slice(0, 8)}@users.distribpro.local`;
}

async function createAppUserRow(adminClient: ReturnType<typeof createClient>, id: string, username: string, email: string) {
  await adminClient.from("app_users").upsert(
    { id, username, email },
    { onConflict: "id" },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    if (req.method === "GET") {
      // List users with their usernames for the settings screen.
      const { data: rows, error } = await adminClient
        .from("app_users")
        .select("id, username, email, created_at")
        .order("created_at");
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ users: rows }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const { username, password, permissions } = await req.json();
      if (!username || !password) {
        return new Response(JSON.stringify({ error: "Username and password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!USERNAME_RE.test(username)) {
        return new Response(JSON.stringify({ error: "Username must be 3-30 characters: letters, numbers, dot, dash or underscore" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Unique username check (case-insensitive)
      const { data: existing } = await adminClient
        .from("app_users")
        .select("id")
        .ilike("username", username)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "This username is already taken" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const email = makeEmailForUsername(username);
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await createAppUserRow(adminClient, data.user.id, username, email);

      const perms: string[] = Array.isArray(permissions)
        ? permissions.filter((p: string) => VALID_PERMISSIONS.includes(p))
        : [];
      if (perms.length > 0) {
        const { error: permError } = await adminClient
          .from("user_permissions")
          .upsert({ user_id: data.user.id, permissions: perms, updated_at: new Date().toISOString() });
        if (permError) {
          await adminClient.auth.admin.deleteUser(data.user.id);
          return new Response(JSON.stringify({ error: "Could not save permissions: " + permError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ id: data.user.id, username }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PUT") {
      const req_body = await req.json();
      const { user_id, username, permissions } = req_body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (username !== undefined) {
        if (!USERNAME_RE.test(username)) {
          return new Response(JSON.stringify({ error: "Username must be 3-30 characters: letters, numbers, dot, dash or underscore" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: taken } = await adminClient
          .from("app_users")
          .select("id")
          .ilike("username", username)
          .neq("id", user_id)
          .maybeSingle();
        if (taken) {
          return new Response(JSON.stringify({ error: "This username is already taken" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: row } = await adminClient
          .from("app_users")
          .select("email")
          .eq("id", user_id)
          .maybeSingle();
        if (!row) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error: updErr } = await adminClient
          .from("app_users")
          .update({ username })
          .eq("id", user_id);
        if (updErr) {
          return new Response(JSON.stringify({ error: updErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (Array.isArray(permissions)) {
        const perms = permissions.filter((p: string) => VALID_PERMISSIONS.includes(p));
        if (perms.length === 0) {
          // empty selection = remove restrictions entirely (full access)
          await adminClient.from("user_permissions").delete().eq("user_id", user_id);
        } else {
          const { error } = await adminClient.from("user_permissions").upsert({
            user_id,
            permissions: perms,
            updated_at: new Date().toISOString(),
          });
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      const recoveryQuestion = req_body.recovery_question as string | null | undefined;
      const recoveryAnswer = req_body.recovery_answer as string | null | undefined;
      if (recoveryQuestion && recoveryAnswer) {
        const answerHash = await hashAnswer(recoveryAnswer);
        const { error: recErr } = await adminClient
          .from("app_users")
          .update({ recovery_question: recoveryQuestion.trim(), recovery_answer_hash: answerHash })
          .eq("id", user_id);
        if (recErr) {
          return new Response(JSON.stringify({ error: "Could not save recovery question: " + recErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const userId = url.searchParams.get("id");
      if (!userId) {
        return new Response(JSON.stringify({ error: "User ID required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (userId === user.id) {
        return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
