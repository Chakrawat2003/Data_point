const C=window.APP_CONFIG;
const $=id=>document.getElementById(id);
const missing=keys=>keys.filter(k=>!C[k]||String(C[k]).includes("YOUR_"));
const dbConfigured=()=>missing(["SUPABASE_URL","SUPABASE_ANON_KEY"]).length===0;

const S={sb:null,ch:null,session:null,room:"",passcode:"",adding:false,pending:null,editing:null,markers:new Map(),all:[],savedRooms:[],_locMarker:null};

const toast=s=>{$("toast").textContent=s;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2800)};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const username=()=>S.session?.user?.user_metadata?.username||S.session?.user?.email?.split("@")[0]||"ผู้ใช้";

const map=L.map("map",{preferCanvas:true,zoomControl:false}).setView([13.7563,100.5018],6);
L.control.zoom({position:"bottomright"}).addTo(map);
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token="+encodeURIComponent(C.ESRI_API_KEY),{maxZoom:19,attribution:"Tiles © Esri"}).addTo(map);
const cluster=L.markerClusterGroup({chunkedLoading:true,maxClusterRadius:55,disableClusteringAtZoom:16}).addTo(map);

const COLORS=["#ef4444","#f97316","#eab308","#22c55e","#14b8a6","#3b82f6","#8b5cf6","#ec4899"];
const ICONS={pin:"📍",star:"⭐",heart:"❤️",flag:"🚩",home:"🏠",food:"🍜",shop:"🏪",hotel:"🏨",photo:"📷"};

function pinIcon(color,icon,imgData){
  const c=/^#[0-9a-fA-F]{6}$/.test(color)?color:COLORS[0];
  let html=icon==="photo"&&imgData
    ? `<img src="${esc(imgData)}" style="width:40px;height:40px;border-radius:50%;border:3px solid ${c};object-fit:cover;box-shadow:0 2px 6px #0004">`
    : `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 3px #0005)">${ICONS[icon]||"📍"}</div>`;
  return L.divIcon({className:"",html:`<div style="display:flex;flex-direction:column;align-items:center">${html}</div>`,iconSize:[40,40],iconAnchor:[20,36],popupAnchor:[0,-36]});
}

function marker(p){
  const m=L.marker([p.lat,p.lng],{icon:pinIcon(p.color,p.icon,p.icon_img)});
  m.on("click",()=>edit(p));
  m.bindPopup(`<div class="pin-title">${esc(p.title)}</div>
    <div>${esc(p.address||"")}</div>
    <div class="pin-note">${esc(p.note)}</div>
    <div class="pin-meta">ปักโดย ${esc(p.created_by||"ผู้ใช้")} · ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</div>`);
  S.markers.set(p.id,m);cluster.addLayer(m);
}

function updateCount(){$("pinCount").textContent=S.all.length.toLocaleString("th-TH")}
function rebuild(){
  cluster.clearLayers();S.markers.clear();
  const q=$("search").value.toLowerCase().trim();
  const filtered=S.all.filter(p=>!q||(p.title+" "+p.address+" "+p.note+" "+p.created_by).toLowerCase().includes(q));
  filtered.forEach(marker);updateCount();renderTable(filtered);
}
$("search").oninput=rebuild;

function renderTable(list){
  const body=$("tableBody");
  if(!list?.length){body.innerHTML=`<div style="padding:18px;color:#999;text-align:center">ยังไม่มีจุดในห้องนี้</div>`;return}
  body.innerHTML=list.map(p=>`<div class="tableRow" data-id="${p.id}">
    <span class="rowIcon">${p.icon==="photo"&&p.icon_img?`<img src="${esc(p.icon_img)}">`:(ICONS[p.icon]||"📍")}</span>
    <span class="rowDot" style="background:${esc(p.color||COLORS[0])}"></span>
    <div style="overflow:hidden;flex:1">
      <div class="rowTitle">${esc(p.title)}</div>
      <div class="rowSub">👤 ${esc(p.created_by||"ผู้ใช้")} · ${esc(p.address||p.note||"ไม่มีรายละเอียด")}</div>
    </div></div>`).join("");
  body.querySelectorAll(".tableRow").forEach(row=>row.onclick=()=>{
    const p=S.all.find(x=>String(x.id)===String(row.dataset.id));if(!p)return;
    map.setView([p.lat,p.lng],17);const m=S.markers.get(p.id);if(m)setTimeout(()=>m.openPopup(),250);
  });
}
$("tableToggle").onclick=()=>{$("tablePanel").classList.toggle("hidden");renderTable(S.all)};
$("tableClose").onclick=()=>$("tablePanel").classList.add("hidden");

