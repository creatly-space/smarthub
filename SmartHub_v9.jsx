import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "./lib/supabase"
import { Home, CalendarDays, ListChecks, UtensilsCrossed, Settings, MapPin, Wind, CloudSun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog, Sun, Cloud, Snowflake, Menu as MenuIcon, Palette as PaletteIcon, Upload as UploadIcon, Check as CheckIcon, X as XIcon, ChevronUp, ChevronDown, Plus, Lock, Users, Monitor, GripVertical, Maximize2, Minimize2, Save, LayoutDashboard } from "lucide-react"

// ── Design tokens ──
const ACCENT = "#a78bfa"
const ACCENT2 = "#fb923c"
const GREEN = "#4ade80"
const RED = "#ef4444"
const AMBER = "#f59e0b"
const LIST_COLORS = ["#a78bfa","#4ade80","#fb923c","#38bdf8","#ef4444","#c084fc","#f97316","#2dd4bf"]
const EVENT_COLORS = [{color:"#a78bfa",label:"Lila"},{color:"#4ade80",label:"Gr\u00f6n"},{color:"#fb923c",label:"Orange"},{color:"#38bdf8",label:"Bl\u00e5"},{color:"#c084fc",label:"Ljuslila"},{color:"#ef4444",label:"R\u00f6d"}]
const txt = {
  primary: "rgba(255,255,255,0.92)",
  secondary: "rgba(255,255,255,0.7)",
  tertiary: "rgba(255,255,255,0.5)",
  muted: "rgba(255,255,255,0.3)",
  accent: "rgba(255,200,100,0.9)",
  calEvent: "rgba(255,255,255,0.6)",
  calTime: "rgba(255,255,255,0.4)",
}

const BG_PRESETS = [
  {id:"aurora",label:"Norrsken",url:"https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=900&q=80"},
  {id:"ocean",label:"Hav",url:"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=80"},
  {id:"forest",label:"Skog",url:"https://images.unsplash.com/photo-1448375240586-882707db888b?w=900&q=80"},
  {id:"mountain",label:"Berg",url:"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&q=80"},
  {id:"sunset",label:"Kv\u00e4ll",url:"https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=900&q=80"},
]

const WEEKDAYS_SV=["S\u00f6ndag","M\u00e5ndag","Tisdag","Onsdag","Torsdag","Fredag","L\u00f6rdag"]
const WEEKDAYS_SHORT=["S\u00f6n","M\u00e5n","Tis","Ons","Tor","Fre","L\u00f6r"]
const MONTHS=["januari","februari","mars","april","maj","juni","juli","augusti","september","oktober","november","december"]
const MONTHS_FULL=["Januari","Februari","Mars","April","Maj","Juni","Juli","Augusti","September","Oktober","November","December"]
const MEAL_DAYS=["M\u00e5n","Tis","Ons","Tor","Fre","L\u00f6r","S\u00f6n"]

const WEATHER_LAT=56.66,WEATHER_LON=16.36,WEATHER_LOCATION="Kalmar"
const WMO={0:{e:"\u2600\ufe0f",t:"Klart"},1:{e:"\ud83c\udf24\ufe0f",t:"Mestadels klart"},2:{e:"\u26c5",t:"Halvklart"},3:{e:"\u2601\ufe0f",t:"Mulet"},45:{e:"\ud83c\udf2b\ufe0f",t:"Dimma"},48:{e:"\ud83c\udf2b\ufe0f",t:"Rimfrost"},51:{e:"\ud83c\udf26\ufe0f",t:"L\u00e4tt duggregn"},53:{e:"\ud83c\udf26\ufe0f",t:"Duggregn"},55:{e:"\ud83c\udf27\ufe0f",t:"Kraftigt duggregn"},61:{e:"\ud83c\udf26\ufe0f",t:"L\u00e4tt regn"},63:{e:"\ud83c\udf27\ufe0f",t:"Regn"},65:{e:"\ud83c\udf27\ufe0f",t:"Kraftigt regn"},71:{e:"\ud83c\udf28\ufe0f",t:"L\u00e4tt sn\u00f6"},73:{e:"\u2744\ufe0f",t:"Sn\u00f6fall"},75:{e:"\u2744\ufe0f",t:"Kraftigt sn\u00f6fall"},80:{e:"\ud83c\udf26\ufe0f",t:"L\u00e4tt regnskur"},81:{e:"\ud83c\udf27\ufe0f",t:"Regnskur"},82:{e:"\ud83c\udf27\ufe0f",t:"Kraftig skur"},95:{e:"\u26c8\ufe0f",t:"\u00c5skv\u00e4der"},96:{e:"\u26c8\ufe0f",t:"\u00c5ska med hagel"},99:{e:"\u26c8\ufe0f",t:"Kraftig \u00e5ska"}}
function parseWeather(json){if(!json||!json.current)return null;const temp=Math.round(json.current.temperature_2m);const code=json.current.weathercode;const wind=Math.round(json.current.windspeed_10m/3.6);const w=WMO[code]||{e:"\u2601\ufe0f",t:"Ok\u00e4nt"};const forecast=[];if(json.daily&&json.daily.time){for(let i=1;i<json.daily.time.length&&forecast.length<3;i++){const d=new Date(json.daily.time[i]);const fc=json.daily.weathercode[i];const fi=WMO[fc]||{e:"\u2601\ufe0f",t:""};forecast.push({day:WEEKDAYS_SHORT[d.getDay()],icon:fi.e,code:fc,temp:Math.round(json.daily.temperature_2m_max[i])+"\u00b0"})}};return{temp,icon:w.e,code,desc:w.t,wind,forecast,location:WEATHER_LOCATION}}

function WmoIcon({code,size=20,color="rgba(255,255,255,0.7)"}){
  const c2=Number(code)
  if(c2===0)return <Sun size={size} strokeWidth={1.5} color={color}/>
  if(c2<=2)return <CloudSun size={size} strokeWidth={1.5} color={color}/>
  if(c2===3)return <Cloud size={size} strokeWidth={1.5} color={color}/>
  if(c2>=45&&c2<=48)return <CloudFog size={size} strokeWidth={1.5} color={color}/>
  if(c2>=51&&c2<=55)return <CloudDrizzle size={size} strokeWidth={1.5} color={color}/>
  if(c2>=61&&c2<=67)return <CloudRain size={size} strokeWidth={1.5} color={color}/>
  if(c2>=71&&c2<=77)return <Snowflake size={size} strokeWidth={1.5} color={color}/>
  if(c2>=80&&c2<=82)return <CloudRain size={size} strokeWidth={1.5} color={color}/>
  if(c2>=85&&c2<=86)return <CloudSnow size={size} strokeWidth={1.5} color={color}/>
  if(c2>=95)return <CloudLightning size={size} strokeWidth={1.5} color={color}/>
  return <Cloud size={size} strokeWidth={1.5} color={color}/>
}

