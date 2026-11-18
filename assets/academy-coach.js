(() => {
"use strict";
const $ = id => document.getElementById(id);
const cfg = window.CANADACASE_CONFIG || {};
const sb = window.supabase?.createClient && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
  : null;
const tasks = {
  tef: [
    { title:"TEF Canada — section A : obtenir des informations", prompt:"Vous avez trouvé une annonce pour une activité ou un service. Je suis la personne qui a publié l'annonce. Posez-moi des questions précises pour obtenir les informations nécessaires : horaires, prix, conditions, lieu et modalités. Commencez la conversation." },
    { title:"TEF Canada — section B : argumenter pour convaincre", prompt:"Vous souhaitez me convaincre de participer à une activité que vous avez découverte. Présentez les avantages, répondez à mes objections et essayez de me persuader avec des arguments concrets." }
  ],
  tcf: [
    { title:"TCF Canada — tâche 1 : entretien dirigé", prompt:"Présentez-vous et parlez de votre parcours, de votre environnement familial, de vos études ou de votre activité professionnelle. Répondez de manière naturelle et détaillée." },
    { title:"TCF Canada — tâche 2 : interaction", prompt:"Vous devez obtenir des renseignements dans une situation de la vie quotidienne. Posez des questions adaptées, demandez des précisions et montrez que vous savez maintenir l'échange." },
    { title:"TCF Canada — tâche 3 : exprimer un point de vue", prompt:"À votre avis, est-il préférable de travailler à distance ou au bureau ? Donnez votre opinion, développez au moins deux arguments, illustrez-les par des exemples et concluez." }
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
let examDeadlineAt = 0;
let preparing = false;
let timeExpired = false;
let fullExamMode = true;
let phaseIndex = 0;
let authReady = false;
let reviewDone = false;
let authenticatedUserId = null;
let mediaRecorder = null;
let mediaStream = null;
let mediaChunks = [];
let mediaStartPending = false;
let mediaRecordingCancelled = false;
let audioTranscriptionPending = false;

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
  const index = fullExamMode ? phaseIndex : Number($("coach-task").value);
  return tasks[exam][index] || tasks[exam][0];
}
function reviewTask() {
  if (!fullExamMode) return currentTask();
  const exam = $("coach-exam").value;
  return {
    title: exam === "tef" ? "TEF Canada · épreuve orale complète" : exam === "tcf" ? "TCF Canada · épreuve orale complète" : "Conversation libre",
    prompt: tasks[exam].map((item, index) => (index + 1) + ". " + item.title + " — " + item.prompt).join("\n")
  };
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
  utterance.onend = () => { if (started && !sending && !timeExpired) setState("À vous de répondre"); };
  utterance.onerror = () => setState("Lecture vocale bloquée par le navigateur. Touchez « Réécouter ».");
  window.speechSynthesis.speak(utterance);
}
function populate() {
  const exam = $("coach-exam").value;
  const select = $("coach-task");
  select.innerHTML = "";
  const fullOption = document.createElement("option");
  fullOption.value = "full";
  fullOption.textContent = exam === "libre" ? "Conversation libre · 10 minutes" : "Simulation complète · épreuve entière";
  select.append(fullOption);
  tasks[exam].forEach((task, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = task.title;
    select.append(option);
  });
  select.value = "full";
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
  const index = fullExamMode ? phaseIndex : Number($("coach-task").value);
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
  holdActive = false;
  if (activeRecording || mediaRecorder?.state === "recording") stopListening(false);
  else if (audioTranscriptionPending) setState("Épreuve terminée. La transcription de votre dernière réponse se termine avant le bilan.");
  else if ($("coach-answer").value.trim() && !sending) send();
  else if (!sending) finishAndReview(true);
}
function beginPhase(index, transition = false) {
  phaseIndex = index;
  const task = currentTask();
  const timing = taskTiming();
  preparing = Boolean(timing.prepSeconds);
  deadlineAt = Date.now() + (preparing ? timing.prepSeconds : timing.seconds) * 1000;
  if (transition) addMessage("EXAMINATEUR", "La partie précédente est terminée. Nous passons maintenant à la suite de l'épreuve : " + task.title + ".", "system");
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
  displayCountdown(fullExamMode ? Math.ceil((examDeadlineAt - Date.now()) / 1000) : (preparing ? timing.prepSeconds : timing.seconds));
  setState(preparing ? "Préparation · 2 minutes" : "Épreuve chronométrée · " + timing.label);
}
function start() {
  if (!authReady) { setState("Connectez-vous à votre compte CanadaCase pour utiliser le coach."); return; }
  reset(false);
  reviewDone = false;
  timeExpired = false;
  fullExamMode = $("coach-task").value === "full";
  phaseIndex = fullExamMode ? 0 : Number($("coach-task").value);
  $("coach-review").disabled = true;
  started = true;
  $("coach-exam").disabled = true;
  $("coach-task").disabled = true;
  startedAt = Date.now();
  if (fullExamMode) {
    const total = $("coach-exam").value === "tef" ? "15 minutes" : $("coach-exam").value === "tcf" ? "12 minutes" : "10 minutes";
    const totalSeconds = $("coach-exam").value === "tef" ? 900 : $("coach-exam").value === "tcf" ? 720 : 600;
    examDeadlineAt = Date.now() + totalSeconds * 1000;
    $("coach-timer-label").textContent = "Temps total restant";
    addMessage("EXAMINATEUR", "Bienvenue. Vous allez effectuer l'épreuve orale complète. Le temps total réglementaire est de " + total + ". Je vous indiquerai les changements de tâche. À la fin du temps, l'épreuve sera automatiquement clôturée.", "system");
  } else {
    examDeadlineAt = 0;
    $("coach-timer-label").textContent = "Temps de la tâche";
  }
  beginPhase(phaseIndex, false);
  timer = window.setInterval(() => {
    const remaining = Math.ceil((deadlineAt - Date.now()) / 1000);
    displayCountdown(fullExamMode ? Math.ceil((examDeadlineAt - Date.now()) / 1000) : remaining);
    if (remaining > 0) return;
    if (preparing) {
      preparing = false;
      const timing = taskTiming();
      deadlineAt = Date.now() + timing.interactionSeconds * 1000;
      displayCountdown(fullExamMode ? Math.ceil((examDeadlineAt - Date.now()) / 1000) : timing.interactionSeconds);
      $("coach-answer").disabled = false;
      $("coach-send").disabled = false;
      $("coach-mic").disabled = false;
      addMessage("EXAMINATEUR", "Votre temps de préparation est terminé. Nous commençons l'échange. Vous pouvez répondre.", "system");
      speak("Votre temps de préparation est terminé. Nous commençons l'échange. Vous pouvez répondre.");
      setState("Interaction · 3 minutes 30");
      return;
    }
    const exam = $("coach-exam").value;
    if (fullExamMode && phaseIndex < tasks[exam].length - 1) {
      beginPhase(phaseIndex + 1, true);
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
        messages: (() => {
          const recentHistory = history.slice(-10);
          while (recentHistory.length && recentHistory[0].role !== "user") recentHistory.shift();
          return recentHistory;
        })()
      }
    });
    if (error) throw new Error(await readFunctionError(error));
    if (!data?.reply) throw new Error(data?.error || "Le coach n'a pas renvoyé de réponse.");
    history.push({ role: "assistant", content: data.reply });
    $("coach-review").disabled = history.filter(item => item.role === "user").length === 0;
    if (!timeExpired) {
      addMessage("COACH", data.reply);
      speak(data.reply);
      setState("Réponse du coach reçue");
    }
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
  if ((!started && !force) || sending || audioTranscriptionPending || reviewDone) {
    if (audioTranscriptionPending) setState("La transcription de votre réponse est encore en cours.");
    return;
  }
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
  const task = reviewTask();
  try {
    const { data, error } = await sb.functions.invoke("language-coach", {
      body: { action: "review", exam, task: task.title, prompt: task.prompt, level: "B2", messages: history.slice(-40) }
    });
    if (error) throw new Error(await readFunctionError(error));
    if (!data?.feedback) throw new Error(data?.error || "La correction finale n'a pas été générée.");
    addMessage("BILAN FINAL · CORRECTION", data.feedback, "system");
    reviewDone = true;
    started = false;
    $("coach-exam").disabled = false;
    $("coach-task").disabled = false;
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
async function transcribeCoachAudio(blob) {
  if (!authenticatedUserId) throw new Error("Session expirée. Reconnectez-vous à CanadaCase.");
  if (!blob || !blob.size) throw new Error("Aucune voix n'a été enregistrée.");
  if (blob.size > 15 * 1024 * 1024) throw new Error("L'enregistrement dépasse la limite de 15 Mo.");
  const mimeType = (blob.type || "audio/webm").split(";")[0].toLowerCase();
  const extension = mimeType.includes("mp4") ? "m4a" : mimeType.includes("mpeg") || mimeType.includes("mp3") ? "mp3" : "webm";
  const randomId = window.crypto?.randomUUID ? window.crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2);
  const path = authenticatedUserId + "/coach-" + randomId + "." + extension;
  const { error: uploadError } = await sb.storage.from("language-recordings").upload(path, blob, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;
  try {
    const { data, error } = await sb.functions.invoke("language-coach", { body: { action: "transcribe", file_path: path } });
    if (error) throw new Error(await readFunctionError(error));
    if (!data?.transcript) throw new Error(data?.error || "La transcription est vide.");
    return data.transcript;
  } finally {
    await sb.storage.from("language-recordings").remove([path]);
  }
}

async function startMediaRecording() {
  if (mediaStartPending || mediaRecorder || !holdActive) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setState("La capture audio n'est pas prise en charge ici. Vous pouvez répondre avec le clavier.");
    return;
  }
  mediaStartPending = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!holdActive || !started || timeExpired) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    mediaStream = stream;
    const mime = typeof MediaRecorder.isTypeSupported === "function" ? ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type)) : "";
    mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const recording = mediaRecorder;
    mediaChunks = [];
    mediaRecordingCancelled = false;
    recording.ondataavailable = event => { if (event.data?.size) mediaChunks.push(event.data); };
    recording.onerror = () => setState("L'enregistrement a rencontré une erreur. Réessayez ou utilisez le clavier.");
    recording.onstop = async () => {
      const blob = new Blob(mediaChunks, { type: recording.mimeType || mime || "audio/webm" });
      mediaChunks = [];
      mediaRecorder = null;
      mediaStream?.getTracks().forEach(track => track.stop());
      mediaStream = null;
      setMicIdle();
      if (mediaRecordingCancelled) {
        setState("Enregistrement annulé.");
        return;
      }
      if (!blob.size) {
        setState("Aucune parole détectée. Maintenez le micro et réessayez.");
        return;
      }
      audioTranscriptionPending = true;
      setState("Transcription de votre réponse vocale…");
      try {
        const transcript = await transcribeCoachAudio(blob);
        if (!transcript || !transcript.trim()) throw new Error("Aucune parole n'a été transcrite.");
        publishTranscript(transcript);
        addMessage("TRANSCRIPTION", transcript.trim(), "learner");
        audioTranscriptionPending = false;
        if (started || timeExpired) {
          setState("Transcription terminée. Envoi de votre réponse au coach…");
          await send();
        } else {
          setState("Transcription affichée. Démarrez une simulation pour l'envoyer au coach.");
        }
      } catch (error) {
        audioTranscriptionPending = false;
        addMessage("SERVICE", "Transcription impossible : " + (error instanceof Error ? error.message : "erreur inconnue"), "system");
        setState("La transcription a échoué. Vous pouvez écrire votre réponse.");
        if (timeExpired) finishAndReview(true);
      } finally {
        audioTranscriptionPending = false;
      }
    };
    recording.start();
    $("coach-mic").classList.add("is-recording");
    $("coach-mic").textContent = "● Relâcher pour envoyer";
    setState("Je vous écoute… Maintenez le bouton pendant que vous parlez.");
  } catch (error) {
    mediaStream?.getTracks().forEach(track => track.stop());
    mediaStream = null;
    setMicIdle();
    setState("Accès au microphone impossible : " + (error instanceof Error ? error.message : "autorisation refusée") + ". Vous pouvez écrire.");
  } finally {
    mediaStartPending = false;
  }
}

