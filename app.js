import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const state = { authUser: null, dbUser: null, clan: null, ranks: [], users: [], currentWeek: null };

const defaults = [
  { name: "Lider Fundador", taxPercent: 0, perms: ["ver_tabla_impuestos","editar_tabla","editar_dinero","ver_jugadores","verificar_cuentas","cambiar_rangos","marcar_pago","agregar_notas","responder_mensajes","cerrar_semana","gestionar_rangos"] },
  { name: "Lider", taxPercent: 0, perms: ["ver_tabla_impuestos","editar_tabla","editar_dinero","ver_jugadores","verificar_cuentas","cambiar_rangos","marcar_pago","agregar_notas","responder_mensajes","cerrar_semana"] },
  { name: "Co-lider", taxPercent: 2.5, perms: ["ver_tabla_impuestos","marcar_pago","agregar_notas"] },
  { name: "Helper", taxPercent: 5, perms: ["ver_tabla_impuestos","agregar_notas"] },
  { name: "Miembro", taxPercent: 10, perms: ["ver_tabla_impuestos"] }
];

const gId = id => document.getElementById(id).value.trim();
const mkEmail = (n,c) => `${n.replace(/\s+/g,'_')}@${c.replace(/\s+/g,'_')}.com`.toLowerCase();

window.toast = (msg,type='success') => {
  const container=document.getElementById('toast-container');
  const t=document.createElement('div');
  t.className=`toast ${type}`;
  t.innerText=msg;
  container.appendChild(t);
  setTimeout(()=>t.remove(),3000);
};

const hasPerm = p => {
  if(!state.dbUser||!state.dbUser.rankId) return false;
  const r = state.ranks.find(r=>r.id===state.dbUser.rankId);
  return r?r.permissions.includes(p):false;
};

