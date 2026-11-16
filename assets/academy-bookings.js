(() => {
  const cfg=window.CANADACASE_CONFIG||{};
  const root=document.getElementById("academy-bookings-app");
  const logout=document.getElementById("booking-logout");
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase?.createClient){
    root.innerHTML='<div class="panel"><h1>Configuration indisponible</h1><p>Le service Academy n’est pas configuré.</p></div>';return;
  }
  const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  let user=null,profile=null,isAdmin=false,isTrainer=false,isLearner=false;
  let sessions=[],bookings=[],courses=[];
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const notice=(msg,error=false)=>{const n=document.getElementById("booking-notice");if(!n)return;n.textContent=msg;n.className="booking-notice"+(error?" error":"");n.classList.remove("hidden");};
  const typeLabel=t=>({individual:"Cours individuel",group:"Cours collectif",workshop:"Atelier",mock_exam:"Examen blanc"}[t]||t);
  const bookingLabel=s=>({confirmed:"Confirmée",cancelled_by_learner:"Annulée par l’apprenant",attended:"Présence enregistrée",no_show:"Absence enregistrée"}[s]||s);
  const dateLabel=(iso,tz)=>{try{return new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:tz||undefined}).format(new Date(iso));}catch(_){return new Date(iso).toLocaleString("fr-FR");}};
  const currentTz=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
  const activeCount=s=>Number(s.reserved_seats||0);
  async function init(){
    const {data,error}=await sb.auth.getSession();if(error)throw error;
    if(!data.session)return signedOut();
    user=data.session.user;
    const p=await sb.from("profiles").select("id,full_name,role,is_active").eq("id",user.id).single();
    if(p.error)throw p.error;profile=p.data;
    if(profile.is_active===false){await sb.auth.signOut();return signedOut("Ce compte est désactivé. Contactez l’administration.");}
    isAdmin=profile.role==="admin";
    const r=await sb.from("academy_user_roles").select("role_code").eq("user_id",user.id);
    if(r.error)throw r.error;
    const roles=(r.data||[]).map(x=>x.role_code);
    isTrainer=roles.includes("trainer");isLearner=roles.includes("learner");
    if(!isLearner&&!isAdmin){
      const add=await sb.from("academy_user_roles").insert({user_id:user.id,role_code:"learner"});
      if(add.error&&!String(add.error.message||"").toLowerCase().includes("duplicate"))throw add.error;
      isLearner=true;
    }
    logout.classList.remove("hidden");
    logout.addEventListener("click",async()=>{const out=await sb.auth.signOut();if(out.error)return notice(out.error.message,true);location.href="index.html";});
    await load();render();
  }
  function signedOut(message=""){
    root.innerHTML='<div class="panel"><p class="eyebrow">CANADACASE ACADEMY</p><h1>Connectez-vous pour accéder aux réservations.</h1>'+(message?'<p class="booking-notice error">'+esc(message)+'</p>':'')+'<a class="primary" href="index.html">Accéder à la connexion</a></div>';
  }
  async function load(){
    const tasks=[
      sb.from("academy_live_sessions").select("id,trainer_id,course_id,title,description,session_type,starts_at,ends_at,timezone,capacity,reserved_seats,status,created_at").order("starts_at"),
      sb.from("academy_bookings").select("id,session_id,learner_id,trainer_id,session_title,session_starts_at,session_ends_at,session_timezone,session_type,status,booked_at").order("booked_at",{ascending:false}),
      sb.from("academy_courses").select("id,title,created_by,status").eq("status","published").order("title")
    ];
    const result=await Promise.all(tasks);
    for(const r of result)if(r.error)throw r.error;
    sessions=result[0].data||[];bookings=result[1].data||[];courses=result[2].data||[];
  }
  function render(){
    const upcoming=sessions.filter(s=>s.status==="open"&&new Date(s.starts_at)>new Date());
    const mine=sessions.filter(s=>s.trainer_id===user.id);
    const myUpcomingBookings=bookings.filter(b=>b.learner_id===user.id);
    root.innerHTML='<div class="booking-hero"><p class="eyebrow">CANADACASE · ACADEMY</p><h1>Calendrier et réservations</h1><p>Réservez un cours individuel, rejoignez un cours collectif ou organisez vos séances si vous êtes formateur agréé.</p><div class="booking-meta">Fuseau de votre appareil : <strong>'+esc(currentTz())+'</strong> · Les horaires sont enregistrés avec le fuseau du formateur.</div></div><div id="booking-notice" class="booking-notice hidden"></div>'+
      (isTrainer?trainerPanel(mine):"")+
      (isLearner?learnerPanel(upcoming,myUpcomingBookings):"")+
      (isAdmin&&!isTrainer&&!isLearner?adminPanel(): "");
    bind();
  }
  function trainerPanel(mine){
    const cards=mine.map(s=>sessionCard(s,true)).join("")||'<div class="booking-empty">Vous n’avez encore publié aucun créneau.</div>';
    return '<section class="booking-panel"><div class="booking-section-head"><div><h2>Espace formateur</h2><p>Publiez vos disponibilités. Un créneau individuel accepte une personne ; les cours collectifs et ateliers ont une capacité configurable.</p></div><span class="booking-chip">'+mine.length+' séance(s)</span></div>'+
      '<form id="booking-create-form" class="booking-form"><label>Titre de la séance<input name="title" required minlength="3" maxlength="180" placeholder="Ex. Expression orale — TEF Canada"></label>'+
      '<div class="booking-grid"><label>Format<select name="session_type" id="booking-session-type"><option value="individual">Cours individuel</option><option value="group">Cours collectif</option><option value="workshop">Atelier</option><option value="mock_exam">Examen blanc</option></select></label>'+
      '<label>Formation associée (facultatif)<select name="course_id"><option value="">Aucune formation liée</option>'+courses.filter(c=>c.created_by===user.id).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join("")+'</select></label></div>'+
      '<label>Description (facultatif)<textarea name="description" rows="2" maxlength="3000" placeholder="Objectif et contenu de la séance"></textarea></label>'+
      '<div class="booking-grid"><label>Date et heure de début<input name="starts_at" type="datetime-local" required></label><label>Durée<select name="duration"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60" selected>1 heure</option><option value="90">1 h 30</option><option value="120">2 heures</option></select></label></div>'+
      '<div class="booking-grid"><label>Places disponibles<input id="booking-capacity" name="capacity" type="number" min="1" max="100" value="1" required></label><label>Fuseau horaire<input name="timezone" maxlength="80" value="'+esc(currentTz())+'" required></label></div>'+
      '<p class="booking-hint">Les créneaux qui se chevauchent sont refusés par la base de données. Une fois une réservation confirmée, l’horaire ne peut plus être déplacé.</p><button class="primary" type="submit">Publier ce créneau</button></form>'+
      '<h3 class="booking-subtitle">Mes séances publiées</h3><div class="booking-list">'+cards+'</div></section>';
  }
  function learnerPanel(open,own){
    const visible=open.filter(s=>s.trainer_id!==user.id);
    const available=visible.map(s=>sessionCard(s,false)).join("")||'<div class="booking-empty">Aucun créneau disponible pour le moment. Revenez consulter le calendrier prochainement.</div>';
    const history=own.map(b=>bookingCard(b)).join("")||'<div class="booking-empty">Vous n’avez encore effectué aucune réservation.</div>';
    return '<section class="booking-panel"><div class="booking-section-head"><div><h2>Réserver une séance</h2><p>Les places sont confirmées immédiatement, dans la limite de la capacité affichée. Aucun paiement n’est demandé dans cette phase.</p></div><span class="booking-chip">'+visible.length+' créneau(x)</span></div><div class="booking-list">'+available+'</div>'+
      '<h3 class="booking-subtitle">Mes réservations</h3><div class="booking-list">'+history+'</div></section>';
  }
  function adminPanel(){return '<section class="booking-panel"><h2>Vue administration</h2><p>Les séances et réservations enregistrées : '+sessions.length+' séance(s), '+bookings.length+' réservation(s). Les contrôles détaillés sont accessibles aux rôles formateur et apprenant concernés.</p></section>';}
  function sessionCard(s,trainer){
    const booked=activeCount(s),mine=bookings.find(b=>b.session_id===s.id&&b.learner_id===user.id),full=booked>=Number(s.capacity);
    const course=courses.find(c=>c.id===s.course_id);
    const ended=new Date(s.ends_at)<=new Date();
    let action="";
    if(trainer){
      const attendees=bookings.filter(b=>b.session_id===s.id);
      const attendance=attendees.map(b=>'<div class="booking-attendee"><span>Apprenant · '+esc(b.learner_id.slice(0,8))+'</span><span class="booking-chip">'+esc(bookingLabel(b.status))+'</span>'+(b.status==="confirmed"&&ended?'<span class="booking-actions"><button type="button" class="secondary" data-attended="'+esc(b.id)+'">Présent</button><button type="button" class="secondary" data-no-show="'+esc(b.id)+'">Absent</button></span>':'')+'</div>').join("");
      action=(s.status==="open"&&!ended?'<button type="button" class="danger-button" data-cancel-session="'+esc(s.id)+'">Annuler la séance</button>':"")+
        '<div class="booking-attendees">'+(attendance||'<small>Aucune inscription pour le moment.</small>')+'</div>';
    }else if(mine){
      action='<span class="booking-chip">'+esc(bookingLabel(mine.status))+'</span>'+(mine.status==="confirmed"&&!ended?'<button type="button" class="secondary" data-cancel-booking="'+esc(mine.id)+'">Annuler ma réservation</button>':"");
    }else{
      action=s.status==="open"&&!ended&&!full?'<button type="button" class="primary" data-book="'+esc(s.id)+'">Réserver ma place</button>':(full?'<span class="booking-chip full">Complet</span>':'');
    }
    return '<article class="booking-card"><div class="booking-card-top"><span class="booking-chip">'+esc(typeLabel(s.session_type))+'</span><span class="booking-chip '+(s.status==="open"?"open":"")+'">'+(s.status==="open"?"Disponible":s.status==="cancelled"?"Annulée":"Terminée")+'</span></div><h3>'+esc(s.title)+'</h3>'+(s.description?'<p>'+esc(s.description)+'</p>':'')+
      '<p class="booking-time">'+esc(dateLabel(s.starts_at,s.timezone))+' – '+esc(dateLabel(s.ends_at,s.timezone))+'</p>'+
      '<div class="booking-card-foot"><span>'+booked+' / '+s.capacity+' place(s) réservée(s)</span>'+(course?'<span>'+esc(course.title)+'</span>':'')+'</div>'+action+'</article>';
  }
  function bookingCard(b){
    return '<article class="booking-card"><div class="booking-card-top"><span class="booking-chip">'+esc(typeLabel(b.session_type))+'</span><span class="booking-chip">'+esc(bookingLabel(b.status))+'</span></div><h3>'+esc(b.session_title)+'</h3><p class="booking-time">'+esc(dateLabel(b.session_starts_at,b.session_timezone))+' – '+esc(dateLabel(b.session_ends_at,b.session_timezone))+'</p>'+(b.status==="confirmed"&&new Date(b.session_starts_at)>new Date()?'<button type="button" class="secondary" data-cancel-booking="'+esc(b.id)+'">Annuler ma réservation</button>':'')+'</article>';
  }
  function bind(){
    const form=document.getElementById("booking-create-form");
    document.getElementById("booking-session-type")?.addEventListener("change",ev=>{const input=document.getElementById("booking-capacity");if(ev.target.value==="individual"){input.value="1";input.disabled=true;}else{input.disabled=false;if(Number(input.value)<2)input.value="8";}});
    form?.addEventListener("submit",async ev=>{
      ev.preventDefault();const d=new FormData(form),start=new Date(d.get("starts_at")),duration=Number(d.get("duration")),end=new Date(start.getTime()+duration*60000);
      if(!Number.isFinite(start.getTime())||start<=new Date())return notice("Choisissez une date future.",true);
      const kind=String(d.get("session_type")),capacity=kind==="individual"?1:Number(d.get("capacity"));
      if(!Number.isInteger(capacity)||capacity<1||capacity>100||(kind==="individual"&&capacity!==1))return notice("La capacité doit être comprise entre 1 et 100. Un cours individuel accepte une personne.",true);
      const payload={trainer_id:user.id,course_id:d.get("course_id")||null,title:String(d.get("title")||"").trim(),description:String(d.get("description")||"").trim()||null,session_type:kind,starts_at:start.toISOString(),ends_at:end.toISOString(),timezone:String(d.get("timezone")||"").trim(),capacity};
      const {error}=await sb.from("academy_live_sessions").insert(payload);
      if(error)return notice(error.message,true);
      await load();render();notice("Créneau publié. Il est maintenant visible aux apprenants.");
    });
    root.querySelectorAll("[data-book]").forEach(b=>b.addEventListener("click",async()=>{
      b.disabled=true;const {error}=await sb.from("academy_bookings").insert({session_id:b.dataset.book,learner_id:user.id});
      if(error){await load();render();return notice(error.message,true);}
      await load();render();notice("Réservation confirmée. Retrouvez-la dans « Mes réservations ».");
    }));
    root.querySelectorAll("[data-cancel-booking]").forEach(b=>b.addEventListener("click",async()=>{
      if(!confirm("Confirmer l’annulation de cette réservation ?"))return;
      const {error}=await sb.from("academy_bookings").update({status:"cancelled_by_learner"}).eq("id",b.dataset.cancelBooking);
      if(error)return notice(error.message,true);await load();render();notice("Réservation annulée. La place a été libérée.");
    }));
    root.querySelectorAll("[data-cancel-session]").forEach(b=>b.addEventListener("click",async()=>{
      if(!confirm("Annuler cette séance ? Les apprenants inscrits verront son statut annulé."))return;
      const {error}=await sb.from("academy_live_sessions").update({status:"cancelled"}).eq("id",b.dataset.cancelSession);
      if(error)return notice(error.message,true);await load();render();notice("Séance annulée.");
    }));
    root.querySelectorAll("[data-attended],[data-no-show]").forEach(b=>b.addEventListener("click",async()=>{
      const status=b.hasAttribute("data-attended")?"attended":"no_show",id=b.dataset.attended||b.dataset.noShow;
      const {error}=await sb.from("academy_bookings").update({status}).eq("id",id);
      if(error)return notice(error.message,true);await load();render();notice("Présence mise à jour.");
    }));
  }
  init().catch(err=>{root.innerHTML='<div class="panel"><h1>Chargement du calendrier impossible</h1><p class="booking-notice error">'+esc(err?.message||"Une erreur est survenue.")+'</p><p><a href="academy.html">Retour à Academy</a></p></div>';});
})();