function startListening() {
  if (!started || timeExpired) { setState("L'épreuve est terminée."); return; }
  if (preparing) { setState("Vous êtes en temps de préparation. Le microphone sera activé au début de l'échange."); return; }
  if (activeRecording || mediaRecorder || mediaStartPending || audioTranscriptionPending || sending) {
    if (activeRecording || mediaRecorder) setState("Finalisation de l'enregistrement précédent…");
    return;
  }
  // Sur iPhone/iPad, privilégier l'enregistrement audio réel puis la transcription Gemini :
  // la reconnaissance vocale WebKit peut s'arrêter sans fournir de résultat final exploitable.
  const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  const canRecordAudio = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  if (!SR || (isAppleMobile && canRecordAudio)) {
    startMediaRecording();
    return;
  }

  const id = ++recordingSequence;
  const instance = new SR();
  const session = { id, instance, transcript: "", releaseRequested: false, cancelled: false, useMediaFallback: false };
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
    if (["service-not-allowed","audio-capture","network"].includes(event.error) && holdActive) {
      session.cancelled = true;
      session.useMediaFallback = true;
      try { instance.abort(); } catch (_) {}
    } else if (["not-allowed","service-not-allowed","audio-capture"].includes(event.error)) {
      session.cancelled = true;
      session.releaseRequested = false;
      try { instance.abort(); } catch (_) {}
    }
  };
  instance.onend = () => {
    if (activeRecording !== session || session.id !== recordingSequence) return;
    activeRecording = null;
    if (session.cancelled && session.useMediaFallback && holdActive) {
      $("coach-mic").classList.remove("is-recording");
      $("coach-mic").textContent = "🎙 Maintenir pour parler";
      startMediaRecording();
      return;
    }
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
    if (holdActive) startMediaRecording();
    else setState("Impossible d'ouvrir le microphone. Vérifiez l'autorisation du navigateur.");
  }
}
function stopListening(cancel = false) {
  holdActive = false;
  const session = activeRecording;
  if (session) {
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
    return;
  }
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecordingCancelled = cancel;
    $("coach-mic").classList.remove("is-recording");
    $("coach-mic").textContent = "Finalisation…";
    setState(cancel ? "Annulation de l'enregistrement…" : "Transcription de votre réponse vocale…");
    try { mediaRecorder.stop(); } catch (_) {}
  }
}
function reset(clear = true) {
  if (timer) window.clearInterval(timer);
  timer = null;
  recordingSequence += 1;
  holdActive = false;
  if (activeRecording) { try { activeRecording.cancelled = true; activeRecording.instance.abort(); } catch (_) {} }
  activeRecording = null;
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecordingCancelled = true;
    try { mediaRecorder.stop(); } catch (_) {}
  }
  mediaStream?.getTracks().forEach(track => track.stop());
  mediaStream = null;
  mediaRecorder = null;
  mediaChunks = [];
  mediaStartPending = false;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  started = false;
  sending = false;
  preparing = false;
  timeExpired = false;
  deadlineAt = 0;
  examDeadlineAt = 0;
  $("coach-timer-label").textContent = "Temps restant";
  fullExamMode = true;
  phaseIndex = 0;
  $("coach-answer").disabled = false;
  $("coach-send").disabled = false;
  $("coach-mic").disabled = false;
  $("coach-exam").disabled = false;
  $("coach-task").disabled = false;
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
    authenticatedUserId = data.session.user.id;
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