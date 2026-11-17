(() => {
 const cfg=window.CANADACASE_CONFIG||{},root=document.getElementById("exam-app"),logout=document.getElementById("exam-logout");
 if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase?.createClient){root.innerHTML='<div class="exam-panel">Configuration Supabase indisponible.</div>';return;}
 const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
 let user=null,profile=null,isAdmin=false,isTrainer=false,trainers=[],reviewers=[],exams=[],attempts=[],certificates=[],participationCertificates=[],academyLearners=[],adminParticipationCertificates=[],activeAttempt=null,activeExam=null,timerInterval=null,sectionTimerInterval=null,sectionGroups=[],sectionIndex=0,sectionAnswers=new Map(),sectionTimeExpired=false,sectionAdvancePending=false,audioScripts=new Map(),timeExpired=false,recordings=new Map(),recorders=new Map(),recordingUploads=new Set();
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const notify=(m,bad=false)=>{const n=document.getElementById("exam-notice");n.textContent=m;n.className="exam-notice"+(bad?" error":"");n.classList.remove("hidden");};
 const money=n=>new Intl.NumberFormat("fr-FR").format(Number(n||0));
 async function init(){
  document.getElementById("certificate-verify-form").addEventListener("submit",verifyCertificate);
  const requestedCode=new URLSearchParams(location.search).get("verify");if(requestedCode)await verifyCode(requestedCode);
  const s=await sb.auth.getSession();if(s.error)throw s.error;
  if(!s.data.session){root.innerHTML='<div class="exam-panel"><h2>Connexion requise</h2><p>Connectez-vous avec votre compte CanadaCase pour passer un examen et consulter vos attestations.</p><a class="primary" href="index.html">Se connecter</a></div>';return;}
  user=s.data.session.user;
  const p=await sb.from("profiles").select("id,full_name,role,is_active").eq("id",user.id).single();if(p.error)throw p.error;profile=p.data;
  if(profile.is_active===false){await sb.auth.signOut();return;}
  isAdmin=profile.role==="admin";
  const roleResult=await sb.from("academy_user_roles").select("role_code").eq("user_id",user.id);if(roleResult.error)throw roleResult.error;isTrainer=roleResult.data.some(x=>x.role_code==="trainer");
  logout.classList.remove("hidden");logout.addEventListener("click",async()=>{await sb.auth.signOut();location.href="index.html";});
  await load();render();
 }
 async function load(){
  const qs=await Promise.all([
   sb.from("academy_mock_exams").select("id,title,exam_code,instructions,duration_minutes,pass_percentage,max_attempts,requires_entitlement,status,created_by,created_at").order("created_at",{ascending:false}),
   sb.from("academy_mock_exam_attempts").select("id,exam_id,attempt_number,status,started_at,submitted_at,score,max_score,percentage,feedback_summary").order("created_at",{ascending:false}),
   sb.from("academy_certificates").select("id,verification_code,learner_name_snapshot,exam_title_snapshot,percentage,issued_at,revoked_at").eq("learner_id",user.id).order("issued_at",{ascending:false}),
   sb.from("academy_participation_attestations").select("id,verification_code,learner_name_snapshot,activity_type,activity_title,activity_date,duration_minutes,issued_at,revoked_at").eq("learner_id",user.id).order("issued_at",{ascending:false})
  ]);
  for(const x of qs)if(x.error)throw x.error;[exams,attempts,certificates,participationCertificates]=qs.map(x=>x.data||[]);
  const rv=await sb.from("academy_mock_exam_reviewers").select("id,exam_id,trainer_id,active,created_at").order("created_at",{ascending:false});if(rv.error)throw rv.error;reviewers=rv.data||[];
  trainers=[];academyLearners=[];adminParticipationCertificates=[];
  if(isAdmin){
   const [tr,lp,issued]=await Promise.all([
    sb.from("academy_user_roles").select("user_id").eq("role_code","trainer"),
    sb.from("profiles").select("id,full_name,email,is_active").eq("is_active",true).neq("role","admin").order("full_name"),
    sb.from("academy_participation_attestations").select("id,verification_code,learner_id,learner_name_snapshot,activity_type,activity_title,activity_date,duration_minutes,issued_at,revoked_at").order("issued_at",{ascending:false}).limit(30)
   ]);
   for(const x of [tr,lp,issued])if(x.error)throw x.error;
   const ids=[...new Set((tr.data||[]).map(x=>x.user_id))];
   if(ids.length){const ps=await sb.from("profiles").select("id,full_name,email,is_active").in("id",ids).eq("is_active",true).order("full_name");if(ps.error)throw ps.error;trainers=ps.data||[];}
   academyLearners=lp.data||[];adminParticipationCertificates=issued.data||[];
  }
 }
 function render(){
  const visible=exams.filter(e=>e.status==="published"||e.created_by===user.id||isAdmin);
  const cards=visible.map(e=>'<article class="exam-card"><span class="exam-chip">'+(e.status==="published"?"Publié":e.status==="draft"?"Brouillon":"Archivé")+'</span><h3>'+esc(e.title)+'</h3><p>'+esc(e.instructions||"Examen blanc CanadaCase Academy")+'</p><div class="exam-meta"><span>'+e.duration_minutes+' min</span><span>Seuil '+Number(e.pass_percentage)+' %</span><span>'+e.max_attempts+' tentative(s)</span><span>'+(e.requires_entitlement?"Accès payant":"Accès libre")+'</span></div>'+
   (e.status==="published"?'<button class="primary" data-start="'+e.id+'">Commencer</button>':(isAdmin?'<button class="secondary" data-publish="'+e.id+'">Publier</button>':''))+
   (isAdmin&&e.status==="draft"?'<button class="secondary" data-add-question="'+e.id+'">Ajouter une question</button>':'')+
   '</article>').join("")||'<div class="exam-empty">Aucun examen publié pour le moment.</div>';
  const myAttempts=attempts.map(a=>{const e=exams.find(x=>x.id===a.exam_id);return '<div class="exam-cert"><div><strong>'+esc(e?.title||"Examen")+'</strong><div class="exam-small">Tentative '+a.attempt_number+' · '+esc(a.status)+'</div></div><strong>'+(a.percentage===null?"En correction":Number(a.percentage).toFixed(1)+" %")+'</strong></div>';}).join("")||'<div class="exam-empty">Aucune tentative pour le moment.</div>';
  const certs=certificates.map(c=>'<div class="exam-cert"><div><strong>'+esc(c.exam_title_snapshot)+'</strong><div class="exam-small">'+Number(c.percentage).toFixed(1)+' % · '+(c.revoked_at?"Révoqué":"Émis le "+new Date(c.issued_at).toLocaleDateString("fr-FR"))+'</div><code>'+esc(c.verification_code)+'</code></div><div class="exam-actions"><button class="secondary" data-verify-own="'+esc(c.verification_code)+'">Vérifier</button>'+(c.revoked_at?"":'<button class="primary" data-print-cert="'+esc(c.verification_code)+'">Imprimer le certificat</button>')+'</div></div>').join("")||'<div class="exam-empty">Aucun certificat délivré. Un certificat est généré automatiquement après réussite et correction complète.</div>';
  root.innerHTML='<section class="exam-panel"><h2>Commencez un examen blanc</h2><p class="exam-muted">Choisissez un examen et appuyez sur « Commencer ». Vous pourrez ensuite consulter votre résultat et vos certificats dans les sections ci-dessous.</p><div class="exam-grid">'+cards+'</div></section>'+
   '<section class="exam-panel"><h2>Mes résultats et corrections</h2>'+myAttempts+'</section><section class="exam-panel"><h2>Mes certificats de réussite</h2>'+certs+'</section>'+
   '<section class="exam-panel"><h2>Mes attestations de participation</h2>'+(participationCertificates.map(a=>'<div class="exam-cert"><div><strong>'+esc(a.activity_title)+'</strong><div class="exam-small">'+esc(a.learner_name_snapshot)+' · '+new Date(a.activity_date+'T12:00:00').toLocaleDateString("fr-FR")+' · '+Number(a.duration_minutes)+' min · '+(a.revoked_at?"Révoquée":"Émise le "+new Date(a.issued_at).toLocaleDateString("fr-FR"))+'</div><code>'+esc(a.verification_code)+'</code></div><div class="exam-actions"><button class="secondary" data-verify-own="'+esc(a.verification_code)+'">Vérifier</button>'+(a.revoked_at?"":'<button class="primary" data-print-participation="'+esc(a.verification_code)+'">Imprimer</button>')+'</div></div>').join("")||'<div class="exam-empty">Aucune attestation de participation pour le moment.</div>')+'</section>'+
   (isAdmin?adminPanel()+participationAdminPanel():isTrainer?trainerPanel():"");
  bind();
 }
 function adminPanel(){
  const pending=attempts.filter(a=>a.status==="awaiting_review");
  const activeAssignments=reviewers.filter(r=>r.active);
  const assignmentRows=activeAssignments.map(r=>{const e=exams.find(x=>x.id===r.exam_id),t=trainers.find(x=>x.id===r.trainer_id);return '<div class="exam-review"><strong>'+esc(e?.title||"Examen")+" — "+esc(t?.full_name||t?.email||"Formateur")+'</strong><button type="button" class="secondary" data-unassign-reviewer="'+r.id+'">Retirer</button></div>';}).join("")||'<div class="exam-empty">Aucun formateur affecté pour le moment.</div>';
  const assignmentForm=trainers.length?'<form id="exam-reviewer-form" class="exam-admin-grid"><label>Examen<select name="exam_id" required>'+exams.map(e=>'<option value="'+e.id+'">'+esc(e.title)+'</option>').join("")+'</select></label><label>Formateur<select name="trainer_id" required>'+trainers.map(t=>'<option value="'+t.id+'">'+esc(t.full_name||t.email||t.id)+'</option>').join("")+'</select></label><button class="primary" type="submit">Affecter le formateur</button></form>':'<p class="exam-muted">Aucun formateur actif avec le rôle Academy « trainer ». Une fois une candidature approuvée et le rôle attribué, son compte apparaîtra ici.</p>';
  return '<section class="exam-panel"><h2>Administration — créer un examen</h2><form id="exam-create-form" class="exam-admin-grid">'+
   '<label>Titre<input name="title" required minlength="5" maxlength="180"></label><label>Code unique<input name="exam_code" required maxlength="40" pattern="[A-Za-z0-9_-]{3,40}" placeholder="TEF-ORAL-B1"></label>'+
   '<label>Durée (minutes)<input name="duration_minutes" type="number" min="5" max="300" value="60" required></label><label>Seuil de réussite (%)<input name="pass_percentage" type="number" min="0" max="100" value="60" required></label>'+
   '<label>Nombre de tentatives<input name="max_attempts" type="number" min="1" max="20" value="1" required></label><label><input name="requires_entitlement" type="checkbox" checked> Exiger un droit d’examen</label><button class="primary" type="submit">Créer le brouillon</button></form>'+
   '<h3>Affectation des formateurs correcteurs</h3>'+assignmentForm+assignmentRows+'<h3>Nettoyage des audios abandonnés</h3><p class="exam-muted">Les enregistrements des tentatives non soumises depuis plus de 30 jours peuvent être supprimés. Les copies soumises et en correction sont conservées.</p><button type="button" class="secondary" id="exam-clean-audio">Nettoyer les audios de plus de 30 jours</button><h3>Corrections à effectuer</h3>'+ (pending.length?pending.map(a=>'<div class="exam-review" data-review="'+a.id+'"><strong>'+esc(exams.find(e=>e.id===a.exam_id)?.title||"Examen")+'</strong><button class="secondary" data-load-review="'+a.id+'">Ouvrir la correction</button></div>').join(""):'<div class="exam-empty">Aucune copie en attente de correction.</div>')+'</section>';
 }
 function trainerPanel(){const pending=attempts.filter(a=>a.status==="awaiting_review");return '<section class="exam-panel"><h2>Espace formateur — copies à corriger</h2><p class="exam-muted">Vous voyez uniquement les copies des examens qui vous ont été affectés par l’administration. Les enregistrements restent privés.</p>'+(pending.length?pending.map(a=>'<div class="exam-review"><strong>'+esc(exams.find(e=>e.id===a.exam_id)?.title||"Examen")+'</strong><span class="exam-small">Soumise le '+(a.submitted_at?new Date(a.submitted_at).toLocaleString("fr-FR"):"—")+'</span><button class="secondary" data-load-review="'+a.id+'">Ouvrir la correction</button></div>').join(""):'<div class="exam-empty">Aucune copie en attente pour les examens qui vous sont affectés.</div>')+'</section>';}
 function bind(){
  root.querySelectorAll("[data-start]").forEach(b=>b.addEventListener("click",()=>startExam(b.dataset.start)));
  root.querySelectorAll("[data-publish]").forEach(b=>b.addEventListener("click",()=>publishExam(b.dataset.publish)));
  root.querySelectorAll("[data-add-question]").forEach(b=>b.addEventListener("click",()=>questionForm(b.dataset.addQuestion)));
  root.querySelectorAll("[data-verify-own]").forEach(b=>b.addEventListener("click",()=>verifyCode(b.dataset.verifyOwn)));
  root.querySelectorAll("[data-print-cert]").forEach(b=>b.addEventListener("click",()=>printCertificate(b.dataset.printCert)));
  root.querySelectorAll("[data-print-participation]").forEach(b=>b.addEventListener("click",()=>printParticipationCertificate(b.dataset.printParticipation)));
  root.querySelectorAll("[data-revoke-participation]").forEach(b=>b.addEventListener("click",()=>revokeParticipation(b.dataset.revokeParticipation)));
  root.querySelectorAll("[data-load-review]").forEach(b=>b.addEventListener("click",()=>loadReview(b.dataset.loadReview)));
  root.querySelectorAll("[data-unassign-reviewer]").forEach(b=>b.addEventListener("click",()=>unassignReviewer(b.dataset.unassignReviewer)));
  document.getElementById("exam-create-form")?.addEventListener("submit",createExam);
  document.getElementById("exam-reviewer-form")?.addEventListener("submit",assignReviewer);
  document.getElementById("exam-clean-audio")?.addEventListener("click",cleanupStaleAudio);
  document.getElementById("participation-issue-form")?.addEventListener("submit",issueParticipation);
 }
 async function assignReviewer(ev){ev.preventDefault();const f=new FormData(ev.currentTarget);const {error}=await sb.from("academy_mock_exam_reviewers").upsert({exam_id:f.get("exam_id"),trainer_id:f.get("trainer_id"),assigned_by:user.id,active:true},{onConflict:"exam_id,trainer_id"});if(error)return notify(error.message,true);await load();render();notify("Formateur affecté à cet examen. Il verra uniquement les copies de cet examen.");}
 async function unassignReviewer(id){const {error}=await sb.from("academy_mock_exam_reviewers").update({active:false}).eq("id",id);if(error)return notify(error.message,true);await load();render();notify("Affectation retirée. Le formateur perd l’accès aux nouvelles corrections de cet examen.");}
 async function cleanupStaleAudio(){const b=document.getElementById("exam-clean-audio");if(b)b.disabled=true;try{const {data,error}=await sb.rpc("academy_list_stale_mock_exam_recordings");if(error)throw error;const paths=(data||[]).map(x=>x.object_name).filter(Boolean);if(!paths.length){notify("Aucun enregistrement de tentative abandonnée de plus de 30 jours à nettoyer.");return;}let removed=0;for(let i=0;i<paths.length;i+=100){const {data:done,error:delError}=await sb.storage.from("language-recordings").remove(paths.slice(i,i+100));if(delError)throw delError;removed+=(done||[]).length;}notify(removed+" enregistrement(s) audio ancien(s) supprimé(s).");}catch(e){notify("Nettoyage impossible : "+e.message,true);}finally{if(b)b.disabled=false;}}
 async function createExam(ev){
  ev.preventDefault();const f=new FormData(ev.currentTarget);
  const {data,error}=await sb.from("academy_mock_exams").insert({created_by:user.id,title:String(f.get("title")).trim(),exam_code:String(f.get("exam_code")).trim().toUpperCase(),duration_minutes:Number(f.get("duration_minutes")),pass_percentage:Number(f.get("pass_percentage")),max_attempts:Number(f.get("max_attempts")),requires_entitlement:f.get("requires_entitlement")==="on",status:"draft"}).select("id").single();
  if(error)return notify(error.message,true);await load();render();notify("Examen créé en brouillon. Ajoutez ses questions avant publication.");
  questionForm(data.id);
 }
 function questionForm(examId){
  const area=document.createElement("section");area.className="exam-panel";
  area.innerHTML='<h2>Ajouter une question</h2><form id="exam-question-form"><label>Énoncé<textarea name="prompt" required minlength="3" maxlength="5000"></textarea></label><div class="exam-admin-grid"><label>Type<select name="question_type"><option value="mcq">QCM</option><option value="short_answer">Réponse rédigée</option></select></label><label>Points<input name="points" type="number" min="0.1" max="100" step="0.1" value="1" required></label><label>Position<input name="position" type="number" min="1" value="1" required></label><label>Index bonne réponse (QCM, commence à 0)<input name="correct_option" type="number" min="0" value="0"></label></div><label>Choix QCM (un par ligne)<textarea name="options" rows="4" placeholder="Option A&#10;Option B"></textarea></label><label>Réponse de référence pour réponse rédigée<textarea name="expected_answer" rows="3"></textarea></label><label>Grille de critères JSON<textarea name="rubric" rows="3" placeholder="{&quot;criteria&quot;:[&quot;clarté&quot;,&quot;justification&quot;],&quot;scale&quot;:&quot;0-2&quot;}">{}</textarea></label><label>Explication / retour pédagogique<textarea name="explanation" rows="2"></textarea></label><button class="primary" type="submit">Enregistrer la question</button></form>';
  root.prepend(area);
  area.querySelector("form").addEventListener("submit",async ev=>{
   ev.preventDefault();const f=new FormData(ev.currentTarget),type=f.get("question_type");
   let opts=[];if(type==="mcq")opts=String(f.get("options")||"").split("\n").map(x=>x.trim()).filter(Boolean);
   let rubric={};try{rubric=JSON.parse(String(f.get("rubric")||"{}"));}catch(_){return notify("La grille doit être un JSON valide.",true);}
   const {data,error}=await sb.rpc("academy_admin_save_exam_question",{p_exam_id:examId,p_prompt:String(f.get("prompt")).trim(),p_question_type:type,p_options:opts,p_points:Number(f.get("points")),p_position:Number(f.get("position")),p_correct_option:type==="mcq"?Number(f.get("correct_option")):null,p_expected_answer:type==="short_answer"?String(f.get("expected_answer")).trim():null,p_rubric:rubric,p_explanation:String(f.get("explanation")||"").trim()});
   if(error)return notify(error.message,true);notify("Question enregistrée. Ajoutez les suivantes, puis publiez l’examen.");ev.currentTarget.reset();
  });
  area.scrollIntoView({behavior:"smooth",block:"start"});
 }
 async function publishExam(id){
  const {count,error:countError}=await sb.from("academy_mock_exam_questions").select("id",{count:"exact",head:true}).eq("exam_id",id);if(countError)return notify(countError.message,true);
  if(!count)return notify("Ajoutez au moins une question avant publication.",true);
  const {error}=await sb.from("academy_mock_exams").update({status:"published"}).eq("id",id);if(error)return notify(error.message,true);
  await load();render();notify("Examen publié.");
 }
 async function startExam(id){
  const {data,error}=await sb.rpc("academy_start_mock_exam",{p_exam_id:id});if(error)return notify(error.message,true);
  activeAttempt=data;activeExam=exams.find(e=>e.id===id);timeExpired=false;sectionTimeExpired=false;sectionAdvancePending=false;sectionGroups=[];sectionIndex=0;sectionAnswers.clear();audioScripts.clear();recordings.clear();recorders.clear();
  const attemptRow=await sb.from("academy_mock_exam_attempts").select("started_at").eq("id",activeAttempt).single();if(attemptRow.error)return notify(attemptRow.error.message,true);
  const q=await sb.from("academy_mock_exam_questions").select("id,prompt,question_type,options,points,position,rubric").eq("exam_id",id).order("position");if(q.error)return notify(q.error.message,true);
  if(!q.data.length)return notify("Cet examen ne contient pas encore de questions.",true);
  const deadline=new Date(attemptRow.data.started_at).getTime()+Number(activeExam.duration_minutes)*60000;
  sectionGroups=buildSectionGroups(activeExam,q.data);
  const sectionMarkup=sectionGroups.length?sectionGroups.map((g,gi)=>'<section class="exam-section '+(gi===0?"":"hidden")+'" data-exam-section="'+gi+'"><div class="exam-section-heading"><div><h3>'+esc(g.label)+'</h3><p class="exam-small">Épreuve '+(gi+1)+' / '+sectionGroups.length+' · durée indicative officielle</p></div><strong class="exam-section-clock" id="exam-section-clock-'+gi+'"></strong></div>'+g.items.map(x=>questionHtml(x.q,x.index)).join("")+'<div class="exam-actions">'+(gi<sectionGroups.length-1?'<button class="primary" type="button" data-next-section="'+gi+'">Terminer cette épreuve et continuer</button>':'<button class="primary" type="submit">Terminer et soumettre mes réponses</button>')+'</div></section>').join(""):q.data.map((x,i)=>questionHtml(x,i)).join("")+'<div class="exam-actions"><button class="primary" type="submit">Soumettre mes réponses</button></div>';
  root.innerHTML='<section class="exam-panel"><h2>'+esc(activeExam.title)+'</h2><div class="exam-clock" id="exam-clock" role="timer" aria-live="off"></div><p class="exam-muted">Le temps global est contrôlé par le serveur. Les épreuves TEF/TCF sont présentées successivement avec un chronomètre par compétence. Pour l’expression orale, enregistrez votre voix si votre appareil le permet ou utilisez la dictée.</p><form id="exam-answer-form">'+sectionMarkup+'</form></section>';
  const form=document.getElementById("exam-answer-form");
  form.addEventListener("submit",ev=>submitExam(ev,q.data,timeExpired||sectionTimeExpired));
  root.querySelectorAll("[data-next-section]").forEach(b=>b.addEventListener("click",()=>advanceSection(false)));
  root.querySelectorAll("[data-play-audio]").forEach(b=>b.addEventListener("click",()=>{
   const script=audioScripts.get(b.dataset.playAudio);if(!script)return;
   if(!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window)){document.getElementById("audio-script-"+b.dataset.playAudio)?.classList.remove("hidden");return notify("La lecture vocale n’est pas disponible sur cet appareil. Affichez le script de secours.",true);}
   window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(script);utterance.lang="fr-FR";window.speechSynthesis.speak(utterance);
  }));
  root.querySelectorAll("[data-show-audio]").forEach(b=>b.addEventListener("click",()=>document.getElementById("audio-script-"+b.dataset.showAudio)?.classList.toggle("hidden")));
  root.querySelectorAll("[data-record-start]").forEach(b=>b.addEventListener("click",()=>startRecording(b.dataset.recordStart)));
  root.querySelectorAll("[data-record-stop]").forEach(b=>b.addEventListener("click",()=>stopRecording(b.dataset.recordStop)));
  const clock=document.getElementById("exam-clock");
  const tick=()=>{const remaining=Math.max(0,deadline-Date.now()),minutes=Math.floor(remaining/60000),seconds=Math.floor((remaining%60000)/1000);clock.textContent="Temps restant : "+String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0");if(remaining===0){clearInterval(timerInterval);timeExpired=true;notify("Le temps imparti est écoulé. Soumettez immédiatement ; le serveur vérifiera l’heure limite.",true);}};
  tick();timerInterval=setInterval(tick,1000);
  if(sectionGroups.length)startSectionTimer();
 }
 function buildSectionGroups(exam,questions){
  const code=String(exam.exam_code||"").toUpperCase();
  if(!code.includes("TEFCA-FULL")&&!code.includes("TCFCA-FULL"))return [];
  const durations=code.includes("TCFCA")?{"CO":35,"CE":60,"EE":60,"EO":12}:{"CE":60,"CO":40,"EE":60,"EO":15};
  const labels={CO:"Compréhension orale",CE:"Compréhension écrite",EE:"Expression écrite",EO:"Expression orale"};
  const groups=[];
  questions.forEach((q,index)=>{
   const p=String(q.prompt||"");const key=/compréhension orale/i.test(p)?"CO":/compréhension écrite/i.test(p)?"CE":/expression écrite/i.test(p)?"EE":/expression orale/i.test(p)?"EO":null;
   if(!key)return;
   let g=groups.find(x=>x.key===key);if(!g){g={key,label:labels[key],minutes:durations[key],items:[]};groups.push(g);}
   g.items.push({q,index});
  });
  return groups.length===4&&groups.every(g=>g.items.length)?groups:[];
 }
 function captureSectionAnswers(form,group){
  if(!group)return;
  for(const item of group.items){const q=item.q;
   if(q.question_type==="mcq"){const selected=form.querySelector('input[name="q-'+q.id+'"]:checked');sectionAnswers.set(q.id,{question_id:q.id,selected_option:selected?Number(selected.value):-1});}
   else{const field=form.querySelector('textarea[name="q-'+q.id+'"]');const answer={question_id:q.id,answer_text:String(field?.value||"").trim()};const audio=recordings.get(q.id);if(audio){answer.audio_path=audio.path;answer.audio_mime=audio.mime;answer.audio_size_bytes=audio.size;}sectionAnswers.set(q.id,answer);}
  }
 }
 function completeRecordingUpload(questionId){
  recordingUploads.delete(questionId);
  if(sectionAdvancePending&&!recorders.size&&!recordingUploads.size){sectionAdvancePending=false;advanceSection(true);}
 }
 function startSectionTimer(){
  if(sectionTimerInterval)clearInterval(sectionTimerInterval);
  const group=sectionGroups[sectionIndex];if(!group)return;
  const started=Date.now(),deadline=started+group.minutes*60000,clock=document.getElementById("exam-section-clock-"+sectionIndex);
  const tick=()=>{const left=Math.max(0,deadline-Date.now()),m=Math.floor(left/60000),sec=Math.floor(left%60000/1000);if(clock)clock.textContent=String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0");if(left===0){clearInterval(sectionTimerInterval);notify("Temps écoulé pour "+group.label+". Cette épreuve est verrouillée avant de passer à la suivante.",true);if(recorders.size||recordingUploads.size){sectionAdvancePending=true;[...recorders.keys()].forEach(stopRecording);return;}advanceSection(true);}};
  tick();sectionTimerInterval=setInterval(tick,1000);
 }
 function advanceSection(auto=false){
  if(!auto&&(recorders.size||recordingUploads.size)){notify("Arrêtez le microphone et attendez l’envoi audio avant de changer d’épreuve.",true);return;}
  const form=document.getElementById("exam-answer-form"),group=sectionGroups[sectionIndex];if(!form||!group)return;
  captureSectionAnswers(form,group);
  const current=form.querySelector('[data-exam-section="'+sectionIndex+'"]');if(current){current.querySelectorAll("input,textarea").forEach(el=>el.disabled=true);current.classList.add("hidden");}
  if(sectionTimerInterval)clearInterval(sectionTimerInterval);
  if(sectionIndex>=sectionGroups.length-1){sectionTimeExpired=auto;if(auto)form.requestSubmit();return;}
  sectionIndex++;
  const next=form.querySelector('[data-exam-section="'+sectionIndex+'"]');if(next)next.classList.remove("hidden");
  startSectionTimer();
  if(!auto)notify("Épreuve suivante : "+sectionGroups[sectionIndex].label+". Le chronomètre précédent est arrêté.");
 }
 async function startRecording(questionId){
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){notify("L’enregistrement audio n’est pas pris en charge par ce navigateur. Utilisez la dictée vocale du clavier.",true);return;}
  if(recorders.has(questionId))return;
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch(e){notify("Autorisez l’accès au microphone pour enregistrer votre réponse.",true);return;}
  if(sectionGroups.length&&!sectionGroups[sectionIndex]?.items.some(x=>x.q.id===questionId)){stream.getTracks().forEach(t=>t.stop());notify("Cette épreuve est terminée. Le microphone ne peut plus démarrer sur cette section.",true);return;}
  const candidates=["audio/webm;codecs=opus","audio/webm","audio/mp4"];
  const mimeType=candidates.find(t=>MediaRecorder.isTypeSupported?.(t));
  let recorder;
  try{recorder=mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream);}catch(e){stream.getTracks().forEach(t=>t.stop());notify("Format audio non pris en charge sur cet appareil.",true);return;}
  const chunks=[];recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
  const start=root.querySelector('[data-record-start="'+questionId+'"]'),stop=root.querySelector('[data-record-stop="'+questionId+'"]');
  recorders.set(questionId,{recorder,stream,chunks});if(start)start.disabled=true;if(stop)stop.disabled=false;
  recorder.onstop=async()=>{
   recordingUploads.add(questionId);
   stream.getTracks().forEach(t=>t.stop());recorders.delete(questionId);if(start)start.disabled=false;if(stop)stop.disabled=true;
   const mime=recorder.mimeType||"audio/webm",type=mime.split(";")[0].toLowerCase();
   const allowed=["audio/webm","audio/mp4","audio/mpeg","audio/wav","audio/ogg","audio/aac"];
   const blob=new Blob(chunks,{type});
   if(!allowed.includes(type)){completeRecordingUpload(questionId);notify("Le format audio "+type+" n’est pas accepté. Essayez un navigateur compatible ou utilisez la dictée.",true);return;}
   if(!blob.size){completeRecordingUpload(questionId);notify("Aucun son n’a été enregistré. Réessayez.",true);return;}
   if(blob.size>24*1024*1024){completeRecordingUpload(questionId);notify("Enregistrement trop volumineux (maximum 24 Mo). Réduisez sa durée puis réessayez.",true);return;}
   const ext=type==="audio/mp4"?"m4a":type==="audio/mpeg"?"mp3":type==="audio/wav"?"wav":type==="audio/ogg"?"ogg":type==="audio/aac"?"aac":"webm";
   const nonce=window.crypto?.randomUUID?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2);
   const path=user.id+"/mock-exams/"+activeAttempt+"/"+questionId+"/"+nonce+"."+ext;
   const {error}=await sb.storage.from("language-recordings").upload(path,blob,{contentType:type,cacheControl:"3600",upsert:false});
   if(error){completeRecordingUpload(questionId);notify("Échec de l’envoi audio : "+error.message,true);return;}
   const previous=recordings.get(questionId);recordings.set(questionId,{path,mime:type,size:blob.size});
   if(previous?.path)await sb.storage.from("language-recordings").remove([previous.path]);
   const player=document.getElementById("recorded-audio-"+questionId);
   if(player){player.src=URL.createObjectURL(blob);player.classList.remove("hidden");}
   const status=document.getElementById("recording-status-"+questionId);if(status)status.textContent="Enregistrement envoyé en privé · "+(blob.size/1024/1024).toFixed(1)+" Mo";
   completeRecordingUpload(questionId);notify("Réponse orale enregistrée et sauvegardée en privé.");
  };
  recorder.start(1000);notify("Enregistrement en cours… Parlez clairement, puis appuyez sur Arrêter.");
 }
 function stopRecording(questionId){
  const entry=recorders.get(questionId);if(entry&&entry.recorder.state!=="inactive")entry.recorder.stop();
 }
 function questionHtml(q,i){
  let prompt=String(q.prompt||""),audioControls="";
  const match=prompt.match(/\[\[AUDIO\]\]([\s\S]*?)\[\[\/AUDIO\]\]/);
  if(match){audioScripts.set(q.id,match[1].trim());prompt=prompt.replace(match[0],"Document audio : utilisez le bouton de lecture vocale.");audioControls='<div class="exam-audio-controls"><button class="secondary" type="button" data-play-audio="'+q.id+'">Écouter (voix synthétique)</button><button class="secondary" type="button" data-show-audio="'+q.id+'">Afficher le script</button><p class="exam-audio-script hidden" id="audio-script-'+q.id+'">'+esc(match[1].trim())+'</p></div>';}
  const oral=q.rubric?.oral_task===true;
  const field=q.question_type==="mcq"?'<div class="exam-options">'+(q.options||[]).map((o,n)=>'<label><input type="radio" name="q-'+q.id+'" value="'+n+'"> '+esc(o)+'</label>').join("")+'</div>':'<textarea name="q-'+q.id+'" rows="5" maxlength="12000" placeholder="'+(oral?"Entraînez-vous à voix haute, puis utilisez éventuellement la dictée vocale du clavier pour transcrire votre réponse…":"Rédigez votre réponse ici…")+'"></textarea>';
  const recorderControls=oral?'<div class="exam-recording-controls"><button class="secondary" type="button" data-record-start="'+q.id+'">Enregistrer ma réponse</button><button class="secondary" type="button" data-record-stop="'+q.id+'" disabled>Arrêter</button><span class="exam-small" id="recording-status-'+q.id+'">Microphone requis · fichier privé</span><audio id="recorded-audio-'+q.id+'" controls preload="none" class="exam-recorded-audio hidden"></audio></div>':"";
  return '<div class="exam-question"><h3>Question '+(i+1)+' · '+Number(q.points)+' point(s)</h3><p>'+esc(prompt)+'</p>'+audioControls+field+recorderControls+'</div>';
 }
 async function submitExam(ev,questions,forced=false){
  ev.preventDefault();if(recorders.size||recordingUploads.size){notify("Arrêtez le microphone et attendez la fin de l’envoi audio avant de soumettre.",true);return;}if(sectionGroups.length&&sectionIndex<sectionGroups.length)captureSectionAnswers(ev.currentTarget,sectionGroups[sectionIndex]);if(!forced&&!confirm("Soumettre définitivement vos réponses ?"))return;
  if(timerInterval)clearInterval(timerInterval);if(sectionTimerInterval)clearInterval(sectionTimerInterval);
  const f=new FormData(ev.currentTarget),answers=questions.map(q=>{const saved=sectionAnswers.get(q.id);if(q.question_type==="mcq")return {question_id:q.id,selected_option:saved?saved.selected_option:(f.has("q-"+q.id)?Number(f.get("q-"+q.id)):-1)};const answer=saved||{question_id:q.id,answer_text:String(f.get("q-"+q.id)||"").trim()};const audio=recordings.get(q.id);if(audio){answer.audio_path=audio.path;answer.audio_mime=audio.mime;answer.audio_size_bytes=audio.size;}return answer;});
  const {data,error}=await sb.rpc("academy_submit_mock_exam",{p_attempt_id:activeAttempt,p_answers:answers});if(error)return notify(error.message,true);
  activeAttempt=null;activeExam=null;await load();render();
  notify(data.status==="expired"?"Temps écoulé : la tentative est clôturée.":data.status==="graded"?"Examen corrigé : "+data.percentage+" %.":"Copie soumise. Les réponses rédigées attendent une correction humaine.");
 }
 async function loadReview(id){
  const a=attempts.find(x=>x.id===id);if(!a)return;
  const resp=await sb.from("academy_mock_exam_responses").select("id,question_id,response,awarded_score,feedback").eq("attempt_id",id);if(resp.error)return notify(resp.error.message,true);
  const ids=resp.data.map(x=>x.question_id),qs=await sb.from("academy_mock_exam_questions").select("id,prompt,points,question_type,rubric").in("id",ids);if(qs.error)return notify(qs.error.message,true);
  const audioUrls=new Map();for(const r of resp.data){const path=r.response?.audio_path;if(path){const signed=await sb.storage.from("language-recordings").createSignedUrl(path,300);if(!signed.error)audioUrls.set(r.id,signed.data.signedUrl);}}
  const panel=document.createElement("section");panel.className="exam-panel";panel.innerHTML='<h2>Correction d’une copie</h2><p class="exam-muted">Attribuez une note dans la limite du barème et laissez un commentaire pédagogique. Les fichiers audio sont accessibles par lien temporaire privé. Le certificat sera généré si le seuil est atteint.</p><form id="exam-review-form">'+resp.data.map(r=>{const q=qs.data.find(x=>x.id===r.question_id);if(q.question_type!=="short_answer")return "";const audio=audioUrls.get(r.id);return '<div class="exam-question"><h3>'+esc(q.prompt)+'</h3><p><strong>Transcription :</strong> '+esc(r.response?.answer_text||"—") +'</p>'+(audio?'<p><strong>Enregistrement oral :</strong></p><audio controls preload="none" class="exam-review-audio" src="'+esc(audio)+'"></audio>':'<p class="exam-small">Aucun fichier audio joint.</p>')+'<p class="exam-small">Critères : '+esc(JSON.stringify(q.rubric||{}))+'</p><label>Note / '+q.points+'<input type="number" name="score-'+r.id+'" min="0" max="'+q.points+'" step="0.1" required></label><label>Retour pédagogique<textarea name="feedback-'+r.id+'" rows="2"></textarea></label></div>';}).join("")+'<button class="primary" type="submit">Valider la correction</button></form>';
  root.prepend(panel);panel.scrollIntoView({behavior:"smooth"});
  panel.querySelector("form").addEventListener("submit",async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);const grades=resp.data.filter(r=>qs.data.find(q=>q.id===r.question_id)?.question_type==="short_answer").map(r=>({response_id:r.id,awarded_score:Number(f.get("score-"+r.id)),feedback:String(f.get("feedback-"+r.id)||"")}));const out=await sb.rpc("academy_admin_grade_mock_exam",{p_attempt_id:id,p_grades:grades});if(out.error)return notify(out.error.message,true);await load();render();notify("Correction enregistrée : "+out.data.percentage+" %.");});
 }
 async function verifyCertificate(ev){ev.preventDefault();const code=new FormData(ev.currentTarget).get("code");await verifyCode(code);}
 function participationAdminPanel(){
  const learnerOptions=academyLearners.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.full_name||p.email||p.id)+'</option>').join("");
  const rows=adminParticipationCertificates.map(a=>'<div class="exam-review"><div><strong>'+esc(a.learner_name_snapshot)+'</strong><div class="exam-small">'+esc(a.activity_title)+' · '+new Date(a.activity_date+'T12:00:00').toLocaleDateString("fr-FR")+' · '+Number(a.duration_minutes)+' min · '+(a.revoked_at?"Révoquée":"Valide")+'</div><code>'+esc(a.verification_code)+'</code></div><div class="exam-actions"><button class="secondary" data-verify-own="'+esc(a.verification_code)+'">Vérifier</button>'+(a.revoked_at?"":'<button class="primary" data-print-participation="'+esc(a.verification_code)+'">Imprimer</button><button class="secondary" data-revoke-participation="'+esc(a.id)+'">Révoquer</button>')+'</div></div>').join("")||'<div class="exam-empty">Aucune attestation émise pour le moment.</div>';
  return '<section class="exam-panel"><h2>Administration — attestations de participation</h2><p class="exam-muted">Émettez une attestation uniquement après avoir vérifié la présence ou l’achèvement réel de l’activité. Une preuve justificative est obligatoire.</p>'+
   (learnerOptions?'<form id="participation-issue-form" class="exam-admin-grid"><label>Apprenant<select name="learner_id" required>'+learnerOptions+'</select></label><label>Type d’activité<select name="activity_type" required><option value="course">Formation / cours</option><option value="live_session">Séance en direct</option><option value="workshop">Atelier</option><option value="webinar">Webinaire</option><option value="other">Autre activité</option></select></label><label>Intitulé<input name="activity_title" required minlength="5" maxlength="180" placeholder="Ex. Atelier expression orale TEF Canada"></label><label>Date de participation<input name="activity_date" type="date" max="'+new Date().toISOString().slice(0,10)+'" required></label><label>Durée (minutes)<input name="duration_minutes" type="number" min="1" max="5000" required></label><label>Preuve / référence de présence<textarea name="evidence_note" minlength="12" maxlength="1000" required placeholder="Ex. Présence confirmée par le formateur et feuille d’émargement du ..."></textarea></label><button class="primary" type="submit">Émettre l’attestation</button></form>':'<p class="exam-muted">Aucun compte apprenant actif n’est disponible pour le moment.</p>')+
   '<h3>Dernières attestations émises</h3>'+rows+'</section>';
 }
 async function revokeParticipation(id){
  const reason=window.prompt("Motif obligatoire de révocation (8 à 500 caractères) :");
  if(reason===null)return;
  if(reason.trim().length<8)return notify("Le motif doit contenir au moins 8 caractères.",true);
  const {error}=await sb.rpc("academy_admin_revoke_participation_attestation",{p_attestation_id:id,p_reason:reason.trim()});
  if(error)return notify("Révocation impossible : "+error.message,true);
  await load();render();notify("Attestation révoquée. Sa vérification publique indiquera désormais qu’elle n’est plus valide.");
 }
 async function issueParticipation(ev){
  ev.preventDefault();const form=ev.currentTarget,fd=new FormData(form);
  const payload={p_learner_id:String(fd.get("learner_id")),p_activity_type:String(fd.get("activity_type")),p_activity_title:String(fd.get("activity_title")).trim(),p_activity_date:String(fd.get("activity_date")),p_duration_minutes:Number(fd.get("duration_minutes")),p_evidence_note:String(fd.get("evidence_note")).trim()};
  const button=form.querySelector('button[type="submit"]');button.disabled=true;
  try{const {data,error}=await sb.rpc("academy_admin_issue_participation_attestation",payload);if(error)throw error;await load();render();notify("Attestation émise. Numéro : "+data.verification_code+". Vous pouvez maintenant l’imprimer.");}
  catch(e){notify("Émission impossible : "+e.message,true);}
  finally{button.disabled=false;}
 }
 function printParticipationCertificate(code){
  const a=participationCertificates.find(x=>x.verification_code===code)||adminParticipationCertificates.find(x=>x.verification_code===code);
  if(!a||a.revoked_at)return notify("Cette attestation n’est pas disponible pour impression.",true);
  const verifyUrl=location.origin+location.pathname+"?verify="+encodeURIComponent(code);
  const w=window.open("","_blank");if(!w)return notify("Autorisez les fenêtres contextuelles pour imprimer l’attestation.",true);
  const date=new Date(a.activity_date+"T12:00:00").toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});
  const issued=new Date(a.issued_at).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});
  const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Attestation '+esc(code)+' | CanadaCase Academy</title><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\\/script><style>body{margin:0;background:#f2f4f7;color:#102a43;font-family:Georgia,serif}.toolbar{text-align:center;padding:18px;font:14px Arial}.toolbar button{padding:10px 18px;background:#123653;color:white;border:0;border-radius:8px}.sheet{margin:20px auto;padding:22mm;width:250mm;min-height:165mm;background:white;border:4px double #b18a45;text-align:center}.brand{font:700 25px Arial;letter-spacing:2px}.sub{font:italic 13px Arial;color:#64748b}.rule{height:2px;background:#b18a45;margin:22px 0}.eyebrow{font:700 12px Arial;letter-spacing:3px;color:#9b783c}.heading{font-size:34px;margin:10px}.heading-en{font:italic 20px Arial;color:#52677c}.name{font-size:30px;font-weight:bold;margin:22px 0}.detail{font:16px/1.7 Arial}.activity{font-size:22px;font-weight:bold;margin:12px}.foot{display:flex;justify-content:space-between;align-items:end;margin-top:28px;font:12px Arial}.qr{width:120px;height:120px}.code{font:11px monospace;margin-top:6px}.disclaimer{font:10px Arial;color:#667788;margin-top:18px}@media print{@page{size:A4 landscape;margin:0}.toolbar{display:none}.sheet{margin:0;width:297mm;height:210mm;min-height:210mm;padding:18mm;page-break-inside:avoid}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="toolbar"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></div><main class="sheet"><div class="brand">CANADACASE ACADEMY</div><div class="sub">Apprendre sans frontières · Learning without borders</div><div class="rule"></div><div class="eyebrow">ATTESTATION DE PARTICIPATION</div><div class="heading">Certificate of Participation</div><p class="detail">La Direction pédagogique atteste que / The Academic Directorate certifies that</p><div class="name">'+esc(a.learner_name_snapshot)+'</div><p class="detail">a participé à l’activité pédagogique suivante / participated in the following learning activity:</p><div class="activity">'+esc(a.activity_title)+'</div><p class="detail">Date / Date: <strong>'+esc(date)+'</strong><br>Durée / Duration: <strong>'+Number(a.duration_minutes)+' minutes</strong><br>Émise le / Issued on: <strong>'+esc(issued)+'</strong></p><div class="rule"></div><div class="foot"><div>Direction pédagogique<br>Academic Directorate<br>CanadaCase Academy</div><div><div id="qrcode" class="qr"></div><div class="code">N° '+esc(code)+'</div><div>Scanner pour vérifier / Scan to verify<br>'+esc(verifyUrl)+'</div></div></div><div class="disclaimer">Attestation interne CanadaCase Academy fondée sur une présence ou participation vérifiée. Elle ne constitue pas un diplôme ni un résultat officiel TEF/TCF.<br>Internal participation record; not an official TEF/TCF result or diploma.</div></main><script>try{new QRCode(document.getElementById("qrcode"),{text:'+JSON.stringify(verifyUrl)+',width:116,height:116})}catch(e){document.getElementById("qrcode").textContent="QR indisponible"}</script></body></html>';
  w.document.open();w.document.write(html);w.document.close();
 }
 async function verifyCode(code){
  const {data,error}=await sb.rpc("academy_verify_certificate",{p_code:String(code||"").trim()});
  const target=document.getElementById("certificate-result");if(error){target.textContent="Vérification indisponible : "+error.message;return;}
  target.className="exam-result "+(data.valid?"good":"bad");
  if(!data.valid){target.textContent=data.message;return;}
  const date=new Date(data.issued_at).toLocaleDateString("fr-FR");
  target.textContent=data.certificate_type==="participation"
   ?data.message+" Titulaire : "+data.learner_name+". Activité : "+data.activity_title+". Date : "+new Date(data.activity_date+"T12:00:00").toLocaleDateString("fr-FR")+". Durée : "+data.duration_minutes+" minutes. Émise le "+date+"."
   :data.message+" Titulaire : "+data.learner_name+". Évaluation : "+data.exam_title+". Résultat : "+data.percentage+" %. Émis le "+date+".";
 }
 function printCertificate(code){
  const c=certificates.find(x=>x.verification_code===code);if(!c||c.revoked_at)return notify("Ce certificat n’est pas disponible pour impression.",true);
  const verifyUrl=location.origin+location.pathname+"?verify="+encodeURIComponent(code);
  const w=window.open("","_blank");if(!w)return notify("Autorisez les fenêtres contextuelles pour imprimer le certificat.",true);
  const date=new Date(c.issued_at).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});
  const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificate '+esc(code)+' | CanadaCase Academy</title><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script><style>*{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#102a43;font-family:Georgia,Times New Roman,serif}.toolbar{padding:16px;text-align:center;font-family:Arial,sans-serif}.toolbar button{border:0;border-radius:8px;padding:11px 18px;background:#123653;color:white;font-weight:700;margin:0 5px;cursor:pointer}.sheet{width:277mm;min-height:190mm;margin:12px auto;padding:18mm;border:3px double #b18a45;background:#fff;text-align:center}.topline{font:700 11px Arial,sans-serif;letter-spacing:4px;color:#a27c38}.brand{font:700 28px Arial,sans-serif;letter-spacing:1px;margin:9px 0;color:#102a43}.subtitle{font:italic 13px Arial,sans-serif;color:#627386}.rule{height:2px;background:linear-gradient(90deg,transparent,#b18a45,transparent);margin:18px 0}.eyebrow{font:700 12px Arial,sans-serif;letter-spacing:3px;color:#9b783c;margin-top:18px}.heading{font-size:34px;margin:8px 0 3px}.heading-en{font:italic 20px Arial,sans-serif;color:#52677c}.present{font:16px Arial,sans-serif;margin-top:24px}.name{font-size:32px;font-weight:700;margin:12px 0;border-bottom:1px solid #b18a45;display:inline-block;min-width:60%;padding:0 10px 8px}.detail{font:16px/1.65 Arial,sans-serif;margin:15px auto;max-width:780px}.course{font-weight:700;font-size:20px}.foot{display:flex;justify-content:space-between;align-items:end;margin-top:24px;text-align:left;font:12px Arial,sans-serif}.signature{border-top:1px solid #9aa8b6;padding-top:8px;width:220px;text-align:center}.qr{width:126px;height:126px;padding:3px;border:1px solid #d5dde5;background:white}.code{font:11px monospace;margin-top:6px}.verify{font:10px Arial,sans-serif;color:#506477;max-width:210px;overflow-wrap:anywhere;text-align:center}.disclaimer{font:10px Arial,sans-serif;color:#667788;margin-top:16px}@media print{@page{size:A4 landscape;margin:0}.toolbar{display:none}.sheet{width:297mm;height:210mm;min-height:210mm;margin:0;padding:15mm;border:3px double #b18a45;page-break-inside:avoid}body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="toolbar"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button><button onclick="window.close()">Fermer</button></div><main class="sheet"><div class="topline">CANADACASE · ACADEMY</div><div class="brand">CANADACASE ACADEMY</div><div class="subtitle">Learning without borders · Apprendre sans frontières</div><div class="rule"></div><div class="eyebrow">CERTIFICAT DE RÉUSSITE</div><div class="heading">Certificate of Achievement</div><div class="present">La Direction pédagogique atteste que / The Academic Directorate certifies that</div><div class="name">'+esc(c.learner_name_snapshot||"Apprenant")+'</div><div class="detail">a réussi l’évaluation de formation suivante / has successfully completed the following learning assessment :</div><div class="course">'+esc(c.exam_title_snapshot)+'</div><div class="detail">Résultat / Score : <strong>'+Number(c.percentage).toFixed(1)+' %</strong><br>Émis le / Issued on : <strong>'+esc(date)+'</strong></div><div class="rule"></div><div class="foot"><div class="signature">Direction pédagogique<br>Academic Directorate<br>CanadaCase Academy</div><div><div id="qrcode" class="qr"></div><div class="code">N° '+esc(code)+'</div><div class="verify">Scanner pour vérifier l’authenticité<br>Scan to verify authenticity<br>'+esc(verifyUrl)+'</div></div></div><div class="disclaimer">Document de formation interne CanadaCase Academy. Ne remplace pas un résultat officiel TEF/TCF ni une attestation délivrée par un centre agréé.<br>Internal CanadaCase Academy learning document. Not an official TEF/TCF result or test-centre certificate.</div></main><script>try{new QRCode(document.getElementById("qrcode"),{text:'+JSON.stringify(verifyUrl)+',width:120,height:120,correctLevel:QRCode.CorrectLevel.M})}catch(e){document.getElementById("qrcode").textContent="QR indisponible"}</script></body></html>';
  w.document.open();w.document.write(html);w.document.close();
 }

 init().catch(e=>{root.innerHTML='<div class="exam-panel exam-result bad">Impossible de charger les examens : '+esc(e.message)+'</div>';});
})();