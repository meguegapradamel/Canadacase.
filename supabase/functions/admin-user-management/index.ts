import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!service) return json({ error: "Configuration serveur incomplète : clé de service absente." }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentification requise." }, 401);

  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return json({ error: "Session invalide." }, 401);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: callerProfile, error: roleError } = await admin
    .from("profiles").select("role,is_active").eq("id", authData.user.id).single();
  if (roleError || callerProfile?.role !== "admin" || callerProfile?.is_active === false) {
    return json({ error: "Accès réservé à un compte administrateur actif." }, 403);
  }

  let body: { action?: string; user_id?: string; confirmation?: string };
  try { body = await req.json(); } catch { return json({ error: "Requête invalide." }, 400); }
  const targetId = body.user_id;
  if (!targetId || !/^[0-9a-f-]{36}$/i.test(targetId)) return json({ error: "Identifiant utilisateur invalide." }, 400);
  if (targetId === authData.user.id) return json({ error: "Vous ne pouvez pas modifier ou supprimer votre propre compte administrateur." }, 400);

  const { data: target, error: targetError } = await admin
    .from("profiles").select("id,role,is_active").eq("id", targetId).maybeSingle();
  if (targetError || !target) return json({ error: "Utilisateur introuvable." }, 404);

  if (body.action === "send_password_recovery") {
    if (target.role !== "candidate") return json({ error: "Cette action est réservée aux comptes candidats." }, 403);
    if (target.is_active === false) return json({ error: "Ce compte est désactivé. Réactivez-le avant de demander une réinitialisation." }, 409);
    const { data: targetAuth, error: targetAuthError } = await admin.auth.admin.getUserById(targetId);
    const targetEmail = targetAuth?.user?.email;
    if (targetAuthError || !targetEmail) return json({ error: "Adresse e-mail du candidat introuvable." }, 404);
    const { error: recoveryError } = await caller.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: "https://canadacase.meguegap.workers.dev/?reset-password=1"
    });
    if (recoveryError) return json({ error: "Envoi du lien impossible : " + recoveryError.message }, 500);
    const { error: logError } = await admin.from("admin_action_log").insert({
      admin_id: authData.user.id,
      target_user: targetId,
      action: "admin_sent_password_recovery",
      details: { target_email: targetEmail }
    });
    if (logError) return json({ success: true, message: "Le lien de réinitialisation a bien été envoyé.", warning: "Le lien a été envoyé, mais l’action n’a pas pu être inscrite dans le journal d’administration. Vérifiez le journal." });
    return json({ success: true, message: "Un lien de réinitialisation a été envoyé au candidat." });
  }

  if (body.action === "promote_admin") {
    if (body.confirmation !== "NOMMER ADMINISTRATEUR") {
      return json({ error: "Confirmation explicite manquante." }, 400);
    }
    if (target.role === "admin") return json({ error: "Cet utilisateur est déjà administrateur." }, 409);
    if (target.is_active === false) return json({ error: "Réactivez d'abord ce compte avant de le nommer administrateur." }, 409);

    const { error: promotionError } = await admin.from("profiles")
      .update({ role: "admin" })
      .eq("id", targetId)
      .eq("role", "candidate");
    if (promotionError) return json({ error: "Nomination impossible : " + promotionError.message }, 500);

    const { data: promoted, error: verifyError } = await admin.from("profiles")
      .select("id,role,is_active").eq("id", targetId).single();
    if (verifyError || promoted?.role !== "admin" || promoted?.is_active === false) {
      return json({ error: "La nomination n'a pas pu être vérifiée. Contactez l'administrateur technique." }, 500);
    }

    const { error: logError } = await admin.from("admin_action_log").insert({
      admin_id: authData.user.id,
      target_user: targetId,
      action: "promote_user_to_admin",
      details: { target_email: (await admin.auth.admin.getUserById(targetId)).data.user?.email || null },
    });
    if (logError) return json({ error: "Le rôle a été modifié, mais l'inscription dans le journal a échoué : " + logError.message }, 500);

    return json({ success: true, role: "admin" });
  }

  if (target.role === "admin") return json({ error: "La suppression ou désactivation d'un administrateur par cette fonction est interdite." }, 403);

  if (body.action === "disable" || body.action === "enable") {
    const active = body.action === "enable";
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(targetId, {
      ban_duration: active ? "none" : "876000h",
    });
    if (authUpdateError) return json({ error: "Impossible de mettre à jour l'accès : " + authUpdateError.message }, 500);

    const { error: profileUpdateError } = await admin.from("profiles").update({
      is_active: active,
      deactivated_at: active ? null : new Date().toISOString(),
    }).eq("id", targetId);
    if (profileUpdateError) {
      await admin.auth.admin.updateUserById(targetId, { ban_duration: active ? "876000h" : "none" });
      return json({ error: "Mise à jour du profil impossible : " + profileUpdateError.message }, 500);
    }
    await admin.from("admin_action_log").insert({
      admin_id: authData.user.id, target_user: targetId,
      action: active ? "reactivate_user" : "deactivate_user",
      details: { email: (await admin.auth.admin.getUserById(targetId)).data.user?.email || null },
    });
    return json({ success: true, is_active: active });
  }

  if (body.action === "delete") {
    if (body.confirmation !== "SUPPRIMER DÉFINITIVEMENT") {
      return json({ error: "Confirmation explicite manquante." }, 400);
    }

    const bucket = "case-documents";
    const { data: objects, error: listError } = await admin.storage.from(bucket).list(targetId, {
      limit: 1000, sortBy: { column: "name", order: "asc" },
    });
    if (listError) return json({ error: "Impossible de préparer la suppression des documents : " + listError.message }, 500);
    const paths = (objects || []).filter(x => x.name && x.id).map(x => targetId + "/" + x.name);

    const { error: messagesError } = await admin.from("case_messages").delete().eq("sender_id", targetId);
    if (messagesError) return json({ error: "Suppression des messages impossible : " + messagesError.message }, 500);

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(targetId);
    if (authDeleteError) return json({ error: "Suppression du compte impossible : " + authDeleteError.message }, 500);

    let storageWarning: string | null = null;
    if (paths.length) {
      const { error: removeError } = await admin.storage.from(bucket).remove(paths);
      if (removeError) storageWarning = "Le compte a été supprimé, mais certains fichiers doivent encore être nettoyés : " + removeError.message;
    }
    await admin.from("admin_action_log").insert({
      admin_id: authData.user.id, target_user: null,
      action: "delete_user",
      details: { deleted_user_id: targetId, deleted_storage_objects: paths.length, storage_warning: storageWarning },
    });
    return json({ success: true, storage_warning: storageWarning });
  }

  return json({ error: "Action non reconnue." }, 400);
});