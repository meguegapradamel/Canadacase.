import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token || token === authorization) return json({ error: "Session non authentifiée." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Configuration serveur incomplète." }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return json({ error: "Session invalide ou expirée." }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
    if (profileError || !profile || profile.role !== "candidate" || profile.is_active === false) {
      return json({ error: "Seul le propriétaire actif du compte candidat peut gérer ce document." }, 403);
    }

    const body = await req.json();
    const documentId = String(body.document_id || "");
    const action = String(body.action || "");
    if (!documentId || !["update", "delete"].includes(action)) {
      return json({ error: "Action ou identifiant de document invalide." }, 400);
    }

    const { data: document, error: documentError } = await admin
      .from("case_documents")
      .select("id,user_id,storage_path,candidate_case_id")
      .eq("id", documentId).eq("user_id", user.id).maybeSingle();
    if (documentError || !document) return json({ error: "Document introuvable ou accès refusé." }, 404);

    if (document.candidate_case_id) {
      const { data: ownedCase } = await admin.from("candidate_cases")
        .select("id").eq("id", document.candidate_case_id).eq("user_id", user.id).maybeSingle();
      if (!ownedCase) return json({ error: "Ce document n'appartient pas à votre dossier." }, 403);
    }

    if (action === "delete") {
      const { error: deleteError } = await admin.from("case_documents")
        .delete().eq("id", document.id).eq("user_id", user.id);
      if (deleteError) return json({ error: "Suppression de l'enregistrement impossible : " + deleteError.message }, 500);
      const { error: storageError } = await admin.storage.from("case-documents").remove([document.storage_path]);
      if (storageError) return json({ ok: true, warning: "La fiche a été supprimée, mais le fichier de stockage doit être nettoyé." });
      return json({ ok: true });
    }

    const allowedCategories = [
      "Passeport", "Acte de naissance", "Diplôme", "Relevés de notes", "EDE",
      "Attestation de travail", "Contrat de travail", "Test linguistique",
      "Relevé bancaire", "Preuve de fonds", "ITA", "Certificat de police",
      "Visite médicale", "Autre"
    ];
    const category = String(body.category || "");
    if (!allowedCategories.includes(category)) return json({ error: "Catégorie de document non autorisée." }, 400);

    const updates: Record<string, unknown> = { category };
    let oldPathToRemove: string | null = null;
    const newPath = body.new_storage_path ? String(body.new_storage_path) : "";
    if (newPath) {
      const fileName = String(body.file_name || "").slice(0, 255);
      const mimeType = String(body.mime_type || "");
      const sizeBytes = Number(body.size_bytes);
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const allowed = ["pdf", "png", "jpg", "jpeg"];
      const allowedMime = ["application/pdf", "image/png", "image/jpeg"];
      if (!newPath.startsWith(user.id + "/") || newPath.includes("..") ||
          !fileName || !allowed.includes(ext) || !allowedMime.includes(mimeType) ||
          !Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > 10 * 1024 * 1024) {
        return json({ error: "Le nouveau fichier est invalide (PDF/JPG/PNG, 10 Mo maximum)." }, 400);
      }
      const { data: uploaded, error: downloadError } = await admin.storage.from("case-documents").download(newPath);
      if (downloadError || !uploaded) return json({ error: "Le nouveau fichier n'a pas été trouvé dans le stockage." }, 400);
      oldPathToRemove = document.storage_path;
      Object.assign(updates, {
        file_name: fileName,
        storage_path: newPath,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        status: "À vérifier",
        admin_note: null,
        verified_by: null,
        verified_at: null,
      });
    }

    const { error: updateError } = await admin.from("case_documents")
      .update(updates).eq("id", document.id).eq("user_id", user.id);
    if (updateError) return json({ error: "Mise à jour impossible : " + updateError.message }, 500);

    if (oldPathToRemove) {
      const { error: removeError } = await admin.storage.from("case-documents").remove([oldPathToRemove]);
      if (removeError) return json({ ok: true, warning: "Document remplacé, mais l'ancien fichier doit être nettoyé." });
    }
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erreur serveur." }, 500);
  }
});