window.nav = id => {
  document.querySelectorAll('.view').forEach(e => e.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
};

window.showPanel = id => {
  document.querySelectorAll('.panel').forEach(e=>e.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
};

window.createClan = async () => {
  const name=gId('c-clan-name'), inv=gId('c-invite-id'), nt=gId('c-nametag'), pass=gId('c-password');
  if(!name||!inv||!nt||!pass) return toast("Faltan datos","error");
  const q=query(collection(db,"clans"),where("inviteId","==",inv));
  const snap=await getDocs(q);
  if(!snap.empty) return toast("ID de invitación en uso","error");

  try {
    const clanRef = await addDoc(collection(db,"clans"),{name,inviteId:inv,createdAt:Date.now()});
    let founderRankId="";
    for(let i=0;i<defaults.length;i++){
      const rRef = await addDoc(collection(db,"ranks"),{clanId:clanRef.id,name:defaults[i].name,taxPercent:defaults[i].taxPercent,permissions:defaults[i].perms,order:i,active:true});
      if(i===0) founderRankId = rRef.id;
    }
    await addDoc(collection(db,"weeks"),{clanId:clanRef.id,weekId:1,closed:false});
    const email = mkEmail(nt,name);
    const { user } = await createUserWithEmailAndPassword(auth,email,pass);
    await setDoc(doc(db,"users",user.uid),{uid:user.uid,nametag:nt,clanId:clanRef.id,rankId:founderRankId,verified:true,email,createdAt:Date.now()});
    toast("Clan creado y usuario registrado");
  } catch(e){ toast(e.message,"error"); }
};

window.joinClan = async () => {
  const inv=gId('j-invite-id'), nt=gId('j-nametag'), pass=gId('j-password');
  if(!inv||!nt||!pass) return toast("Faltan datos","error");
  const q=query(collection(db,"clans"),where("inviteId","==",inv));
  const snap=await getDocs(q);
  if(snap.empty) return toast("Invitación inválida","error");
  const clanDoc=snap.docs[0], clanId=clanDoc.id, clanName=clanDoc.data().name;
  const email=mkEmail(nt,clanName);
  try {
    const rSnap = await getDocs(query(collection(db,"ranks"),where("clanId","==",clanId),where("name","==","Miembro")));
    const defaultRankId = rSnap.empty ? null : rSnap.docs[0].id;
    const { user } = await createUserWithEmailAndPassword(auth,email,pass);
    await setDoc(doc(db,"users",user.uid),{uid:user.uid,nametag:nt,clanId,rankId:defaultRankId,verified:false,email,createdAt:Date.now()});
    toast("Cuenta creada, esperando verificación");
  } catch(e){ toast(e.code==='auth/email-already-in-use'?"El Nametag ya existe":"Error al registrar","error"); }
};

window.login = async () => {
  const nt=gId('l-nametag'), clan=gId('l-clan'), pass=gId('l-password');
  if(!nt||!clan||!pass) return toast("Faltan datos","error");
  try { await signInWithEmailAndPassword(auth,mkEmail(nt,clan),pass); } 
  catch(e){ toast("Credenciales inválidas","error"); }
};

window.logout = () => signOut(auth);

onAuthStateChanged(auth, async u => {
  if(!u){ state.authUser=null; state.dbUser=null; return nav('v-home'); }
  state.authUser = u;
  const userSnap = await getDoc(doc(db,"users",u.uid));
  if(!userSnap.exists()) return logout();
  state.dbUser = userSnap.data();
  nav('v-dashboard');
});
window.showPanel = id => {
  document.querySelectorAll('.panel').forEach(e=>e.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
};

window.createClan = async () => {
  const name=gId('c-clan-name'), inv=gId('c-invite-id'), nt=gId('c-nametag'), pass=gId('c-password');
  if(!name||!inv||!nt||!pass) return toast("Faltan datos","error");
  const q=query(collection(db,"clans"),where("inviteId","==",inv));
  const snap=await getDocs(q);
  if(!snap.empty) return toast("ID de invitación en uso","error");

  try {
    const clanRef = await addDoc(collection(db,"clans"),{name,inviteId:inv,createdAt:Date.now()});
    let founderRankId="";
    for(let i=0;i<defaults.length;i++){
      const rRef = await addDoc(collection(db,"ranks"),{clanId:clanRef.id,name:defaults[i].name,taxPercent:defaults[i].taxPercent,permissions:defaults[i].perms,order:i,active:true});
      if(i===0) founderRankId = rRef.id;
    }
    await addDoc(collection(db,"weeks"),{clanId:clanRef.id,weekId:1,closed:false});
    const email = mkEmail(nt,name);
    const { user } = await createUserWithEmailAndPassword(auth,email,pass);
    await setDoc(doc(db,"users",user.uid),{uid:user.uid,nametag:nt,clanId:clanRef.id,rankId:founderRankId,verified:true,email,createdAt:Date.now()});
    toast("Clan creado y usuario registrado");
  } catch(e){ toast(e.message,"error"); }
};

window.joinClan = async () => {
  const inv=gId('j-invite-id'), nt=gId('j-nametag'), pass=gId('j-password');
  if(!inv||!nt||!pass) return toast("Faltan datos","error");
  const q=query(collection(db,"clans"),where("inviteId","==",inv));
  const snap=await getDocs(q);
  if(snap.empty) return toast("Invitación inválida","error");
  const clanDoc=snap.docs[0], clanId=clanDoc.id, clanName=clanDoc.data().name;
  const email=mkEmail(nt,clanName);
  try {
    const rSnap = await getDocs(query(collection(db,"ranks"),where("clanId","==",clanId),where("name","==","Miembro")));
    const defaultRankId = rSnap.empty ? null : rSnap.docs[0].id;
    const { user } = await createUserWithEmailAndPassword(auth,email,pass);
    await setDoc(doc(db,"users",user.uid),{uid:user.uid,nametag:nt,clanId,rankId:defaultRankId,verified:false,email,createdAt:Date.now()});
    toast("Cuenta creada, esperando verificación");
  } catch(e){ toast(e.code==='auth/email-already-in-use'?"El Nametag ya existe":"Error al registrar","error"); }
};

window.login = async () => {
  const nt=gId('l-nametag'), clan=gId('l-clan'), pass=gId('l-password');
  if(!nt||!clan||!pass) return toast("Faltan datos","error");
  try { await signInWithEmailAndPassword(auth,mkEmail(nt,clan),pass); } 
  catch(e){ toast("Credenciales inválidas","error"); }
};

window.logout = () => signOut(auth);

onAuthStateChanged(auth, async u => {
  if(!u){ state.authUser=null; state.dbUser=null; return nav('v-home'); }
  state.authUser = u;
  const userSnap = await getDoc(doc(db,"users",u.uid));
  if(!userSnap.exists()) return logout();
  state.dbUser = userSnap.data();
  nav('v-dashboard');
});