// ── Helpers ──
function fmtTime(iso){if(!iso)return"";const d=new Date(iso);return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")}
function fmtDate(date){return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0")}
function genCode(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let r="";for(let i=0;i<6;i++)r+=c[Math.floor(Math.random()*c.length)];return r}
function daysLeft(d){if(!d)return null;return Math.ceil((new Date(d)-new Date())/(1000*60*60*24))}
function getISOWeek(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const dayNum=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-dayNum);const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil((((d-yearStart)/86400000)+1)/7)}
function groupEventsByDay(events,year,month){const out={};events.forEach(ev=>{const d=new Date(ev.start_time);if(d.getFullYear()===year&&d.getMonth()===month){const day=d.getDate();if(!out[day])out[day]=[];out[day].push({time:fmtTime(ev.start_time),title:ev.title,color:ev.color||ACCENT})}});Object.keys(out).forEach(k=>out[k].sort((a,b)=>a.time.localeCompare(b.time)));return out}
function getEventsToday(events){const today=new Date();const y=today.getFullYear(),m=today.getMonth(),d=today.getDate();return events.filter(ev=>{const dt=new Date(ev.start_time);return dt.getFullYear()===y&&dt.getMonth()===m&&dt.getDate()===d}).sort((a,b)=>new Date(a.start_time)-new Date(b.start_time)).map(ev=>({id:ev.id,start:fmtTime(ev.start_time),title:ev.title,location:ev.location,color:ev.color||ACCENT,shared:ev.shared}))}
function buildCal(year,month){const f=new Date(year,month,1).getDay();const o=f===0?6:f-1;const days=new Date(year,month+1,0).getDate();const c=[];for(let i=0;i<o;i++)c.push(null);for(let i=1;i<=days;i++)c.push(i);while(c.length%7!==0)c.push(null);const w=[];for(let i=0;i<c.length;i+=7)w.push(c.slice(i,i+7));return w}

// ── Glass components ──
function Glass({children,style,depth=1,...props}){
  const cfg={
    1:{blur:14,bg:"rgba(255,255,255,0.04)",border:"rgba(255,255,255,0.07)",hl:0.06,shadow:"0 4px 20px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.06)"},
    2:{blur:16,bg:"rgba(255,255,255,0.05)",border:"rgba(255,255,255,0.08)",hl:0.1,shadow:"0 8px 32px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.1)"},
    3:{blur:20,bg:"rgba(255,255,255,0.06)",border:"rgba(255,255,255,0.1)",hl:0.14,shadow:"0 12px 48px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.18), inset 0 1.5px 0 rgba(255,255,255,0.14)"},
  }[depth]
  return(<div style={{background:`linear-gradient(135deg, ${cfg.bg} 0%, rgba(255,255,255,0.015) 50%, rgba(255,255,255,0.025) 100%)`,backdropFilter:`blur(${cfg.blur}px) saturate(1.2)`,WebkitBackdropFilter:`blur(${cfg.blur}px) saturate(1.2)`,border:`1px solid ${cfg.border}`,borderRadius:20,boxShadow:cfg.shadow,position:"relative",overflow:"hidden",...style}} {...props}>
    <div style={{position:"absolute",top:0,left:"8%",right:"8%",height:1,background:`linear-gradient(90deg, transparent, rgba(255,255,255,${cfg.hl}), transparent)`,pointerEvents:"none"}}/>
    {children}
  </div>)
}
function GlassInner({children,style,...props}){
  return(<div style={{background:"linear-gradient(140deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.01) 100%)",borderRadius:14,border:"1px solid rgba(255,255,255,0.05)",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.03), 0 2px 6px rgba(0,0,0,0.06)",position:"relative",overflow:"hidden",...style}} {...props}>{children}</div>)
}
const Label=({children})=><span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.55)",letterSpacing:"0.12em",textTransform:"uppercase"}}>{children}</span>
const glassInput={width:"100%",padding:"10px 12px",fontSize:13,border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,outline:"none",fontFamily:"inherit",background:"rgba(255,255,255,0.05)",color:txt.primary,boxSizing:"border-box"}
const glassBtn=(active)=>({width:"100%",background:active?"rgba(255,255,255,0.08)":ACCENT,color:"#fff",border:active?"1px solid rgba(255,255,255,0.1)":"none",borderRadius:14,padding:"13px",fontSize:14,fontWeight:600,cursor:active?"not-allowed":"pointer",opacity:active?0.6:1})


// ── Widget Registry ──
const WIDGET_REGISTRY = {
  calendar: { label: "Kalender", size: "full", icon: "\ud83d\udcc5" },
  todo: { label: "Att g\u00f6ra", size: "half", icon: "\u2611\ufe0f" },
  meal: { label: "Matsedel", size: "half", icon: "\ud83c\udf7d\ufe0f" },
  weather: { label: "V\u00e4der", size: "half", icon: "\u2600\ufe0f" },
  events: { label: "H\u00e4ndelser", size: "full", icon: "\ud83d\udccb" },
}
const DEFAULT_WIDGETS = ["calendar", "todo", "meal"]

// ── TV Widget Registry ──
const TV_WIDGET_REGISTRY = {
  clock: { label: "Klocka", minW: 2, minH: 1, icon: "\u23f0" },
  calendar: { label: "Kalender", minW: 2, minH: 2, icon: "\ud83d\udcc5" },
  todo: { label: "Att g\u00f6ra", minW: 1, minH: 1, icon: "\u2611\ufe0f" },
  meal: { label: "Matsedel", minW: 1, minH: 1, icon: "\ud83c\udf7d\ufe0f" },
  weather: { label: "V\u00e4der", minW: 1, minH: 1, icon: "\u2600\ufe0f" },
  events: { label: "H\u00e4ndelser", minW: 2, minH: 1, icon: "\ud83d\udccb" },
}
const DEFAULT_TV_WIDGETS = [
  {id:"clock",x:0,y:0,w:4,h:1},
  {id:"calendar",x:0,y:1,w:4,h:3},
  {id:"todo",x:0,y:4,w:2,h:2},
  {id:"meal",x:2,y:4,w:2,h:2},
]

// ── Modals ──
function AddEventModal({onSave,onClose}){
  const[title,setTitle]=useState("");const[date,setDate]=useState(fmtDate(new Date()));const[startTime,setStartTime]=useState("12:00");const[endTime,setEndTime]=useState("13:00");const[location,setLocation]=useState("");const[color,setColor]=useState(EVENT_COLORS[0].color);const[shared,setShared]=useState(true)
  return(<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}><Glass depth={3} style={{borderRadius:"24px 24px 0 0",padding:"20px 16px 32px",display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:16,fontWeight:600,color:txt.primary}}>Ny h{"\u00e4"}ndelse</span><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:txt.tertiary,fontSize:13}}>Avbryt</button></div>
    <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Titel" style={glassInput} autoFocus/>
    <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={glassInput}/>
    <div style={{display:"flex",gap:8}}><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} style={{...glassInput,flex:1}}/><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} style={{...glassInput,flex:1}}/></div>
    <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Plats (valfritt)" style={glassInput}/>
    <div style={{display:"flex",gap:6}}>{EVENT_COLORS.map(c=>(<button key={c.color} onClick={()=>setColor(c.color)} style={{width:28,height:28,borderRadius:"50%",background:c.color,border:color===c.color?"3px solid #fff":"3px solid transparent",cursor:"pointer",padding:0,boxShadow:color===c.color?`0 0 10px ${c.color}40`:"none"}}/>))}</div>
    <button onClick={()=>setShared(s=>!s)} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"10px 14px",cursor:"pointer",color:txt.secondary,fontSize:12}}>{shared?<><Users size={14} strokeWidth={1.8} style={{marginRight:6}}/> Delad med hush\u00e5llet</>:<><Lock size={14} strokeWidth={1.8} style={{marginRight:6}}/> Bara f\u00f6r mig</>}</button>
    <button onClick={()=>{if(!title.trim())return;onSave({title:title.trim(),start_time:date+"T"+startTime+":00",end_time:date+"T"+endTime+":00",location:location.trim()||null,color,shared})}} style={{...glassBtn(false),opacity:title.trim()?1:0.4}}>L{"\u00e4"}gg till</button>
  </Glass></div>)
}

function AddListModal({onSave,onClose}){
  const[name,setName]=useState("");const[shared,setShared]=useState(true);const[color,setColor]=useState(LIST_COLORS[0]);const[hasExpiry,setHasExpiry]=useState(false);const[expiryDate,setExpiryDate]=useState("")
  return(<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}><Glass depth={3} style={{borderRadius:"24px 24px 0 0",padding:"20px 16px 32px",display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:16,fontWeight:600,color:txt.primary}}>Ny lista</span><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:txt.tertiary,fontSize:13}}>Avbryt</button></div>
    <input value={name} onChange={e=>setName(e.target.value)} placeholder={"Namn p\u00e5 listan"} style={glassInput} autoFocus/>
    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{LIST_COLORS.map(c=>(<button key={c} onClick={()=>setColor(c)} style={{width:26,height:26,borderRadius:"50%",background:c,border:color===c?"3px solid #fff":"3px solid transparent",cursor:"pointer",padding:0}}/>))}</div>
    <button onClick={()=>setShared(s=>!s)} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"10px 14px",cursor:"pointer",color:txt.secondary,fontSize:12}}>{shared?<><Users size={14} strokeWidth={1.8} style={{marginRight:6}}/> Delad med hush\u00e5llet</>:<><Lock size={14} strokeWidth={1.8} style={{marginRight:6}}/> Privat lista</>}</button>
    <button onClick={()=>setHasExpiry(h=>!h)} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"10px 14px",cursor:"pointer",color:txt.secondary,fontSize:12}}>{hasExpiry?"\u23f0 Utg\u00e5ngsdatum":"\u221e Ingen tidsgr\u00e4ns"}</button>
    {hasExpiry&&<input type="date" value={expiryDate} onChange={e=>setExpiryDate(e.target.value)} style={glassInput}/>}
    <button onClick={()=>{if(!name.trim())return;onSave({name:name.trim(),shared,color,expires_at:hasExpiry&&expiryDate?expiryDate+"T23:59:59":null})}} style={{...glassBtn(false),opacity:name.trim()?1:0.4}}>Skapa lista</button>
  </Glass></div>)
}

// ── Calendar widget (inline events) ──
function CalendarCard({calEventsByDay}){
  async function handleSaveTvLayout(widgets){await supabase.from("tv_layouts").upsert({household_id:householdId,widgets,updated_at:new Date().toISOString()},{onConflict:"household_id"});setTvWidgets(widgets);setTvEditorOpen(false)}

  function handleAddWidget(id){setActiveWidgets(w=>[...w,id]);setWidgetPickerOpen(false)}
  function handleRemoveWidget(id){setActiveWidgets(w=>w.filter(x=>x!==id))}
  function handleMoveWidget(id,dir){setActiveWidgets(w=>{const i=w.indexOf(id);if(i<0)return w;const ni=i+dir;if(ni<0||ni>=w.length)return w;const nw=[...w];[nw[i],nw[ni]]=[nw[ni],nw[i]];return nw})}
  function handleResizeWidget(id){const r=WIDGET_REGISTRY[id];if(r)r.size=r.size==="full"?"half":"full";setActiveWidgets(w=>[...w])}

  const now=new Date();const[vm,setVm]=useState(now.getMonth());const[vy,setVy]=useState(now.getFullYear())
  const weeks=buildCal(vy,vm);const isToday=d=>d===now.getDate()&&vm===now.getMonth()&&vy===now.getFullYear()
  const eventsForView=(vm===now.getMonth()&&vy===now.getFullYear())?calEventsByDay:{}
  return(<Glass depth={2} style={{padding:"14px 14px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <button onClick={()=>{if(vm===0){setVm(11);setVy(y=>y-1)}else setVm(m=>m-1)}} style={{background:"none",border:"none",cursor:"pointer",color:txt.tertiary,fontSize:16}}>{"<"}</button>
      <Label>{MONTHS_FULL[vm]} {vy}</Label>
      <button onClick={()=>{if(vm===11){setVm(0);setVy(y=>y+1)}else setVm(m=>m+1)}} style={{background:"none",border:"none",cursor:"pointer",color:txt.tertiary,fontSize:16}}>{">"}</button>
    </div>
    <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed"}}>
      <thead><tr>{["M","T","O","T","F","L","S"].map((d,i)=>(<th key={i} style={{fontSize:9,color:i>=5?"rgba(167,139,250,0.6)":txt.tertiary,fontWeight:600,textAlign:"center",padding:"4px 0"}}>{d}</th>))}</tr></thead>
      <tbody>{weeks.map((week,wi)=>(<tr key={wi}>{week.map((d,di)=>{
        const today=d&&isToday(d);const evs=d?(eventsForView[d]||[]):[]
        return(<td key={di} style={{verticalAlign:"top",padding:"3px 1px",textAlign:"center"}}>
          {d&&(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,minHeight:evs.length>0?42:30}}>
            <div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,background:today?"rgba(167,139,250,0.5)":"transparent",boxShadow:today?"0 0 10px rgba(167,139,250,0.2)":"none",color:today?"#fff":di>=5?"rgba(167,139,250,0.6)":txt.secondary,fontSize:10,fontWeight:today?700:400,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Comfortaa'"}}>{d}</div>
            {evs.slice(0,2).map((ev,ei)=>(<div key={ei} style={{width:"100%",display:"flex",alignItems:"center",gap:1,paddingLeft:2,marginTop:1,borderLeft:`2px solid ${ev.color}`}}><span style={{fontSize:6.5,color:txt.calTime,fontFamily:"'Comfortaa'",flexShrink:0}}>{ev.time}</span><span style={{fontSize:6.5,color:txt.calEvent,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"left"}}>{ev.title}</span></div>))}
            {evs.length>2&&<div style={{fontSize:6,color:txt.muted}}>+{evs.length-2}</div>}
          </div>)}
        </td>)
      })}</tr>))}</tbody>
    </table>
  </Glass>)
}

