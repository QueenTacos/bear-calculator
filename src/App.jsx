import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ── Storage helpers — drop-in replacement for window.storage ──

export const stor = {
  // Get a player profile
  async getPlayer(gamerID) {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('gamer_id', gamerID.toLowerCase())
      .single()
    if (error) return null
    return data?.profile_data ?? null
  },

  // Save/upsert a player profile
  async setPlayer(gamerID, profileData) {
    const { error } = await supabase
      .from('players')
      .upsert({
        gamer_id: gamerID.toLowerCase(),
        profile_data: profileData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'gamer_id' })
    if (error) console.error('setPlayer error:', error)
  },

  // Get all player IDs
  async getPlayerIndex() {
    const { data, error } = await supabase
      .from('players')
      .select('gamer_id')
    if (error) return []
    return data.map(r => r.gamer_id)
  },

  // Get all player profiles (for admin)
  async getAllPlayers() {
    const { data, error } = await supabase
      .from('players')
      .select('gamer_id, profile_data, updated_at')
      .order('updated_at', { ascending: false })
    if (error) return []
    return data.map(r => r.profile_data).filter(Boolean)
  },

  // Get a hero image (shared across all players)
  async getHeroImage(heroId) {
    const { data, error } = await supabase
      .from('hero_images')
      .select('image_data')
      .eq('hero_id', heroId)
      .single()
    if (error) return null
    return data?.image_data ?? null
  },

  // Save a hero image (shared)
  async setHeroImage(heroId, imageData) {
    const { error } = await supabase
      .from('hero_images')
      .upsert({
        hero_id: heroId,
        image_data: imageData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'hero_id' })
    if (error) console.error('setHeroImage error:', error)
  },

  // Load all hero images at once (batch)
  async getAllHeroImages() {
    const { data, error } = await supabase
      .from('hero_images')
      .select('hero_id, image_data')
    if (error) return {}
    return Object.fromEntries(data.map(r => [r.hero_id, r.image_data]))
  },
}

import { useState, useEffect, useMemo, useCallback } from "react";

// ── CONFIG ────────────────────────────────────────────────────
const ADMIN_ID   = "yumqueentacos@gmail.com";
const ALLIANCE   = "SYP";
const ADMIN_NAME = "Queen Tacos";

// ── IMAGE COMPRESSION (canvas-based, works in real browser) ─
async function compressToBase64(file, maxPx=96, quality=0.75) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      // Fallback to FileReader if canvas fails
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    };
    img.src = url;
  });
}

// ── HERO DATA ─────────────────────────────────────────────────
const GRP = {
  epic:{label:'Epic',bg:'#0a1f40',border:'#1e5a9a',accent:'#4a9adf'},
  rare:{label:'Rare',bg:'#1a0a3a',border:'#5a2a9a',accent:'#9a5adf'},
  s1:{label:'S1',bg:'#3a1400',border:'#cc5500',accent:'#ff7a20'},
  s2:{label:'S2',bg:'#3a1400',border:'#cc5500',accent:'#ff7a20'},
  s3:{label:'S3',bg:'#3a1400',border:'#cc5500',accent:'#ff8a30'},
  s4:{label:'S4',bg:'#3a1400',border:'#cc5500',accent:'#ff8a30'},
  s5:{label:'S5',bg:'#3a1600',border:'#bb5500',accent:'#ff9a40'},
  s6:{label:'S6',bg:'#361300',border:'#aa4a00',accent:'#dd7020'},
  s7:{label:'S7',bg:'#361300',border:'#aa4a00',accent:'#dd7020'},
  s8:{label:'S8',bg:'#361300',border:'#aa4a00',accent:'#dd7020'},
  s9:{label:'S9',bg:'#361300',border:'#aa4a00',accent:'#dd7020'},
  s10:{label:'S10',bg:'#200a30',border:'#7a2a9a',accent:'#bf4adf'},
  s11:{label:'S11',bg:'#200a30',border:'#7a2a9a',accent:'#bf4adf'},
  s12:{label:'S12',bg:'#200a30',border:'#7a2a9a',accent:'#bf4adf'},
  s13:{label:'S13',bg:'#150a35',border:'#5a2aaa',accent:'#9a5aff'},
  s14:{label:'S14',bg:'#150a35',border:'#5a2aaa',accent:'#9a5aff'},
  s15:{label:'S15',bg:'#150a35',border:'#5a2aaa',accent:'#9a5aff'},
  s16:{label:'S16',bg:'#150a35',border:'#5a2aaa',accent:'#9a5aff'},
  s17:{label:'S17',bg:'#150a35',border:'#5a2aaa',accent:'#9a5aff'},
};
const HEROES=[
  {id:'smith',name:'Smith',g:'epic',role:'slot3_cap'},
  {id:'eugene',name:'Eugene',g:'epic',role:'slot3_cap'},
  {id:'charlie',name:'Charlie',g:'epic',role:'slot3_cap'},
  {id:'cloris',name:'Cloris',g:'epic',role:'slot3_cap'},
  {id:'sergey',name:'Sergey',g:'rare',role:'join23'},
  {id:'jessie',name:'Jessie',g:'rare',role:'join_s1',jp:1},
  {id:'patrick',name:'Patrick',g:'rare',role:'slot3_cap'},
  {id:'lumak',name:'Lumak Bokan',g:'rare',role:'join23'},
  {id:'ling_xue',name:'Ling Xue',g:'rare',role:'slot3_cap'},
  {id:'gina',name:'Gina',g:'rare',role:'slot3_cap'},
  {id:'bahiti',name:'Bahiti',g:'rare',role:'rally_s3',r3p:1},
  {id:'jasser',name:'Jasser',g:'rare',role:'join_s1',jp:2},
  {id:'seo_yoon',name:'Seo-yoon',g:'rare',role:'join_s1',jp:3},
  {id:'natalia',name:'Natalia',g:'s1',role:'slot3_cap'},
  {id:'jeronimo',name:'Jeronimo',g:'s1',role:'rally_s1',r1p:1,minS:3},
  {id:'molly',name:'Molly',g:'s1',role:'rally_s2',r2p:1},
  {id:'zinman',name:'Zinman',g:'s1',role:'slot3_cap'},
  {id:'flint',name:'Flint',g:'s2',role:'rally_s1',r1p:2},
  {id:'philly',name:'Philly',g:'s2',role:'join_s1',jp:4},
  {id:'alonso',name:'Alonso',g:'s2',role:'rally_s3',r3p:2},
  {id:'logan',name:'Logan',g:'s3',role:'join23'},
  {id:'mia',name:'Mia',g:'s3',role:'rally_s2',r2p:2,minS:3,maxedBest:true},
  {id:'greg_s3',name:'Greg',g:'s3',role:'join23'},
  {id:'ahmose',name:'Ahmose',g:'s4',role:'join23'},
  {id:'reina',name:'Reina',g:'s4',role:'rally_s2',r2p:3,minS:4},
  {id:'lynn',name:'Lynn',g:'s4',role:'rally_s3',r3p:3,minS:4},
  {id:'hector',name:'Hector',g:'s5',role:'rally_s1',r1p:3},
  {id:'norah',name:'Norah',g:'s5',role:'join23'},
  {id:'gwen',name:'Gwen',g:'s5',role:'rally_s3',r3p:4,minS:3},
  {id:'wu_ming',name:'Wu Ming',g:'s6',role:'join23'},
  {id:'renee',name:'Renee',g:'s6',role:'rally_s2',r2p:4},
  {id:'wayne',name:'Wayne',g:'s6',role:'rally_s3',r3p:5},
  {id:'edith',name:'Edith',g:'s7',role:'join23'},
  {id:'gordon',name:'Gordon',g:'s7',role:'join23'},
  {id:'bradley',name:'Bradley',g:'s7',role:'rally_s3',r3p:6},
  {id:'gatot',name:'Gatot',g:'s8',role:'join23'},
  {id:'sonya',name:'Sonya',g:'s8',role:'rally_s2',r2p:5},
  {id:'hendrik',name:'Hendrik',g:'s8',role:'join23'},
  {id:'magnus',name:'Magnus',g:'s9',role:'rally_s1',r1p:4},
  {id:'fred',name:'Fred',g:'s9',role:'join23'},
  {id:'xura',name:'Xura',g:'s9',role:'join23'},
  {id:'gregory',name:'Gregory',g:'s10',role:'rally_s1',r1p:5},
  {id:'freya',name:'Freya',g:'s10',role:'join23'},
  {id:'blanchette',name:'Blanchette',g:'s10',role:'rally_s3',r3p:7},
  {id:'eleonora',name:'Eleonora',g:'s11',role:'join23'},
  {id:'lloyd',name:'Lloyd',g:'s11',role:'join23'},
  {id:'rufus',name:'Rufus',g:'s11',role:'rally_s3',r3p:8},
  {id:'hervor',name:'Hervor',g:'s12',role:'join23'},
  {id:'karol',name:'Karol',g:'s12',role:'join23'},
  {id:'ligeia',name:'Ligeia',g:'s12',role:'rally_s3',r3p:9},
  {id:'gisela',name:'Gisela',g:'s13',role:'join23'},
  {id:'flora',name:'Flora',g:'s13',role:'join23'},
  {id:'vulcanus',name:'Vulcanus',g:'s13',role:'join23'},
  {id:'elif',name:'Elif',g:'s14',role:'join23'},
  {id:'dominic',name:'Dominic',g:'s14',role:'join23'},
  {id:'cara',name:'Cara',g:'s14',role:'join23'},
  {id:'hank',name:'Hank',g:'s15',role:'join23'},
  {id:'estrella',name:'Estrella',g:'s15',role:'join23'},
  {id:'viveca',name:'Viveca',g:'s15',role:'join23'},
  {id:'seigel',name:'Seigel',g:'s16',role:'join23'},
  {id:'ursar',name:'Ursar',g:'s16',role:'join23'},
  {id:'aisling',name:'Aisling',g:'s16',role:'join23'},
  {id:'aiden',name:'Aiden',g:'s17',role:'join23'},
  {id:'bertha',name:'Bertha',g:'s17',role:'join23'},
  {id:'eleanor',name:'Eleanor',g:'s17',role:'join23'},
];
const HMAP=Object.fromEntries(HEROES.map(h=>[h.id,h]));
const GO=['epic','rare','s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11','s12','s13','s14','s15','s16','s17'];