(function(){
  const wrap=$("colorSwatches"),custom=$("colorCustom");
  COLORS.forEach(c=>{const b=document.createElement("button");b.type="button";b.className="swatch";b.style.background=c;b.dataset.c=c;b.onclick=()=>selectColor(c);wrap.insertBefore(b,custom)});
  custom.oninput=()=>selectColor(custom.value);
})();
function selectColor(c){
  $("color").value=c;$("colorSwatches").querySelectorAll(".swatch").forEach(b=>b.classList.toggle("active",b.dataset.c===c));
}
document.querySelectorAll(".iconBtn").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll(".iconBtn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");
  $("icon").value=btn.dataset.icon;$("imgUploadWrap").classList.toggle("hidden",btn.dataset.icon!=="photo");
  if(btn.dataset.icon!=="photo")$("iconImg").value="";
});
$("imgUpload").onchange=e=>{
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();reader.onload=ev=>{
    const img=new Image();img.onload=()=>{
      const canvas=document.createElement("canvas");canvas.width=100;canvas.height=100;
      const ctx=canvas.getContext("2d");const scale=Math.max(100/img.width,100/img.height);
      const w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(100-w)/2,(100-h)/2,w,h);
      $("iconImg").value=canvas.toDataURL("image/jpeg",.82);
    };img.src=ev.target.result;
  };reader.readAsDataURL(file);
};

function openModal(p=null,latlng=null){
  if(!S.session)return openAuth("เข้าสู่ระบบก่อนปักจุด");
  if(!S.room)return toast("เข้าห้องก่อน");
  S.editing=p;S.pending=latlng||{lat:p.lat,lng:p.lng};
  $("modalTitle").textContent=p?"แก้ไขจุด":"เพิ่มจุด";$("title").value=p?.title||"";
  $("address").value=p?.address||"";$("note").value=p?.note||"";selectColor(p?.color||COLORS[0]);
  const ic=p?.icon||"pin";$("icon").value=ic;$("iconImg").value=p?.icon_img||"";
  document.querySelectorAll(".iconBtn").forEach(b=>b.classList.toggle("active",b.dataset.icon===ic));
  $("imgUploadWrap").classList.toggle("hidden",ic!=="photo");
  $("coord").textContent=`พิกัด ${S.pending.lat.toFixed(6)}, ${S.pending.lng.toFixed(6)}`;
  $("delete").classList.toggle("hidden",!p);$("modal").classList.remove("hidden");$("title").focus();
}
function closeModal(){$("modal").classList.add("hidden");S.pending=null;S.editing=null}
$("close").onclick=$("cancel").onclick=closeModal;

$("save").onclick=async()=>{
  if(!S.sb||!S.pending||!S.session)return;
  const x={room:S.room,lat:S.pending.lat,lng:S.pending.lng,title:$("title").value.trim()||"จุดใหม่",
    address:$("address").value.trim(),note:$("note").value.trim(),color:$("color").value,icon:$("icon").value,icon_img:$("iconImg").value};
  let r;
  if(S.editing) r=await S.sb.from("pins").update(x).eq("id",S.editing.id);
  else {x.created_by=username();x.created_by_user_id=S.session.user.id;r=await S.sb.from("pins").insert(x);}
  if(r.error)toast("บันทึกไม่สำเร็จ: "+r.error.message);else{toast(S.editing?"แก้ไขแล้ว":"ปักจุดแล้ว");closeModal()}
};
$("delete").onclick=async()=>{
  if(!S.editing||!confirm("ลบจุดนี้ใช่ไหม?"))return;
  const r=await S.sb.from("pins").delete().eq("id",S.editing.id);
  if(r.error)toast("ลบไม่สำเร็จ: "+r.error.message);else{toast("ลบแล้ว");closeModal()}
};
function edit(p){openModal(p)}

