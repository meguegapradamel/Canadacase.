(() => {
  const cfg = window.CANADACASE_CONFIG || {};
  const root = document.getElementById("catalog-app");
  const logout = document.getElementById("catalog-logout");
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase?.createClient) {
    root.innerHTML = '<div class="panel"><h1>Configuration indisponible</h1><p>Le service Academy n’est pas configuré.</p></div>';
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  let user = null, account = null, isAdmin = false, isTrainer = false;
  let domains = [], programs = [], courses = [], resources = [], languageLessons = [], enrollments = [];
  let activeTab = "catalogue", selectedCourseId = null, lessonFilter = "all", showAllLegacy = false;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
  const slugify = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,100);
  const safeUrl = value => {
    try { const u = new URL(String(value || "")); return u.protocol === "https:" ? u.href : ""; }
    catch (_) { return ""; }
  };
  const statusLabel = status => ({
    draft:"Brouillon",submitted_for_review:"À examiner",needs_changes:"Modifications demandées",
    published:"Publié",archived:"Archivé"
  }[status] || status);
  const notify = (message, error = false) => {
    const node = document.getElementById("catalog-notice");
    if (!node) return;
    node.textContent = message;
    node.className = "catalog-notice" + (error ? " error" : "");
    node.classList.remove("hidden");
  };
  const domainName = id => domains.find(x=>x.id===id)?.name_fr || "Domaine";
  const programName = id => programs.find(x=>x.id===id)?.name_fr || "Programme";
  const canEditCourse = course => isAdmin || (isTrainer && course.created_by === user.id && ["draft","needs_changes"].includes(course.status));
  const canSubmitCourse = course => isTrainer && course.created_by === user.id && ["draft","needs_changes"].includes(course.status);

  async function init() {
    const {data:sessionData,error:sessionError}=await sb.auth.getSession();
    if(sessionError) throw sessionError;
    if(!sessionData.session) return signedOut();
    user=sessionData.session.user;
    const {data:profile,error}=await sb.from("profiles").select("id,full_name,role,is_active").eq("id",user.id).single();
    if(error) throw error;
    if(profile.is_active === false) {
      await sb.auth.signOut();
      return signedOut("Ce compte est désactivé. Contactez l’administration CanadaCase.");
    }
    account=profile;
    isAdmin=profile.role==="admin";
    const {data:roles,error:roleError}=await sb.from("academy_user_roles").select("role_code").eq("user_id",user.id);
    if(roleError) throw roleError;
    isTrainer=(roles||[]).some(x=>x.role_code==="trainer");
    logout.classList.remove("hidden");
    logout.addEventListener("click",async()=>{
      const {error}=await sb.auth.signOut();
      if(error) return notify(error.message,true);
      location.href="index.html";
    });
    await loadData();
    render();
  }

  function signedOut(message="") {
    logout.classList.add("hidden");
    root.innerHTML='<div class="panel"><p class="eyebrow">CANADACASE ACADEMY</p><h1>Connectez-vous pour consulter le catalogue.</h1>'+
      (message?'<p class="catalog-notice error">'+esc(message)+'</p>':'')+
      '<p class="muted">Utilisez votre compte CanadaCase existant.</p><a class="primary" href="index.html">Accéder à la connexion</a></div>';
  }

  async function loadData() {
    const results=await Promise.all([
      sb.from("academy_domains").select("id,code,name_fr,name_en,description_fr,icon,sort_order,is_active").order("sort_order"),
      sb.from("academy_programs").select("id,domain_id,code,name_fr,name_en,description_fr,program_type,language_code,exam_code,level_code,sort_order,is_active").order("sort_order"),
      sb.from("academy_courses").select("id,program_id,slug,title,summary,description,language_code,level_code,course_format,estimated_minutes,status,is_featured,created_by,created_at,published_at").order("created_at",{ascending:false}),
      sb.from("academy_resources").select("id,domain_id,program_id,course_id,lesson_id,title,summary,resource_type,external_url,source_name,source_url,rights_status,license_note,version_label,language_code,level_code,is_published,created_by,created_at").order("created_at",{ascending:false}),
      sb.from("language_courses").select("id,exam,skill,level,title,summary,content,estimated_minutes,pedagogical_type,section_title,unit_title,objectives,key_points,practice_prompt").eq("is_published",true).order("sort_order").limit(100),
      sb.from("academy_enrollments").select("id,course_id,status,enrolled_at,completed_at").eq("learner_id",user.id).order("enrolled_at",{ascending:false})
    ]);
    for(const r of results) if(r.error) throw r.error;
    [domains,programs,courses,resources,languageLessons,enrollments]=results.map(r=>r.data||[]);
  }

  function render() {
    root.innerHTML='<div class="catalog-hero"><p class="eyebrow">CANADACASE · ACADEMY</p><h1>Catalogue pédagogique</h1>'+
      '<p>Explorez les formations, les leçons TEF/TCF et les ressources. Les nouveaux cours et contributions passent par les contrôles de publication de CanadaCase Academy.</p></div>'+
      '<div id="catalog-notice" class="catalog-notice hidden"></div>'+
      '<nav class="catalog-tabs" aria-label="Sections du catalogue">'+
      '<button type="button" data-tab="catalogue" class="'+(activeTab==="catalogue"?"active":"")+'">Formations et leçons</button>'+
      '<button type="button" data-tab="bibliotheque" class="'+(activeTab==="bibliotheque"?"active":"")+'">Bibliothèque</button>'+
      (isAdmin?'<button type="button" data-tab="gestion" class="'+(activeTab==="gestion"?"active":"")+'">Gestion du catalogue</button>':'')+
      '</nav><div id="catalog-content"></div>';
    root.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{
      activeTab=b.dataset.tab; selectedCourseId=null; render();
    }));
    if(activeTab==="catalogue") renderCatalogue();
    else if(activeTab==="bibliotheque") renderLibrary();
    else renderManagement();
  }

  function renderCatalogue() {
    const published=courses.filter(c=>c.status==="published");
    const visibleCourses=isAdmin||isTrainer?courses:published;
    const courseForm=(isAdmin||isTrainer)?'<section class="catalog-panel"><h2>Proposer une formation</h2><p class="catalog-help">'+(isAdmin?"Créez un cours dans le catalogue. Vous pourrez le publier après vérification de son contenu.":"Les formateurs agréés peuvent préparer un cours. Il reste privé jusqu’à sa soumission et sa validation par l’administration.")+'</p>'+
      '<form id="catalog-course-form" class="catalog-form"><label>Programme<select name="program_id" required>'+programOptions()+'</select></label>'+
      '<label>Titre du cours<input name="title" minlength="3" maxlength="180" required placeholder="Ex. Maîtriser l’expression écrite"></label>'+
      '<label>Résumé<textarea name="summary" maxlength="500" required placeholder="Présentez les objectifs du cours."></textarea></label>'+
      '<label>Description détaillée<textarea name="description" maxlength="8000" placeholder="Contenu, méthode et prérequis"></textarea></label>'+
      '<div class="two"><label>Langue<select name="language_code"><option value="fr">Français</option><option value="en">Anglais</option><option value="es">Espagnol</option><option value="de">Allemand</option></select></label>'+
      '<label>Niveau<input name="level_code" maxlength="40" placeholder="A2, B1, débutant…"></label></div>'+
      '<div class="two"><label>Format<select name="course_format"><option value="self_paced">Autonome</option><option value="cohort">Cohorte</option><option value="workshop">Atelier</option><option value="hybrid">Hybride</option></select></label>'+
      '<label>Durée estimée (minutes)<input name="estimated_minutes" type="number" min="1" max="100000" value="60" required></label></div>'+
      '<button class="primary" type="submit">Enregistrer le brouillon</button></form></section>':'';
    const cards=visibleCourses.length?'<div class="catalog-grid">'+visibleCourses.map(courseCard).join("")+'</div>':'<div class="catalog-empty">Aucun nouveau cours publié pour le moment. Les cours proposés par les formateurs seront visibles après validation.</div>';
    const legacy=languageLessons.filter(x=>lessonFilter==="all"||x.exam===lessonFilter);
    const legacyList=legacy.slice(0,showAllLegacy?100:12);
    document.getElementById("catalog-content").innerHTML=courseForm+
      '<div class="catalog-layout"><div class="catalog-main"><section class="catalog-panel"><h2>Formations CanadaCase Academy</h2><p class="catalog-help">Cours structurés par programme, modules et leçons.</p>'+cards+
      '<div id="catalog-course-detail" class="catalog-detail"></div></section>'+
      '<section class="catalog-panel"><div class="catalog-filter"><div><h2>Leçons TEF et TCF déjà disponibles</h2><p class="catalog-help">Les contenus existants sont conservés et affichés sans duplication.</p></div>'+
      '<select id="legacy-filter" aria-label="Filtrer les examens"><option value="all">TEF et TCF</option><option value="TEF Canada">TEF Canada</option><option value="TCF Canada">TCF Canada</option></select></div>'+
      '<div class="catalog-count">'+languageLessons.length+'</div><p class="catalog-muted">Leçons publiées disponibles dans la bibliothèque linguistique</p>'+
      (legacyList.length?legacyList.map(legacyLessonCard).join(""):'<div class="catalog-empty">Aucune leçon publiée pour ce filtre.</div>')+
      (legacy.length>12?'<button type="button" class="secondary" id="legacy-more">'+(showAllLegacy?"Réduire la liste":"Afficher toutes les leçons ("+legacy.length+")")+'</button>':'')+
      '</section></div><aside class="catalog-side"><div class="catalog-panel"><h2>Domaines</h2>'+domains.filter(d=>d.is_active).map(d=>'<div class="catalog-resource"><span>'+esc(d.name_fr)+'</span><span class="catalog-muted">'+programs.filter(p=>p.domain_id===d.id&&p.is_active).length+' programme(s)</span></div>').join("")+'</div>'+
      '<div class="catalog-panel"><h2>Programmes disponibles</h2>'+programs.filter(p=>p.is_active).map(p=>'<div class="catalog-lesson"><strong>'+esc(p.name_fr)+'</strong><p class="catalog-muted">'+esc(domainName(p.domain_id))+' · '+esc(p.exam_code||p.program_type)+'</p></div>').join("")+'</div></aside></div>';
    const filter=document.getElementById("legacy-filter"); filter.value=lessonFilter;
    filter.addEventListener("change",()=>{lessonFilter=filter.value;showAllLegacy=false;renderCatalogue();});
    document.getElementById("legacy-more")?.addEventListener("click",()=>{showAllLegacy=!showAllLegacy;renderCatalogue();});
    document.querySelectorAll("[data-open-course]").forEach(b=>b.addEventListener("click",()=>openCourse(b.dataset.openCourse)));
    document.querySelectorAll("[data-enroll-course]").forEach(b=>b.addEventListener("click",()=>enrollCourse(b.dataset.enrollCourse)));
    document.querySelectorAll("[data-course-action]").forEach(b=>b.addEventListener("click",()=>courseAction(b.dataset.courseAction,b.dataset.id)));
    document.getElementById("catalog-course-form")?.addEventListener("submit",createCourse);
  }

  function programOptions() {
    return programs.filter(p=>p.is_active).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name_fr)+'</option>').join("");
  }
  function courseCard(c) {
    const enrollment=enrollments.find(e=>e.course_id===c.id && e.status==='active');
    const learnerAction=c.status==='published' && !isAdmin && c.created_by!==user.id
      ? (enrollment?'<button type="button" class="primary" data-open-course="'+esc(c.id)+'">Continuer la formation</button>':'<button type="button" class="primary" data-enroll-course="'+esc(c.id)+'">S’inscrire gratuitement</button>'):'';
    const adminActions=isAdmin?'<button type="button" class="primary" data-course-action="publish" data-id="'+esc(c.id)+'">Publier</button>'+
      '<button type="button" class="secondary" data-course-action="needs_changes" data-id="'+esc(c.id)+'">Demander corrections</button>'+
      '<button type="button" class="secondary" data-course-action="archive" data-id="'+esc(c.id)+'">Archiver</button>':'';
    const trainerAction=canSubmitCourse(c)?'<button type="button" class="secondary" data-course-action="submit" data-id="'+esc(c.id)+'">Soumettre à validation</button>':'';
    return '<article class="catalog-card"><div class="catalog-meta"><span class="catalog-chip">'+esc(programName(c.program_id))+'</span><span class="catalog-status '+(c.status==="published"?"published":"")+'">'+esc(statusLabel(c.status))+'</span></div>'+
      '<h3>'+esc(c.title)+'</h3><p>'+esc(c.summary||"")+'</p><div class="catalog-meta"><span class="catalog-chip">'+esc(c.level_code||"Tous niveaux")+'</span><span class="catalog-chip">'+esc(c.language_code.toUpperCase())+'</span><span class="catalog-chip">'+esc(c.estimated_minutes)+' min</span></div>'+
      '<div class="catalog-actions"><button type="button" class="secondary" data-open-course="'+esc(c.id)+'">Voir le contenu</button>'+learnerAction+adminActions+trainerAction+'</div></article>';
  }
  function legacyLessonCard(x) {
    const body=[x.content,x.objectives?"Objectifs : "+x.objectives:"",x.key_points?"Points clés : "+x.key_points:"",x.practice_prompt?"À pratiquer : "+x.practice_prompt:""].filter(Boolean).join("\n\n");
    return '<details class="catalog-lesson"><summary>'+esc(x.title)+' <span class="catalog-muted">· '+esc(x.exam)+' · '+esc(x.skill)+' · '+esc(x.level)+'</span></summary>'+
      (x.summary?'<p>'+esc(x.summary)+'</p>':'')+'<div class="lesson-content">'+esc(body)+'</div></details>';
  }

  async function createCourse(event) {
    event.preventDefault();
    const form=event.currentTarget, d=new FormData(form), title=String(d.get("title")||"").trim(), slug=slugify(title);
    if(!slug) return notify("Le titre doit permettre de créer une adresse de cours valide.",true);
    const payload={
      program_id:d.get("program_id"),slug,title,summary:String(d.get("summary")||"").trim(),
      description:String(d.get("description")||"").trim()||null,language_code:d.get("language_code"),
      level_code:String(d.get("level_code")||"").trim()||null,course_format:d.get("course_format"),
      estimated_minutes:Number(d.get("estimated_minutes")),status:"draft",created_by:user.id
    };
    const {error}=await sb.from("academy_courses").insert(payload);
    if(error) return notify(error.message,true);
    notify("Brouillon de cours enregistré. Ajoutez ses modules et leçons avant de le soumettre.");
    await loadData(); renderCatalogue();
  }

  async function courseAction(action,id) {
    const course=courses.find(c=>c.id===id); if(!course) return;
    if(action==="submit") {
      if(!canSubmitCourse(course)) return notify("Seul le formateur propriétaire peut soumettre ce brouillon.",true);
      const {error}=await sb.from("academy_courses").update({status:"submitted_for_review",updated_at:new Date().toISOString()}).eq("id",id);
      if(error) return notify(error.message,true);
      notify("Cours transmis à l’administration. Les modifications sont verrouillées pendant l’examen.");
    } else {
      if(!isAdmin) return notify("Action réservée à l’administration.",true);
      if(action==="publish") {
        const {data:mods,error:me}=await sb.from("academy_course_modules").select("id").eq("course_id",id);
        if(me) return notify(me.message,true);
        if(!mods?.length) return notify("Ajoutez au moins un module avant la publication.",true);
        const moduleIds=mods.map(m=>m.id);
        const {data:lessons,error:le}=await sb.from("academy_lessons").select("id").in("module_id",moduleIds);
        if(le) return notify(le.message,true);
        if(!lessons?.length) return notify("Ajoutez au moins une leçon avant la publication.",true);
      }
      const status=action==="publish"?"published":action==="needs_changes"?"needs_changes":"archived";
      const {error}=await sb.from("academy_courses").update({status,published_at:status==="published"?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",id);
      if(error) return notify(error.message,true);
      notify(status==="published"?"Cours publié dans le catalogue.":"Statut du cours mis à jour.");
    }
    await loadData(); renderCatalogue();
  }

  async function enrollCourse(courseId) {
    const course=courses.find(c=>c.id===courseId);
    if(!course || course.status!=="published" || course.created_by===user.id) return notify("Cette inscription n’est pas disponible.",true);
    const {error}=await sb.from("academy_enrollments").insert({course_id:courseId,learner_id:user.id});
    if(error && error.code!=="23505") return notify(error.message,true);
    await loadData(); renderCatalogue();
    await openCourse(courseId);
    notify("Inscription confirmée. Votre progression sera enregistrée au fil des leçons.");
  }

  async function openCourse(id) {
    selectedCourseId=id;
    const course=courses.find(c=>c.id===id); if(!course) return;
    const detail=document.getElementById("catalog-course-detail");
    detail.innerHTML='<div class="catalog-empty">Chargement du parcours et des activités…</div>';
    const enrollment=enrollments.find(e=>e.course_id===id && e.status==="active")||null;
    const canLearn=!!enrollment;
    const canTeach=isAdmin || (isTrainer && course.created_by===user.id);
    const canEditContent=canEditCourse(course);
    const {data:mods,error}=await sb.from("academy_course_modules").select("id,title,description,position,estimated_minutes").eq("course_id",id).order("position");
    if(error) { detail.innerHTML='<div class="catalog-notice error">'+esc(error.message)+'</div>'; return; }
    const moduleIds=(mods||[]).map(m=>m.id);
    let lessons=[];
    if(moduleIds.length) {
      const r=await sb.from("academy_lessons").select("id,module_id,title,lesson_type,content,media_url,transcript,objectives,estimated_minutes,position,is_preview").in("module_id",moduleIds).order("position");
      if(r.error) { detail.innerHTML='<div class="catalog-notice error">'+esc(r.error.message)+'</div>'; return; }
      lessons=r.data||[];
    }
    const lessonIds=lessons.map(l=>l.id);
    const quizLessonIds=lessons.filter(l=>l.lesson_type==="quiz").map(l=>l.id);
    const [progressResult,assignmentResult,questionResult,attemptResult]=await Promise.all([
      canLearn?sb.from("academy_lesson_progress").select("id,lesson_id,status,progress_seconds,completed_at").eq("enrollment_id",enrollment.id):Promise.resolve({data:[],error:null}),
      sb.from("academy_assignments").select("id,course_id,title,instructions,submission_type,due_at,max_score,is_published,created_by").eq("course_id",id).order("created_at"),
      quizLessonIds.length?sb.from("academy_lesson_questions").select("id,lesson_id,question_text,options,sort_order").in("lesson_id",quizLessonIds).order("sort_order"):Promise.resolve({data:[],error:null}),
      quizLessonIds.length&&canLearn?sb.from("academy_quiz_attempts").select("id,lesson_id,score,max_score,submitted_at").in("lesson_id",quizLessonIds).eq("learner_id",user.id).order("submitted_at",{ascending:false}):Promise.resolve({data:[],error:null})
    ]);
    for(const r of [progressResult,assignmentResult,questionResult,attemptResult]) if(r.error) { detail.innerHTML='<div class="catalog-notice error">'+esc(r.error.message)+'</div>'; return; }
    const progress=progressResult.data||[], assignments=assignmentResult.data||[], questions=questionResult.data||[], attempts=attemptResult.data||[];
    const assignmentIds=assignments.map(a=>a.id);
    let submissions=[];
    if(assignmentIds.length) {
      const sr=await sb.from("academy_submissions").select("id,assignment_id,learner_id,answer_text,answer_url,status,score,feedback,submitted_at,graded_at").in("assignment_id",assignmentIds).order("submitted_at",{ascending:false});
      if(sr.error) { detail.innerHTML='<div class="catalog-notice error">'+esc(sr.error.message)+'</div>'; return; }
      submissions=sr.data||[];
    }
    const progressFor=lessonId=>progress.find(p=>p.lesson_id===lessonId);
    const questionsFor=lessonId=>questions.filter(q=>q.lesson_id===lessonId);
    const attemptsFor=lessonId=>attempts.filter(a=>a.lesson_id===lessonId);
    const lessonHtml=(l)=>{
      const p=progressFor(l.id);
      const qs=questionsFor(l.id);
      const at=attemptsFor(l.id);
      const quiz= l.lesson_type==="quiz" ? (
        canLearn ? (qs.length ? '<form class="catalog-form quiz-answer-form" data-lesson-id="'+esc(l.id)+'"><h4>Quiz interactif</h4>'+
          qs.map((q,i)=>'<fieldset class="quiz-question"><legend>'+esc(i+1)+'. '+esc(q.question_text)+'</legend>'+
            (Array.isArray(q.options)?q.options:[]).map((o,j)=>'<label class="quiz-option"><input type="radio" name="'+esc(q.id)+'" value="'+j+'" required> '+esc(typeof o==="string"?o:(o?.label||o?.text||"Choix "+(j+1)))+'</label>').join("")+'</fieldset>').join("")+
          '<button class="primary" type="submit">Corriger mes réponses</button></form>'+
          (at.length?'<p class="catalog-muted">Dernier résultat : '+esc(at[0].score)+' / '+esc(at[0].max_score)+'</p>':''):'<p class="catalog-muted">Le formateur prépare encore les questions de ce quiz.</p>') :
        (canEditContent?'<form class="catalog-form quiz-question-form" data-lesson-id="'+esc(l.id)+'"><strong>Ajouter une question au quiz</strong><label>Question<textarea name="question_text" required maxlength="2000"></textarea></label><label>Choix de réponse (un par ligne)<textarea name="options" required rows="4" placeholder="Réponse A&#10;Réponse B&#10;Réponse C"></textarea></label><label>Index de la bonne réponse (commence à 0)<input name="correct_option" type="number" min="0" max="7" value="0" required></label><label>Explication facultative<textarea name="explanation" rows="2"></textarea></label><button class="secondary" type="submit">Enregistrer la question</button></form>':'<p class="catalog-muted">Inscrivez-vous à la formation pour accéder au quiz.</p>')
      ) : "";
      const completeButton=canLearn?'<button type="button" class="secondary" data-complete-lesson="'+esc(l.id)+'" '+(p?.status==="completed"?'disabled':'')+'>'+(p?.status==="completed"?'Leçon terminée ✓':'Marquer comme terminée')+'</button>':'';
      return '<article class="catalog-lesson-card"><div class="catalog-meta"><span class="catalog-chip">'+esc(l.lesson_type)+'</span><span class="catalog-chip">'+esc(l.estimated_minutes)+' min</span><span class="catalog-status '+(p?.status==="completed"?"published":"")+'">'+(p?.status==="completed"?"Terminée":"À suivre")+'</span></div>'+
        '<h4>'+esc(l.title)+'</h4>'+(l.objectives?'<p><strong>Objectifs :</strong> '+esc(l.objectives)+'</p>':'')+
        '<div class="lesson-content">'+esc(l.content||"")+'</div>'+
        (l.media_url&&safeUrl(l.media_url)?'<p><a href="'+esc(safeUrl(l.media_url))+'" target="_blank" rel="noopener noreferrer">Ouvrir le média</a></p>':'')+
        (l.transcript?'<details><summary>Transcription</summary><div class="lesson-content">'+esc(l.transcript)+'</div></details>':'')+
        quiz+'<div class="catalog-actions">'+completeButton+'</div></article>';
    };
    const assignmentHtml=assignments.map(a=>{
      const mine=submissions.find(s=>s.assignment_id===a.id&&s.learner_id===user.id);
      const teacherSubs=submissions.filter(s=>s.assignment_id===a.id&&s.learner_id!==user.id);
      const submissionForm=canLearn && a.is_published && (!mine || ["submitted","needs_revision"].includes(mine.status))
        ? '<form class="catalog-form assignment-submit-form" data-assignment-id="'+esc(a.id)+'" data-submission-id="'+esc(mine?.id||"")+'"><strong>'+(mine?"Reprendre ma réponse":"Déposer mon devoir")+'</strong>'+
          (a.submission_type==="url"?'<label>Lien HTTPS<input type="url" name="answer_url" required value="'+esc(mine?.answer_url||"")+'"></label>':'<label>Ma réponse<textarea name="answer_text" required rows="5">'+esc(mine?.answer_text||"")+'</textarea></label>')+
          '<button class="primary" type="submit">Envoyer au formateur</button></form>'
        : (mine?'<div class="submission-feedback"><strong>Mon devoir : '+esc(mine.status)+'</strong>'+(mine.score!==null?'<p>Note : '+esc(mine.score)+' / '+esc(a.max_score)+'</p>':'')+(mine.feedback?'<p>'+esc(mine.feedback)+'</p>':'')+'</div>':(canLearn?'<p class="catalog-muted">Devoir non encore déposé.</p>':''));
      const gradeForms=canTeach?teacherSubs.map(s=>'<form class="catalog-form grade-submission-form" data-submission-id="'+esc(s.id)+'"><strong>Copie reçue · '+esc(s.learner_id.slice(0,8))+'</strong><p class="catalog-muted">'+esc(s.status)+' · '+esc(s.submitted_at)+'</p>'+
        (s.answer_text?'<div class="lesson-content">'+esc(s.answer_text)+'</div>':'')+(s.answer_url?'<p><a href="'+esc(safeUrl(s.answer_url))+'" target="_blank" rel="noopener noreferrer">Ouvrir la réponse</a></p>':'')+
        '<label>Note / '+esc(a.max_score)+'<input name="score" type="number" min="0" max="'+esc(a.max_score)+'" step="0.01" value="'+esc(s.score??"")+'"></label><label>Commentaire<textarea name="feedback" required rows="3">'+esc(s.feedback||"")+'</textarea></label><div class="two"><button class="primary" type="submit" value="graded">Valider la correction</button><button class="secondary" type="submit" value="needs_revision">Demander une reprise</button></div></form>').join(""):'';
      return '<article class="catalog-assignment"><div class="catalog-meta"><span class="catalog-chip">Devoir</span><span class="catalog-chip">Barème : '+esc(a.max_score)+'</span><span class="catalog-status '+(a.is_published?"published":"")+'">'+(a.is_published?"Publié":"Brouillon")+'</span></div>'+
        '<h4>'+esc(a.title)+'</h4><p class="lesson-content">'+esc(a.instructions)+'</p>'+(a.due_at?'<p class="catalog-muted">Échéance : '+esc(new Date(a.due_at).toLocaleString())+'</p>':'')+
        (canTeach?'<div class="catalog-actions"><button type="button" class="secondary" data-assignment-action="'+(a.is_published?"unpublish":"publish")+'" data-id="'+esc(a.id)+'">'+(a.is_published?"Dépublier":"Publier le devoir")+'</button></div>':'')+
        submissionForm+gradeForms+'</article>';
    }).join("");
    detail.innerHTML='<div class="catalog-panel"><div class="catalog-actions"><h2 style="margin-right:auto">'+esc(course.title)+'</h2><button type="button" class="secondary" id="close-course-detail">Fermer</button></div>'+
      '<p>'+esc(course.description||course.summary||"")+'</p>'+
      (canLearn?'<p class="catalog-notice">Vous êtes inscrit à cette formation. Votre progression est enregistrée automatiquement.</p>':
        (course.status==="published"&&!canTeach&&!isAdmin?'<button type="button" class="primary" id="detail-enroll">S’inscrire gratuitement</button>':'<p class="catalog-muted">'+(canTeach?"Espace formateur : vous gérez le contenu et les devoirs de ce cours.":"Contenu du cours.")+'</p>'))+
      '<p class="catalog-progress-summary">'+(canLearn?'Progression : <strong>'+progress.filter(p=>p.status==="completed").length+' / '+lessons.length+' leçon(s) terminée(s)</strong>':"")+'</p>'+
      (mods||[]).map(m=>'<div class="catalog-module"><h3>'+esc(m.title)+'</h3><p class="catalog-muted">'+esc(m.description||"")+'</p>'+
        lessons.filter(l=>l.module_id===m.id).map(lessonHtml).join("")+
        (canEditContent?'<form class="catalog-form create-lesson-form" data-module-id="'+esc(m.id)+'"><strong>Ajouter une leçon</strong><label>Titre<input name="title" required maxlength="180"></label><div class="two"><label>Type<select name="lesson_type"><option value="text">Texte</option><option value="video">Vidéo</option><option value="audio">Audio</option><option value="document">Document</option><option value="interactive">Interactif</option><option value="quiz">Quiz</option></select></label><label>Durée (minutes)<input name="estimated_minutes" type="number" min="0" value="10"></label></div><label>Contenu pédagogique<textarea name="content" rows="4"></textarea></label><label>Objectifs<textarea name="objectives" rows="2"></textarea></label><label>URL média HTTPS (facultatif)<input name="media_url" type="url" placeholder="https://…"></label><label>Transcription<textarea name="transcript" rows="3"></textarea></label><button class="secondary" type="submit">Ajouter la leçon</button></form>':'')+
        '</div>').join("")+
      (!mods?.length?'<div class="catalog-empty">Aucun module dans ce cours pour le moment.</div>':'')+
      (canEditContent?'<form id="catalog-module-form" class="catalog-form catalog-module" data-course-id="'+esc(id)+'"><strong>Ajouter un module</strong><label>Titre du module<input name="title" required maxlength="180"></label><label>Description<textarea name="description" rows="2"></textarea></label><label>Durée estimée (minutes)<input name="estimated_minutes" type="number" min="0" value="0"></label><button class="primary" type="submit">Ajouter le module</button></form>'+
        '<form id="catalog-assignment-form" class="catalog-form catalog-assignment"><h3>Créer un devoir</h3><label>Titre<input name="title" required maxlength="180"></label><label>Consignes<textarea name="instructions" required minlength="5" maxlength="10000" rows="4"></textarea></label><div class="two"><label>Type de réponse<select name="submission_type"><option value="text">Texte</option><option value="url">Lien HTTPS</option></select></label><label>Note maximale<input name="max_score" type="number" min="1" max="1000" value="20"></label></div><label>Échéance facultative<input name="due_at" type="datetime-local"></label><button class="primary" type="submit">Créer le devoir</button></form>':'')+
      (assignments.length?'<section class="catalog-panel"><h3>Devoirs et corrections</h3>'+assignmentHtml+'</section>':(canTeach?'<p class="catalog-muted">Aucun devoir pour le moment.</p>':''))+
      '</div>';
    document.getElementById("close-course-detail").addEventListener("click",()=>{selectedCourseId=null;detail.innerHTML="";});
    document.getElementById("detail-enroll")?.addEventListener("click",()=>enrollCourse(id));
    document.getElementById("catalog-module-form")?.addEventListener("submit",createModule);
    document.getElementById("catalog-assignment-form")?.addEventListener("submit",createAssignment);
    detail.querySelectorAll(".create-lesson-form").forEach(f=>f.addEventListener("submit",createLesson));
    detail.querySelectorAll(".quiz-question-form").forEach(f=>f.addEventListener("submit",createQuizQuestion));
    detail.querySelectorAll(".quiz-answer-form").forEach(f=>f.addEventListener("submit",submitQuiz));
    detail.querySelectorAll("[data-complete-lesson]").forEach(b=>b.addEventListener("click",()=>completeLesson(b.dataset.completeLesson)));
    detail.querySelectorAll("[data-assignment-action]").forEach(b=>b.addEventListener("click",()=>assignmentAction(b.dataset.assignmentAction,b.dataset.id)));
    detail.querySelectorAll(".assignment-submit-form").forEach(f=>f.addEventListener("submit",submitAssignment));
    detail.querySelectorAll(".grade-submission-form").forEach(f=>f.addEventListener("submit",gradeSubmission));
  }

  async function completeLesson(lessonId) {
    const enrollment=enrollments.find(e=>e.course_id===selectedCourseId&&e.status==="active");
    if(!enrollment) return notify("Inscription active requise.",true);
    const {error}=await sb.from("academy_lesson_progress").upsert({
      enrollment_id:enrollment.id,lesson_id:lessonId,status:"completed",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()
    },{onConflict:"enrollment_id,lesson_id"});
    if(error) return notify(error.message,true);
    notify("Progression enregistrée.");
    await openCourse(selectedCourseId);
  }

  async function createQuizQuestion(event) {
    event.preventDefault();
    const form=event.currentTarget,d=new FormData(form);
    const options=String(d.get("options")||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const correct=Number(d.get("correct_option"));
    if(options.length<2||options.length>8||!Number.isInteger(correct)||correct<0||correct>=options.length) return notify("Saisissez 2 à 8 choix et un index correct compris entre 0 et "+(options.length-1)+".",true);
    const {error}=await sb.rpc("academy_save_lesson_quiz_question",{
      p_lesson_id:form.dataset.lessonId,p_question_text:String(d.get("question_text")||"").trim(),
      p_options:options,p_correct_option:correct,p_explanation:String(d.get("explanation")||"").trim()||null
    });
    if(error) return notify(error.message,true);
    notify("Question ajoutée. La bonne réponse reste protégée côté serveur.");
    await openCourse(selectedCourseId);
  }

  async function submitQuiz(event) {
    event.preventDefault();
    const form=event.currentTarget,answers=[];
    form.querySelectorAll(".quiz-question").forEach(field=>{
      const selected=field.querySelector("input[type=radio]:checked");
      const questionId=field.querySelector("input[type=radio]")?.name;
      if(selected&&questionId) answers.push({question_id:questionId,selected_option:Number(selected.value)});
    });
    const expected=form.querySelectorAll(".quiz-question").length;
    if(answers.length!==expected) return notify("Répondez à toutes les questions avant la correction.",true);
    const {data,error}=await sb.rpc("academy_grade_lesson_quiz",{p_lesson_id:form.dataset.lessonId,p_answers:answers});
    if(error) return notify(error.message,true);
    notify("Résultat : "+data.score+" / "+data.max_score+" ("+data.percentage+" %).");
    await completeLesson(form.dataset.lessonId);
  }

  async function createAssignment(event) {
    event.preventDefault();
    const d=new FormData(event.currentTarget);
    const due=String(d.get("due_at")||"").trim();
    const payload={
      course_id:selectedCourseId,title:String(d.get("title")||"").trim(),instructions:String(d.get("instructions")||"").trim(),
      submission_type:d.get("submission_type"),max_score:Number(d.get("max_score")),due_at:due?new Date(due).toISOString():null,
      created_by:user.id,is_published:false
    };
    const {error}=await sb.from("academy_assignments").insert(payload);
    if(error) return notify(error.message,true);
    notify("Devoir créé en brouillon. Vous pouvez le publier aux apprenants.");
    await openCourse(selectedCourseId);
  }

  async function assignmentAction(action,id) {
    if(!isAdmin&&!isTrainer) return notify("Action réservée au formateur.",true);
    const {error}=await sb.from("academy_assignments").update({is_published:action==="publish",updated_at:new Date().toISOString()}).eq("id",id);
    if(error) return notify(error.message,true);
    notify(action==="publish"?"Devoir publié.":"Devoir dépublié.");
    await openCourse(selectedCourseId);
  }

  async function submitAssignment(event) {
    event.preventDefault();
    const form=event.currentTarget,d=new FormData(form),submissionId=form.dataset.submissionId;
    const assignmentId=form.dataset.assignmentId;
    const payload={answer_text:String(d.get("answer_text")||"").trim()||null,answer_url:String(d.get("answer_url")||"").trim()||null};
    if(payload.answer_url&&!safeUrl(payload.answer_url)) return notify("Le lien de réponse doit être en HTTPS.",true);
    let result;
    if(submissionId) result=await sb.from("academy_submissions").update(payload).eq("id",submissionId);
    else result=await sb.from("academy_submissions").insert({...payload,assignment_id:assignmentId,learner_id:user.id});
    if(result.error) return notify(result.error.message,true);
    notify("Devoir transmis au formateur.");
    await openCourse(selectedCourseId);
  }

  async function gradeSubmission(event) {
    event.preventDefault();
    const form=event.currentTarget,d=new FormData(form);
    const button=event.submitter;
    const status=button?.value==="needs_revision"?"needs_revision":"graded";
    const score=String(d.get("score")||"").trim();
    if(status==="graded"&&score==="") return notify("Saisissez une note avant de valider la correction.",true);
    const payload={status,score:status==="graded"?Number(score):null,feedback:String(d.get("feedback")||"").trim()};
    const {error}=await sb.from("academy_submissions").update(payload).eq("id",form.dataset.submissionId);
    if(error) return notify(error.message,true);
    notify(status==="graded"?"Correction enregistrée.":"Une reprise a été demandée à l’apprenant.");
    await openCourse(selectedCourseId);
  }

  async function createModule(event) {
    event.preventDefault(); const form=event.currentTarget,d=new FormData(form),id=form.dataset.courseId;
    const {data:existing,error:readError}=await sb.from("academy_course_modules").select("position").eq("course_id",id).order("position",{ascending:false}).limit(1);
    if(readError) return notify(readError.message,true);
    const position=(existing?.[0]?.position||0)+10;
    const {error}=await sb.from("academy_course_modules").insert({course_id:id,title:String(d.get("title")||"").trim(),description:String(d.get("description")||"").trim()||null,estimated_minutes:Number(d.get("estimated_minutes")||0),position});
    if(error) return notify(error.message,true);
    notify("Module ajouté."); await openCourse(id);
  }
  async function createLesson(event) {
    event.preventDefault(); const form=event.currentTarget,d=new FormData(form),moduleId=form.dataset.moduleId;
    const {data:existing,error:readError}=await sb.from("academy_lessons").select("position").eq("module_id",moduleId).order("position",{ascending:false}).limit(1);
    if(readError) return notify(readError.message,true);
    const media=String(d.get("media_url")||"").trim();
    if(media&&!safeUrl(media)) return notify("L’URL du média doit commencer par https://.",true);
    const payload={module_id:moduleId,title:String(d.get("title")||"").trim(),lesson_type:d.get("lesson_type"),content:String(d.get("content")||"").trim()||null,objectives:String(d.get("objectives")||"").trim()||null,media_url:media||null,transcript:String(d.get("transcript")||"").trim()||null,estimated_minutes:Number(d.get("estimated_minutes")||0),position:(existing?.[0]?.position||0)+10};
    const {error}=await sb.from("academy_lessons").insert(payload);
    if(error) return notify(error.message,true);
    notify("Leçon ajoutée."); await openCourse(selectedCourseId);
  }

  function renderLibrary() {
    const visible=resources.filter(r=>r.is_published||isAdmin||r.created_by===user.id);
    const form=(isAdmin||isTrainer)?'<section class="catalog-panel"><h2>Contribuer à la bibliothèque</h2><p class="catalog-help">Ajoutez un lien HTTPS vers une ressource dont les droits sont identifiés. Les formateurs ne peuvent pas publier eux-mêmes leurs contributions.</p>'+
      '<form id="catalog-resource-form" class="catalog-form"><label>Titre<input name="title" required maxlength="180"></label><label>Résumé<textarea name="summary" rows="2"></textarea></label>'+
      '<div class="two"><label>Type<select name="resource_type"><option value="link">Lien</option><option value="pdf">PDF</option><option value="document">Document</option><option value="video">Vidéo</option><option value="audio">Audio</option><option value="book">Livre</option><option value="worksheet">Fiche</option><option value="podcast">Podcast</option><option value="image">Image</option></select></label>'+
      '<label>Droits<select name="rights_status"><option value="original">Contenu original</option><option value="licensed">Licence/autorisation obtenue</option><option value="public_domain">Domaine public</option><option value="permission_pending">Droits à vérifier</option></select></label></div>'+
      '<label>Adresse HTTPS de la ressource<input name="external_url" type="url" required placeholder="https://…"></label>'+
      '<div class="two"><label>Nom de la source<input name="source_name" maxlength="180"></label><label>Version/date<input name="version_label" maxlength="80"></label></div>'+
      '<label>URL de la source ou de la licence<input name="source_url" type="url" placeholder="https://…"></label><label>Note sur les droits<textarea name="license_note" rows="2"></textarea></label>'+
      '<div class="two"><label>Domaine<select name="domain_id"><option value="">— Non précisé —</option>'+domains.filter(d=>d.is_active).map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name_fr)+'</option>').join("")+'</select></label>'+
      '<label>Programme<select name="program_id"><option value="">— Non précisé —</option>'+programOptions()+'</select></label></div>'+
      '<div class="two"><label>Langue<select name="language_code"><option value="fr">Français</option><option value="en">Anglais</option><option value="es">Espagnol</option><option value="de">Allemand</option></select></label><label>Niveau<input name="level_code" maxlength="40" placeholder="A2, B1…"></label></div>'+
      '<button class="primary" type="submit">Enregistrer la contribution</button></form></section>':'';
    document.getElementById("catalog-content").innerHTML=form+
      '<section class="catalog-panel"><h2>Bibliothèque de ressources</h2><p class="catalog-help">Les ressources publiées sont accessibles aux apprenants connectés. Les contributions en attente restent privées.</p>'+
      (visible.length?visible.map(r=>'<div class="catalog-resource"><div><strong>'+esc(r.title)+'</strong><p>'+esc(r.summary||"")+'</p><div class="catalog-meta"><span class="catalog-chip">'+esc(r.resource_type)+'</span><span class="catalog-chip">'+esc(r.rights_status)+'</span><span class="catalog-chip">'+esc(r.language_code.toUpperCase())+'</span>'+(r.version_label?'<span class="catalog-chip">'+esc(r.version_label)+'</span>':'')+'</div>'+
      (r.source_name?'<p class="catalog-muted">Source : '+esc(r.source_name)+'</p>':'')+
      (r.external_url&&safeUrl(r.external_url)?'<a href="'+esc(safeUrl(r.external_url))+'" target="_blank" rel="noopener noreferrer">Consulter la ressource</a>':'<span class="catalog-muted">Lien non disponible</span>')+
      (r.license_note?'<p class="catalog-muted">'+esc(r.license_note)+'</p>':'')+'</div>'+
      (isAdmin?'<div class="catalog-actions">'+(!r.is_published?'<button class="primary" data-resource-action="publish" data-id="'+esc(r.id)+'">Publier</button>':'<button class="secondary" data-resource-action="unpublish" data-id="'+esc(r.id)+'">Dépublier</button>')+'</div>':'')+'</div>').join(""):'<div class="catalog-empty">La bibliothèque générale sera alimentée progressivement. Les leçons TEF/TCF existantes sont déjà disponibles dans l’onglet Formations et leçons.</div>')+'</section>';
    document.getElementById("catalog-resource-form")?.addEventListener("submit",createResource);
    document.querySelectorAll("[data-resource-action]").forEach(b=>b.addEventListener("click",()=>resourceAction(b.dataset.resourceAction,b.dataset.id)));
  }

  async function createResource(event) {
    event.preventDefault(); const d=new FormData(event.currentTarget);
    const url=String(d.get("external_url")||"").trim(), sourceUrl=String(d.get("source_url")||"").trim();
    if(!safeUrl(url)|| (sourceUrl&&!safeUrl(sourceUrl))) return notify("Les adresses de ressources et de sources doivent être en HTTPS.",true);
    if(!d.get("domain_id")&&!d.get("program_id")) return notify("Associez la ressource à un domaine ou à un programme.",true);
    const payload={title:String(d.get("title")||"").trim(),summary:String(d.get("summary")||"").trim()||null,resource_type:d.get("resource_type"),rights_status:d.get("rights_status"),external_url:url,source_name:String(d.get("source_name")||"").trim()||null,source_url:sourceUrl||null,version_label:String(d.get("version_label")||"").trim()||null,license_note:String(d.get("license_note")||"").trim()||null,domain_id:d.get("domain_id")||null,program_id:d.get("program_id")||null,language_code:d.get("language_code"),level_code:String(d.get("level_code")||"").trim()||null,is_published:false,created_by:user.id};
    const {error}=await sb.from("academy_resources").insert(payload);
    if(error) return notify(error.message,true);
    notify("Ressource enregistrée en attente de publication."); await loadData(); renderLibrary();
  }
  async function resourceAction(action,id) {
    if(!isAdmin) return notify("Action réservée à l’administration.",true);
    const item=resources.find(r=>r.id===id); if(!item) return;
    if(action==="publish"&&(item.rights_status==="permission_pending"||!safeUrl(item.external_url))) return notify("Impossible de publier : vérifiez les droits et le lien HTTPS.",true);
    if(action==="publish"&&item.rights_status!=="original"&&!item.source_url&&!String(item.license_note||"").trim()) return notify("Pour une ressource sous licence ou dans le domaine public, ajoutez une source ou une preuve de droits avant publication.",true);
    const {error}=await sb.from("academy_resources").update({is_published:action==="publish",updated_at:new Date().toISOString()}).eq("id",id);
    if(error) return notify(error.message,true);
    notify(action==="publish"?"Ressource publiée.":"Ressource retirée de la bibliothèque.");
    await loadData(); renderLibrary();
  }

  function renderManagement() {
    if(!isAdmin) { activeTab="catalogue"; return render(); }
    document.getElementById("catalog-content").innerHTML='<div class="catalog-layout"><div class="catalog-main">'+
      '<section class="catalog-panel"><h2>Créer un domaine</h2><form id="catalog-domain-form" class="catalog-form"><label>Code technique<input name="code" required maxlength="60" placeholder="EXEMPLE_DOMAINE"></label><div class="two"><label>Nom français<input name="name_fr" required maxlength="120"></label><label>Nom anglais<input name="name_en" required maxlength="120"></label></div><label>Description française<textarea name="description_fr"></textarea></label><label>Description anglaise<textarea name="description_en"></textarea></label><label>Icône (nom technique)<input name="icon" maxlength="40" placeholder="book-open"></label><button class="primary" type="submit">Créer le domaine</button></form></section>'+
      '<section class="catalog-panel"><h2>Créer un programme</h2><form id="catalog-program-form" class="catalog-form"><label>Domaine<select name="domain_id" required>'+domains.filter(d=>d.is_active).map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name_fr)+'</option>').join("")+'</select></label><label>Code technique<input name="code" required maxlength="80" placeholder="NOUVEAU_PROGRAMME"></label><div class="two"><label>Nom français<input name="name_fr" required maxlength="160"></label><label>Nom anglais<input name="name_en" required maxlength="160"></label></div><label>Description française<textarea name="description_fr"></textarea></label><label>Description anglaise<textarea name="description_en"></textarea></label><div class="two"><label>Type<select name="program_type"><option value="exam_preparation">Préparation examen</option><option value="professional_training">Formation professionnelle</option><option value="skills">Compétences</option><option value="career">Orientation/carrière</option></select></label><label>Langue<input name="language_code" value="fr" maxlength="5" required></label></div><div class="two"><label>Code examen (facultatif)<input name="exam_code" maxlength="60"></label><label>Niveau (facultatif)<input name="level_code" maxlength="40"></label></div><button class="primary" type="submit">Créer le programme</button></form></section></div>'+
      '<aside class="catalog-side"><section class="catalog-panel"><h2>Domaines actifs</h2>'+domains.map(d=>'<div class="catalog-lesson"><strong>'+esc(d.name_fr)+'</strong><p class="catalog-muted">'+esc(d.code)+' · '+(d.is_active?"Actif":"Inactif")+'</p></div>').join("")+'</section><section class="catalog-panel"><h2>Programmes</h2>'+programs.map(p=>'<div class="catalog-lesson"><strong>'+esc(p.name_fr)+'</strong><p class="catalog-muted">'+esc(p.code)+' · '+(p.is_active?"Actif":"Inactif")+'</p></div>').join("")+'</section></aside></div>';
    document.getElementById("catalog-domain-form").addEventListener("submit",createDomain);
    document.getElementById("catalog-program-form").addEventListener("submit",createProgram);
  }
  async function createDomain(event) {
    event.preventDefault();const d=new FormData(event.currentTarget);
    const code=String(d.get("code")||"").trim().toUpperCase().replace(/[^A-Z0-9_]/g,"_");
    const {error}=await sb.from("academy_domains").insert({code,name_fr:String(d.get("name_fr")||"").trim(),name_en:String(d.get("name_en")||"").trim(),description_fr:String(d.get("description_fr")||"").trim()||null,description_en:String(d.get("description_en")||"").trim()||null,icon:String(d.get("icon")||"").trim()||null,created_by:user.id});
    if(error) return notify(error.message,true);
    notify("Domaine créé.");await loadData();renderManagement();
  }
  async function createProgram(event) {
    event.preventDefault();const d=new FormData(event.currentTarget);
    const code=String(d.get("code")||"").trim().toUpperCase().replace(/[^A-Z0-9_]/g,"_");
    const {error}=await sb.from("academy_programs").insert({domain_id:d.get("domain_id"),code,name_fr:String(d.get("name_fr")||"").trim(),name_en:String(d.get("name_en")||"").trim(),description_fr:String(d.get("description_fr")||"").trim()||null,description_en:String(d.get("description_en")||"").trim()||null,program_type:d.get("program_type"),language_code:String(d.get("language_code")||"fr").trim(),exam_code:String(d.get("exam_code")||"").trim()||null,level_code:String(d.get("level_code")||"").trim()||null,created_by:user.id});
    if(error) return notify(error.message,true);
    notify("Programme créé.");await loadData();renderManagement();
  }

  init().catch(error=>{
    root.innerHTML='<div class="panel"><h1>Chargement du catalogue impossible</h1><p class="catalog-notice error">'+esc(error?.message||"Une erreur est survenue.")+'</p><p><a href="academy.html">Retour à mon espace Academy</a></p></div>';
  });
})();