// ── Meal widget ──
function MealCard({meals,onEdit}){
  async function handleSaveTvLayout(widgets){await supabase.from("tv_layouts").upsert({household_id:householdId,widgets,updated_at:new Date().toISOString()},{onConflict:"household_id"});setTvWidgets(widgets);setTvEditorOpen(false)}

  function handleAddWidget(id){setActiveWidgets(w=>[...w,id]);setWidgetPickerOpen(false)}
  function handleRemoveWidget(id){setActiveWidgets(w=>w.filter(x=>x!==id))}
  function handleMoveWidget(id,dir){setActiveWidgets(w=>{const i=w.indexOf(id);if(i<0)return w;const ni=i+dir;if(ni<0||ni>=w.length)return w;const nw=[...w];[nw[i],nw[ni]]=[nw[ni],nw[i]];return nw})}
  function handleResizeWidget(id){const r=WIDGET_REGISTRY[id];if(r)r.size=r.size==="full"?"half":"full";setActiveWidgets(w=>[...w])}

  const now=new Date();const todayIdx=now.getDay()===0?6:now.getDay()-1
  const[editingDay,setEditingDay]=useState(null);const[editText,setEditText]=useState("");const inputRef=useRef(null)
  const byDay={};meals.forEach(m=>{byDay[m.weekday-1]=m.meal_text})
  function startEdit(i){if(!onEdit)return;setEditingDay(i);setEditText(byDay[i]||"");setTimeout(()=>inputRef.current?.focus(),50)}
  function saveEdit(){if(editingDay===null)return;onEdit(editingDay+1,editText.trim());setEditingDay(null);setEditText("")}
  return(<Glass depth={2} style={{padding:"14px 14px",display:"flex",flexDirection:"column"}}>
    <Label>Matsedel</Label>
    <div style={{display:"flex",flexDirection:"column",gap:3,marginTop:10}}>
      {MEAL_DAYS.map((day,i)=>{const isToday=i===todayIdx;return(<div key={i} style={{display:"flex",gap:6,alignItems:"center",padding:isToday?"5px 8px":"3px 8px",borderRadius:9,background:isToday?"rgba(255,255,255,0.06)":"transparent",border:isToday?"1px solid rgba(255,255,255,0.06)":"1px solid transparent"}}>
        <span style={{fontFamily:"'Comfortaa'",fontSize:9,fontWeight:isToday?600:400,color:isToday?txt.accent:txt.muted,minWidth:24,textAlign:"right"}}>{day}</span>
        {editingDay===i?(<input ref={inputRef} value={editText} onChange={e=>setEditText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveEdit();if(e.key==="Escape")setEditingDay(null)}} onBlur={saveEdit} style={{...glassInput,padding:"4px 8px",fontSize:11,flex:1}}/>):(<span onClick={()=>startEdit(i)} style={{fontSize:11,color:isToday?txt.primary:txt.tertiary,fontWeight:isToday?600:400,flex:1,cursor:onEdit?"pointer":"default"}}>{byDay[i]||<span style={{color:txt.muted,fontStyle:"italic"}}>{onEdit?"Klicka...":"\u2014"}</span>}</span>)}
      </div>)})}
    </div>
  </Glass>)
}

