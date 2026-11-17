(() => {
"use strict";
const $ = id => document.getElementById(id);
const cfg = window.CANADACASE_CONFIG || {};
const sb = window.supabase?.createClient && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
  : null;
const tasks = {
  tef: [
    { title:"TEF · Section A — obtenir des informations", prompt:"Vous avez trouvé une annonce pour une activité ou un service. Je suis la personne qui a publié l'annonce. Posez-moi des questions précises pour obtenir les informations nécessaires : horaires, prix, conditions, lieu et modalités. Commencez la conversation." },
    { title:"TEF · Section B — convaincre", prompt:"Vous souhaitez me convaincre de participer à une activité que vous avez découverte. Présentez les avantages, répondez à mes objections et essayez de me persuader avec des arguments concrets." }
  ],
  tcf: [
    { title:"TCF · Tâche 1 — entretien dirigé", prompt:"Présentez-vous et parlez de votre parcours, de votre environnement familial, de vos études ou de votre activité professionnelle. Répondez de manière naturelle et détaillée." },
    { title:"TCF · Tâche 2 — interaction", prompt:"Vous devez obtenir des renseignements dans une situation de la vie quotidienne. Posez des questions adaptées, demandez des précisions et montrez que vous savez maintenir l'échange." },
    { title:"TCF · Tâche 3 — exprimer un point de vue", prompt:"À votre avis, est-il préférable de travailler à distance ou au bureau ? Donnez votre opinion, développez au moins deux arguments, illustrez-les par des exemples et concluez." }
  ],
  libre: [
    { title:"Conversation libre", prompt:"Engagez une conversation naturelle en français. Demandez à l'apprenant le sujet qu'il souhaite aborder, puis échangez avec lui en posant une seule question à la fois." }
  ]
};
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let started = false;
let sending = false;
let turns = 0;
let history = [];
let lastPrompt = "";
let startedAt = 0;
let timer = null;
let deadlineAt = 0;
let preparing = false;
let timeExpired = false;
let authReady = false;
let reviewDone = false;

function setState(message) { $("coach-state").textContent = message; }
function addMessage(who, text, kind) {
  const el = document.createElement("article");
  el.className = "coach-bubble " + (kind || (who === "COACH" ? "tutor" : who === "VOUS" ? "learner" : "system"));
  const label = document.createElement("small");
  label.textContent = who;
  const p = document.createElement("p");
  p.textContent = text;
  el.append(label, p);
  $("coach-messages").append(el);
  $("coach-messages").scrollTop = $("coach-messages").scrollHeight;
}
function currentTask() {
  const exam = $("coach-exam").value;
  return tasks[exam][Number($("coach-task").value)] || tasks[exam][0];
}
function speak(text) {
  lastPrompt = text;
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    setState("Lecture vocale indisponible sur cet appareil. Vous pouvez lire la réponse.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.94;
  utterance.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const frenchVoice = voices.find(v => /^fr[-_]/i.test(v.lang) && /fr[-_]FR/i.test(v.lang))
    || voices.find(v => /^fr/i.test(v.lang));
  if (frenchVoice) utterance.voice = frenchVoice;
  utterance.onstart = () => setState("Le coach vous parle…");
  utterance.onend = () => { if (started && !sending) setState("À vous de répondre"); };
  utterance.onerror = () => setState("Lecture vocale bloquée par le navigateur. Touchez « Réécouter ».");
  window.speechSynthesis.speak(utterance);
}
function populate() {
  const exam = $("coach-exam").value;
  const select = $("coach-task");
  select.innerHTML = "";
  tasks[exam].forEach((task, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = task.title;
    select.append(option);
  });
}
function updateFeedback(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const connectors = ["d'abord","ensuite","enfin","cependant","toutefois","parce que","puisque","donc","ainsi","par exemple","en revanche","de plus","en conclusion"];
  const lower = text.toLocaleLowerCase("fr");
  const found = connectors.filter(c => lower.includes(c));
  $("coach-words").textContent = String(words.length);
  $("coach-turns").textContent = String(turns);
  $("coach-connectors").textContent = String(found.length);
  const tips = [];
  if (words.length < 35) tips.push("Développez davantage vos réponses et ajoutez des exemples.");
  if (found.length < 2) tips.push("Utilisez des connecteurs logiques pour structurer vos idées.");
  if (!/[.!?]/.test(text)) tips.push("Pensez à articuler des phrases complètes.");
  if (words.length >= 35 && found.length >= 2) tips.push("Bonne base : continuez à enrichir vos arguments et à varier le vocabulaire.");
  $("coach-feedback-text").textContent = tips.join(" ");
}
function taskTiming() {
  const exam = $("coach-exam").value;
  const index = Number($("coach-task").value);
  if (exam === "tef") return { seconds: index === 0 ? 300 : 600, label: index === 0 ? "5 minutes" : "10 minutes" };
  if (exam === "tcf") {
    if (index === 0) return { seconds: 120, label: "2 minutes" };
    if (index === 1) return { seconds: 330, prepSeconds: 120, interactionSeconds: 210, label: "5 min 30" };
    return { seconds: 270, label: "4 min 30" };
  }
  return { seconds: 600, label: "10 minutes" };
}
function displayCountdown(seconds) {
  const safe = Math.max(0, seconds);
  $("coach-timer").textContent = String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
}
function endExamByTimer() {
  if (!started || timeExpired) return;
  timeExpired = true;
  if (timer) window.clearInterval(timer);
  timer = null;
  preparing = false;
  addMessage("EXAMINATEUR", "Le temps réglementaire est écoulé. L'épreuve est terminée. Merci pour votre participation. Je vais maintenant procéder à l'évaluation de votre prestation.", "system");
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  speak("Le temps réglementaire est écoulé. L'épreuve est terminée. Merci pour votre participation. Je vais maintenant procéder à l'évaluation de votre prestation.");
  $("coach-answer").disabled = true;
  $("coach-send").disabled = true;
  $("coach-mic").disabled = true;
  $("coach-review").disabled = true;
  setState("Temps écoulé · épreuve terminée · évaluation en cours");
  if (activeRecording) stopListening(false);
  else if ($("coach-answer").value.trim() && !sending) send();
  else if (!sending) finishAndReview(true);
}
function start() {
  if (!authReady) { setState("Connectez-vous à votre compte CanadaCase pour utiliser le coach."); return; }
  reset(false);
  reviewDone = false;
  timeExpired = false;
  $("coach-review").disabled = true;
  started = true;
  startedAt = Date.now();
  const task = currentTask();
  const timing = taskTiming();
  preparing = Boolean(timing.prepSeconds);
  deadlineAt = Date.now() + (preparing ? timing.prepSeconds : timing.seconds) * 1000;
  setState(preparing ? "Préparation · 2 minutes" : "Simulation chronométrée · " + timing.label);
  addMessage("COACH", task.prompt);
  if (preparing) {
    $("coach-answer").disabled = true;
    $("coach-send").disabled = true;
    $("coach-mic").disabled = true;
    addMessage("EXAMINATEUR", "Vous disposez de 2 minutes pour préparer votre interaction. Ne répondez pas encore. Le dialogue commencera automatiquement à la fin de ce temps.", "system");
    speak("Vous disposez de deux minutes pour préparer votre interaction. Le dialogue commencera automatiquement à la fin de ce temps.");
  } else {
    $("coach-answer").disabled = false;
    $("coach-send").disabled = false;
    $("coach-mic").disabled = false;
    speak(task.prompt);
  }
  displayCountdown(preparing ? timing.prepSeconds : timing.seconds);
  timer = window.setInterval(() => {
    const remaining = Math.ceil((deadlineAt - Date.now()) / 1000);
    displayCountdown(remaining);
    if (remaining > 0) return;
    if (preparing) {
      preparing = false;
      deadlineAt = Date.now() + timing.interactionSeconds * 1000;
      displayCountdown(timing.interactionSeconds);
      $("coach-answer").disabled = false;
      $("coach-send").disabled = false;
      $("coach-mic").disabled = false;
      addMessage("EXAMINATEUR", "Votre temps de préparation est terminé. Nous commençons l'échange. Vous pouvez répondre.", "system");
      speak("Votre temps de préparation est terminé. Nous commençons l'échange. Vous pouvez répondre.");
      setState("Interaction · 3 minutes 30");
      return;
    }
    endExamByTimer();
  }, 250);
}
async function readFunctionError(error) {
  let message = error?.message || "Le service IA est momentanément indisponible.";
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json();
      if (payload?.error) message = payload.error;
    } catch (_) {}
  }
  return message;
}
async function send() {
  const input = $("coach-answer");
  const text = input.value.trim();
  if (!text || sending) return;
  if (!started && !timeExpired) { setState("Commencez d'abord une simulation."); return; }
  if (preparing) { setState("Le temps de préparation n'est pas terminé."); return; }
  if (!sb || !authReady) { setState("Connexion requise. Connectez-vous à CanadaCase puis revenez au coach."); return; }
  sending = true;
  $("coach-send").disabled = true;
  turns += 1;
  updateFeedback(text);
  addMessage("VOUS", text);
  history.push({ role: "user", content: text });
  input.value = "";
  setState("Le coach analyse votre réponse…");
  try {
    const examValue = $("coach-exam").value;
    const exam = examValue === "libre" ? "Conversation libre" : examValue === "tef" ? "TEF Canada" : "TCF Canada";
    const task = currentTask();
    const { data, error } = await sb.functions.invoke("language-coach", {
      body: {
        action: "chat",
        exam,
        task: task.title,
        prompt: task.prompt,
        level: "B2",
        messages: history.slice(-11)
      }
    });
    if (error) throw new Error(await readFunctionError(error));
    if (!data?.reply) throw new Error(data?.error || "Le coach n'a pas renvoyé de réponse.");
    history.push({ role: "assistant", content: data.reply });
    $("coach-review").disabled = history.filter(item => item.role === "user").length === 0;
    addMessage("COACH", data.reply);
    speak(data.reply);
    setState("Réponse du coach reçue");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    if (timeExpired) {
      input.value = "";
      addMessage("SERVICE", "Votre dernière réponse a été conservée pour l'évaluation, mais le coach n'a pas pu répondre avant la fin du temps : " + message, "system");
    } else {
      history.pop();
      turns = Math.max(0, turns - 1);
      updateFeedback("");
      input.value = text;
      addMessage("SERVICE", message + " Votre réponse est conservée : vous pouvez réessayer.", "system");
      setState("Le service IA n'a pas répondu.");
    }
  } finally {
    sending = false;
    $("coach-send").disabled = timeExpired;
    if (timeExpired && !activeRecording && !reviewDone) finishAndReview(true);
  }
}
async function finishAndReview(force = false) {
  if ((!started && !force) || sending || reviewDone) return;
  if (force && $("coach-answer").value.trim() && !sending) { send(); return; }
  const pending = $("coach-answer").value.trim();
  if (pending) {
    setState("Envoyez d'abord votre dernière réponse avant la correction finale.");
    return;
  }
  const learnerTurns = history.filter(item => item.role === "user");
  if (!learnerTurns.length) {
    setState("Faites au moins une réponse avant de demander votre bilan.");
    return;
  }
  sending = true;
  $("coach-review").disabled = true;
  $("coach-send").disabled = true;
  $("coach-mic").disabled = true;
  $("coach-answer").disabled = true;
  if (timer) window.clearInterval(timer);
  timer = null;
  setState("Le coach analyse toute votre conversation…");
  const examValue = $("coach-exam").value;
  const exam = examValue === "libre" ? "Conversation libre" : examValue === "tef" ? "TEF Canada" : "TCF Canada";
  const task = currentTask();
  try {
    const { data, error } = await sb.functions.invoke("language-coach", {
      body: { action: "review", exam, task: task.title, prompt: task.prompt, level: "B2", messages: history.slice(-40) }
    });
    if (error) throw new Error(await readFunctionError(error));
    if (!data?.feedback) throw new Error(data?.error || "La correction finale n'a pas été générée.");
    addMessage("BILAN FINAL · CORRECTION", data.feedback, "system");
    reviewDone = true;
    started = false;
    if (timer) window.clearInterval(timer);
    timer = null;
    speak("Votre correction finale est prête. Consultez le bilan détaillé affiché à l'écran.");
    setState("Simulation terminée · correction disponible");
  } catch (error) {
    addMessage("SERVICE", (error instanceof Error ? error.message : "Erreur inconnue.") + " Vous pouvez relancer la correction.", "system");
    $("coach-review").disabled = false;
    setState("La correction finale n'a pas pu être générée.");
  } finally {
    sending = false;
    $("coach-send").disabled = timeExpired;
    $("coach-mic").disabled = timeExpired;
    $("coach-answer").disabled = timeExpired;
  }
}
let activeRecording = null;
let recordingSequence = 0;
let holdActive = false;

function setMicIdle() {
  holdActive = false;
  $("coach-mic").classList.remove("is-recording");
  $("coach-mic").textContent = "🎙 Maintenir pour parler";
}
function publishTranscript(text) {
  const input = $("coach-answer");
  input.value = text.trim();
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
function startListening() {
  if (!started || timeExpired) { setState("L'épreuve est terminée."); return; }
  if (preparing) { setState("Vous êtes en temps de préparation. Le microphone sera activé au début de l'échange."); return; }
  if (!SR) {
    setState("La reconnaissance vocale n'est pas disponible dans ce navigateur. Utilisez le clavier.");
    return;
  }
  if (activeRecording || sending) {
    if (activeRecording) setState("Finalisation de l'enregistrement précédent…");
    return;
  }

  const id = ++recordingSequence;
  const instance = new SR();
  const session = { id, instance, transcript: "", releaseRequested: false, cancelled: false };
  activeRecording = session;
  $("coach-mic").classList.add("is-recording");
  $("coach-mic").textContent = "● Relâcher pour envoyer";
  publishTranscript("");

  instance.lang = "fr-FR";
  instance.interimResults = true;
  instance.continuous = true;
  instance.onstart = () => {
    if (activeRecording !== session) return;
    setState("Je vous écoute… Maintenez le bouton pendant que vous parlez.");
  };
  instance.onresult = event => {
    if (activeRecording !== session || session.cancelled) return;
    let combined = "";
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      if (result && result[0]?.transcript) combined += result[0].transcript + " ";
    }
    // Keep the complete transcript for this recording only, including the
    // final result delivered just before the browser fires onend.
    session.transcript = combined.trim();
    publishTranscript(session.transcript);
  };
  instance.onerror = event => {
    if (activeRecording !== session) return;
    const explanations = {
      "not-allowed":"Autorisez l'accès au microphone dans les réglages du navigateur.",
      "service-not-allowed":"Le service vocal est bloqué par le navigateur.",
      "no-speech":"Aucune parole détectée. Maintenez le bouton et réessayez.",
      "audio-capture":"Aucun microphone disponible."
    };
    setState(explanations[event.error] || ("Microphone : " + event.error + "."));
    if (["not-allowed","service-not-allowed","audio-capture"].includes(event.error)) {
      session.cancelled = true;
      session.releaseRequested = false;
      try { instance.abort(); } catch (_) {}
    }
  };
  instance.onend = () => {
    if (activeRecording !== session || session.id !== recordingSequence) return;
    activeRecording = null;
    setMicIdle();
    if (session.cancelled) {
      publishTranscript("");
      setState("Enregistrement annulé.");
      return;
    }
    if (session.releaseRequested) {
      const finalText = session.transcript || $("coach-answer").value.trim();
      publishTranscript(finalText);
      if (finalText) {
        setState("Envoi de votre réponse…");
        send();
      } else if (timeExpired) {
        finishAndReview(true);
      } else {
        setState("Aucune parole détectée. Maintenez le bouton pour réessayer ou écrivez votre réponse.");
      }
    } else if (started) {
      setState("La capture vocale s'est arrêtée. Maintenez le bouton pour recommencer.");
    }
  };
  try {
    instance.start();
  } catch (error) {
    if (activeRecording === session) activeRecording = null;
    setMicIdle();
    setState("Impossible d'ouvrir le microphone. Vérifiez l'autorisation du navigateur.");
  }
}
function stopListening(cancel = false) {
  const session = activeRecording;
  if (!session) return;
  session.releaseRequested = !cancel;
  session.cancelled = cancel;
  $("coach-mic").classList.remove("is-recording");
  $("coach-mic").textContent = "Finalisation…";
  setState(cancel ? "Annulation de l'enregistrement…" : "Finalisation de votre message vocal…");
  try {
    if (cancel) session.instance.abort();
    else session.instance.stop();
  } catch (_) {
    if (activeRecording === session) {
      activeRecording = null;
      setMicIdle();
      const finalText = $("coach-answer").value.trim();
      if (!cancel && finalText) send();
    }
  }
}
function reset(clear = true) {
  if (timer) window.clearInterval(timer);
  timer = null;
  recordingSequence += 1;
  if (activeRecording) { try { activeRecording.cancelled = true; activeRecording.instance.abort(); } catch (_) {} }
  activeRecording = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  started = false;
  sending = false;
  preparing = false;
  timeExpired = false;
  deadlineAt = 0;
  $("coach-answer").disabled = false;
  $("coach-send").disabled = false;
  $("coach-mic").disabled = false;
  turns = 0;
  history = [];
  reviewDone = false;
  $("coach-review").disabled = true;
  $("coach-timer").textContent = "00:00";
  $("coach-words").textContent = "0";
  $("coach-turns").textContent = "0";
  $("coach-connectors").textContent = "0";
  $("coach-feedback-text").textContent = "Votre bilan apparaîtra après vos réponses. Il s'agit d'indications pédagogiques, pas d'une note officielle TEF ou TCF.";
  if (clear) {
    $("coach-messages").innerHTML = "";
    addMessage("COACH", "Simulation réinitialisée. Vous pouvez en démarrer une nouvelle.");
  }
  setMicIdle();
  setState(authReady ? "Prêt à commencer" : "Connexion requise");
}
async function init() {
  if (!sb) {
    setState("Configuration Supabase indisponible.");
    addMessage("SERVICE", "Le service de connexion n'est pas chargé. Revenez à CanadaCase puis réessayez.", "system");
    ["coach-start","coach-mic","coach-send"].forEach(id => $(id).disabled = true);
    return;
  }
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    if (!data?.session) {
      setState("Connexion requise");
      addMessage("SERVICE", "Connectez-vous d'abord à votre compte CanadaCase. ", "system");
      const link = document.createElement("a");
      link.href = "index.html";
      link.textContent = "Ouvrir la connexion";
      link.className = "coach-login-link";
      $("coach-messages").append(link);
      ["coach-start","coach-mic","coach-send"].forEach(id => $(id).disabled = true);
      return;
    }
    authReady = true;
    setState("Connecté · prêt à commencer");
  } catch (error) {
    setState("Impossible de vérifier votre connexion.");
    addMessage("SERVICE", error instanceof Error ? error.message : "Erreur de session.", "system");
  }
}
$("coach-exam").addEventListener("change", populate);
$("coach-start").addEventListener("click", start);
$("coach-reset").addEventListener("click", () => reset());
$("coach-send").addEventListener("click", send);
$("coach-review").addEventListener("click", () => finishAndReview(false));
const micButton = $("coach-mic");
micButton.addEventListener("pointerdown", event => {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  holdActive = true;
  try { micButton.setPointerCapture(event.pointerId); } catch (_) {}
  startListening();
});
micButton.addEventListener("pointerup", event => {
  event.preventDefault();
  holdActive = false;
  stopListening(false);
});
micButton.addEventListener("pointercancel", () => { holdActive = false; stopListening(true); });
micButton.addEventListener("lostpointercapture", () => {
  if (holdActive) stopListening(true);
});
micButton.addEventListener("keydown", event => {
  if ((event.key === " " || event.key === "Enter") && !event.repeat) {
    event.preventDefault();
    holdActive = true;
    startListening();
  }
});
micButton.addEventListener("keyup", event => {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    holdActive = false;
    stopListening(false);
  }
});
$("coach-repeat").addEventListener("click", () => lastPrompt ? speak(lastPrompt) : setState("Aucune consigne à réécouter."));
$("coach-answer").addEventListener("keydown", event => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); send(); }
});
populate();
if (!SR) setState("Micro non pris en charge ici : vous pouvez répondre au clavier.");
init();
})();