// ── TROOP TIERS ───────────────────────────────────────────────
const TIERS=[
  {id:'t1', label:'T1 · Rookie',  short:'T1',  mult:1,    color:'#9ca3af',fc:false},
  {id:'t2', label:'T2 · Trained', short:'T2',  mult:3,    color:'#60a5fa',fc:false},
  {id:'t3', label:'T3 · Senior',  short:'T3',  mult:7,    color:'#34d399',fc:false},
  {id:'t4', label:'T4 · Veteran', short:'T4',  mult:14,   color:'#a3e635',fc:false},
  {id:'t5', label:'T5 · Hardy',   short:'T5',  mult:25,   color:'#fbbf24',fc:false},
  {id:'t6', label:'T6 · Heroic',  short:'T6',  mult:42,   color:'#fb923c',fc:false},
  {id:'t7', label:'T7 · Brave',   short:'T7',  mult:65,   color:'#f87171',fc:false},
  {id:'t8', label:'T8 · Elite',   short:'T8',  mult:95,   color:'#a78bfa',fc:false},
  {id:'t9', label:'T9 · Supreme', short:'T9',  mult:135,  color:'#e879f9',fc:false},
  {id:'t10',label:'T10 · Apex',   short:'T10', mult:185,  color:'#fde68a',fc:false},
  {id:'fc1', label:'FC1',         short:'FC1', mult:250,  color:'#fef08a',fc:true},
  {id:'fc2', label:'FC2',         short:'FC2', mult:330,  color:'#fde047',fc:true},
  {id:'fc3', label:'FC3',         short:'FC3', mult:425,  color:'#facc15',fc:true},
  {id:'fc4', label:'FC4',         short:'FC4', mult:535,  color:'#f59e0b',fc:true},
  {id:'fc5', label:'FC5',         short:'FC5', mult:660,  color:'#f97316',fc:true},
  {id:'fc6', label:'FC6',         short:'FC6', mult:800,  color:'#ef4444',fc:true},
  {id:'fc7', label:'FC7',         short:'FC7', mult:960,  color:'#dc2626',fc:true},
  {id:'fc8', label:'FC8',         short:'FC8', mult:1140, color:'#c026d3',fc:true},
  {id:'fc9', label:'FC9',         short:'FC9', mult:1340, color:'#a855f7',fc:true},
  {id:'fc10',label:'FC10',        short:'FC10',mult:1560, color:'#818cf8',fc:true},
];

// ── UTILITIES ─────────────────────────────────────────────────
const initTroops=()=>Object.fromEntries(TIERS.map(t=>[t.id,'']));
const initHS=()=>Object.fromEntries(HEROES.map(h=>[h.id,{owned:false,stars:0}]));
const ni=v=>parseInt(v)||0;
const fmt=v=>v>0?Number(v).toLocaleString():'0';
const ini=name=>name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const fmtPower=v=>v>=1e6?`${(v/1e6).toFixed(1)}M`:v>=1e3?`${(v/1e3).toFixed(0)}K`:`${v}`;

function hashPin(gid,pin){
  const s=gid.toLowerCase()+':'+pin;
  let h=5381;
  for(let i=0;i<s.length;i++)h=((h<<5)+h)+s.charCodeAt(i)|0;
  return Math.abs(h).toString(16);
}

function calcTroopPower(inf,lan,mark){
  let p=0;
  for(const t of TIERS)p+=((ni(inf[t.id]))+(ni(lan[t.id]))+(ni(mark[t.id])))*t.mult;
  return Math.round(p);
}

function calcHeroScore(hs){
  if(!hs)return 0;
  const o=id=>hs[id]?.owned,s=id=>hs[id]?.stars??0;
  let sc=0;
  if(o('jeronimo')&&s('jeronimo')>=3)sc+=100;else if(o('hector'))sc+=70;else if(o('magnus'))sc+=50;else if(o('gregory'))sc+=35;
  if(o('mia')&&s('mia')>=5)sc+=100;else if(o('molly'))sc+=80;else if(o('mia')&&s('mia')>=3)sc+=65;else if(o('reina')&&s('reina')>=4)sc+=55;else if(o('sonya'))sc+=40;
  const s3=['ligeia','rufus','blanchette','bradley','wayne','gwen','lynn','alonso','bahiti'];
  for(let i=0;i<s3.length;i++){const id=s3[i],ms=id==='gwen'?3:id==='lynn'?4:0;if(o(id)&&s(id)>=ms){sc+=(s3.length-i)*12;break;}}
  return sc;
}

// Hero assignment rules:
// Slot 1: STRICT — only approved heroes per slot type, or empty
// Slot 2: any owned hero that is NOT a slot3_cap-only hero
// Slot 3: any owned hero (slot3_cap heroes only allowed here)
// Each hero used only once across all squads
function recommendAll(states,isRally,joinCount){
  const o=id=>states[id]?.owned,s=id=>states[id]?.stars??0;
  const used=new Set();

  // Heroes that can NEVER go in slot 1 or 2
  const capOnly=new Set(HEROES.filter(h=>h.role==='slot3_cap').map(h=>h.id));

  const pick=(candidates)=>{
    for(const{id,minS=0}of candidates){
      if(o(id)&&s(id)>=minS&&!used.has(id)){used.add(id);return id;}
    }
    return null;
  };

  // Dynamic pools — re-evaluated each call to respect current used set
  const flexPool=()=>HEROES.filter(h=>!capOnly.has(h.id)&&o(h.id)&&!used.has(h.id)).map(h=>({id:h.id}));
  const anyPool =()=>HEROES.filter(h=>o(h.id)&&!used.has(h.id)).map(h=>({id:h.id}));

  // ── Rally Lead — first pick across the whole pool ───────────
  const rally={s1:null,s2:null,s3:null};
  if(isRally){
    // Slot 1: approved infantry heroes only — empty if none available
    rally.s1=pick([{id:'jeronimo',minS:3},{id:'hector'},{id:'magnus'},{id:'gregory'}]);
    // If slot 1 is empty, no heroes at all for this squad
    if(rally.s1){
      // Slot 2: preferred lancer heroes first, then any non-capOnly hero
      if(o('mia')&&s('mia')>=5&&!used.has('mia')){rally.s2='mia';used.add('mia');}
      else{
        rally.s2=pick([{id:'molly'},{id:'mia',minS:3},{id:'reina',minS:4},{id:'sonya'},{id:'reina'}]);
        if(!rally.s2)rally.s2=pick(flexPool());
      }
      // Slot 3: preferred capacity heroes, then any remaining hero
      rally.s3=pick([{id:'ligeia'},{id:'rufus'},{id:'blanchette'},{id:'bradley'},{id:'wayne'},{id:'gwen',minS:3},{id:'lynn',minS:4},{id:'alonso'},{id:'bahiti'}]);
      if(!rally.s3)rally.s3=pick(anyPool());
    }
  }

  // ── Join Squads — strict slot 1, open slots 2 & 3 ──────────
  const joinS1Approved=[{id:'jessie'},{id:'jasser'},{id:'seo_yoon'},{id:'philly'}];

  // Epic/cap-only IDs — avoid in joins 1-3 (only use in joins 4-6)
  const epicIds=new Set(HEROES.filter(h=>GRP[h.g]&&h.g==='epic').map(h=>h.id));
  // Pool for slot 3 of joins 1-3: exclude epics (save them for later joins)
  const nonEpicAnyPool=()=>HEROES.filter(h=>!epicIds.has(h.id)&&o(h.id)&&!used.has(h.id)).map(h=>({id:h.id}));

  const joins=[];
  for(let i=0;i<joinCount;i++){
    // Slot 1: approved join heroes only — empty if pool exhausted
    const s1=pick(joinS1Approved);
    // If slot 1 is empty, no heroes for this squad at all
    const s2=s1?pick(flexPool()):null;
    // Joins 1-3: avoid epic heroes in slot 3 if possible; joins 4-6: open pool
    const s3pool=s1?(i<3?nonEpicAnyPool():anyPool()):null;
    const s3=s3pool?pick(s3pool):null;
    joins.push({s1,s2,s3});
  }

  return{rally,joins};
}

// Legacy wrapper used by admin panel scoring
function recommend(states,isRally){
  const r=recommendAll(states,isRally,1);
  return{rally:r.rally,join:r.joins[0]??{s1:null,s2:null,s3:null}};
}


