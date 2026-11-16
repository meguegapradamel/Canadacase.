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
  let domains = [], programs = [], courses = [], resources = [], languageLessons = [];
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
      sb.from("language_courses").select("id,exam,skill,level,title,summary,content,estimated_minutes,pedagogical_type,section_title,unit_title,objectives,key_points,practice_prompt").eq("is_published",true).order("sort_order").limit(100)
    ]);
    for(const r of results) if(r.error) throw r.error;
    [domains,programs,courses,resources,languageLessons]=results.map(r=>r.data||[]);
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
    document.querySelectorAll("[data-course-action]").forEach(b=>b.addEventListener("click",()=>courseAction(b.dataset.courseAction,b.dataset.id)));
    document.getElementById("catalog-course-form")?.addEventListener("submit",createCourse);
  }

  function programOptions() {
    return programs.filter(p=>p.is_active).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name_fr)+'</option>').join("");
  }
  function courseCard(c) {
    const adminActions=isAdmin?'<button type="button" class="primary" data-course-action="publish" data-id="'+esc(c.id)+'">Publier</button>'+
      '<button type="button" class="secondary" data-course-action="needs_changes" data-id="'+esc(c.id)+'">Demander corrections</button>'+
      '<button type="button" class="secondary" data-course-action="archive" data-id="'+esc(c.id)+'">Archiver</button>':'';
    const trainerAction=canSubmitCourse(c)?'<button type="button" class="secondary" data-course-action="submit" data-id="'+esc(c.id)+'">Soumettre à validation</button>':'';
    return '<article class="catalog-card"><div class="catalog-meta"><span class="catalog-chip">'+esc(programName(c.program_id))+'</span><span class="catalog-status '+(c.status==="published"?"published":"")+'">'+esc(statusLabel(c.status))+'</span></div>'+
      '<h3>'+esc(c.title)+'</h3><p>'+esc(c.summary||"")+'</p><div class="catalog-meta"><span class="catalog-chip">'+esc(c.level_code||"Tous niveaux")+'</span><span class="catalog-chip">'+esc(c.language_code.toUpperCase())+'</span><span class="catalog-chip">'+esc(c.estimated_minutes)+' min</span></div>'+
      '<div class="catalog-actions"><button type="button" class="secondary" data-open-course="'+esc(c.id)+'">Voir le contenu</button>'+adminActions+trainerAction+'</div></article>';
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

  async function openCourse(id) {
    selectedCourseId=id;
    const course=courses.find(c=>c.id===id); if(!course) return;
    const detail=document.getElementById("catalog-course-detail");
    detail.innerHTML='<div class="catalog-empty">Chargement des modules et leçons…</div>';
    const {data:mods,error}=await sb.from("academy_course_modules").select("id,title,description,position,estimated_minutes").eq("course_id",id).order("position");
    if(error) { detail.innerHTML='<div class="catalog-notice error">'+esc(error.message)+'</div>'; return; }
    const ids=(mods||[]).map(m=>m.id);
    let lessons=[];
    if(ids.length) {
      const r=await sb.from("academy_lessons").select("id,module_id,title,lesson_type,content,media_url,transcript,objectives,estimated_minutes,position,is_preview").in("module_id",ids).order("position");
      if(r.error) { detail.innerHTML='<div class="catalog-notice error">'+esc(r.error.message)+'</div>'; return; }
      lessons=r.data||[];
    }
    const editable=canEditCourse(course);
    detail.innerHTML='<div class="catalog-panel"><div class="catalog-actions"><h2 style="margin-right:auto">'+esc(course.title)+'</h2><button type="button" class="secondary" id="close-course-detail">Fermer</button></div>'+
      '<p>'+esc(course.description||course.summary||"")+'</p>'+
      (mods||[]).map(m=>'<div class="catalog-module"><h3>'+esc(m.title)+'</h3><p class="catalog-muted">'+esc(m.description||"")+'</p>'+
        lessons.filter(l=>l.module_id===m.id).map(l=>'<details class="catalog-lesson"><summary>'+esc(l.title)+' · '+esc(l.lesson_type)+' · '+esc(l.estimated_minutes)+' min</summary>'+
          (l.objectives?'<p><strong>Objectifs :</strong> '+esc(l.objectives)+'</p>':'')+
          '<div class="lesson-content">'+esc(l.content||"")+'</div>'+
          (l.media_url?safeUrl(l.media_url)?'<p><a href="'+esc(safeUrl(l.media_url))+'" target="_blank" rel="noopener noreferrer">Ouvrir le média</a></p>':'':'')+
          (l.transcript?'<details><summary>Transcription</summary><div class="lesson-content">'+esc(l.transcript)+'</div></details>':'')+'</details>').join("")+
        (editable?'<form class="catalog-form create-lesson-form" data-module-id="'+esc(m.id)+'"><strong>Ajouter une leçon</strong><label>Titre<input name="title" required maxlength="180"></label><div class="two"><label>Type<select name="lesson_type"><option value="text">Texte</option><option value="video">Vidéo</option><option value="audio">Audio</option><option value="document">Document</option><option value="interactive">Interactif</option><option value="quiz">Quiz</option></select></label><label>Durée (minutes)<input name="estimated_minutes" type="number" min="0" value="10"></label></div><label>Contenu pédagogique<textarea name="content" rows="4"></textarea></label><label>Objectifs<textarea name="objectives" rows="2"></textarea></label><label>URL média HTTPS (facultatif)<input name="media_url" type="url" placeholder="https://…"></label><label>Transcription<textarea name="transcript" rows="3"></textarea></label><button class="secondary" type="submit">Ajouter la leçon</button></form>':'')+
      '</div>').join("")+
      (!mods?.length?'<div class="catalog-empty">Aucun module dans ce cours pour le moment.</div>':'')+
      (editable?'<form id="catalog-module-form" class="catalog-form catalog-module" data-course-id="'+esc(id)+'"><strong>Ajouter un module</strong><label>Titre du module<input name="title" required maxlength="180"></label><label>Description<textarea name="description" rows="2"></textarea></label><label>Durée estimée (minutes)<input name="estimated_minutes" type="number" min="0" value="0"></label><button class="primary" type="submit">Ajouter le module</button></form>':'')+
      '</div>';
    document.getElementById("close-course-detail").addEventListener("click",()=>{selectedCourseId=null;detail.innerHTML="";});
    document.getElementById("catalog-module-form")?.addEventListener("submit",createModule);
    detail.querySelectorAll(".create-lesson-form").forEach(f=>f.addEventListener("submit",createLesson));
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