// ── Todo widget (for Hem) ──
function TodoCard({todos,onToggle}){
  const remaining=todos.filter(i=>!i.done).length
  return(<Glass depth={2} style={{padding:"14px 14px",display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <Label>Att g{"\u00f6"}ra</Label>
      <span style={{fontFamily:"'Comfortaa'",fontSize:9,fontWeight:500,color:GREEN,background:"rgba(74,222,128,0.08)",padding:"3px 9px",borderRadius:20,border:"1px solid rgba(74,222,128,0.08)"}}>{remaining}</span>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {todos.length===0&&<span style={{fontSize:11,color:txt.muted,fontStyle:"italic"}}>Inga uppgifter</span>}
      {todos.slice(0,6).map(t=>(<div key={t.id} style={{display:"flex",alignItems:"center",gap:8}}>
        <div onClick={()=>onToggle(t)} style={{width:16,height:16,borderRadius:"50%",border:t.done?"none":"1.5px solid rgba(255,255,255,0.1)",background:t.done?"linear-gradient(135deg, #4ade80, #22c55e)":"rgba(255,255,255,0.02)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:t.done?"0 2px 8px rgba(74,222,128,0.18)":"inset 0 1px 2px rgba(0,0,0,0.06)",cursor:"pointer",fontSize:8,color:"#fff"}}>{t.done?"\u2713":""}</div>
        <span onClick={()=>onToggle(t)} style={{fontSize:11,color:t.done?txt.muted:txt.secondary,textDecoration:t.done?"line-through":"none",lineHeight:1.3,cursor:"pointer"}}>{t.text}</span>
      </div>))}
    </div>
  </Glass>)
}

// ── Events today widget ──
function EventsCard({eventsToday,onDelete}){
  return(<Glass depth={2} style={{padding:"14px 14px",display:"flex",flexDirection:"column",gap:8}}>
    <Label>Idag</Label>
    {eventsToday.length===0&&<span style={{fontSize:11,color:txt.muted,fontStyle:"italic"}}>Inget inplanerat</span>}
    {eventsToday.map(e=>(<GlassInner key={e.id} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px"}}>
      <div style={{width:3,height:28,borderRadius:2,background:e.color,flexShrink:0,boxShadow:`0 0 8px ${e.color}30`}}/>
      <div style={{flex:1}}>
        <div style={{fontFamily:"'Comfortaa'",fontSize:10,color:txt.calTime}}>{e.start}</div>
        <div style={{fontSize:12,color:txt.primary,fontWeight:500,marginTop:2}}>{e.title}</div>
        {e.location&&<div style={{fontSize:9,color:txt.muted,marginTop:2}}><MapPin size={9} strokeWidth={2} color={txt.muted} style={{flexShrink:0}}/> {e.location}</div>}
      </div>
      {onDelete&&<button onClick={()=>onDelete(e.id)} style={{background:"none",border:"none",cursor:"pointer",color:txt.muted,fontSize:14}}>{"\u00d7"}</button>}
    </GlassInner>))}
  </Glass>)
}

// ── Weather widget ──
function WeatherCard({weather}){
  if(!weather)return(<Glass depth={2} style={{padding:20,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:txt.muted,fontSize:11}}>Laddar v{"\u00e4"}der...</span></Glass>)
  return(<Glass depth={2} style={{padding:"14px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
    {weather.code!==undefined?<WmoIcon code={weather.code} size={36} color={txt.secondary}/>:<span style={{fontSize:32}}>{weather.icon}</span>}
    <span style={{fontFamily:"'Comfortaa'",fontSize:28,fontWeight:200,color:txt.primary}}>{weather.temp}{"\u00b0"}</span>
    <span style={{fontSize:10,color:txt.tertiary}}>{weather.desc} {"\u00b7"} {weather.location}</span>
    <span style={{fontSize:9,color:txt.muted}}>Vind: {weather.wind} m/s</span>
    <div style={{display:"flex",gap:10,marginTop:6}}>{weather.forecast.map(w=>(<div key={w.day} style={{textAlign:"center"}}><div style={{fontSize:9,color:txt.tertiary}}>{w.day}</div>{w.code!==undefined?<WmoIcon code={w.code} size={16} color={txt.tertiary}/>:<div style={{fontSize:14}}>{w.icon}</div>}<div style={{fontFamily:"'Comfortaa'",fontSize:10,color:txt.secondary}}>{w.temp}</div></div>))}</div>
  </Glass>)
}

// ── Lists tab ──
function ListsTab({lists,todos,onAddList,onDeleteList,onAddTodo,onToggleTodo,onDeleteTodo}){
  const[expanded,setExpanded]=useState({});const[addingTo,setAddingTo]=useState(null);const[newText,setNewText]=useState("")
  function handleAdd(listId){if(!newText.trim())return;onAddTodo(newText.trim(),listId);setNewText("");setAddingTo(null)}
  return(<div style={{height:"100%",overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
    <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={onAddList} style={{background:ACCENT,color:"#fff",border:"none",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",boxShadow:`0 0 12px ${ACCENT}30`}}>+ Ny lista</button></div>
    {lists.map(list=>{const listTodos=todos.filter(t=>t.list_id===list.id);const remaining=listTodos.filter(t=>!t.done).length;const isOpen=expanded[list.id]!==false;const dl=daysLeft(list.expires_at)
      return(<Glass key={list.id} depth={2} style={{overflow:"hidden"}}>
        <div onClick={()=>setExpanded(p=>({...p,[list.id]:!p[list.id]}))} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer",borderBottom:isOpen?"1px solid rgba(255,255,255,0.05)":"none"}}>
          <div style={{width:4,height:24,borderRadius:2,background:list.color,flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:600,color:txt.primary}}>{list.name}</span>{!list.shared&&<span style={{fontSize:9,color:txt.muted}}><Lock size={10} strokeWidth={2} color={txt.muted}/></span>}</div>
            <div style={{display:"flex",gap:8,marginTop:2}}><span style={{fontSize:10,color:txt.tertiary}}>{remaining} kvar</span>{dl!==null&&<span style={{fontSize:10,color:dl<=2?RED:dl<=5?AMBER:txt.tertiary}}>{dl<=0?"Utg\u00e5ngen":dl+" dagar kvar"}</span>}</div>
          </div>
          <span style={{fontSize:12,color:txt.muted}}>{isOpen?"\u25b2":"\u25bc"}</span>
          <button onClick={e=>{e.stopPropagation();onDeleteList(list.id)}} style={{background:"none",border:"none",cursor:"pointer",color:txt.muted,fontSize:14}}>{"\u00d7"}</button>
        </div>
        {isOpen&&(<div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
          {listTodos.map(item=>(<div key={item.id} style={{display:"flex",alignItems:"center",gap:7}}>
            <div onClick={()=>onToggleTodo(item)} style={{width:15,height:15,borderRadius:"50%",flexShrink:0,border:item.done?"none":"1.5px solid rgba(255,255,255,0.1)",background:item.done?"linear-gradient(135deg, #4ade80, #22c55e)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff",cursor:"pointer",boxShadow:item.done?"0 2px 6px rgba(74,222,128,0.15)":"none"}}>{item.done?"\u2713":""}</div>
            <span onClick={()=>onToggleTodo(item)} style={{fontSize:12,color:item.done?txt.muted:txt.secondary,textDecoration:item.done?"line-through":"none",flex:1,cursor:"pointer"}}>{item.text}</span>
            <button onClick={()=>onDeleteTodo(item)} style={{background:"none",border:"none",cursor:"pointer",color:txt.muted,fontSize:12}}>{"\u00d7"}</button>
          </div>))}
          {addingTo===list.id?(<div style={{display:"flex",gap:6}}><input value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleAdd(list.id);if(e.key==="Escape"){setAddingTo(null);setNewText("")}}} placeholder="Ny uppgift..." style={{...glassInput,flex:1,padding:"6px 10px",fontSize:12}} autoFocus/><button onClick={()=>handleAdd(list.id)} style={{background:ACCENT,color:"#fff",border:"none",borderRadius:10,padding:"0 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>+</button></div>):(<button onClick={()=>setAddingTo(list.id)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 0",color:txt.tertiary,fontSize:11}}>+ L{"\u00e4"}gg till uppgift</button>)}
        </div>)}
      </Glass>)
    })}
    {lists.length===0&&<Glass depth={1} style={{padding:24,textAlign:"center"}}><span style={{color:txt.muted,fontSize:12}}>Inga listor {"\u00e4"}n. Skapa en!</span></Glass>}
  </div>)
}

// ── Full calendar tab ──
function FullKalTab({events,onAddEvent,onDeleteEvent}){
  async function handleSaveTvLayout(widgets){await supabase.from("tv_layouts").upsert({household_id:householdId,widgets,updated_at:new Date().toISOString()},{onConflict:"household_id"});setTvWidgets(widgets);setTvEditorOpen(false)}

  function handleAddWidget(id){setActiveWidgets(w=>[...w,id]);setWidgetPickerOpen(false)}
  function handleRemoveWidget(id){setActiveWidgets(w=>w.filter(x=>x!==id))}
  function handleMoveWidget(id,dir){setActiveWidgets(w=>{const i=w.indexOf(id);if(i<0)return w;const ni=i+dir;if(ni<0||ni>=w.length)return w;const nw=[...w];[nw[i],nw[ni]]=[nw[ni],nw[i]];return nw})}
  function handleResizeWidget(id){const r=WIDGET_REGISTRY[id];if(r)r.size=r.size==="full"?"half":"full";setActiveWidgets(w=>[...w])}

  const now=new Date();const[vm,setVm]=useState(now.getMonth());const[vy,setVy]=useState(now.getFullYear())
  const weeks=buildCal(vy,vm);const isToday=d=>d===now.getDate()&&vm===now.getMonth()&&vy===now.getFullYear()
  const eventsByDay=useMemo(()=>groupEventsByDay(events,vy,vm),[events,vy,vm])
  return(<div style={{height:"100%",overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
    <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={onAddEvent} style={{background:ACCENT,color:"#fff",border:"none",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",boxShadow:`0 0 12px ${ACCENT}30`}}>+ Ny h{"\u00e4"}ndelse</button></div>
    <Glass depth={2} style={{padding:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={()=>{if(vm===0){setVm(11);setVy(y=>y-1)}else setVm(m=>m-1)}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:txt.tertiary}}>{"<"}</button>
        <Label>{MONTHS_FULL[vm]} {vy}</Label>
        <button onClick={()=>{if(vm===11){setVm(0);setVy(y=>y+1)}else setVm(m=>m+1)}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:txt.tertiary}}>{">"}</button>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed"}}>
        <thead><tr><th style={{width:20,fontSize:8,color:txt.muted,textAlign:"center"}}>#</th>{["M\u00e5n","Tis","Ons","Tor","Fre","L\u00f6r","S\u00f6n"].map((d,i)=>(<th key={d} style={{fontSize:9,color:i>=5?"rgba(167,139,250,0.6)":txt.tertiary,fontWeight:600,textAlign:"center",padding:"6px 2px"}}>{d}</th>))}</tr></thead>
        <tbody>{weeks.map((week,wi)=>(<tr key={wi} style={{borderTop:"1px solid rgba(255,255,255,0.03)"}}>
          <td style={{textAlign:"center",fontSize:8,color:txt.muted}}>{week.find(d=>d)?getISOWeek(new Date(vy,vm,week.find(d=>d))):""}</td>
          {week.map((d,di)=>{const evs=d?(eventsByDay[d]||[]):[];const today=d&&isToday(d)
            return(<td key={di} style={{padding:"3px 1px",verticalAlign:"top",textAlign:"center",background:today?"rgba(167,139,250,0.06)":"transparent"}}>
              {d&&(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,minHeight:evs.length>0?42:28}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:today?"rgba(167,139,250,0.5)":"transparent",color:today?"#fff":di>=5?"rgba(167,139,250,0.6)":txt.secondary,fontSize:10,fontWeight:today?700:400,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Comfortaa'"}}>{d}</div>
                {evs.slice(0,2).map((ev,ei)=>(<div key={ei} style={{width:"100%",display:"flex",alignItems:"center",gap:1,paddingLeft:2,marginTop:1,borderLeft:`2px solid ${ev.color}`}}><span style={{fontSize:6.5,color:txt.calTime,fontFamily:"'Comfortaa'",flexShrink:0}}>{ev.time}</span><span style={{fontSize:6.5,color:txt.calEvent,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"left"}}>{ev.title}</span></div>))}
              </div>)}
            </td>)
          })}
        </tr>))}</tbody>
      </table>
    </Glass>
    <Glass depth={2} style={{padding:14}}>
      <Label>Kommande</Label>
      <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
        {events.filter(e=>new Date(e.start_time)>=new Date(new Date().setHours(0,0,0,0))).slice(0,10).map(ev=>(<GlassInner key={ev.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px"}}>
          <div style={{width:3,height:24,background:ev.color||ACCENT,borderRadius:2,flexShrink:0}}/>
          <div style={{flex:1}}><div style={{fontSize:9,color:txt.calTime}}>{new Date(ev.start_time).toLocaleDateString("sv-SE")} {fmtTime(ev.start_time)}</div><div style={{fontSize:12,color:txt.primary,fontWeight:500}}>{ev.title}{ev.shared===false&&<span style={{fontSize:8,color:txt.muted,marginLeft:4}}><Lock size={10} strokeWidth={2} color={txt.muted}/></span>}</div></div>
          <button onClick={()=>onDeleteEvent(ev.id)} style={{background:"none",border:"none",cursor:"pointer",color:RED,fontSize:14}}>{"\u00d7"}</button>
        </GlassInner>))}
      </div>
    </Glass>
  </div>)
}

// ── Settings tab ──
function SettingsTab({householdId,userId,householdName,onOpenTvEditor}){
  const[inviteCode,setInviteCode]=useState(null);const[creating,setCreating]=useState(false);const[members,setMembers]=useState([]);const[copied,setCopied]=useState(false)
  useEffect(()=>{if(!householdId)return;supabase.from("household_members").select("user_id,role,joined_at").eq("household_id",householdId).then(({data})=>{if(data)setMembers(data)})},[householdId])
  async function createInvite(){setCreating(true);const code=genCode();const{error}=await supabase.from("invites").insert({household_id:householdId,code,created_by:userId});if(!error)setInviteCode(code);setCreating(false)}
  function copyCode(){if(!inviteCode)return;navigator.clipboard.writeText(inviteCode).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})}
  return(<div style={{height:"100%",overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>
    <Glass depth={2} style={{padding:16}}>
      <div style={{fontSize:14,fontWeight:600,color:txt.primary,marginBottom:12}}>Hush{"\u00e5"}ll: {householdName}</div>
      <Label>Medlemmar</Label>
      <div style={{marginTop:8}}>{members.map((m,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<members.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
        <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(167,139,250,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:ACCENT,fontWeight:600}}>{m.user_id===userId?"Du":String(i+1)}</div>
        <div style={{flex:1}}><div style={{fontSize:12,color:txt.primary}}>{m.user_id===userId?"Du":"Medlem "+(i+1)}</div><div style={{fontSize:10,color:txt.tertiary}}>{m.role}</div></div>
      </div>))}</div>
    </Glass>
    <Glass depth={2} style={{padding:16}}>
      <button onClick={()=>onOpenTvEditor&&onOpenTvEditor()} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px",cursor:"pointer",color:txt.secondary,fontSize:13,fontWeight:500,marginBottom:12}}><Monitor size={16}/> Redigera TV-vy</button>
      <Label>Bjud in</Label>
      {!inviteCode?(<button onClick={createInvite} disabled={creating} style={{...glassBtn(creating),marginTop:12}}>{creating?"Skapar kod...":"Skapa inbjudningskod"}</button>):(<div style={{textAlign:"center",marginTop:12}}>
        <div style={{fontSize:10,color:txt.tertiary,marginBottom:8}}>Dela denna kod</div>
        <div onClick={copyCode} style={{fontFamily:"'Comfortaa'",fontSize:32,fontWeight:700,letterSpacing:"0.15em",color:ACCENT,cursor:"pointer",padding:"14px",background:"rgba(167,139,250,0.1)",borderRadius:16,marginBottom:8,border:"1px solid rgba(167,139,250,0.15)"}}>{inviteCode}</div>
        <div style={{fontSize:10,color:copied?GREEN:txt.muted}}>{copied?"Kopierad!":"Tryck f\u00f6r att kopiera \u00b7 Giltig i 7 dagar"}</div>
        <button onClick={()=>setInviteCode(null)} style={{marginTop:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"8px 16px",fontSize:12,color:txt.secondary,cursor:"pointer"}}>Skapa ny kod</button>
      </div>)}
    </Glass>
  </div>)
}

// ── Clock hero ──
function ClockHero({weather,bgUrl}){
  const[time,setTime]=useState(new Date())
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t)},[])
  const h=String(time.getHours()).padStart(2,"0"),m=String(time.getMinutes()).padStart(2,"0")
  const monthsShort=["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"]
  const wi=weather||{icon:"\u2601\ufe0f",temp:"--",desc:"Laddar..."}
  return(<div style={{padding:"50px 26px 10px",position:"relative"}}>
    <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)",pointerEvents:"none"}}/>
    <div style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div>
        <div style={{fontFamily:"'Comfortaa', sans-serif",fontSize:72,fontWeight:200,color:"#fff",letterSpacing:"-0.06em",lineHeight:0.85,textShadow:"0 2px 20px rgba(0,0,0,0.5)",fontVariantNumeric:"tabular-nums"}}>{h}<span style={{opacity:0.25}}>:</span>{m}</div>
        <div style={{fontSize:14,color:txt.secondary,marginTop:8,textShadow:"0 1px 6px rgba(0,0,0,0.5)",fontWeight:500}}>{WEEKDAYS_SV[time.getDay()]} {"\u00b7"} {time.getDate()} {monthsShort[time.getMonth()]}</div>
      </div>
      <Glass depth={2} style={{borderRadius:20,padding:"12px 16px",textAlign:"center",minWidth:76}}>
        {wi.code!==undefined?<WmoIcon code={wi.code} size={26} color={txt.secondary}/>:<div style={{fontSize:24}}>{wi.icon}</div>}
        <div style={{fontFamily:"'Comfortaa'",fontSize:22,fontWeight:200,color:txt.primary,marginTop:4}}>{wi.temp}{"\u00b0"}</div>
        <div style={{fontSize:8,color:txt.tertiary,marginTop:2}}>{wi.desc}</div>
      </Glass>
    </div>
    {weather&&weather.forecast&&(<div style={{position:"relative",display:"flex",gap:8,marginTop:14}}>
      {weather.forecast.map(w=>(<Glass key={w.day} depth={1} style={{padding:"7px 12px",textAlign:"center",minWidth:48,borderRadius:14}}>
        <div style={{fontSize:9,color:txt.secondary,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>{w.day}</div>
        {w.code!==undefined?<WmoIcon code={w.code} size={18} color={txt.secondary}/>:<div style={{fontSize:15,marginTop:3}}>{w.icon}</div>}
        <div style={{fontFamily:"'Comfortaa'",fontSize:11,color:txt.secondary,fontWeight:300,marginTop:2}}>{w.temp}</div>
      </Glass>))}
    </div>)}
  </div>)
}


// ── Widget Picker ──
function WidgetPicker({activeWidgets,onAdd,onClose}){
  const available=Object.entries(WIDGET_REGISTRY).filter(([id])=>!activeWidgets.includes(id))
  return(<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}><Glass depth={3} style={{borderRadius:"24px 24px 0 0",padding:"20px 16px 32px",display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:16,fontWeight:600,color:txt.primary}}>L\u00e4gg till widget</span><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:txt.tertiary,fontSize:13}}>St\u00e4ng</button></div>
    {available.length===0&&<span style={{fontSize:12,color:txt.muted}}>Alla widgets \u00e4r redan tillagda</span>}
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {available.map(([id,w])=>(<button key={id} onClick={()=>onAdd(id)} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"12px 16px",cursor:"pointer",width:"100%",textAlign:"left"}}>
        {w.code!==undefined?<WmoIcon code={w.code} size={18} color={txt.tertiary}/>:<span style={{fontSize:14}}>{w.icon}</span>}
        <div style={{flex:1}}><div style={{fontSize:14,color:txt.primary,fontWeight:500}}>{w.label}</div><div style={{fontSize:11,color:txt.tertiary}}>{w.size==="full"?"Hel bredd":"Halv bredd"}</div></div>
      </button>))}
    </div>
  </Glass></div>)
}

// ── Home Dashboard with widget system ──
function HomeDashboard({activeWidgets,editingWidgets,onRemoveWidget,onMoveWidget,onResizeWidget,calEventsByDay,sharedTodos,onToggleTodo,meals,onUpsertMeal,weather,eventsToday,onDeleteEvent}){
  const renderWidget=(id)=>{
    switch(id){
      case"calendar":return <CalendarCard calEventsByDay={calEventsByDay}/>
      case"todo":return <TodoCard todos={sharedTodos} onToggle={onToggleTodo}/>
      case"meal":return <MealCard meals={meals} onEdit={onUpsertMeal}/>
      case"weather":return <WeatherCard weather={weather}/>
      case"events":return <EventsCard eventsToday={eventsToday} onDelete={onDeleteEvent}/>
      default:return null
    }
  }

  function WidgetWrapper({id,children}){
    const idx=activeWidgets.indexOf(id)
    const reg=WIDGET_REGISTRY[id]
    const isFirst=idx===0,isLast=idx===activeWidgets.length-1
    if(!editingWidgets)return children
    return(<div style={{position:"relative"}}>
      {children}
      <div style={{position:"absolute",top:6,right:6,display:"flex",gap:4,zIndex:5}}>
        {!isFirst&&<button onClick={()=>onMoveWidget(id,-1)} style={{width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",fontSize:10,padding:0}}><ChevronUp size={12} strokeWidth={2.5}/></button>}
        {!isLast&&<button onClick={()=>onMoveWidget(id,1)} style={{width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",fontSize:10,padding:0}}><ChevronDown size={12} strokeWidth={2.5}/></button>}
        <button onClick={()=>onResizeWidget(id)} style={{width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",fontSize:9,padding:0}}>{reg?.size==="full"?"\u00bd":"1"}</button>
        <button onClick={()=>onRemoveWidget(id)} style={{width:22,height:22,borderRadius:"50%",background:"rgba(220,50,50,0.8)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0}}><XIcon size={11} strokeWidth={2.5} color="#fff"/></button>
      </div>
    </div>)
  }

  // Build layout from activeWidgets with current sizes
  const items=activeWidgets.map(id=>({id,size:WIDGET_REGISTRY[id]?.size||"half"}))
  const rendered=[]
  let halfBuf=[]

  items.forEach((item)=>{
    if(item.size==="full"){
      if(halfBuf.length>0){rendered.push({type:"grid",widgets:[...halfBuf]});halfBuf=[]}
      rendered.push({type:"full",widget:item})
    }else{
      halfBuf.push(item)
      if(halfBuf.length===2){rendered.push({type:"grid",widgets:[...halfBuf]});halfBuf=[]}
    }
  })
  if(halfBuf.length>0)rendered.push({type:"grid",widgets:[...halfBuf]})

  return(<>
    {rendered.map((row,ri)=>{
      if(row.type==="full")return <div key={ri}><WidgetWrapper id={row.widget.id}>{renderWidget(row.widget.id)}</WidgetWrapper></div>
      return(<div key={ri} style={{display:"grid",gridTemplateColumns:row.widgets.length===2?"1fr 1fr":"1fr",gap:10}}>
        {row.widgets.map(w=><div key={w.id}><WidgetWrapper id={w.id}>{renderWidget(w.id)}</WidgetWrapper></div>)}
      </div>)
    })}
  </>)
}

// ── TV Clock Widget ──
function TvClockWidget(){
  const[time,setTime]=useState(new Date())
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t)},[])
  const h=String(time.getHours()).padStart(2,"0"),m=String(time.getMinutes()).padStart(2,"0")
  const monthsShort=["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"]
  return(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:"100%",padding:"0 8px"}}>
    <div>
      <div style={{fontFamily:"'Comfortaa'",fontSize:48,fontWeight:300,color:"#fff",letterSpacing:"-0.04em",lineHeight:1,textShadow:"0 2px 12px rgba(0,0,0,0.3)"}}>{h}<span style={{opacity:0.25}}>:</span>{m}</div>
      <div style={{fontSize:12,color:txt.secondary,marginTop:4,textShadow:"0 1px 4px rgba(0,0,0,0.3)"}}>{WEEKDAYS_SV[time.getDay()]} \u00b7 {time.getDate()} {monthsShort[time.getMonth()]}</div>
    </div>
  </div>)
}

// ── TV Layout Editor ──
function TvEditor({householdId,tvWidgets,onSave,onClose,renderTvWidget}){
  const COLS=4,ROWS=6
  const[widgets,setWidgets]=useState(tvWidgets||DEFAULT_TV_WIDGETS)
  const[selected,setSelected]=useState(null)
  const[adding,setAdding]=useState(false)

  function isOccupied(x,y,exclude){
    return widgets.some(w=>{
      if(exclude&&w.id===exclude)return false
      return x>=w.x&&x<w.x+w.w&&y>=w.y&&y<w.y+w.h
    })
  }

  function canPlace(id,x,y,w,h){
    for(let dx=0;dx<w;dx++)for(let dy=0;dy<h;dy++){
      if(x+dx>=COLS||y+dy>=ROWS)return false
      if(isOccupied(x+dx,y+dy,id))return false
    }
    return true
  }

  function moveWidget(id,nx,ny){
    setWidgets(ws=>ws.map(w=>{
      if(w.id!==id)return w
      if(canPlace(id,nx,ny,w.w,w.h))return{...w,x:nx,y:ny}
      return w
    }))
  }

  function resizeWidget(id,nw,nh){
    setWidgets(ws=>ws.map(w=>{
      if(w.id!==id)return w
      const reg=TV_WIDGET_REGISTRY[id]
      const cw=Math.max(nw,reg?.minW||1),ch=Math.max(nh,reg?.minH||1)
      if(canPlace(id,w.x,w.y,cw,ch))return{...w,w:cw,h:ch}
      return w
    }))
  }

  function removeWidget(id){setWidgets(ws=>ws.filter(w=>w.id!==id));setSelected(null)}

  function addWidget(id){
    // Find first empty spot
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const reg=TV_WIDGET_REGISTRY[id]
      const w=reg?.minW||1,h=reg?.minH||1
      if(canPlace(id,x,y,w,h)){setWidgets(ws=>[...ws,{id,x,y,w,h}]);setAdding(false);return}
    }
    setAdding(false)
  }

  const cellSize=Math.floor((Math.min(380,typeof window!=="undefined"?window.innerWidth-64:380))/COLS)

  return(<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
    <Glass depth={3} style={{borderRadius:"24px 24px 0 0",maxHeight:"92%",display:"flex",flexDirection:"column",padding:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><Monitor size={16} color={txt.secondary}/><span style={{fontSize:15,fontWeight:600,color:txt.primary}}>Redigera TV-vy</span></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>onSave(widgets)} style={{display:"flex",alignItems:"center",gap:6,background:ACCENT,color:"#fff",border:"none",borderRadius:12,padding:"8px 16px",fontSize:12,fontWeight:600,cursor:"pointer"}}><Save size={13}/> Spara</button>
          <button onClick={onClose} style={{background:"none",border:"none",color:txt.tertiary,cursor:"pointer",fontSize:13}}>Avbryt</button>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
        {/* Grid preview */}
        <div style={{position:"relative",width:cellSize*COLS,height:cellSize*ROWS,margin:"0 auto",background:"rgba(255,255,255,0.02)",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)"}}>
          {/* Grid lines */}
          {Array.from({length:COLS-1}).map((_,i)=>(<div key={"vc"+i} style={{position:"absolute",left:(i+1)*cellSize,top:0,bottom:0,width:1,background:"rgba(255,255,255,0.04)"}}/>))}
          {Array.from({length:ROWS-1}).map((_,i)=>(<div key={"hr"+i} style={{position:"absolute",top:(i+1)*cellSize,left:0,right:0,height:1,background:"rgba(255,255,255,0.04)"}}/>))}

          {/* Widgets */}
          {widgets.map(w=>{
            const isSel=selected===w.id
            const reg=TV_WIDGET_REGISTRY[w.id]
            return(<div key={w.id} onClick={(e)=>{e.stopPropagation();setSelected(isSel?null:w.id)}} style={{
              position:"absolute",
              left:w.x*cellSize+2,top:w.y*cellSize+2,
              width:w.w*cellSize-4,height:w.h*cellSize-4,
              background:"rgba(255,255,255,0.06)",
              backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",
              border:isSel?"2px solid "+ACCENT:"1px solid rgba(255,255,255,0.1)",
              borderRadius:10,
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              cursor:"pointer",overflow:"hidden",
              boxShadow:isSel?"0 0 12px rgba(167,139,250,0.2)":"none",
              transition:"border 0.15s, box-shadow 0.15s",
            }}>
              <span style={{fontSize:16}}>{reg?.icon||"?"}</span>
              <span style={{fontSize:9,color:txt.secondary,fontWeight:500,marginTop:2}}>{reg?.label||w.id}</span>
            </div>)
          })}
        </div>

        {/* Selected widget controls */}
        {selected&&(()=>{
          const sw=widgets.find(w=>w.id===selected)
          if(!sw)return null
          return(<Glass depth={1} style={{padding:12,marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:600,color:txt.primary}}>{TV_WIDGET_REGISTRY[selected]?.label}</span>
              <button onClick={()=>removeWidget(selected)} style={{display:"flex",alignItems:"center",gap:4,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"4px 10px",cursor:"pointer",color:RED,fontSize:11,fontWeight:500}}><XIcon size={11}/> Ta bort</button>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:11,color:txt.tertiary,minWidth:50}}>Position</span>
              <button onClick={()=>moveWidget(selected,Math.max(0,sw.x-1),sw.y)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:txt.secondary,fontSize:11}}>\u2190</button>
              <button onClick={()=>moveWidget(selected,Math.min(COLS-sw.w,sw.x+1),sw.y)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:txt.secondary,fontSize:11}}>\u2192</button>
              <button onClick={()=>moveWidget(selected,sw.x,Math.max(0,sw.y-1))} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:txt.secondary,fontSize:11}}>\u2191</button>
              <button onClick={()=>moveWidget(selected,sw.x,Math.min(ROWS-sw.h,sw.y+1))} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:txt.secondary,fontSize:11}}>\u2193</button>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:11,color:txt.tertiary,minWidth:50}}>Storlek</span>
              <button onClick={()=>resizeWidget(selected,sw.w-1,sw.h)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:txt.secondary,fontSize:11}}>W-</button>
              <button onClick={()=>resizeWidget(selected,sw.w+1,sw.h)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:txt.secondary,fontSize:11}}>W+</button>
              <button onClick={()=>resizeWidget(selected,sw.w,sw.h-1)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:txt.secondary,fontSize:11}}>H-</button>
              <button onClick={()=>resizeWidget(selected,sw.w,sw.h+1)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:txt.secondary,fontSize:11}}>H+</button>
              <span style={{fontSize:10,color:txt.muted,marginLeft:4}}>{sw.w}x{sw.h}</span>
            </div>
          </Glass>)
        })()}

        {/* Add widget */}
        {!adding?(<button onClick={()=>setAdding(true)} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"12px",background:"rgba(255,255,255,0.03)",border:"1px dashed rgba(255,255,255,0.1)",borderRadius:14,cursor:"pointer",color:txt.tertiary,fontSize:12,marginTop:12}}>
          <Plus size={14}/> L\u00e4gg till widget
        </button>):(
          <Glass depth={1} style={{padding:12,marginTop:12}}>
            <div style={{fontSize:11,fontWeight:600,color:txt.tertiary,marginBottom:8}}>V\u00e4lj widget</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {Object.entries(TV_WIDGET_REGISTRY).filter(([id])=>!widgets.some(w=>w.id===id)).map(([id,reg])=>(
                <button key={id} onClick={()=>addWidget(id)} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"8px 12px",cursor:"pointer"}}>
                  <span style={{fontSize:14}}>{reg.icon}</span>
                  <span style={{fontSize:11,color:txt.secondary}}>{reg.label}</span>
                </button>
              ))}
              {Object.entries(TV_WIDGET_REGISTRY).filter(([id])=>!widgets.some(w=>w.id===id)).length===0&&<span style={{fontSize:11,color:txt.muted}}>Alla widgets tillagda</span>}
            </div>
            <button onClick={()=>setAdding(false)} style={{background:"none",border:"none",color:txt.muted,cursor:"pointer",fontSize:11,marginTop:8}}>Avbryt</button>
          </Glass>
        )}
      </div>
    </Glass>
  </div>)
}

