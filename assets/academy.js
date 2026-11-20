(() => {
  const cfg = window.CANADACASE_CONFIG || {};
  const root = document.getElementById("academy-app");
  const logout = document.getElementById("academy-logout");
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase?.createClient;
  if (!configured) {
    root.innerHTML = '<div class="panel"><h1>Configuration indisponible</h1><p>Le service de connexion n’est pas configuré. Revenez plus tard.</p></div>';
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  let user = null;
  let account = null;
  let academyProfile = null;
  let trainerApplication = null;
  let activeTab = "profile";

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
  const notify = (message, error = false) => {
    const node = document.getElementById("academy-notice");
    if (!node) return;
    node.textContent = message;
    node.className = "academy-notice" + (error ? " error" : "");
    node.classList.remove("hidden");
  };
  const statusLabel = status => ({
    draft:"Brouillon",submitted:"Soumise",under_review:"En cours d’examen",
    needs_info:"Compléments demandés",approved:"Approuvée",
    rejected:"Refusée",suspended:"Suspendue"
  }[status] || status || "Non déposée");
  const statusClass = status => ["approved","rejected","suspended","submitted","under_review"].includes(status) ? status : "";

  async function init() {
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      renderSignedOut();
      return;
    }
    user = sessionData.session.user;
    const { data: profile, error } = await sb.from("profiles")
      .select("id,full_name,email,role,is_active")
      .eq("id", user.id).single();
    if (error) throw error;
    if (profile.is_active === false) {
      await sb.auth.signOut();
      renderSignedOut("Ce compte est désactivé. Contactez l’administration CanadaCase.");
      return;
    }
    account = profile;
    logout.classList.remove("hidden");
    if (account.role === "admin") {
      await renderAdmin();
    } else {
      await ensureLearnerProfile();
      renderLearner();
    }
  }

  function renderSignedOut(message = "") {
    logout.classList.add("hidden");
    root.innerHTML = '<div class="panel"><p class="eyebrow">CANADACASE ACADEMY</p><h1>Connectez-vous pour accéder à votre espace.</h1>' +
      (message ? '<p class="academy-notice error">' + escapeHtml(message) + '</p>' : '') +
      '<p class="muted">Utilisez votre compte CanadaCase existant. Vous n’avez pas besoin de créer un deuxième compte.</p>' +
      '<a class="primary" href="index.html">Se connecter à CanadaCase</a></div>';
  }

  async function ensureLearnerProfile() {
    const { data, error } = await sb.from("academy_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    academyProfile = data;
    if (!academyProfile) {
      const { data: created, error: createError } = await sb.from("academy_profiles").insert({
        user_id:user.id,
        display_name:account.full_name || user.email || "Apprenant",
        preferred_ui_language:"fr"
      }).select("*").single();
      if (createError) throw createError;
      academyProfile = created;
    }
    const { data: roles, error: roleError } = await sb.from("academy_user_roles")
      .select("role_code").eq("user_id", user.id);
    if (roleError) throw roleError;
    if (!(roles || []).some(item => item.role_code === "learner")) {
      const { error: addRoleError } = await sb.from("academy_user_roles")
        .insert({ user_id:user.id, role_code:"learner" });
      if (addRoleError && !String(addRoleError.message || "").toLowerCase().includes("duplicate")) throw addRoleError;
    }
    const { data: applications, error: appError } = await sb.from("academy_trainer_applications")
      .select("id,status,biography,experience_years,specialties,submitted_at,review_note,created_at")
      .eq("user_id", user.id).order("created_at", {ascending:false}).limit(1);
    if (appError) throw appError;
    trainerApplication = applications?.[0] || null;
  }

  function renderLearner() {
    const displayName = academyProfile?.display_name || account.full_name || "Apprenant";
    root.innerHTML = '<div class="academy-hero"><p class="eyebrow">CANADACASE · ACADEMY</p><h1>Bienvenue, ' + escapeHtml(displayName) + '.</h1>' +
      '<p>Vos formations, vos progrès et vos séances sont réunis ici. Commencez par votre profil ; la candidature formateur est entièrement facultative. Un refus de candidature formateur ne bloque pas votre compte ni vos autres fonctionnalités Academy : vous pouvez continuer à apprendre et déposer une nouvelle candidature.</p></div>' +
      '<div id="academy-notice" class="academy-notice hidden"></div>' +
      '<nav class="academy-tabs"><button type="button" data-academy-tab="profile" class="' + (activeTab==="profile"?"active":"") + '">Mon profil apprenant</button>' +
      '<button type="button" data-academy-tab="trainer" class="' + (activeTab==="trainer"?"active":"") + '">Devenir formateur</button></nav>' +
      '<section id="academy-profile-panel" class="' + (activeTab==="profile"?"":"hidden") + '">' + profilePanel() + '</section>' +
      '<section id="academy-trainer-panel" class="' + (activeTab==="trainer"?"":"hidden") + '">' + trainerPanel() + '</section>' +
      '<div class="academy-grid" style="margin-top:18px"><article class="academy-card"><p class="eyebrow">ENTRAÎNEMENT ORAL</p><h2>Coach vocal IA</h2><p>Simulez l’épreuve orale complète du TEF Canada ou du TCF Canada, avec chronomètre, dialogue interactif, micro maintenu et bilan pédagogique.</p><a class="primary" href="academy-coach.html">Ouvrir le coach vocal</a></article><article class="academy-card"><h2>Mon tableau de bord pédagogique</h2><p>Retrouvez vos formations, vos résultats, vos objectifs et votre planning dans un espace centralisé.</p><a class="primary" href="academy-dashboard.html">Ouvrir mon tableau de bord</a></article><article class="academy-card"><h2>Catalogue et bibliothèque</h2><p>Découvrez les cours publiés, les leçons TEF/TCF et les ressources pédagogiques.</p><a class="secondary" href="academy-catalog.html">Explorer les formations</a></article></div>';
    root.querySelectorAll("[data-academy-tab]").forEach(button => button.addEventListener("click", () => {
      activeTab = button.dataset.academyTab;
      renderLearner();
    }));
    bindProfileForm();
    bindTrainerForm();
    document.getElementById("academy-new-application")?.addEventListener("click", () => {
      trainerApplication = null;
      activeTab = "trainer";
      renderLearner();
    });
  }

  function profilePanel() {
    return '<article class="academy-card"><p class="eyebrow">ÉTAPE 1 · MON ESPACE</p><h2>Mon profil apprenant</h2><p>Une seule information suffit pour commencer. Vous pourrez compléter le reste plus tard.</p>' +
      '<form id="academy-profile-form" class="academy-form">' +
      '<label>Comment souhaitez-vous être appelé ?<input name="display_name" required maxlength="120" value="' + escapeHtml(academyProfile?.display_name || "") + '" placeholder="Votre nom ou prénom"></label>' +
      '<details class="academy-optional"><summary>Personnaliser mon espace (facultatif)</summary><div class="academy-form academy-optional-content">' +
      '<label>Langue de l’interface<select name="preferred_ui_language"><option value="fr"' + (academyProfile?.preferred_ui_language==="fr"?" selected":"") + '>Français</option><option value="en"' + (academyProfile?.preferred_ui_language==="en"?" selected":"") + '>English</option></select></label>' +
      '<label>Pays (code ISO à 2 lettres)<input name="country_code" maxlength="2" placeholder="CM" value="' + escapeHtml(academyProfile?.country_code || "") + '"></label>' +
      '<label>Fuseau horaire<input name="timezone" maxlength="80" placeholder="Africa/Douala" value="' + escapeHtml(academyProfile?.timezone || "") + '"></label>' +
      '<label>Mes objectifs (séparés par des virgules)<input name="learning_goals" maxlength="500" value="' + escapeHtml((academyProfile?.learning_goals || []).join(", ")) + '" placeholder="TEF Canada, expression orale"></label>' +
      '</div></details><div class="academy-actions"><button class="primary" type="submit">Enregistrer et continuer</button></div></form></article>';
  }

  function trainerPanel() {
    const app = trainerApplication;
    const status = app?.status || "draft";
    const editable = !app || ["draft","needs_info"].includes(status);
    const note = app?.review_note ? '<p class="academy-notice">' + escapeHtml(app.review_note) + '</p>' : "";
    const form = status === "rejected"
      ? '<div class="academy-empty"><strong>Votre précédente candidature a été refusée.</strong><p>Le refus concerne uniquement votre candidature au rôle de formateur. Votre compte Academy reste actif et vos autres fonctionnalités restent accessibles. Tenez compte des observations de l’administration puis déposez une nouvelle candidature.</p><button id="academy-new-application" class="secondary" type="button">Créer une nouvelle candidature</button></div>'
      : editable
      ? '<form id="academy-trainer-form" class="academy-form">' +
        '<label>Présentation et expérience professionnelle<textarea name="biography" rows="6" minlength="80" maxlength="5000" required>' + escapeHtml(app?.biography || "") + '</textarea><span class="academy-small">Minimum 80 caractères. Présentez votre parcours, votre méthode et votre expérience.</span></label>' +
        '<label>Années d’expérience<input name="experience_years" type="number" min="0" max="60" step="1" required value="' + escapeHtml(app?.experience_years ?? "") + '"></label>' +
        '<label>Spécialités (séparées par des virgules)<input name="specialties" maxlength="500" required value="' + escapeHtml((app?.specialties || []).join(", ")) + '" placeholder="TEF Canada, TCF Canada, expression orale"></label>' +
        '<div class="academy-actions"><button class="secondary" type="submit" name="intent" value="draft">Enregistrer le brouillon</button>' +
        '<button class="primary" type="submit" name="intent" value="submit">Soumettre ma candidature</button></div></form>'
      : '<div class="academy-empty"><strong>Votre candidature est ' + escapeHtml(statusLabel(status).toLowerCase()) + '.</strong><p>Vous ne pouvez pas modifier les informations pendant cette étape. Consultez le message de l’administration ci-dessus.</p></div>';
    return '<article class="academy-card"><div class="academy-actions"><h2 style="margin-right:auto">Candidature formateur</h2><span class="academy-status ' + statusClass(status) + '">' + escapeHtml(statusLabel(status)) + '</span></div>' +
      '<p>Cette démarche est facultative. Présentez votre expérience et vos spécialités ; vous pourrez enregistrer un brouillon avant l’envoi. Votre compte formateur sera activé uniquement après validation de l’administration. Le statut de cette candidature ne désactive jamais votre compte Academy.</p>' + note + form + '</article>';
  }

  function bindProfileForm() {
    const form = document.getElementById("academy-profile-form");
    if (!form) return;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(form);
      const country = String(data.get("country_code") || "").trim().toUpperCase();
      if (country && !/^[A-Z]{2}$/.test(country)) return notify("Le pays doit être indiqué par un code ISO de deux lettres, par exemple CM.", true);
      const goals = String(data.get("learning_goals") || "").split(",").map(x=>x.trim()).filter(Boolean).slice(0,20);
      const button = form.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = "Enregistrement…"; }
      try {
        const { data: updated, error } = await sb.from("academy_profiles").upsert({
          user_id:user.id,
          display_name:String(data.get("display_name") || "").trim(),
          preferred_ui_language:data.get("preferred_ui_language"),
          country_code:country || null,
          timezone:String(data.get("timezone") || "").trim() || null,
          learning_goals:goals
        }, { onConflict:"user_id" }).select("*").single();
        if (error) throw error;
        if (!updated) throw new Error("Aucune confirmation de sauvegarde n’a été retournée par le serveur.");
        academyProfile = updated;
        renderLearner();
        notify("Votre profil apprenant a été enregistré.");
      } catch (error) {
        notify(error?.message || "Enregistrement impossible. Vérifiez votre connexion puis réessayez.", true);
      } finally {
        const currentButton = document.querySelector('#academy-profile-form button[type="submit"]');
        if (currentButton) { currentButton.disabled = false; currentButton.textContent = currentButton.dataset.originalText || "Enregistrer mon profil"; }
      }
    });
  }

  function bindTrainerForm() {
    const form = document.getElementById("academy-trainer-form");
    if (!form) return;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const intent = event.submitter?.value || "draft";
      const data = new FormData(form);
      const biography = String(data.get("biography") || "").trim();
      const years = Number(data.get("experience_years"));
      const specialties = String(data.get("specialties") || "").split(",").map(x=>x.trim()).filter(Boolean).slice(0,20);
      if (biography.length < 80) return notify("Votre présentation doit contenir au moins 80 caractères.", true);
      if (!Number.isInteger(years) || years < 0 || years > 60) return notify("Indiquez un nombre d’années d’expérience valide.", true);
      if (!specialties.length) return notify("Indiquez au moins une spécialité.", true);
      const submitButtons = [...form.querySelectorAll('button[type="submit"]')];
      submitButtons.forEach(button => { button.disabled = true; button.dataset.label = button.textContent; button.textContent = "Enregistrement…"; });
      try {
        let application = trainerApplication;
        if (!application) {
          const { data: created, error } = await sb.from("academy_trainer_applications").insert({
            user_id:user.id, status:"draft", biography, experience_years:years, specialties
          }).select("*").single();
          if (error) throw error;
          application = created;
        } else {
          const { data: updated, error } = await sb.from("academy_trainer_applications").update({
            biography, experience_years:years, specialties
          }).eq("id", application.id).select("*").single();
          if (error) throw error;
          application = updated;
        }
        trainerApplication = application;
        if (intent === "submit") {
          const { error: submitError } = await sb.rpc("academy_submit_trainer_application", {
            p_application_id:application.id
          });
          if (submitError) throw submitError;
        }
        await ensureLearnerProfile();
        renderLearner();
        notify(intent === "submit" ? "Votre candidature a été transmise à l’administration." : "Votre brouillon a été enregistré.");
      } catch (error) {
        notify(error?.message || "Enregistrement impossible. Vérifiez votre connexion puis réessayez.", true);
      } finally {
        submitButtons.forEach(button => { button.disabled = false; button.textContent = button.dataset.label || "Enregistrer"; });
      }
    });
  }

  async function renderAdmin() {
    root.innerHTML = '<div class="academy-hero"><p class="eyebrow">CANADACASE · ACADEMY</p><h1>Administration des formateurs</h1><p>Examinez les candidatures. Toute décision est contrôlée côté serveur et inscrite au journal administratif.</p></div><div class="academy-card"><div class="academy-actions"><div><h2>Outils pédagogiques</h2><p class="muted">Accédez au même Coach vocal IA que les apprenants pour tester le parcours oral, la reconnaissance vocale et les corrections.</p></div><a class="primary" href="academy-coach.html">🎙 Ouvrir le Coach vocal IA</a></div></div>' +
      '<div id="academy-notice" class="academy-notice hidden"></div><div class="academy-card"><div class="academy-actions"><h2 style="margin-right:auto">Candidatures formateurs</h2><button id="academy-refresh" class="secondary" type="button">Actualiser</button></div><div id="academy-review-list"><p class="muted">Chargement…</p></div></div>';
    document.getElementById("academy-refresh").addEventListener("click", loadAdminApplications);
    await loadAdminApplications();
  }

  async function loadAdminApplications() {
    const list = document.getElementById("academy-review-list");
    list.innerHTML = '<p class="muted">Chargement des candidatures…</p>';
    const { data: apps, error } = await sb.from("academy_trainer_applications")
      .select("id,user_id,status,biography,experience_years,specialties,submitted_at,review_note,created_at")
      .in("status", ["submitted","under_review","needs_info","approved","rejected","suspended"])
      .order("created_at", {ascending:false}).limit(100);
    if (error) { list.innerHTML = '<p class="academy-notice error">' + escapeHtml(error.message) + '</p>'; return; }
    if (!apps?.length) { list.innerHTML = '<div class="academy-empty">Aucune candidature pour le moment.</div>'; return; }
    const ids = [...new Set(apps.map(x=>x.user_id))];
    const { data: profiles } = await sb.from("profiles").select("id,full_name,email").in("id",ids);
    const profileMap = new Map((profiles || []).map(x=>[x.id,x]));
    list.innerHTML = apps.map(app => {
      const candidate = profileMap.get(app.user_id) || {};
      const terminal = app.status === "rejected";
      return '<article class="academy-application" data-application="' + escapeHtml(app.id) + '">' +
        '<div class="academy-actions"><h3>' + escapeHtml(candidate.full_name || candidate.email || "Candidat") + '</h3><span class="academy-status ' + statusClass(app.status) + '">' + escapeHtml(statusLabel(app.status)) + '</span></div>' +
        '<p class="meta">' + escapeHtml(candidate.email || app.user_id) + ' · Expérience : ' + escapeHtml(app.experience_years) + ' an(s) · Spécialités : ' + escapeHtml((app.specialties || []).join(", ")) + '</p>' +
        '<p>' + escapeHtml(app.biography || "") + '</p>' +
        (app.review_note ? '<p class="academy-notice">' + escapeHtml(app.review_note) + '</p>' : '') +
        (!terminal ? '<label>Note de décision<textarea class="academy-review-note" data-review-note rows="2" maxlength="2000" placeholder="Motif ou précisions à communiquer au candidat…"></textarea></label>' +
          '<div class="academy-actions" style="margin-top:10px">' +
          (app.status === "approved"
            ? '<button class="secondary academy-danger" data-review="suspended" data-id="' + escapeHtml(app.id) + '">Suspendre le formateur</button>'
            : app.status === "suspended"
              ? '<button class="primary" data-review="approved" data-id="' + escapeHtml(app.id) + '">Réactiver le formateur</button><button class="secondary academy-danger" data-review="rejected" data-id="' + escapeHtml(app.id) + '">Clôturer la candidature</button>'
              : '<button class="secondary" data-review="under_review" data-id="' + escapeHtml(app.id) + '">Prendre en charge</button>' +
                '<button class="secondary" data-review="needs_info" data-id="' + escapeHtml(app.id) + '">Demander des compléments</button>' +
                '<button class="primary" data-review="approved" data-id="' + escapeHtml(app.id) + '">Approuver</button>' +
                '<button class="secondary academy-danger" data-review="rejected" data-id="' + escapeHtml(app.id) + '">Refuser</button>') +
          '</div>' : '') +
        '</article>';
    }).join("");
    list.querySelectorAll("[data-review]").forEach(button => button.addEventListener("click", async () => {
      const card = button.closest("[data-application]");
      const note = card?.querySelector("[data-review-note]")?.value || "";
      button.disabled = true;
      const { error: reviewError } = await sb.rpc("academy_review_trainer_application", {
        p_application_id:button.dataset.id,
        p_decision:button.dataset.review,
        p_note:note
      });
      if (reviewError) {
        button.disabled = false;
        return notify(reviewError.message, true);
      }
      notify("La décision a été enregistrée.");
      await loadAdminApplications();
    }));
  }

  logout.addEventListener("click", async () => {
    const { error } = await sb.auth.signOut();
    if (error) return notify(error.message, true);
    location.href = "index.html";
  });

  init().catch(error => {
    root.innerHTML = '<div class="panel"><h1>Impossible de charger CanadaCase Academy</h1><p class="academy-notice error">' +
      escapeHtml(error?.message || "Une erreur est survenue.") + '</p><p><a href="index.html">Retour au portail CanadaCase</a></p></div>';
  });
})();