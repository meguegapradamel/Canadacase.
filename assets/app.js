(() => {
  const cfg = window.CANADACASE_CONFIG || {};
  const configured = cfg.SUPABASE_URL?.startsWith("https://") && !cfg.SUPABASE_URL.includes("VOTRE-") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("VOTRE_");
  const $ = s => document.querySelector(s);
  const authView=$("#auth-view"), candidateView=$("#candidate-view"), adminView=$("#admin-view");
  let sb=null, currentUser=null, profile=null;
  const showNotice=(msg, bad=false)=>{const n=$("#notice");n.textContent=msg;n.className="notice "+(bad?"error":"");n.classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"});};
  const hideNotice=()=>$("#notice").classList.add("hidden");
  const setBusy=(form,b)=>{form.querySelectorAll("button").forEach(x=>x.disabled=b);};
  const val=(form,name)=>form.elements[name]?.value ?? "";
  const setVal=(form,name,value)=>{if(form.elements[name]) form.elements[name].value=value??"";};
  const fields=[...$("#candidate-form").elements].filter(e=>e.name);
  const payload=()=>Object.fromEntries(fields.map(e=>[e.name,e.value]));
  function tab(which){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===which));$("#login-form").classList.toggle("hidden",which!=="login");$("#register-form").classList.toggle("hidden",which!=="register");}
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>tab(b.dataset.tab)));
  function logoutButton(){ $("#userbar").innerHTML='<button class="ghost" id="logout">Déconnexion</button>';$("#logout").onclick=async()=>{await sb.auth.signOut();location.reload();};}
  function showOnly(view){[authView,candidateView,adminView].forEach(v=>v.classList.add("hidden"));view.classList.remove("hidden");}
  async function loadProfile(){
    const {data,error}=await sb.from("profiles").select("*").eq("id",currentUser.id).single();
    if(error) throw error; profile=data;
  }
  async function initSession(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session){showOnly(authView);return;}
    currentUser=session.user; await loadProfile(); logoutButton();
    if(profile.role==="admin"){showOnly(adminView);await loadAdmin();}
    else {showOnly(candidateView);await loadCandidate();}
  }
  $("#login-form").addEventListener("submit",async e=>{e.preventDefault();hideNotice();setBusy(e.currentTarget,true);try{const f=e.currentTarget;const {error}=await sb.auth.signInWithPassword({email:val(f,"email"),password:val(f,"password")});if(error)throw error;await initSession();}catch(x){showNotice(x.message,true);}finally{setBusy(e.currentTarget,false);}});
  $("#register-form").addEventListener("submit",async e=>{e.preventDefault();hideNotice();setBusy(e.currentTarget,true);try{const f=e.currentTarget;const {data,error}=await sb.auth.signUp({email:val(f,"email"),password:val(f,"password"),options:{data:{full_name:val(f,"full_name"),phone:val(f,"phone")}}});if(error)throw error;if(data.session){showNotice("Compte créé. Votre espace est prêt.");await initSession();}else showNotice("Compte créé. Vérifiez votre boîte e-mail pour confirmer l'inscription, puis connectez-vous.");}catch(x){showNotice(x.message,true);}finally{setBusy(e.currentTarget,false);}});
  async function loadCandidate(){
    const {data,error}=await sb.from("candidate_cases").select("*").eq("user_id",currentUser.id).maybeSingle();if(error)throw error;
    if(data?.data){Object.entries(data.data).forEach(([k,v])=>setVal($("#candidate-form"),k,v));}
    $("#case-status").textContent=data?.status||"À compléter";updateProgress();
    await loadDocuments();await loadClientUpdates();
  }
  function updateProgress(){const f=$("#candidate-form");const relevant=[...f.elements].filter(e=>e.name);const filled=relevant.filter(e=>String(e.value||"").trim()).length;const p=Math.round(filled/relevant.length*100);$("#progress-text").textContent=p+" %";$("#progress-bar").style.width=p+"%";}
  $("#candidate-form").addEventListener("input",updateProgress);
  $("#candidate-form").addEventListener("submit",async e=>{e.preventDefault();hideNotice();setBusy(e.currentTarget,true);try{const data=payload();const {error}=await sb.from("candidate_cases").upsert({user_id:currentUser.id,data,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)throw error;showNotice("Votre profil a été enregistré.");}catch(x){showNotice(x.message,true);}finally{setBusy(e.currentTarget,false);}});
  $("#upload-form").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;const file=val(f,"file");const fileObj=f.elements.file.files[0];if(!fileObj)return;hideNotice();setBusy(f,true);try{if(fileObj.size>10*1024*1024)throw new Error("Fichier trop volumineux : limite de 10 Mo.");const ext=fileObj.name.split(".").pop().toLowerCase();if(!["pdf","png","jpg","jpeg"].includes(ext))throw new Error("Format non accepté.");const path=`${currentUser.id}/${crypto.randomUUID()}.${ext}`;const {error:upErr}=await sb.storage.from("case-documents").upload(path,fileObj,{contentType:fileObj.type,upsert:false});if(upErr)throw upErr;const {error:dbErr}=await sb.from("case_documents").insert({user_id:currentUser.id,category:val(f,"category"),file_name:fileObj.name,storage_path:path,mime_type:fileObj.type,size_bytes:fileObj.size});if(dbErr){await sb.storage.from("case-documents").remove([path]);throw dbErr;}f.reset();showNotice("Document téléversé.");await loadDocuments();}catch(x){showNotice(x.message,true);}finally{setBusy(f,false);}});
  async function loadDocuments(){const {data,error}=await sb.from("case_documents").select("id,category,file_name,size_bytes,status,created_at").eq("user_id",currentUser.id).order("created_at",{ascending:false});if(error)throw error;const el=$("#documents-list");el.innerHTML="";if(!data.length){el.textContent="Aucun document déposé.";return;}data.forEach(d=>{const row=document.createElement("div");row.className="doc-row";const name=document.createElement("strong");name.textContent=d.file_name;const meta=document.createElement("span");meta.textContent=`${d.category} · ${Math.ceil(d.size_bytes/1024)} Ko · ${d.status}`;row.append(name,meta);el.append(row);});}
  async function loadClientUpdates(){const {data,error}=await sb.from("case_updates").select("message,created_at").eq("user_id",currentUser.id).order("created_at",{ascending:false});if(error)throw error;const el=$("#client-updates");el.innerHTML="";if(!data.length){el.textContent="Aucune mise à jour pour le moment.";return;}data.forEach(u=>{const p=document.createElement("p");p.textContent=new Date(u.created_at).toLocaleString("fr-FR")+" — "+u.message;el.append(p);});}
  async function loadAdmin(){
    const [{data:profiles,error:pErr},{data:cases,error:cErr},{data:docs,error:dErr}] = await Promise.all([sb.from("profiles").select("id,full_name,email,created_at").order("created_at",{ascending:false}),sb.from("candidate_cases").select("user_id,status,data,updated_at"),sb.from("case_documents").select("id,user_id,status")]);
    if(pErr)throw pErr;if(cErr)throw cErr;if(dErr)throw dErr;
    $("#stat-total").textContent=profiles.filter(p=>p.id!==currentUser.id).length;$("#stat-review").textContent=cases.filter(c=>c.status==="À examiner").length;$("#stat-docs").textContent=docs.length;
    const tbody=$("#clients-table");tbody.innerHTML="";
    profiles.filter(p=>p.id!==currentUser.id).forEach(p=>{const c=cases.find(x=>x.user_id===p.id);const tr=document.createElement("tr");const cells=[p.full_name||"Client",p.email||"",c?.data?.program||"—",c?.status||"À compléter",c?.updated_at?new Date(c.updated_at).toLocaleDateString("fr-FR"):"—"];cells.forEach(t=>{const td=document.createElement("td");td.textContent=t;tr.append(td);});const td=document.createElement("td");const b=document.createElement("button");b.className="secondary small-btn";b.textContent="Ouvrir";b.onclick=()=>openCase(p,c);td.append(b);tr.append(td);tbody.append(tr);});
  }
  async function openCase(p,c){const box=$("#admin-detail");box.classList.remove("hidden");box.innerHTML="";const h=document.createElement("h2");h.textContent="Dossier — "+(p.full_name||p.email);box.append(h);const status=document.createElement("select");["À compléter","À examiner","Documents manquants","En traitement","Soumis","Clôturé"].forEach(x=>{const o=document.createElement("option");o.textContent=x;o.value=x;status.append(o);});status.value=c?.status||"À compléter";const save=document.createElement("button");save.className="primary";save.textContent="Mettre à jour le statut";save.onclick=async()=>{const {error}=await sb.rpc("admin_set_case_status",{target_user:p.id,new_status:status.value});if(error)showNotice(error.message,true);else{showNotice("Statut mis à jour.");await loadAdmin();}};const pre=document.createElement("pre");pre.className="data-preview";pre.textContent=JSON.stringify(c?.data||{},null,2);const note=document.createElement("textarea");note.placeholder="Message visible par le client…";note.rows=3;const send=document.createElement("button");send.className="secondary";send.textContent="Envoyer une mise à jour";send.onclick=async()=>{if(!note.value.trim())return;const {error}=await sb.from("case_updates").insert({user_id:p.id,message:note.value.trim()});if(error)showNotice(error.message,true);else{note.value="";showNotice("Mise à jour envoyée au client.");}};box.append(document.createElement("hr"),document.createTextNode("Statut : "),status,save,document.createElement("h3"),pre,note,send);box.scrollIntoView({behavior:"smooth"});}
  if(!configured){showNotice("Configuration requise : ouvrez assets/config.js et renseignez l'URL et la clé publique de votre projet Supabase. Aucune donnée n'est envoyée tant que cette étape n'est pas faite.",true);showOnly(authView);return;}
  sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  initSession().catch(e=>showNotice(e.message,true));
})();
