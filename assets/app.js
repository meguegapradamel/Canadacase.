
(() => {
  const cfg = window.CANADACASE_CONFIG || {};

  const configured =
    cfg.SUPABASE_URL?.startsWith("https://") &&
    !cfg.SUPABASE_URL.includes("VOTRE-") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("VOTRE_");

  const $ = s => document.querySelector(s);

  const authView = $("#auth-view");
  const candidateView = $("#candidate-view");
  const adminView = $("#admin-view");

  let sb = null;
  let currentUser = null;
  let profile = null;
  let candidateCases = [];
  let activeCaseId = null;

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
    [authView, candidateView, adminView].forEach(v =>
      v.classList.add("hidden")
    );

    view.classList.remove("hidden");
  }

  async function loadProfile() {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (error) throw error;

    profile = data;
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
      showOnly(authView);
      return;
    }

    currentUser = session.user;

    await loadProfile();
    logoutButton();

    if (profile.role === "admin") {
      showOnly(adminView);
      await loadAdmin();
    } else {
      showOnly(candidateView);
      await loadCandidate();
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

  async function createCandidateCase(programKey, processStage) {
    const caseNumber = "CC-" + new Date().getFullYear() + "-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const { data, error } = await sb.from("candidate_cases").insert({
      user_id: currentUser.id,
      status: "À compléter",
      data: { program: programKey, process_stage: processStage },
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

  function applyConditionalFields() {
    document.querySelectorAll("[data-reveal]").forEach(el => {
      const [field, expected] = el.dataset.reveal.split("=");
      const value = $("#candidate-form").elements[field]?.value || "";
      el.classList.toggle("conditional-hidden", value !== expected);
    });
  }

  $("#candidate-form").addEventListener("change", applyConditionalFields);


  function updateProgress() {
    const f = $("#candidate-form");

    const relevant = [...f.elements].filter(e => e.name);

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
          program_key: data.program || null,
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
    const [
      { data: profiles, error: pErr },
      { data: cases, error: cErr },
      { data: docs, error: dErr }
    ] = await Promise.all([
      sb.from("profiles").select("id,full_name,email,created_at").order("created_at", { ascending: false }),
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
      const td = document.createElement("td");
      const b = document.createElement("button");
      b.className = "secondary small-btn";
      b.textContent = "Ouvrir";
      b.onclick = () => openCase(p, c);
      td.append(b); tr.append(td); tbody.append(tr);
    });
  }

  async function openCase(p, c) {
    const box = $("#admin-detail");

    box.classList.remove("hidden");
    box.innerHTML = "";

    const h = document.createElement("h2");
    h.textContent = "Dossier " + (c?.case_number || "") + " — " + (p.full_name || p.email);

    box.append(h);

    const status = document.createElement("select");

    [
      "À compléter",
      "À examiner",
      "Documents manquants",
      "En traitement",
      "Soumis",
      "Clôturé"
    ].forEach(x => {
      const o = document.createElement("option");
      o.textContent = x;
      o.value = x;
      status.append(o);
    });

    status.value = c?.status || "À compléter";

    const save = document.createElement("button");
    save.className = "primary";
    save.textContent = "Mettre à jour le statut";

    save.onclick = async () => {
      save.disabled = true;
      save.textContent = "Mise à jour…";

      try {
        const { error } = await sb.rpc(
          "admin_set_case_status_for_case",
          {
            target_case: c.id,
            new_status: status.value
          }
        );

        if (error) throw error;

        showNotice("Statut mis à jour.");
        await loadAdmin();

      } catch (error) {
        showNotice(error.message, true);

      } finally {
        save.disabled = false;
        save.textContent = "Mettre à jour le statut";
      }
    };

    const pre = document.createElement("pre");
    pre.className = "data-preview";
    pre.textContent = JSON.stringify(c?.data || {}, null, 2);

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
        const { error } = await sb
          .from("case_updates")
          .insert({
            user_id: p.id,
            message: note.value.trim()
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

    box.append(
      document.createElement("hr"),
      document.createTextNode("Statut : "),
      status,
      save,
      document.createElement("h3"),
      pre,
      note,
      send
    );

    box.scrollIntoView({ behavior: "smooth" });
  }

  // CHANGEMENT DU MOT DE PASSE
  $("#password-form").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const next = val(form, "new_password");
    if (next !== val(form, "confirm_password")) {
      showNotice("Les deux mots de passe ne correspondent pas.", true);
      return;
    }
    if (next.length < 8) {
      showNotice("Le mot de passe doit contenir au moins 8 caractères.", true);
      return;
    }
    setBusy(form, true);
    try {
      const { error } = await sb.auth.updateUser({ password: next });
      if (error) throw error;
      form.reset();
      showNotice("Mot de passe modifié avec succès.");
    } catch (error) {
      showNotice(authErrorMessage(error, "password"), true);
    } finally { setBusy(form, false); }
  });

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