// ── TV View (fullscreen, no nav) ──
function TvView({tvWidgets,calEventsByDay,sharedTodos,onToggleTodo,meals,onUpsertMeal,weather,eventsToday,bgUrl}){
  const COLS=4,ROWS=6
  const widgets=tvWidgets||DEFAULT_TV_WIDGETS

  function renderTvWidget(id){
    switch(id){
      case"clock":return <TvClockWidget/>
      case"calendar":return <CalendarCard calEventsByDay={calEventsByDay}/>
      case"todo":return <TodoCard todos={sharedTodos} onToggle={onToggleTodo}/>
      case"meal":return <MealCard meals={meals} onEdit={null}/>
      case"weather":return <WeatherCard weather={weather}/>
      case"events":return <EventsCard eventsToday={eventsToday} onDelete={null}/>
      default:return null
    }
  }

  return(<div style={{fontFamily:"'Nunito', -apple-system, sans-serif",width:"100vw",height:"100vh",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",inset:-8,backgroundImage:`url(${bgUrl})`,backgroundSize:"cover",backgroundPosition:"center",filter:"scale(1.03)"}}/>
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.15)"}}/>
    <div style={{position:"relative",zIndex:1,width:"100%",height:"100%",display:"grid",gridTemplateColumns:"repeat("+COLS+",1fr)",gridTemplateRows:"repeat("+ROWS+",1fr)",gap:8,padding:12}}>
      {widgets.map(w=>(<div key={w.id} style={{gridColumn:(w.x+1)+" / span "+w.w,gridRow:(w.y+1)+" / span "+w.h}}>
        <Glass depth={2} style={{height:"100%",padding:10,display:"flex",flexDirection:"column"}}>
          {renderTvWidget(w.id)}
        </Glass>
      </div>))}
    </div>
  </div>)
}

// ── Desktop detection ──
function useIsDesktop(){
  const[isDesktop,setIsDesktop]=useState(typeof window!=="undefined"&&window.innerWidth>900)
  useEffect(()=>{function h(){setIsDesktop(window.innerWidth>900)};window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h)},[])
  return isDesktop
}

