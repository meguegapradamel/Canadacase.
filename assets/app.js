
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
  let candidateDocumentsCache = [];
  let activeWorkspace = sessionStorage.getItem("cc_workspace") || "";
  let activeAdminWorkspace = sessionStorage.getItem("cc_admin_workspace") || "";
  let publishedLanguageExercises = [];
  let practiceQuestionAttemptId = null;
  let practiceQuestionStartedAt = null;
  let activeExamQuestions = [];
  let activeExamAttemptId = null;
  let examStartedAt = null;
  let examDeadline = null;
  let examTimerHandle = null;
  let mediaRecorder = null;
  let recordingChunks = [];
  let profileMenuCloseHandler = null;

  const showNotice = (msg, bad = false) => {
    const n = $("#notice");
    n.textContent = msg;
    n.className = "notice " + (bad ? "error" : "");
    n.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hideNotice = () => $("#notice").classList.add("hidden");

  const functionErrorMessage = async error => {
    const fallback = error?.message || "Service momentanément indisponible.";
    const response = error?.context;
    if (response && typeof response.clone === "function") {
      try {
        const payload = await response.clone().json();
        if (payload?.error) return String(payload.error);
        if (payload?.message) return String(payload.message);
      } catch (_) {}
    }
    return fallback;
  };

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

  const isEmailConfirmed = user => Boolean(user?.email_confirmed_at || user?.confirmed_at);

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

  // Afficher ou masquer les mots de passe à la demande.
  document.querySelectorAll("[data-toggle-password]").forEach(button => {
    button.addEventListener("click", () => {
      const form = button.closest("form");
      const fieldName = button.dataset.togglePassword;
      const field = fieldName === "login-password"
        ? form?.elements.password
        : form?.elements[fieldName];
      if (!field) return;
      const reveal = field.type === "password";
      field.type = reveal ? "text" : "password";
      button.textContent = reveal ? "◎" : "◉";
      button.setAttribute("aria-label", reveal ? "Masquer le mot de passe" : "Afficher le mot de passe");
      button.setAttribute("aria-pressed", reveal ? "true" : "false");
    });
  });

  // MOT DE PASSE OUBLIÉ / RÉINITIALISATION
  const forgotPasswordForm = $("#forgot-password-form");
  const recoveryPasswordForm = $("#recovery-password-form");

  function showAuthForm(which) {
    ["login-form","register-form","forgot-password-form","recovery-password-form"].forEach(id => {
      const form = $("#"+id);
      if (form) form.classList.toggle("hidden", id !== which);
    });
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === "login" && which === "login-form"));
  }

  $("#forgot-password-link")?.addEventListener("click", () => {
    hideNotice();
    showAuthForm("forgot-password-form");
    forgotPasswordForm?.elements.email?.focus();
  });

  $("#back-to-login")?.addEventListener("click", () => {
    hideNotice();
    showAuthForm("login-form");
  });

  forgotPasswordForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const email = val(forgotPasswordForm, "email").trim();
    if (!email) return;
    setBusy(forgotPasswordForm, true);
    const restoreText = setSubmitText(forgotPasswordForm, "Envoi en cours…");
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        // Le paramètre permet à l'application de distinguer clairement
        // le retour d'un lien de récupération d'une simple visite du site.
        redirectTo: window.location.origin + "/?reset-password=1"
      });
      if (error) throw error;
      forgotPasswordForm.reset();
      showNotice("Si cette adresse possède un compte CanadaCase, un lien de réinitialisation vient d’être envoyé. Vérifiez aussi vos courriers indésirables.");
    } catch (error) {
      showNotice("Impossible d’envoyer le lien : " + (error.message || "veuillez réessayer."), true);
    } finally {
      setBusy(forgotPasswordForm, false);
      restoreText();
    }
  });

  recoveryPasswordForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const password = val(recoveryPasswordForm, "password");
    const confirmation = val(recoveryPasswordForm, "password_confirm");
    if (password.length < 8) {
      showNotice("Le mot de passe doit contenir au moins 8 caractères.", true);
      return;
    }
    if (password !== confirmation) {
      showNotice("Les deux mots de passe ne correspondent pas.", true);
      return;
    }
    setBusy(recoveryPasswordForm, true);
    const restoreText = setSubmitText(recoveryPasswordForm, "Enregistrement…");
    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      recoveryPasswordForm.reset();
      showAuthForm("login-form");
      showNotice("Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.");
      window.history.replaceState({}, document.title, window.location.pathname);
      await sb.auth.signOut();
    } catch (error) {
      showNotice("Réinitialisation impossible : " + (error.message || "le lien peut avoir expiré. Demandez un nouveau lien."), true);
    } finally {
      setBusy(recoveryPasswordForm, false);
      restoreText();
    }
  });

  function logoutButton() {
    const fullName = String(profile?.full_name || currentUser?.email || "Utilisateur").trim();
    const initials = fullName.split(/\\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "U";
    $("#userbar").innerHTML =
      '<div class="profile-menu-wrap">' +
        '<button type="button" class="profile-avatar" id="profile-avatar" aria-label="Ouvrir le menu du compte" aria-expanded="false">' + initials + '</button>' +
        '<div class="profile-dropdown hidden" id="profile-dropdown">' +
          '<div class="profile-dropdown-head"><strong>' + fullName.replace(/[<>&"]/g, "") + '</strong><span>' + String(currentUser?.email || "").replace(/[<>&"]/g, "") + '</span></div>' +
          '<button type="button" class="profile-menu-item" id="profile-security">⚙️ Paramètres et sécurité</button>' +
          '<button type="button" class="profile-menu-item" id="open-academy">✦ CanadaCase Academy</button>' +
          '<button type="button" class="profile-menu-item" id="change-workspace">↔ Changer d’espace</button>' +
          '<div class="profile-menu-divider"></div>' +
          '<button type="button" class="profile-menu-item danger" id="logout">Déconnexion</button>' +
        '</div>' +
      '</div>';

    const avatar = $("#profile-avatar");
    const dropdown = $("#profile-dropdown");
    const closeMenu = () => {
      dropdown.classList.add("hidden");
      avatar.setAttribute("aria-expanded", "false");
    };
    avatar.onclick = event => {
      event.stopPropagation();
      const opening = dropdown.classList.contains("hidden");
      dropdown.classList.toggle("hidden");
      avatar.setAttribute("aria-expanded", opening ? "true" : "false");
    };
    if (profileMenuCloseHandler) {
      document.removeEventListener("click", profileMenuCloseHandler);
    }
    profileMenuCloseHandler = event => {
      if (!event.target.closest?.(".profile-menu-wrap")) closeMenu();
    };
    document.addEventListener("click", profileMenuCloseHandler);

    $("#profile-security").onclick = () => {
      closeMenu();
      if (profile?.role === "admin") {
        const target = $("#admin-view .password-panel");
        target?.classList.remove("hidden");
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => target?.querySelector("input")?.focus(), 350);
      } else {
        setClientSection("security");
        const target = $("#candidate-view .password-panel");
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => target?.querySelector("input")?.focus(), 350);
      }
    };

    $("#open-academy").onclick = () => {
      closeMenu();
      location.href = "academy.html";
    };

    $("#change-workspace").onclick = () => {
      closeMenu();
      if (profile?.role === "admin") {
        activeAdminWorkspace = "";
        sessionStorage.removeItem("cc_admin_workspace");
        renderAdminWorkspacePicker();
        showOnly(adminView);
      } else {
        activeWorkspace = "";
        sessionStorage.removeItem("cc_workspace");
        candidateView.classList.remove("workspace-language");
        showOnly(landingView);
      }
    };

    $("#logout").onclick = async () => {
      await sb.auth.signOut();
      location.reload();
    };
  }

  function showOnly(view) {
    [landingView, authView, candidateView, adminView].forEach(v => v.classList.add("hidden"));
    view.classList.remove("hidden");
  }

  function setClientSection(section) {
    const allowed = ["dashboard", "immigration", "documents", "tracking", "language", "security"];
    if (!allowed.includes(section)) section = "dashboard";
    candidateView.dataset.clientSection = section;
    candidateView.classList.toggle("workspace-language", section === "language");
    candidateView.querySelectorAll("[data-client-nav]").forEach(button => {
      const active = button.dataset.clientNav === section;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const passwordPanel = candidateView.querySelector(".password-panel");
    if (passwordPanel) passwordPanel.classList.toggle("hidden", section !== "security");
    if (section === "language") {
      loadPublishedLanguageCourses();
      loadPublishedLanguageExercises();
    } else if (section !== "security") {
      loadCandidate().catch(error => showNotice(error.message, true));
    }
  }

  document.querySelectorAll("[data-client-nav]").forEach(button =>
    button.addEventListener("click", () => setClientSection(button.dataset.clientNav))
  );

  function setWorkspace(workspace) {
    activeWorkspace = workspace;
    sessionStorage.setItem("cc_workspace", workspace);
    authView.dataset.workspace = workspace;
    if (currentUser && profile) {
      if (profile.role === "admin") {
        activeAdminWorkspace = workspace;
        sessionStorage.setItem("cc_admin_workspace", workspace);
        showOnly(adminView);
        renderAdminWorkspace(workspace);
        loadAdmin(workspace).catch(error => showNotice(error.message, true));
        return;
      }
      showOnly(candidateView);
      setClientSection(workspace === "language" ? "language" : "dashboard");
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
      activeWorkspace = "";
      sessionStorage.removeItem("cc_workspace");
      showOnly(authView);
      return;
    }

    currentUser = session.user;
    if (currentUser.email && !isEmailConfirmed(currentUser)) {
      await sb.auth.signOut();
      currentUser = null;
      profile = null;
      activeWorkspace = "";
      sessionStorage.removeItem("cc_workspace");
      showOnly(authView);
      showNotice("Votre adresse e-mail n’est pas encore confirmée. Ouvrez le lien reçu par e-mail, puis reconnectez-vous.", true);
      return;
    }

    await loadProfile();
    logoutButton();

    if (profile.role === "admin") {
      showOnly(adminView);
      if (activeAdminWorkspace === "immigration" || activeAdminWorkspace === "language") {
        renderAdminWorkspace(activeAdminWorkspace);
        await loadAdmin(activeAdminWorkspace);
      } else {
        renderAdminWorkspacePicker();
      }
    } else if (!activeWorkspace) {
      showOnly(landingView);
    } else {
      showOnly(candidateView);
      setClientSection(activeWorkspace === "language" ? "language" : "dashboard");
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
      const { data, error } = await sb.auth.signInWithPassword({
        email: val(form, "email").trim(),
        password: val(form, "password")
      });

      if (error) throw error;
      if (data.user?.email && !isEmailConfirmed(data.user)) {
        await sb.auth.signOut();
        throw new Error("Email not confirmed");
      }

      // Après authentification, le candidat choisit son espace.
      activeWorkspace = "";
      sessionStorage.removeItem("cc_workspace");
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
    if (val(form, "password") !== val(form, "password_confirm")) {
      showNotice("Les deux mots de passe ne correspondent pas.", true);
      form.elements.password_confirm.focus();
      return;
    }
    setBusy(form, true);

    const restoreText = setSubmitText(
      form,
      "Création du compte…"
    );

    try {
      const normalizedEmail = val(form, "email").trim().toLowerCase();
      form.elements.email.value = normalizedEmail;
      const { data, error } = await sb.auth.signUp({
        email: normalizedEmail,
        password: val(form, "password"),
        options: {
          emailRedirectTo: window.location.origin + "/",
          data: {
            full_name: val(form, "full_name"),
            phone: val(form, "phone")
          }
        }
      });

      if (error) throw error;

      // Supabase protège l'existence des comptes : un tableau identities vide indique
      // qu'une adresse déjà inscrite a été soumise à nouveau.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        showNotice("Cette adresse e-mail est déjà associée à un compte CanadaCase. Connectez-vous ou utilisez « Mot de passe oublié ».", true);
        return;
      }

      if (data.session && isEmailConfirmed(data.user)) {
        await initSession();
        showNotice("Compte créé avec succès. Votre espace est prêt.");
      } else {
        // Ne jamais laisser une session non confirmée active après l'inscription.
        if (data.session) await sb.auth.signOut();
        $("#resend-confirmation").classList.remove("hidden");
        showNotice(
          "Compte créé, mais votre adresse e-mail doit être confirmée avant l'accès. Ouvrez le lien reçu par e-mail ou utilisez le bouton de renvoi ci-dessous."
        );
      }

    } catch (error) {
      const message = String(error?.message || "");
      const duplicateEmail = /already registered|already exists|duplicate key|user already/i.test(message);
      showNotice(
        duplicateEmail
          ? "Cette adresse e-mail est déjà associée à un compte CanadaCase. Connectez-vous ou utilisez « Mot de passe oublié »."
          : authErrorMessage(error, "register"),
        true
      );

    } finally {
      setBusy(form, false);
      restoreText();
    }
  });

  $("#resend-confirmation").addEventListener("click", async () => {
    const email = val($("#register-form"), "email").trim();
    if (!email) {
      showNotice("Saisissez d’abord votre adresse e-mail.", true);
      return;
    }
    const button = $("#resend-confirmation");
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Envoi en cours…";
    try {
      const { error } = await sb.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/" }
      });
      if (error) throw error;
      showNotice("Demande de renvoi envoyée. Vérifiez aussi les courriers indésirables et l’onglet Promotions.");
    } catch (error) {
      showNotice("Renvoi impossible : " + authErrorMessage(error, "register"), true);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });

  async function loadCandidate() {
    const { data, error } = await sb
      .from("candidate_cases")
      .select("*")
      .eq("user_id", currentUser.id)
      .is("deleted_at", null)
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
    updateDeleteCaseButton();
  }

  function updateDeleteCaseButton() {
    const button = $("#delete-case");
    if (!button) return;
    const current = candidateCases.find(c => c.id === activeCaseId);
    const canDelete = candidateCases.length > 1 && current?.status === "À compléter";
    button.classList.toggle("hidden", !canDelete);
    button.disabled = !canDelete;
    button.title = canDelete ? "Supprimer ce brouillon uniquement" : "Conservez au moins un dossier actif ; les dossiers déjà traités sont protégés.";
  }

  async function loadActiveCase() {
    const current = candidateCases.find(c => c.id === activeCaseId);
    if (!current) return;
    const form = $("#candidate-form");
    form.reset();
    if (current.data) Object.entries(current.data).forEach(([k, v]) => setVal(form, k, v));
    if (current.process_stage) setVal(form, "process_stage", current.process_stage);
    $("#case-status").textContent = current.status || "À compléter";
    updateDeleteCaseButton();
    applyConditionalFields();
    window.updateFrenchScoreFields();
    updateProgress();
    await loadDocuments();
    renderCandidateTravelOverview();
    await loadClientUpdates();
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

  $("#delete-case").addEventListener("click", async () => {
    const current = candidateCases.find(c => c.id === activeCaseId);
    if (!current || candidateCases.length <= 1 || current.status !== "À compléter") {
      showNotice("Seul un brouillon peut être supprimé, et il faut conserver au moins un dossier actif.", true);
      return;
    }
    const confirmed = window.confirm(
      "Retirer ce dossier brouillon " + (current.case_number || "") +
      " de votre liste ? Les pièces déjà déposées ne seront pas supprimées."
    );
    if (!confirmed) return;

    const button = $("#delete-case");
    button.disabled = true;
    try {
      const { error } = await sb.from("candidate_cases")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", current.id)
        .eq("user_id", currentUser.id)
        .is("deleted_at", null);
      if (error) throw error;

      candidateCases = candidateCases.filter(c => c.id !== current.id);
      activeCaseId = candidateCases[0]?.id || null;
      renderCaseSelector();
      await loadActiveCase();
      showNotice("Le dossier brouillon a été retiré de votre liste. Ses données sont conservées pour éviter toute perte accidentelle.");
    } catch (error) {
      showNotice("Suppression impossible : " + (error.message || "réessayez plus tard."), true);
    } finally {
      updateDeleteCaseButton();
    }
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
      const inactive = !expected.includes(value);
      const disabledMode = el.dataset.revealMode === "disable";
      el.classList.toggle("conditional-hidden", inactive && !disabledMode);
      el.classList.toggle("conditional-disabled", inactive && disabledMode);
      el.querySelectorAll("input,select,textarea").forEach(control => {
        control.disabled = inactive && disabledMode;
        if (inactive && !disabledMode) {
          if (control.type === "checkbox" || control.type === "radio") control.checked = false;
          else control.value = "";
        }
        if (inactive && disabledMode) {
          if (control.type === "checkbox" || control.type === "radio") control.checked = false;
          else if (control.value) control.value = "";
        }
      });
    });
  }

  $("#candidate-form").addEventListener("change", applyConditionalFields);


  function formatCaseDate(value) {
    if (!value) return "";
    const d = new Date(String(value).length === 10 ? value + "T00:00:00" : value);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR");
  }

  function renderCandidateTravelOverview() {
    const host = $("#candidate-case-summary");
    const checklist = $("#candidate-case-checklist");
    const deadlines = $("#candidate-case-deadlines");
    if (!host || !checklist || !deadlines) return;
    const form = $("#candidate-form");
    const data = payload();
    const status = $("#case-status")?.textContent || "À compléter";
    const program = data.program || "Procédure non précisée";
    const stage = data.process_stage === "ita_response" ? "Réponse à une ITA" : "Déclaration d’intérêt";
    const nextAction = data.ita_received === "yes"
      ? (data.submission_deadline ? "Préparer la soumission avant la date limite de l’ITA." : "Préparer les documents de la demande après l’ITA.")
      : (!data.french_test_taken || data.french_test_taken === "no" ? "Vérifier ou planifier votre test linguistique." : (!data.ede_done || data.ede_done === "no" ? "Vérifier l’EDE et réunir le rapport." : "Compléter les documents manquants et surveiller les échéances."));
    const cards = [
      ["Statut", status],
      ["Procédure", program],
      ["Étape", stage],
      ["Prochaine action", nextAction]
    ];
    host.innerHTML = cards.map(([label,value]) => '<article class="case-summary-card"><span>'+label+'</span><strong>'+String(value).replace(/[<>&"]/g,"")+'</strong></article>').join("");

    const steps = [
      ["Profil et situation familiale", Boolean(data.last_name && data.first_names && data.marital_status)],
      ["Études / EDE", Boolean(data.education_level && data.degree && data.ede_done === "yes")],
      ["Expérience professionnelle", Boolean(data.employer && data.job_title && data.job_start)],
      ["Langues", Boolean(data.french_test_taken === "yes" && data.french_test)],
      ["Passeport", Boolean(data.passport_number && data.passport_expiry)],
      ["Fonds et procédure", Boolean(data.funds_cad || data.ita_received)],
      ["Documents", candidateDocumentsCache.length > 0]
    ];
    checklist.innerHTML = '<div class="case-subheading"><h3>Checklist de préparation</h3><span>'+steps.filter(x=>x[1]).length+'/'+steps.length+' étapes renseignées</span></div>' +
      steps.map(([label,done]) => '<div class="case-check-item '+(done?"done":"")+'"><span>'+ (done?"✓":"○") +'</span><strong>'+label+'</strong><small>'+(done?"Renseigné":"À compléter")+'</small></div>').join("");

    const deadlineItems = [
      ["Passeport", data.passport_expiry],
      ["EDE", data.ede_expiry],
      ["Date limite de soumission ITA", data.submission_deadline],
      ["Date de l’ITA", data.ita_date]
    ].filter(x=>x[1]);
    deadlines.innerHTML = '<div class="case-subheading"><h3>Échéances connues</h3></div>' +
      (deadlineItems.length ? deadlineItems.map(([label,date]) => '<div class="case-deadline-item"><strong>'+label+'</strong><span>'+formatCaseDate(date)+'</span></div>').join("") : '<p class="muted small">Aucune échéance n’est encore renseignée.</p>');
  }

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

  window.updateFrenchScoreFields = function updateFrenchScoreFields() {
    const exam = $("#candidate-form [name='french_test']")?.value;
    const formats = exam === "TCF Canada"
      ? { listening: "Score /699", speaking: "Note /20", reading: "Score /699", writing: "Note /20" }
      : exam === "TEF Canada"
      ? { listening: "Score /699", speaking: "Score /699", reading: "Score /699", writing: "Score /699" }
      : { listening: "TCF : /699 · TEF : /699", speaking: "TCF : /20 · TEF : /699", reading: "TCF : /699 · TEF : /699", writing: "TCF : /20 · TEF : /699" };
    [["french_listening","listening"],["french_speaking","speaking"],["french_reading","reading"],["french_writing","writing"]].forEach(([name,key]) => {
      const input = $("#candidate-form [name='"+name+"']");
      if (input) input.placeholder = formats[key];
    });
  };

  $("#candidate-form").addEventListener("input", () => { applyConditionalFields(); updateProgress(); });
  $("#candidate-form").addEventListener("change", e => {
    applyConditionalFields();
    if (e.target?.name === "french_test") window.updateFrenchScoreFields();
    updateProgress();
  });

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


  // Impression du relevé de préparation linguistique
  $("#print-language-results").addEventListener("click", () => {
    const sections = [
      ["Correction du dernier exercice", $("#training-feedback")?.innerText],
      ["Résultat de la session chronométrée", $("#exam-session-result")?.innerText],
      ["Progression par compétence", $("#language-progress-grid")?.innerText],
      ["Historique des résultats", $("#language-attempt-history")?.innerText]
    ].filter(([, value]) => value && value.trim() && !/chargement des résultats/i.test(value));
    if (!sections.length) {
      showNotice("Aucun résultat à imprimer. Terminez d'abord un exercice ou une session.", true);
      return;
    }
    const escapeHtml = value => String(value).replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
    const exam = $("#training-exam")?.value || "TCF / TEF Canada";
    const skill = $("#training-skill")?.value || "";
    const level = $("#training-level")?.value || "";
    const win = window.open("", "_blank");
    if (!win) {
      showNotice("Autorisez les fenêtres surgissantes pour CanadaCase, puis réessayez.", true);
      return;
    }
    const body = sections.map(([title, value]) => "<section><h2>" + escapeHtml(title) + "</h2><p>" + escapeHtml(value).replace(/\n/g, "<br>") + "</p></section>").join("");
    win.document.open();
    win.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Résultats TCF TEF - CanadaCase</title><style>body{font:14px/1.6 system-ui,sans-serif;color:#243b53;margin:28px}h1{color:#102a43}h2{font-size:17px;color:#1769aa;border-bottom:1px solid #d9e2ec;padding-bottom:6px}section{margin:24px 0;break-inside:avoid}p{white-space:pre-wrap;overflow-wrap:anywhere}@page{size:A4;margin:15mm}</style></head><body><h1>CanadaCase — Relevé de préparation linguistique</h1><p><strong>Examen :</strong> '+escapeHtml(exam)+'<br><strong>Compétence :</strong> '+escapeHtml(skill)+'<br><strong>Niveau :</strong> '+escapeHtml(level)+'<br><strong>Date :</strong> '+new Date().toLocaleString("fr-FR")+'</p>'+body+'</body></html>');
    win.document.close();
    win.onload = () => { win.focus(); window.setTimeout(() => win.print(), 500); };
  });

  $("#print-diagnostic-report")?.addEventListener("click",()=>{
    const report=$("#language-diagnostic-report");
    if(!report||!report.innerText.trim()){showNotice("Aucun bilan à imprimer pour le moment.",true);return;}
    const win=window.open("","_blank");
    if(!win){showNotice("Autorisez les fenêtres surgissantes pour imprimer le bilan.",true);return;}
    const escape=value=>String(value).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
    win.document.write("<!doctype html><html lang='fr'><head><meta charset='utf-8'><title>Bilan CanadaCase</title><style>body{font:15px/1.6 system-ui,sans-serif;margin:30px;color:#243b53}h1{color:#123}li{margin:9px 0}@page{size:A4;margin:16mm}</style></head><body><h1>CanadaCase — Rapport de positionnement</h1><p>Examen : "+escape($("#training-exam").value)+"</p><p>Date : "+new Date().toLocaleString("fr-FR")+"</p>"+report.innerHTML+"</body></html>");
    win.document.close();win.onload=()=>{win.focus();win.print();};
  });
  $("#language-nclc-target")?.addEventListener("change",()=>loadLanguageAttemptHistory());
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
  async function loadPublishedLanguageCourses() {
    const list=$("#language-courses-list"), view=$("#language-course-view");
    if(!list)return;
    const exam=$("#course-library-exam")?.value||$("#training-exam")?.value||"Tous les examens";
    const skill=$("#course-library-skill")?.value||"Tous les chapitres";
    let request=sb.from("language_courses")
      .select("id,exam,skill,level,title,summary,content,source_name,source_url,source_version,source_checked_at,resource_path,image_path,pedagogical_type,section_title,unit_title,lesson_order,objectives,estimated_minutes,key_points,practice_prompt")
      .eq("is_published",true);
    if(exam!=="Tous les examens")request=request.in("exam",[exam,"TCF & TEF Canada"]);
    if(skill!=="Tous les chapitres")request=request.eq("skill",skill);
    const {data,error}=await request.order("lesson_order").order("sort_order").limit(60);
    list.innerHTML="";
    if(error){list.textContent="Chargement des cours impossible : "+error.message;return;}
    if(!data?.length){list.textContent="Aucun cours publié pour cette sélection.";view.classList.add("hidden");return;}
    const grouped=new Map();
    data.forEach(course=>{
      const groupName=course.section_title||course.skill||"Programme général";
      if(!grouped.has(groupName))grouped.set(groupName,[]);
      grouped.get(groupName).push(course);
    });
    grouped.forEach((courses,sectionName)=>{
      const section=document.createElement("section");section.className="curriculum-section";
      const sectionHead=document.createElement("div");sectionHead.className="curriculum-section-heading";
      const sectionTitle=document.createElement("h3");sectionTitle.textContent=sectionName;
      const sectionCount=document.createElement("span");sectionCount.textContent=courses.length+" fiche(s)";
      sectionHead.append(sectionTitle,sectionCount);section.append(sectionHead);
      const units=new Map();
      courses.forEach(course=>{
        const unit=course.unit_title||"Leçons et fiches";
        if(!units.has(unit))units.set(unit,[]);
        units.get(unit).push(course);
      });
      units.forEach((unitCourses,unitName)=>{
        const unitBlock=document.createElement("div");unitBlock.className="curriculum-unit";
        if(unitName!=="Leçons et fiches"){const unitTitle=document.createElement("h4");unitTitle.textContent=unitName;unitBlock.append(unitTitle);}
        const cards=document.createElement("div");cards.className="language-courses-list";
        unitCourses.forEach(course=>{
          const card=document.createElement("article");card.className="language-course-card curriculum-card";
          const top=document.createElement("div");top.className="curriculum-card-top";
          const kind=document.createElement("span");kind.className="curriculum-kind";kind.textContent=({lesson:"LEÇON",method_sheet:"FICHE MÉTHODE",grammar_sheet:"GRAMMAIRE",vocabulary_sheet:"VOCABULAIRE",strategy_sheet:"STRATÉGIE"})[course.pedagogical_type]||"LEÇON";
          const duration=document.createElement("span");duration.className="language-course-meta";duration.textContent=(course.estimated_minutes||10)+" min · "+(course.level||"Tous niveaux");
          top.append(kind,duration);
          const title=document.createElement("h3");title.textContent=course.title;
          const summary=document.createElement("p");summary.textContent=course.summary||"Consultez cette fiche pour apprendre et vous entraîner.";
          const actions=document.createElement("div");actions.className="curriculum-actions";
          const details=document.createElement("button");details.type="button";details.className="secondary small-btn";details.textContent="Détails";
          const open=document.createElement("button");open.type="button";open.className="primary small-btn";open.textContent="Accéder";
          details.addEventListener("click",()=>{
            const existing=card.querySelector(".curriculum-details");
            if(existing){existing.remove();details.textContent="Détails";return;}
            const panel=document.createElement("div");panel.className="curriculum-details";
            const objective=document.createElement("p");objective.textContent=course.objectives||course.summary||"Objectifs pédagogiques à préciser.";
            const info=document.createElement("p");info.textContent=[course.exam,course.skill,course.level||"Tous niveaux",(course.estimated_minutes||10)+" minutes"].join(" · ");
            panel.append(info,objective);card.append(panel);details.textContent="Masquer les détails";
          });
          open.addEventListener("click",async()=>{
            view.innerHTML="";
            const back=document.createElement("button");back.type="button";back.className="secondary small-btn";back.textContent="← Retour au programme";back.addEventListener("click",()=>{view.classList.add("hidden");list.classList.remove("hidden");});
            const heading=document.createElement("h2");heading.textContent=course.title;
            const meta=document.createElement("p");meta.className="language-course-meta";meta.textContent=[course.exam,course.skill,course.level||"Tous niveaux",(course.estimated_minutes||10)+" min"].join(" · ");
            view.append(back,heading,meta);
            if(course.image_path){const imageUrl=await getExerciseMediaUrl(course.image_path);if(imageUrl){const cover=document.createElement("img");cover.className="language-course-cover";cover.src=imageUrl;cover.alt="Illustration pédagogique : "+course.title;view.append(cover);}}
            const addBlock=(label,value,className="course-content-block")=>{if(!value)return;const block=document.createElement("section");block.className=className;const h=document.createElement("h3");h.textContent=label;const p=document.createElement("p");p.textContent=value;block.append(h,p);view.append(block);};
            const addLessonBody=value=>{
              if(!value)return;
              const block=document.createElement("section");block.className="course-content-block course-lesson-body";
              const heading=document.createElement("h3");heading.textContent="Leçon et méthode";block.append(heading);
              const body=document.createElement("div");body.className="course-lesson-content";
              value.split(/\r?\n/).forEach(raw=>{
                const line=raw.trim();if(!line)return;
                const isHeading=line===line.toLocaleUpperCase("fr-FR")&&/[A-ZÀ-ÖØ-Þ]/.test(line);
                if(isHeading){const h=document.createElement("h4");h.className="course-lesson-heading";h.textContent=line;body.append(h);return;}
                if(line.startsWith("•")){let list=body.lastElementChild;if(!list||list.tagName!=="UL"){list=document.createElement("ul");list.className="course-lesson-list";body.append(list);}const item=document.createElement("li");item.textContent=line.slice(1).trim();list.append(item);return;}
                const p=document.createElement("p");p.className="course-lesson-paragraph";p.textContent=line;body.append(p);
              });
              block.append(body);view.append(block);
            };
            addBlock("Objectifs pédagogiques",course.objectives);
            addLessonBody(course.content);
            addBlock("À retenir",course.key_points);
            addBlock("Mise en pratique",course.practice_prompt);
            const source=document.createElement("p");source.className="muted small";source.textContent=[course.source_name,course.source_version,course.source_checked_at?"Source vérifiée le "+new Date(course.source_checked_at+"T00:00:00").toLocaleDateString("fr-FR"):"Référence non datée"].filter(Boolean).join(" · ");view.append(source);
            if(course.source_url){const link=document.createElement("a");link.href=course.source_url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Consulter la source de référence";view.append(link);}
            if(course.resource_path){const url=await getExerciseMediaUrl(course.resource_path);if(url){const pdf=document.createElement("a");pdf.href=url;pdf.target="_blank";pdf.rel="noopener noreferrer";pdf.textContent="Ouvrir le support PDF";view.append(pdf);}}
            view.classList.remove("hidden");list.classList.add("hidden");view.scrollIntoView({behavior:"smooth",block:"start"});
          });
          actions.append(details,open);card.append(top,title,summary,actions);cards.append(card);
        });
        unitBlock.append(cards);section.append(unitBlock);
      });
      list.append(section);
    });
  }

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

  async function getExerciseMediaUrl(path) {
    if (!path) return null;
    if (path.startsWith("https://") || path.startsWith("http://")) return path;
    const { data, error } = await sb.storage.from("language-media").createSignedUrl(path, 3600);
    return error ? null : data?.signedUrl || null;
  }

  function addSpeechPlayback(container, transcript) {
    if (!transcript) return;
    const inMock = !$("#language-module-mock").classList.contains("hidden");
    const activeSkill = inMock ? $("#mock-training-skill").value : $("#training-skill").value;
    const singlePlay = inMock && activeSkill === "Compréhension orale";
    let hasPlayed = false;
    const controls = document.createElement("div");
    controls.className = "training-audio-controls";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary small-btn";
    button.textContent = "▶ Écouter le document audio";
    button.addEventListener("click", () => {
      if (singlePlay && hasPlayed) return;
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        showNotice("La lecture vocale n’est pas prise en charge par ce navigateur. Essayez Safari ou Chrome à jour.", true);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(transcript);
      utterance.lang = "fr-FR";
      utterance.rate = 0.94;
      const frenchVoice = window.speechSynthesis.getVoices().find(voice => /^fr([_-]|$)/i.test(voice.lang));
      if (frenchVoice) utterance.voice = frenchVoice;
      utterance.onend = () => {
        if (singlePlay) {
          hasPlayed = true;
          button.disabled = true;
          button.textContent = "Écoute terminée — diffusion unique";
        } else {
          button.disabled = false;
          button.textContent = "▶ Réécouter le document audio";
        }
      };
      utterance.onerror = () => {
        button.disabled = false;
        button.textContent = "▶ Réessayer l’écoute";
      };
      button.disabled = true;
      button.textContent = "Lecture en cours…";
      window.speechSynthesis.speak(utterance);
    });
    controls.append(button);
    const note = document.createElement("p");
    note.className = "muted small audio-source-note";
    note.textContent = "Voix de synthèse de secours générée par le navigateur ; l’enregistrement audio est privilégié lorsqu’il est disponible.";
    controls.append(note);
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Afficher la transcription après l’écoute";
    const text = document.createElement("p");
    text.textContent = transcript;
    details.append(summary, text);
    controls.append(details);
    container.append(controls);
  }

  async function gradePracticeQuestionSet(exercise, questions, button) {
    const answers = {};
    questions.forEach(question => {
      const selected = document.querySelector('input[name="practice-q-' + question.id + '"]:checked');
      answers[question.id] = selected ? Number(selected.value) : null;
    });
    button.disabled = true;
    button.textContent = "Correction en cours…";
    try {
      if (!practiceQuestionAttemptId) {
        const { data: attempt, error: attemptError } = await sb.from("language_attempts").insert({
          user_id: currentUser.id,
          exam: exercise.exam,
          skill: exercise.skill,
          level: exercise.level,
          exercise_id: exercise.id,
          question_ids: questions.map(question => question.id),
          started_at: practiceQuestionStartedAt || new Date().toISOString()
        }).select("id").single();
        if (attemptError) throw attemptError;
        practiceQuestionAttemptId = attempt.id;
      }
      const { data, error } = await sb.functions.invoke("grade-language-attempt", {
        body: { attempt_id: practiceQuestionAttemptId, answers }
      });
      if (error) throw new Error(await functionErrorMessage(error));
      if (!data || typeof data.score !== "number" || !Array.isArray(data.review)) {
        throw new Error(data?.error || "La correction n’a pas renvoyé de résultat exploitable.");
      }
      const host = $("#training-questions");
      host.innerHTML = "";
      const result = document.createElement("div");
      result.className = "practice-qcm-result";
      const heading = document.createElement("h3");
      heading.textContent = "Votre résultat : " + data.score + "/" + data.max_score;
      const note = document.createElement("p");
      note.textContent = "Les réponses et les explications sont enregistrées dans votre historique pour vous permettre de revoir vos erreurs.";
      result.append(heading, note);
      data.review.forEach((item, index) => {
        const card = document.createElement("article");
        card.className = "exam-answer-review";
        const question = document.createElement("strong");
        question.textContent = (index + 1) + ". " + item.question_text;
        const status = document.createElement("p");
        status.className = item.is_correct ? "review-correct" : "review-incorrect";
        status.textContent = item.is_correct ? "✓ Bonne réponse" : "✗ À revoir";
        const selected = document.createElement("p");
        selected.textContent = "Votre réponse : " + (item.selected_option === null || item.selected_option === undefined ? "Aucune réponse" : item.options?.[Number(item.selected_option)] ?? "Réponse non reconnue");
        const correct = document.createElement("p");
        correct.textContent = "Réponse attendue : " + (item.options?.[Number(item.correct_option)] ?? "Indisponible");
        card.append(question, status, selected, correct);
        if (item.explanation) {
          const explanation = document.createElement("p");
          explanation.className = "review-explanation";
          explanation.textContent = "Explication : " + item.explanation;
          card.append(explanation);
        }
        result.append(card);
      });
      host.append(result);
      button.textContent = "Correction enregistrée";
      button.disabled = true;
      await loadLanguageAttemptHistory();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Vérifier mes réponses";
      showNotice("Correction impossible : " + (error.message || "service indisponible."), true);
    }
  }

  async function showLanguageExercise(exercise) {
    $("#training-prompt").textContent = exercise.prompt;
    const media = $("#training-media");
    media.innerHTML = "";
    media.classList.add("hidden");
    const questionsHost = $("#training-questions");
    questionsHost.innerHTML = "";
    questionsHost.classList.add("hidden");
    practiceQuestionAttemptId = null;
    practiceQuestionStartedAt = new Date().toISOString();
    const isQcmSkill = exercise.skill === "Compréhension écrite" || exercise.skill === "Compréhension orale";
    $("#training-answer").closest("label").classList.toggle("hidden", isQcmSkill);
    document.querySelector("#training-task-panel .recording-controls")?.classList.toggle("hidden", isQcmSkill);
    $("#recording-preview").classList.add("hidden");
    $("#transcribe-recording").classList.add("hidden");
    $("#correct-training-answer").classList.toggle("hidden", isQcmSkill);
    if (exercise.image_path) {
      const url = await getExerciseMediaUrl(exercise.image_path);
      if (url) {
        const img = document.createElement("img");
        img.src = url;
        img.alt = "Support visuel de l’exercice";
        img.loading = "lazy";
        media.append(img);
      }
    }
    if (exercise.audio_path) {
      const url = await getExerciseMediaUrl(exercise.audio_path);
      if (url) {
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.preload = "none";
        audio.src = url;
        const inMock = !$("#language-module-mock").classList.contains("hidden");
        if (inMock && exercise.skill === "Compréhension orale") {
          audio.controls = false;
          const playButton = document.createElement("button");
          playButton.type = "button";
          playButton.className = "secondary small-btn";
          playButton.textContent = "▶ Écouter le document audio";
          playButton.addEventListener("click", async () => {
            if (playButton.disabled) return;
            playButton.disabled = true;
            playButton.textContent = "Lecture en cours…";
            try { await audio.play(); }
            catch (error) {
              playButton.disabled = false;
              playButton.textContent = "▶ Réessayer l’écoute";
              showNotice("Lecture audio impossible : " + (error.message || "vérifiez votre connexion."), true);
            }
          });
          audio.addEventListener("ended", () => {
            audio.pause();
            playButton.textContent = "Écoute terminée — diffusion unique";
            const note = document.createElement("p");
            note.className = "muted small audio-played-note";
            note.textContent = "Enregistrement diffusé une seule fois dans cette simulation.";
            media.append(note);
          }, { once: true });
          media.append(playButton);
        }
        media.append(audio);
      }
    } else if (exercise.audio_transcript) {
      addSpeechPlayback(media, exercise.audio_transcript);
    }
    if (media.children.length) media.classList.remove("hidden");
    $("#training-answer").value = "";
    $("#training-feedback").classList.add("hidden");

    if (isQcmSkill) {
      const { data: questions, error } = await sb.from("language_exercise_questions")
        .select("id,exercise_id,question_text,options,explanation,sort_order")
        .eq("exercise_id", exercise.id)
        .order("sort_order");
      if (error) throw error;
      questionsHost.classList.remove("hidden");
      if (!questions?.length) {
        const message = document.createElement("p");
        message.className = "muted";
        message.textContent = "Cet exercice de compréhension n’a pas encore de questions corrigées. Choisissez un autre sujet ou signalez-le à l’administration.";
        questionsHost.append(message);
        return;
      }
      const form = document.createElement("div");
      form.className = "practice-qcm-form";
      questions.forEach((question, index) => {
        const card = document.createElement("article");
        card.className = "exam-question";
        const title = document.createElement("h4");
        title.textContent = (index + 1) + ". " + question.question_text;
        card.append(title);
        (Array.isArray(question.options) ? question.options : []).forEach((option, optionIndex) => {
          const label = document.createElement("label");
          label.className = "exam-option";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = "practice-q-" + question.id;
          input.value = String(optionIndex);
          const text = document.createElement("span");
          text.textContent = option;
          label.append(input, text);
          card.append(label);
        });
        form.append(card);
      });
      const submit = document.createElement("button");
      submit.type = "button";
      submit.className = "primary";
      submit.textContent = "Vérifier mes réponses";
      submit.addEventListener("click", () => gradePracticeQuestionSet(exercise, questions, submit));
      form.append(submit);
      questionsHost.append(form);
    }
  }

  async function loadLanguageHomeDashboard(exam) {
    const host=$("#language-home-dashboard");
    if(!host)return;
    const {data,error}=await sb.from("language_attempts").select("id,skill,score,max_score,completed_at").eq("user_id",currentUser.id).eq("exam",exam).not("completed_at","is",null).order("completed_at",{ascending:false}).limit(100);
    if(error){$("#language-home-message").textContent="Vos statistiques seront disponibles après votre première séance.";return;}
    const attempts=data||[];
    const qcm=attempts.filter(x=>x.score!==null&&Number(x.max_score)>0);
    const avg=qcm.length?qcm.reduce((sum,x)=>sum+Number(x.score)/Number(x.max_score)*100,0)/qcm.length:null;
    $("#language-home-attempts").textContent=String(attempts.length);
    $("#language-home-average").textContent=avg===null?"—":Math.round(avg)+" %";
    $("#language-home-last").textContent=attempts[0]?.completed_at?new Date(attempts[0].completed_at).toLocaleDateString("fr-FR"):"Aucune";
    const dayKey=value=>{const d=new Date(value);return d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate();};
    const days=new Set(attempts.map(x=>dayKey(x.completed_at)));
    let streak=0;const cursor=new Date();cursor.setHours(0,0,0,0);
    if(!days.has(dayKey(cursor)))cursor.setDate(cursor.getDate()-1);
    while(days.has(dayKey(cursor))&&streak<365){streak++;cursor.setDate(cursor.getDate()-1);}
    $("#language-streak-value").textContent=String(streak);
    const todayDone=attempts.some(x=>dayKey(x.completed_at)===dayKey(new Date()));
    $("#language-daily-goal-label").textContent=todayDone?"Objectif du jour atteint":"Une séance aujourd’hui";
    $("#language-daily-goal-fill").style.width=todayDone?"100%":"0%";
    $("#language-daily-goal-note").textContent=todayDone?"Bravo ! Votre séance du jour est enregistrée. Revenez demain pour garder le rythme.":"Une séance de 15 à 20 minutes suffit pour entretenir votre progression.";
    const skillNames=["Compréhension écrite","Compréhension orale","Expression écrite","Expression orale"];
    const bySkill=skillNames.map(skill=>{const rows=qcm.filter(x=>x.skill===skill);return {skill,avg:rows.length?rows.reduce((sum,x)=>sum+Number(x.score)/Number(x.max_score)*100,0)/rows.length:null};});
    const weakest=[...bySkill].sort((a,b)=>(a.avg??-1)-(b.avg??-1))[0];
    $("#language-home-recommendation").textContent=attempts.length?(weakest?.avg===null?"Conseil : évaluez vos compétences pour identifier celle à renforcer.":"Conseil : consacrez votre prochaine séance à "+weakest.skill+"."):"Commencez par une évaluation de départ, puis CanadaCase vous proposera un entraînement adapté.";
    $("#language-home-message").textContent=attempts.length?"Votre parcours "+exam+" est prêt. Reprenez là où vous en étiez et consolidez vos points faibles.":"Bienvenue dans votre parcours "+exam+". Commencez par une première séance pour établir votre point de départ.";
  }
  $("#language-continue-practice")?.addEventListener("click",()=>{document.querySelector('[data-language-module="practice"]')?.click();$("#language-diagnostic")?.scrollIntoView({behavior:"smooth",block:"start"});});
  $("#language-start-course")?.addEventListener("click",()=>document.querySelector('[data-language-module="courses"]')?.click());
  $("#language-start-mock")?.addEventListener("click",()=>document.querySelector('[data-language-module="mock"]')?.click());
  function chooseLanguageExam(exam){
    $("#training-exam").value=exam;
    $("#course-library-exam").value=exam;
    $("#mock-exam-heading").textContent="Examen blanc — "+exam;
    updateMockExamFormat();
    $("#selected-language-exam-title").textContent="Préparation "+exam;
    $("#language-courses-title").textContent="Cours et méthodologie — "+exam;
    $("#language-exam-choice").classList.add("hidden");
    $("#language-module-navigation").classList.remove("hidden");
    $("#language-module-cards").classList.remove("hidden");
    $("#toggle-language-modules").classList.add("hidden");
    $("#toggle-language-modules").setAttribute("aria-expanded","false");
    $("#selected-language-module-label").textContent="Choisissez une activité.";
    document.querySelectorAll(".language-module-panel").forEach(panel=>panel.classList.add("hidden"));
    $("#language-attempt-progress").classList.add("hidden");
    $("#language-attempt-history").classList.add("hidden");
    $("#language-error-review").classList.add("hidden");
    loadPublishedLanguageCourses();
    loadPublishedLanguageExercises();
    loadLanguageHomeDashboard(exam);
  }
  document.querySelectorAll("[data-language-exam]").forEach(button=>button.addEventListener("click",()=>chooseLanguageExam(button.dataset.languageExam)));
  $("#back-language-exams").addEventListener("click",()=>{
    $("#language-module-navigation").classList.add("hidden");
    $("#language-exam-choice").classList.remove("hidden");
    $("#language-module-cards").classList.remove("hidden");
    $("#toggle-language-modules").classList.add("hidden");
    document.querySelectorAll(".language-module-panel").forEach(panel=>panel.classList.add("hidden"));
    $("#language-attempt-progress").classList.add("hidden");
    $("#language-attempt-history").classList.add("hidden");
    $("#language-error-review").classList.add("hidden");
  });
  $("#toggle-language-modules").addEventListener("click",()=>{
    const cards=$("#language-module-cards");
    const opening=cards.classList.contains("hidden");
    cards.classList.toggle("hidden",!opening);
    $("#toggle-language-modules").setAttribute("aria-expanded",opening?"true":"false");
  });
  document.querySelectorAll("[data-language-module]").forEach(button=>button.addEventListener("click",()=>{
    const target=button.dataset.languageModule;
    const ids={courses:"language-module-courses",practice:"language-module-practice",mock:"language-module-mock"};
    Object.entries(ids).forEach(([key,id])=>$("#"+id).classList.toggle("hidden",key!==target));
    $("#training-settings").classList.toggle("hidden",target!=="practice");
    $("#language-attempt-progress").classList.toggle("hidden",target!=="practice");
    $("#language-attempt-history").classList.toggle("hidden",target!=="practice");
    $("#language-error-review").classList.toggle("hidden",target!=="practice");
    $("#language-module-cards").classList.add("hidden");
    $("#toggle-language-modules").classList.remove("hidden");
    $("#toggle-language-modules").setAttribute("aria-expanded","false");
    const labels={courses:"Cours",practice:"Pratique",mock:"Examen blanc"};
    $("#selected-language-module-label").textContent="Activité : "+labels[target]+" · Utilisez « Changer d’activité » pour naviguer.";
    if(target==="courses")loadPublishedLanguageCourses();
    if(target==="practice")loadPublishedLanguageExercises();
    $("#"+ids[target]).scrollIntoView({behavior:"smooth",block:"start"});
  }));
  document.querySelectorAll("[data-diagnostic-skill]").forEach(button=>button.addEventListener("click",()=>{
    const skill=button.dataset.diagnosticSkill;
    $("#training-skill").value=skill;
    $("#training-settings").classList.remove("hidden");
    document.querySelectorAll("[data-practice-skill]").forEach(card=>card.classList.toggle("active",card.dataset.practiceSkill===skill));
    loadPublishedLanguageExercises();
    $("#training-task-panel")?.scrollIntoView({behavior:"smooth",block:"start"});
  }));
  document.querySelectorAll("[data-practice-skill]").forEach(button=>button.addEventListener("click",()=>{
    $("#training-skill").value=button.dataset.practiceSkill;
    document.querySelectorAll("[data-practice-skill]").forEach(card=>card.classList.toggle("active",card===button));
    loadPublishedLanguageExercises();
    $("#training-task-panel")?.scrollIntoView({behavior:"smooth",block:"start"});
  }));
  ["training-exam","training-skill","training-level"].forEach(id => $("#"+id).addEventListener("change", loadPublishedLanguageExercises));
  function updateMockExamFormat(){
    const exam=$("#training-exam").value,skill=$("#mock-training-skill").value,rule=examRules[exam]?.[skill];
    $("#mock-exam-heading").textContent="Examen blanc — "+exam;
    $("#mock-exam-format").textContent=rule?exam+" · "+skill+" · "+rule.count+" question(s)/tâche(s) · "+rule.minutes+" minutes":"Format non défini.";
    const guidance=exam==="TCF Canada"
      ? (skill==="Expression orale"?"3 tâches : entretien dirigé (2 min), interaction avec préparation (5 min 30 dont 2 min de préparation), puis opinion argumentée (4 min 30). L’épreuve officielle se déroule face à un examinateur.":skill==="Compréhension orale"?"39 questions en 35 minutes. Les enregistrements d’entraînement se lisent avec le lecteur audio et sont prévus pour une seule écoute.":skill==="Expression écrite"?"3 tâches en 60 minutes : message (60–120 mots), récit/compte rendu (120–150 mots), puis comparaison de deux points de vue et avis (120–180 mots).":"39 questions en 60 minutes.")
      : (skill==="Expression orale"?"2 sections en 15 minutes : section A, obtenir des renseignements (5 min) ; section B, argumenter pour convaincre (10 min). L’épreuve officielle se déroule face à un examinateur.":skill==="Compréhension orale"?"40 questions en 40 minutes. Chaque document sonore est diffusé une seule fois ; il faut répondre au fur et à mesure sans revenir en arrière.":skill==="Expression écrite"?"2 sections en 60 minutes : suite d’un article (80 mots minimum), puis expression d’un point de vue argumenté (200 mots minimum).":"40 questions en 60 minutes.");
    $("#mock-exam-guidance").textContent=guidance;
  }
  ["mock-training-skill","mock-training-level"].forEach(id=>$("#"+id).addEventListener("change",updateMockExamFormat));

  ["course-library-exam","course-library-skill"].forEach(id => $("#"+id).addEventListener("change", loadPublishedLanguageCourses));
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
    const el=$("#language-attempt-history-list");
    const selectedExam=$("#training-exam")?.value||"TCF Canada";
    const {data,error}=await sb.from("language_attempts").select("id,exam,skill,level,score,max_score,completed_at,duration_seconds,feedback").eq("user_id",currentUser.id).eq("exam",selectedExam).not("completed_at","is",null).order("completed_at",{ascending:false}).limit(100);
    if(error){el.textContent="Historique indisponible : "+error.message;return;}
    const attempts=data||[];
    el.innerHTML="";
    if(!attempts.length)el.textContent="Aucun résultat enregistré pour le moment.";
    attempts.slice(0,10).forEach(item=>{
      const row=document.createElement("div");row.className="attempt-row";
      const title=document.createElement("strong");title.textContent=item.exam+" · "+item.skill+" · "+item.level;
      const meta=document.createElement("span");meta.textContent=(item.score===null?"Production enregistrée":Number(item.score)+"/"+Number(item.max_score))+" · "+new Date(item.completed_at).toLocaleString("fr-FR");
      row.append(title,meta);el.append(row);
    });
    const errorList=$("#language-error-review-list");
    if(errorList){
      errorList.innerHTML="";
      let errorCount=0;
      attempts.forEach(attempt=>{
        let saved=null;
        try{saved=attempt.feedback?JSON.parse(attempt.feedback):null;}catch(_){}
        const review=Array.isArray(saved?.review)?saved.review.filter(item=>!item.is_correct):[];
        review.forEach(item=>{
          errorCount++;
          const card=document.createElement("article");card.className="exam-answer-review";
          const title=document.createElement("strong");title.textContent=attempt.exam+" · "+attempt.skill+" · "+item.question_text;
          const selected=document.createElement("p");selected.textContent="Votre réponse : "+(item.selected_option===null||item.selected_option===undefined?"Aucune réponse":item.options?.[Number(item.selected_option)]??"Réponse non reconnue");
          const correct=document.createElement("p");correct.textContent="Réponse attendue : "+(item.options?.[Number(item.correct_option)]??"Indisponible");
          card.append(title,selected,correct);
          if(item.explanation){const explanation=document.createElement("p");explanation.className="review-explanation";explanation.textContent="Explication : "+item.explanation;card.append(explanation);}
          errorList.append(card);
        });
      });
      if(!errorCount)errorList.textContent="Aucune erreur à réviser pour le moment. Les prochaines corrections QCM apparaîtront ici.";
      const count=$("#language-error-review-count");if(count)count.textContent=errorCount+" erreur(s) à revoir";
    }
    const skills=["Compréhension orale","Compréhension écrite","Expression orale","Expression écrite"];
    const grid=$("#language-progress-grid");grid.innerHTML="";
    skills.forEach(skill=>{
      const items=attempts.filter(x=>x.skill===skill);
      const scored=items.filter(x=>x.score!==null&&Number(x.max_score)>0);
      const average=scored.length?Math.round(scored.reduce((sum,x)=>sum+Number(x.score)/Number(x.max_score)*100,0)/scored.length):null;
      const card=document.createElement("article");card.className="language-progress-card";
      const title=document.createElement("strong");title.textContent=skill;
      const count=document.createElement("span");count.textContent=items.length+" séance(s) terminée(s)";
      const bar=document.createElement("div");bar.className="progress-track";
      const fill=document.createElement("span");fill.style.width=(average===null?0:average)+"%";bar.append(fill);
      const score=document.createElement("small");score.textContent=average===null?"Pas encore de score QCM":("Moyenne QCM : "+average+" %");
      card.append(title,count,bar,score);grid.append(card);
    });
    const scoredBySkill=skills.map(skill=>{
      const rows=attempts.filter(x=>x.skill===skill&&x.score!==null&&Number(x.max_score)>0);
      const average=rows.length?rows.reduce((sum,x)=>sum+Number(x.score)/Number(x.max_score)*100,0)/rows.length:null;
      return {skill,average,count:rows.length};
    });
    const measured=scoredBySkill.filter(x=>x.average!==null);
    if(!attempts.length){
      $("#language-next-recommendation").textContent="Diagnostic conseillé : commencez par une première séance dans chaque compétence. Vos résultats permettront de construire un programme de révision personnalisé.";
    }else if(!measured.length){
      const missing=skills.find(skill=>!attempts.some(x=>x.skill===skill))||skills[0];
      $("#language-next-recommendation").textContent="Votre historique contient des productions à corriger. Prochaine étape : complétez un exercice de "+missing.toLowerCase()+" pour établir un premier indicateur mesurable.";
    }else{
      const weakest=[...measured].sort((a,b)=>a.average-b.average)[0];
      const strongest=[...measured].sort((a,b)=>b.average-a.average)[0];
      $("#language-next-recommendation").textContent="Priorité de révision : "+weakest.skill+" (moyenne observée : "+Math.round(weakest.average)+" % sur "+weakest.count+" séance(s)). Point fort actuel : "+strongest.skill+". Reprenez les questions incorrectes avant de refaire une série.";
    }
    const targetSelect=$("#language-nclc-target");
    const savedTarget=targetSelect?.value||"";
    const report=$("#language-diagnostic-report");
    if(report){
      report.innerHTML="";
      const heading=document.createElement("strong");
      heading.textContent="Bilan "+selectedExam;
      report.append(heading);
      const target=document.createElement("p");
      target.textContent=savedTarget?"Objectif personnel déclaré : NCLC "+savedTarget+". Cet objectif n’est pas une conversion automatique des pourcentages obtenus.":"Aucun objectif NCLC personnel sélectionné.";
      report.append(target);
      const summary=document.createElement("p");
      const evaluated=scoredBySkill.filter(x=>x.count>0).length;
      summary.textContent=evaluated+"/4 compétences disposent d’un indicateur QCM mesurable. Les productions écrites et orales sont comptabilisées séparément et ne reçoivent pas de pourcentage automatique.";
      report.append(summary);
      const list=document.createElement("ul");
      skills.forEach(skill=>{
        const row=attempts.filter(x=>x.skill===skill);
        const qcm=row.filter(x=>x.score!==null&&Number(x.max_score)>0);
        const production=row.filter(x=>x.score===null);
        const li=document.createElement("li");
        const avg=qcm.length?Math.round(qcm.reduce((sum,x)=>sum+Number(x.score)/Number(x.max_score)*100,0)/qcm.length):null;
        li.textContent=skill+" : "+(avg===null?"pas encore de résultat QCM":avg+" % de réussite observée")+" · "+qcm.length+" QCM · "+production.length+" production(s) enregistrée(s)";
        list.append(li);
      });
      report.append(list);
      const caveat=document.createElement("p");caveat.className="muted small";
      caveat.textContent="Indicateurs internes de progression, non équivalents à un score officiel TCF/TEF ni à une attribution NCLC. Les productions nécessitent une lecture qualitative de leur correction.";
      report.append(caveat);
    }
    await buildAdaptiveLearningPlan(selectedExam, attempts, skills);
    const recommendationButton=$("#language-recommended-practice");
    if(recommendationButton){
      const candidate=measured.length?[...measured].sort((a,b)=>a.average-b.average)[0].skill:skills.find(skill=>!attempts.some(x=>x.skill===skill));
      recommendationButton.classList.toggle("hidden",!candidate);
      recommendationButton.dataset.skill=candidate||"";
      recommendationButton.textContent=candidate?"S’entraîner maintenant : "+candidate:"";
    }
  }
  async function buildAdaptiveLearningPlan(exam, attempts, skills) {
    const host=$("#language-learning-plan-list");
    if(!host)return;
    host.innerHTML="";
    const {data:courses,error}=await sb.from("language_courses")
      .select("id,exam,skill,title,summary,pedagogical_type,estimated_minutes,is_published")
      .eq("is_published",true).in("exam",[exam,"TCF & TEF Canada"])
      .order("lesson_order").limit(100);
    if(error){host.textContent="Parcours indisponible : "+error.message;return;}
    const scored=skills.map(skill=>{
      const rows=attempts.filter(x=>x.skill===skill&&x.score!==null&&Number(x.max_score)>0);
      return {skill,rows,average:rows.length?rows.reduce((sum,x)=>sum+Number(x.score)/Number(x.max_score)*100,0)/rows.length:null,
        productions:attempts.filter(x=>x.skill===skill&&x.score===null).length};
    });
    const ordered=[...scored].sort((a,b)=>{
      if(a.average===null&&b.average!==null)return -1;
      if(b.average===null&&a.average!==null)return 1;
      return (a.average??101)-(b.average??101);
    });
    const steps=ordered.slice(0,3);
    steps.forEach((item,index)=>{
      const lesson=(courses||[]).find(c=>c.skill===item.skill)||
        (courses||[]).find(c=>c.skill==="Méthodologie générale");
      const card=document.createElement("article");card.className="learning-plan-step";
      const heading=document.createElement("div");heading.className="learning-plan-step-heading";
      const number=document.createElement("span");number.className="learning-plan-number";number.textContent=String(index+1);
      const title=document.createElement("strong");title.textContent=item.skill;
      heading.append(number,title);card.append(heading);
      const reason=document.createElement("p");reason.className="muted small";
      if(item.average===null&&item.productions===0)reason.textContent="Aucune évaluation enregistrée : commencez par une première séance pour établir un point de départ.";
      else if(item.average!==null)reason.textContent="Moyenne observée sur "+item.rows.length+" séance(s) QCM : "+Math.round(item.average)+" %. "+(item.average<70?"Priorité de consolidation.":"Entretenez cette compétence avec une nouvelle série.");
      else reason.textContent=item.productions+" production(s) enregistrée(s), sans note automatique : consultez la correction qualitative avant de conclure sur votre niveau.";
      card.append(reason);
      const actions=document.createElement("div");actions.className="learning-plan-actions";
      const practice=document.createElement("button");practice.type="button";practice.className="secondary small-btn";practice.textContent="Faire un exercice";
      practice.addEventListener("click",()=>{
        $("#training-skill").value=item.skill;$("#training-settings").classList.remove("hidden");
        $("#training-skill").dispatchEvent(new Event("change",{bubbles:true}));
        $("#training-task-panel")?.scrollIntoView({behavior:"smooth",block:"start"});
      });
      actions.append(practice);
      if(lesson){
        const courseButton=document.createElement("button");courseButton.type="button";courseButton.className="primary small-btn";
        courseButton.textContent="Étudier : "+lesson.title;
        courseButton.addEventListener("click",async()=>{
          const examFilter=$("#course-library-exam"),skillFilter=$("#course-library-skill");
          if(examFilter)examFilter.value=exam;
          if(skillFilter)skillFilter.value=lesson.skill;
          $("#language-module-navigation")?.classList.add("hidden");
          document.querySelectorAll(".language-module-panel").forEach(panel=>panel.classList.add("hidden"));
          $("#language-module-courses")?.classList.remove("hidden");
          $("#language-courses-list")?.classList.remove("hidden");
          $("#language-course-view")?.classList.add("hidden");
          await loadPublishedLanguageCourses();
          $("#language-module-courses")?.scrollIntoView({behavior:"smooth",block:"start"});
        });
        actions.append(courseButton);
      }
      card.append(actions);host.append(card);
    });
    const note=document.createElement("p");note.className="muted small";
    note.textContent="Ce parcours est une aide pédagogique fondée sur vos séances enregistrées et les fiches publiées. Il ne prédit pas une note officielle et ne remplace pas l’évaluation d’un enseignant.";
    host.append(note);
  }

  $("#language-recommended-practice")?.addEventListener("click",()=>{
    const skill=$("#language-recommended-practice").dataset.skill;
    if(!skill)return;
    $("#training-skill").value=skill;
    $("#training-settings").classList.remove("hidden");
    $("#training-skill").dispatchEvent(new Event("change",{bubbles:true}));
    $("#training-task-panel")?.scrollIntoView({behavior:"smooth",block:"start"});
  });

  const examRules = {
    "TCF Canada": {"Compréhension orale":{count:39,minutes:35},"Compréhension écrite":{count:39,minutes:60},"Expression écrite":{count:3,minutes:60},"Expression orale":{count:3,minutes:12}},
    "TEF Canada": {"Compréhension orale":{count:40,minutes:40},"Compréhension écrite":{count:40,minutes:60},"Expression écrite":{count:2,minutes:60},"Expression orale":{count:2,minutes:15}}
  };
  if($("#mock-exam-format"))updateMockExamFormat();

  async function appendExerciseMedia(container,exercise) {
    if(!exercise)return;
    if(exercise.image_path){
      const url=await getExerciseMediaUrl(exercise.image_path);
      if(url){const img=document.createElement("img");img.src=url;img.alt="Support visuel de l’exercice";img.loading="lazy";img.className="exam-media-image";container.append(img);}
    }
    if(exercise.audio_path){
      const url=await getExerciseMediaUrl(exercise.audio_path);
      if(url){const audio=document.createElement("audio");audio.controls=true;audio.preload="none";audio.src=url;audio.className="exam-media-audio";
        const inMock = !$("#language-module-mock").classList.contains("hidden");
        const activeSkill = inMock ? $("#mock-training-skill").value : $("#training-skill").value;
        if (inMock && activeSkill === "Compréhension orale") {
          audio.controls = false;
          const playButton = document.createElement("button");
          playButton.type = "button";
          playButton.className = "secondary small-btn";
          playButton.textContent = "▶ Écouter le document audio";
          playButton.addEventListener("click", async () => {
            if (playButton.disabled) return;
            playButton.disabled = true;
            playButton.textContent = "Lecture en cours…";
            try { await audio.play(); }
            catch (error) {
              playButton.disabled = false;
              playButton.textContent = "▶ Réessayer l’écoute";
              showNotice("Lecture audio impossible : " + (error.message || "vérifiez votre connexion."), true);
            }
          });
          audio.addEventListener("ended", () => {
            audio.pause();
            playButton.textContent = "Écoute terminée — diffusion unique";
            const note = document.createElement("p");
            note.className = "muted small audio-played-note";
            note.textContent = "Enregistrement diffusé une seule fois dans cette simulation.";
            container.append(note);
          }, { once: true });
          container.append(playButton);
        } else {
          audio.controls = true;
        }
        container.append(audio);}
    } else if(exercise.audio_transcript) {
      addSpeechPlayback(container,exercise.audio_transcript);
    }
  }

  async function renderExamQuestion(question,index,exercise,mediaAlreadyShown,skill) {
    const card=document.createElement("article");card.className="exam-question";
    if(!mediaAlreadyShown && skill==="Compréhension écrite" && exercise?.prompt){
      const source=document.createElement("div");source.className="exam-source-text";
      const sourceTitle=document.createElement("strong");sourceTitle.textContent="Document à lire";
      const sourceBody=document.createElement("p");sourceBody.textContent=exercise.prompt;
      source.append(sourceTitle,sourceBody);card.append(source);
    }
    const title=document.createElement("h4");title.textContent=(index+1)+". "+question.question_text;
    card.append(title);
    if(!mediaAlreadyShown)await appendExerciseMedia(card,exercise);
    question.options.forEach((option,optionIndex)=>{
      const label=document.createElement("label");label.className="exam-option";
      const input=document.createElement("input");input.type="radio";input.name="exam-q-"+question.id;input.value=String(optionIndex);
      const text=document.createElement("span");text.textContent=option;
      label.append(input,text);card.append(label);
    });
    return card;
  }

  // Mock production coverage is counted only when the complete official task set is present.
  function getProductionTaskCoverage(exam, skill, prompt) {
    const text = String(prompt || "");
    if (exam === "TCF Canada") {
      const hasAllThreeNamed = [1, 2, 3].every(number =>
        new RegExp("(?:tâche|production)\\s*" + number + "\\b", "i").test(text)
      );
      const hasThreeNumberedItems = /trois tâches|trois productions/i.test(text) &&
        [1, 2, 3].every(number =>
          new RegExp("(?:^|[\\s:])" + number + "[.)]\\s", "m").test(text)
        );
      const complete = hasAllThreeNamed || hasThreeNumberedItems;
      return { covered: complete ? 3 : 1, total: 3, complete };
    }
    const hasSectionA = /section\s*a/i.test(text);
    const hasSectionB = /section\s*b/i.test(text);
    const complete = hasSectionA && hasSectionB;
    return { covered: complete ? 2 : 1, total: 2, complete };
  }

  async function startExamSession() {
    const inMock = !$("#language-module-mock").classList.contains("hidden");
    const exam = $("#training-exam").value;
    const skill = $(inMock ? "#mock-training-skill" : "#training-skill").value;
    const level = $(inMock ? "#mock-training-level" : "#training-level").value;
    const rule = examRules[exam]?.[skill];
    if (!rule) throw new Error("Cette épreuve n’est pas reconnue pour l’examen sélectionné.");

    const isQcm = skill === "Compréhension orale" || skill === "Compréhension écrite";
    const mixedLevelMock = inMock && isQcm;
    let exerciseQuery = sb.from("language_exercises")
      .select("id,prompt,image_path,audio_path,audio_transcript,level")
      .eq("is_published", true).eq("exam", exam).eq("skill", skill);
    if (mixedLevelMock) exerciseQuery = exerciseQuery.in("level", ["B2", "C1", "C2"]);
    else exerciseQuery = exerciseQuery.eq("level", level);
    const { data: exercises, error } = await exerciseQuery;
    if (error) throw error;
    if (!exercises?.length) throw new Error("Aucun exercice publié pour cette sélection. L’administrateur doit d’abord ajouter des sujets.");
    let questions = [];
    let productionCoverage = null;
    if (isQcm) {
      const ids = exercises.map(item => item.id);
      const { data, error: questionError } = await sb.from("language_exercise_questions")
        .select("id,exercise_id,question_text,options,explanation,sort_order")
        .in("exercise_id", ids).order("sort_order");
      if (questionError) throw questionError;
      const questionsByExercise = new Map();
      (data || []).forEach(question => {
        if (!questionsByExercise.has(question.exercise_id)) questionsByExercise.set(question.exercise_id, []);
        questionsByExercise.get(question.exercise_id).push(question);
      });
      const exerciseOrder = exercises.map(item => item.id).filter(id => questionsByExercise.has(id));
      exerciseOrder.sort(() => Math.random() - 0.5);
      questions = exerciseOrder.flatMap(id =>
        questionsByExercise.get(id).sort((left, right) => left.sort_order - right.sort_order)
      ).slice(0, rule.count);
      if (!questions.length) throw new Error("Les exercices publiés ne contiennent pas encore de questions QCM.");
    } else {
      const candidates = exercises.map(item => ({
        exercise: item,
        coverage: getProductionTaskCoverage(exam, skill, item.prompt)
      }));
      const completeCandidates = candidates.filter(item => item.coverage.complete);
      const pool = completeCandidates.length ? completeCandidates : candidates;
      const selected = pool[Math.floor(Math.random() * pool.length)];
      productionCoverage = selected.coverage;
      questions = [{
        id: selected.exercise.id,
        exercise_id: selected.exercise.id,
        question_text: selected.exercise.prompt,
        options: [],
        correct_option: null,
        explanation: null
      }];
    }

    activeExamQuestions = questions;
    examStartedAt = new Date();
    const allowedMinutes = isQcm
      ? Math.max(5, Math.round(rule.minutes * questions.length / rule.count))
      : (productionCoverage.complete ? rule.minutes : Math.max(5, Math.round(rule.minutes * productionCoverage.covered / productionCoverage.total)));
    examDeadline = Date.now() + allowedMinutes * 60 * 1000;

    const questionIds = isQcm ? questions.map(question => question.id) : [];
    const { data: attempt, error: attemptError } = await sb.from("language_attempts").insert({
      user_id: currentUser.id,
      exam,
      skill,
      level,
      question_ids: questionIds,
      started_at: examStartedAt.toISOString()
    }).select("id").single();
    if (attemptError) throw attemptError;
    activeExamAttemptId = attempt.id;

    $("#exam-session-result").classList.add("hidden");
    $("#exam-session").classList.remove("hidden");
    const sessionKind = isQcm
      ? (questions.length >= rule.count ? "Simulation complète" : "Entraînement partiel")
      : (productionCoverage.complete ? "Simulation complète" : "Entraînement partiel");
    const coverageLabel = isQcm
      ? questions.length + "/" + rule.count + " questions"
      : productionCoverage.covered + "/" + productionCoverage.total + " tâches";
    $("#exam-session-label").textContent = sessionKind + " · " + exam + " · " + skill + " · " + coverageLabel + (mixedLevelMock ? " · questions B2–C2" : " · " + level);

    const list = $("#exam-question-list");
    list.innerHTML = "";
    const exerciseMap = new Map(exercises.map(item => [item.id, item]));
    if (isQcm) {
      const shownMedia = new Set();
      for (let index = 0; index < questions.length; index++) {
        const question = questions[index];
        const seen = shownMedia.has(question.exercise_id);
        list.append(await renderExamQuestion(question, index, exerciseMap.get(question.exercise_id), seen, skill));
        shownMedia.add(question.exercise_id);
      }
    } else {
      const question = questions[0];
      const task = document.createElement("div");
      task.className = "exam-question";
      const prompt = document.createElement("p");
      prompt.textContent = question.question_text;
      task.append(prompt);
      await appendExerciseMedia(task, exerciseMap.get(question.exercise_id));
      list.append(task);
      const area = document.createElement("textarea");
      area.id = "exam-production-answer";
      area.rows = 10;
      area.placeholder = "Réalisez les tâches demandées dans l’ordre indiqué. Séparez clairement vos productions.";
      list.append(area);
      if (skill === "Expression orale") {
        const note = document.createElement("p");
        note.className = "muted small";
        note.textContent = "L’épreuve officielle se déroule face à un examinateur. Cette simulation permet de préparer les tâches, de parler à voix haute, de s’enregistrer et de réécouter sa réponse.";
        list.append(note);
        $("#mock-recording-controls").classList.remove("hidden");
      } else {
        $("#mock-recording-controls").classList.add("hidden");
      }
    }

    $("#finish-exam-session").disabled = false;
    if (exam === "TEF Canada" && skill === "Compréhension orale") {
      const cards = Array.from(list.children);
      if (cards.length > 1) {
        let current = 0;
        cards.forEach((card, index) => { card.hidden = index !== 0; });
        const next = document.createElement("button");
        next.type = "button";
        next.className = "secondary small-btn tef-listening-next";
        next.textContent = "Question 1/" + cards.length + " — Suivante";
        next.addEventListener("click", () => {
          cards[current].hidden = true;
          current++;
          if (current < cards.length) {
            cards[current].hidden = false;
            next.textContent = "Question " + (current + 1) + "/" + cards.length + " — Suivante";
            cards[current].scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            next.remove();
            $("#finish-exam-session").disabled = false;
            $("#finish-exam-session").scrollIntoView({ behavior: "smooth", block: "center" });
            showNotice("Dernière question atteinte. Vous pouvez terminer la session.");
          }
        });
        list.prepend(next);
        $("#finish-exam-session").disabled = true;
      }
    }
    $("#start-exam-session").disabled = true;
    updateExamTimer();
    examTimerHandle = window.setInterval(updateExamTimer, 1000);
  }

  function updateExamTimer() {
    if(!examDeadline)return;
    const remaining=Math.max(0,Math.ceil((examDeadline-Date.now())/1000));
    $("#exam-timer").textContent=String(Math.floor(remaining/60)).padStart(2,"0")+":"+String(remaining%60).padStart(2,"0");
    if(remaining===0)finishExamSession(true);
  }

  function cefrFromScore(score) {
    if (score < 100) return "A1 non atteint";
    if (score < 200) return "A1";
    if (score < 300) return "A2";
    if (score < 400) return "B1";
    if (score < 500) return "B2";
    if (score < 600) return "C1";
    return "C2";
  }

  function nclcFromTcf(examSkill, score) {
    const ranges = examSkill === "Compréhension orale"
      ? [[331,368,4],[369,397,5],[398,457,6],[458,502,7],[503,522,8],[523,548,9],[549,699,10]]
      : examSkill === "Compréhension écrite"
      ? [[342,374,4],[375,405,5],[406,452,6],[453,498,7],[499,523,8],[524,548,9],[549,699,10]]
      : [[4,5,4],[6,6,5],[7,9,6],[10,11,7],[12,13,8],[14,15,9],[16,20,10]];
    for (const [min,max,nclc] of ranges) if (score >= min && score <= max) return nclc;
    return score < (examSkill === "Compréhension orale" ? 331 : examSkill === "Compréhension écrite" ? 342 : 4) ? "<4" : "10+";
  }

  function nclcFromTef(skill, score) {
    const ranges = skill === "Compréhension orale" || skill === "Compréhension écrite"
      ? [[306,351,4],[352,392,5],[393,433,6],[434,461,7],[462,502,8],[503,545,9],[546,572,10],[573,614,11],[615,699,12]]
      : skill === "Expression écrite"
      ? [[268,329,4],[330,378,5],[379,427,6],[428,471,7],[472,511,8],[512,557,9],[558,576,10],[577,618,11],[619,699,12]]
      : [[328,386,4],[387,421,5],[422,455,6],[456,493,7],[494,517,8],[518,555,9],[556,591,10],[592,641,11],[642,699,12]];
    for (const [min,max,nclc] of ranges) if (score >= min && score <= max) return nclc;
    return score < ranges[0][0] ? "<4" : "12";
  }

  function formatMockScore(exam, skill, rawScore, maxScore) {
    // Les simulations utilisent l'échelle d'affichage réelle de chaque examen.
    // Le score calculé reste indicatif : les organismes certificateurs appliquent leur propre étalonnage.

    if (skill === "Expression orale" || skill === "Expression écrite") {
      if (exam === "TCF Canada") {
        const note20 = Math.max(0, Math.min(20, Math.round((rawScore / Math.max(1,maxScore)) * 20)));
        return { value: note20, scale: "/20", level: note20 === 0 ? "A1 non atteint" : note20 <= 1 ? "A1" : note20 <= 5 ? "A2" : note20 <= 9 ? "B1" : note20 <= 13 ? "B2" : note20 <= 17 ? "C1" : "C2", nclc: nclcFromTcf(skill, note20), indicative: true };
      }
    }
    const score = Math.max(0, Math.min(699, Math.round((rawScore / Math.max(1,maxScore)) * 699)));
    return { value: score, scale: "/699", level: cefrFromScore(score), nclc: exam === "TEF Canada" ? nclcFromTef(skill, score) : nclcFromTcf(skill, score), indicative: true };
  }

  async function finishExamSession(timeExpired=false) {
    if(!activeExamAttemptId)return;
    if(examTimerHandle){clearInterval(examTimerHandle);examTimerHandle=null;}
    const answers={};let score=0,maxScore=0;
    const skill=activeExamQuestions.length?$("#exam-session-label").textContent.split(" · ").slice(2,-1).join(" · "):$("#mock-training-skill").value;
    if(skill==="Compréhension écrite"||skill==="Compréhension orale"){
      activeExamQuestions.forEach(q=>{
        const chosen=document.querySelector('input[name="exam-q-'+q.id+'"]:checked');
        const value=chosen?Number(chosen.value):null;
        answers[q.id]=value;
        maxScore++;
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
          exam:$("#training-exam").value,skill,level:$("#mock-training-level").value,
          prompt:activeExamQuestions.map((q,i)=>(i+1)+". "+q.question_text).join("\\n\\n").slice(0,2000),
          answer:production.slice(0,7000)
        }});
        if(correction.error)throw correction.error;
        feedback=correction.data?.feedback||"";
      }catch(error){showNotice("Production enregistrée sans correction IA : "+await functionErrorMessage(error),true);}
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
    const mockScore = maxScore ? formatMockScore($("#training-exam").value, skill, Number(graded.score), Number(graded.max_score)) : null;
    title.textContent=(timeExpired?"Temps écoulé. ":"Session terminée. ")+(maxScore?("Résultat : "+mockScore.value+mockScore.scale+" · "+mockScore.level):"Votre production est enregistrée.");
    result.append(title);
    if(maxScore){
      const scoreNote=document.createElement("p");
      scoreNote.className="mock-score-card";
      scoreNote.innerHTML="<strong>"+mockScore.value+mockScore.scale+"</strong><span>Niveau CECRL : "+mockScore.level+" · NCLC : "+mockScore.nclc+"</span><small>Estimation pédagogique à partir du résultat brut de cette simulation. Le score officiel TCF/TEF est calibré par l’organisme certificateur et ne peut pas être reproduit exactement par CanadaCase.</small>";
      result.append(scoreNote);
      const detail=document.createElement("p");detail.textContent="Réponses correctes : "+graded.score+" · Réponses incorrectes ou non répondues : "+(graded.max_score-graded.score)+".";
      result.append(detail);
      if(Array.isArray(graded.review)&&graded.review.length){
        const reviewTitle=document.createElement("h3");reviewTitle.textContent="Correction détaillée";result.append(reviewTitle);
        graded.review.forEach((item,index)=>{
          const block=document.createElement("article");block.className="exam-answer-review";
          const question=document.createElement("strong");question.textContent=(index+1)+". "+item.question_text;
          const status=document.createElement("p");status.className=item.is_correct?"review-correct":"review-incorrect";
          status.textContent=item.is_correct?"✓ Bonne réponse":"✗ À revoir";
          const chosen=document.createElement("p");chosen.textContent="Votre réponse : "+(item.selected_option===null||item.selected_option===undefined?"Aucune réponse":item.options?.[Number(item.selected_option)]??"Réponse non reconnue");
          const correct=document.createElement("p");correct.textContent="Bonne réponse : "+(item.options?.[Number(item.correct_option)]??"Indisponible");
          block.append(question,status,chosen,correct);
          if(item.explanation){const explanation=document.createElement("p");explanation.className="review-explanation";explanation.textContent="Explication : "+item.explanation;block.append(explanation);}
          result.append(block);
        });
      }else{
        const note=document.createElement("p");note.textContent="Le détail des réponses n'est pas disponible pour cette ancienne session.";result.append(note);
      }
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

  let editingLanguageCourseId=null;
  let editingLanguageCourseResourcePath=null;
  let editingLanguageCourseImagePath=null;
  async function loadAdminLanguageStats() {
    const queries = await Promise.all([
      sb.from("profiles").select("id", { count: "exact", head: true }).eq("role", "candidate"),
      sb.from("language_courses").select("id", { count: "exact", head: true }).eq("is_published", true),
      sb.from("language_exercises").select("id", { count: "exact", head: true }).eq("is_published", true),
      sb.from("language_attempts").select("id", { count: "exact", head: true }).not("completed_at", "is", null)
    ]);
    const ids = ["language-stat-candidates", "language-stat-courses", "language-stat-exercises", "language-stat-attempts"];
    queries.forEach((result, index) => {
      if (result.error) throw result.error;
      const target = $("#" + ids[index]);
      if (target) target.textContent = String(result.count ?? 0);
    });
  }

  async function loadAdminLanguageCourses() {
    const list=$("#language-courses-admin");
    const {data,error}=await sb.from("language_courses")
      .select("id,exam,skill,level,title,summary,content,is_published,source_name,source_url,source_version,source_checked_at,resource_path,image_path,sort_order,created_at,pedagogical_type,section_title,unit_title,lesson_order,objectives,estimated_minutes,key_points,practice_prompt")
      .order("sort_order").order("created_at",{ascending:false}).limit(150);
    if(error)throw error;
    list.innerHTML="";
    (data||[]).forEach(course=>{
      const row=document.createElement("div");row.className="exercise-admin-row";
      const info=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("p"),status=document.createElement("small");
      title.textContent=course.title;meta.textContent=course.exam+" · "+course.skill+" · "+course.level;
      status.textContent=(course.is_published?"Publié":"Brouillon")+(course.source_name?" · Source : "+course.source_name:"");
      info.append(title,meta,status);
      const actions=document.createElement("div");
      const edit=document.createElement("button");edit.type="button";edit.className="secondary small-btn";edit.textContent="Modifier";
      edit.addEventListener("click",()=>{
        const form=$("#language-course-form");
        editingLanguageCourseId=course.id;editingLanguageCourseResourcePath=course.resource_path||null;editingLanguageCourseImagePath=course.image_path||null;
        form.elements.exam.value=course.exam;form.elements.pedagogical_type.value=course.pedagogical_type||"lesson";form.elements.skill.value=course.skill;form.elements.level.value=course.level;
        form.elements.section_title.value=course.section_title||"";form.elements.unit_title.value=course.unit_title||"";
        form.elements.lesson_order.value=course.lesson_order??100;form.elements.estimated_minutes.value=course.estimated_minutes??10;
        form.elements.objectives.value=course.objectives||"";form.elements.key_points.value=course.key_points||"";form.elements.practice_prompt.value=course.practice_prompt||"";
        form.elements.title.value=course.title;form.elements.summary.value=course.summary||"";
        form.elements.content.value=course.content;form.elements.source_name.value=course.source_name||"";
        form.elements.source_url.value=course.source_url||"";form.elements.source_version.value=course.source_version||"";
        form.elements.source_checked_at.value=course.source_checked_at||"";
        form.elements.sort_order.value=course.sort_order??100;form.elements.publish.checked=course.is_published;
        form.querySelector('button[type="submit"]').textContent="Mettre à jour le cours";
        form.scrollIntoView({behavior:"smooth",block:"start"});
      });
      const toggle=document.createElement("button");toggle.type="button";toggle.className="secondary small-btn";toggle.textContent=course.is_published?"Dépublier":"Publier";
      toggle.addEventListener("click",async()=>{const {error}=await sb.from("language_courses").update({is_published:!course.is_published,updated_at:new Date().toISOString()}).eq("id",course.id);if(error){showNotice(error.message,true);return;}await loadAdminLanguageCourses();});
      const remove=document.createElement("button");remove.type="button";remove.className="secondary small-btn danger-btn";remove.textContent="Supprimer";
      remove.addEventListener("click",async()=>{if(!confirm("Supprimer définitivement ce cours ?"))return;const {error}=await sb.from("language_courses").delete().eq("id",course.id);if(error){showNotice(error.message,true);return;}await loadAdminLanguageCourses();showNotice("Cours supprimé.");});
      actions.append(edit,toggle,remove);row.append(info,actions);list.append(row);
    });
    if(!data?.length)list.textContent="Aucun cours personnalisé. Les cours de base sont déjà disponibles.";
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

  async function loadAdminLanguageAttempts() {
    const container=$("#language-training-attempts-admin");
    const {data,error}=await sb.from("language_attempts").select("id,user_id,exam,skill,level,score,max_score,completed_at,duration_seconds,answers,feedback").not("completed_at","is",null).order("completed_at",{ascending:false}).limit(100);
    const {data:voiceRows,error:voiceError}=await sb.from("language_voice_submissions").select("id,user_id,attempt_id,exam,skill,level,prompt,audio_path,mime_type,created_at").order("created_at",{ascending:false}).limit(200);
    if(voiceError){container.textContent="Chargement des vocaux impossible : "+voiceError.message;return;}
    if(error){container.textContent="Suivi indisponible : "+error.message;return;}
    if(!data?.length&&!voiceRows?.length){container.textContent="Aucune séance ou réponse vocale pour le moment.";return;}
    const userIds=[...new Set([...(data||[]).map(x=>x.user_id),...(voiceRows||[]).map(x=>x.user_id)])];
    const {data:profiles, error:profileError}=await sb.from("profiles").select("id,full_name,email").in("id",userIds);
    if(profileError){container.textContent="Profils des apprenants indisponibles : "+profileError.message;return;}
    const profileMap=new Map((profiles||[]).map(p=>[p.id,p]));
    const table=document.createElement("table");
    const head=document.createElement("thead"),headerRow=document.createElement("tr");
    ["Apprenant","Examen","Compétence","Niveau","Résultat","Date","Copie"].forEach(label=>{const th=document.createElement("th");th.textContent=label;headerRow.append(th);});
    head.append(headerRow);table.append(head);
    const body=document.createElement("tbody");
    data.forEach(item=>{
      const row=document.createElement("tr"),person=profileMap.get(item.user_id);
      [person?.full_name||person?.email||"Candidat",item.exam,item.skill,item.level,
       item.score===null?"Production déposée":Number(item.score)+"/"+Number(item.max_score),
       new Date(item.completed_at).toLocaleString("fr-FR")].forEach(value=>{const td=document.createElement("td");td.textContent=value;row.append(td);});
      const detailCell=document.createElement("td"),details=document.createElement("details"),summary=document.createElement("summary"),copy=document.createElement("pre");
      summary.textContent="Consulter";copy.textContent=item.answers?.production||JSON.stringify(item.answers||{},null,2);
      details.append(summary,copy);
      if(item.feedback){const feedback=document.createElement("p");feedback.textContent="Correction IA : "+item.feedback;details.append(feedback);}
      detailCell.append(details);row.append(detailCell);
      body.append(row);
    });
    table.append(body);
    const voiceSection=document.createElement("section");voiceSection.className="admin-voice-submissions";
    const voiceTitle=document.createElement("h3");voiceTitle.textContent="Réponses vocales des candidats";voiceSection.append(voiceTitle);
    if(voiceRows?.length){
      for(const voice of voiceRows){
        const card=document.createElement("article");card.className="voice-submission-card";
        const person=profileMap.get(voice.user_id);
        const heading=document.createElement("strong");heading.textContent=(person?.full_name||person?.email||"Candidat")+" · "+voice.exam+" · "+voice.skill+" · "+voice.level;
        const date=document.createElement("p");date.className="muted small";date.textContent=new Date(voice.created_at).toLocaleString("fr-FR");
        const prompt=document.createElement("p");prompt.textContent=voice.prompt||"Réponse orale";
        const audio=document.createElement("audio");audio.controls=true;audio.preload="none";
        const {data:urlData,error:urlError}=await sb.storage.from("language-recordings").createSignedUrl(voice.audio_path,3600);
        card.append(heading,date,prompt);
        if(!urlError&&urlData?.signedUrl){audio.src=urlData.signedUrl;card.append(audio);}
        else{const unavailable=document.createElement("p");unavailable.className="muted small";unavailable.textContent="Audio momentanément inaccessible.";card.append(unavailable);}
        const transcript=document.createElement("details"),summary=document.createElement("summary"),text=document.createElement("p");
        summary.textContent="Voir la transcription (si disponible)";
        const linkedAttempt=(data||[]).find(a=>a.id===voice.attempt_id);
        text.textContent=linkedAttempt?.answers?.production||"Aucune transcription enregistrée pour ce vocal.";
        transcript.append(summary,text);card.append(transcript);voiceSection.append(card);
      }
    }else{const empty=document.createElement("p");empty.className="muted";empty.textContent="Aucun vocal enregistré pour le moment.";voiceSection.append(empty);}
    container.innerHTML="";container.append(table,voiceSection);
  }

  $("#language-course-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const form=e.currentTarget,button=form.querySelector('button[type="submit"]');
    button.disabled=true;button.textContent="Enregistrement…";
    let resourcePath=null,imagePath=null,saved=false;
    const wasEditing=!!editingLanguageCourseId,oldResourcePath=editingLanguageCourseResourcePath,oldImagePath=editingLanguageCourseImagePath;
    try{
      const file=form.elements.resource.files[0],imageFile=form.elements.course_image.files[0];
      if(file&&(file.type!=="application/pdf"||file.size>20*1024*1024))throw new Error("Le support doit être un PDF de 20 Mo maximum.");
      if(imageFile&&(!["image/jpeg","image/png","image/webp"].includes(imageFile.type)||imageFile.size>8*1024*1024))throw new Error("L’image doit être au format JPG, PNG ou WebP et ne pas dépasser 8 Mo.");
      if(file){
        resourcePath="courses/"+currentUser.id+"/"+crypto.randomUUID()+".pdf";
        const {error:uploadError}=await sb.storage.from("language-media").upload(resourcePath,file,{contentType:"application/pdf",upsert:false});
        if(uploadError)throw uploadError;
      }
      if(imageFile){
        const ext=imageFile.type==="image/png"?"png":imageFile.type==="image/webp"?"webp":"jpg";
        imagePath="courses/"+currentUser.id+"/"+crypto.randomUUID()+"."+ext;
        const {error:imageError}=await sb.storage.from("language-media").upload(imagePath,imageFile,{contentType:imageFile.type,upsert:false});
        if(imageError)throw imageError;
      }
      const payload={
        exam:form.elements.exam.value,skill:form.elements.skill.value,level:form.elements.level.value,
        pedagogical_type:form.elements.pedagogical_type.value,section_title:form.elements.section_title.value.trim()||null,unit_title:form.elements.unit_title.value.trim()||null,
        lesson_order:Number(form.elements.lesson_order.value)||100,estimated_minutes:Number(form.elements.estimated_minutes.value)||10,
        objectives:form.elements.objectives.value.trim()||null,key_points:form.elements.key_points.value.trim()||null,practice_prompt:form.elements.practice_prompt.value.trim()||null,
        title:form.elements.title.value.trim(),summary:form.elements.summary.value.trim()||null,
        content:form.elements.content.value.trim(),source_name:form.elements.source_name.value.trim()||null,
        source_url:form.elements.source_url.value.trim()||null,source_version:form.elements.source_version.value.trim()||null,
        source_checked_at:form.elements.source_checked_at.value||null,
        resource_path:resourcePath||oldResourcePath||null,image_path:imagePath||oldImagePath||null,sort_order:Number(form.elements.sort_order.value)||100,
        is_published:form.elements.publish.checked
      };
      const result=wasEditing
        ? await sb.from("language_courses").update({...payload,updated_at:new Date().toISOString()}).eq("id",editingLanguageCourseId)
        : await sb.from("language_courses").insert({...payload,created_by:currentUser.id});
      if(result.error)throw result.error;
      saved=true;
      if(resourcePath&&oldResourcePath)await sb.storage.from("language-media").remove([oldResourcePath]);
      if(imagePath&&oldImagePath)await sb.storage.from("language-media").remove([oldImagePath]);
      editingLanguageCourseId=null;editingLanguageCourseResourcePath=null;editingLanguageCourseImagePath=null;
      form.reset();form.elements.publish.checked=true;form.elements.sort_order.value="100";
      button.textContent="Enregistrer le cours";
      showNotice(wasEditing?"Cours mis à jour dans l’Académie.":"Cours enregistré dans l’Académie.");
      await loadAdminLanguageCourses();
    }catch(error){
      if(resourcePath&&!saved)await sb.storage.from("language-media").remove([resourcePath]);
      if(imagePath&&!saved)await sb.storage.from("language-media").remove([imagePath]);
      showNotice("Enregistrement du cours impossible : "+error.message,true);
    }finally{button.disabled=false;button.textContent="Enregistrer le cours";}
  });

  $("#sync-language-audio")?.addEventListener("click", async () => {
    const button = $("#sync-language-audio");
    const status = $("#sync-language-audio-status");
    button.disabled = true;
    button.textContent = "Copie des enregistrements…";
    status.textContent = "Vérification des droits administrateur et transfert des fichiers.";
    try {
      const { data, error } = await sb.functions.invoke("sync-language-audio", { body: {} });
      if (error) throw new Error(await functionErrorMessage(error));
      if (data?.error) throw new Error(data.error);
      const copied = Number(data?.copied || 0);
      const failed = Number(data?.failed || 0);
      status.textContent = copied + " fichier(s) copié(s) dans Supabase Storage ; " + failed + " échec(s).";
      if (failed) {
        const details = (data.results || []).filter(item => item.status === "failed")
          .map(item => item.id + " : " + item.detail).join("\\n");
        showNotice("Transfert partiel. " + details, true);
      } else {
        showNotice(copied + " enregistrement(s) audio copié(s) dans le stockage privé de CanadaCase.");
      }
    } catch (error) {
      status.textContent = "Le transfert n’a pas abouti.";
      showNotice("Copie des audios impossible : " + error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "Copier les audios HeyGen dans Supabase Storage";
    }
  });

  $("#language-exercise-form").addEventListener("submit", async e=>{
    e.preventDefault(); const form=e.currentTarget, button=form.querySelector('button[type="submit"]');
    button.disabled=true;button.textContent="Enregistrement…";
    let imagePath=null,audioPath=null,exerciseSaved=false;
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
      exerciseSaved=true;
      form.reset();form.elements.publish.checked=true;showNotice("Exercice enregistré dans la bibliothèque.");
      try{await loadAdminLanguageExercises();}catch(refreshError){showNotice("Exercice enregistré, mais la liste n'a pas pu être actualisée : "+refreshError.message,true);}
    }catch(error){
      if(!exerciseSaved){
        if(imagePath)await sb.storage.from("language-media").remove([imagePath]);
        if(audioPath)await sb.storage.from("language-media").remove([audioPath]);
      }
      showNotice((exerciseSaved?"Exercice enregistré, mais actualisation impossible : ":"Enregistrement de l’exercice impossible : ")+error.message,true);
    }finally{button.disabled=false;button.textContent="Enregistrer l’exercice";}
  });
  let lastRecordingBlob=null;
  let lastRecordingPath=null;
  let lastRecordingSavePromise=null;
  async function saveVoiceSubmission(blob){
    const mimeType=(blob.type||"audio/webm").split(";")[0];
    const ext=mimeType.includes("mp4")?"m4a":mimeType.includes("mpeg")?"mp3":mimeType.includes("wav")?"wav":"webm";
    const path=currentUser.id+"/"+crypto.randomUUID()+"."+ext;
    const {error:uploadError}=await sb.storage.from("language-recordings").upload(path,blob,{contentType:mimeType,upsert:false});
    if(uploadError)throw uploadError;
    const mockMode=!$("#language-module-mock").classList.contains("hidden");
    const exam=$("#training-exam")?.value||"TCF Canada";
    const skill=mockMode?($("#mock-training-skill")?.value||"Expression orale"):($("#training-skill")?.value||"Expression orale");
    const level=mockMode?($("#mock-training-level")?.value||"B2"):($("#training-level")?.value||"B2");
    const prompt=$("#exam-production-answer")?$("#exam-session-label")?.textContent:$("#training-prompt")?.textContent;
    const {error:saveError}=await sb.from("language_voice_submissions").insert({
      user_id:currentUser.id,attempt_id:activeExamAttemptId||null,exam,skill,level,
      prompt:(prompt||"").slice(0,2000),audio_path:path,mime_type:mimeType
    });
    if(saveError){await sb.storage.from("language-recordings").remove([path]);throw saveError;}
    return path;
  }
  function setupRecordingControls(prefix){
    const el=id=>$("#"+prefix+id);
    el("start-recording").addEventListener("click",async()=>{
      try{
        if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error("L'enregistrement audio n'est pas pris en charge. Essayez Safari récent ou Chrome.");
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        recordingChunks=[];lastRecordingPath=null;lastRecordingSavePromise=null;
        const mime=["audio/webm;codecs=opus","audio/mp4","audio/webm"].find(type=>MediaRecorder.isTypeSupported(type));
        mediaRecorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
        mediaRecorder.ondataavailable=e=>{if(e.data.size)recordingChunks.push(e.data);};
        mediaRecorder.onstop=()=>{
          lastRecordingBlob=new Blob(recordingChunks,{type:mediaRecorder.mimeType||"audio/webm"});
          el("recording-preview").src=URL.createObjectURL(lastRecordingBlob);
          el("recording-preview").classList.remove("hidden");
          stream.getTracks().forEach(track=>track.stop());
          el("recording-status").textContent="Enregistrement prêt. Sauvegarde sécurisée en cours…";
          el("transcribe-recording").classList.remove("hidden");
          lastRecordingSavePromise=saveVoiceSubmission(lastRecordingBlob).then(path=>{
            lastRecordingPath=path;
            el("recording-status").textContent="Votre vocal est sauvegardé. Vous pouvez le réécouter et le transcrire.";
          }).catch(error=>{
            el("recording-status").textContent="Échec de sauvegarde du vocal : "+error.message;
            showNotice("Sauvegarde du vocal impossible : "+error.message,true);
            return null;
          });
        };
        mediaRecorder.start();
        el("start-recording").classList.add("hidden");el("stop-recording").classList.remove("hidden");
        el("recording-status").textContent="Enregistrement en cours…";
      }catch(error){showNotice("Microphone indisponible : "+error.message,true);}
    });
    el("stop-recording").addEventListener("click",()=>{
      if(mediaRecorder&&mediaRecorder.state!=="inactive")mediaRecorder.stop();
      el("stop-recording").classList.add("hidden");el("start-recording").classList.remove("hidden");
    });
    el("transcribe-recording").addEventListener("click",async()=>{
      if(!lastRecordingBlob)return;
      const button=el("transcribe-recording");button.disabled=true;button.textContent="Transcription…";
      try{
        await lastRecordingSavePromise;
        if(!lastRecordingPath)throw new Error("Le vocal n’a pas été sauvegardé.");
        const {data,error}=await sb.functions.invoke("language-coach",{body:{action:"transcribe",file_path:lastRecordingPath}});
        if(error)throw error;
        if(!data?.transcript)throw new Error(data?.error||"Transcription vide.");
        const mockMode=!$("#language-module-mock").classList.contains("hidden");
        const destination=mockMode?$("#exam-production-answer"):$("#training-answer");
        if(destination)destination.value=(destination.value.trim()+"\n"+data.transcript).trim();
        el("recording-status").textContent="Vocal sauvegardé et transcription ajoutée. L’administrateur pourra écouter votre enregistrement.";
      }catch(error){showNotice("Transcription impossible : "+await functionErrorMessage(error),true);}
      finally{button.disabled=false;button.textContent="Transcrire l’enregistrement";}
    });
  }
  setupRecordingControls("");
  setupRecordingControls("mock-");

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
      feedback.textContent = await functionErrorMessage(error);
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

  const documentCategories = [
    "Passeport", "Acte de naissance", "Diplôme", "Relevés de notes", "EDE",
    "Attestation de travail", "Contrat de travail", "Test linguistique",
    "Relevé bancaire", "Preuve de fonds", "ITA", "Certificat de police",
    "Visite médicale", "Autre"
  ];

  async function callDocumentManager(body) {
    const { data, error } = await sb.functions.invoke("manage-case-document", { body });
    if (error) throw new Error(await functionErrorMessage(error));
    if (data?.error) throw new Error(data.error);
    return data || {};
  }

  let activeDocumentPreview = null;

  function closeDocumentPreview() {
    if (!activeDocumentPreview) return;
    document.removeEventListener("keydown", activeDocumentPreview.onKeydown);
    activeDocumentPreview.overlay.remove();
    document.body.style.overflow = activeDocumentPreview.previousOverflow;
    activeDocumentPreview = null;
  }

  async function openDocumentPreview(storagePath, fileName, mimeType) {
    if (!storagePath) {
      showNotice("Aucun fichier n’est associé à ce document.", true);
      return;
    }
    closeDocumentPreview();
    const overlay = document.createElement("div");
    overlay.className = "document-preview-overlay";
    overlay.setAttribute("role", "presentation");
    const dialog = document.createElement("section");
    dialog.className = "document-preview-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Aperçu du document " + (fileName || ""));
    const header = document.createElement("header");
    header.className = "document-preview-header";
    const heading = document.createElement("strong");
    heading.className = "document-preview-name";
    heading.textContent = fileName || "Document";
    const controls = document.createElement("div");
    controls.className = "document-preview-controls";
    const download = document.createElement("a");
    download.className = "secondary small-btn doc-action-link";
    download.textContent = "Télécharger";
    download.setAttribute("aria-label", "Télécharger " + (fileName || "le document"));
    const close = document.createElement("button");
    close.type = "button";
    close.className = "secondary small-btn";
    close.textContent = "Fermer";
    close.addEventListener("click", closeDocumentPreview);
    controls.append(download, close);
    header.append(heading, controls);
    const body = document.createElement("div");
    body.className = "document-preview-body";
    const loading = document.createElement("p");
    loading.className = "muted";
    loading.textContent = "Chargement sécurisé du document…";
    body.append(loading);
    dialog.append(header, body);
    overlay.append(dialog);
    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeDocumentPreview();
    });
    const onKeydown = event => {
      if (event.key === "Escape") closeDocumentPreview();
    };
    activeDocumentPreview = { overlay, onKeydown, previousOverflow: document.body.style.overflow };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeydown);
    document.body.append(overlay);
    close.focus();

    try {
      const { data, error } = await sb.storage.from("case-documents").createSignedUrl(storagePath, 600);
      if (error || !data?.signedUrl) throw error || new Error("Lien temporaire indisponible.");
      const { data: downloadData, error: downloadError } = await sb.storage
        .from("case-documents").createSignedUrl(storagePath, 600, { download: true });
      if (!activeDocumentPreview || activeDocumentPreview.overlay !== overlay) return;
      loading.remove();
      if (!downloadError && downloadData?.signedUrl) {
        download.href = downloadData.signedUrl;
        download.rel = "noopener noreferrer";
        download.setAttribute("download", fileName || "");
      } else {
        download.classList.add("hidden");
      }
      const type = String(mimeType || "").toLowerCase();
      const extension = String(fileName || "").split(".").pop().toLowerCase();
      if (type === "application/pdf" || extension === "pdf") {
        const frame = document.createElement("iframe");
        frame.className = "document-preview-frame";
        frame.src = data.signedUrl;
        frame.title = "Aperçu PDF : " + (fileName || "document");
        frame.loading = "eager";
        body.append(frame);
      } else if (type.startsWith("image/") || ["jpg","jpeg","png","webp","gif"].includes(extension)) {
        const image = document.createElement("img");
        image.className = "document-preview-image";
        image.src = data.signedUrl;
        image.alt = fileName || "Document image";
        image.addEventListener("error", () => {
          body.textContent = "L’aperçu de cette image est impossible. Utilisez le téléchargement.";
        }, { once: true });
        body.append(image);
      } else {
        const message = document.createElement("p");
        message.className = "document-preview-unavailable";
        message.textContent = "L’aperçu intégré n’est pas disponible pour ce format. Vous pouvez télécharger le fichier.";
        body.append(message);
        const open = document.createElement("a");
        open.href = data.signedUrl;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
        open.textContent = "Ouvrir dans un nouvel onglet";
        body.append(open);
      }
    } catch (error) {
      if (activeDocumentPreview?.overlay === overlay) {
        body.textContent = "Impossible d’afficher ce document : " + (error?.message || "lien temporaire indisponible") + ". Fermez cette fenêtre et réessayez.";
        download.classList.add("hidden");
      }
    }
  }

  async function loadDocuments() {
    const { data, error } = await sb
      .from("case_documents")
      .select("id,category,file_name,storage_path,mime_type,size_bytes,status,created_at")
      .eq("user_id", currentUser.id)
      .or(`candidate_case_id.eq.${activeCaseId},candidate_case_id.is.null`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    candidateDocumentsCache = data || [];
    renderCandidateTravelOverview();
    const el = $("#documents-list");
    el.innerHTML = "";

    if (!data?.length) {
      el.textContent = "Aucun document déposé.";
      return;
    }

    for (const d of data) {
      const row = document.createElement("div");
      row.className = "doc-row";

      const info = document.createElement("div");
      info.className = "doc-row-info";
      const name = document.createElement("strong");
      name.textContent = d.file_name;

      const meta = document.createElement("span");
      meta.textContent =
        `${d.category} · ${Math.ceil((d.size_bytes || 0) / 1024)} Ko · ${d.status}`;
      info.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "doc-row-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary small-btn";
      edit.textContent = "Modifier";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary small-btn danger-btn";
      remove.textContent = "Supprimer";

      edit.addEventListener("click", () => {
        const existing = row.querySelector(".doc-edit-form");
        if (existing) { existing.remove(); edit.textContent = "Modifier"; return; }
        const editor = document.createElement("form");
        editor.className = "doc-edit-form";
        const categoryLabel = document.createElement("label");
        categoryLabel.textContent = "Type de document";
        const category = document.createElement("select");
        category.required = true;
        documentCategories.forEach(value => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value;
          category.append(option);
        });
        category.value = d.category;
        categoryLabel.append(category);

        const fileLabel = document.createElement("label");
        fileLabel.textContent = "Remplacer le fichier (facultatif)";
        const file = document.createElement("input");
        file.type = "file";
        file.accept = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
        fileLabel.append(file);

        const help = document.createElement("small");
        help.className = "muted small";
        help.textContent = "Laissez vide pour modifier uniquement la catégorie. PDF, JPG ou PNG · 10 Mo maximum.";

        const save = document.createElement("button");
        save.type = "submit";
        save.className = "primary small-btn";
        save.textContent = "Enregistrer";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "secondary small-btn";
        cancel.textContent = "Annuler";
        cancel.addEventListener("click", () => { editor.remove(); edit.textContent = "Modifier"; });
        editor.append(categoryLabel, fileLabel, help, save, cancel);
        editor.addEventListener("submit", async event => {
          event.preventDefault();
          const selectedFile = file.files[0] || null;
          let newPath = null;
          save.disabled = true;
          cancel.disabled = true;
          save.textContent = "Enregistrement…";
          try {
            const payload = { action: "update", document_id: d.id, category: category.value };
            if (selectedFile) {
              if (selectedFile.size > 10 * 1024 * 1024) throw new Error("Fichier trop volumineux : limite de 10 Mo.");
              const ext = selectedFile.name.split(".").pop().toLowerCase();
              if (!["pdf", "png", "jpg", "jpeg"].includes(ext) ||
                  !["application/pdf", "image/png", "image/jpeg"].includes(selectedFile.type)) {
                throw new Error("Format non accepté. Utilisez un PDF, JPG ou PNG.");
              }
              newPath = currentUser.id + "/" + crypto.randomUUID() + "." + ext;
              const { error: uploadError } = await sb.storage.from("case-documents").upload(newPath, selectedFile, {
                contentType: selectedFile.type, upsert: false
              });
              if (uploadError) throw uploadError;
              Object.assign(payload, {
                new_storage_path: newPath,
                file_name: selectedFile.name,
                mime_type: selectedFile.type,
                size_bytes: selectedFile.size
              });
            }
            const result = await callDocumentManager(payload);
            editor.remove();
            await loadDocuments();
            showNotice(result.warning || (selectedFile
              ? "Document remplacé. Il repasse à l’étape de vérification."
              : "Catégorie du document mise à jour."));
          } catch (error) {
            if (newPath) await sb.storage.from("case-documents").remove([newPath]);
            showNotice("Modification impossible : " + error.message, true);
            save.disabled = false;
            cancel.disabled = false;
            save.textContent = "Réessayer";
          }
        });
        row.append(editor);
        edit.textContent = "Fermer";
      });

      remove.addEventListener("click", async () => {
        if (!window.confirm("Supprimer définitivement « " + d.file_name + " » ? Cette action est irréversible.")) return;
        remove.disabled = true;
        edit.disabled = true;
        remove.textContent = "Suppression…";
        try {
          const result = await callDocumentManager({ action: "delete", document_id: d.id });
          await loadDocuments();
          showNotice(result.warning || "Document supprimé.");
        } catch (error) {
          showNotice("Suppression impossible : " + error.message, true);
          remove.disabled = false;
          edit.disabled = false;
          remove.textContent = "Supprimer";
        }
      });

      if (d.storage_path) {
        const { data: previewData, error: previewError } = await sb.storage
          .from("case-documents").createSignedUrl(d.storage_path, 600);
        if (!previewError && previewData?.signedUrl) {
          const preview = document.createElement("button");
          preview.type = "button";
          preview.className = "secondary small-btn doc-action-link";
          preview.textContent = "Consulter";
          preview.addEventListener("click", () => openDocumentPreview(d.storage_path, d.file_name, d.mime_type));
          const download = document.createElement("a");
          download.href = previewData.signedUrl;
          download.rel = "noopener noreferrer";
          download.className = "secondary small-btn doc-action-link";
          download.textContent = "Télécharger";
          download.addEventListener("click", event => {
            event.preventDefault();
            sb.storage.from("case-documents").createSignedUrl(d.storage_path, 600, { download: true })
              .then(({ data: result, error }) => {
                if (error || !result?.signedUrl) throw error || new Error("Lien de téléchargement indisponible.");
                window.location.assign(result.signedUrl);
              })
              .catch(error => showNotice("Téléchargement impossible : " + error.message, true));
          });
          actions.append(preview, download);
        } else {
          const unavailable = document.createElement("span");
          unavailable.className = "muted small";
          unavailable.textContent = "Fichier momentanément inaccessible";
          actions.append(unavailable);
        }
      }
      actions.append(edit, remove);
      row.append(info, actions);
      el.append(row);
    }
  }

  async function loadClientUpdates() {
    const host = $("#client-updates");
    const nextActionHost = $("#client-next-action");
    if (!host || !nextActionHost || !activeCaseId) return;
    host.textContent = "Chargement du suivi…";
    nextActionHost.innerHTML = "";

    const [eventsResult, legacyResult] = await Promise.all([
      sb.from("candidate_case_events")
        .select("id,event_type,title,description,status,due_date,created_at")
        .eq("candidate_case_id", activeCaseId)
        .eq("is_candidate_visible", true)
        .order("created_at", { ascending: false }),
      sb.from("case_updates")
        .select("message,created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(30)
    ]);
    if (eventsResult.error) throw eventsResult.error;
    if (legacyResult.error) throw legacyResult.error;

    const events = eventsResult.data || [];
    const knownMessages = new Set(events.map(e => e.description).filter(Boolean));
    const legacy = (legacyResult.data || [])
      .filter(u => u.message && !knownMessages.has(u.message))
      .map(u => ({
        id: "legacy-" + u.created_at,
        event_type: "update",
        title: "Mise à jour de votre conseiller",
        description: u.message,
        status: "completed",
        due_date: null,
        created_at: u.created_at
      }));
    const timeline = [...events, ...legacy].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    const pending = events
      .filter(e => ["task", "deadline"].includes(e.event_type) && ["open", "in_progress"].includes(e.status))
      .sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    if (pending.length) {
      const item = pending[0];
      const card = document.createElement("article");
      card.className = "client-next-action-card";
      const kicker = document.createElement("span");
      kicker.className = "eyebrow";
      kicker.textContent = item.event_type === "deadline" ? "ÉCHÉANCE À SUIVRE" : "VOTRE PROCHAINE ACTION";
      const heading = document.createElement("strong");
      heading.textContent = item.title;
      const description = document.createElement("p");
      description.textContent = item.description || "Consultez les détails de cette étape auprès de votre conseiller.";
      card.append(kicker, heading, description);
      if (item.due_date) {
        const due = document.createElement("small");
        due.textContent = "Date limite : " + formatCaseDate(item.due_date);
        card.append(due);
      }
      nextActionHost.append(card);
    } else {
      const emptyNext = document.createElement("p");
      emptyNext.className = "muted small";
      emptyNext.textContent = "Aucune action ou échéance en attente pour le moment.";
      nextActionHost.append(emptyNext);
    }

    host.innerHTML = "";
    if (!timeline.length) {
      host.textContent = "Aucun événement enregistré pour ce dossier.";
      return;
    }
    timeline.forEach(event => {
      const item = document.createElement("article");
      item.className = "case-timeline-item";
      const marker = document.createElement("span");
      marker.className = "case-timeline-marker " + (event.event_type || "update");
      const content = document.createElement("div");
      content.className = "case-timeline-content";
      const heading = document.createElement("strong");
      heading.textContent = event.title || "Mise à jour";
      const detail = document.createElement("p");
      detail.textContent = event.description || "";
      const meta = document.createElement("small");
      const date = new Date(event.created_at);
      meta.textContent = Number.isNaN(date.getTime()) ? "" : date.toLocaleString("fr-FR");
      if (event.due_date) meta.textContent += " · Échéance : " + formatCaseDate(event.due_date);
      if (event.event_type === "task" || event.event_type === "deadline") {
        const labels = { open: "À faire", in_progress: "En cours", completed: "Terminé", cancelled: "Annulé" };
        meta.textContent += " · " + (labels[event.status] || event.status);
      }
      content.append(heading);
      if (detail.textContent) content.append(detail);
      content.append(meta);
      item.append(marker, content);
      host.append(item);
    });
  }

  function renderAdminWorkspacePicker() {
    $("#admin-workspace-picker").classList.remove("hidden");
    $("#admin-immigration-workspace").classList.add("hidden");
    $("#admin-language-workspace").classList.add("hidden");
    $("#admin-detail").classList.add("hidden");
    $("#admin-workspace-heading").textContent = "Que souhaitez-vous gérer ?";
  }

  function renderAdminWorkspace(workspace) {
    $("#admin-workspace-picker").classList.add("hidden");
    $("#admin-immigration-workspace").classList.toggle("hidden", workspace !== "immigration");
    $("#admin-language-workspace").classList.toggle("hidden", workspace !== "language");
    $("#admin-detail").classList.add("hidden");
    $("#admin-workspace-heading").textContent = workspace === "language"
      ? "Administration — Préparation TCF / TEF"
      : "Administration — Projet de voyage et immigration";
  }

  document.querySelectorAll("[data-admin-workspace]").forEach(button =>
    button.addEventListener("click", () => setWorkspace(button.dataset.adminWorkspace))
  );

  document.querySelectorAll("[data-admin-jump]").forEach(button => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.adminJump);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelectorAll("[data-admin-jump]").forEach(item => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-current", item === button ? "location" : "false");
      });
    });
  });

  const adminCaseStatuses = [
    "À compléter",
    "À examiner",
    "Documents manquants",
    "En traitement",
    "Dossier complet",
    "Soumis",
    "ITA reçu",
    "RP obtenue",
    "Refusé",
    "Clôturé"
  ];
  let activeAdminStatusFilter = "";

  function renderAdminStatusSummary(cases) {
    const container = $("#admin-status-summary");
    if (!container) return;
    container.innerHTML = "";
    const counts = new Map(adminCaseStatuses.map(status => [status, 0]));
    cases.forEach(item => {
      const status = adminCaseStatuses.includes(item.status) ? item.status : "À compléter";
      counts.set(status, (counts.get(status) || 0) + 1);
    });
    const heading = document.createElement("div");
    heading.className = "admin-status-summary-heading";
    heading.textContent = "Dossiers par statut";
    container.append(heading);
    const strip = document.createElement("div");
    strip.className = "admin-status-strip";
    const all = document.createElement("button");
    all.type = "button";
    all.className = "admin-status-chip" + (!activeAdminStatusFilter ? " active" : "");
    all.innerHTML = '<span>Tous les dossiers</span><strong>' + cases.length + '</strong>';
    all.onclick = () => { activeAdminStatusFilter = ""; loadAdmin("immigration"); };
    strip.append(all);
    adminCaseStatuses.forEach(status => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-status-chip" + (activeAdminStatusFilter === status ? " active" : "");
      const label = document.createElement("span");
      label.textContent = status;
      const count = document.createElement("strong");
      count.textContent = String(counts.get(status) || 0);
      button.append(label, count);
      button.setAttribute("aria-pressed", activeAdminStatusFilter === status ? "true" : "false");
      button.onclick = () => {
        activeAdminStatusFilter = activeAdminStatusFilter === status ? "" : status;
        loadAdmin("immigration");
      };
      strip.append(button);
    });
    container.append(strip);
  }

  async function loadAdmin(workspace = activeAdminWorkspace) {
    if (workspace === "language") {
      await loadAdminLanguageStats();
      await loadAdminLanguageCourses();
      await loadAdminLanguageExercises();
      await loadAdminLanguageAttempts();
      return;
    }
    if (workspace !== "immigration") return;
    const [
      { data: profiles, error: pErr },
      { data: cases, error: cErr },
      { data: docs, error: dErr },
      { data: academyRoles, error: rErr }
    ] = await Promise.all([
      sb.from("profiles").select("id,full_name,email,created_at,is_active,role").order("created_at", { ascending: false }),
      sb.from("candidate_cases").select("id,user_id,case_number,program_key,process_stage,status,data,updated_at").order("updated_at", { ascending: false }),
      sb.from("case_documents").select("id,user_id,status"),
      sb.from("academy_user_roles").select("user_id,role_code")
    ]);
    if (pErr) throw pErr;
    if (cErr) throw cErr;
    if (dErr) throw dErr;
    if (rErr) throw rErr;
    const clients = profiles.filter(p => p.id !== currentUser.id && p.role !== "admin");
    const clientIds = new Set(clients.map(p => p.id));
    const candidateCases = cases.filter(c => clientIds.has(c.user_id));
    const candidateDocs = docs.filter(d => clientIds.has(d.user_id));
    const rolesByUser = new Map();
    (academyRoles || []).forEach(item => {
      if (!rolesByUser.has(item.user_id)) rolesByUser.set(item.user_id, new Set());
      rolesByUser.get(item.user_id).add(item.role_code);
    });
    const roleLabels = {
      candidate: "Candidat immigration",
      learner: "Apprenant",
      trainer: "Formateur",
      admin: "Administrateur"
    };
    const formatRole = code => roleLabels[code] || code;
    const roleNames = p => {
      const set = new Set();
      if (p.role) set.add(p.role);
      (rolesByUser.get(p.id) || new Set()).forEach(code => set.add(code));
      return [...set];
    };
    $("#stat-candidates").textContent = clients.length;
    $("#stat-total").textContent = candidateCases.length;
    $("#stat-active-cases").textContent = candidateCases.filter(c => !["Clôturé", "Refusé", "RP obtenue"].includes(c.status)).length;
    $("#stat-docs").textContent = candidateDocs.length;
    renderAdminStatusSummary(candidateCases);

    // Une seule ligne par compte : les fonctions et tous les dossiers sont consultables au déroulement.
    const tbody = $("#clients-table");
    tbody.innerHTML = "";
    clients.forEach(p => {
      const userCases = cases
        .filter(c => c.user_id === p.id && (!activeAdminStatusFilter || c.status === activeAdminStatusFilter))
        .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
      if (activeAdminStatusFilter && !userCases.length) return;

      const roles = roleNames(p);
      const latest = userCases[0]?.updated_at;
      const mainRow = document.createElement("tr");
      mainRow.className = "admin-person-row";

      const identityCell = document.createElement("td");
      identityCell.className = "admin-person-identity";
      const name = document.createElement("strong");
      name.textContent = p.full_name || "Nom non renseigné";
      const email = document.createElement("small");
      email.textContent = p.email || "Adresse e-mail non renseignée";
      identityCell.append(name, email);

      const rolesCell = document.createElement("td");
      rolesCell.className = "admin-role-cell";
      roles.forEach(code => {
        const chip = document.createElement("span");
        chip.className = "admin-role-chip role-" + String(code).replace(/[^a-z0-9_-]/gi, "");
        chip.textContent = formatRole(code);
        rolesCell.append(chip);
      });

      const casesCell = document.createElement("td");
      const expandButton = document.createElement("button");
      expandButton.type = "button";
      expandButton.className = "admin-expand-cases";
      expandButton.textContent = userCases.length
        ? userCases.length + (userCases.length > 1 ? " dossiers  ▾" : " dossier  ▾")
        : "Aucun dossier";
      expandButton.disabled = !userCases.length;
      casesCell.append(expandButton);

      const dateCell = document.createElement("td");
      dateCell.textContent = latest ? new Date(latest).toLocaleDateString("fr-FR") : "—";

      const accountCell = document.createElement("td");
      const accountBadge = document.createElement("span");
      accountBadge.className = "admin-account-badge " + (p.is_active === false ? "is-disabled" : "is-active");
      accountBadge.textContent = p.is_active === false ? "Désactivé" : "Actif";
      accountCell.append(accountBadge);

      const actionsCell = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "admin-person-actions";

      if (roles.includes("candidate") && p.is_active !== false) {
        const recoveryButton = document.createElement("button");
        recoveryButton.type = "button";
        recoveryButton.className = "secondary small-btn";
        recoveryButton.textContent = "Réinitialiser mot de passe";
        recoveryButton.title = "Envoyer au candidat un lien sécurisé de réinitialisation par e-mail";
        recoveryButton.onclick = async () => {
          const identity = p.full_name || p.email || "ce candidat";
          if (!window.confirm("Envoyer un lien de réinitialisation du mot de passe à " + identity + " (" + (p.email || "adresse e-mail du compte") + ") ?")) return;
          recoveryButton.disabled = true;
          recoveryButton.textContent = "Envoi…";
          try {
            const { data, error } = await sb.functions.invoke("admin-user-management", {
              body: { action: "send_password_recovery", user_id: p.id }
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "L'envoi du lien n'a pas été confirmé.");
            showNotice("Lien de réinitialisation envoyé à " + (p.email || "l'adresse e-mail du candidat") + ".");
          } catch (error) {
            showNotice("Envoi du lien impossible : " + error.message, true);
          } finally {
            recoveryButton.disabled = false;
            recoveryButton.textContent = "Réinitialiser mot de passe";
          }
        };
        actions.append(recoveryButton);

        if (p.role === "candidate") {
          const promoteButton = document.createElement("button");
          promoteButton.type = "button";
          promoteButton.className = "secondary small-btn";
          promoteButton.textContent = "Nommer administrateur";
          promoteButton.title = "Accorder les droits administrateur à ce candidat";
          promoteButton.onclick = async () => {
            const identity = p.full_name || p.email || "ce candidat";
            if (!window.confirm("Confirmer la nomination de " + identity + " comme administrateur ? Cette personne aura accès à l'espace d'administration et aux données de gestion.")) return;
            promoteButton.disabled = true;
            promoteButton.textContent = "Nomination…";
            try {
              const { data, error } = await sb.functions.invoke("admin-user-management", {
                body: { action: "promote_admin", user_id: p.id, confirmation: "NOMMER ADMINISTRATEUR" }
              });
              if (error) throw error;
              if (!data?.success || data?.role !== "admin") throw new Error(data?.error || "La nomination n'a pas été confirmée.");
              showNotice("Nomination effectuée. " + identity + " dispose maintenant du rôle administrateur.");
              await loadAdmin();
            } catch (error) {
              showNotice("Nomination impossible : " + error.message, true);
              promoteButton.disabled = false;
              promoteButton.textContent = "Nommer administrateur";
            }
          };
          actions.append(promoteButton);
        }
      }

      const toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "ghost small-btn";
      toggleButton.textContent = p.is_active === false ? "Réactiver" : "Désactiver";
      toggleButton.onclick = async () => {
        const action = p.is_active === false ? "enable" : "disable";
        const verb = action === "enable" ? "réactiver" : "désactiver";
        if (!window.confirm("Confirmer la demande pour " + (p.full_name || p.email || "ce compte") + " ?")) return;
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
      deleteButton.type = "button";
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
      actions.append(toggleButton, deleteButton);
      actionsCell.append(actions);
      mainRow.append(identityCell, rolesCell, casesCell, dateCell, accountCell, actionsCell);

      const detailsRow = document.createElement("tr");
      detailsRow.className = "admin-person-details-row hidden";
      const detailsCell = document.createElement("td");
      detailsCell.colSpan = 6;
      const detailsPanel = document.createElement("div");
      detailsPanel.className = "admin-person-details";
      const detailsHeading = document.createElement("div");
      detailsHeading.className = "admin-person-details-heading";
      const detailsTitle = document.createElement("strong");
      detailsTitle.textContent = "Fonctions et dossiers de " + (p.full_name || "ce compte");
      const detailsRoles = document.createElement("div");
      detailsRoles.className = "admin-role-list";
      roles.forEach(code => {
        const chip = document.createElement("span");
        chip.className = "admin-role-chip role-" + String(code).replace(/[^a-z0-9_-]/gi, "");
        chip.textContent = formatRole(code);
        detailsRoles.append(chip);
      });
      detailsHeading.append(detailsTitle, detailsRoles);
      detailsPanel.append(detailsHeading);

      if (userCases.length) {
        const caseTable = document.createElement("table");
        caseTable.className = "admin-nested-cases";
        const head = document.createElement("thead");
        const headRow = document.createElement("tr");
        ["Procédure", "Référence", "Étape", "Statut", "Mise à jour", "Action"].forEach(label => {
          const th = document.createElement("th");
          th.textContent = label;
          headRow.append(th);
        });
        head.append(headRow);
        const body = document.createElement("tbody");
        userCases.forEach(c => {
          const row = document.createElement("tr");
          const values = [
            c?.data?.program || c?.program_key || "—",
            c?.case_number || "Dossier",
            c?.process_stage === "ita_response" ? "Répondre à l’ITA" : "Déclaration d’intérêt",
            c?.status || "À compléter",
            c?.updated_at ? new Date(c.updated_at).toLocaleDateString("fr-FR") : "—"
          ];
          values.forEach(value => {
            const td = document.createElement("td");
            td.textContent = value;
            row.append(td);
          });
          const actionCell = document.createElement("td");
          const openButton = document.createElement("button");
          openButton.type = "button";
          openButton.className = "secondary small-btn";
          openButton.textContent = "Ouvrir";
          openButton.onclick = () => openCase(p, c);
          actionCell.append(openButton);
          row.append(actionCell);
          body.append(row);
        });
        caseTable.append(head, body);
        detailsPanel.append(caseTable);
      } else {
        const empty = document.createElement("p");
        empty.className = "muted small";
        empty.textContent = "Aucun dossier d’immigration enregistré pour ce compte.";
        detailsPanel.append(empty);
      }

      detailsCell.append(detailsPanel);
      detailsRow.append(detailsCell);
      expandButton.onclick = () => {
        const willOpen = detailsRow.classList.contains("hidden");
        detailsRow.classList.toggle("hidden", !willOpen);
        expandButton.textContent = userCases.length
          ? userCases.length + (userCases.length > 1 ? (willOpen ? " dossiers  ▴" : " dossiers  ▾") : (willOpen ? " dossier  ▴" : " dossier  ▾"))
          : "Aucun dossier";
        expandButton.setAttribute("aria-expanded", String(willOpen));
      };
      tbody.append(mainRow, detailsRow);
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

    const adminQuick = document.createElement("div");
    adminQuick.className = "admin-case-quick-grid";
    const data = c.data || {};
    const nextAction = data.ita_received === "yes"
      ? (data.submission_deadline ? "Préparer la soumission avant l’ITA." : "Vérifier les pièces de la demande après ITA.")
      : (!data.french_test_taken || data.french_test_taken === "no" ? "Faire / vérifier le test linguistique." : (!data.ede_done || data.ede_done === "no" ? "Compléter l’EDE." : "Vérifier les documents et les prochaines échéances."));
    adminQuick.innerHTML = '<article><span>Prochaine action</span><strong>'+String(nextAction).replace(/[<>&"]/g,"")+'</strong></article><article><span>Progression indicative</span><strong>'+Math.round((Object.values(data).filter(v=>String(v??"").trim()).length/Math.max(1,Object.keys(data).length))*100)+' %</strong></article>';
    const adminChecklist = document.createElement("div");
    adminChecklist.className = "admin-case-checklist";
    const adminSteps = [
      ["Identité et famille", !!(data.last_name && data.first_names && data.marital_status)],
      ["Études / EDE", !!(data.education_level && data.degree && data.ede_done === "yes")],
      ["Expérience", !!(data.employer && data.job_title && data.job_start)],
      ["Langues", !!(data.french_test_taken === "yes" && data.french_test)],
      ["Passeport", !!(data.passport_number && data.passport_expiry)],
      ["Fonds / ITA", !!(data.funds_cad || data.ita_received)]
    ];
    adminChecklist.innerHTML = '<div class="case-subheading"><h3>Checklist</h3><span>'+adminSteps.filter(x=>x[1]).length+'/'+adminSteps.length+'</span></div>'+adminSteps.map(([label,done])=>'<div class="case-check-item '+(done?"done":"")+'"><span>'+(done?"✓":"○")+'</span><strong>'+label+'</strong><small>'+(done?"Renseigné":"À vérifier")+'</small></div>').join("");
    const adminDeadlines = document.createElement("div");
    adminDeadlines.className = "admin-case-deadlines";
    const dates = [["Passeport",data.passport_expiry],["EDE",data.ede_expiry],["ITA",data.ita_date],["Soumission",data.submission_deadline]].filter(x=>x[1]);
    adminDeadlines.innerHTML = '<div class="case-subheading"><h3>Échéances</h3></div>'+(dates.length?dates.map(([label,date])=>'<div class="case-deadline-item"><strong>'+label+'</strong><span>'+formatCaseDate(date)+'</span></div>').join(""):'<p class="muted small">Aucune date renseignée.</p>');
    adminQuick.append(adminChecklist,adminDeadlines);

    const statusPanel = document.createElement("div");
    statusPanel.className = "admin-status-panel no-print";
    const statusLabel = document.createElement("label");
    statusLabel.textContent = "Statut du dossier";
    const status = document.createElement("select");
    adminCaseStatuses.forEach(x => {
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

    const trackingPanel = document.createElement("section");
    trackingPanel.className = "admin-answer-section admin-tracking-panel no-print";
    const trackingTitle = document.createElement("h3");
    trackingTitle.textContent = "Étapes, actions et échéances";
    const trackingIntro = document.createElement("p");
    trackingIntro.className = "muted small";
    trackingIntro.textContent = "Les actions publiées ici apparaissent dans le suivi du candidat. Les notes internes restent séparées.";
    const trackingForm = document.createElement("form");
    trackingForm.className = "admin-tracking-form";
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Type";
    const typeSelect = document.createElement("select");
    [["task","Action à réaliser"],["deadline","Échéance"]].forEach(([value,label]) => {
      const option = document.createElement("option"); option.value = value; option.textContent = label; typeSelect.append(option);
    });
    typeLabel.append(typeSelect);
    const titleLabel = document.createElement("label");
    titleLabel.textContent = "Intitulé";
    const titleInput = document.createElement("input");
    titleInput.type = "text"; titleInput.required = true; titleInput.maxLength = 180;
    titleInput.placeholder = "Ex. : Transmettre le relevé bancaire actualisé";
    titleLabel.append(titleInput);
    const descLabel = document.createElement("label");
    descLabel.textContent = "Précisions pour le candidat";
    const descInput = document.createElement("textarea");
    descInput.rows = 3; descInput.maxLength = 3000;
    descInput.placeholder = "Expliquez clairement ce qui est attendu…";
    descLabel.append(descInput);
    const dueLabel = document.createElement("label");
    dueLabel.textContent = "Date limite (facultative)";
    const dueInput = document.createElement("input");
    dueInput.type = "date"; dueLabel.append(dueInput);
    const visibilityLabel = document.createElement("label");
    visibilityLabel.className = "admin-tracking-visibility";
    const visibilityInput = document.createElement("input");
    visibilityInput.type = "checkbox"; visibilityInput.checked = true;
    visibilityLabel.append(visibilityInput, document.createTextNode(" Visible par le candidat"));
    const createEvent = document.createElement("button");
    createEvent.type = "submit"; createEvent.className = "primary";
    createEvent.textContent = "Ajouter au suivi";
    trackingForm.append(typeLabel, titleLabel, descLabel, dueLabel, visibilityLabel, createEvent);
    const trackingList = document.createElement("div");
    trackingList.className = "admin-tracking-list";
    trackingList.textContent = "Chargement des étapes…";
    trackingForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (!titleInput.value.trim()) return;
      createEvent.disabled = true; createEvent.textContent = "Enregistrement…";
      try {
        const { error } = await sb.from("candidate_case_events").insert({
          candidate_case_id: c.id,
          user_id: p.id,
          event_type: typeSelect.value,
          title: titleInput.value.trim(),
          description: descInput.value.trim() || null,
          due_date: dueInput.value || null,
          status: "open",
          is_candidate_visible: visibilityInput.checked,
          created_by: currentUser.id
        });
        if (error) throw error;
        trackingForm.reset(); visibilityInput.checked = true;
        await renderTrackingEvents();
        showNotice("Étape ajoutée au suivi du dossier.");
      } catch (error) {
        showNotice("Ajout impossible : " + error.message, true);
      } finally {
        createEvent.disabled = false; createEvent.textContent = "Ajouter au suivi";
      }
    });
    async function renderTrackingEvents() {
      const { data: items, error } = await sb.from("candidate_case_events")
        .select("id,event_type,title,description,status,due_date,is_candidate_visible,created_at")
        .eq("candidate_case_id", c.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      trackingList.innerHTML = "";
      if (!items?.length) {
        trackingList.textContent = "Aucune étape ou échéance enregistrée.";
        return;
      }
      items.forEach(item => {
        const row = document.createElement("div"); row.className = "admin-tracking-row";
        const info = document.createElement("div");
        const heading = document.createElement("strong"); heading.textContent = item.title;
        const meta = document.createElement("small");
        meta.textContent = (item.event_type === "deadline" ? "Échéance" : item.event_type === "task" ? "Action" : item.event_type === "update" ? "Mise à jour" : "Statut") +
          (item.due_date ? " · " + formatCaseDate(item.due_date) : "") +
          (item.is_candidate_visible ? " · Visible candidat" : " · Interne");
        info.append(heading, meta);
        if (item.description) { const desc = document.createElement("p"); desc.textContent = item.description; info.append(desc); }
        const state = document.createElement("select");
        [["open","À faire"],["in_progress","En cours"],["completed","Terminé"],["cancelled","Annulé"]].forEach(([value,label]) => {
          const option = document.createElement("option"); option.value = value; option.textContent = label; state.append(option);
        });
        state.value = item.status;
        state.disabled = ["status","update"].includes(item.event_type);
        state.addEventListener("change", async () => {
          const previous = item.status;
          state.disabled = true;
          try {
            const { error: updateError } = await sb.from("candidate_case_events")
              .update({ status: state.value, completed_at: state.value === "completed" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
              .eq("id", item.id);
            if (updateError) throw updateError;
            item.status = state.value;
            showNotice("Suivi mis à jour.");
          } catch (error) {
            showNotice("Mise à jour impossible : " + error.message, true);
            state.value = previous;
          } finally { state.disabled = false; }
        });
        row.append(info, state); trackingList.append(row);
      });
    }
    trackingPanel.append(trackingTitle, trackingIntro, trackingForm, trackingList);

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
        const { data: result, error } = await sb.functions.invoke("admin-send-update", {
          body: {
            user_id: p.id,
            case_id: c.id,
            message: note.value.trim()
          }
        });
        if (error) throw error;
        if (result?.error) throw new Error(result.error);
        const sentMessage = note.value.trim();
        note.value = "";
        const { error: timelineError } = await sb.from("candidate_case_events").insert({
          candidate_case_id: c.id,
          user_id: p.id,
          event_type: "update",
          title: "Mise à jour de votre conseiller",
          description: sentMessage,
          status: "completed",
          is_candidate_visible: true,
          created_by: currentUser.id
        });
        if (timelineError) {
          showNotice("Message envoyé, mais son ajout à l’historique a échoué : " + timelineError.message, true);
        } else if (result?.email_sent) {
          showNotice("Message enregistré dans le compte du candidat et envoyé par e-mail.");
        } else if (result?.email_setup_required) {
          showNotice("Message enregistré dans le compte du candidat. L'envoi par e-mail nécessite encore la configuration du service e-mail.", true);
        } else {
          showNotice("Message enregistré dans le compte du candidat, mais l'e-mail n'a pas pu être envoyé. Vérifiez la configuration e-mail.", true);
        }
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

    box.append(toolbar, printHeader, identity, adminQuick, statusPanel, trackingPanel, answers, docsSection, notePanel, printFooter);
    box.scrollIntoView({ behavior: "smooth" });

    try {
      await renderTrackingEvents();
    } catch (error) {
      trackingList.textContent = "Impossible de charger le suivi : " + error.message;
    }

    try {
      const { data: docs, error } = await sb.from("case_documents")
        .select("id,category,file_name,storage_path,mime_type,size_bytes,status,created_at,candidate_case_id")
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
            const { data: previewData, error: previewError } = await sb.storage
              .from("case-documents").createSignedUrl(doc.storage_path, 600);
            if (!previewError && previewData?.signedUrl) {
              const preview = document.createElement("button");
              preview.type = "button";
              preview.textContent = "Consulter";
              preview.className = "secondary small-btn doc-action-link no-print";
              preview.addEventListener("click", () => openDocumentPreview(doc.storage_path, doc.file_name, doc.mime_type));
              const download = document.createElement("a");
              download.href = previewData.signedUrl;
              download.rel = "noopener noreferrer";
              download.textContent = "Télécharger";
              download.className = "secondary small-btn doc-action-link no-print";
              download.addEventListener("click", event => {
                event.preventDefault();
                sb.storage.from("case-documents").createSignedUrl(doc.storage_path, 600, { download: true })
                  .then(({ data: result, error }) => {
                    if (error || !result?.signedUrl) throw error || new Error("Lien de téléchargement indisponible.");
                    window.location.assign(result.signedUrl);
                  })
                  .catch(error => showNotice("Téléchargement impossible : " + error.message, true));
              });
              row.append(preview, download);
            } else {
              const unavailable = document.createElement("span");
              unavailable.className = "muted small";
              unavailable.textContent = "Fichier momentanément inaccessible";
              row.append(unavailable);
            }
          } else {
            const unavailable = document.createElement("span");
            unavailable.className = "muted small";
            unavailable.textContent = "Fichier non associé";
            row.append(unavailable);
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
    cfg.SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
  );

  const callbackHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const callbackQuery = new URLSearchParams(window.location.search);
  const callbackError = callbackHash.get("error_description") || callbackQuery.get("error_description");
  const callbackType = callbackHash.get("type") || callbackQuery.get("type");
  const confirmationReturn = ["signup", "email"].includes(callbackType) || callbackQuery.has("code");
  const recoveryReturn =
    callbackType === "recovery" ||
    callbackQuery.get("reset-password") === "1";

  // Supabase peut consommer le fragment du lien de récupération pendant
  // l'initialisation de la session. Ne dépendons donc pas uniquement de
  // #type=recovery : l'événement PASSWORD_RECOVERY est la source fiable.
  let recoverySessionDetected = false;
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      recoverySessionDetected = true;
      showOnly(authView);
      showAuthForm("recovery-password-form");
      showNotice("Lien de réinitialisation reconnu. Choisissez maintenant votre nouveau mot de passe.");
    }
  });

  const handleRecoveryReturn = async () => {
    // L'URL de récupération peut être traitée de façon asynchrone par
    // detectSessionInUrl. On attend donc l'événement PASSWORD_RECOVERY
    // avant de considérer le lien comme invalide.
    showOnly(authView);
    showAuthForm("recovery-password-form");

    const { data: { session } = {} } = await sb.auth.getSession();
    if (session) {
      showNotice("Lien de réinitialisation reconnu. Choisissez maintenant votre nouveau mot de passe.");
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 700));
    const { data: { session: delayedSession } = {} } = await sb.auth.getSession();
    if (delayedSession || recoverySessionDetected) {
      showNotice("Lien de réinitialisation reconnu. Choisissez maintenant votre nouveau mot de passe.");
      return;
    }

    showAuthForm("forgot-password-form");
    showNotice("Le lien de réinitialisation n’est plus valide ou a déjà été utilisé. Demandez un nouveau lien.", true);
  };

  if (recoveryReturn) {
    handleRecoveryReturn().catch(error => {
      showOnly(authView);
      showAuthForm("forgot-password-form");
      showNotice("Impossible de valider le lien de réinitialisation : " + (error.message || "le lien peut avoir expiré.") + " Demandez un nouveau lien.", true);
    });
  } else {
    initSession().then(() => {
      if (callbackError) {
        showNotice("Le lien de confirmation a renvoyé une erreur : " + callbackError, true);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (confirmationReturn) {
        if (currentUser && isEmailConfirmed(currentUser)) {
          showNotice("Votre adresse e-mail est confirmée. Vous pouvez maintenant accéder à votre espace CanadaCase.");
        } else {
          showNotice("Le lien a été ouvert, mais la confirmation n’a pas pu être vérifiée. Demandez un nouveau lien de confirmation.", true);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }).catch(error => {
      showNotice(
        "Impossible de charger votre espace : " +
        (error.message || "une erreur est survenue."),
        true
      );
      showOnly(authView);
    });
  }

})();
