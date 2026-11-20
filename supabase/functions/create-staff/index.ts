import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) Caller must be signed in AND be the owner.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Authentication required" });

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json(401, { error: "Invalid session" });
  const { data: isOwner, error: ownerErr } = await userClient.rpc("is_owner");
  if (ownerErr || isOwner !== true) return json(403, { error: "Only the owner can create staff accounts" });

  // 2) Validate input.
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const firstName = str(body.first_name);
  const middleName = str(body.middle_name);
  const lastName = str(body.last_name);
  const phone = str(body.phone);
  const roleKey = str(body.role_key);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "Valid email is required" });
  if (password.length < 8) return json(400, { error: "Password must be at least 8 characters" });
  if (!firstName) return json(400, { error: "Name is required" });
  if (!phone) return json(400, { error: "Phone is required" });
  if (!roleKey || roleKey === "owner" || roleKey === "customer") {
    return json(400, { error: "role_key must be an existing staff role (not owner/customer)" });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: role } = await admin.from("roles").select("id,key").eq("key", roleKey).maybeSingle();
  if (!role) return json(400, { error: "Unknown role" });

  // 3) Create the auth user. account_type lives in app_metadata, which users can never set themselves.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, middle_name: middleName, last_name: lastName, phone },
    app_metadata: { account_type: "staff" },
  });
  if (createErr || !created?.user) return json(400, { error: createErr?.message ?? "Could not create user" });

  // 4) Assign the role; roll back the user if that fails.
  const { error: roleErr } = await admin.from("user_roles").insert({
    user_id: created.user.id,
    role_id: role.id,
    assigned_by: userData.user.id,
  });
  if (roleErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json(400, { error: roleErr.message });
  }

  return json(200, { id: created.user.id, email, role: role.key });
});