$("add").onclick=()=>{
  if(!S.session)return openAuth("เข้าสู่ระบบก่อนใช้งาน");
  if(!S.room)return toast("เข้าห้องก่อน");
  S.adding=!S.adding;$("mode").classList.toggle("hidden",!S.adding);
  $("add").textContent=S.adding?"✕ ยกเลิกปัก":"＋ ปักจุดใหม่";map.getContainer().style.cursor=S.adding?"crosshair":"";
};
$("cancelMode").onclick=()=>$("add").click();
map.on("click",e=>{if(S.adding){S.adding=false;$("mode").classList.add("hidden");$("add").textContent="＋ ปักจุดใหม่";map.getContainer().style.cursor="";openModal(null,e.latlng)}});

function doLocate(){
  $("locateBtn").classList.add("locatePulse");setTimeout(()=>$("locateBtn").classList.remove("locatePulse"),800);
  map.locate({setView:true,maxZoom:17,enableHighAccuracy:true});
}
map.on("locationfound",e=>{
  if(S._locMarker)map.removeLayer(S._locMarker);
  S._locMarker=L.circleMarker(e.latlng,{radius:9,color:"#3b82f6",fillColor:"#3b82f6",fillOpacity:.8}).addTo(map).bindPopup("ตำแหน่งของฉัน").openPopup();
});
map.on("locationerror",()=>toast("ไม่สามารถระบุตำแหน่งได้ — กรุณาอนุญาต GPS"));
$("locate").onclick=doLocate;$("locateBtn").onclick=doLocate;

(function(){
  const el=$("sidebar"),btn=$("sidebarToggle");
  const apply=c=>{el.classList.toggle("collapsed",c);btn.textContent=c?"▶":"◀";btn.title=c?"ขยายเมนู":"พับเมนู"};
  apply(localStorage.getItem("pinmap-sidebar-collapsed")==="1");
  btn.onclick=()=>{const c=!el.classList.contains("collapsed");apply(c);localStorage.setItem("pinmap-sidebar-collapsed",c?"1":"0")};
})();

$("exportXlsx").onclick=()=>{
  if(!S.all.length)return toast("ยังไม่มีจุดให้ export");
  const rows=S.all.map(p=>({ห้อง:p.room,ชื่อจุด:p.title,ที่อยู่:p.address,รายละเอียด:p.note,ละติจูด:p.lat,ลองจิจูด:p.lng,สี:p.color,ไอคอน:p.icon,ปักโดย:p.created_by,เวลาที่ปัก:p.created_at}));
  const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"pins");
  XLSX.writeFile(wb,`pinmap-${S.room||"data"}.xlsx`);
};

$("share").onclick=async()=>{
  if(!S.room)return toast("เข้าห้องก่อน");
  const u=location.origin+location.pathname+"?room="+encodeURIComponent(S.room);
  try{await navigator.clipboard.writeText(u);toast("คัดลอกลิงก์แล้ว — รหัสห้องไม่ถูกใส่ในลิงก์")}
  catch{prompt("ลิงก์",u)}
};

