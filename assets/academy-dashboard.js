(() => {
  const cfg=window.CANADACASE_CONFIG||{};
  const root=document.getElementById("academy-dashboard");
  const logout=document.getElementById("dashboard-logout");
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase?.createClient){
    root.innerHTML='<div class="panel"><h1>Configuration indisponible</h1><p>Le service Academy n’est pas configuré.</p></div>';return;
  }
  const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  let user=null,profile=null,roles=[],isAdmin=false,isTrainer=false;
  let goals=[],events=[],enrollments=[],courses=[],progress=[],attempts=[],submissions=[],assignments=[],lessonTotals={};
  const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const safeDate=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});};
  const dateInput=v=>{const d=new Date(v);const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,16);};
  const notice=(msg,error=false)=>{const n=document.getElementById("dashboard-notice");if(!n)return;n.textContent=msg;n.className="dashboard-notice"+(error?" error":"");n.classList.remove("hidden");};
  const pct=(a,b)=>b?Math.round(a/b*100):0;
  const mins=n=>{n=Number(n)||0;return n>=60?Math.floor(n/60)+" h "+(n%60? n%60+" min":""):n+" min";};
  const courseTitle=id=>courses.find(c=>c.id===id)?.title||"Formation";
  const goalTitle=id=>goals.find(g=>g.id===id)?.title||"Objectif personnel";
  const statusLabel=s=>({active:"En cours",completed:"Terminé",cancelled:"Annulé",planned:"Planifié",paused:"En pause",submitted:"À corriger",needs_revision:"À reprendre",graded:"Corrigé"}[s]||s);
  async function init(){
    const {data:s,error}=await sb.auth.getSession();if(error)throw error;
    if(!s.session){root.innerHTML='<div class="panel"><h1>Connexion requise</h1><p>Connectez-vous avec votre compte CanadaCase pour consulter votre tableau de bord.</p><a class="primary" href="index.html">Se connecter</a></div>';return;}
    user=s.session.user;
    const {data:p,error:pe}=await sb.from("profiles").select("id,full_name,role,is_active").eq("id",user.id).single();if(pe)throw pe;
    if(p.is_active===false){await sb.auth.signOut();root.innerHTML='<div class="panel"><h1>Compte désactivé</h1><p>Contactez l’administration CanadaCase.</p></div>';return;}
    profile=p;isAdmin=p.role==="admin";
    const {data:r,error:re}=await sb.from("academy_user_roles").select("role_code").eq("user_id",user.id);if(re)throw re;
    roles=r||[];isTrainer=roles.some(x=>x.role_code==="trainer");
    logout.classList.remove("hidden");
    await loadDashboard();
    render();
  }
  async function loadDashboard(){
    const [g,e]=await Promise.all([
      sb.from("academy_learning_goals").select("id,title,description,goal_type,target_date,weekly_target_minutes,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}),
      sb.from("academy_study_events").select("id,goal_id,course_id,title,description,event_type,starts_at,ends_at,status,actual_minutes").eq("user_id",user.id).order("starts_at",{ascending:true})
    ]);
    if(g.error)throw g.error;if(e.error)throw e.error;goals=g.data||[];events=e.data||[];
    if(isAdmin){
      const [c,en,apps]=await Promise.all([
        sb.from("academy_courses").select("id,title,status,created_by").order("created_at",{ascending:false}),
        sb.from("academy_enrollments").select("id,course_id,learner_id,status"),
        sb.from("academy_trainer_applications").select("id,status").in("status",["submitted","under_review","needs_info"])
      ]);
      for(const x of [c,en,apps])if(x.error)throw x.error;
      courses=c.data||[];enrollments=en.data||[];assignments=[];submissions=[];attempts=[];progress=[];
      window._academyAdminStats={applications:(apps.data||[]).length};
      return;
    }
    if(isTrainer){
      const {data:c,error:ce}=await sb.from("academy_courses").select("id,title,status,created_by,course_format,created_at").eq("created_by",user.id).order("created_at",{ascending:false});
      if(ce)throw ce;courses=c||[];
      const ids=courses.map(x=>x.id);
      if(!ids.length){enrollments=[];assignments=[];submissions=[];attempts=[];progress=[];return;}
      const [en,a]=await Promise.all([
        sb.from("academy_enrollments").select("id,course_id,learner_id,status,enrolled_at,completed_at").in("course_id",ids),
        sb.from("academy_assignments").select("id,course_id,title,max_score,is_published").in("course_id",ids)
      ]);
      if(en.error)throw en.error;if(a.error)throw a.error;enrollments=en.data||[];assignments=a.data||[];
      const aids=assignments.map(x=>x.id);
      if(aids.length){
        const s=await sb.from("academy_submissions").select("id,assignment_id,learner_id,status,score,submitted_at,graded_at").in("assignment_id",aids).order("submitted_at",{ascending:false});
        if(s.error)throw s.error;submissions=s.data||[];
      }else submissions=[];
      attempts=[];progress=[];
      return;
    }
    const [en,coursesResult,att,subs]=await Promise.all([
      sb.from("academy_enrollments").select("id,course_id,status,enrolled_at,completed_at").eq("learner_id",user.id).order("enrolled_at",{ascending:false}),
      sb.from("academy_courses").select("id,title,summary,status,estimated_minutes,language_code,level_code").order("created_at",{ascending:false}).limit(100),
      sb.from("academy_quiz_attempts").select("id,lesson_id,score,max_score,submitted_at").eq("learner_id",user.id).order("submitted_at",{ascending:false}),
      sb.from("academy_submissions").select("id,assignment_id,status,score,feedback,submitted_at,graded_at").eq("learner_id",user.id).order("submitted_at",{ascending:false})
    ]);
    for(const x of [en,coursesResult,att,subs])if(x.error)throw x.error;
    enrollments=en.data||[];courses=coursesResult.data||[];attempts=att.data||[];submissions=subs.data||[];
    const enids=enrollments.map(x=>x.id);
    if(enids.length){
      const p=await sb.from("academy_lesson_progress").select("id,enrollment_id,lesson_id,status,completed_at").in("enrollment_id",enids);
      if(p.error)throw p.error;progress=p.data||[];
    }else progress=[];
    const courseIds=enrollments.map(x=>x.course_id);
    lessonTotals={};
    if(courseIds.length){
      const m=await sb.from("academy_course_modules").select("id,course_id").in("course_id",courseIds);
      if(m.error)throw m.error;
      const moduleIds=(m.data||[]).map(x=>x.id);
      if(moduleIds.length){
        const l=await sb.from("academy_lessons").select("id,module_id").in("module_id",moduleIds);
        if(l.error)throw l.error;
        const moduleCourse=new Map((m.data||[]).map(x=>[x.id,x.course_id]));
        for(const lesson of (l.data||[])){const courseId=moduleCourse.get(lesson.module_id);if(courseId)lessonTotals[courseId]=(lessonTotals[courseId]||0)+1;}
      }
      const a=await sb.from("academy_assignments").select("id,title,course_id,max_score").in("course_id",courseIds).eq("is_published",true);
      if(a.error)throw a.error;assignments=a.data||[];
    }else assignments=[];
  }
  function stat(label,value,detail){return '<article class="dashboard-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail||"")+'</small></article>';}
  function render(){
    const name=profile.full_name||user.email||"Utilisateur";
    root.innerHTML='<section class="dashboard-hero"><div><p class="eyebrow">CANADACASE · ACADEMY</p><h1>Bonjour '+esc(name.split(" ")[0])+'.</h1><p>Votre espace de pilotage pédagogique, vos objectifs et vos prochaines activités.</p></div><div class="dashboard-hero-actions"><a class="primary" href="academy-catalog.html">Explorer les formations</a><a class="secondary" href="academy.html">Mon profil Academy</a></div></section><div id="dashboard-notice" class="dashboard-notice hidden"></div>'+
      (isAdmin?renderAdmin():isTrainer?renderTrainer():renderLearner());
    if(!isAdmin)bindPersonalPlanner();
    if(isTrainer)bindTrainerActions();
  }
  function renderLearner(){
    const active=enrollments.filter(x=>x.status==="active"),done=enrollments.filter(x=>x.status==="completed");
    const completed=progress.filter(x=>x.status==="completed").length,total=progress.length;
    const quizCount=attempts.length,avg=quizCount?Math.round(attempts.reduce((s,x)=>s+(x.score/x.max_score*100),0)/quizCount):0;
    const pending=submissions.filter(x=>x.status==="submitted").length;
    const now=new Date(),weekStart=new Date(now);weekStart.setDate(now.getDate()-((now.getDay()+6)%7));weekStart.setHours(0,0,0,0);
    const weekMinutes=events.filter(x=>x.status==="completed"&&new Date(x.starts_at)>=weekStart).reduce((s,x)=>s+(x.actual_minutes||0),0);
    const next=events.filter(x=>x.status==="planned"&&new Date(x.starts_at)>=now).slice(0,5);
    const courseCards=active.map(en=>{
      const c=courses.find(x=>x.id===en.course_id);const ps=progress.filter(x=>x.enrollment_id===en.id);
      const finished=ps.filter(x=>x.status==="completed").length;const total=lessonTotals[en.course_id]||ps.length;const ratio=total?pct(finished,total):0;
      return '<article class="dashboard-course"><div><span class="dashboard-chip">'+esc(c?.language_code?.toUpperCase()||"COURS")+'</span><span class="dashboard-chip">'+esc(c?.level_code||"Parcours")+'</span></div><h3>'+esc(c?.title||"Formation")+'</h3><div class="dashboard-progress"><span style="width:'+ratio+'%"></span></div><p>'+ratio+' % · '+finished+' / '+total+' leçon(s) terminée(s)</p><a href="academy-catalog.html">Continuer la formation →</a></article>';
    }).join("")||'<div class="dashboard-empty">Vous n’êtes inscrit à aucune formation. Découvrez le catalogue pour commencer.</div>';
    const openAssignments=assignments.filter(a=>!submissions.some(s=>s.assignment_id===a.id));
    const subRows=(openAssignments.slice(0,4).map(a=>'<div class="dashboard-row"><div><strong>'+esc(a.title)+'</strong><small>'+esc(courseTitle(a.course_id))+'</small></div><span class="dashboard-chip warn">À remettre</span></div>').join(""))+
      (submissions.slice(0,5).map(s=>'<div class="dashboard-row"><div><strong>'+esc(assignments.find(a=>a.id===s.assignment_id)?.title||"Devoir")+'</strong><small>'+safeDate(s.submitted_at)+'</small></div><span class="dashboard-chip '+(s.status==="graded"?"ok":s.status==="needs_revision"?"warn":"")+'">'+esc(statusLabel(s.status))+'</span>'+(s.score!==null?'<strong>'+esc(s.score)+' / '+esc(assignments.find(a=>a.id===s.assignment_id)?.max_score||"—")+'</strong>':'')+'</div>').join(""))||
      (openAssignments.length?"":'<p class="dashboard-muted">Aucun devoir remis pour le moment.</p>');
    return '<section class="dashboard-stats">'+stat("Formations actives",active.length,""+done.length+" terminée(s)")+stat("Leçons terminées",completed,"sur "+total+" suivies")+stat("Moyenne des quiz",quizCount?avg+" %":"—",quizCount+" tentative(s)")+stat("Temps cette semaine",mins(weekMinutes),"objectif hebdomadaire calculé sur vos séances terminées")+'</section>'+
      '<div class="dashboard-columns"><section class="dashboard-panel"><div class="dashboard-section-head"><div><h2>Mes formations</h2><p>Reprenez votre apprentissage là où vous l’avez laissé.</p></div><a href="academy-catalog.html">Catalogue</a></div>'+courseCards+'</section>'+
      '<section class="dashboard-panel"><h2>Mes devoirs</h2><p>Consultez les retours de vos formateurs.</p>'+subRows+'</section></div>'+
      '<div class="dashboard-columns"><section class="dashboard-panel"><h2>Mes objectifs</h2><p>Définissez une cible et un rythme de travail réaliste.</p>'+goalForm()+goalList()+'</section>'+
      '<section class="dashboard-panel"><h2>Mon planning</h2><p>Planifiez vos séances de révision, leçons et simulations.</p>'+eventForm()+eventList(next)+'</section></div>';
  }
  function goalForm(){return '<form id="dashboard-goal-form" class="dashboard-form"><label>Objectif<input name="title" required minlength="3" maxlength="180" placeholder="Ex. Atteindre B2 en expression orale"></label><div class="dashboard-form-grid"><label>Type<select name="goal_type"><option value="general">Général</option><option value="exam">Examen</option><option value="skill">Compétence</option><option value="course">Formation</option></select></label><label>Échéance<input name="target_date" type="date" min="'+new Date().toISOString().slice(0,10)+'"></label></div><label>Temps visé par semaine (minutes)<input name="weekly_target_minutes" type="number" min="15" max="3000" value="180" required></label><button class="primary" type="submit">Ajouter l’objectif</button></form>';}
  function goalList(){return goals.length?goals.map(g=>'<div class="dashboard-row"><div><strong>'+esc(g.title)+'</strong><small>'+esc(g.goal_type)+' · '+mins(g.weekly_target_minutes)+' / semaine'+(g.target_date?' · échéance '+safeDate(g.target_date):'')+'</small></div><span class="dashboard-chip">'+esc(statusLabel(g.status))+'</span><div class="dashboard-row-actions">'+(g.status==="active"?'<button type="button" class="secondary" data-goal-complete="'+esc(g.id)+'">Terminé</button><button type="button" class="secondary" data-goal-pause="'+esc(g.id)+'">Pause</button>':'<button type="button" class="secondary" data-goal-reactivate="'+esc(g.id)+'">Réactiver</button>')+'<button type="button" class="dashboard-delete" data-goal-delete="'+esc(g.id)+'" aria-label="Supprimer l’objectif">×</button></div></div>').join(""):'<div class="dashboard-empty">Aucun objectif défini. Ajoutez votre premier objectif ci-dessus.</div>';}
  function eventForm(){return '<form id="dashboard-event-form" class="dashboard-form"><label>Activité<input name="title" required minlength="3" maxlength="180" placeholder="Ex. Révision compréhension orale"></label><div class="dashboard-form-grid"><label>Type<select name="event_type"><option value="study">Étude</option><option value="revision">Révision</option><option value="mock_exam">Simulation d’examen</option><option value="lesson">Leçon</option><option value="other">Autre</option></select></label><label>Objectif lié<select name="goal_id"><option value="">Aucun</option>'+goals.filter(g=>g.status==="active").map(g=>'<option value="'+esc(g.id)+'">'+esc(g.title)+'</option>').join("")+'</select></label></div><div class="dashboard-form-grid"><label>Début<input name="starts_at" type="datetime-local" required value="'+dateInput(new Date(Date.now()+3600000))+'"></label><label>Fin<input name="ends_at" type="datetime-local" required value="'+dateInput(new Date(Date.now()+7200000))+'"></label></div><button class="primary" type="submit">Planifier la séance</button></form>';}
  function eventList(items){return items.length?items.map(e=>'<div class="dashboard-row"><div><strong>'+esc(e.title)+'</strong><small>'+safeDate(e.starts_at)+' – '+safeDate(e.ends_at)+' · '+esc(goalTitle(e.goal_id))+'</small></div><span class="dashboard-chip">'+esc(statusLabel(e.status))+'</span><div class="dashboard-row-actions">'+(e.status==="planned"?'<button type="button" class="secondary" data-event-complete="'+esc(e.id)+'">Terminer</button><button type="button" class="dashboard-delete" data-event-delete="'+esc(e.id)+'" aria-label="Annuler">×</button>':'')+'</div></div>').join(""):'<div class="dashboard-empty">Aucune séance à venir. Planifiez votre prochaine session.</div>';}
  function renderTrainer(){
    const ids=courses.map(c=>c.id),active=enrollments.filter(e=>e.status==="active"),pending=submissions.filter(s=>s.status==="submitted");
    const uniqueStudents=new Set(active.map(e=>e.learner_id)).size;
    const graded=submissions.filter(s=>s.status==="graded");
    const average=graded.length?Math.round(graded.reduce((n,s)=>{const max=Number(assignments.find(a=>a.id===s.assignment_id)?.max_score||0);return n+(max>0?Number(s.score||0)/max*100:0);},0)/graded.length):0;
    const cards=courses.map(c=>'<article class="dashboard-course"><div><span class="dashboard-chip">'+esc(c.status)+'</span><span class="dashboard-chip">'+esc(c.course_format)+'</span></div><h3>'+esc(c.title)+'</h3><p>'+enrollments.filter(e=>e.course_id===c.id).length+' inscription(s) · '+assignments.filter(a=>a.course_id===c.id).length+' devoir(s)</p><a href="academy-catalog.html">Ouvrir le catalogue et gérer le cours →</a></article>').join("")||'<div class="dashboard-empty">Aucun cours créé. Préparez votre première formation dans le catalogue.</div>';
    const queue=pending.slice(0,8).map(s=>'<div class="dashboard-row"><div><strong>'+esc(assignments.find(a=>a.id===s.assignment_id)?.title||"Devoir")+'</strong><small>Remis le '+safeDate(s.submitted_at)+'</small></div><span class="dashboard-chip warn">À corriger</span></div>').join("")||'<div class="dashboard-empty">Aucun devoir en attente de correction.</div>';
    return '<section class="dashboard-stats">'+stat("Mes formations",courses.length,""+courses.filter(c=>c.status==="published").length+" publiée(s)")+stat("Apprenants actifs",uniqueStudents,"inscriptions actives")+stat("Corrections en attente",pending.length,"devoirs à traiter")+stat("Devoirs corrigés",graded.length,graded.length? "moyenne normalisée "+average+" %":"aucune correction")+'</section>'+
      '<div class="dashboard-columns"><section class="dashboard-panel"><div class="dashboard-section-head"><div><h2>Mes formations</h2><p>Suivez l’activité de vos cours.</p></div><a href="academy-catalog.html">Gérer les cours</a></div>'+cards+'</section>'+
      '<section class="dashboard-panel"><h2>File de correction</h2><p>Les travaux remis par les apprenants de vos cours.</p>'+queue+'<a href="academy-catalog.html">Ouvrir les devoirs et corrections →</a></section></div>'+
      '<section class="dashboard-panel"><h2>Conseil pédagogique</h2><p>Consultez régulièrement les devoirs en attente et actualisez les modules de vos formations. Les données présentées sont issues des inscriptions et des travaux réellement enregistrés.</p></section>';
  }
  function renderAdmin(){
    const stats=window._academyAdminStats||{};
    return '<section class="dashboard-stats">'+stat("Cours Academy",courses.length,"tous statuts")+stat("Inscriptions",enrollments.length,"tous statuts")+stat("Candidatures formateur",stats.applications||0,"à examiner")+'</section><section class="dashboard-panel"><h2>Centre de pilotage Academy</h2><p>Consultez les formations et les candidatures dans les espaces de gestion dédiés.</p><div class="dashboard-links"><a class="primary" href="academy-catalog.html">Gérer le catalogue</a><a class="secondary" href="academy.html">Gérer les formateurs</a></div></section>';
  }
  function bindPersonalPlanner(){
    document.getElementById("dashboard-goal-form")?.addEventListener("submit",async ev=>{
      ev.preventDefault();const d=new FormData(ev.currentTarget);
      const payload={user_id:user.id,title:String(d.get("title")||"").trim(),goal_type:d.get("goal_type"),target_date:d.get("target_date")||null,weekly_target_minutes:Number(d.get("weekly_target_minutes"))};
      const {error}=await sb.from("academy_learning_goals").insert(payload);if(error)return notice(error.message,true);
      await refreshPersonal("Objectif ajouté.");
    });
    document.getElementById("dashboard-event-form")?.addEventListener("submit",async ev=>{
      ev.preventDefault();const d=new FormData(ev.currentTarget),start=new Date(d.get("starts_at")),end=new Date(d.get("ends_at"));
      if(!(end>start))return notice("L’heure de fin doit être postérieure à l’heure de début.",true);
      if(events.some(x=>x.status==="planned"&&start<new Date(x.ends_at)&&end>new Date(x.starts_at)))return notice("Cette séance chevauche une autre activité déjà planifiée. Choisissez un autre créneau.",true);
      const payload={user_id:user.id,title:String(d.get("title")||"").trim(),event_type:d.get("event_type"),goal_id:d.get("goal_id")||null,starts_at:start.toISOString(),ends_at:end.toISOString()};
      const {error}=await sb.from("academy_study_events").insert(payload);if(error)return notice(error.message,true);
      await refreshPersonal("Séance ajoutée au planning.");
    });
    root.querySelectorAll("[data-goal-complete],[data-goal-pause],[data-goal-reactivate]").forEach(b=>b.addEventListener("click",async()=>{
      const status=b.hasAttribute("data-goal-complete")?"completed":b.hasAttribute("data-goal-pause")?"paused":"active";
      const id=b.dataset.goalComplete||b.dataset.goalPause||b.dataset.goalReactivate;
      const {error}=await sb.from("academy_learning_goals").update({status}).eq("id",id).eq("user_id",user.id);
      if(error)return notice(error.message,true);await refreshPersonal("Objectif actualisé.");
    }));
    root.querySelectorAll("[data-goal-delete]").forEach(b=>b.addEventListener("click",async()=>{
      if(!confirm("Supprimer définitivement cet objectif personnel ?"))return;
      const {error}=await sb.from("academy_learning_goals").delete().eq("id",b.dataset.goalDelete).eq("user_id",user.id);
      if(error)return notice(error.message,true);await refreshPersonal("Objectif supprimé.");
    }));
    root.querySelectorAll("[data-event-complete]").forEach(b=>b.addEventListener("click",async()=>{
      const e=events.find(x=>x.id===b.dataset.eventComplete);if(!e)return;
      const actual=Math.max(0,Math.round((new Date(e.ends_at)-new Date(e.starts_at))/60000));
      const {error}=await sb.from("academy_study_events").update({status:"completed",actual_minutes:actual}).eq("id",e.id).eq("user_id",user.id);
      if(error)return notice(error.message,true);await refreshPersonal("Séance marquée comme terminée.");
    }));
    root.querySelectorAll("[data-event-delete]").forEach(b=>b.addEventListener("click",async()=>{
      if(!confirm("Annuler cette séance planifiée ?"))return;
      const {error}=await sb.from("academy_study_events").update({status:"cancelled"}).eq("id",b.dataset.eventDelete).eq("user_id",user.id);
      if(error)return notice(error.message,true);await refreshPersonal("Séance annulée.");
    }));
  }
  async function refreshPersonal(message){await loadDashboard();render();notice(message);}
  function bindTrainerActions(){}
  init().catch(err=>{root.innerHTML='<div class="panel"><h1>Chargement du tableau de bord impossible</h1><p class="dashboard-notice error">'+esc(err?.message||"Une erreur est survenue.")+'</p><p><a href="academy.html">Retour à Academy</a></p></div>';});
})();