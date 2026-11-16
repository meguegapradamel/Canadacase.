(() => {
  const cfg=window.CANADACASE_CONFIG||{},root=document.getElementById("academy-payments-app"),logout=document.getElementById("payment-logout");
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase?.createClient){root.innerHTML='<div class="panel"><h1>Configuration indisponible</h1><p>Le service Academy n’est pas configuré.</p></div>';return;}
  const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  let user=null,profile=null,isAdmin=false,isTrainer=false,isLearner=false;
  let offers=[],orders=[],submissions=[],methods=[],rules=[],ledger=[],entitlements=[],trainerCourses=[],trainerSessions=[];
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=n=>new Intl.NumberFormat("fr-FR").format(Number(n||0))+" FCFA";
  const typeLabel=t=>({course:"Formation",live_session:"Séance avec formateur",mock_exam:"Examen blanc",session_package:"Forfait de séances",subscription:"Abonnement",other:"Autre service"}[t]||t);
  const statusLabel=s=>({draft:"Brouillon",submitted_for_review:"À valider",needs_changes:"À corriger",active:"Disponible",suspended:"Suspendue",awaiting_payment:"En attente de paiement",paid:"Payée",cancelled:"Annulée",refunded:"Remboursée",pending:"À vérifier",approved:"Validée",rejected:"Rejetée"}[s]||s);
  const notice=(m,e=false)=>{const n=document.getElementById("payment-notice");if(n){n.textContent=m;n.className="payment-notice"+(e?" error":"");n.classList.remove("hidden");}};
  async function init(){
    const {data,error}=await sb.auth.getSession();if(error)throw error;if(!data.session)return signedOut();
    user=data.session.user;
    const p=await sb.from("profiles").select("id,full_name,role,is_active").eq("id",user.id).single();if(p.error)throw p.error;profile=p.data;
    if(profile.is_active===false){await sb.auth.signOut();return signedOut("Ce compte est désactivé.");}
    isAdmin=profile.role==="admin";
    const r=await sb.from("academy_user_roles").select("role_code").eq("user_id",user.id);if(r.error)throw r.error;
    const roles=(r.data||[]).map(x=>x.role_code);isTrainer=roles.includes("trainer");isLearner=roles.includes("learner");
    if(!isLearner&&!isAdmin){const a=await sb.from("academy_user_roles").insert({user_id:user.id,role_code:"learner"});if(a.error&&!String(a.error.message||"").toLowerCase().includes("duplicate"))throw a.error;isLearner=true;}
    logout.classList.remove("hidden");logout.addEventListener("click",async()=>{const o=await sb.auth.signOut();if(o.error)return notice(o.error.message,true);location.href="index.html";});
    await load();render();
  }
  function signedOut(msg=""){root.innerHTML='<div class="panel"><p class="eyebrow">CANADACASE ACADEMY</p><h1>Connectez-vous pour accéder aux paiements.</h1>'+(msg?'<p class="payment-notice error">'+esc(msg)+'</p>':'')+'<a class="primary" href="index.html">Accéder à la connexion</a></div>';}
  async function load(){
    const qs=[
      sb.from("academy_offers").select("*").order("created_at",{ascending:false}),
      sb.from("academy_payment_orders").select("*").order("created_at",{ascending:false}),
      sb.from("academy_payment_submissions").select("*").order("submitted_at",{ascending:false}),
      sb.from("academy_payment_methods").select("*").order("display_name"),
      sb.from("academy_pricing_rules").select("*").order("product_type"),
      sb.from("academy_financial_ledger").select("*").order("created_at",{ascending:false}),
      sb.from("academy_entitlements").select("*").order("created_at",{ascending:false}),
      isTrainer?sb.from("academy_courses").select("id,title,created_by,status").eq("created_by",user.id).eq("status","published").order("title"):Promise.resolve({data:[],error:null}),
      isTrainer?sb.from("academy_live_sessions").select("id,title,starts_at,ends_at,status").eq("trainer_id",user.id).eq("status","open").gt("starts_at",new Date().toISOString()).order("starts_at"):Promise.resolve({data:[],error:null})
    ];
    const rs=await Promise.all(qs);for(const x of rs)if(x.error)throw x.error;
    [offers,orders,submissions,methods,rules,ledger,entitlements,trainerCourses,trainerSessions]=rs.map(x=>x.data||[]);
  }
  function render(){
    root.innerHTML='<div class="payment-hero"><p class="eyebrow">CANADACASE · ACADEMY</p><h1>Tarifs et paiements</h1><p>Des paiements traçables, des tarifs encadrés et une validation humaine avant toute activation. Les moyens Mobile Money ne sont affichés que lorsqu’ils sont configurés par l’administration.</p><div class="payment-meta">Devise de référence : <strong>FCFA (XAF)</strong> · Paiement manuel contrôlé · Aucun frais de passerelle activé</div></div><div id="payment-notice" class="payment-notice hidden"></div>'+
      (isAdmin?adminPanel():"")+(isTrainer?trainerPanel():"")+(isLearner?learnerPanel():"");
    bind();
  }
  function adminPanel(){
    const pendingOffers=offers.filter(o=>o.status==="submitted_for_review");
    const pending=submissions.filter(s=>s.review_status==="pending");
    const ruleRows=rules.map(r=>'<tr><td>'+esc(typeLabel(r.product_type))+'</td><td>'+money(r.min_amount_xaf)+'</td><td>'+money(r.max_amount_xaf)+'</td><td>'+Number(r.commission_rate).toFixed(2)+' %</td><td>'+ (r.enabled?"Active":"Désactivée")+'</td></tr>').join("");
    const methodCards=methods.map(m=>'<form class="payment-card payment-method-form" data-method="'+esc(m.method_code)+'"><div class="payment-row"><h3>'+esc(m.display_name)+'</h3><span class="payment-chip '+(m.enabled?"good":"warn")+'">'+(m.enabled?"Activé":"Désactivé")+'</span></div><label>Numéro / compte marchand<input name="merchant_number" value="'+esc(m.merchant_number||"")+'" placeholder="À renseigner"></label><label>Nom du bénéficiaire<input name="account_name" value="'+esc(m.account_name||"")+'" placeholder="Nom exact affiché au payeur"></label><label>Instructions<textarea name="instructions" rows="3">'+esc(m.instructions||"")+'</textarea></label><label><input type="checkbox" name="enabled" '+(m.enabled?"checked":"")+'> Activer ce moyen de paiement</label><button class="secondary" type="submit">Enregistrer</button></form>').join("");
    const offerCards=pendingOffers.map(o=>'<article class="payment-card"><span class="payment-chip warn">À valider</span><h3>'+esc(o.title)+'</h3><p>'+esc(typeLabel(o.product_type))+' · '+money(o.price_xaf)+'</p><p>'+esc(o.description||"")+'</p><div class="payment-actions"><button class="primary" data-approve-offer="'+o.id+'">Approuver et publier</button><button class="secondary" data-return-offer="'+o.id+'">Demander correction</button></div></article>').join("")||'<div class="payment-empty">Aucune offre à examiner.</div>';
    const paymentCards=pending.map(s=>{const o=orders.find(x=>x.id===s.order_id);return '<article class="payment-card"><span class="payment-chip warn">Paiement à vérifier</span><h3>Commande '+esc(o?.order_reference||s.order_id)+'</h3><p>'+esc(o?.offer_title_snapshot||"Offre")+' · '+money(s.amount_xaf)+'</p><p>Méthode : '+esc(methods.find(m=>m.method_code===s.method_code)?.display_name||s.method_code)+'</p><p>Expéditeur : '+esc(s.sender_phone)+'<br>Référence opérateur : <strong>'+esc(s.transaction_reference)+'</strong></p><div class="payment-actions"><button class="primary" data-approve-payment="'+s.id+'">Confirmer le paiement</button><button class="secondary" data-reject-payment="'+s.id+'">Rejeter</button></div></article>';}).join("")||'<div class="payment-empty">Aucun paiement en attente de contrôle.</div>';
    const gross=ledger.filter(x=>x.entry_type==="gross_payment").reduce((a,x)=>a+Number(x.amount_xaf),0),comm=ledger.filter(x=>x.entry_type==="platform_commission").reduce((a,x)=>a+Number(x.amount_xaf),0),net=ledger.filter(x=>x.entry_type==="trainer_net_due").reduce((a,x)=>a+Number(x.amount_xaf),0);
    return '<section class="payment-panel"><h2>Paramètres tarifaires</h2><p class="payment-muted">L’administration fixe les bornes de prix et le taux de commission. Les taux sont figés dans chaque offre et chaque commande.</p><form id="payment-rule-form" class="payment-form"><div class="payment-grid"><label>Type de produit<select name="product_type"><option value="course">Formation</option><option value="live_session">Séance formateur</option><option value="mock_exam">Examen blanc</option><option value="session_package">Forfait</option><option value="subscription">Abonnement</option><option value="other">Autre</option></select></label><label>Prix minimum (FCFA)<input type="number" name="min_amount_xaf" min="1" required></label><label>Prix maximum (FCFA)<input type="number" name="max_amount_xaf" min="1" required></label><label>Commission plateforme (%)<input type="number" name="commission_rate" min="0" max="50" step="0.01" value="0" required></label></div><label><input type="checkbox" name="enabled" checked> Règle active</label><button class="primary" type="submit">Enregistrer la règle</button></form><div class="payment-subtitle"><h3>Règles en vigueur</h3></div><div class="payment-table-wrap"><table class="payment-table"><thead><tr><th>Produit</th><th>Minimum</th><th>Maximum</th><th>Commission</th><th>État</th></tr></thead><tbody>'+ (ruleRows||'<tr><td colspan="5">Aucune règle tarifaire configurée.</td></tr>')+'</tbody></table></div></section>'+
    '<section class="payment-panel"><h2>Moyens de paiement</h2><p class="payment-muted">Renseignez uniquement les coordonnées marchandes officielles. Orange Money et MTN MoMo restent désactivés tant que leurs comptes ne sont pas configurés.</p><div class="payment-admin-grid">'+methodCards+'</div></section>'+
    '<section class="payment-panel"><h2>Validation des offres formateurs</h2><div class="payment-grid">'+offerCards+'</div></section>'+
    '<section class="payment-panel"><h2>Contrôle des paiements</h2><p class="payment-muted">Vérifiez le reçu dans votre compte marchand avant de confirmer. La confirmation crée automatiquement les écritures financières.</p><div class="payment-grid">'+paymentCards+'</div></section>'+
    '<section class="payment-panel"><h2>Journal financier</h2><div class="payment-grid"><div class="payment-card"><span class="payment-small">Encaissements bruts confirmés</span><div class="payment-number">'+money(gross)+'</div></div><div class="payment-card"><span class="payment-small">Commissions plateforme</span><div class="payment-number">'+money(comm)+'</div></div><div class="payment-card"><span class="payment-small">Net dû aux formateurs</span><div class="payment-number">'+money(net)+'</div></div></div><p class="payment-small">Ces montants sont des ventilations de suivi ; aucun versement automatique aux formateurs n’est exécuté.</p></section>';
  }
  function trainerPanel(){
    const own=offers.filter(o=>o.trainer_id===user.id);
    const rows=own.map(o=>'<article class="payment-card"><span class="payment-chip">'+esc(statusLabel(o.status))+'</span><h3>'+esc(o.title)+'</h3><p>'+esc(typeLabel(o.product_type))+' · '+money(o.price_xaf)+'</p><p>Commission prévue : '+Number(o.commission_rate).toFixed(2)+' %</p>'+(["draft","needs_changes"].includes(o.status)?'<button class="secondary" data-submit-offer="'+o.id+'">Soumettre à validation</button>':'')+'</article>').join("")||'<div class="payment-empty">Vous n’avez pas encore créé d’offre.</div>';
    return '<section class="payment-panel"><h2>Espace formateur — Mes tarifs</h2><p class="payment-muted">Les prix doivent respecter la fourchette définie par l’administration. Toute offre doit être approuvée avant d’être visible aux apprenants.</p><form id="trainer-offer-form" class="payment-form"><div class="payment-grid"><label>Type<select name="product_type"><option value="course">Formation publiée</option><option value="live_session">Séance individuelle</option><option value="mock_exam">Examen blanc</option><option value="session_package">Forfait de séances</option><option value="subscription">Abonnement</option><option value="other">Autre prestation</option></select></label><label>Nom de l’offre<input name="title" minlength="3" maxlength="160" required></label><label>Formation concernée<select name="course_id"><option value="">Choisir une formation publiée</option>'+trainerCourses.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join("")+'</select></label><label>Séance concernée<select name="session_id"><option value="">Choisir une séance future</option>'+trainerSessions.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.title)+' · '+new Date(s.starts_at).toLocaleString("fr-FR")+'</option>').join("")+'</select></label><label>Prix (FCFA)<input type="number" name="price_xaf" min="1" required></label><label>Nombre de séances incluses (si forfait)<input type="number" name="sessions_included" min="1" max="100"></label><label>Validité en jours (facultatif)<input type="number" name="validity_days" min="1" max="730"></label><label>Cycle de facturation<select name="billing_cycle"><option value="one_time">Paiement unique</option><option value="monthly">Mensuel (renouvellement manuel)</option><option value="yearly">Annuel (renouvellement manuel)</option></select></label></div><label>Description<textarea name="description" rows="3" maxlength="2000"></textarea></label><button class="primary" type="submit">Créer le brouillon</button></form><h3 class="payment-subtitle">Mes offres</h3><div class="payment-grid">'+rows+'</div></section>';
  }
  function learnerPanel(){
    const active=offers.filter(o=>o.status==="active");
    const cards=active.map(o=>'<article class="payment-card"><span class="payment-chip good">'+esc(typeLabel(o.product_type))+'</span><h3>'+esc(o.title)+'</h3><p>'+esc(o.description||"")+'</p><div class="payment-row"><strong class="payment-number">'+money(o.price_xaf)+'</strong><button class="primary" data-create-order="'+o.id+'">Commander</button></div></article>').join("")||'<div class="payment-empty">Aucune offre payante n’est publiée pour le moment.</div>';
    const my=orders.filter(o=>o.buyer_id===user.id).map(o=>orderCard(o)).join("")||'<div class="payment-empty">Vous n’avez pas encore de commande.</div>';
    const rights=entitlements.filter(e=>e.user_id===user.id).map(e=>'<article class="payment-card"><span class="payment-chip '+(e.status==="active"?"good":"warn")+'">'+esc(statusLabel(e.status))+'</span><h3>'+esc(typeLabel(e.entitlement_type))+'</h3><p>'+ (e.units_remaining===null?"Accès activé":Number(e.units_remaining)+" / "+Number(e.units_total)+" utilisation(s) restante(s)")+'</p><p class="payment-small">'+(e.expires_at?"Valable jusqu’au "+new Date(e.expires_at).toLocaleDateString("fr-FR"):"Durée selon les conditions de l’offre")+'</p></article>').join("")||'<div class="payment-empty">Aucun droit d’accès payant actif pour le moment.</div>';
    return '<section class="payment-panel"><h2>Offres disponibles</h2><p class="payment-muted">Choisissez une offre, créez une commande puis suivez les instructions de paiement affichées.</p><div class="payment-grid">'+cards+'</div><div class="payment-divider"></div><h2>Mes droits d’accès</h2><div class="payment-grid">'+rights+'</div><div class="payment-divider"></div><h2>Mes commandes et paiements</h2><div class="payment-grid">'+my+'</div></section>';
  }
  function orderCard(o){
    const reports=submissions.filter(s=>s.order_id===o.id),pending=reports.find(s=>s.review_status==="pending"),latest=reports[0];
    const methodOptions=methods.filter(m=>m.enabled).map(m=>'<option value="'+esc(m.method_code)+'">'+esc(m.display_name)+'</option>').join("");
    const status=o.status==="paid"?"good":o.status==="awaiting_payment"?"warn":"";
    let form="";
    if(o.status==="awaiting_payment"&&!pending&&methodOptions){
      form='<form class="payment-form payment-report-form" data-report-order="'+o.id+'"><label>Moyen de paiement<select name="method_code" required><option value="">Choisir…</option>'+methodOptions+'</select></label><div class="payment-instructions" data-instructions="'+o.id+'">Choisissez un moyen de paiement pour afficher les coordonnées du bénéficiaire.</div><label>Numéro ayant envoyé l’argent<input name="sender_phone" required maxlength="24" placeholder="6XXXXXXXX"></label><label>Référence de transaction reçue de l’opérateur<input name="transaction_reference" required maxlength="120" placeholder="Référence SMS / reçu"></label><p class="payment-small">Montant exact à envoyer : <strong>'+money(o.amount_xaf)+'</strong>. Ne communiquez jamais votre code PIN.</p><button class="primary" type="submit">Soumettre mon paiement</button></form>';
    }else if(pending){form='<p class="payment-notice">Votre paiement a été déclaré. Il est en cours de vérification par l’administration.</p>';}
    else if(latest?.review_status==="rejected"){form='<p class="payment-notice error">Dernière déclaration rejetée : '+esc(latest.review_note||"Veuillez vérifier la référence et soumettre une nouvelle déclaration.")+'</p>';}
    return '<article class="payment-card"><div class="payment-row"><span class="payment-chip '+status+'">'+esc(statusLabel(o.status))+'</span><strong class="payment-number">'+money(o.amount_xaf)+'</strong></div><h3>'+esc(o.offer_title_snapshot)+'</h3><p>Référence commande : <strong>'+esc(o.order_reference)+'</strong></p><p class="payment-small">Commission enregistrée : '+Number(o.commission_rate).toFixed(2)+' % · Expiration : '+new Date(o.expires_at).toLocaleString("fr-FR")+'</p>'+form+'</article>';
  }
  function bind(){
    document.getElementById("payment-rule-form")?.addEventListener("submit",async ev=>{
      ev.preventDefault();const d=new FormData(ev.currentTarget),payload={product_type:d.get("product_type"),min_amount_xaf:Number(d.get("min_amount_xaf")),max_amount_xaf:Number(d.get("max_amount_xaf")),commission_rate:Number(d.get("commission_rate")),enabled:d.get("enabled")==="on"};
      const {error}=await sb.from("academy_pricing_rules").upsert(payload,{onConflict:"product_type"});if(error)return notice(error.message,true);await load();render();notice("Règle tarifaire enregistrée.");
    });
    root.querySelectorAll(".payment-method-form").forEach(form=>form.addEventListener("submit",async ev=>{
      ev.preventDefault();const d=new FormData(form),enabled=d.get("enabled")==="on";
      const payload={merchant_number:String(d.get("merchant_number")||"").trim()||null,account_name:String(d.get("account_name")||"").trim()||null,instructions:String(d.get("instructions")||"").trim(),enabled};
      const {error}=await sb.from("academy_payment_methods").update(payload).eq("method_code",form.dataset.method);if(error)return notice(error.message,true);await load();render();notice("Moyen de paiement mis à jour.");
    }));
    document.getElementById("trainer-offer-form")?.addEventListener("submit",async ev=>{
      ev.preventDefault();const d=new FormData(ev.currentTarget),productType=String(d.get("product_type")),courseId=String(d.get("course_id")||"")||null,sessionId=String(d.get("session_id")||"")||null;
      if(productType==="course"&&!courseId)return notice("Sélectionnez une formation publiée.",true);
      if(productType==="live_session"&&!sessionId)return notice("Sélectionnez une séance future ouverte.",true);
      const payload={created_by:user.id,trainer_id:user.id,product_type:productType,course_id:productType==="course"?courseId:null,session_id:productType==="live_session"?sessionId:null,title:String(d.get("title")||"").trim(),price_xaf:Number(d.get("price_xaf")),description:String(d.get("description")||"").trim()||null,sessions_included:productType==="session_package"&&d.get("sessions_included")?Number(d.get("sessions_included")):null,validity_days:d.get("validity_days")?Number(d.get("validity_days")):null,billing_cycle:d.get("billing_cycle"),status:"draft"};
      const {error}=await sb.from("academy_offers").insert(payload);if(error)return notice(error.message,true);await load();render();notice("Brouillon créé. Soumettez-le ensuite à validation.");
    });
    root.querySelectorAll("[data-submit-offer]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await sb.from("academy_offers").update({status:"submitted_for_review"}).eq("id",b.dataset.submitOffer);if(error)return notice(error.message,true);await load();render();notice("Offre soumise à l’administration.");}));
    root.querySelectorAll("[data-approve-offer],[data-return-offer]").forEach(b=>b.addEventListener("click",async()=>{
      const status=b.hasAttribute("data-approve-offer")?"active":"needs_changes";if(!confirm(status==="active"?"Publier cette offre ?":"Renvoyer cette offre au formateur pour correction ?"))return;
      const {error}=await sb.from("academy_offers").update({status}).eq("id",b.dataset.approveOffer||b.dataset.returnOffer);if(error)return notice(error.message,true);await load();render();notice(status==="active"?"Offre publiée.":"Offre renvoyée pour correction.");
    }));
    root.querySelectorAll("[data-create-order]").forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;const {data,error}=await sb.from("academy_payment_orders").insert({offer_id:b.dataset.createOrder}).select("id").single();if(error){b.disabled=false;return notice(error.message,true);}await load();render();notice("Commande créée. Suivez les instructions dans « Mes commandes ».");}));
    root.querySelectorAll(".payment-report-form").forEach(form=>{
      const select=form.querySelector('[name="method_code"]'),box=form.querySelector("[data-instructions]");
      const show=()=>{const m=methods.find(x=>x.method_code===select.value);box.innerHTML=m?'<strong>'+esc(m.display_name)+' — '+esc(m.account_name)+'</strong><span>Numéro / compte : '+esc(m.merchant_number)+'</span><p>'+esc(m.instructions)+'</p>':'Choisissez un moyen de paiement.';};
      select.addEventListener("change",show);
      form.addEventListener("submit",async ev=>{ev.preventDefault();const d=new FormData(form),o=orders.find(x=>x.id===form.dataset.reportOrder);const payload={order_id:o.id,method_code:d.get("method_code"),sender_phone:String(d.get("sender_phone")||"").trim(),transaction_reference:String(d.get("transaction_reference")||"").trim(),amount_xaf:o.amount_xaf};const {error}=await sb.from("academy_payment_submissions").insert(payload);if(error)return notice(error.message,true);await load();render();notice("Déclaration transmise. La commande sera activée après vérification du paiement.");});
    });
    root.querySelectorAll("[data-approve-payment],[data-reject-payment]").forEach(b=>b.addEventListener("click",async()=>{
      const decision=b.hasAttribute("data-approve-payment")?"approve":"reject";
      if(!confirm(decision==="approve"?"Confirmer que le paiement est réellement visible sur le compte marchand ?":"Rejeter cette déclaration de paiement ?"))return;
      const note=decision==="reject"?(prompt("Motif du rejet (facultatif) :")||""): "Paiement vérifié sur le compte marchand.";
      const {error}=await sb.rpc("academy_admin_review_payment",{p_submission_id:b.dataset.approvePayment||b.dataset.rejectPayment,p_decision:decision,p_note:note});if(error)return notice(error.message,true);await load();render();notice(decision==="approve"?"Paiement confirmé et écritures financières créées.":"Déclaration rejetée.");
    }));
  }
  init().catch(err=>{root.innerHTML='<div class="panel"><h1>Chargement des paiements impossible</h1><p class="payment-notice error">'+esc(err?.message||"Une erreur est survenue.")+'</p><p><a href="academy.html">Retour à Academy</a></p></div>';});
})();