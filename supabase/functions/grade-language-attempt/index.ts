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
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Connexion requise." }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Configuration serveur incomplète." }, 503);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return json({ error: "Session invalide." }, 401);
  const { data: profile } = await adminClient.from("profiles").select("is_active").eq("id", auth.user.id).maybeSingle();
  if (!profile || profile.is_active === false) return json({ error: "Compte inactif." }, 403);

  let body: { attempt_id?: string; answers?: Record<string, number | null>; production_answer?: string; feedback?: string };
  try { body = await req.json(); } catch { return json({ error: "Requête invalide." }, 400); }
  const attemptId = String(body.attempt_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return json({ error: "Session invalide." }, 400);

  const { data: attempt, error: attemptError } = await adminClient.from("language_attempts")
    .select("id,user_id,exam,skill,level,question_ids,started_at,completed_at")
    .eq("id", attemptId).eq("user_id", auth.user.id).maybeSingle();
  if (attemptError || !attempt) return json({ error: "Session introuvable." }, 404);
  if (attempt.completed_at) return json({ error: "Cette session est déjà terminée." }, 409);

  const duration = Math.max(0, Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000));
  const ids = Array.isArray(attempt.question_ids) ? attempt.question_ids : [];
  if (ids.length) {
    const { data: questions, error: qError } = await adminClient.from("language_exercise_questions")
      .select("id,exercise_id,question_text,options,explanation,language_exercises!inner(exam,skill,level,is_published)")
      .in("id", ids);
    if (qError || !questions || questions.length !== ids.length) return json({ error: "Questions de cette session introuvables." }, 422);
    const invalid = questions.some((q: any) => {
      const e = q.language_exercises;
      return !e?.is_published || e.exam !== attempt.exam || e.skill !== attempt.skill || e.level !== attempt.level;
    });
    if (invalid) return json({ error: "Certaines questions ne correspondent pas à cette session." }, 403);
    const { data: keys, error: keyError } = await adminClient.from("language_question_keys")
      .select("question_id,correct_option").in("question_id", ids);
    if (keyError || !keys || keys.length !== ids.length) return json({ error: "Corrigé indisponible pour certaines questions." }, 503);
    const answerMap = body.answers || {};
    let score = 0;
    const review = [];
    for (const question of questions as any[]) {
      const selected = answerMap[question.id];
      const key = keys.find((k: any) => k.question_id === question.id);
      const correct = selected !== undefined && selected !== null && Number(selected) === key.correct_option;
      if (correct) score++;
      review.push({
        question_id: question.id,
        selected_option: selected === undefined ? null : selected,
        correct_option: key.correct_option,
        is_correct: correct
      });
    }
    const reviewWithExplanations = review.map((item: any) => {
      const question: any = (questions as any[]).find((q: any) => q.id === item.question_id);
      return {
        ...item,
        question_text: question?.question_text || "",
        options: question?.options || [],
        explanation: question?.explanation || null
      };
    });
    // Persist only missed items so learners can revisit them later.
    const missedReview = reviewWithExplanations.filter((item: any) => !item.is_correct);
    const { error: updateError } = await adminClient.from("language_attempts").update({
      answers: answerMap, score, max_score: questions.length,
      feedback: JSON.stringify({ kind: "qcm_review", review: missedReview }),
      completed_at: new Date().toISOString(), duration_seconds: duration,
    }).eq("id", attemptId);
    if (updateError) return json({ error: "Enregistrement du résultat impossible." }, 500);
    return json({ score, max_score: questions.length, duration_seconds: duration, review: reviewWithExplanations });
  }

  const production = String(body.production_answer || "").trim();
  if (!production || production.length > 12000) return json({ error: "Production vide ou trop longue." }, 400);
  const { error: updateError } = await adminClient.from("language_attempts").update({
    answers: { production }, feedback: String(body.feedback || "").slice(0, 12000),
    completed_at: new Date().toISOString(), duration_seconds: duration,
  }).eq("id", attemptId);
  if (updateError) return json({ error: "Enregistrement de la production impossible." }, 500);
  return json({ saved: true, duration_seconds: duration });
});