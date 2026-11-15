import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const authorization = req.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+/i.test(authorization)) return json({ error: "Authentification requise." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Configuration serveur Supabase incomplète." }, 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Session invalide ou expirée." }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role,is_active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || profile?.role !== "admin" || profile?.is_active === false) {
    return json({ error: "Accès réservé à un administrateur actif." }, 403);
  }

  const { data: exercises, error: listError } = await admin
    .from("language_exercises")
    .select("id,exam,audio_path")
    .eq("is_published", true)
    .eq("skill", "Compréhension orale")
    .like("audio_path", "https://resource2.heygen.ai/%")
    .order("exam");
  if (listError) return json({ error: "Impossible de lire la bibliothèque audio." }, 500);

  const results: Array<{ id: string; status: string; detail?: string }> = [];
  for (const exercise of exercises || []) {
    try {
      const source = new URL(exercise.audio_path);
      if (source.protocol !== "https:" || source.hostname !== "resource2.heygen.ai") {
        throw new Error("Source audio non autorisée.");
      }

      const response = await fetch(source.toString(), { redirect: "error" });
      if (!response.ok) throw new Error("Téléchargement audio refusé (HTTP " + response.status + ").");
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("audio") && !source.pathname.toLowerCase().endsWith(".mp3")) {
        throw new Error("Le fichier distant n'est pas reconnu comme audio.");
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 25 * 1024 * 1024) {
        throw new Error("Taille audio invalide ou supérieure à 25 Mo.");
      }

      const examSlug = exercise.exam === "TEF Canada" ? "tef-canada" : "tcf-canada";
      const storagePath = "heygen-audio/" + examSlug + "/" + exercise.id + ".mp3";
      const { error: uploadError } = await admin.storage.from("language-media").upload(
        storagePath,
        bytes,
        { contentType: "audio/mpeg", upsert: true, cacheControl: "31536000" },
      );
      if (uploadError) throw uploadError;

      const { error: updateError } = await admin
        .from("language_exercises")
        .update({ audio_path: storagePath })
        .eq("id", exercise.id);
      if (updateError) {
        await admin.storage.from("language-media").remove([storagePath]);
        throw updateError;
      }
      results.push({ id: exercise.id, status: "copied_to_supabase_storage" });
    } catch (error) {
      results.push({
        id: exercise.id,
        status: "failed",
        detail: error instanceof Error ? error.message : "Erreur inconnue.",
      });
    }
  }

  const copied = results.filter((item) => item.status === "copied_to_supabase_storage").length;
  return json({
    total: results.length,
    copied,
    failed: results.length - copied,
    results,
  });
});
