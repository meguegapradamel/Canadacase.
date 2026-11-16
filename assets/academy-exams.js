(() => {
 const cfg=window.CANADACASE_CONFIG||{},root=document.getElementById("exam-app"),logout=document.getElementById("exam-logout");
 if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase?.createClient){root.innerHTML='<div class="exam-panel">Configuration Supabase indisponible.</div>';return;}
 const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
 let user=null,profile=null,isAdmin=false,exams=[],attempts=[],certificates=[],activeAttempt=null,activeExam=null,timerInterval=null,audioScripts=new Map(),timeExpired=false;
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const notify=(m,bad=false)=>{const n=document.getElementById("exam-notice");n.textContent=m;n.className="exam-notice"+(bad?" error":"");n.classList.remove("hidden");};
 const money=n=>new Intl.NumberFormat("fr-FR").format(Number(n||0));
 async function init(){
  document.getElementById("certificate-verify-form").addEventListener("submit",verifyCertificate);
  const s=await sb.auth.getSession();if(s.error)throw s.error;
  if(!s.data.session){root.innerHTML='<div class="exam-panel"><h2>Connexion requise</h2><p>Connectez-vous avec votre compte CanadaCase pour passer un examen et consulter vos attestations.</p><a class="primary" href="index.html">Se connecter</a></div>';return;}
  user=s.data.session.user;
  const p=await sb.from("profiles").select("id,full_name,role,is_active").eq("id",user.id).single();if(p.error)throw p.error;profile=p.data;
  if(profile.is_active===false){await sb.auth.signOut();return;}
  isAdmin=profile.role==="admin";
  logout.classList.remove("hidden");logout.addEventListener("click",async()=>{await sb.auth.signOut();location.href="index.html";});
  await load();render();
 }
 async function load(){
  const qs=await Promise.all([
   sb.from("academy_mock_exams").select("id,title,exam_code,instructions,duration_minutes,pass_percentage,max_attempts,requires_entitlement,status,created_by,created_at").order("created_at",{ascending:false}),
   sb.from("academy_mock_exam_attempts").select("id,exam_id,attempt_number,status,started_at,submitted_at,score,max_score,percentage,feedback_summary").order("created_at",{ascending:false}),
   sb.from("academy_certificates").select("id,verification_code,exam_title_snapshot,percentage,issued_at,revoked_at").eq("learner_id",user.id).order("issued_at",{ascending:false})
  ]);
  for(const x of qs)if(x.error)throw x.error;[exams,attempts,certificates]=qs.map(x=>x.data||[]);
 }
 function render(){
  const visible=exams.filter(e=>e.status==="published"||e.created_by===user.id||isAdmin);
  const cards=visible.map(e=>'<article class="exam-card"><span class="exam-chip">'+(e.status==="published"?"Publié":e.status==="draft"?"Brouillon":"Archivé")+'</span><h3>'+esc(e.title)+'</h3><p>'+esc(e.instructions||"Examen blanc CanadaCase Academy")+'</p><div class="exam-meta"><span>'+e.duration_minutes+' min</span><span>Seuil '+Number(e.pass_percentage)+' %</span><span>'+e.max_attempts+' tentative(s)</span><span>'+(e.requires_entitlement?"Accès payant":"Accès libre")+'</span></div>'+
   (e.status==="published"?'<button class="primary" data-start="'+e.id+'">Commencer</button>':(isAdmin?'<button class="secondary" data-publish="'+e.id+'">Publier</button>':''))+
   (isAdmin&&e.status==="draft"?'<button class="secondary" data-add-question="'+e.id+'">Ajouter une question</button>':'')+
   '</article>').join("")||'<div class="exam-empty">Aucun examen publié pour le moment.</div>';
  const myAttempts=attempts.map(a=>{const e=exams.find(x=>x.id===a.exam_id);return '<div class="exam-cert"><div><strong>'+esc(e?.title||"Examen")+'</strong><div class="exam-small">Tentative '+a.attempt_number+' · '+esc(a.status)+'</div></div><strong>'+(a.percentage===null?"En correction":Number(a.percentage).toFixed(1)+" %")+'</strong></div>';}).join("")||'<div class="exam-empty">Aucune tentative pour le moment.</div>';
  const certs=certificates.map(c=>'<div class="exam-cert"><div><strong>'+esc(c.exam_title_snapshot)+'</strong><div class="exam-small">'+Number(c.percentage).toFixed(1)+' % · '+(c.revoked_at?"Révoqué":"Émis le "+new Date(c.issued_at).toLocaleDateString("fr-FR"))+'</div><code>'+esc(c.verification_code)+'</code></div><button class="secondary" data-verify-own="'+esc(c.verification_code)+'">Vérifier</button></div>').join("")||'<div class="exam-empty">Aucun certificat délivré. Un certificat est généré automatiquement après réussite et correction complète.</div>';
  root.innerHTML='<section class="exam-panel"><h2>Examens disponibles</h2><p class="exam-muted">Les réponses QCM sont corrigées automatiquement. Les réponses rédigées sont évaluées par un formateur à partir d’une grille de critères ; aucune API d’IA payante n’est appelée.</p><div class="exam-grid">'+cards+'</div></section>'+
   '<section class="exam-panel"><h2>Mes résultats</h2>'+myAttempts+'</section><section class="exam-panel"><h2>Mes certificats</h2>'+certs+'</section>'+
   (isAdmin?adminPanel():"");
  bind();
 }
 function adminPanel(){
  const pending=attempts.filter(a=>a.status==="awaiting_review");
  return '<section class="exam-panel"><h2>Administration — créer un examen</h2><form id="exam-create-form" class="exam-admin-grid">'+
   '<label>Titre<input name="title" required minlength="5" maxlength="180"></label><label>Code unique<input name="exam_code" required maxlength="40" pattern="[A-Za-z0-9_-]{3,40}" placeholder="TEF-ORAL-B1"></label>'+
   '<label>Durée (minutes)<input name="duration_minutes" type="number" min="5" max="300" value="60" required></label><label>Seuil de réussite (%)<input name="pass_percentage" type="number" min="0" max="100" value="60" required></label>'+
   '<label>Nombre de tentatives<input name="max_attempts" type="number" min="1" max="20" value="1" required></label><label><input name="requires_entitlement" type="checkbox" checked> Exiger un droit d’examen</label><button class="primary" type="submit">Créer le brouillon</button></form>'+
   '<h3>Corrections à effectuer</h3>'+ (pending.length?pending.map(a=>'<div class="exam-review" data-review="'+a.id+'"><strong>'+esc(exams.find(e=>e.id===a.exam_id)?.title||"Examen")+'</strong><button class="secondary" data-load-review="'+a.id+'">Ouvrir la correction</button></div>').join(""):'<div class="exam-empty">Aucune copie en attente de correction.</div>')+'</section>';
 }
 function bind(){
  root.querySelectorAll("[data-start]").forEach(b=>b.addEventListener("click",()=>startExam(b.dataset.start)));
  root.querySelectorAll("[data-publish]").forEach(b=>b.addEventListener("click",()=>publishExam(b.dataset.publish)));
  root.querySelectorAll("[data-add-question]").forEach(b=>b.addEventListener("click",()=>questionForm(b.dataset.addQuestion)));
  root.querySelectorAll("[data-verify-own]").forEach(b=>b.addEventListener("click",()=>verifyCode(b.dataset.verifyOwn)));
  root.querySelectorAll("[data-load-review]").forEach(b=>b.addEventListener("click",()=>loadReview(b.dataset.loadReview)));
  document.getElementById("exam-create-form")?.addEventListener("submit",createExam);
 }
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
  activeAttempt=data;activeExam=exams.find(e=>e.id===id);timeExpired=false;audioScripts.clear();
  const attemptRow=await sb.from("academy_mock_exam_attempts").select("started_at").eq("id",activeAttempt).single();if(attemptRow.error)return notify(attemptRow.error.message,true);
  const q=await sb.from("academy_mock_exam_questions").select("id,prompt,question_type,options,points,position,rubric").eq("exam_id",id).order("position");if(q.error)return notify(q.error.message,true);
  if(!q.data.length)return notify("Cet examen ne contient pas encore de questions.",true);
  const deadline=new Date(attemptRow.data.started_at).getTime()+Number(activeExam.duration_minutes)*60000;
  root.innerHTML='<section class="exam-panel"><h2>'+esc(activeExam.title)+'</h2><div class="exam-clock" id="exam-clock" role="timer" aria-live="off"></div><p class="exam-muted">Le temps est contrôlé par le serveur. Soumettez avant la fin du délai. Les réponses orales de cette version sont des transcriptions d’entraînement, pas des enregistrements audio.</p><form id="exam-answer-form">'+q.data.map((x,i)=>questionHtml(x,i)).join("")+'<div class="exam-actions"><button class="primary" type="submit">Soumettre mes réponses</button></div></form></section>';
  const form=document.getElementById("exam-answer-form");
  form.addEventListener("submit",ev=>submitExam(ev,q.data,timeExpired));
  root.querySelectorAll("[data-play-audio]").forEach(b=>b.addEventListener("click",()=>{
   const script=audioScripts.get(b.dataset.playAudio);if(!script)return;
   if(!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window)){document.getElementById("audio-script-"+b.dataset.playAudio)?.classList.remove("hidden");return notify("La lecture vocale n’est pas disponible sur cet appareil. Affichez le script de secours.",true);}
   window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(script);utterance.lang="fr-FR";window.speechSynthesis.speak(utterance);
  }));
  root.querySelectorAll("[data-show-audio]").forEach(b=>b.addEventListener("click",()=>document.getElementById("audio-script-"+b.dataset.showAudio)?.classList.toggle("hidden")));
  const clock=document.getElementById("exam-clock");
  const tick=()=>{const remaining=Math.max(0,deadline-Date.now()),minutes=Math.floor(remaining/60000),seconds=Math.floor((remaining%60000)/1000);clock.textContent="Temps restant : "+String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0");if(remaining===0){clearInterval(timerInterval);timeExpired=true;notify("Le temps imparti est écoulé. Soumettez immédiatement ; le serveur vérifiera l’heure limite.",true);}};
  tick();timerInterval=setInterval(tick,1000);
 }
 function questionHtml(q,i){
  let prompt=String(q.prompt||""),audioControls="";
  const match=prompt.match(/\\[\\[AUDIO\\]\\]([\\s\\S]*?)\\[\\[\\/AUDIO\\]\\]/);
  if(match){audioScripts.set(q.id,match[1].trim());prompt=prompt.replace(match[0],"Document audio : utilisez le bouton de lecture vocale.");audioControls='<div class="exam-audio-controls"><button class="secondary" type="button" data-play-audio="'+q.id+'">Écouter (voix synthétique)</button><button class="secondary" type="button" data-show-audio="'+q.id+'">Afficher le script</button><p class="exam-audio-script hidden" id="audio-script-'+q.id+'">'+esc(match[1].trim())+'</p></div>';}
  const oral=q.rubric?.oral_task===true;
  const field=q.question_type==="mcq"?'<div class="exam-options">'+(q.options||[]).map((o,n)=>'<label><input type="radio" name="q-'+q.id+'" value="'+n+'"> '+esc(o)+'</label>').join("")+'</div>':'<textarea name="q-'+q.id+'" rows="5" maxlength="12000" placeholder="'+(oral?"Entraînez-vous à voix haute, puis utilisez éventuellement la dictée vocale du clavier pour transcrire votre réponse…":"Rédigez votre réponse ici…")+'"></textarea>';
  return '<div class="exam-question"><h3>Question '+(i+1)+' · '+Number(q.points)+' point(s)</h3><p>'+esc(prompt)+'</p>'+audioControls+field+'</div>';
 }
 async function submitExam(ev,questions,forced=false){
  ev.preventDefault();if(!forced&&!confirm("Soumettre définitivement vos réponses ?"))return;
  if(timerInterval)clearInterval(timerInterval);
  const f=new FormData(ev.currentTarget),answers=questions.map(q=>q.question_type==="mcq"?{question_id:q.id,selected_option:f.has("q-"+q.id)?Number(f.get("q-"+q.id)):-1}:{question_id:q.id,answer_text:String(f.get("q-"+q.id)||"").trim()});
  const {data,error}=await sb.rpc("academy_submit_mock_exam",{p_attempt_id:activeAttempt,p_answers:answers});if(error)return notify(error.message,true);
  activeAttempt=null;activeExam=null;await load();render();
  notify(data.status==="expired"?"Temps écoulé : la tentative est clôturée.":data.status==="graded"?"Examen corrigé : "+data.percentage+" %.":"Copie soumise. Les réponses rédigées attendent une correction humaine.");
 }
 async function loadReview(id){
  const a=attempts.find(x=>x.id===id);if(!a)return;
  const resp=await sb.from("academy_mock_exam_responses").select("id,question_id,response,awarded_score,feedback").eq("attempt_id",id);if(resp.error)return notify(resp.error.message,true);
  const ids=resp.data.map(x=>x.question_id),qs=await sb.from("academy_mock_exam_questions").select("id,prompt,points,question_type,rubric").in("id",ids);if(qs.error)return notify(qs.error.message,true);
  const panel=document.createElement("section");panel.className="exam-panel";panel.innerHTML='<h2>Correction d’une copie</h2><p class="exam-muted">Attribuez une note dans la limite du barème et laissez un commentaire pédagogique. Le certificat sera généré si le seuil est atteint.</p><form id="exam-review-form">'+resp.data.map(r=>{const q=qs.data.find(x=>x.id===r.question_id);if(q.question_type!=="short_answer")return "";return '<div class="exam-question"><h3>'+esc(q.prompt)+'</h3><p><strong>Réponse :</strong> '+esc(r.response?.answer_text||"—")+'</p><p class="exam-small">Critères : '+esc(JSON.stringify(q.rubric||{}))+'</p><label>Note / '+q.points+'<input type="number" name="score-'+r.id+'" min="0" max="'+q.points+'" step="0.1" required></label><label>Retour pédagogique<textarea name="feedback-'+r.id+'" rows="2"></textarea></label></div>';}).join("")+'<button class="primary" type="submit">Valider la correction</button></form>';
  root.prepend(panel);panel.scrollIntoView({behavior:"smooth"});
  panel.querySelector("form").addEventListener("submit",async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);const grades=resp.data.filter(r=>qs.data.find(q=>q.id===r.question_id)?.question_type==="short_answer").map(r=>({response_id:r.id,awarded_score:Number(f.get("score-"+r.id)),feedback:String(f.get("feedback-"+r.id)||"")}));const out=await sb.rpc("academy_admin_grade_mock_exam",{p_attempt_id:id,p_grades:grades});if(out.error)return notify(out.error.message,true);await load();render();notify("Correction enregistrée : "+out.data.percentage+" %.");});
 }
 async function verifyCertificate(ev){ev.preventDefault();const code=new FormData(ev.currentTarget).get("code");await verifyCode(code);}
 async function verifyCode(code){
  const {data,error}=await sb.rpc("academy_verify_certificate",{p_code:String(code||"").trim()});
  const target=document.getElementById("certificate-result");if(error){target.textContent="Vérification indisponible : "+error.message;return;}
  target.className="exam-result "+(data.valid?"good":"bad");
  target.textContent=data.valid?data.message+" Titulaire : "+data.learner_name+". Évaluation : "+data.exam_title+". Résultat : "+data.percentage+" %. Émis le "+new Date(data.issued_at).toLocaleDateString("fr-FR")+".":data.message;
 }
 init().catch(e=>{root.innerHTML='<div class="exam-panel exam-result bad">Impossible de charger les examens : '+esc(e.message)+'</div>';});
})();