// ── SQUAD DISTRIBUTION CALCULATOR (OPTIMIZED) ───────────────
// Rules:
//   Rally:  5% inf / 5% lan / 90% mark (target)
//   Join A: 10% inf / 10% lan / 80% mark (target)
//   Join B: 20% inf / 20% lan / 60% mark (target)
// Optimizations:
//   1. Maximize march capacity — fill remaining cap with inf then lan
//   2. If joins are short on marksmen, pull from rally marksmen pool
//   3. Never exceed total available troops or march capacity
function calcDistribution(inf,lan,mark,marchCap,isRally,joinCount,joinRatioKey){
  const tI=TIERS.reduce((s,t)=>s+ni(inf[t.id]),0);
  const tL=TIERS.reduce((s,t)=>s+ni(lan[t.id]),0);
  const tM=TIERS.reduce((s,t)=>s+ni(mark[t.id]),0);
  const cap=ni(marchCap);
  const totalSquads=(isRally?1:0)+joinCount;
  if(totalSquads===0)return{rally:null,joins:[],tI,tL,tM,cap,totalUsed:0,totalAvail:tI+tL+tM,efficiency:0};

  const JR=joinRatioKey==='B'?{i:0.20,l:0.20,m:0.60}:{i:0.10,l:0.10,m:0.80};

  // Helper: fill a squad to cap using given ratio, then top up with inf/lan
  function fillSquad(avI,avL,avM,ratio,squadCap){
    // Target amounts from ratio
    let tgt=squadCap>0?Math.min(squadCap,avI+avL+avM):avI+avL+avM;
    let sI=Math.min(Math.floor(tgt*ratio.i),avI);
    let sL=Math.min(Math.floor(tgt*ratio.l),avL);
    let sM=Math.min(Math.floor(tgt*ratio.m),avM);
    let used_total=sI+sL+sM;
    // Fill remaining capacity with inf first, then lan
    if(squadCap>0&&used_total<squadCap){
      const remCap=squadCap-used_total;
      const addI=Math.min(remCap,avI-sI);
      sI+=addI; used_total+=addI;
    }
    if(squadCap>0&&used_total<squadCap){
      const remCap=squadCap-used_total;
      const addL=Math.min(remCap,avL-sL);
      sL+=addL; used_total+=addL;
    }
    // If still under cap add remaining marksmen
    if(squadCap>0&&used_total<squadCap){
      const remCap=squadCap-used_total;
      const addM=Math.min(remCap,avM-sM);
      sM+=addM; used_total+=addM;
    }
    const total=sI+sL+sM;
    return{inf:sI,lan:sL,mark:sM,total,fillPct:squadCap>0?Math.round(total/squadCap*100):0};
  }

  // ── Step 1: Calculate what joins need for marksmen ────────────
  // Evenly split available troops across joins (reserve rally share first)
  const rallyMarkReserve=isRally&&cap>0?Math.min(Math.floor(tM*0.90),Math.floor(cap*0.90)):0;
  const joinMarkAvail=tM-rallyMarkReserve;
  const markPerJoin=joinCount>0?Math.floor(joinMarkAvail/joinCount):0;

  // Check if joins can fill their marksmen target
  const joinMarkTarget=cap>0?Math.floor(cap*JR.m):markPerJoin;
  const joinsNeedMore=joinCount>0&&markPerJoin<joinMarkTarget;

  // If joins are short on marksmen, reduce rally's marksmen to give joins more
  let rallyMarkBudget=rallyMarkReserve;
  if(isRally&&joinsNeedMore){
    const joinDeficit=(joinMarkTarget-markPerJoin)*joinCount;
    const transfer=Math.min(joinDeficit,Math.floor(rallyMarkReserve*0.40)); // give up to 40% of rally mark
    rallyMarkBudget=rallyMarkReserve-transfer;
  }

  // ── Step 2: Assign rally ──────────────────────────────────────
  let remI=tI,remL=tL,remM=tM,rallyOut=null;
  if(isRally&&cap>0){
    const rRatio={i:0.05,l:0.05,m:rallyMarkBudget/(cap||1)};
    // Clamp ratio so it doesn't exceed available
    rallyOut=fillSquad(remI,remL,Math.min(remM,rallyMarkBudget),{i:0.05,l:0.05,m:0.90},cap);
    remI-=rallyOut.inf; remL-=rallyOut.lan; remM-=rallyOut.mark;
  }

  // ── Step 3: Split remaining evenly across joins ───────────────
  const joins=[];
  if(joinCount>0){
    const pI=Math.floor(remI/joinCount);
    const pL=Math.floor(remL/joinCount);
    const pM=Math.floor(remM/joinCount);
    for(let i=0;i<joinCount;i++){
      // Last join gets any leftover from rounding
      const isLast=i===joinCount-1;
      const avI=isLast?remI-(pI*(joinCount-1)):pI;
      const avL=isLast?remL-(pL*(joinCount-1)):pL;
      const avM=isLast?remM-(pM*(joinCount-1)):pM;
      joins.push(fillSquad(avI,avL,avM,JR,cap>0?cap:avI+avL+avM));
    }
  }

  const totalUsed=(rallyOut?.total||0)+joins.reduce((s,j)=>s+j.total,0);
  const totalAvail=tI+tL+tM;
  return{rally:rallyOut,joins,tI,tL,tM,cap,totalUsed,totalAvail,
    efficiency:totalAvail>0?Math.round(totalUsed/totalAvail*100):0};
}

// ── SQUAD RESULT CARD ─────────────────────────────────────────
function SquadCard({isRally,num,slotHeroes,dist,heroStates,heroImages}){
  if(!dist)return null;
  const ac=isRally?'#f59e0b':'#7c3aed';
  const typePct=v=>dist.total>0?Math.round(v/dist.total*100):0;
  return(
    <div style={{background:isRally?'linear-gradient(145deg,#1e1200,#120c00)':'linear-gradient(145deg,#13092a,#0f0620)',
      border:`1.5px solid ${isRally?'#f59e0b55':'#3d1f60'}`,borderRadius:14,padding:'16px',marginBottom:12,
      boxShadow:`0 2px 16px ${ac}15`}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <span style={{background:`linear-gradient(135deg,${ac},${ac}99)`,borderRadius:99,
          padding:'3px 12px',fontSize:10,fontWeight:900,color:isRally?'#1a0800':'#f0e6ff'}}>
          {isRally?'🐻 RALLY SQUAD':`🔵 JOIN ${num}`}
        </span>
        {dist.fillPct>0&&<span style={{fontSize:11,color:ac,fontWeight:800,marginLeft:'auto'}}>
          {dist.fillPct}% capacity
        </span>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
        <MiniHero heroId={slotHeroes?.s1} heroStates={heroStates} heroImages={heroImages} label={isRally?'⚔ S1·Inf':'⚔ S1'}/>
        <MiniHero heroId={slotHeroes?.s2} heroStates={heroStates} heroImages={heroImages} label={isRally?'🏇 S2·Lan':'🏇 S2'}/>
        <MiniHero heroId={slotHeroes?.s3} heroStates={heroStates} heroImages={heroImages} label={isRally?'🎯 S3·Cap':'🎯 S3'}/>
      </div>
      {[{l:'Infantry',v:dist.inf,c:'#c084fc'},{l:'Lancer',v:dist.lan,c:'#e879f9'},{l:'Marksman',v:dist.mark,c:'#fb923c'}].map(({l,v,c})=>{
        const p=typePct(v);
        return(
          <div key={l} style={{marginBottom:7}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:c,display:'inline-block'}}/>
                <span style={{fontSize:10,color:'#9d78c0'}}>{l}</span>
              </div>
              <div style={{display:'flex',gap:8}}>
                <span style={{fontSize:10,color:c,fontWeight:700}}>{fmt(v)}</span>
                <span style={{fontSize:9,color:'#6d4a90',minWidth:30,textAlign:'right'}}>{p}%</span>
              </div>
            </div>
            <div style={{background:'#0a0615',borderRadius:99,height:5,overflow:'hidden'}}>
              <div style={{width:`${p}%`,height:'100%',background:c,borderRadius:99}}/>
            </div>
          </div>
        );
      })}
      <div style={{marginTop:10,paddingTop:8,borderTop:`1px solid ${isRally?'#f59e0b33':'#2d1a4a'}`,
        display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:10,color:'#7c5fa0'}}>Total Troops</span>
        <div style={{display:'flex',gap:8,alignItems:'baseline'}}>
          <span style={{fontSize:16,fontWeight:900,color:'#f0e6ff'}}>{fmt(dist.total)}</span>
          {dist.fillPct>0&&<span style={{fontSize:9,color:'#6d4a90'}}>/ {fmt(dist.total>0&&dist.fillPct>0?Math.round(dist.total/dist.fillPct*100):0)} cap</span>}
        </div>
      </div>
      {dist.fillPct>0&&(
        <div style={{marginTop:5,background:'#0a0615',borderRadius:99,height:4,overflow:'hidden'}}>
          <div style={{width:`${Math.min(100,dist.fillPct)}%`,height:'100%',
            background:`linear-gradient(90deg,${ac}88,${ac})`,borderRadius:99}}/>
        </div>
      )}
    </div>
  );
}

// ── STORAGE ───────────────────────────────────────────────────


// ── MINI COMPONENTS ───────────────────────────────────────────
function Stars({val,onChange,color='#fbbf24',size=13}){
  return(
    <div style={{display:'flex',gap:1}} onClick={e=>e.stopPropagation()}>
      {[1,2,3,4,5].map(n=>(
        <span key={n} onClick={()=>onChange&&onChange(n===val?n-1:n)}
          style={{fontSize:size,cursor:onChange?'pointer':'default',color:n<=val?color:'#3d2060',lineHeight:1}}>
          {n<=val?'★':'☆'}
        </span>
      ))}
    </div>
  );
}

function CB({checked,onChange,label,accent='#a855f7',small}){
  return(
    <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',userSelect:'none',
      padding:small?'7px 10px':'10px 14px',
      background:checked?`${accent}18`:'#0d0920',
      border:`1.5px solid ${checked?accent:'#2d1a4a'}`,borderRadius:10,transition:'all .2s'}}>
      <div style={{width:16,height:16,borderRadius:4,flexShrink:0,
        border:`2px solid ${checked?accent:'#4a2a7a'}`,background:checked?accent:'transparent',
        display:'flex',alignItems:'center',justifyContent:'center'}}>
        {checked&&<svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>}
      </div>
      <span style={{fontSize:small?11:13,color:checked?'#f0e6ff':'#9d78c0',fontWeight:checked?600:400}}>{label}</span>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} style={{display:'none'}}/>
    </label>
  );
}

