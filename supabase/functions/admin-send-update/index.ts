import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch] || ch));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Méthode non autorisée." });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply(500, { error: "Configuration Supabase serveur incomplète." });

  const authHeader = req.headers.get("Authorization") || "";
  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return reply(401, { error: "Session administrateur invalide." });

  const admin = createClient(url, serviceKey);
  const { data: adminProfile, error: adminError } = await admin.from("profiles")
    .select("id,role,is_active").eq("id", authData.user.id).maybeSingle();
  if (adminError || !adminProfile || adminProfile.role !== "admin" || adminProfile.is_active === false) {
    return reply(403, { error: "Action réservée à un administrateur actif." });
  }

  let payload: { user_id?: string; case_id?: string; message?: string };
  try { payload = await req.json(); } catch { return reply(400, { error: "Corps JSON invalide." }); }
  const userId = payload.user_id || "";
  const caseId = payload.case_id || "";
  const message = (payload.message || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(caseId) || !message || message.length > 10000) {
    return reply(400, { error: "Candidat, dossier ou message invalide (10 000 caractères maximum)." });
  }

  const { data: targetCase, error: caseError } = await admin.from("candidate_cases")
    .select("id,user_id,case_number").eq("id", caseId).eq("user_id", userId).maybeSingle();
  if (caseError || !targetCase) return reply(404, { error: "Dossier introuvable ou non associé à ce candidat." });

  const { data: candidate, error: candidateError } = await admin.from("profiles")
    .select("id,full_name,email").eq("id", userId).maybeSingle();
  if (candidateError || !candidate?.email) return reply(404, { error: "Adresse e-mail du candidat introuvable." });

  const prefix = "[" + (targetCase.case_number || "Dossier") + "] ";
  const storedMessage = prefix + message;
  const { error: updateError } = await admin.from("case_updates")
    .insert({ user_id: userId, message: storedMessage });
  if (updateError) return reply(500, { error: "Impossible d'enregistrer le message dans le compte candidat." });

  const { error: notificationError } = await admin.from("notifications").insert({
    user_id: userId,
    case_id: caseId,
    title: "Nouveau message de CanadaCase",
    body: message,
    is_read: false,
  });
  if (notificationError) {
    return reply(200, { saved: true, notification_created: false, email_sent: false, warning: "Message enregistré dans le compte, mais la notification interne n'a pas pu être créée." });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!resendKey || !from) {
    return reply(200, { saved: true, notification_created: true, email_sent: false, email_setup_required: true, message: "Message et notification enregistrés. L'envoi e-mail nécessite la configuration du service d'e-mail." });
  }

  const subject = "Nouveau message concernant votre dossier CanadaCase";
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#243447;line-height:1.6"><h2>CanadaCase</h2><p>Bonjour ${escapeHtml(candidate.full_name || "")},</p><p>Votre conseiller vous a envoyé un nouveau message concernant le dossier <strong>${escapeHtml(targetCase.case_number || "")}</strong>.</p><div style="padding:16px;background:#f4f7fb;border-radius:8px;white-space:pre-wrap">${escapeHtml(message)}</div><p>Connectez-vous à votre espace CanadaCase pour consulter le suivi de votre dossier.</p><p><a href="https://canadacase.meguegap.workers.dev/">Ouvrir CanadaCase</a></p></div>`;
  try {
    const mailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [candidate.email], subject, html, text: "Bonjour " + (candidate.full_name || "") + ",\n\n" + message + "\n\nConnectez-vous à CanadaCase : https://canadacase.meguegap.workers.dev/" }),
    });
    if (!mailResponse.ok) {
      const detail = await mailResponse.text();
      console.error("Resend delivery failed", mailResponse.status, detail.slice(0, 500));
      return reply(200, { saved: true, notification_created: true, email_sent: false, email_error: "Le message est dans le compte, mais l'envoi du courriel a échoué." });
    }
    return reply(200, { saved: true, notification_created: true, email_sent: true });
  } catch (error) {
    console.error("Email transport error", error);
    return reply(200, { saved: true, notification_created: true, email_sent: false, email_error: "Le service e-mail est momentanément inaccessible." });
  }
});