async function loadSavedRooms(){
  if(!S.session){S.savedRooms=[];$("savedRooms").innerHTML="";return}
  const {data,error}=await S.sb.from("saved_rooms").select("id,room,label").order("created_at",{ascending:false});
  if(error){console.warn(error);return}
  S.savedRooms=data||[];renderSavedRooms();
}
function renderSavedRooms(){
  const el=$("savedRooms");
  if(!S.savedRooms.length){el.innerHTML=`<div class="savedEmpty">ยังไม่มีห้องที่บันทึก</div>`;return}
  el.innerHTML=S.savedRooms.map(r=>`<div class="savedRoom" data-id="${r.id}">
    <button class="savedOpen">🏠 <span>${esc(r.label||r.room)}</span><small>${esc(r.room)}</small></button>
    <button class="savedDelete" title="ลบจากรายการ">×</button></div>`).join("");
  el.querySelectorAll(".savedOpen").forEach(b=>b.onclick=async()=>{
    const r=S.savedRooms.find(x=>String(x.id)===String(b.parentElement.dataset.id));if(r)await enterSavedRoom(r);
  });
  el.querySelectorAll(".savedDelete").forEach(b=>b.onclick=async e=>{
    e.stopPropagation();const id=b.parentElement.dataset.id;
    const r=await S.sb.from("saved_rooms").delete().eq("id",id);if(r.error)toast(r.error.message);else loadSavedRooms();
  });
}
async function enterSavedRoom(r){
  const {data:ok,error}=await S.sb.rpc("room_enter_saved",{p_room:r.room});
  if(error||!ok){toast("ห้องนี้ไม่พร้อมใช้งานแล้ว");return}
  $("room").value=r.room;$("passcode").value="";await enterRoom(r.room,"",true);
}
$("saveRoom").onclick=async()=>{
  if(!S.session)return openAuth("เข้าสู่ระบบก่อน");
  if(!S.room)return toast("เข้าห้องก่อน");
  const label=prompt("ชื่อที่อยากให้แสดงในรายการห้อง",S.room);if(label===null)return;
  const {error}=await S.sb.from("saved_rooms").upsert({user_id:S.session.user.id,room:S.room,label:label.trim()||S.room},{onConflict:"user_id,room"});
  if(error)toast("บันทึกห้องไม่สำเร็จ: "+error.message);else{toast("บันทึกห้องแล้ว");loadSavedRooms()}
};

async function enterRoom(room,passcode,fromSaved=false){
  if(!S.session)return openAuth("เข้าสู่ระบบก่อนเข้าห้อง");
  if(!room)return toast("ใส่ชื่อห้องก่อน");
  if(!fromSaved&&!passcode)return toast("ใส่รหัสห้องก่อน");
  if(S.ch){await S.sb.removeChannel(S.ch);S.ch=null}
  S.room=room;S.passcode=passcode;
  if(!fromSaved){
    const {data:ok,error}=await S.sb.rpc("room_join",{p_room:room,p_passcode:passcode});
    if(error)return toast("เข้าห้องไม่สำเร็จ: "+error.message);
    if(!ok)return toast("❌ รหัสห้องไม่ถูกต้อง");
  }
  const {data,error}=await S.sb.from("pins").select("*").eq("room",room).order("created_at",{ascending:true});
  if(error)return toast("โหลดจุดไม่สำเร็จ: "+error.message);
  S.all=data||[];rebuild();toast("✅ เข้าห้อง "+room+" แล้ว");
  S.ch=S.sb.channel("pinmap:"+room)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"pins"},p=>{if(p.new.room===S.room&&!S.all.some(x=>x.id===p.new.id)){S.all.push(p.new);rebuild();toast("📍 มีจุดใหม่")}})
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"pins"},p=>{if(p.new.room===S.room){const i=S.all.findIndex(x=>x.id===p.new.id);if(i>=0){S.all[i]=p.new;rebuild()}}})
    .on("postgres_changes",{event:"DELETE",schema:"public",table:"pins"},p=>{if(S.all.some(x=>x.id===p.old.id)){S.all=S.all.filter(x=>x.id!==p.old.id);rebuild()}})
    .on("presence",{event:"sync"},()=>{$("onlineCount").textContent=Object.keys(S.ch.presenceState()).length})
    .subscribe(async st=>{if(st==="SUBSCRIBED"){await S.ch.track({name:username()});document.querySelector(".online").classList.add("ok")}});
}
$("join").onclick=()=>enterRoom($("room").value.trim(),$("passcode").value,false);

