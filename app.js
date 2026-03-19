// ==========================
// firebase + app.js unificado
// ==========================

// Importar Firebase desde CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================
// Configuración de Firebase
// ==========================
const firebaseConfig = {
  apiKey: "AIzaSyAepHgklQpdti_LjOOVEAJ2nEt6BvgTs_M",
  authDomain: "ghost-136da.firebaseapp.com",
  projectId: "ghost-136da",
  storageBucket: "ghost-136da.firebasestorage.app",
  messagingSenderId: "950902137760",
  appId: "1:950902137760:web:8534ed0e8ec7fabb597ac5",
  measurementId: "G-93ZSR3TXYJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================
// Estado global
// ==========================
const state = { authUser: null, dbUser: null, clan: null, ranks: [] };

const defaults = [
  { name: "Lider Fundador", taxPercent: 0, perms: ["ver_tabla_impuestos","editar_tabla","editar_dinero","ver_jugadores","verificar_cuentas","cambiar_rangos","marcar_pago","agregar_notas","responder_mensajes","cerrar_semana","gestionar_rangos"] },
  { name: "Lider", taxPercent: 0, perms: ["ver_tabla_impuestos","editar_tabla","editar_dinero","ver_jugadores","verificar_cuentas","cambiar_rangos","marcar_pago","agregar_notas","responder_mensajes","cerrar_semana"] },
  { name: "Co-lider", taxPercent: 2.5, perms: ["ver_tabla_impuestos","marcar_pago","agregar_notas","verificar_cuentas"] },
  { name: "Helper", taxPercent: 5, perms: ["ver_tabla_impuestos","agregar_notas"] },
  { name: "Miembro", taxPercent: 10, perms: ["ver_tabla_impuestos"] }
];

// ==========================
// Funciones auxiliares
// ==========================
const gId = id => document.getElementById(id)?.value.trim() || "";
const mkEmail = (n,c) => `${n.replace(/\s+/g,'_')}@${c.replace(/\s+/g,'_')}.com`.toLowerCase();

window.toast = (msg,type='success') => {
  const container = document.getElementById('toast-container');
  if(!container){ console.log(msg); return alert(msg); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerText = msg;
  container.appendChild(t);
  setTimeout(()=>t.remove(),3000);
};

const hasPerm = p => {
  if(!state.dbUser || !state.dbUser.rankId) return false;
  const r = state.ranks.find(r=>r.id===state.dbUser.rankId);
  return r ? r.permissions.includes(p) : false;
};

// ==========================
// Navegación
// ==========================
window.nav = id => {
  document.querySelectorAll('.view').forEach(e => e.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
};

window.showPanel = id => {
  document.querySelectorAll('.panel').forEach(e => e.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
  document.querySelectorAll('#dash-nav button').forEach(b => b.classList.remove('active'));
  document.querySelector(`#dash-nav button[onclick="showPanel('${id}')"]`)?.classList.add('active');
};

window.renderUsers = () => {
  const tbody = document.getElementById('tbody-users');
  if(!tbody) return;
  tbody.innerHTML = '';
  const users = (state.users||[]).sort((a,b)=>a.nametag.localeCompare(b.nametag));
  users.forEach(u => {
    const rank = state.ranks.find(r=>r.id===u.rankId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.nametag || '(sin nametag)'}</td>
      <td>${rank?.name || 'Sin rango'}</td>
      <td>${u.verified ? 'Verificado' : 'Pendiente'}</td>
      <td>${hasPerm('verificar_cuentas') && !u.verified ? `<button onclick="toggleUserVerification('${u.id}', ${u.verified})">Verificar</button>` : '-'}</td>
    `;
    tbody.appendChild(tr);
  });
};

window.renderTaxes = () => {
  const tbody = document.getElementById('tbody-taxes');
  if(!tbody) return;
  tbody.innerHTML = '';
  (state.users||[]).forEach(u => {
    const rank = state.ranks.find(r=>r.id===u.rankId);
    const taxPercent = rank?.taxPercent ?? 0;
    const money = u.money ?? 1000;
    const tax = (money * taxPercent / 100).toFixed(2);
    const weekPay = state.currentWeek?.payments?.[u.id] || {};
    const paid = weekPay.paid === true;

    const action = state.currentWeek?.closed
      ? 'Semana cerrada'
      : hasPerm('marcar_pago')
        ? `<button onclick="markTaxPaid('${u.id}')">${paid ? 'Desmarcar pago' : 'Marcar pago'}</button>`
        : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.nametag}</td>
      <td>${rank?.name || 'Sin rango'}</td>
      <td>${money}</td>
      <td>${taxPercent}%</td>
      <td>${tax}</td>
      <td>${paid ? 'Pagado' : 'No pagado'}</td>
      <td>${rank?.name ? '' : 'Rango requerido'}</td>
      <td>${action}</td>
    `;
    tbody.appendChild(tr);
  });
};

window.updateWeekStatusUI = () => {
  const weekStatus = document.getElementById('week-status');
  if(!weekStatus) return;
  if(!state.currentWeek) {
    weekStatus.innerHTML = 'No hay semana activa';
    return;
  }
  const closedText = state.currentWeek.closed ? 'CERRADA' : 'ABIERTA';
  weekStatus.innerHTML = `Semana ${state.currentWeek.weekId} - ${closedText}`;
};

window.renderRanks = () => {
  const tbody = document.getElementById('tbody-ranks');
  if(!tbody) return;
  tbody.innerHTML = ''; 
  (state.ranks||[]).sort((a,b)=>a.order - b.order).forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.name}</td>
      <td><input type="number" min="0" max="100" id="rank-tax-${r.id}" value="${r.taxPercent || 0}" style="width:80px" /></td>
      <td><input type="text" id="rank-perm-${r.id}" value="${(r.permissions||[]).join(',')}" style="width:180px" /></td>
      <td><button onclick="saveRank('${r.id}')">Guardar</button></td>
    `;
    tbody.appendChild(tr);
  });
};

window.loadDashboardData = async () => {
  if(!state.dbUser || !state.dbUser.clanId) return;

  const clanSnap = await getDoc(doc(db,'clans',state.dbUser.clanId));
  state.clan = clanSnap.exists() ? { ...clanSnap.data(), id: clanSnap.id } : null;

  const ranksSnap = await getDocs(query(collection(db,'ranks'), where('clanId','==',state.dbUser.clanId)));
  state.ranks = ranksSnap.docs.map(d => ({ id:d.id, ...d.data() }));

  const usersSnap = await getDocs(query(collection(db,'users'), where('clanId','==',state.dbUser.clanId)));
  state.users = usersSnap.docs.map(d => ({ id:d.id, ...d.data() }));

  const weekSnap = await getDocs(query(collection(db,'weeks'), where('clanId','==',state.dbUser.clanId), where('closed','==',false)));
  if(weekSnap.empty){
    const allWeeksSnap = await getDocs(query(collection(db,'weeks'), where('clanId','==',state.dbUser.clanId)));
    const nextWeekId = allWeeksSnap.size ? Math.max(...allWeeksSnap.docs.map(d=>d.data().weekId || 0)) + 1 : 1;
    const newWeekRef = await addDoc(collection(db,'weeks'), { clanId: state.dbUser.clanId, weekId: nextWeekId, closed: false, payments: {} });
    state.currentWeek = { id: newWeekRef.id, clanId: state.dbUser.clanId, weekId: nextWeekId, closed:false, payments: {} };
  } else {
    const weekDoc = weekSnap.docs[0];
    state.currentWeek = { id: weekDoc.id, ...weekDoc.data() };
    if(weekSnap.docs.length > 1){
      console.warn('Hay más de una semana abierta, se usará la primera registrada');
    }
  }

  const weeksAllSnap = await getDocs(query(collection(db,'weeks'), where('clanId','==',state.dbUser.clanId)));
  state.weeks = weeksAllSnap.docs.map(d=>({ id:d.id, ...d.data() }));

  renderUsers();
  renderTaxes();
  renderRanks();
  updateWeekStatusUI();

  const infoDisplay = document.getElementById('user-info-display');
  if(infoDisplay){
    const clanName = state.clan?.name || 'Clan desconocido';
    infoDisplay.innerText = `Nombre: ${state.dbUser.nametag || ''} | Clan: ${clanName}`;
  }
};

window.toggleUserVerification = async (userId, verified) => {
  if(!hasPerm('verificar_cuentas')) return toast('Sin permisos', 'error');
  await setDoc(doc(db,'users',userId), { verified: !verified }, { merge: true });
  toast(`Usuario ${!verified ? 'verificado' : 'marcado como no verificado'}`);
  await loadDashboardData();
};

window.markTaxPaid = async userId => {
  if(!hasPerm('marcar_pago')) return toast('Sin permisos', 'error');
  if(!state.currentWeek || state.currentWeek.closed) return toast('No hay semana activa para marcar pago', 'error');

  const user = state.users.find(u=>u.id===userId);
  if(!user) return toast('Usuario no encontrado', 'error');

  const rank = state.ranks.find(r=>r.id===user.rankId);
  const taxPercent = rank?.taxPercent ?? 0;
  const money = user.money ?? 1000;
  const amount = Number((money * taxPercent / 100).toFixed(2));

  const current = state.currentWeek.payments || {};
  const existing = current[userId] || { paid:false };
  const nextPaid = !existing.paid;

  const updateObj = {
    [`payments.${userId}`]: {
      userId,
      paid: nextPaid,
      amount,
      changedAt: Date.now(),
      weekId: state.currentWeek.weekId
    }
  };

  await updateDoc(doc(db,'weeks',state.currentWeek.id), updateObj);
  toast(`Pago ${nextPaid ? 'registrado' : 'revocado'} para ${user.nametag}`);

  await loadDashboardData();
};

window.closeWeek = async () => {
  if(!hasPerm('cerrar_semana')) return toast('Sin permisos', 'error');
  if(!state.currentWeek || state.currentWeek.closed) return toast('No hay semana abierta para cerrar', 'error');

  await updateDoc(doc(db,'weeks',state.currentWeek.id), { closed: true, closedAt: Date.now() });

  const nextWeekId = (state.currentWeek.weekId || 0) + 1;
  const newWeekRef = await addDoc(collection(db,'weeks'), { clanId: state.dbUser.clanId, weekId: nextWeekId, closed: false, payments: {} });

  toast(`Semana ${state.currentWeek.weekId} cerrada. Iniciada semana ${nextWeekId}.`);

  state.currentWeek = { id:newWeekRef.id, clanId:state.dbUser.clanId, weekId:nextWeekId, closed:false, payments:{} };
  await loadDashboardData();
};

window.saveRank = async rankId => {
  const taxInput = document.getElementById(`rank-tax-${rankId}`);
  const permInput = document.getElementById(`rank-perm-${rankId}`);
  if(!taxInput || !permInput) return;

  const taxPercent = parseFloat(taxInput.value) || 0;
  const perms = permInput.value.split(',').map(s=>s.trim()).filter(Boolean);

  await updateDoc(doc(db,'ranks',rankId), {
    taxPercent,
    permissions: perms
  });

  toast('Rango actualizado');
  await loadDashboardData();
};

window.addRank = async () => {
  const name = document.getElementById('new-rank-name')?.value.trim();
  const tax = parseFloat(document.getElementById('new-rank-tax')?.value) || 0;
  const perms = document.getElementById('new-rank-perms')?.value.split(',').map(s=>s.trim()).filter(Boolean);
  if(!name || !state.dbUser?.clanId) return toast('Faltan campos', 'error');

  await addDoc(collection(db,'ranks'), {
    clanId: state.dbUser.clanId,
    name,
    taxPercent:tax,
    permissions:perms,
    order: state.ranks.length,
    active:true
  });

  toast('Rango agregado');
  document.getElementById('new-rank-name').value='';
  document.getElementById('new-rank-tax').value='';
  document.getElementById('new-rank-perms').value='';
  await loadDashboardData();
};

// ==========================
// Funciones principales
// ==========================
const ALLOWED_CLAN_NAME = 'Ghost';

window.createClan = async () => {
  const name = gId('c-clan-name'), inv = gId('c-invite-id'), nt = gId('c-nametag'), pass = gId('c-password');
  if(!name||!inv||!nt||!pass) return toast("Faltan datos","error");
  if(name.trim().toLowerCase() !== ALLOWED_CLAN_NAME.toLowerCase()) return toast(`Solo el clan '${ALLOWED_CLAN_NAME}' está permitido por ahora`, 'error');

  try {
    const snap = await getDocs(query(collection(db,"clans"), where("inviteId","==",inv)));
    if(!snap.empty) return toast("ID de invitación en uso","error");

    const clanRef = await addDoc(collection(db,"clans"), { name, inviteId: inv, createdAt: Date.now() });
    let founderRankId = "";
    for(let i=0;i<defaults.length;i++){
      const rRef = await addDoc(collection(db,"ranks"), { clanId: clanRef.id, name: defaults[i].name, taxPercent: defaults[i].taxPercent, permissions: defaults[i].perms, order:i, active:true });
      if(i===0) founderRankId = rRef.id;
    }
    await addDoc(collection(db,"weeks"), { clanId: clanRef.id, weekId:1, closed:false });

    const email = mkEmail(nt,name);
    const { user } = await createUserWithEmailAndPassword(auth,email,pass);
    await setDoc(doc(db,"users",user.uid), { uid:user.uid, nametag:nt, clanId:clanRef.id, rankId:founderRankId, verified:true, email, createdAt:Date.now() });

    toast("Clan creado y usuario registrado");
  } catch(e) {
    console.error(e);
    toast(e.message || "Error al crear clan","error");
  }
};

window.joinClan = async () => {
  const inv = gId('j-invite-id'), nt = gId('j-nametag'), pass = gId('j-password');
  if(!inv||!nt||!pass) return toast("Faltan datos","error");

  try {
    const snap = await getDocs(query(collection(db,"clans"), where("inviteId","==",inv)));
    if(snap.empty) return toast("Invitación inválida","error");

    const clanDoc = snap.docs[0], clanId = clanDoc.id, clanName = clanDoc.data().name;
    if(clanName.trim().toLowerCase() !== ALLOWED_CLAN_NAME.toLowerCase()) return toast(`Solo el clan '${ALLOWED_CLAN_NAME}' está permitido por ahora`, 'error');
    const email = mkEmail(nt,clanName);

    const rSnap = await getDocs(query(collection(db,"ranks"), where("clanId","==",clanId), where("name","==","Miembro")));
    const defaultRankId = rSnap.empty ? null : rSnap.docs[0].id;

    const { user } = await createUserWithEmailAndPassword(auth,email,pass);
    await setDoc(doc(db,"users",user.uid), { uid:user.uid, nametag:nt, clanId, rankId:defaultRankId, verified:false, email, createdAt:Date.now() });

    toast("Cuenta creada, esperando verificación");
  } catch(e) {
    console.error(e);
    toast(e.code==='auth/email-already-in-use' ? "El Nametag ya existe" : "Error al registrar","error");
  }
};

window.login = async () => {
  const nt = gId('l-nametag'), clan = gId('l-clan'), pass = gId('l-password');
  if(!nt||!clan||!pass) return toast("Faltan datos","error");

  try {
    await signInWithEmailAndPassword(auth, mkEmail(nt,clan), pass);
  } catch(e) {
    console.error(e);
    toast("Credenciales inválidas","error");
  }
};

window.logout = () => signOut(auth);

// ==========================
// Manejo de estado auth
// ==========================
const updateDashboardUI = () => {
  const unverifiedDiv = document.getElementById('unverified-msg');
  const dashLayout = document.getElementById('dash-layout');
  const infoDisplay = document.getElementById('user-info-display');

  if(!state.dbUser){
    unverifiedDiv?.classList.add('hidden');
    dashLayout?.classList.add('hidden');
    return;
  }

  const clanName = state.clan?.name || state.dbUser?.clanId || 'Desconocido';
  if(state.dbUser.verified){
    unverifiedDiv?.classList.add('hidden');
    dashLayout?.classList.remove('hidden');
    infoDisplay && (infoDisplay.innerText = `Nametag: ${state.dbUser.nametag || ''} - Clan: ${clanName}`);
    showPanel('p-taxes');
  } else {
    unverifiedDiv?.classList.remove('hidden');
    dashLayout?.classList.add('hidden');
    infoDisplay && (infoDisplay.innerText = `Nametag: ${state.dbUser.nametag || ''} - Clan: ${clanName}`);
  }
};

onAuthStateChanged(auth, async u => {
  if(!u){ state.authUser=null; state.dbUser=null; return nav('v-home'); }
  state.authUser = u;
  try {
    const userSnap = await getDoc(doc(db,"users",u.uid));
    if(!userSnap.exists()) return logout();
    state.dbUser = userSnap.data();
    nav('v-dashboard');
    if(state.dbUser.verified){
      await loadDashboardData();
    }
    updateDashboardUI();
  } catch(e){
    console.error(e);
    logout();
  }
});
