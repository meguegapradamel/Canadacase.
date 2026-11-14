
(() => {
  const cfg = window.CANADACASE_CONFIG || {};

  const configured =
    cfg.SUPABASE_URL?.startsWith("https://") &&
    !cfg.SUPABASE_URL.includes("VOTRE-") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("VOTRE_");

  const $ = s => document.querySelector(s);

  const landingView = $("#landing-view");
  const authView = $("#auth-view");
  const candidateView = $("#candidate-view");
  const adminView = $("#admin-view");

  let sb = null;
  let currentUser = null;
  let profile = null;
  let candidateCases = [];
  let activeCaseId = null;
  let activeWorkspace = sessionStorage.getItem("cc_workspace") || "";
  let publishedLanguageExercises = [];
  let activeExamQuestions = [];
  let activeExamAttemptId = null;
  let examStartedAt = null;
  let examDeadline = null;
  let examTimerHandle = null;
  let mediaRecorder = null;
  let recordingChunks = [];

  const showNotice = (msg, bad = false) => {
    const n = $("#notice");
    n.textContent = msg;
    n.className = "notice " + (bad ? "error" : "");
    n.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hideNotice = () => $("#notice").classList.add("hidden");

  const setBusy = (form, busy) => {
    form.querySelectorAll('button, input[type="submit"]').forEach(x => {
      x.disabled = busy;
    });
  };

  const setSubmitText = (form, text) => {
    const button = form.querySelector(
      'button[type="submit"], button:not([type]), input[type="submit"]'
    );

    if (!button) return () => {};

    const original = button.tagName === "INPUT"
      ? button.value
      : button.textContent;

    if (button.tagName === "INPUT") {
      button.value = text;
    } else {
      button.textContent = text;
    }

    return () => {
      if (button.tagName === "INPUT") {
        button.value = original;
      } else {
        button.textContent = original;
      }
    };
  };

  const authErrorMessage = (error, action) => {
    const message = String(error?.message || "").toLowerCase();

    if (
      message.includes("invalid login credentials") ||
      message.includes("invalid credentials")
    ) {
      return "Adresse e-mail ou mot de passe incorrect.";
    }

    if (message.includes("email not confirmed")) {
      return "Votre adresse e-mail n'est pas encore confirmée. Vérifiez votre boîte e-mail.";
    }

    if (
      message.includes("user already registered") ||
      message.includes("already registered")
    ) {
      return "Cette adresse e-mail possède déjà un compte. Essayez de vous connecter.";
    }

    if (
      message.includes("password") &&
      (message.includes("at least") || message.includes("characters"))
    ) {
      return "Le mot de passe ne respecte pas la longueur minimale requise.";
    }

    if (
      message.includes("failed to fetch") ||
      message.includes("network") ||
      message.includes("fetch")
    ) {
      return "Problème de connexion Internet. Vérifiez votre réseau et réessayez.";
    }

    return error?.message ||
      (action === "login"
        ? "Connexion impossible. Veuillez réessayer."
        : "Inscription impossible. Veuillez réessayer.");
  };

  const val = (form, name) =>
    form.elements[name]?.value ?? "";

  const setVal = (form, name, value) => {
    if (form.elements[name]) {
      form.elements[name].value = value ?? "";
    }
  };

  const fields = [...$("#candidate-form").elements]
    .filter(e => e.name);

  const payload = () =>
    Object.fromEntries(fields.map(e => [e.name, e.value]));

  function tab(which) {
    document.querySelectorAll(".tab").forEach(b =>
      b.classList.toggle("active", b.dataset.tab === which)
    );

    $("#login-form").classList.toggle("hidden", which !== "login");
    $("#register-form").classList.toggle("hidden", which !== "register");
  }

  document.querySelectorAll(".tab").forEach(b =>
    b.addEventListener("click", () => tab(b.dataset.tab))
  );

  function logoutButton() {
    $("#userbar").innerHTML =
      '<button class="ghost" id="logout">Déconnexion</button>';

    $("#logout").onclick = async () => {
      await sb.auth.signOut();
      location.reload();
    };
  }

  function showOnly(view) {
    [landingView, authView, candidateView, adminView].forEach(v => v.classList.add("hidden"));
    view.classList.remove("hidden");
  }

  function setWorkspace(workspace) {
    activeWorkspace = workspace;
    sessionStorage.setItem("cc_workspace", workspace);
    authView.dataset.workspace = workspace;
    if (currentUser && profile) {
      if (profile.role === "admin") { showOnly(adminView); return; }
      showOnly(candidateView);
      candidateView.classList.toggle("workspace-language", workspace === "language");
      if (workspace === "language") loadPublishedLanguageExercises();
      else loadCandidate().catch(error => showNotice(error.message, true));
      return;
    }
    showOnly(authView);
    tab("login");
    const title = authView.querySelector(".hero h1");
    const copy = authView.querySelector(".hero>p:not(.eyebrow)");
    if (workspace === "language") {
      title.textContent = "Préparez votre TCF Canada ou votre TEF Canada.";
      copy.textContent = "Entraînez-vous aux quatre compétences avec des exercices progressifs, des supports audio et visuels et des corrections personnalisées.";
    } else {
      title.textContent = "Votre projet de voyage et d’immigration, suivi au même endroit.";
      copy.textContent = "Complétez votre profil, transmettez vos documents et suivez les demandes de votre conseiller.";
    }
  }

  document.querySelectorAll("[data-workspace]").forEach(button =>
    button.addEventListener("click", () => setWorkspace(button.dataset.workspace))
  );
  $("#back-to-workspaces").addEventListener("click", () => { activeWorkspace=""; sessionStorage.removeItem("cc_workspace"); showOnly(landingView); });
  $("#back-workspace").addEventListener("click", () => {
    activeWorkspace = "";
    sessionStorage.removeItem("cc_workspace");
    showOnly(landingView);
  });

  async function loadProfile() {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (error) throw error;

    profile = data;
    if (profile.role !== "admin" && profile.is_active === false) {
      await sb.auth.signOut();
      throw new Error("Ce compte a été désactivé. Contactez l'administration de CanadaCase.");
    }
  }

  async function initSession() {
    const {
      data: { session },
      error
    } = await sb.auth.getSession();

    if (error) throw error;

    if (!session) {
      currentUser = null;
      profile = null;
      showOnly(landingView);
      return;
    }

    currentUser = session.user;

    await loadProfile();
    logoutButton();

    if (profile.role === "admin") {
      showOnly(adminView);
      await loadAdmin();
    } else if (!activeWorkspace) {
      showOnly(landingView);
    } else {
      showOnly(candidateView);
      candidateView.classList.toggle("workspace-language", activeWorkspace === "language");
      if (activeWorkspace === "language") await loadPublishedLanguageExercises();
      else await loadCandidate();
    }
  }

  // CONNEXION
  $("#login-form").addEventListener("submit", async e => {
    e.preventDefault();

    const form = e.currentTarget;

    hideNotice();
    setBusy(form, true);

    const restoreText = setSubmitText(
      form,
      "Connexion en cours…"
    );

    try {
      const { error } = await sb.auth.signInWithPassword({
        email: val(form, "email").trim(),
        password: val(form, "password")
      });

      if (error) throw error;

      await initSession();

    } catch (error) {
      showNotice(authErrorMessage(error, "login"), true);

    } finally {
      setBusy(form, false);
      restoreText();
    }
  });

  // INSCRIPTION
  $("#register-form").addEventListener("submit", async e => {
    e.preventDefault();

    const form = e.currentTarget;

    hideNotice();
    setBusy(form, true);

    const restoreText = setSubmitText(
      form,
      "Création du compte…"
    );

    try {
      const { data, error } = await sb.auth.signUp({
        email: val(form, "email").trim(),
        password: val(form, "password"),
        options: {
          data: {
            full_name: val(form, "full_name"),
            phone: val(form, "phone")
          }
        }
      });

      if (error) throw error;

      if (data.session) {
        await initSession();
        showNotice("Compte créé avec succès. Votre espace est prêt.");
      } else {
        showNotice(
          "Compte créé. Vérifiez votre boîte e-mail pour confirmer votre inscription, puis connectez-vous."
        );
      }

    } catch (error) {
      showNotice(authErrorMessage(error, "register"), true);

    } finally {
      setBusy(form, false);
      restoreText();
    }
  });

  async function loadCandidate() {
    const { data, error } = await sb
      .from("candidate_cases")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    candidateCases = data || [];

    if (!candidateCases.length) {
      const created = await createCandidateCase("express_entry", "declaration_interest");
      candidateCases = [created];
    }
    if (!activeCaseId || !candidateCases.some(c => c.id === activeCaseId)) {
      activeCaseId = candidateCases[0].id;
    }
    renderCaseSelector();
    await loadActiveCase();
    await loadClientUpdates();
  }

  const programLabels = {
    express_entry: "Entrée express",
    arrima: "Arrima / Québec",
    study_permit: "Permis d'études",
    work_permit: "Permis de travail",
    visitor: "Visiteur",
    family_sponsorship: "Parrainage familial",
    other: "Autre"
  };

  const programKeysByLabel = Object.fromEntries(
    Object.entries(programLabels).map(([key, label]) => [label, key])
  );

  async function createCandidateCase(programKey, processStage) {
    const caseNumber = "CC-" + new Date().getFullYear() + "-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const { data, error } = await sb.from("candidate_cases").insert({
      user_id: currentUser.id,
      status: "À compléter",
      data: { program: programLabels[programKey] || programKey, process_stage: processStage },
      program_key: programKey,
      process_stage: processStage,
      case_number: caseNumber
    }).select("*").single();
    if (error) throw error;
    return data;
  }

  function renderCaseSelector() {
    const select = $("#active-case-select");
    select.innerHTML = "";
    candidateCases.forEach(c => {
      const option = document.createElement("option");
      option.value = c.id;
      option.textContent = (c.case_number || "Dossier") + " · " +
        (c.data?.program || c.program_key || "Procédure") + " · " + (c.status || "À compléter");
      select.append(option);
    });
    select.value = activeCaseId;
  }

  async function loadActiveCase() {
    const current = candidateCases.find(c => c.id === activeCaseId);
    if (!current) return;
    const form = $("#candidate-form");
    form.reset();
    if (current.data) Object.entries(current.data).forEach(([k, v]) => setVal(form, k, v));
    if (current.process_stage) setVal(form, "process_stage", current.process_stage);
    $("#case-status").textContent = current.status || "À compléter";
    applyConditionalFields();
    updateProgress();
    await loadDocuments();
  }

  $("#active-case-select").addEventListener("change", async e => {
    activeCaseId = e.target.value;
    try { await loadActiveCase(); }
    catch (error) { showNotice(error.message, true); }
  });

  $("#create-case").addEventListener("click", async () => {
    const button = $("#create-case");
    button.disabled = true;
    try {
      const created = await createCandidateCase($("#new-case-program").value, $("#new-case-stage").value);
      candidateCases.unshift(created);
      activeCaseId = created.id;
      renderCaseSelector();
      await loadActiveCase();
      showNotice("Nouveau dossier créé.");
    } catch (error) {
      showNotice("Création impossible : " + error.message, true);
    } finally { button.disabled = false; }
  });

  function readNamedValue(form, name) {
    const matches = [...form.elements].filter(control => control.name === name);
    const chosen = matches.find(control => String(control.value || "").trim() !== "") || matches[0];
    return chosen ? chosen.value : "";
  }

  function applyConditionalFields() {
    const form = $("#candidate-form");
    form.querySelectorAll("[data-reveal]").forEach(el => {
      const rule = el.dataset.reveal || "";
      const separator = rule.indexOf("=");
      if (separator < 1) return;
      const field = rule.slice(0, separator).trim();
      const expected = rule.slice(separator + 1).split("|").map(value => value.trim());
      const value = readNamedValue(form, field);
      const hidden = !expected.includes(value);
      el.classList.toggle("conditional-hidden", hidden);
      if (hidden) {
        el.querySelectorAll("input,select,textarea").forEach(control => {
          if (control.type === "checkbox" || control.type === "radio") control.checked = false;
          else control.value = "";
        });
      }
    });
  }

  $("#candidate-form").addEventListener("change", applyConditionalFields);


  function updateProgress() {
    const f = $("#candidate-form");

    const relevant = [...f.elements].filter(e => e.name && !e.closest(".conditional-hidden"));

    const filled = relevant.filter(e =>
      String(e.value || "").trim()
    ).length;

    const p = relevant.length
      ? Math.round(filled / relevant.length * 100)
      : 0;

    $("#progress-text").textContent = p + " %";
    $("#progress-bar").style.width = p + "%";
  }

  $("#candidate-form").addEventListener("input", () => { applyConditionalFields(); updateProgress(); });
  $("#candidate-form").addEventListener("change", () => { applyConditionalFields(); updateProgress(); });

  // ENREGISTREMENT DU PROFIL
  $("#candidate-form").addEventListener("submit", async e => {
    e.preventDefault();

    const form = e.currentTarget;

    hideNotice();
    setBusy(form, true);

    const restoreText = setSubmitText(
      form,
      "Enregistrement…"
    );

    try {
      const data = payload();

      if (!activeCaseId) throw new Error("Sélectionnez un dossier avant l’enregistrement.");
      const { data: saved, error } = await sb
        .from("candidate_cases")
        .update({
          data,
          program_key: programKeysByLabel[data.program] || data.program || null,
          process_stage: data.process_stage || "declaration_interest",
          updated_at: new Date().toISOString()
        })
        .eq("id", activeCaseId)
        .eq("user_id", currentUser.id)
        .select("*")
        .single();
      if (error) throw error;
      candidateCases = candidateCases.map(c => c.id === saved.id ? saved : c);
      renderCaseSelector();
      showNotice("Votre dossier a été enregistré.");

    } catch (error) {
      showNotice(error.message, true);

    } finally {
      setBusy(form, false);
      restoreText();
    }
  });

  // IMPRESSION DES RÉPONSES DU CANDIDAT
  $("#print-candidate-case").addEventListener("click", () => {
    const form = $("#candidate-form");
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showNotice("Autorisez les fenêtres surgissantes pour CanadaCase afin d'imprimer vos réponses.", true);
      return;
    }
    const stylesheet = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(link => '<link rel="stylesheet" href="' + link.href + '">').join("");
    printWindow.document.open();
    printWindow.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mes réponses CanadaCase</title>' + stylesheet + '<style>body{background:#fff;margin:0;padding:24px;color:#243b53;font:14px/1.5 system-ui}h1{color:#102a43;font-size:24px}h2{color:#1769aa;font-size:16px;margin:22px 0 8px}.print-row{border-bottom:1px solid #d9e2ec;padding:9px 0;break-inside:avoid}.print-label{font-size:11px;color:#627d98;font-weight:700}.print-value{white-space:pre-wrap;overflow-wrap:anywhere}@page{size:A4;margin:14mm}</style></head><body><h1>CanadaCase — Mes réponses</h1><p>Référence : ' + ($("#active-case-select").selectedOptions[0]?.textContent || "Dossier") + '</p><div id="print-content"></div></body></html>');
    const content = printWindow.document.getElementById("print-content");
    const sectionTitles = new Map();
    form.querySelectorAll(".section-title").forEach(section => {
      const heading = section.querySelector("h2")?.textContent?.trim();
      if (heading) sectionTitles.set(section, heading);
    });
    let lastSection = "";
    [...form.elements].filter(control => control.name && !control.closest(".conditional-hidden") && !["button","submit","file"].includes(control.type)).forEach(control => {
      const value = control.tagName === "SELECT"
        ? (control.value ? control.selectedOptions[0].textContent : "")
        : control.value;
      if (!String(value || "").trim()) return;
      const section = control.closest(".form-grid")?.previousElementSibling;
      const heading = section?.classList.contains("section-title") ? section.querySelector("h2")?.textContent?.trim() : "";
      if (heading && heading !== lastSection) {
        const h = printWindow.document.createElement("h2");
        h.textContent = heading;
        content.append(h);
        lastSection = heading;
      }
      const row = printWindow.document.createElement("div");
      row.className = "print-row";
      const label = printWindow.document.createElement("div");
      label.className = "print-label";
      label.textContent = control.closest("label")?.childNodes[0]?.textContent?.trim() || control.name;
      const answer = printWindow.document.createElement("div");
      answer.className = "print-value";
      answer.textContent = value;
      row.append(label, answer);
      content.append(row);
    });
    window.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 700);
  });

  // PRÉPARATION TCF / TEF — sujets d'entraînement et correction IA côté serveur
  const trainingPrompts = {
    "Expression écrite": [
      "Vous participez à un forum. Expliquez si le télétravail améliore réellement la qualité de vie et justifiez votre opinion avec des exemples.",
      "Vous écrivez à un ami pour lui présenter une ville que vous avez visitée récemment et lui conseiller des activités à faire.",
      "Certaines personnes pensent que les réseaux sociaux rapprochent les individus, d'autres qu'ils les isolent. Présentez votre point de vue avec des arguments.",
      "Vous répondez à une annonce pour participer à une activité bénévole. Présentez vos motivations et vos disponibilités."
    ],
    "Expression orale": [
      "Simulation : présentez-vous, décrivez votre parcours et expliquez pourquoi vous souhaitez étudier ou travailler à l'étranger.",
      "Simulation : vous souhaitez obtenir des renseignements sur une formation. Préparez les questions à poser à votre interlocuteur.",
      "Simulation : défendez votre opinion sur l'importance des transports publics dans les grandes villes."
    ],
    "Compréhension écrite": [
      "Lisez un court article sur la mobilité urbaine, puis résumez son idée principale, les arguments et le ton de l'auteur.",
      "Analysez une annonce de logement : relevez le prix, la localisation, les conditions et les informations manquantes."
    ],
    "Compréhension orale": [
      "Simulation textuelle : un collègue vous informe d'un changement d'horaire. Reformulez les nouvelles consignes et les conséquences.",
      "Simulation textuelle : vous écoutez une annonce de gare. Identifiez la destination, l'horaire, le retard et les consignes aux voyageurs."
    ]
  };
  async function loadPublishedLanguageExercises() {
    const { data, error } = await sb.from("language_exercises").select("*")
      .eq("is_published", true).eq("exam", $("#training-exam").value)
      .eq("skill", $("#training-skill").value).eq("level", $("#training-level").value);
    if (error) { showNotice("Chargement des exercices impossible : " + error.message, true); return; }
    publishedLanguageExercises = data || [];
    if (publishedLanguageExercises.length) await showLanguageExercise(publishedLanguageExercises[0]);
    else {
      $("#training-prompt").textContent = "Aucun exercice publié pour cette combinaison. Revenez bientôt ou choisissez une autre compétence / un autre niveau.";
      $("#training-media").innerHTML = ""; $("#training-media").classList.add("hidden");
    }
    await loadLanguageAttemptHistory();
  }

  async function showLanguageExercise(exercise) {
    $("#training-prompt").textContent = exercise.prompt;
    const media = $("#training-media"); media.innerHTML = ""; media.classList.add("hidden");
    if (exercise.image_path) {
      const { data, error } = await sb.storage.from("language-media").createSignedUrl(exercise.image_path, 3600);
      if (!error && data?.signedUrl) { const img=document.createElement("img"); img.src=data.signedUrl; img.alt="Illustration de l’exercice"; img.loading="lazy"; media.append(img); }
    }
    if (exercise.audio_path) {
      const { data, error } = await sb.storage.from("language-media").createSignedUrl(exercise.audio_path, 3600);
      if (!error && data?.signedUrl) { const audio=document.createElement("audio"); audio.controls=true; audio.preload="none"; audio.src=data.signedUrl; media.append(audio); }
    }
    if (media.children.length) media.classList.remove("hidden");
    $("#training-answer").value = ""; $("#training-feedback").classList.add("hidden");
  }

  ["training-exam","training-skill","training-level"].forEach(id => $("#"+id).addEventListener("change", loadPublishedLanguageExercises));
  $("#new-training-task").addEventListener("click", async () => {
    if (publishedLanguageExercises.length) {
      const current=$("#training-prompt").textContent;
      const choices=publishedLanguageExercises.filter(x=>x.prompt!==current);
      await showLanguageExercise(choices[Math.floor(Math.random()*choices.length)] || publishedLanguageExercises[0]);
      return;
    }
    const skill=$("#training-skill").value, prompts=trainingPrompts[skill]||trainingPrompts["Expression écrite"];
    const alternatives=prompts.filter(p=>p!==$("#training-prompt").textContent);
    $("#training-prompt").textContent=alternatives[Math.floor(Math.random()*alternatives.length)]||prompts[0];
    $("#training-media").innerHTML=""; $("#training-media").classList.add("hidden");
    $("#training-answer").value=""; $("#training-feedback").classList.add("hidden");
  });

  async function loadLanguageAttemptHistory() {
    const el=$("#language-attempt-history");
    const {data,error}=await sb.from("language_attempts").select("id,exam,skill,level,score,max_score,completed_at,duration_seconds").eq("user_id",currentUser.id).not("completed_at","is",null).order("completed_at",{ascending:false}).limit(10);
    if(error){el.textContent="Historique indisponible : "+error.message;return;}
    if(!data?.length){el.textContent="Aucun résultat enregistré pour le moment.";return;}
    el.innerHTML="";
    data.forEach(item=>{
      const row=document.createElement("div");row.className="attempt-row";
      const title=document.createElement("strong");title.textContent=item.exam+" · "+item.skill+" · "+item.level;
      const meta=document.createElement("span");meta.textContent=(item.score===null?"Production corrigée":Number(item.score)+"/"+Number(item.max_score))+" · "+new Date(item.completed_at).toLocaleString("fr-FR");
      row.append(title,meta);el.append(row);
    });
  }

  const examRules = {
    "TCF Canada": {"Compréhension orale":{count:39,minutes:35},"Compréhension écrite":{count:39,minutes:60},"Expression écrite":{count:3,minutes:60},"Expression orale":{count:3,minutes:12}},
    "TEF Canada": {"Compréhension orale":{count:40,minutes:40},"Compréhension écrite":{count:40,minutes:60},"Expression écrite":{count:2,minutes:60},"Expression orale":{count:2,minutes:15}}
  };

  function renderExamQuestion(question,index) {
    const card=document.createElement("article");card.className="exam-question";
    const title=document.createElement("h4");title.textContent=(index+1)+". "+question.question_text;
    card.append(title);
    question.options.forEach((option,optionIndex)=>{
      const label=document.createElement("label");label.className="exam-option";
      const input=document.createElement("input");input.type="radio";input.name="exam-q-"+question.id;input.value=String(optionIndex);
      const text=document.createElement("span");text.textContent=option;
      label.append(input,text);card.append(label);
    });
    return card;
  }

  async function startExamSession() {
    const exam=$("#training-exam").value,skill=$("#training-skill").value,level=$("#training-level").value;
    const rule=examRules[exam][skill];
    const {data:exercises,error}=await sb.from("language_exercises").select("id,prompt").eq("is_published",true).eq("exam",exam).eq("skill",skill).eq("level",level);
    if(error)throw error;
    if(!exercises?.length)throw new Error("Aucun exercice publié pour cette sélection. L'administrateur doit d'abord ajouter des sujets.");
    const ids=exercises.map(x=>x.id);
    let questions=[];
    if(skill==="Compréhension orale"||skill==="Compréhension écrite"){
      const {data,error:qErr}=await sb.from("language_exercise_questions").select("id,exercise_id,question_text,options,explanation,sort_order").in("exercise_id",ids).order("sort_order");
      if(qErr)throw qErr;
      questions=(qData=>qData||[])(data);
      if(!questions.length)throw new Error("Les exercices publiés ne contiennent pas encore de questions QCM.");
      questions=questions.sort(()=>Math.random()-.5).slice(0,rule.count);
    } else {
      questions=exercises.slice(0,rule.count).map(x=>({id:x.id,exercise_id:x.id,question_text:x.prompt,options:[],correct_option:null,explanation:null}));
    }
    activeExamQuestions=questions;
    examStartedAt=new Date();
    examDeadline=Date.now()+rule.minutes*60*1000;
    const questionIds=(skill==="Compréhension orale"||skill==="Compréhension écrite")?questions.map(q=>q.id):[];
    const {data:attempt,error:attemptError}=await sb.from("language_attempts").insert({user_id:currentUser.id,exam,skill,level,question_ids:questionIds,started_at:examStartedAt.toISOString(),answers:{}}).select("id").single();
    if(attemptError)throw attemptError;
    activeExamAttemptId=attempt.id;
    $("#exam-session-result").classList.add("hidden");
    $("#exam-session").classList.remove("hidden");
    $("#exam-session-label").textContent=exam+" · "+skill+" · "+questions.length+" question(s)";
    const list=$("#exam-question-list");list.innerHTML="";
    questions.forEach((q,i)=>list.append(renderExamQuestion(q,i)));
    if(skill==="Expression écrite"||skill==="Expression orale"){
      const prompt=questions.map((q,i)=>(i+1)+". "+q.question_text).join("\n\n");
      $("#exam-question-list").innerHTML="";
      const task=document.createElement("div");task.className="exam-question";
      const p=document.createElement("p");p.textContent=prompt;task.append(p);
      const area=document.createElement("textarea");area.id="exam-production-answer";area.rows=10;area.placeholder="Saisissez votre production ici…";task.append(area);
      if(skill==="Expression orale"){
        const note=document.createElement("p");note.className="muted small";note.textContent="Vous pouvez également enregistrer votre réponse avec le bouton du microphone ci-dessus, puis transcrire votre audio.";task.append(note);
      }
      $("#exam-question-list").append(task);
    }
    $("#start-exam-session").disabled=true;
    updateExamTimer();
    examTimerHandle=window.setInterval(updateExamTimer,1000);
  }

  function updateExamTimer() {
    if(!examDeadline)return;
    const remaining=Math.max(0,Math.ceil((examDeadline-Date.now())/1000));
    $("#exam-timer").textContent=String(Math.floor(remaining/60)).padStart(2,"0")+":"+String(remaining%60).padStart(2,"0");
    if(remaining===0)finishExamSession(true);
  }

  async function finishExamSession(timeExpired=false) {
    if(!activeExamAttemptId)return;
    if(examTimerHandle){clearInterval(examTimerHandle);examTimerHandle=null;}
    const answers={};let score=0,maxScore=0;
    const skill=$("#training-skill").value;
    if(skill==="Compréhension écrite"||skill==="Compréhension orale"){
      activeExamQuestions.forEach(q=>{
        const chosen=document.querySelector('input[name="exam-q-'+q.id+'"]:checked');
        const value=chosen?Number(chosen.value):null;
        answers[q.id]=value;
        maxScore++;
        if(value===q.correct_option)score++;
      });
    } else {
      answers.production=$("#exam-production-answer")?.value||"";
    }
    let feedback="";
    if(maxScore===0){
      const production=answers.production||"";
      if(!production.trim()){showNotice("Votre production est vide. Elle ne peut pas être enregistrée.",true);return;}
      try{
        const correction=await sb.functions.invoke("language-coach",{body:{
          exam:$("#training-exam").value,skill,level:$("#training-level").value,
          prompt:activeExamQuestions.map((q,i)=>(i+1)+". "+q.question_text).join("\\n\\n"),
          answer:production
        }});
        if(correction.error)throw correction.error;
        feedback=correction.data?.feedback||"";
      }catch(error){showNotice("Production enregistrée sans correction IA : "+error.message,true);}
    }
    const {data:graded,error}=await sb.functions.invoke("grade-language-attempt",{body:{
      attempt_id:activeExamAttemptId,answers,production_answer:answers.production||undefined,feedback
    }});
    if(error) {showNotice("Impossible d'enregistrer le résultat : "+error.message,true);return;}
    if(!graded?.score && graded?.score!==0 && !graded?.saved){showNotice(graded?.error||"Résultat non confirmé.",true);return;}
    $("#exam-session").classList.add("hidden");
    $("#start-exam-session").disabled=false;
    const result=$("#exam-session-result");result.classList.remove("hidden");result.innerHTML="";
    const title=document.createElement("strong");
    title.textContent=(timeExpired?"Temps écoulé. ":"Session terminée. ")+(maxScore?("Résultat : "+graded.score+"/"+graded.max_score):"Votre production est enregistrée.");
    result.append(title);
    if(maxScore){
      const detail=document.createElement("p");detail.textContent="Réponses correctes : "+graded.score+" · Réponses incorrectes ou non répondues : "+(graded.max_score-graded.score)+".";
      result.append(detail);
    } else if(feedback){
      const correction=document.createElement("div");correction.className="attempt-correction";correction.textContent=feedback;result.append(correction);
    }
    activeExamAttemptId=null;examDeadline=null;
    await loadLanguageAttemptHistory();
  }

  $("#start-exam-session").addEventListener("click",async()=>{
    const button=$("#start-exam-session");button.disabled=true;
    try{await startExamSession();}catch(error){button.disabled=false;showNotice(error.message,true);}
  });
  $("#finish-exam-session").addEventListener("click",()=>finishExamSession(false));

  async function uploadLanguageMedia(file) {
    if (!file) return null;
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-90);
    const path="exercises/"+crypto.randomUUID()+"-"+safeName;
    const {error}=await sb.storage.from("language-media").upload(path,file,{upsert:false,contentType:file.type});
    if(error) throw error;
    return path;
  }

  async function loadAdminLanguageExercises() {
    const {data,error}=await sb.from("language_exercises").select("id,exam,skill,level,prompt,is_published,image_path,audio_path,created_at").order("created_at",{ascending:false}).limit(100);
    if(error) throw error;
    const list=$("#language-exercises-admin"); list.innerHTML="";
    (data||[]).forEach(item=>{
      const row=document.createElement("div"); row.className="exercise-admin-row";
      const desc=document.createElement("div"), title=document.createElement("strong"), prompt=document.createElement("p"), meta=document.createElement("small");
      title.textContent=item.exam+" · "+item.skill+" · "+item.level; prompt.textContent=item.prompt;
      meta.textContent=(item.image_path?"Image · ":"")+(item.audio_path?"Audio · ":"")+(item.is_published?"Publié":"Brouillon");
      desc.append(title,prompt,meta);
      const toggle=document.createElement("button"); toggle.type="button"; toggle.className="secondary small-btn"; toggle.textContent=item.is_published?"Dépublier":"Publier";
      toggle.onclick=async()=>{const {error}=await sb.from("language_exercises").update({is_published:!item.is_published,updated_at:new Date().toISOString()}).eq("id",item.id);if(error){showNotice(error.message,true);return;}await loadAdminLanguageExercises();};
      row.append(desc,toggle);list.append(row);
    });
    if(!data?.length) list.textContent="Aucun exercice personnalisé pour le moment.";
  }

  $("#language-exercise-form").addEventListener("submit", async e=>{
    e.preventDefault(); const form=e.currentTarget, button=form.querySelector('button[type="submit"]');
    button.disabled=true;button.textContent="Enregistrement…";
    let imagePath=null,audioPath=null;
    try{
      const prompt=form.elements.prompt.value.trim(), imageFile=form.elements.image.files[0], audioFile=form.elements.audio.files[0];
      if(!prompt)throw new Error("La consigne est obligatoire.");
      if(imageFile&&(!["image/jpeg","image/png","image/webp"].includes(imageFile.type)||imageFile.size>8*1024*1024))throw new Error("Image invalide : JPG, PNG ou WebP, 8 Mo maximum.");
      if(audioFile&&(!["audio/mpeg","audio/mp4","audio/wav","audio/ogg","audio/webm"].includes(audioFile.type)||audioFile.size>20*1024*1024))throw new Error("Audio invalide ou supérieur à 20 Mo.");
      const questionsRaw=form.elements.questions_json.value.trim();
      let parsedQuestions=[];
      if(questionsRaw){
        parsedQuestions=JSON.parse(questionsRaw);
        if(!Array.isArray(parsedQuestions)||parsedQuestions.some(q=>!q.question||!Array.isArray(q.options)||q.options.length<2||!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.options.length))throw new Error("Le JSON des questions est invalide. Vérifiez question, options et correct.");
      }
      imagePath=await uploadLanguageMedia(imageFile);audioPath=await uploadLanguageMedia(audioFile);
      const {data:exercise,error}=await sb.from("language_exercises").insert({exam:form.elements.exam.value,skill:form.elements.skill.value,level:form.elements.level.value,prompt,image_path:imagePath,audio_path:audioPath,is_published:form.elements.publish.checked,created_by:currentUser.id}).select("id").single();
      if(error)throw error;
      if(parsedQuestions.length){
        const rows=parsedQuestions.map((q,index)=>({exercise_id:exercise.id,question_text:String(q.question).slice(0,1000),options:q.options.map(x=>String(x).slice(0,500)),explanation:q.explanation?String(q.explanation).slice(0,1500):null,sort_order:index+1}));
        const {data:insertedQuestions,error:qError}=await sb.from("language_exercise_questions").insert(rows).select("id");
        if(qError){await sb.from("language_exercises").delete().eq("id",exercise.id);throw qError;}
        const keys=insertedQuestions.map((q,index)=>({question_id:q.id,correct_option:parsedQuestions[index].correct}));
        const {error:keyError}=await sb.from("language_question_keys").insert(keys);
        if(keyError){await sb.from("language_exercises").delete().eq("id",exercise.id);throw keyError;}
      }
      form.reset();form.elements.publish.checked=true;showNotice("Exercice enregistré dans la bibliothèque.");await loadAdminLanguageExercises();
    }catch(error){
      if(imagePath)await sb.storage.from("language-media").remove([imagePath]);
      if(audioPath)await sb.storage.from("language-media").remove([audioPath]);
      showNotice("Enregistrement de l’exercice impossible : "+error.message,true);
    }finally{button.disabled=false;button.textContent="Enregistrer l’exercice";}
  });
  let lastRecordingBlob=null;
  $("#start-recording").addEventListener("click",async()=>{
    try{
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error("L'enregistrement audio n'est pas pris en charge par ce navigateur. Essayez Safari récent ou Chrome.");
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      recordingChunks=[];
      const mime=["audio/webm;codecs=opus","audio/mp4","audio/webm"].find(type=>MediaRecorder.isTypeSupported(type));
      mediaRecorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
      mediaRecorder.ondataavailable=e=>{if(e.data.size)recordingChunks.push(e.data);};
      mediaRecorder.onstop=()=>{
        lastRecordingBlob=new Blob(recordingChunks,{type:mediaRecorder.mimeType||"audio/webm"});
        $("#recording-preview").src=URL.createObjectURL(lastRecordingBlob);
        $("#recording-preview").classList.remove("hidden");
        stream.getTracks().forEach(track=>track.stop());
        $("#recording-status").textContent="Enregistrement prêt. Écoutez-le puis lancez la transcription.";
        $("#transcribe-recording").classList.remove("hidden");
      };
      mediaRecorder.start();
      $("#start-recording").classList.add("hidden");$("#stop-recording").classList.remove("hidden");
      $("#recording-status").textContent="Enregistrement en cours…";
    }catch(error){showNotice("Microphone indisponible : "+error.message,true);}
  });
  $("#stop-recording").addEventListener("click",()=>{
    if(mediaRecorder&&mediaRecorder.state!=="inactive")mediaRecorder.stop();
    $("#stop-recording").classList.add("hidden");$("#start-recording").classList.remove("hidden");
  });
  $("#transcribe-recording").addEventListener("click",async()=>{
    if(!lastRecordingBlob)return;
    const button=$("#transcribe-recording");button.disabled=true;button.textContent="Transcription…";
    let path=null;
    try{
      const ext=lastRecordingBlob.type.includes("mp4")?"m4a":"webm";
      path=currentUser.id+"/"+crypto.randomUUID()+"."+ext;
      const {error:uploadError}=await sb.storage.from("language-recordings").upload(path,lastRecordingBlob,{contentType:lastRecordingBlob.type,upsert:false});
      if(uploadError)throw uploadError;
      const {data,error}=await sb.functions.invoke("language-coach",{body:{action:"transcribe",file_path:path}});
      if(error)throw error;
      if(!data?.transcript)throw new Error(data?.error||"Transcription vide.");
      $("#training-answer").value=($("#training-answer").value.trim()+"\n"+data.transcript).trim();
      $("#recording-status").textContent="Transcription ajoutée à votre réponse. Vous pouvez demander une correction.";
    }catch(error){showNotice("Transcription impossible : "+error.message,true);}
    finally{if(path)await sb.storage.from("language-recordings").remove([path]);button.disabled=false;button.textContent="Transcrire l’enregistrement";}
  });

  $("#correct-training-answer").addEventListener("click", async () => {
    const answer = $("#training-answer").value.trim();
    if (!answer) { showNotice("Rédigez d'abord votre réponse avant de demander une correction.", true); return; }
    const button = $("#correct-training-answer");
    const feedback = $("#training-feedback");
    button.disabled = true;
    button.textContent = "Correction en cours…";
    feedback.classList.remove("hidden");
    feedback.textContent = "L'IA analyse votre réponse…";
    try {
      const { data, error } = await sb.functions.invoke("language-coach", {
        body: {
          exam: $("#training-exam").value,
          skill: $("#training-skill").value,
          level: $("#training-level").value,
          prompt: $("#training-prompt").textContent,
          answer
        }
      });
      if (error) throw error;
      if (!data?.feedback) throw new Error(data?.error || "La correction n'a pas pu être générée.");
      feedback.textContent = data.feedback;
    } catch (error) {
      feedback.textContent = error.message || "Service de correction momentanément indisponible.";
      showNotice("Correction IA indisponible : " + feedback.textContent, true);
    } finally {
      button.disabled = false;
      button.textContent = "Corriger avec l’IA";
    }
  });

  // TÉLÉVERSEMENT DES DOCUMENTS
  $("#upload-form").addEventListener("submit", async e => {
    e.preventDefault();

    const f = e.currentTarget;
    const fileObj = f.elements.file.files[0];

    if (!fileObj) {
      showNotice("Veuillez sélectionner un document.", true);
      return;
    }

    hideNotice();
    setBusy(f, true);

    const restoreText = setSubmitText(
      f,
      "Téléversement…"
    );

    try {
      if (fileObj.size > 10 * 1024 * 1024) {
        throw new Error(
          "Fichier trop volumineux : limite de 10 Mo."
        );
      }

      const ext = fileObj.name.split(".").pop().toLowerCase();

      if (!["pdf", "png", "jpg", "jpeg"].includes(ext)) {
        throw new Error("Format non accepté.");
      }

      const path =
        `${currentUser.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await sb.storage
        .from("case-documents")
        .upload(path, fileObj, {
          contentType: fileObj.type,
          upsert: false
        });

      if (upErr) throw upErr;

      const { error: dbErr } = await sb
        .from("case_documents")
        .insert({
          user_id: currentUser.id,
          category: val(f, "category"),
          file_name: fileObj.name,
          storage_path: path,
          mime_type: fileObj.type,
          size_bytes: fileObj.size,
          candidate_case_id: activeCaseId
        });

      if (dbErr) {
        await sb.storage
          .from("case-documents")
          .remove([path]);

        throw dbErr;
      }

      f.reset();

      showNotice("Document téléversé.");
      await loadDocuments();

    } catch (error) {
      showNotice(error.message, true);

    } finally {
      setBusy(f, false);
      restoreText();
    }
  });

  async function loadDocuments() {
    const { data, error } = await sb
      .from("case_documents")
      .select("id,category,file_name,size_bytes,status,created_at")
      .eq("user_id", currentUser.id)
      .or(`candidate_case_id.eq.${activeCaseId},candidate_case_id.is.null`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const el = $("#documents-list");
    el.innerHTML = "";

    if (!data.length) {
      el.textContent = "Aucun document déposé.";
      return;
    }

    data.forEach(d => {
      const row = document.createElement("div");
      row.className = "doc-row";

      const name = document.createElement("strong");
      name.textContent = d.file_name;

      const meta = document.createElement("span");
      meta.textContent =
        `${d.category} · ${Math.ceil(d.size_bytes / 1024)} Ko · ${d.status}`;

      row.append(name, meta);
      el.append(row);
    });
  }

  async function loadClientUpdates() {
    const { data, error } = await sb
      .from("case_updates")
      .select("message,created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const el = $("#client-updates");
    el.innerHTML = "";

    if (!data.length) {
      el.textContent = "Aucune mise à jour pour le moment.";
      return;
    }

    data.forEach(u => {
      const p = document.createElement("p");

      p.textContent =
        new Date(u.created_at).toLocaleString("fr-FR") +
        " — " + u.message;

      el.append(p);
    });
  }

  async function loadAdmin() {
    await loadAdminLanguageExercises();
    const [
      { data: profiles, error: pErr },
      { data: cases, error: cErr },
      { data: docs, error: dErr }
    ] = await Promise.all([
      sb.from("profiles").select("id,full_name,email,created_at,is_active").order("created_at", { ascending: false }),
      sb.from("candidate_cases").select("id,user_id,case_number,program_key,process_stage,status,data,updated_at").order("updated_at", { ascending: false }),
      sb.from("case_documents").select("id,user_id,status")
    ]);
    if (pErr) throw pErr;
    if (cErr) throw cErr;
    if (dErr) throw dErr;
    const clients = profiles.filter(p => p.id !== currentUser.id);
    $("#stat-total").textContent = cases.filter(c => clients.some(p => p.id === c.user_id)).length;
    $("#stat-review").textContent = cases.filter(c => c.status === "À examiner" || c.status === "Documents manquants").length;
    $("#stat-docs").textContent = docs.length;
    const tbody = $("#clients-table");
    tbody.innerHTML = "";
    cases.filter(c => clients.some(p => p.id === c.user_id)).forEach(c => {
      const p = profiles.find(x => x.id === c.user_id);
      const tr = document.createElement("tr");
      const cells = [
        p?.full_name || "Client", p?.email || "",
        c.data?.program || c.program_key || "—",
        c.case_number || "Dossier", c.status || "À compléter",
        c.updated_at ? new Date(c.updated_at).toLocaleDateString("fr-FR") : "—"
      ];
      cells.forEach(t => { const td = document.createElement("td"); td.textContent = t; tr.append(td); });
      const accountCell = document.createElement("td");
      accountCell.textContent = p?.is_active === false ? "Désactivé" : "Actif";
      const actionsCell = document.createElement("td");
      const openButton = document.createElement("button");
      openButton.className = "secondary small-btn";
      openButton.textContent = "Ouvrir";
      openButton.onclick = () => openCase(p, c);
      actionsCell.append(openButton);
      const toggleButton = document.createElement("button");
      toggleButton.className = "ghost small-btn";
      toggleButton.textContent = p?.is_active === false ? "Réactiver" : "Désactiver";
      toggleButton.onclick = async () => {
        const action = p?.is_active === false ? "enable" : "disable";
        const verb = action === "enable" ? "réactiver" : "désactiver";
        if (!window.confirm("Confirmer la demande pour " + (p?.full_name || p?.email || "ce compte") + " ?")) return;
        toggleButton.disabled = true;
        try {
          const { data, error } = await sb.functions.invoke("admin-user-management", {
            body: { action, user_id: p.id }
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "Action non exécutée.");
          showNotice("Compte " + (action === "enable" ? "réactivé" : "désactivé") + ".");
          await loadAdmin();
        } catch (error) {
          showNotice("Impossible de " + verb + " le compte : " + error.message, true);
          toggleButton.disabled = false;
        }
      };
      const deleteButton = document.createElement("button");
      deleteButton.className = "ghost small-btn danger-btn";
      deleteButton.textContent = "Supprimer";
      deleteButton.onclick = async () => {
        const first = window.confirm("ATTENTION : cette suppression effacera le compte, ses dossiers, ses messages et les documents associés. Cette action est irréversible. Continuer ?");
        if (!first) return;
        const confirmation = window.prompt("Pour confirmer, saisissez exactement : SUPPRIMER DÉFINITIVEMENT");
        if (confirmation !== "SUPPRIMER DÉFINITIVEMENT") {
          showNotice("Suppression annulée : confirmation incorrecte.", true);
          return;
        }
        deleteButton.disabled = true;
        try {
          const { data, error } = await sb.functions.invoke("admin-user-management", {
            body: { action: "delete", user_id: p.id, confirmation }
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "Suppression non exécutée.");
          showNotice(data.storage_warning || "Compte et données associées supprimés.");
          await loadAdmin();
        } catch (error) {
          showNotice("Suppression impossible : " + error.message, true);
          deleteButton.disabled = false;
        }
      };
      actionsCell.append(toggleButton, deleteButton);
      tr.append(accountCell, actionsCell);
      tbody.append(tr);
    });
  }

  const adminFieldLabels = {
    last_name: "Nom de famille", first_names: "Prénoms", birth_date: "Date de naissance",
    nationality: "Nationalité", city: "Ville de résidence", country: "Pays de résidence",
    phone: "Téléphone", marital_status: "État matrimonial",
    spouse_accompanying: "Conjoint accompagnant", spouse_full_name: "Nom complet du conjoint",
    spouse_birth_date: "Date de naissance du conjoint", spouse_nationality: "Nationalité du conjoint",
    spouse_country: "Pays de résidence du conjoint", spouse_occupation: "Profession du conjoint",
    has_children: "Avez-vous des enfants ?", children_count: "Nombre d'enfants",
    children_details: "Informations sur les enfants", family_notes: "Informations complémentaires sur la famille",
    education_level: "Niveau d'études", degree: "Diplôme obtenu", institution: "Établissement",
    graduation_year: "Année d'obtention", ede_done: "Évaluation des diplômes (EDE) effectuée",
    ede_organization: "Organisme EDE", ede_reference: "Référence EDE", ede_expiry: "Expiration de l'EDE",
    employer: "Employeur", job_title: "Intitulé du poste", job_start: "Date de début",
    job_end: "Date de fin", hours_week: "Heures par semaine", contract_type: "Type de contrat",
    job_duties: "Tâches et responsabilités", noc_code: "Code CNP envisagé",
    french_test_taken: "Test de français passé", french_test: "Test de français",
    french_date: "Date du test de français", french_listening: "Compréhension orale (français)",
    french_speaking: "Expression orale (français)", french_reading: "Compréhension écrite (français)",
    french_writing: "Expression écrite (français)", english_test_taken: "Test d'anglais passé",
    english_test: "Test d'anglais", english_date: "Date du test d'anglais",
    passport_number: "Numéro de passeport", passport_country: "Pays émetteur",
    passport_issue: "Date de délivrance", passport_expiry: "Date d'expiration",
    program: "Programme d'immigration", process_stage: "Étape de la procédure",
    ita_received: "Invitation à présenter une demande (ITA) reçue", ita_date: "Date de l'ITA",
    submission_deadline: "Date limite de soumission", funds_cad: "Fonds disponibles (CAD)",
    funds_origin: "Origine et historique des fonds", job_offer_yes: "Offre d'emploi au Canada",
    job_offer_details: "Détails de l'offre d'emploi", canada_history_yes: "Expérience au Canada",
    canada_history_details: "Détails de l'expérience au Canada", prior_application_yes: "Demandes antérieures de visa ou permis",
    prior_application_details: "Détails des demandes antérieures", prior_refusal_yes: "Refus antérieur",
    prior_refusal_details: "Détails des refus", criminal_history_yes: "Antécédents judiciaires déclarés",
    criminal_history_details: "Détails des antécédents judiciaires", medical_history_yes: "Problème médical déclaré",
    medical_history_details: "Précisions médicales", travel_history_yes: "Voyages des 10 dernières années",
    travel_history_details: "Détails des voyages", asylum_history_yes: "Demande d'asile ou de protection antérieure",
    asylum_history_details: "Détails de la demande d'asile", passport_issue_place: "Lieu de délivrance du passeport"
  };

  const adminFieldSections = [
    { title: "Identité et coordonnées", keys: ["last_name","first_names","birth_date","nationality","city","country","phone","marital_status"] },
    { title: "Situation familiale", keys: ["spouse_accompanying","spouse_full_name","spouse_birth_date","spouse_nationality","spouse_country","spouse_occupation","has_children","children_count","children_details","family_notes"] },
    { title: "Études et équivalence des diplômes", keys: ["education_level","degree","institution","graduation_year","ede_done","ede_organization","ede_reference","ede_expiry"] },
    { title: "Expérience professionnelle", keys: ["employer","job_title","job_start","job_end","hours_week","contract_type","job_duties","noc_code"] },
    { title: "Tests linguistiques", keys: ["french_test_taken","french_test","french_date","french_listening","french_speaking","french_reading","french_writing","english_test_taken","english_test","english_date"] },
    { title: "Passeport", keys: ["passport_number","passport_country","passport_issue","passport_expiry"] },
    { title: "Procédure d'immigration et fonds", keys: ["program","process_stage","ita_received","ita_date","submission_deadline","funds_cad","funds_origin"] },
    { title: "Questions complémentaires", keys: ["job_offer_yes","job_offer_details","canada_history_yes","canada_history_details","prior_application_yes","prior_application_details","prior_refusal_yes","prior_refusal_details","criminal_history_yes","criminal_history_details","medical_history_yes","medical_history_details","travel_history_yes","travel_history_details","asylum_history_yes","asylum_history_details"] }
  ];

  function adminDisplayValue(key, value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "boolean") return value ? "Oui" : "Non";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    const textValue = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(textValue)) {
      const [y,m,d] = textValue.split("-");
      return new Date(Number(y), Number(m)-1, Number(d)).toLocaleDateString("fr-FR");
    }
    if (textValue === "yes") return "Oui";
    if (textValue === "no") return "Non";
    if (textValue === "pending") return "En cours";
    return textValue;
  }

  function appendAdminField(container, key, value) {
    if (value === null || value === undefined || value === "") return;
    const item = document.createElement("div");
    item.className = "admin-answer";
    const label = document.createElement("strong");
    label.textContent = adminFieldLabels[key] || key.replace(/_/g, " ").replace(/^./, x => x.toUpperCase());
    const answer = document.createElement("div");
    answer.textContent = adminDisplayValue(key, value);
    item.append(label, answer);
    container.append(item);
  }

  async function openCase(p, c) {
    const box = $("#admin-detail");
    box.classList.remove("hidden");
    box.innerHTML = "";

    const toolbar = document.createElement("div");
    toolbar.className = "admin-detail-toolbar no-print";
    const printButton = document.createElement("button");
    printButton.type = "button";
    printButton.className = "primary";
    printButton.textContent = "Imprimer / Enregistrer en PDF";
    printButton.onclick = () => {
      // Ouvrir une page d'impression dédiée : plus fiable que window.print()
      // directement dans la vue administrateur, notamment sur iPhone/Safari.
      const printable = box.cloneNode(true);
      printable.id = "admin-detail";
      printable.classList.remove("hidden");
      printable.querySelectorAll(".no-print").forEach(el => el.remove());
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        showNotice("Le navigateur a bloqué la fenêtre d'impression. Autorisez les fenêtres surgissantes pour CanadaCase, puis réessayez.", true);
        return;
      }
      const stylesheet = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(link => '<link rel="stylesheet" href="' + link.href + '">').join("");
      printWindow.document.open();
      printWindow.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fiche candidat - CanadaCase</title>' + stylesheet + '<style>body{background:#fff!important;margin:0;padding:18px}#admin-detail{display:block!important;max-width:100%!important;margin:0!important}.admin-detail-toolbar,.no-print{display:none!important}@media print{body{padding:0}}</style></head><body></body></html>');
      printWindow.document.close();
      printWindow.document.body.appendChild(printWindow.document.importNode(printable, true));
      printWindow.onload = () => {
        printWindow.focus();
        window.setTimeout(() => {
          try { printWindow.print(); }
          catch (error) { printWindow.alert("Utilisez le menu Partager de votre navigateur, puis Imprimer ou Enregistrer en PDF."); }
        }, 500);
      };
    };
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "ghost";
    closeButton.textContent = "Fermer la fiche";
    closeButton.onclick = () => box.classList.add("hidden");
    toolbar.append(printButton, closeButton);

    const printHeader = document.createElement("div");
    printHeader.className = "admin-print-header";
    const brand = document.createElement("div");
    brand.className = "admin-print-brand";
    brand.textContent = "CANADACASE";
    const title = document.createElement("h2");
    title.textContent = "Fiche de renseignements du candidat";
    const subtitle = document.createElement("p");
    subtitle.textContent = "Document de consultation administrative — données déclarées par le candidat";
    printHeader.append(brand, title, subtitle);

    const identity = document.createElement("div");
    identity.className = "admin-case-summary";
    const name = document.createElement("h2");
    name.textContent = [c.data?.first_names, c.data?.last_name].filter(Boolean).join(" ") || p.full_name || p.email || "Candidat";
    const meta = document.createElement("p");
    meta.textContent = [
      "Référence : " + (c.case_number || "Non attribuée"),
      "Programme : " + (c.data?.program || c.program_key || "Non renseigné"),
      "Statut : " + (c.status || "À compléter"),
      "E-mail : " + (p.email || "Non renseigné")
    ].join(" · ");
    identity.append(name, meta);

    const statusPanel = document.createElement("div");
    statusPanel.className = "admin-status-panel no-print";
    const statusLabel = document.createElement("label");
    statusLabel.textContent = "Statut du dossier";
    const status = document.createElement("select");
    ["À compléter","À examiner","Documents manquants","En traitement","Soumis","Clôturé"].forEach(x => {
      const o = document.createElement("option");
      o.textContent = x;
      o.value = x;
      status.append(o);
    });
    status.value = c.status || "À compléter";
    statusLabel.append(status);
    const save = document.createElement("button");
    save.className = "primary";
    save.textContent = "Mettre à jour le statut";
    save.onclick = async () => {
      save.disabled = true;
      save.textContent = "Mise à jour…";
      try {
        const { error } = await sb.rpc("admin_set_case_status_for_case", {
          target_case: c.id,
          new_status: status.value
        });
        if (error) throw error;
        c.status = status.value;
        showNotice("Statut mis à jour.");
        await loadAdmin();
      } catch (error) {
        showNotice(error.message, true);
      } finally {
        save.disabled = false;
        save.textContent = "Mettre à jour le statut";
      }
    };
    statusPanel.append(statusLabel, save);

    const data = c.data || {};
    const used = new Set();
    const answers = document.createElement("div");
    answers.className = "admin-answer-sections";
    let visibleCount = 0;
    adminFieldSections.forEach(section => {
      const sectionBox = document.createElement("section");
      sectionBox.className = "admin-answer-section";
      const heading = document.createElement("h3");
      heading.textContent = section.title;
      const grid = document.createElement("div");
      grid.className = "admin-answer-grid";
      section.keys.forEach(key => {
        used.add(key);
        if (data[key] !== undefined && data[key] !== null && data[key] !== "") {
          appendAdminField(grid, key, data[key]);
          visibleCount++;
        }
      });
      if (grid.children.length) {
        sectionBox.append(heading, grid);
        answers.append(sectionBox);
      }
    });

    const otherKeys = Object.keys(data).filter(key => !used.has(key) && data[key] !== "" && data[key] !== null && data[key] !== undefined);
    if (otherKeys.length) {
      const sectionBox = document.createElement("section");
      sectionBox.className = "admin-answer-section";
      const heading = document.createElement("h3");
      heading.textContent = "Autres renseignements";
      const grid = document.createElement("div");
      grid.className = "admin-answer-grid";
      otherKeys.forEach(key => appendAdminField(grid, key, data[key]));
      sectionBox.append(heading, grid);
      answers.append(sectionBox);
      visibleCount += otherKeys.length;
    }
    if (!visibleCount) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Aucune réponse n'a encore été enregistrée dans ce dossier.";
      answers.append(empty);
    }

    const docsSection = document.createElement("section");
    docsSection.className = "admin-answer-section";
    const docsTitle = document.createElement("h3");
    docsTitle.textContent = "Documents déposés";
    const docsList = document.createElement("div");
    docsList.className = "admin-documents-list";
    docsList.textContent = "Chargement des documents…";
    docsSection.append(docsTitle, docsList);

    const notePanel = document.createElement("section");
    notePanel.className = "admin-note-panel no-print";
    const noteTitle = document.createElement("h3");
    noteTitle.textContent = "Communication avec le candidat";
    const note = document.createElement("textarea");
    note.placeholder = "Message visible par le client…";
    note.rows = 3;
    const send = document.createElement("button");
    send.className = "secondary";
    send.textContent = "Envoyer une mise à jour";
    send.onclick = async () => {
      if (!note.value.trim()) return;
      send.disabled = true;
      send.textContent = "Envoi…";
      try {
        const { error } = await sb.from("case_updates").insert({
          user_id: p.id,
          message: "[" + (c.case_number || "Dossier") + "] " + note.value.trim()
        });
        if (error) throw error;
        note.value = "";
        showNotice("Mise à jour envoyée au client.");
      } catch (error) {
        showNotice(error.message, true);
      } finally {
        send.disabled = false;
        send.textContent = "Envoyer une mise à jour";
      }
    };
    notePanel.append(noteTitle, note, send);

    const printFooter = document.createElement("div");
    printFooter.className = "admin-print-footer";
    printFooter.textContent = "CanadaCase · Fiche générée le " + new Date().toLocaleString("fr-FR") + " · Informations déclaratives à vérifier avec les pièces justificatives.";

    box.append(toolbar, printHeader, identity, statusPanel, answers, docsSection, notePanel, printFooter);
    box.scrollIntoView({ behavior: "smooth" });

    try {
      const { data: docs, error } = await sb.from("case_documents")
        .select("id,category,file_name,storage_path,size_bytes,status,created_at,candidate_case_id")
        .eq("user_id", p.id)
        .or("candidate_case_id.eq." + c.id + ",candidate_case_id.is.null")
        .order("created_at", { ascending: false });
      if (error) throw error;
      docsList.innerHTML = "";
      if (!docs?.length) {
        docsList.textContent = "Aucun document déposé pour ce dossier.";
      } else {
        for (const doc of docs) {
          const row = document.createElement("div");
          row.className = "admin-doc-row";
          const details = document.createElement("div");
          const docName = document.createElement("strong");
          docName.textContent = doc.file_name || "Document sans nom";
          const docMeta = document.createElement("span");
          docMeta.textContent = (doc.category || "Catégorie non précisée") + " · " +
            (doc.status || "À vérifier") + " · " +
            (doc.created_at ? new Date(doc.created_at).toLocaleDateString("fr-FR") : "Date inconnue");
          details.append(docName, docMeta);
          row.append(details);
          if (doc.storage_path) {
            const { data: signed, error: signError } = await sb.storage.from("case-documents").createSignedUrl(doc.storage_path, 300);
            if (!signError && signed?.signedUrl) {
              const link = document.createElement("a");
              link.href = signed.signedUrl;
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              link.textContent = "Consulter";
              link.className = "no-print";
              row.append(link);
            }
          }
          docsList.append(row);
        }
      }
    } catch (error) {
      docsList.textContent = "Impossible de charger les documents : " + error.message;
    }
  }

  // CHANGEMENT DU MOT DE PASSE — candidat et administrateur
  function attachPasswordControls(formSelector, codeButtonSelector) {
    const form = $(formSelector);
    const codeButton = $(codeButtonSelector);

    codeButton.addEventListener("click", async () => {
      codeButton.disabled = true;
      try {
        const { error } = await sb.auth.reauthenticate();
        if (error) throw error;
        showNotice("Code de vérification envoyé à l’adresse e-mail ou au téléphone confirmé de votre compte. Saisissez-le avant de valider le nouveau mot de passe.");
      } catch (error) {
        showNotice(authErrorMessage(error, "password") + " Vérifiez aussi que votre adresse e-mail est confirmée.", true);
      } finally { codeButton.disabled = false; }
    });

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const current = val(form, "current_password");
      const next = val(form, "new_password");
      if (next !== val(form, "confirm_password")) {
        showNotice("Les deux nouveaux mots de passe ne correspondent pas.", true);
        return;
      }
      if (next.length < 8) {
        showNotice("Le mot de passe doit contenir au moins 8 caractères.", true);
        return;
      }
      if (next === current) {
        showNotice("Le nouveau mot de passe doit être différent du mot de passe actuel.", true);
        return;
      }
      setBusy(form, true);
      try {
        const attributes = { password: next, current_password: current };
        const nonce = val(form, "password_nonce").trim();
        if (nonce) attributes.nonce = nonce;
        const { error } = await sb.auth.updateUser(attributes);
        if (error) throw error;
        form.reset();
        showNotice("Mot de passe modifié avec succès.");
      } catch (error) {
        const message = String(error?.message || "").toLowerCase();
        if (message.includes("reauthentication") || message.includes("nonce")) {
          showNotice("Une vérification supplémentaire est nécessaire. Cliquez sur « Envoyer un code de vérification », puis saisissez le code reçu.", true);
        } else {
          showNotice(authErrorMessage(error, "password"), true);
        }
      } finally { setBusy(form, false); }
    });
  }

  attachPasswordControls("#password-form", "#send-reauth-code");
  attachPasswordControls("#password-form-admin", "#send-reauth-code-admin");

  // VÉRIFICATION DE LA CONFIGURATION
  if (!configured) {
    showNotice(
      "Configuration requise : ouvrez assets/config.js et renseignez l'URL et la clé publique de votre projet Supabase. Aucune donnée n'est envoyée tant que cette étape n'est pas faite.",
      true
    );

    showOnly(authView);
    return;
  }

  // INITIALISATION SUPABASE
  sb = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  initSession().catch(error => {
    showNotice(
      "Impossible de charger votre espace : " +
      (error.message || "une erreur est survenue."),
      true
    );

    showOnly(authView);
  });

})();