let authMode="login";
function openAuth(msg=""){authMode="login";$("authTitle").textContent="เข้าสู่ระบบ";$("authSubmit").textContent="เข้าสู่ระบบ";$("authSwitch").textContent="สร้างบัญชี";$("usernameWrap").classList.add("hidden");$("authMessage").textContent=msg;$("authModal").classList.remove("hidden")}
$("authClose").onclick=()=>{$("authModal").classList.add("hidden")};
$("authSwitch").onclick=()=>{
  authMode=authMode==="login"?"signup":"login";
  $("authTitle").textContent=authMode==="login"?"เข้าสู่ระบบ":"สร้างบัญชี";
  $("authSubmit").textContent=authMode==="login"?"เข้าสู่ระบบ":"สมัครสมาชิก";
  $("authSwitch").textContent=authMode==="login"?"สร้างบัญชี":"กลับไปเข้าสู่ระบบ";
  $("usernameWrap").classList.toggle("hidden",authMode==="login");
};
$("authSubmit").onclick=async()=>{
  if(!dbConfigured())return $("authMessage").textContent="ต้องใส่ SUPABASE_URL และ SUPABASE_ANON_KEY ใน config.js";
  const email=$("authEmail").value.trim(),password=$("authPassword").value,uname=$("authUsername").value.trim();
  if(!email||!password)return $("authMessage").textContent="กรอกอีเมลและรหัสผ่านให้ครบ";
  $("authSubmit").disabled=true;
  let result;
  if(authMode==="signup"){
    if(!uname)return $("authMessage").textContent="กรอกชื่อผู้ใช้ก่อน";
    result=await S.sb.auth.signUp({email,password,options:{data:{username:uname}}});
  }else result=await S.sb.auth.signInWithPassword({email,password});
  $("authSubmit").disabled=false;
  if(result.error)return $("authMessage").textContent=result.error.message;
  if(authMode==="signup"&&!result.data.session){$("authMessage").textContent="สมัครสำเร็จ — กรุณายืนยันอีเมล แล้วกลับมาเข้าสู่ระบบ";return}
  $("authMessage").textContent="สำเร็จ";
  $("authModal").classList.add("hidden");
};

$("profileBtn").onclick=()=>{
  if(!S.session)return openAuth();
  $("profileEmail").textContent=S.session.user.email||"";
  $("profileUsername").value=username();$("profileModal").classList.remove("hidden");
};
$("profileClose").onclick=()=>$("profileModal").classList.add("hidden");
$("profileSave").onclick=async()=>{
  const n=$("profileUsername").value.trim();if(!n)return toast("กรอกชื่อผู้ใช้");
  const {data,error}=await S.sb.auth.updateUser({data:{username:n}});
  if(error)return toast("เปลี่ยนชื่อไม่สำเร็จ: "+error.message);
  S.session=data.user?{...S.session,user:data.user}:S.session;
  $("userLabel").textContent=n;$("profileModal").classList.add("hidden");toast("เปลี่ยนชื่อแล้ว");
  if(S.ch)await S.ch.track({name:n});
};

$("logoutBtn").onclick=async()=>{
  if(!S.sb)return;
  if(S.ch){await S.sb.removeChannel(S.ch);S.ch=null}
  await S.sb.auth.signOut();S.session=null;S.all=[];S.room="";rebuild();
};

function applySession(session){
  S.session=session;
  const logged=!!session;
  $("userLabel").textContent=logged?username():"ยังไม่ได้เข้าสู่ระบบ";
  $("profileBtn").textContent=logged?"โปรไฟล์":"เข้าสู่ระบบ";
  $("logoutBtn").classList.toggle("hidden",!logged);
  $("saveRoom").disabled=!logged;
  if(!logged){S.room="";S.all=[];rebuild();$("savedRooms").innerHTML="";return}
  loadSavedRooms();
}

async function init(){
  if(!dbConfigured()){openAuth("ต้องตั้งค่า Supabase ใน config.js ก่อน");return}
  S.sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
  const {data}=await S.sb.auth.getSession();applySession(data.session);
  S.sb.auth.onAuthStateChange(async(_event,session)=>{
    applySession(session);
    if(session && _event==="SIGNED_IN"){
      $("authModal").classList.add("hidden");
      const room=new URLSearchParams(location.search).get("room")||localStorage.getItem("pinmap-last-room");
      if(room){$("room").value=room}
    }
  });
  const room=new URLSearchParams(location.search).get("room")||localStorage.getItem("pinmap-last-room")||"friends";
  $("room").value=room;
  if(data.session){
    const saved=localStorage.getItem("pinmap-last-room");
    if(saved) $("room").value=saved;
  }else openAuth();
}
init();