// ── Desktop Sidebar ──
function DesktopSidebar({activeTab,onTabChange,tabs}){
  return(<div style={{width:220,flexShrink:0,display:"flex",flexDirection:"column",height:"100%",padding:"20px 0"}}>
    {/* Logo */}
    <div style={{padding:"0 20px 24px",display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:32,height:32,borderRadius:10,background:"rgba(167,139,250,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><LayoutDashboard size={16} color="#a78bfa"/></div>
      <span style={{fontFamily:"'Comfortaa'",fontSize:16,fontWeight:600,color:txt.primary,letterSpacing:"-0.02em"}}>SmartHub</span>
    </div>
    {/* Nav items */}
    <div style={{flex:1,display:"flex",flexDirection:"column",gap:2,padding:"0 12px"}}>
      {tabs.map(t=>{const active=activeTab===t.key;return(
        <button key={t.key} onClick={()=>onTabChange(t.key)} style={{
          display:"flex",alignItems:"center",gap:12,
          background:active?"rgba(255,255,255,0.08)":"transparent",
          border:active?"1px solid rgba(255,255,255,0.06)":"1px solid transparent",
          borderRadius:14,padding:"10px 14px",cursor:"pointer",
          transition:"all 0.2s",width:"100%",textAlign:"left",
        }}>
          <t.Icon size={18} strokeWidth={active?2:1.5} color={active?txt.primary:txt.tertiary} style={{transition:"all 0.2s"}}/>
          <span style={{fontSize:13,fontWeight:active?600:400,color:active?txt.primary:txt.tertiary,transition:"color 0.2s"}}>{t.label}</span>
        </button>
      )})}
    </div>
    {/* Bottom info */}
    <div style={{padding:"16px 20px",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
      <div style={{fontSize:10,color:txt.muted}}>SmartHub v8</div>
    </div>
  </div>)
}

// ── Nav items ──
const TABS=[
  {key:"hem",label:"Hem",Icon:Home},
  {key:"kalender",label:"Kalender",Icon:CalendarDays},
  {key:"listor",label:"Listor",Icon:ListChecks},
  {key:"mat",label:"Mat",Icon:UtensilsCrossed},
  {key:"mer",label:"Mer",Icon:Settings},
]

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════
export default function SmartHub({session,household}){
  const userId=session?.user?.id,householdId=household?.id
  const[tab,setTab]=useState("hem")
  const[bgIdx,setBgIdx]=useState(0);const[customBg,setCustomBg]=useState(null);const[showPicker,setShowPicker]=useState(false)
  const[navOpen,setNavOpen]=useState(false);const[widgetPickerOpen,setWidgetPickerOpen]=useState(false);const[editingWidgets,setEditingWidgets]=useState(false);const[tvEditorOpen,setTvEditorOpen]=useState(false);const[tvWidgets,setTvWidgets]=useState(null)
  const[eventModalOpen,setEventModalOpen]=useState(false);const[listModalOpen,setListModalOpen]=useState(false)
  const[lists,setLists]=useState([]);const[todos,setTodos]=useState([]);const[calEvents,setCalEvents]=useState([]);const[meals,setMeals]=useState([]);const[weather,setWeather]=useState(null)
  const[loaded,setLoaded]=useState({todos:false,events:false,meals:false,lists:false});const[activeWidgets,setActiveWidgets]=useState(DEFAULT_WIDGETS)
  const fileRef=useRef(null)
  const isDesktop=useIsDesktop()

  const bgUrl=bgIdx>=0?BG_PRESETS[bgIdx].url:customBg
  function handleUpload(e){const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=(ev)=>{setCustomBg(ev.target.result);setBgIdx(-1);setShowPicker(false)};reader.readAsDataURL(file)}

  // Weather
  useEffect(()=>{async function f(){try{const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude="+WEATHER_LAT+"&longitude="+WEATHER_LON+"&current=temperature_2m,weathercode,windspeed_10m&daily=weathercode,temperature_2m_max&timezone=Europe/Stockholm&forecast_days=4");if(!r.ok)return;const j=await r.json();const p=parseWeather(j);if(p)setWeather(p)}catch(e){console.error("[weather]",e)}};f();const t=setInterval(f,30*60*1000);return()=>clearInterval(t)},[])

  // Load saved widget layout
  useEffect(()=>{if(!userId)return;let c=false;async function f(){const{data}=await supabase.from("layouts").select("assignments").eq("user_id",userId).maybeSingle();if(c)return;if(data&&data.assignments){if(Array.isArray(data.assignments))setActiveWidgets(data.assignments)}};f();return()=>{c=true}},[userId])

  // TV layout
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const{data}=await supabase.from("tv_layouts").select("widgets").eq("household_id",householdId).maybeSingle();if(c)return;if(data&&data.widgets)setTvWidgets(data.widgets)};f();const ch=supabase.channel("tv:"+householdId).on("postgres_changes",{event:"*",schema:"public",table:"tv_layouts",filter:"household_id=eq."+householdId},p=>{if(p.new&&p.new.widgets)setTvWidgets(p.new.widgets)}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId])

  // Lists
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const{data,error}=await supabase.from("lists").select("*").eq("household_id",householdId).order("created_at",{ascending:true});if(c)return;if(!error)setLists(data||[]);setLoaded(s=>({...s,lists:true}))};f();const ch=supabase.channel("lists:"+householdId).on("postgres_changes",{event:"*",schema:"public",table:"lists",filter:"household_id=eq."+householdId},p=>{setLists(prev=>{if(p.eventType==="INSERT")return prev.some(l=>l.id===p.new.id)?prev:[...prev,p.new];if(p.eventType==="UPDATE")return prev.map(l=>l.id===p.new.id?p.new:l);if(p.eventType==="DELETE")return prev.filter(l=>l.id!==p.old.id);return prev})}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId])

  // Todos
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const{data,error}=await supabase.from("todos").select("*").eq("household_id",householdId).order("created_at",{ascending:true});if(c)return;if(!error)setTodos(data||[]);setLoaded(s=>({...s,todos:true}))};f();const ch=supabase.channel("todos:"+householdId).on("postgres_changes",{event:"*",schema:"public",table:"todos",filter:"household_id=eq."+householdId},p=>{setTodos(prev=>{if(p.eventType==="INSERT")return prev.some(t=>t.id===p.new.id)?prev:[...prev,p.new];if(p.eventType==="UPDATE")return prev.map(t=>t.id===p.new.id?p.new:t);if(p.eventType==="DELETE")return prev.filter(t=>t.id!==p.old.id);return prev})}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId])

  // Events
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const now=new Date();const from=new Date(now.getFullYear(),now.getMonth()-6,1).toISOString();const to=new Date(now.getFullYear(),now.getMonth()+12,0).toISOString();const{data,error}=await supabase.from("calendar_events").select("*").eq("household_id",householdId).gte("start_time",from).lte("start_time",to).order("start_time",{ascending:true});if(c)return;if(!error)setCalEvents(data||[]);setLoaded(s=>({...s,events:true}))};f();const ch=supabase.channel("events:"+householdId).on("postgres_changes",{event:"*",schema:"public",table:"calendar_events",filter:"household_id=eq."+householdId},p=>{setCalEvents(prev=>{if(p.eventType==="INSERT")return prev.some(e=>e.id===p.new.id)?prev:[...prev,p.new];if(p.eventType==="UPDATE")return prev.map(e=>e.id===p.new.id?p.new:e);if(p.eventType==="DELETE")return prev.filter(e=>e.id!==p.old.id);return prev})}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId])

  // Meals
  const currentWeekStart=useMemo(()=>{const now=new Date();const day=now.getDay();const diff=day===0?6:day-1;const mon=new Date(now.getFullYear(),now.getMonth(),now.getDate()-diff);return mon.getFullYear()+"-"+String(mon.getMonth()+1).padStart(2,"0")+"-"+String(mon.getDate()).padStart(2,"0")},[])
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const{data,error}=await supabase.from("meals").select("*").eq("household_id",householdId).eq("week_start_date",currentWeekStart);if(c)return;if(!error)setMeals(data||[]);setLoaded(s=>({...s,meals:true}))};f();const ch=supabase.channel("meals:"+householdId+":"+currentWeekStart).on("postgres_changes",{event:"*",schema:"public",table:"meals",filter:"household_id=eq."+householdId},p=>{const row=p.new||p.old;if(!row||row.week_start_date!==currentWeekStart)return;setMeals(prev=>{if(p.eventType==="INSERT")return prev.some(m=>m.id===p.new.id)?prev:[...prev,p.new];if(p.eventType==="UPDATE")return prev.map(m=>m.id===p.new.id?p.new:m);if(p.eventType==="DELETE")return prev.filter(m=>m.id!==p.old.id);return prev})}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId,currentWeekStart])

  // Save widget layout
  useEffect(()=>{if(!userId)return;const t=setTimeout(async()=>{await supabase.from("layouts").upsert({user_id:userId,assignments:activeWidgets,updated_at:new Date().toISOString()},{onConflict:"user_id"})},500);return()=>clearTimeout(t)},[userId,activeWidgets])

  // CRUD
  async function handleToggleTodo(item){const nd=!item.done;setTodos(p=>p.map(t=>t.id===item.id?{...t,done:nd,completed_at:nd?new Date().toISOString():null}:t));const{error}=await supabase.from("todos").update({done:nd,completed_at:nd?new Date().toISOString():null}).eq("id",item.id);if(error)setTodos(p=>p.map(t=>t.id===item.id?item:t))}
  async function handleAddTodo(text,listId){const tmp={id:"tmp-"+Date.now(),household_id:householdId,text,done:false,list_id:listId,shared:true,created_by:userId,created_at:new Date().toISOString()};setTodos(p=>[...p,tmp]);const{data,error}=await supabase.from("todos").insert({household_id:householdId,text,done:false,list_id:listId,created_by:userId}).select().single();if(error)setTodos(p=>p.filter(t=>t.id!==tmp.id));else setTodos(p=>p.map(t=>t.id===tmp.id?data:t))}
  async function handleDeleteTodo(item){setTodos(p=>p.filter(t=>t.id!==item.id));await supabase.from("todos").delete().eq("id",item.id)}
  async function handleAddList(list){await supabase.from("lists").insert({household_id:householdId,name:list.name,shared:list.shared,color:list.color,expires_at:list.expires_at,created_by:userId});setListModalOpen(false)}
  async function handleDeleteList(id){setLists(p=>p.filter(l=>l.id!==id));await supabase.from("lists").delete().eq("id",id)}
  async function handleAddEvent(ev){await supabase.from("calendar_events").insert({household_id:householdId,title:ev.title,start_time:ev.start_time,end_time:ev.end_time,location:ev.location,color:ev.color,shared:ev.shared,created_by:userId});setEventModalOpen(false)}
  async function handleDeleteEvent(id){setCalEvents(p=>p.filter(e=>e.id!==id));await supabase.from("calendar_events").delete().eq("id",id)}
  async function handleUpsertMeal(weekday,text){if(!text){const ex=meals.find(m=>m.weekday===weekday);if(ex){setMeals(p=>p.filter(m=>m.id!==ex.id));await supabase.from("meals").delete().eq("id",ex.id)};return};const ex=meals.find(m=>m.weekday===weekday);if(ex){setMeals(p=>p.map(m=>m.id===ex.id?{...m,meal_text:text}:m));await supabase.from("meals").update({meal_text:text}).eq("id",ex.id)}else{const tmp={id:"tmp-"+Date.now(),household_id:householdId,week_start_date:currentWeekStart,weekday,meal_text:text};setMeals(p=>[...p,tmp]);const{data,error}=await supabase.from("meals").insert({household_id:householdId,week_start_date:currentWeekStart,weekday,meal_text:text}).select().single();if(error)setMeals(p=>p.filter(m=>m.id!==tmp.id));else setMeals(p=>p.map(m=>m.id===tmp.id?data:m))}}

  async function handleSaveTvLayout(widgets){await supabase.from("tv_layouts").upsert({household_id:householdId,widgets,updated_at:new Date().toISOString()},{onConflict:"household_id"});setTvWidgets(widgets);setTvEditorOpen(false)}

  function handleAddWidget(id){setActiveWidgets(w=>[...w,id]);setWidgetPickerOpen(false)}
  function handleRemoveWidget(id){setActiveWidgets(w=>w.filter(x=>x!==id))}
  function handleMoveWidget(id,dir){setActiveWidgets(w=>{const i=w.indexOf(id);if(i<0)return w;const ni=i+dir;if(ni<0||ni>=w.length)return w;const nw=[...w];[nw[i],nw[ni]]=[nw[ni],nw[i]];return nw})}
  function handleResizeWidget(id){const r=WIDGET_REGISTRY[id];if(r)r.size=r.size==="full"?"half":"full";setActiveWidgets(w=>[...w])}

  const now=new Date()
  const sharedEvents=calEvents.filter(e=>e.shared!==false)
  const calEventsByDay=useMemo(()=>groupEventsByDay(sharedEvents,now.getFullYear(),now.getMonth()),[sharedEvents])
  const eventsToday=useMemo(()=>getEventsToday(sharedEvents),[sharedEvents])
  const sharedTodos=todos.filter(t=>{const list=lists.find(l=>l.id===t.list_id);return!list||list.shared!==false})

  const isTV=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("mode")==="tv"

  // TV MODE - render fullscreen grid
  if(isTV){
    const tvBg=BG_PRESETS[0].url
    return(<>
      <style>{`body{margin:0;background:#111} @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;600;700&family=Nunito:wght@300;400;600;700&display=swap');`}</style>
      <TvView tvWidgets={tvWidgets} calEventsByDay={calEventsByDay} sharedTodos={sharedTodos} onToggleTodo={handleToggleTodo} meals={meals} onUpsertMeal={handleUpsertMeal} weather={weather} eventsToday={eventsToday} bgUrl={tvBg}/>
    </>)
  }

  const mainStyles=isDesktop
    ?{fontFamily:"'Nunito', -apple-system, sans-serif",display:"flex",height:"100vh",position:"relative",overflow:"hidden"}
    :{fontFamily:"'Nunito', -apple-system, sans-serif",maxWidth:"430px",margin:"0 auto",height:"100dvh",position:"relative",overflow:"hidden",boxShadow:"0 0 60px rgba(0,0,0,0.3)"}

  return(<>
    <style>{`
      @keyframes navSlide{from{opacity:0;transform:translateY(10px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes fabPulse{0%,100%{box-shadow:0 4px 20px rgba(0,0,0,0.3)}50%{box-shadow:0 4px 24px rgba(120,120,255,0.15)}}
      body{margin:0;background:#111}
      @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;600;700&family=Nunito:wght@300;400;600;700&display=swap');
    `}</style>
    <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{display:"none"}}/>
    <div style={mainStyles}>

      {/* Background */}
      <div style={{position:"absolute",inset:-8,backgroundImage:`url(${bgUrl})`,backgroundSize:"cover",backgroundPosition:"center",filter:"scale(1.03)",transition:"background-image 0.8s ease"}}/>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.15)"}}/>

      {/* Desktop sidebar */}
      {isDesktop&&<div style={{position:"relative",zIndex:2}}><Glass depth={1} style={{height:"100%",borderRadius:0,borderRight:"1px solid rgba(255,255,255,0.05)"}}><DesktopSidebar activeTab={tab} onTabChange={setTab} tabs={TABS}/></Glass></div>}

      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",flex:1,height:"100%"}}>

        {/* Clock + Weather */}
        <ClockHero weather={weather} bgUrl={bgUrl}/>

        {/* BG Picker button */}
        <button onClick={()=>setShowPicker(p=>!p)} style={{position:"absolute",top:50,right:26,zIndex:10,background:"rgba(0,0,0,0.25)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"6px 8px",cursor:"pointer",color:txt.tertiary}}><PaletteIcon size={14} strokeWidth={1.5} color={txt.tertiary}/></button>

        {showPicker&&(<Glass depth={3} style={{position:"absolute",top:82,right:26,padding:8,zIndex:30,minWidth:165,borderRadius:18}}>
          {BG_PRESETS.map((b,i)=>(<button key={b.id} onClick={()=>{setBgIdx(i);setCustomBg(null);setShowPicker(false)}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:bgIdx===i?"rgba(255,255,255,0.08)":"transparent",border:bgIdx===i?"1px solid rgba(255,255,255,0.08)":"1px solid transparent",borderRadius:12,padding:"7px 10px",cursor:"pointer",marginBottom:2}}>
            <div style={{width:28,height:28,borderRadius:8,backgroundImage:`url(${b.url})`,backgroundSize:"cover",backgroundPosition:"center",border:"1px solid rgba(255,255,255,0.06)"}}/>
            <span style={{fontSize:12,color:bgIdx===i?txt.primary:txt.tertiary,fontWeight:bgIdx===i?600:400}}>{b.label}</span>
          </button>))}
          <div style={{height:1,background:"rgba(255,255,255,0.04)",margin:"4px 0"}}/>
          <button onClick={()=>fileRef.current?.click()} style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:customBg?"rgba(255,255,255,0.08)":"transparent",border:customBg?"1px solid rgba(255,255,255,0.08)":"1px solid transparent",borderRadius:12,padding:"7px 10px",cursor:"pointer"}}>
            <div style={{width:28,height:28,borderRadius:8,background:customBg?undefined:"rgba(255,255,255,0.03)",backgroundImage:customBg?`url(${customBg})`:undefined,backgroundSize:"cover",backgroundPosition:"center",border:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:txt.muted}}>{!customBg&&"\ud83d\udcf7"}</div>
            <span style={{fontSize:12,color:customBg?txt.primary:txt.tertiary}}>{customBg?"Egen bild":"Ladda upp..."}</span>
          </button>
        </Glass>)}

        {/* Content */}
        <div style={{flex:1,padding:isDesktop?"16px 24px 24px":"8px 16px 80px",display:"flex",flexDirection:"column",gap:10,overflowY:"auto",minHeight:0}}>
          {tab==="hem"&&(<>
            <HomeDashboard activeWidgets={activeWidgets} editingWidgets={editingWidgets} onRemoveWidget={handleRemoveWidget} onMoveWidget={handleMoveWidget} onResizeWidget={handleResizeWidget} calEventsByDay={calEventsByDay} sharedTodos={sharedTodos} onToggleTodo={handleToggleTodo} meals={meals} onUpsertMeal={handleUpsertMeal} weather={weather} eventsToday={eventsToday} onDeleteEvent={handleDeleteEvent}/>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button onClick={()=>setWidgetPickerOpen(true)} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,flex:1,padding:"14px",background:"rgba(255,255,255,0.03)",border:"1px dashed rgba(255,255,255,0.1)",borderRadius:16,cursor:"pointer",color:txt.tertiary,fontSize:12,fontWeight:500}}>
                <Plus size={16} strokeWidth={2}/> L\u00e4gg till
              </button>
              <button onClick={()=>setEditingWidgets(e=>!e)} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"14px 18px",background:editingWidgets?"rgba(167,139,250,0.15)":"rgba(255,255,255,0.03)",border:editingWidgets?"1px solid rgba(167,139,250,0.3)":"1px dashed rgba(255,255,255,0.1)",borderRadius:16,cursor:"pointer",color:editingWidgets?ACCENT:txt.tertiary,fontSize:12,fontWeight:500}}>
                {editingWidgets?<><CheckIcon size={14} strokeWidth={2.5}/> Klar</>:<>Redigera</>}
              </button>
            </div>
          </>)}
          {tab==="kalender"&&<FullKalTab events={calEvents} onAddEvent={()=>setEventModalOpen(true)} onDeleteEvent={handleDeleteEvent}/>}
          {tab==="listor"&&<ListsTab lists={lists} todos={todos} onAddList={()=>setListModalOpen(true)} onDeleteList={handleDeleteList} onAddTodo={handleAddTodo} onToggleTodo={handleToggleTodo} onDeleteTodo={handleDeleteTodo}/>}
          {tab==="mat"&&<div style={{height:"100%",overflowY:"auto"}}><MealCard meals={meals} onEdit={handleUpsertMeal}/></div>}
          {tab==="mer"&&<SettingsTab householdId={householdId} userId={userId} householdName={household?.name} onOpenTvEditor={()=>setTvEditorOpen(true)}/>}
        </div>

        {/* Floating nav button */}
        {!navOpen&&!isDesktop&&(<button onClick={()=>setNavOpen(true)} style={{position:"absolute",bottom:24,left:"50%",transform:"translateX(-50%)",width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,0.07)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",animation:"fabPulse 3s ease-in-out infinite",zIndex:20,color:txt.secondary}}><MenuIcon size={20} strokeWidth={1.8} color={txt.secondary}/></button>)}

        {/* Expanded nav */}
        {navOpen&&!isDesktop&&(<>
          <div onClick={()=>setNavOpen(false)} style={{position:"absolute",inset:0,zIndex:40}}/>
          <div style={{position:"absolute",bottom:24,left:16,right:16,zIndex:50,animation:"navSlide 0.25s ease-out"}}>
            <Glass depth={3} style={{borderRadius:22,display:"flex",padding:4}}>
              {TABS.map(n=>{const active=tab===n.key;return(<button key={n.key} onClick={()=>{setTab(n.key);setNavOpen(false)}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:active?"rgba(255,255,255,0.1)":"transparent",border:active?"1px solid rgba(255,255,255,0.08)":"1px solid transparent",boxShadow:active?"0 2px 10px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.08)":"none",borderRadius:18,cursor:"pointer",padding:"10px 0 11px",transition:"all 0.2s"}}>
                <n.Icon size={18} strokeWidth={active?2:1.5} color={active?txt.primary:txt.tertiary} style={{transition:"all 0.2s"}}/>
                <span style={{fontSize:9,fontWeight:600,color:active?txt.primary:txt.muted,letterSpacing:"0.05em",textTransform:"uppercase"}}>{n.label}</span>
              </button>)})}
            </Glass>
          </div>
        </>)}
      </div>

      {tvEditorOpen&&<TvEditor householdId={householdId} tvWidgets={tvWidgets} onSave={handleSaveTvLayout} onClose={()=>setTvEditorOpen(false)}/>}
      {eventModalOpen&&<AddEventModal onSave={handleAddEvent} onClose={()=>setEventModalOpen(false)}/>}
      {widgetPickerOpen&&<WidgetPicker activeWidgets={activeWidgets} onAdd={handleAddWidget} onClose={()=>setWidgetPickerOpen(false)}/>}
      {listModalOpen&&<AddListModal onSave={handleAddList} onClose={()=>setListModalOpen(false)}/>}
    </div>
  </>)
}