function Btn({children,onClick,color='#7c3aed',outline,small,full,disabled}){
  return(
    <button onClick={onClick} disabled={disabled} style={{
      background:outline?'transparent':`linear-gradient(135deg,${color},${color}dd)`,
      border:`1.5px solid ${color}`,borderRadius:9,cursor:disabled?'not-allowed':'pointer',
      color:outline?color:'#fff',fontSize:small?11:13,fontWeight:700,
      padding:small?'6px 14px':'10px 20px',fontFamily:'inherit',
      width:full?'100%':'auto',opacity:disabled?0.5:1,transition:'all .2s',
    }}>{children}</button>
  );
}

// ── HERO CARD (compact) ───────────────────────────────────────
function HeroCard({hero,state,imgSrc,onToggle,onStars,onUpload}){
  const g=GRP[hero.g],owned=state?.owned??false,stars=state?.stars??0;
  const roleLabel={rally_s1:'⚔',rally_s2:'🏇',rally_s3:'🎯',join_s1:'🔵',join23:'🔵',slot3_cap:'📦'}[hero.role]??'';
  const handleFile=async e=>{const f=e.target.files[0];if(!f)return;const data=await compressToBase64(f);onUpload(hero.id,data);};
  return(
    <div style={{background:owned?g.bg:'#0a0615',border:`1.5px solid ${owned?g.border:'#1d0d30'}`,
      borderRadius:10,padding:'8px 6px',display:'flex',flexDirection:'column',alignItems:'center',
      gap:4,userSelect:'none',transition:'all .2s',opacity:owned?1:0.4,position:'relative',
      boxShadow:owned?`0 2px 8px ${g.accent}22`:'none'}}>
      <div onClick={()=>onToggle(hero.id)} style={{width:52,height:52,borderRadius:9,overflow:'hidden',
        border:`2px solid ${owned?g.accent:'#2d1040'}`,cursor:'pointer',flexShrink:0,
        background:`linear-gradient(135deg,${g.bg},${g.accent}55)`,
        display:'flex',alignItems:'center',justifyContent:'center'}}>
        {imgSrc?<img src={imgSrc} alt={hero.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          :<span style={{fontSize:13,fontWeight:900,color:owned?g.accent:'#3d2060'}}>{ini(hero.name)}</span>}
      </div>
      {onUpload&&<label onClick={e=>e.stopPropagation()} style={{position:'absolute',top:3,right:3,
        width:18,height:18,borderRadius:4,background:imgSrc?`${g.accent}dd`:'#2d1a4a',
        cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10}}>
        📷<input type="file" accept="image/*" onChange={handleFile} style={{position:'absolute',opacity:0,width:'100%',height:'100%',cursor:'pointer',top:0,left:0}}/>
      </label>}
      <div onClick={()=>onToggle&&onToggle(hero.id)} style={{fontSize:9,fontWeight:700,
        color:owned?'#f0e6ff':'#4d2a70',textAlign:'center',lineHeight:1.2,maxWidth:78,cursor:'pointer'}}>
        {hero.name}
      </div>
      <div style={{display:'flex',gap:2}}>
        <span style={{fontSize:7,color:owned?g.accent:'#3d2060',background:owned?`${g.accent}22`:'#0d0920',borderRadius:3,padding:'1px 3px',fontWeight:700}}>{g.label}</span>
        <span style={{fontSize:7,color:'#7d5a90',background:'#0d0920',borderRadius:3,padding:'1px 3px'}}>{roleLabel}</span>
      </div>
      {owned?<Stars val={stars} onChange={v=>onStars&&onStars(hero.id,v)} color={g.accent}/>
        :<div style={{fontSize:8,color:'#3d2060'}}>tap to own</div>}
    </div>
  );
}

function MiniHero({heroId,heroStates,heroImages,label}){
  if(!heroId)return(
    <div style={{background:'#0a0615',border:'1px dashed #2d1a4a',borderRadius:8,
      padding:'8px 4px',textAlign:'center',minWidth:60}}>
      <div style={{fontSize:8,color:'#4d2a70',marginBottom:2}}>{label}</div>
      <div style={{fontSize:9,color:'#3d2060'}}>—</div>
    </div>
  );
  const hero=HMAP[heroId],g=GRP[hero.g],stars=heroStates?.[heroId]?.stars??0,imgSrc=heroImages?.[heroId];
  return(
    <div style={{background:g.bg,border:`1px solid ${g.border}`,borderRadius:8,
      padding:'6px 4px',textAlign:'center',minWidth:60}}>
      <div style={{fontSize:8,color:'#9d78c0',marginBottom:3,letterSpacing:'0.06em'}}>{label}</div>
      <div style={{width:32,height:32,borderRadius:6,margin:'0 auto 3px',overflow:'hidden',
        border:`1.5px solid ${g.accent}`,background:`linear-gradient(135deg,${g.bg},${g.accent}55)`,
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:g.accent}}>
        {imgSrc?<img src={imgSrc} alt={hero.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:ini(hero.name)}
      </div>
      <div style={{fontSize:9,fontWeight:700,color:'#f0e6ff'}}>{hero.name}</div>
      <Stars val={stars} size={9}/>
    </div>
  );
}

// ── TROOP TIER SECTION ────────────────────────────────────────
function TroopSection({label,color,data,onChange}){
  const [open,setOpen]=useState(false);
  const totalQty=TIERS.reduce((s,t)=>s+ni(data[t.id]),0);
  const power=TIERS.reduce((s,t)=>s+ni(data[t.id])*t.mult,0);
  const topTier=TIERS.slice().reverse().find(t=>ni(data[t.id])>0);
  return(
    <div style={{background:'#0a0615',border:'1px solid #2d1a4a',borderRadius:10,marginBottom:10,overflow:'hidden'}}>
      <div onClick={()=>setOpen(!open)} style={{
        display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',
        background:open?'#130928':'transparent'}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:color,flexShrink:0}}/>
        <span style={{fontSize:12,fontWeight:700,color:'#f0e6ff',flex:1}}>{label}</span>
        {topTier&&<span style={{fontSize:9,color:topTier.color,background:`${topTier.color}22`,
          borderRadius:4,padding:'2px 6px',fontWeight:700}}>Top: {topTier.short}</span>}
        <span style={{fontSize:10,color:'#9d78c0'}}>{fmt(totalQty)}</span>
        <span style={{fontSize:10,color:color,fontWeight:700}}>{fmtPower(power)}</span>
        <span style={{color:'#6d4a90',fontSize:11}}>{open?'▲':'▼'}</span>
      </div>
      {open&&(
        <div style={{padding:'0 14px 12px'}}>
          <div style={{fontSize:9,color:'#6d4a90',letterSpacing:'0.07em',margin:'8px 0 6px',fontWeight:700}}>STANDARD TIERS</div>
          {TIERS.filter(t=>!t.fc).map(t=>(
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{fontSize:9,color:t.color,background:`${t.color}22`,borderRadius:4,
                padding:'2px 6px',fontWeight:700,minWidth:36,textAlign:'center'}}>{t.short}</span>
              <span style={{fontSize:10,color:'#9d78c0',flex:1}}>{t.label.split('·')[1]?.trim()}</span>
              <input type="number" min="0" value={data[t.id]} onChange={e=>onChange({...data,[t.id]:e.target.value})}
                placeholder="0" style={{width:90,background:'#0d0920',border:'1px solid #3d1f60',
                  borderRadius:6,color:'#f0e6ff',fontSize:12,padding:'4px 8px',
                  outline:'none',fontFamily:'inherit'}}/>
              {ni(data[t.id])>0&&<span style={{fontSize:9,color:t.color,minWidth:40,textAlign:'right'}}>
                {fmtPower(ni(data[t.id])*t.mult)}</span>}
            </div>
          ))}
          <div style={{fontSize:9,color:'#f59e0b',letterSpacing:'0.07em',margin:'10px 0 6px',fontWeight:700}}>⚡ FULLY CONQUER</div>
          {TIERS.filter(t=>t.fc).map(t=>(
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{fontSize:9,color:t.color,background:`${t.color}22`,borderRadius:4,
                padding:'2px 6px',fontWeight:700,minWidth:36,textAlign:'center'}}>{t.short}</span>
              <span style={{fontSize:10,color:'#9d78c0',flex:1}}>Fully Conquer {t.short.slice(2)}</span>
              <input type="number" min="0" value={data[t.id]} onChange={e=>onChange({...data,[t.id]:e.target.value})}
                placeholder="0" style={{width:90,background:'#0d0920',border:'1px solid #f59e0b44',
                  borderRadius:6,color:'#fbbf24',fontSize:12,padding:'4px 8px',
                  outline:'none',fontFamily:'inherit'}}/>
              {ni(data[t.id])>0&&<span style={{fontSize:9,color:t.color,minWidth:40,textAlign:'right'}}>
                {fmtPower(ni(data[t.id])*t.mult)}</span>}
            </div>
          ))}
          <div style={{marginTop:10,paddingTop:8,borderTop:'1px solid #1d1035',
            display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:10,color:'#7c5fa0'}}>Total {label}</span>
            <div style={{display:'flex',gap:12}}>
              <span style={{fontSize:11,color:'#f0e6ff'}}>{fmt(totalQty)} troops</span>
              <span style={{fontSize:11,color,fontWeight:700}}>{fmtPower(power)} power</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LOGIN VIEW ────────────────────────────────────────────────
function LoginView({onLogin}){
  const [gid,setGid]=useState('');
  const [pin,setPin]=useState('');
  const [mode,setMode]=useState('login');
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);

  const submit=async()=>{
    setErr('');
    if(!gid.trim()){setErr('Enter your Gamer ID');return;}
    if(pin.length<4){setErr('PIN must be at least 4 characters');return;}
    setBusy(true);
    const isAdmin=gid.trim().toLowerCase()===ADMIN_ID.toLowerCase();
    const existing=await stor.getPlayer(gid.trim());
    if(mode==='register'){
      if(existing){setErr('Gamer ID already taken — log in instead.');setBusy(false);return;}
      const pd={gamerID:gid.trim(),pinHash:hashPin(gid.trim(),pin),isAdmin,
        marchCap:'',joinCount:5,isRally:false,maxSend:false,
        infantry:initTroops(),lancer:initTroops(),marksman:initTroops(),
        heroStates:initHS(),createdAt:Date.now(),updatedAt:Date.now()};
      await stor.setPlayer(gid.trim(),pd);
      const idx=await stor.getPlayerIndex();
      const key=gid.trim().toLowerCase();
      // index managed automatically by players table
      onLogin(pd);
    } else {
      if(!existing){setErr('Account not found — register instead.');setBusy(false);return;}
      if(hashPin(gid.trim(),pin)!==existing.pinHash){setErr('Incorrect PIN.');setBusy(false);return;}
      onLogin(existing);
    }
    setBusy(false);
  };

  const inp={width:'100%',boxSizing:'border-box',background:'#0a0615',
    border:'1.5px solid #3d1f60',borderRadius:8,color:'#f0e6ff',
    fontSize:14,padding:'11px 14px',outline:'none',fontFamily:'inherit'};

  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#0d0918,#080512)',
      fontFamily:"'Nunito','Century Gothic',sans-serif",display:'flex',
      alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{width:'100%',maxWidth:400}}>
        {/* Header */}
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:8}}>🐻</div>
          <div style={{fontSize:26,fontWeight:900,color:'#f0e6ff',letterSpacing:'0.04em'}}>
            {ALLIANCE} Bear Squad
          </div>
          <div style={{fontSize:12,color:'#7c5fa0',marginTop:4}}>Alliance Calculator · Season Tool</div>
        </div>
        {/* Card */}
        <div style={{background:'linear-gradient(145deg,#160d2e,#110821)',
          border:'1.5px solid #3d1f60',borderRadius:16,padding:'28px 24px',
          boxShadow:'0 8px 32px rgba(0,0,0,.5)'}}>
          <div style={{fontSize:16,fontWeight:800,color:'#f0e6ff',marginBottom:20,textAlign:'center'}}>
            {mode==='login'?'Welcome Back':'Create Account'}
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:'#9d78c0',letterSpacing:'0.08em',fontWeight:700,marginBottom:5}}>GAMER ID</div>
            <input value={gid} onChange={e=>setGid(e.target.value)} placeholder="Your in-game name or email"
              style={{...inp,color:'#e879f9',fontWeight:600}} onKeyDown={e=>e.key==='Enter'&&submit()}/>
          </div>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:10,color:'#9d78c0',letterSpacing:'0.08em',fontWeight:700,marginBottom:5}}>PIN</div>
            <input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="4+ digit PIN"
              style={inp} onKeyDown={e=>e.key==='Enter'&&submit()}/>
          </div>
          {err&&<div style={{background:'#3a0a0a',border:'1px solid #ef4444',borderRadius:8,
            padding:'8px 12px',fontSize:12,color:'#f87171',marginBottom:14}}>{err}</div>}
          <Btn onClick={submit} full color='#7c3aed' disabled={busy}>
            {busy?'Please wait…':mode==='login'?'Log In':'Create Account & Join'}
          </Btn>
          <div style={{textAlign:'center',marginTop:16}}>
            <span style={{fontSize:12,color:'#6d4a90'}}>
              {mode==='login'?'New to SYP Bear Squad? ':'Already have an account? '}
            </span>
            <span onClick={()=>{setMode(mode==='login'?'register':'login');setErr('');}}
              style={{fontSize:12,color:'#a855f7',cursor:'pointer',fontWeight:700}}>
              {mode==='login'?'Register here':'Log in instead'}
            </span>
          </div>
        </div>
        <div style={{textAlign:'center',marginTop:16,fontSize:10,color:'#3d2060'}}>
          {ALLIANCE} Alliance · Bear Trap Squad Planner
        </div>
      </div>
    </div>
  );
}

// ── PLAYER APP ────────────────────────────────────────────────
function PlayerApp({player,onLogout,onSwitchToAdmin}){
  const gid=player.gamerID;
  const [tab,setTab]=useState('heroes');
  // Safely merge saved data with fresh defaults so no field is ever undefined
  const safePlayer = { ...{marchCap:'',joinCount:5,isRally:false,maxSend:false,
    infantry:initTroops(),lancer:initTroops(),marksman:initTroops(),heroStates:initHS()}, ...player };
  const [heroStates,setHS]=useState(()=>({...initHS(),...(safePlayer.heroStates||{})}));
  const [heroImages,setHI]=useState({});
  const [marchCap,setMC]=useState(safePlayer.marchCap||'');
  const [joinCount,setJC]=useState(safePlayer.joinCount||5);
  const [isRally,setIR]=useState(Boolean(safePlayer.isRally));
  const [maxSend,setMS]=useState(Boolean(safePlayer.maxSend));
  const [infantry,setInf]=useState(()=>({...initTroops(),...(safePlayer.infantry||{})}));
  const [lancer,setLan]=useState(()=>({...initTroops(),...(safePlayer.lancer||{})}));
  const [marksman,setMark]=useState(()=>({...initTroops(),...(safePlayer.marksman||{})}));
  const [saving,setSaving]=useState(false);
  const [saveErr,setSaveErr]=useState('');
  const [imgCount,setIC]=useState(0);
  const [joinRatio,setJoinRatio]=useState(player.joinRatio||'A');
  const [submitted,setSubmitted]=useState(false);

  // Load all hero images from Supabase (shared across all players)
  useEffect(()=>{
    (async()=>{
      const imgs=await stor.getAllHeroImages();
      setHI(imgs);setIC(Object.keys(imgs).length);
    })();
  },[]);

  // Auto-save player data
  useEffect(()=>{
    setSaving(true);
    const t=setTimeout(async()=>{
      const pd={...player,heroStates,marchCap,joinCount,isRally,maxSend,
        infantry,lancer,marksman,joinRatio,updatedAt:Date.now()};
      await stor.setPlayer(gid,pd);
      setSaving(false);
    },1000);
    return()=>clearTimeout(t);
  },[heroStates,marchCap,joinCount,isRally,maxSend,infantry,lancer,marksman]);

  const toggleOwned=useCallback(id=>setHS(p=>({...p,[id]:{...p[id],owned:!p[id].owned}})),[]);
  const setStars=useCallback((id,s)=>setHS(p=>({...p,[id]:{...p[id],stars:s}})),[]);
  const uploadImg=useCallback(async(id,data)=>{
    setHI(p=>{const n={...p,[id]:data};setIC(Object.values(n).filter(Boolean).length);return n;});
    await stor.setHeroImage(id,data);
  },[gid]);

  const ownedCount=useMemo(()=>Object.values(heroStates).filter(s=>s.owned).length,[heroStates]);
  const recs=useMemo(()=>recommendAll(heroStates,isRally,joinCount),[heroStates,isRally,joinCount]);
  const totalPower=useMemo(()=>calcTroopPower(infantry,lancer,marksman),[infantry,lancer,marksman]);

  const grouped=useMemo(()=>{const m={};HEROES.forEach(h=>{if(!m[h.g])m[h.g]=[];m[h.g].push(h);});return m;},[]);

  const perJoinInf=Math.floor(TIERS.reduce((s,t)=>s+ni(infantry[t.id]),0)/Math.max(1,joinCount));
  const perJoinLan=Math.floor(TIERS.reduce((s,t)=>s+ni(lancer[t.id]),0)/Math.max(1,joinCount));
  const perJoinMark=Math.floor(TIERS.reduce((s,t)=>s+ni(marksman[t.id]),0)/Math.max(1,joinCount));

  const iStyle={width:'100%',boxSizing:'border-box',background:'#0a0615',border:'1.5px solid #3d1f60',
    borderRadius:8,color:'#f0e6ff',fontSize:14,fontWeight:600,padding:'9px 12px',outline:'none',fontFamily:'inherit'};

  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#0d0918,#080512)',
      fontFamily:"'Nunito','Century Gothic',sans-serif",color:'#f0e6ff',paddingBottom:80}}>
      {/* Header */}
      <div style={{background:'linear-gradient(90deg,#130924,#0d0618,#130924)',
        borderBottom:'1px solid #2d1a4a',padding:'12px 16px',
        position:'sticky',top:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,borderRadius:9,background:'linear-gradient(135deg,#f59e0b,#d97706)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🐻</div>
          <div>
            <div style={{fontSize:14,fontWeight:900}}>{gid}</div>
            <div style={{fontSize:9,color:saveErr?'#ef4444':'#7c5fa0'}}>{ALLIANCE} · {ownedCount}/65 heroes · {fmtPower(totalPower)} power · {saveErr||( saving?'saving…':'saved ✓')}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {player.isAdmin&&<span style={{fontSize:10,color:'#f59e0b',background:'#f59e0b22',
            border:'1px solid #f59e0b44',borderRadius:99,padding:'2px 8px',fontWeight:700}}>ADMIN</span>}
          {onSwitchToAdmin&&<Btn onClick={onSwitchToAdmin} small color='#f59e0b'>⚡ Admin Panel</Btn>}
          <Btn onClick={onLogout} outline small color='#6d4a90'>Log Out</Btn>
        </div>
      </div>
      {/* Tabs */}
      <div style={{display:'flex',background:'#0d0918',borderBottom:'1px solid #2d1a4a',
        padding:'0 12px',position:'sticky',top:60,zIndex:190}}>
        {[{id:'heroes',l:'🦸 Heroes'},{id:'setup',l:'⚙️ Setup'},{id:'results',l:'📊 Results'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:'transparent',border:'none',
            cursor:'pointer',padding:'11px 14px',fontSize:11,fontWeight:700,fontFamily:'inherit',
            color:tab===t.id?'#e879f9':'#7c5fa0',
            borderBottom:`2px solid ${tab===t.id?'#e879f9':'transparent'}`}}>{t.l}</button>
        ))}
      </div>

      <div style={{maxWidth:700,margin:'0 auto',padding:'18px 14px'}}>
        {/* HEROES TAB */}
        {tab==='heroes'&&(
          <div>
            <div style={{background:'#1a0b35',border:'1px solid #3d1f60',borderRadius:12,
              padding:'12px 16px',marginBottom:18,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:14,fontWeight:800}}>Hero Roster</div>
                <div style={{fontSize:11,color:'#7c5fa0'}}>Tap card to own · 📷 to upload portrait · ★ to set stars</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:20,fontWeight:900,color:'#e879f9'}}>{ownedCount}<span style={{fontSize:11,color:'#6d4a90'}}>/65</span></div>
                <div style={{fontSize:9,color:'#6d4a90'}}>{imgCount} portraits</div>
              </div>
            </div>
            {GO.map(gid2=>{
              const heroes=grouped[gid2];if(!heroes)return null;
              const g=GRP[gid2],ownedInG=heroes.filter(h=>heroStates[h.id]?.owned).length;
              const allOwned=ownedInG===heroes.length;
              const selectAll=()=>{const u={};heroes.forEach(h=>{u[h.id]={...heroStates[h.id],owned:true};});setHS(p=>({...p,...u}));};
              const clearAll=()=>{const u={};heroes.forEach(h=>{u[h.id]={...heroStates[h.id],owned:false};});setHS(p=>({...p,...u}));};
              return(
                <div key={gid2} style={{marginBottom:20}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,
                    borderBottom:`1px solid ${g.border}44`,paddingBottom:6}}>
                    <div style={{background:g.accent,borderRadius:5,padding:'2px 9px',
                      fontSize:10,fontWeight:900,color:'#fff'}}>{g.label}</div>
                    <span style={{fontSize:10,color:'#6d4a90'}}>{ownedInG}/{heroes.length} owned</span>
                    <div style={{marginLeft:'auto',display:'flex',gap:6}}>
                      {!allOwned&&<button onClick={selectAll} style={{background:`${g.accent}22`,
                        border:`1px solid ${g.accent}66`,borderRadius:6,color:g.accent,
                        fontSize:9,fontWeight:700,padding:'2px 8px',cursor:'pointer',fontFamily:'inherit'}}>
                        ✓ Select All
                      </button>}
                      {ownedInG>0&&<button onClick={clearAll} style={{background:'transparent',
                        border:'1px solid #3d2060',borderRadius:6,color:'#6d4a90',
                        fontSize:9,fontWeight:700,padding:'2px 8px',cursor:'pointer',fontFamily:'inherit'}}>
                        ✕ Clear
                      </button>}
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(92px,1fr))',gap:7}}>
                    {heroes.map(h=>(
                      <HeroCard key={h.id} hero={h} state={heroStates[h.id]}
                        imgSrc={heroImages[h.id]??null}
                        onToggle={toggleOwned} onStars={setStars} onUpload={uploadImg}/>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SETUP TAB */}
        {tab==='setup'&&(
          <div>
            <div style={{background:'linear-gradient(145deg,#160d2e,#110821)',border:'1.5px solid #3d1f60',
              borderRadius:16,padding:'20px',marginBottom:14,boxShadow:'0 4px 20px rgba(0,0,0,.4)'}}>
              <div style={{fontSize:14,fontWeight:800,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:24,height:24,borderRadius:6,background:'linear-gradient(135deg,#7c3aed,#a855f7)',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,color:'#fff'}}>1</div>
                Player & Squad Role
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:'#9d78c0',letterSpacing:'0.07em',fontWeight:700,marginBottom:5}}>MARCH CAPACITY</div>
                <input type="number" min="0" value={marchCap} onChange={e=>setMC(e.target.value)} placeholder="e.g. 1200000" style={iStyle}/>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:7,marginBottom:12}}>
                <CB checked={isRally} onChange={v=>{setIR(v);if(!v)setMS(false);}} accent="#f59e0b"
                  label="Rally Throw Squad — I'm opening the rally"/>
                <CB checked={maxSend} onChange={v=>{setMS(v);if(v)setIR(true);}} accent="#f59e0b"
                  label="Max Send on Rally — fill to march capacity"/>
              </div>
              <div style={{fontSize:10,color:'#9d78c0',letterSpacing:'0.07em',fontWeight:700,marginBottom:7}}>JOIN SQUAD COUNT</div>
              <div style={{display:'flex',gap:8}}>
                {[4,5,6].map(v=>(
                  <button key={v} onClick={()=>setJC(v)} style={{flex:1,padding:'10px 0',fontFamily:'inherit',cursor:'pointer',
                    background:joinCount===v?'linear-gradient(135deg,#7c3aed,#a855f7)':'#0d0920',
                    border:`1.5px solid ${joinCount===v?'#a855f7':'#2d1a4a'}`,
                    borderRadius:9,color:joinCount===v?'#fff':'#6d4a90',
                    fontSize:18,fontWeight:900}}>{v}</button>
                ))}
              </div>
            </div>
            <div style={{background:'linear-gradient(145deg,#13092a,#0f0620)',border:'1.5px solid #3d1f60',
              borderRadius:16,padding:'20px',boxShadow:'0 4px 20px rgba(0,0,0,.4)'}}>
              <div style={{fontSize:14,fontWeight:800,marginBottom:4,display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:24,height:24,borderRadius:6,background:'linear-gradient(135deg,#7c3aed,#a855f7)',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,color:'#fff'}}>2</div>
                Troop Composition
              </div>
              <div style={{fontSize:11,color:'#6d4a90',marginBottom:14}}>Expand each type to enter troops by tier · FC = Fully Conquer bonus tiers</div>
              <TroopSection label="Infantry"  color="#c084fc" data={infantry}  onChange={setInf}/>
              <TroopSection label="Lancer"    color="#e879f9" data={lancer}    onChange={setLan}/>
              <TroopSection label="Marksman"  color="#fb923c" data={marksman}  onChange={setMark}/>
              <div style={{background:'#0a0615',border:'1px solid #2d1a4a',borderRadius:10,padding:'12px 14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:11,color:'#7c5fa0'}}>Total Combat Power</span>
                  <span style={{fontSize:20,fontWeight:900,color:'#a855f7'}}>{fmtPower(totalPower)}</span>
                </div>
              </div>

              {/* Join Squad Ratio Picker */}
              <div style={{marginTop:14}}>
                <div style={{fontSize:10,color:'#9d78c0',letterSpacing:'0.07em',fontWeight:700,marginBottom:8}}>JOIN SQUAD TROOP RATIO</div>
                <div style={{display:'flex',gap:8}}>
                  {[
                    {k:'A',label:'Balanced',desc:'10% Inf · 10% Lan · 80% Mark'},
                    {k:'B',label:'Heavy Mix',desc:'20% Inf · 20% Lan · 60% Mark'},
                  ].map(({k,label,desc})=>(
                    <div key={k} onClick={()=>setJoinRatio(k)} style={{
                      flex:1,padding:'10px 12px',cursor:'pointer',userSelect:'none',
                      background:joinRatio===k?'#1a0b35':'#0a0615',
                      border:`1.5px solid ${joinRatio===k?'#a855f7':'#2d1a4a'}`,
                      borderRadius:10,transition:'all .2s'}}>
                      <div style={{fontSize:12,fontWeight:800,color:joinRatio===k?'#e879f9':'#6d4a90',marginBottom:2}}>{label}</div>
                      <div style={{fontSize:9,color:joinRatio===k?'#9d78c0':'#3d2060'}}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <button onClick={()=>{setSubmitted(true);setTab('results');}} style={{
              width:'100%',padding:'16px',marginTop:4,cursor:'pointer',fontFamily:'inherit',
              background:'linear-gradient(135deg,#7c3aed,#a855f7)',
              border:'none',borderRadius:14,color:'#fff',
              fontSize:16,fontWeight:900,letterSpacing:'0.04em',
              boxShadow:'0 4px 20px rgba(124,58,237,.4)',transition:'all .2s'}}>
              📊 Calculate & View Results
            </button>
          </div>
        )}

        {/* RESULTS TAB */}
        {tab==='results'&&(()=>{
          const dist=calcDistribution(infantry,lancer,marksman,marchCap,isRally,joinCount,joinRatio);
          const hasData=dist.totalAvail>0||ni(marchCap)>0;
          return(
            <div>
              {!submitted&&!hasData&&(
                <div style={{textAlign:'center',padding:'40px 20px',color:'#4d2a70',
                  border:'1px dashed #2d1a4a',borderRadius:14}}>
                  <div style={{fontSize:28,marginBottom:8}}>📊</div>
                  <div style={{fontSize:14,marginBottom:12}}>Fill out Setup and hit Calculate to see your squad breakdown</div>
                  <button onClick={()=>setTab('setup')} style={{background:'linear-gradient(135deg,#7c3aed,#a855f7)',
                    border:'none',borderRadius:10,color:'#fff',padding:'10px 24px',
                    fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                    Go to Setup →
                  </button>
                </div>
              )}
              {hasData&&(
                <div>
                  {/* Summary bar */}
                  <div style={{background:'#13092a',border:'1px solid #3d1f60',borderRadius:12,
                    padding:'12px 16px',marginBottom:16,display:'grid',
                    gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                    {[
                      {l:'TOTAL AVAIL',v:fmt(dist.totalAvail),c:'#9d78c0'},
                      {l:'TROOPS USED',v:fmt(dist.totalUsed),c:'#a855f7'},
                      {l:'EFFICIENCY',v:`${dist.efficiency}%`,c:dist.efficiency>=90?'#34d399':dist.efficiency>=70?'#fbbf24':'#f87171'},
                      {l:'SQUADS',v:(isRally?1:0)+joinCount,c:'#fb923c'},
                    ].map(({l,v,c})=>(
                      <div key={l} style={{textAlign:'center'}}>
                        <div style={{fontSize:8,color:'#6d4a90',marginBottom:2,letterSpacing:'0.06em'}}>{l}</div>
                        <div style={{fontSize:14,fontWeight:900,color:c}}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Ratio note */}
                  <div style={{fontSize:10,color:'#6d4a90',textAlign:'center',marginBottom:14}}>
                    Rally: 5/5/90 · Joins ({joinRatio==='B'?'20/20/60':'10/10/80'}) · Troops split evenly across all squads
                  </div>

                  {/* Rally card */}
                  {isRally&&<SquadCard isRally={true} slotHeroes={recs.rally}
                    dist={dist.rally} heroStates={heroStates} heroImages={heroImages}/>}

                  {/* Join cards — each uses its own unique hero set */}
                  {dist.joins.map((j,i)=>(
                    <SquadCard key={i} isRally={false} num={i+1}
                      slotHeroes={recs.joins[i]??{s1:null,s2:null,s3:null}} dist={j}
                      heroStates={heroStates} heroImages={heroImages}/>
                  ))}

                  {/* Unused troops note */}
                  {dist.totalAvail-dist.totalUsed>0&&(
                    <div style={{background:'#0d0920',border:'1px solid #2d1a4a',borderRadius:10,
                      padding:'10px 14px',textAlign:'center',fontSize:10,color:'#6d4a90'}}>
                      ⚠ {fmt(dist.totalAvail-dist.totalUsed)} troops unused — ratio constraints prevent sending all troops while maintaining squad balance
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── ADMIN PANEL ───────────────────────────────────────────────
function AdminPanel({player,onLogout,onSwitchToPlayer}){
  const [atab,setAtab]=useState('players');
  const [allPlayers,setAllPlayers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [rallyLead,setRallyLead]=useState('');
  const [expandedP,setExpandedP]=useState(null);

  const loadAll=useCallback(async()=>{
    setLoading(true);
    const idx=await stor.getPlayerIndex();
    const plist=await Promise.all(idx.map(gid=>stor.get(SK.player(gid),true)));
    setAllPlayers(plist.filter(Boolean));
    setLoading(false);
  },[]);

  useEffect(()=>{loadAll();},[loadAll]);

  const scored=useMemo(()=>allPlayers.map(p=>{
    const hs={...initHS(),...(p.heroStates||{})};
    const inf={...initTroops(),...(p.infantry||{})};
    const lan={...initTroops(),...(p.lancer||{})};
    const mark={...initTroops(),...(p.marksman||{})};
    const power=calcTroopPower(inf,lan,mark);
    const heroScore=calcHeroScore(hs);
    const cap=parseInt(p.marchCap)||0;
    // Calculate recs for both rally and join scenarios
    const rallyRecs=recommendAll(hs,true,p.joinCount||5);
    const joinRecs=recommendAll(hs,false,p.joinCount||5);
    return{...p,power,heroScore,cap,
      inf,lan,mark,hs,
      recs:p.isRally?rallyRecs:joinRecs,
      rallyRecs,joinRecs,
      joinCount:p.joinCount||5,
    };
  }).sort((a,b)=>(b.power+b.heroScore*500)-(a.power+a.heroScore*500)),[allPlayers]);

  const optimization=useMemo(()=>{
    const lead=rallyLead?scored.find(p=>p.gamerID===rallyLead):null;
    const joiners=scored.filter(p=>p.gamerID!==(lead?.gamerID||'')).slice(0,14);
    const totalPow=(lead?lead.power+lead.heroScore*500:0)+joiners.reduce((s,p)=>s+p.power+p.heroScore*500,0);
    return{lead,joiners,totalPow};
  },[scored,rallyLead]);

  const roleColors={lead:'#f59e0b',join:'#7c3aed'};

  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#0d0918,#080512)',
      fontFamily:"'Nunito','Century Gothic',sans-serif",color:'#f0e6ff',paddingBottom:60}}>
      {/* Header */}
      <div style={{background:'linear-gradient(90deg,#130924,#0d0618,#130924)',
        borderBottom:'1px solid #f59e0b44',padding:'12px 16px',
        position:'sticky',top:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,borderRadius:9,background:'linear-gradient(135deg,#f59e0b,#d97706)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🐻</div>
          <div>
            <div style={{fontSize:14,fontWeight:900}}>{ADMIN_NAME} <span style={{fontSize:10,color:'#f59e0b',background:'#f59e0b22',borderRadius:99,padding:'1px 7px'}}>ADMIN</span></div>
            <div style={{fontSize:9,color:'#7c5fa0'}}>{ALLIANCE} Alliance · {allPlayers.length} players registered</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Btn onClick={onSwitchToPlayer} small color='#a855f7'>👤 My Profile</Btn>
          <Btn onClick={onLogout} outline small color='#6d4a90'>Log Out</Btn>
        </div>
      </div>
      {/* Admin Tabs */}
      <div style={{display:'flex',background:'#0d0918',borderBottom:'1px solid #2d1a4a',padding:'0 12px',position:'sticky',top:60,zIndex:190}}>
        {[{id:'players',l:'👥 Players'},{id:'optimize',l:'⚡ Optimize Rally'}].map(t=>(
          <button key={t.id} onClick={()=>setAtab(t.id)} style={{background:'transparent',border:'none',
            cursor:'pointer',padding:'11px 16px',fontSize:11,fontWeight:700,fontFamily:'inherit',
            color:atab===t.id?'#f59e0b':'#7c5fa0',
            borderBottom:`2px solid ${atab===t.id?'#f59e0b':'transparent'}`}}>{t.l}</button>
        ))}
        <button onClick={loadAll} style={{marginLeft:'auto',background:'transparent',border:'none',
          cursor:'pointer',padding:'11px 14px',fontSize:10,color:'#6d4a90',fontFamily:'inherit'}}>
          ↻ Refresh
        </button>
      </div>

      <div style={{maxWidth:800,margin:'0 auto',padding:'18px 14px'}}>
        {loading&&<div style={{textAlign:'center',padding:40,color:'#6d4a90'}}>Loading player data…</div>}

        {/* PLAYERS TAB */}
        {!loading&&atab==='players'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10,marginBottom:20}}>
              {[{l:'Players',v:allPlayers.length,c:'#a855f7'},
                {l:'Avg Power',v:fmtPower(Math.round(scored.reduce((s,p)=>s+p.power,0)/Math.max(1,scored.length))),c:'#e879f9'},
                {l:'Top Power',v:fmtPower(scored[0]?.power||0),c:'#f59e0b'},
                {l:'FC Owners',v:scored.filter(p=>TIERS.filter(t=>t.fc).some(t=>ni(p.infantry?.[t.id])||ni(p.lancer?.[t.id])||ni(p.marksman?.[t.id]))).length,c:'#fb923c'},
              ].map(({l,v,c})=>(
                <div key={l} style={{background:'#13092a',border:`1px solid ${c}33`,borderRadius:10,padding:'12px',textAlign:'center'}}>
                  <div style={{fontSize:9,color:'#6d4a90',marginBottom:3}}>{l.toUpperCase()}</div>
                  <div style={{fontSize:18,fontWeight:900,color:c}}>{v}</div>
                </div>
              ))}
            </div>

            {scored.length===0&&<div style={{textAlign:'center',padding:40,color:'#4d2a70',
              border:'1px dashed #2d1a4a',borderRadius:12}}>No players registered yet</div>}

            {scored.map((p,i)=>{
              const recs=p.recs,isExpanded=expandedP===p.gamerID;
              const ownedCount=Object.values(p.heroStates||{}).filter(h=>h.owned).length;
              const topTier=TIERS.slice().reverse().find(t=>ni(p.infantry?.[t.id])||ni(p.lancer?.[t.id])||ni(p.marksman?.[t.id]));
              return(
                <div key={p.gamerID} style={{background:'#13092a',border:'1px solid #3d1f60',
                  borderRadius:12,marginBottom:10,overflow:'hidden'}}>
                  <div onClick={()=>setExpandedP(isExpanded?null:p.gamerID)} style={{
                    display:'flex',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer',
                    background:isExpanded?'#1a0b35':'transparent'}}>
                    <div style={{width:28,height:28,borderRadius:7,
                      background:`linear-gradient(135deg,#3d1f60,#5d2f80)`,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:11,fontWeight:900,color:'#e879f9',flexShrink:0}}>
                      {i+1}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:800,color:'#f0e6ff',display:'flex',alignItems:'center',gap:6}}>
                        {p.gamerID}
                        {p.isAdmin&&<span style={{fontSize:8,color:'#f59e0b',background:'#f59e0b22',borderRadius:99,padding:'1px 5px'}}>ADMIN</span>}
                        {p.isRally&&<span style={{fontSize:8,color:'#f59e0b',background:'#f59e0b22',borderRadius:99,padding:'1px 5px'}}>RALLY</span>}
                      </div>
                      <div style={{fontSize:10,color:'#7c5fa0'}}>
                        {ownedCount} heroes · Cap: {p.cap>0?fmt(p.cap):'—'} · {p.joinCount||5} joins
                        {topTier&&<span style={{color:topTier.color,marginLeft:6}}>Top: {topTier.short}</span>}
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:16,fontWeight:900,color:'#a855f7'}}>{fmtPower(p.power)}</div>
                      <div style={{fontSize:9,color:'#6d4a90'}}>combat power</div>
                    </div>
                    <span style={{color:'#6d4a90'}}>{isExpanded?'▲':'▼'}</span>
                  </div>
                  {isExpanded&&(
                    <div style={{padding:'0 16px 16px',borderTop:'1px solid #2d1a4a'}}>
                      <div style={{fontSize:10,color:'#9d78c0',marginTop:12,marginBottom:8,fontWeight:700,letterSpacing:'0.07em'}}>RECOMMENDED LOADOUT</div>
                      <div style={{marginBottom:6,fontSize:9,color:'#7c5fa0'}}>
                        {p.isRally?'🐻 Rally Lead':'🔵 Join Squad'} · {p.joinCount||5} joins
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
                        <MiniHero heroId={p.isRally?p.recs.rally.s1:p.recs.joins[0]?.s1} heroStates={p.hs} heroImages={{}} label="⚔ SLOT 1"/>
                        <MiniHero heroId={p.isRally?p.recs.rally.s2:p.recs.joins[0]?.s2} heroStates={p.hs} heroImages={{}} label="🏇 SLOT 2"/>
                        <MiniHero heroId={p.isRally?p.recs.rally.s3:p.recs.joins[0]?.s3} heroStates={p.hs} heroImages={{}} label="🎯 SLOT 3"/>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                        {[{l:'Infantry Power',v:fmtPower(TIERS.reduce((s,t)=>s+ni(p.infantry?.[t.id])*t.mult,0)),c:'#c084fc'},
                          {l:'Lancer Power',v:fmtPower(TIERS.reduce((s,t)=>s+ni(p.lancer?.[t.id])*t.mult,0)),c:'#e879f9'},
                          {l:'Marksman Power',v:fmtPower(TIERS.reduce((s,t)=>s+ni(p.marksman?.[t.id])*t.mult,0)),c:'#fb923c'}].map(({l,v,c})=>(
                          <div key={l} style={{background:'#0a0615',borderRadius:8,padding:'8px',textAlign:'center'}}>
                            <div style={{fontSize:8,color:'#6d4a90',marginBottom:2}}>{l.toUpperCase()}</div>
                            <div style={{fontSize:14,fontWeight:800,color:c}}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* OPTIMIZE TAB */}
        {!loading&&atab==='optimize'&&(
          <div>
            <div style={{background:'linear-gradient(145deg,#1e1035,#120b25)',border:'1.5px solid #f59e0b55',
              borderRadius:16,padding:'20px',marginBottom:16,boxShadow:'0 0 20px rgba(245,158,11,.1)'}}>
              <div style={{fontSize:14,fontWeight:800,color:'#fbbf24',marginBottom:4}}>⚡ 15-Person Rally Optimizer</div>
              <div style={{fontSize:11,color:'#7c5a00',marginBottom:16}}>Select rally lead · system ranks the best 14 joiners by combat power + hero score</div>

              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,color:'#9d78c0',fontWeight:700,marginBottom:6,letterSpacing:'0.07em'}}>SELECT RALLY LEAD</div>
                <select value={rallyLead} onChange={e=>setRallyLead(e.target.value)} style={{
                  width:'100%',background:'#0a0615',border:'1.5px solid #f59e0b66',borderRadius:8,
                  color:'#fbbf24',fontSize:14,fontWeight:700,padding:'10px 12px',
                  outline:'none',fontFamily:'inherit',cursor:'pointer'}}>
                  <option value="">— Pick rally lead —</option>
                  {scored.map(p=><option key={p.gamerID} value={p.gamerID}>{p.gamerID} (Cap: {p.cap>0?fmt(p.cap):'?'} · Power: {fmtPower(p.power)})</option>)}
                </select>
              </div>

              {/* Total stats */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                {[{l:'Total Power',v:fmtPower(optimization.totalPow),c:'#f59e0b'},
                  {l:'Slots Filled',v:`${(optimization.lead?1:0)+optimization.joiners.length}/15`,c:'#a855f7'},
                  {l:'Players Available',v:scored.length,c:'#e879f9'}].map(({l,v,c})=>(
                  <div key={l} style={{background:'#0a0615',border:`1px solid ${c}33`,borderRadius:10,padding:'10px',textAlign:'center'}}>
                    <div style={{fontSize:8,color:'#6d4a90',marginBottom:2}}>{l.toUpperCase()}</div>
                    <div style={{fontSize:17,fontWeight:900,color:c}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rally Lead Card */}
            {optimization.lead?(
              <div style={{background:'linear-gradient(145deg,#2a1500,#1a0c00)',
                border:'2px solid #f59e0b',borderRadius:14,padding:'16px',marginBottom:12,
                boxShadow:'0 0 24px rgba(245,158,11,.2)'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                  <span style={{background:'linear-gradient(135deg,#f59e0b,#d97706)',borderRadius:99,
                    padding:'3px 12px',fontSize:11,fontWeight:900,color:'#1a0a00'}}>🐻 RALLY LEAD</span>
                  <span style={{fontSize:16,fontWeight:900,color:'#fbbf24'}}>{optimization.lead.gamerID}</span>
                  <span style={{fontSize:12,color:'#9d6f00',marginLeft:'auto'}}>
                    Cap: {optimization.lead.cap>0?fmt(optimization.lead.cap):'?'} · Power: {fmtPower(optimization.lead.power)}
                  </span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                  <MiniHero heroId={optimization.lead.recs.rally.s1} heroStates={optimization.lead.heroStates} heroImages={{}} label="⚔ SLOT 1 · Inf"/>
                  <MiniHero heroId={optimization.lead.recs.rally.s2} heroStates={optimization.lead.heroStates} heroImages={{}} label="🏇 SLOT 2 · Lan"/>
                  <MiniHero heroId={optimization.lead.recs.rally.s3} heroStates={optimization.lead.heroStates} heroImages={{}} label="🎯 SLOT 3 · Cap"/>
                </div>
              </div>
            ):(
              <div style={{background:'#0a0615',border:'1px dashed #f59e0b44',borderRadius:12,
                padding:'20px',textAlign:'center',marginBottom:12}}>
                <div style={{color:'#6d4a90'}}>Select a rally lead above to see the full optimization</div>
              </div>
            )}

            {/* Joiners */}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {optimization.joiners.map((p,i)=>{
                const recs=p.recs;
                return(
                  <div key={p.gamerID} style={{background:'#13092a',border:'1px solid #3d1f60',
                    borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:26,height:26,borderRadius:6,flexShrink:0,
                      background:'linear-gradient(135deg,#5b21b6,#7c3aed)',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:11,fontWeight:900,color:'#f0e6ff'}}>J{i+1}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:800,color:'#f0e6ff'}}>{p.gamerID}</div>
                      <div style={{fontSize:10,color:'#7c5fa0'}}>
                        Power: {fmtPower(p.power)} · Hero: +{p.heroScore} · {p.joinCount||5} joins
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6,flexShrink:0}}>
                      {[{id:p.joinRecs.joins[0]?.s1,l:'J1'},{id:p.joinRecs.joins[0]?.s2,l:'S2'},{id:p.joinRecs.joins[0]?.s3,l:'S3'}].map(({id,l})=>(
                        <div key={l} style={{textAlign:'center'}}>
                          <div style={{fontSize:7,color:'#6d4a90',marginBottom:2}}>{l}</div>
                          {id?<div style={{width:28,height:28,borderRadius:5,
                            background:`linear-gradient(135deg,${GRP[HMAP[id].g].bg},${GRP[HMAP[id].g].accent}55)`,
                            border:`1px solid ${GRP[HMAP[id].g].accent}`,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:9,fontWeight:900,color:GRP[HMAP[id].g].accent}}>
                            {ini(HMAP[id].name)}
                          </div>
                          :<div style={{width:28,height:28,borderRadius:5,background:'#0a0615',
                            border:'1px dashed #2d1a4a',display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:8,color:'#3d2060'}}>—</div>}
                        </div>
                      ))}
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:15,fontWeight:900,color:'#a855f7'}}>{fmtPower(p.power)}</div>
                    </div>
                  </div>
                );
              })}
              {optimization.joiners.length<14&&optimization.lead&&(
                <div style={{textAlign:'center',padding:'12px',color:'#4d2a70',fontSize:11,
                  border:'1px dashed #2d1a4a',borderRadius:10}}>
                  {14-optimization.joiners.length} more joiner slot{14-optimization.joiners.length!==1?'s':''} available — need more players to register
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────
export default function App(){
  const [view,setView]=useState('login');
  const [player,setPlayer]=useState(null);

  const handleLogin=p=>{setPlayer(p);setView(p.isAdmin?'admin':'player');};
  const handleLogout=()=>{setPlayer(null);setView('login');};
  const toAdmin=()=>setView('admin');
  const toPlayer=()=>setView('player');

  if(view==='login')return <LoginView onLogin={handleLogin}/>;
  if(view==='admin')return <AdminPanel player={player} onLogout={handleLogout} onSwitchToPlayer={toPlayer}/>;
  return <PlayerApp player={player} onLogout={handleLogout} onSwitchToAdmin={player?.isAdmin?toAdmin:null}/>;
}
