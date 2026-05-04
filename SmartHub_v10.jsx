import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "./lib/supabase"
import { Home, CalendarDays, ListChecks, UtensilsCrossed, Settings, MapPin, Wind, CloudSun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog, Sun, Cloud, Snowflake, Menu as MenuIcon, Check as CheckIcon, X as XIcon, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Plus, Lock, Users, Monitor, Save, LayoutDashboard } from "lucide-react"

// ── Design tokens (light theme) ──
const ACCENT = "#7c3aed"
const GREEN = "#059669"
const RED = "#dc2626"
const AMBER = "#d97706"
const LIST_COLORS = ["#7c3aed","#059669","#d97706","#2563eb","#dc2626","#db2777","#0d9488","#ea580c"]
const EVENT_COLORS = [{color:"#7c3aed",label:"Lila"},{color:"#059669",label:"Gr\u00f6n"},{color:"#d97706",label:"Orange"},{color:"#2563eb",label:"Bl\u00e5"},{color:"#db2777",label:"Rosa"},{color:"#dc2626",label:"R\u00f6d"}]
const CARD_ACCENT_COLORS = [null,"#7c3aed","#2563eb","#059669","#d97706","#dc2626","#db2777","#0d9488"]

const t = {
  bg: "#f0f2f5",
  card: "#ffffff",
  cardBorder: "rgba(0,0,0,0.06)",
  text: "#1a1a2e",
  textSec: "rgba(0,0,0,0.55)",
  textMuted: "rgba(0,0,0,0.25)",
  line: "rgba(0,0,0,0.04)",
  inputBg: "rgba(0,0,0,0.03)",
  inputBorder: "rgba(0,0,0,0.08)",
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
const CAL_DAYS=["M\u00e5n","Tis","Ons","Tor","Fre","L\u00f6r","S\u00f6n"]

const WEATHER_LAT=56.66,WEATHER_LON=16.36,WEATHER_LOCATION="Kalmar"
const WMO={0:{e:"\u2600\ufe0f",t:"Klart"},1:{e:"\ud83c\udf24\ufe0f",t:"Mestadels klart"},2:{e:"\u26c5",t:"Halvklart"},3:{e:"\u2601\ufe0f",t:"Mulet"},45:{e:"\ud83c\udf2b\ufe0f",t:"Dimma"},48:{e:"\ud83c\udf2b\ufe0f",t:"Rimfrost"},51:{e:"\ud83c\udf26\ufe0f",t:"L\u00e4tt duggregn"},53:{e:"\ud83c\udf26\ufe0f",t:"Duggregn"},55:{e:"\ud83c\udf27\ufe0f",t:"Kraftigt duggregn"},61:{e:"\ud83c\udf26\ufe0f",t:"L\u00e4tt regn"},63:{e:"\ud83c\udf27\ufe0f",t:"Regn"},65:{e:"\ud83c\udf27\ufe0f",t:"Kraftigt regn"},71:{e:"\ud83c\udf28\ufe0f",t:"L\u00e4tt sn\u00f6"},73:{e:"\u2744\ufe0f",t:"Sn\u00f6fall"},75:{e:"\u2744\ufe0f",t:"Kraftigt sn\u00f6fall"},80:{e:"\ud83c\udf26\ufe0f",t:"L\u00e4tt regnskur"},81:{e:"\ud83c\udf27\ufe0f",t:"Regnskur"},82:{e:"\ud83c\udf27\ufe0f",t:"Kraftig skur"},95:{e:"\u26c8\ufe0f",t:"\u00c5skv\u00e4der"},96:{e:"\u26c8\ufe0f",t:"\u00c5ska med hagel"},99:{e:"\u26c8\ufe0f",t:"Kraftig \u00e5ska"}}
function parseWeather(json){if(!json||!json.current)return null;const temp=Math.round(json.current.temperature_2m);const code=json.current.weathercode;const wind=Math.round(json.current.windspeed_10m/3.6);const w=WMO[code]||{e:"\u2601\ufe0f",t:"Ok\u00e4nt"};const forecast=[];if(json.daily&&json.daily.time){for(let i=1;i<json.daily.time.length&&forecast.length<3;i++){const d=new Date(json.daily.time[i]);const fc=json.daily.weathercode[i];const fi=WMO[fc]||{e:"\u2601\ufe0f",t:""};forecast.push({day:WEEKDAYS_SHORT[d.getDay()],icon:fi.e,code:fc,temp:Math.round(json.daily.temperature_2m_max[i])+"\u00b0"})}};return{temp,icon:w.e,code,desc:w.t,wind,forecast,location:WEATHER_LOCATION}}

function WmoIcon({code,size=20,color=t.textSec}){
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
function useIsDesktop(){const[d,setD]=useState(typeof window!=="undefined"&&window.innerWidth>900);useEffect(()=>{function h(){setD(window.innerWidth>900)};window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h)},[]);return d}

// ── Card component ──
function Card({children,accent,style,...props}){
  const bg=accent?`${accent}06`:t.card
  const border=accent?`${accent}18`:t.cardBorder
  return(<div style={{background:bg,border:`1px solid ${border}`,borderRadius:16,position:"relative",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",...style}} {...props}>
    {accent&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg, ${accent}, ${accent}60)`}}/>}
    {children}
  </div>)
}
const Label=({children,color})=><span style={{fontSize:11,fontWeight:700,color:color||t.textMuted,letterSpacing:"0.1em",textTransform:"uppercase"}}>{children}</span>
const inputStyle={width:"100%",padding:"11px 14px",fontSize:14,border:`1px solid ${t.inputBorder}`,borderRadius:12,outline:"none",fontFamily:"inherit",background:t.inputBg,color:t.text,boxSizing:"border-box"}
const btnPrimary={width:"100%",background:ACCENT,color:"#fff",border:"none",borderRadius:14,padding:"13px",fontSize:14,fontWeight:600,cursor:"pointer"}

// ── Widget Registry ──
const WIDGET_REGISTRY={calendar:{label:"Kalender",size:"full"},todo:{label:"Att g\u00f6ra",size:"half"},meal:{label:"Matsedel",size:"half"},weather:{label:"V\u00e4der",size:"half"},events:{label:"H\u00e4ndelser",size:"full"}}
const DEFAULT_WIDGETS=["calendar","todo","meal"]
const TV_WIDGET_REGISTRY={clock:{label:"Klocka",minW:2,minH:1},calendar:{label:"Kalender",minW:2,minH:2},todo:{label:"Att g\u00f6ra",minW:1,minH:1},meal:{label:"Matsedel",minW:1,minH:1},weather:{label:"V\u00e4der",minW:1,minH:1},events:{label:"H\u00e4ndelser",minW:2,minH:1}}
const DEFAULT_TV_WIDGETS=[{id:"clock",x:0,y:0,w:4,h:1},{id:"calendar",x:0,y:1,w:4,h:3},{id:"todo",x:0,y:4,w:2,h:2},{id:"meal",x:2,y:4,w:2,h:2}]

// ── Modals ──
function AddEventModal({onSave,onClose}){
  const[title,setTitle]=useState("");const[date,setDate]=useState(fmtDate(new Date()));const[startTime,setStartTime]=useState("12:00");const[endTime,setEndTime]=useState("13:00");const[location,setLocation]=useState("");const[color,setColor]=useState(EVENT_COLORS[0].color);const[shared,setShared]=useState(true)
  return(<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.3)",zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}><div style={{background:"#fff",borderRadius:"24px 24px 0 0",padding:"20px 16px 32px",display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:16,fontWeight:700,color:t.text}}>Ny h{"\u00e4"}ndelse</span><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:t.textMuted,fontSize:13}}>Avbryt</button></div>
    <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Titel" style={inputStyle} autoFocus/>
    <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inputStyle}/>
    <div style={{display:"flex",gap:8}}><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} style={{...inputStyle,flex:1}}/><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} style={{...inputStyle,flex:1}}/></div>
    <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Plats (valfritt)" style={inputStyle}/>
    <div style={{display:"flex",gap:6}}>{EVENT_COLORS.map(c=>(<button key={c.color} onClick={()=>setColor(c.color)} style={{width:28,height:28,borderRadius:"50%",background:c.color,border:color===c.color?"3px solid "+t.text:"3px solid transparent",cursor:"pointer",padding:0}}/>))}</div>
    <button onClick={()=>setShared(s=>!s)} style={{display:"flex",alignItems:"center",gap:8,background:t.inputBg,border:`1px solid ${t.inputBorder}`,borderRadius:12,padding:"10px 14px",cursor:"pointer",color:t.textSec,fontSize:13}}>{shared?<><Users size={14}/> Delad med hush{"\u00e5"}llet</>:<><Lock size={14}/> Bara f{"\u00f6"}r mig</>}</button>
    <button onClick={()=>{if(!title.trim())return;onSave({title:title.trim(),start_time:date+"T"+startTime+":00",end_time:date+"T"+endTime+":00",location:location.trim()||null,color,shared})}} style={{...btnPrimary,opacity:title.trim()?1:0.4}}>L{"\u00e4"}gg till</button>
  </div></div>)
}

function AddListModal({onSave,onClose}){
  const[name,setName]=useState("");const[shared,setShared]=useState(true);const[color,setColor]=useState(LIST_COLORS[0]);const[hasExpiry,setHasExpiry]=useState(false);const[expiryDate,setExpiryDate]=useState("")
  return(<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.3)",zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}><div style={{background:"#fff",borderRadius:"24px 24px 0 0",padding:"20px 16px 32px",display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:16,fontWeight:700,color:t.text}}>Ny lista</span><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:t.textMuted,fontSize:13}}>Avbryt</button></div>
    <input value={name} onChange={e=>setName(e.target.value)} placeholder="Namn p\u00e5 listan" style={inputStyle} autoFocus/>
    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{LIST_COLORS.map(c=>(<button key={c} onClick={()=>setColor(c)} style={{width:26,height:26,borderRadius:"50%",background:c,border:color===c?"3px solid "+t.text:"3px solid transparent",cursor:"pointer",padding:0}}/>))}</div>
    <button onClick={()=>setShared(s=>!s)} style={{display:"flex",alignItems:"center",gap:8,background:t.inputBg,border:`1px solid ${t.inputBorder}`,borderRadius:12,padding:"10px 14px",cursor:"pointer",color:t.textSec,fontSize:13}}>{shared?<><Users size={14}/> Delad med hush{"\u00e5"}llet</>:<><Lock size={14}/> Privat lista</>}</button>
    <button onClick={()=>setHasExpiry(h=>!h)} style={{display:"flex",alignItems:"center",gap:8,background:t.inputBg,border:`1px solid ${t.inputBorder}`,borderRadius:12,padding:"10px 14px",cursor:"pointer",color:t.textSec,fontSize:13}}>{hasExpiry?"\u23f0 Utg\u00e5ngsdatum":"\u221e Ingen tidsgr\u00e4ns"}</button>
    {hasExpiry&&<input type="date" value={expiryDate} onChange={e=>setExpiryDate(e.target.value)} style={inputStyle}/>}
    <button onClick={()=>{if(!name.trim())return;onSave({name:name.trim(),shared,color,expires_at:hasExpiry&&expiryDate?expiryDate+"T23:59:59":null})}} style={{...btnPrimary,opacity:name.trim()?1:0.4}}>Skapa lista</button>
  </div></div>)
}

// ── Calendar Card ──
function CalendarCard({calEventsByDay,accent}){
  const now=new Date();const[vm,setVm]=useState(now.getMonth());const[vy,setVy]=useState(now.getFullYear())
  const weeks=buildCal(vy,vm);const isToday=d=>d===now.getDate()&&vm===now.getMonth()&&vy===now.getFullYear()
  const eventsForView=(vm===now.getMonth()&&vy===now.getFullYear())?calEventsByDay:{}
  const ac=accent||ACCENT
  return(<Card accent={ac} style={{padding:"14px 14px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <button onClick={()=>{if(vm===0){setVm(11);setVy(y=>y-1)}else setVm(m=>m-1)}} style={{background:"none",border:"none",cursor:"pointer",color:t.textMuted,padding:4}}><ChevronLeft size={16}/></button>
      <Label color={ac}>{MONTHS_FULL[vm]} {vy}</Label>
      <button onClick={()=>{if(vm===11){setVm(0);setVy(y=>y+1)}else setVm(m=>m+1)}} style={{background:"none",border:"none",cursor:"pointer",color:t.textMuted,padding:4}}><ChevronRight size={16}/></button>
    </div>
    <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed"}}>
      <thead><tr>{CAL_DAYS.map((d,i)=>(
        <th key={i} style={{fontSize:9,color:i>=5?ac+"90":t.textMuted,fontWeight:600,textAlign:"center",padding:"4px 0"}}>{d}</th>
      ))}</tr></thead>
      <tbody>{weeks.map((week,wi)=>(
        <tr key={wi} style={{borderTop:`1px solid ${t.line}`}}>
          {week.map((d,di)=>{
            const today=d&&isToday(d);const evs=d?(eventsForView[d]||[]):[]
            return(<td key={di} style={{verticalAlign:"top",padding:"3px 2px",textAlign:"left"}}>
              {d&&(<div>
                <div style={{width:22,height:22,borderRadius:"50%",background:today?ac:"transparent",color:today?"#fff":di>=5?ac+"80":t.textSec,fontSize:10,fontWeight:today?700:400,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Comfortaa'",boxShadow:today?`0 2px 8px ${ac}40`:"none",marginBottom:1}}>{d}</div>
                {evs.slice(0,2).map((ev,ei)=>(<div key={ei} style={{fontSize:7,lineHeight:1.2,padding:"1px 3px",marginTop:1,borderRadius:3,background:ev.color+"18",color:ev.color,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.time} {ev.title}</div>))}
              </div>)}
            </td>)
          })}
        </tr>
      ))}</tbody>
    </table>
  </Card>)
}

// ── Meal Card ──
function MealCard({meals,onEdit,accent}){
  const now=new Date();const todayIdx=now.getDay()===0?6:now.getDay()-1
  const[editingDay,setEditingDay]=useState(null);const[editText,setEditText]=useState("");const inputRef=useRef(null)
  const byDay={};meals.forEach(m=>{byDay[m.weekday-1]=m.meal_text})
  const ac=accent||AMBER
  function startEdit(i){if(!onEdit)return;setEditingDay(i);setEditText(byDay[i]||"");setTimeout(()=>inputRef.current?.focus(),50)}
  function saveEdit(){if(editingDay===null)return;onEdit(editingDay+1,editText.trim());setEditingDay(null);setEditText("")}
  return(<Card accent={ac} style={{padding:"14px 14px",display:"flex",flexDirection:"column"}}>
    <Label color={ac}>Matsedel</Label>
    <div style={{display:"flex",flexDirection:"column",gap:3,marginTop:10}}>
      {MEAL_DAYS.map((day,i)=>{const isToday=i===todayIdx;return(<div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:isToday?"5px 8px":"3px 8px",borderRadius:8,background:isToday?ac+"10":"transparent",border:isToday?`1px solid ${ac}18`:"1px solid transparent"}}>
        <span style={{fontFamily:"'Comfortaa'",fontSize:10,fontWeight:isToday?700:400,color:isToday?ac:t.textMuted,minWidth:26,textAlign:"right"}}>{day}</span>
        {editingDay===i?(<input ref={inputRef} value={editText} onChange={e=>setEditText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveEdit();if(e.key==="Escape")setEditingDay(null)}} onBlur={saveEdit} style={{...inputStyle,padding:"4px 8px",fontSize:12,flex:1}}/>):(<span onClick={()=>startEdit(i)} style={{fontSize:12,color:isToday?t.text:t.textSec,fontWeight:isToday?600:400,flex:1,cursor:onEdit?"pointer":"default"}}>{byDay[i]||<span style={{color:t.textMuted,fontStyle:"italic"}}>{onEdit?"Klicka...":"\u2014"}</span>}</span>)}
      </div>)})}
    </div>
  </Card>)
}

// ── Todo Card ──
function TodoCard({todos,onToggle,accent}){
  const remaining=todos.filter(i=>!i.done).length;const ac=accent||GREEN
  return(<Card accent={ac} style={{padding:"14px 14px",display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <Label color={ac}>Att g{"\u00f6"}ra</Label>
      <span style={{fontSize:10,fontWeight:700,color:ac,background:ac+"15",padding:"2px 8px",borderRadius:10}}>{remaining}</span>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:7}}>
      {todos.length===0&&<span style={{fontSize:12,color:t.textMuted,fontStyle:"italic"}}>Inga uppgifter</span>}
      {todos.slice(0,6).map(td=>(<div key={td.id} style={{display:"flex",alignItems:"center",gap:8}}>
        <div onClick={()=>onToggle(td)} style={{width:18,height:18,borderRadius:"50%",border:td.done?"none":`2px solid ${t.inputBorder}`,background:td.done?ac:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",fontSize:10,color:"#fff",fontWeight:700}}>{td.done?"✓":""}</div>
        <span onClick={()=>onToggle(td)} style={{fontSize:13,color:td.done?t.textMuted:t.textSec,textDecoration:td.done?"line-through":"none",fontWeight:td.done?400:500,cursor:"pointer"}}>{td.text}</span>
      </div>))}
    </div>
  </Card>)
}

// ── Events Card ──
function EventsCard({eventsToday,onDelete,accent}){
  const ac=accent||ACCENT
  return(<Card accent={ac} style={{padding:"14px 14px",display:"flex",flexDirection:"column",gap:8}}>
    <Label color={ac}>Idag</Label>
    {eventsToday.length===0&&<span style={{fontSize:12,color:t.textMuted,fontStyle:"italic"}}>Inget inplanerat</span>}
    {eventsToday.map(e=>(<div key={e.id} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 10px",background:e.color+"08",borderRadius:10,border:`1px solid ${e.color}15`}}>
      <div style={{width:3,height:28,borderRadius:2,background:e.color,flexShrink:0}}/>
      <div style={{flex:1}}>
        <div style={{fontFamily:"'Comfortaa'",fontSize:10,color:t.textMuted}}>{e.start}</div>
        <div style={{fontSize:13,color:t.text,fontWeight:600,marginTop:1}}>{e.title}</div>
        {e.location&&<div style={{fontSize:10,color:t.textMuted,marginTop:1,display:"flex",alignItems:"center",gap:3}}><MapPin size={9}/>{e.location}</div>}
      </div>
      {onDelete&&<button onClick={()=>onDelete(e.id)} style={{background:"none",border:"none",cursor:"pointer",color:t.textMuted,fontSize:14}}>{"\u00d7"}</button>}
    </div>))}
  </Card>)
}

// ── Weather Card ──
function WeatherCard({weather,accent}){
  const ac=accent||"#2563eb"
  if(!weather)return(<Card accent={ac} style={{padding:20,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:t.textMuted,fontSize:12}}>Laddar v{"\u00e4"}der...</span></Card>)
  return(<Card accent={ac} style={{padding:"14px",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
    {weather.code!==undefined?<WmoIcon code={weather.code} size={32} color={ac}/>:<span style={{fontSize:28}}>{weather.icon}</span>}
    <span style={{fontFamily:"'Comfortaa'",fontSize:28,fontWeight:300,color:t.text}}>{weather.temp}{"\u00b0"}</span>
    <span style={{fontSize:11,color:t.textSec}}>{weather.desc} {"\u00b7"} {weather.location}</span>
    <div style={{display:"flex",gap:12,marginTop:6}}>{weather.forecast.map(w=>(<div key={w.day} style={{textAlign:"center"}}><div style={{fontSize:9,color:t.textMuted,fontWeight:600}}>{w.day}</div>{w.code!==undefined?<WmoIcon code={w.code} size={16} color={t.textSec}/>:<div style={{fontSize:14}}>{w.icon}</div>}<div style={{fontFamily:"'Comfortaa'",fontSize:10,color:t.textSec}}>{w.temp}</div></div>))}</div>
  </Card>)
}

// ── Lists Tab ──
function ListsTab({lists,todos,onAddList,onDeleteList,onAddTodo,onToggleTodo,onDeleteTodo}){
  const[expanded,setExpanded]=useState({});const[addingTo,setAddingTo]=useState(null);const[newText,setNewText]=useState("")
  function handleAdd(listId){if(!newText.trim())return;onAddTodo(newText.trim(),listId);setNewText("");setAddingTo(null)}
  return(<div style={{height:"100%",overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
    <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={onAddList} style={{background:ACCENT,color:"#fff",border:"none",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Ny lista</button></div>
    {lists.map(list=>{const listTodos=todos.filter(td=>td.list_id===list.id);const remaining=listTodos.filter(td=>!td.done).length;const isOpen=expanded[list.id]!==false;const dl=daysLeft(list.expires_at)
      return(<Card key={list.id} accent={list.color} style={{overflow:"hidden"}}>
        <div onClick={()=>setExpanded(p=>({...p,[list.id]:!p[list.id]}))} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer",borderBottom:isOpen?`1px solid ${t.line}`:"none"}}>
          <div style={{width:4,height:24,borderRadius:2,background:list.color,flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:14,fontWeight:600,color:t.text}}>{list.name}</span>{!list.shared&&<Lock size={10} color={t.textMuted}/>}</div>
            <div style={{display:"flex",gap:8,marginTop:2}}><span style={{fontSize:11,color:t.textSec}}>{remaining} kvar</span>{dl!==null&&<span style={{fontSize:11,color:dl<=2?RED:dl<=5?AMBER:t.textSec}}>{dl<=0?"Utg\u00e5ngen":dl+" dagar kvar"}</span>}</div>
          </div>
          {isOpen?<ChevronUp size={14} color={t.textMuted}/>:<ChevronDown size={14} color={t.textMuted}/>}
          <button onClick={e=>{e.stopPropagation();onDeleteList(list.id)}} style={{background:"none",border:"none",cursor:"pointer",color:t.textMuted,padding:4}}><XIcon size={14}/></button>
        </div>
        {isOpen&&(<div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
          {listTodos.map(item=>(<div key={item.id} style={{display:"flex",alignItems:"center",gap:7}}>
            <div onClick={()=>onToggleTodo(item)} style={{width:16,height:16,borderRadius:"50%",flexShrink:0,border:item.done?"none":`2px solid ${t.inputBorder}`,background:item.done?list.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff",cursor:"pointer"}}>{item.done?"✓":""}</div>
            <span onClick={()=>onToggleTodo(item)} style={{fontSize:13,color:item.done?t.textMuted:t.textSec,textDecoration:item.done?"line-through":"none",flex:1,cursor:"pointer"}}>{item.text}</span>
            <button onClick={()=>onDeleteTodo(item)} style={{background:"none",border:"none",cursor:"pointer",color:t.textMuted}}><XIcon size={12}/></button>
          </div>))}
          {addingTo===list.id?(<div style={{display:"flex",gap:6}}><input value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleAdd(list.id);if(e.key==="Escape"){setAddingTo(null);setNewText("")}}} placeholder="Ny uppgift..." style={{...inputStyle,flex:1,padding:"6px 10px",fontSize:12}} autoFocus/><button onClick={()=>handleAdd(list.id)} style={{background:ACCENT,color:"#fff",border:"none",borderRadius:10,padding:"0 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>+</button></div>):(<button onClick={()=>setAddingTo(list.id)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 0",color:t.textSec,fontSize:12}}>+ L{"\u00e4"}gg till uppgift</button>)}
        </div>)}
      </Card>)
    })}
    {lists.length===0&&<Card style={{padding:24,textAlign:"center"}}><span style={{color:t.textMuted,fontSize:13}}>Inga listor {"\u00e4"}n. Skapa en!</span></Card>}
  </div>)
}

// ── Settings Tab ──
function SettingsTab({householdId,userId,householdName,onOpenTvEditor}){
  const[inviteCode,setInviteCode]=useState(null);const[creating,setCreating]=useState(false);const[members,setMembers]=useState([]);const[copied,setCopied]=useState(false)
  useEffect(()=>{if(!householdId)return;supabase.from("household_members").select("user_id,role,joined_at").eq("household_id",householdId).then(({data})=>{if(data)setMembers(data)})},[householdId])
  async function createInvite(){setCreating(true);const code=genCode();const{error}=await supabase.from("invites").insert({household_id:householdId,code,created_by:userId});if(!error)setInviteCode(code);setCreating(false)}
  function copyCode(){if(!inviteCode)return;navigator.clipboard.writeText(inviteCode).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})}
  return(<div style={{height:"100%",overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>
    <Card style={{padding:16}}>
      <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:12}}>Hush{"\u00e5"}ll: {householdName}</div>
      <Label>Medlemmar</Label>
      <div style={{marginTop:8}}>{members.map((m,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<members.length-1?`1px solid ${t.line}`:"none"}}>
        <div style={{width:28,height:28,borderRadius:"50%",background:ACCENT+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:ACCENT,fontWeight:700}}>{m.user_id===userId?"Du":String(i+1)}</div>
        <div style={{flex:1}}><div style={{fontSize:13,color:t.text}}>{m.user_id===userId?"Du":"Medlem "+(i+1)}</div><div style={{fontSize:11,color:t.textSec}}>{m.role}</div></div>
      </div>))}</div>
    </Card>
    <button onClick={()=>onOpenTvEditor&&onOpenTvEditor()} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#fff",border:`1px solid ${t.cardBorder}`,borderRadius:14,padding:"14px",cursor:"pointer",color:t.textSec,fontSize:13,fontWeight:600,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}><Monitor size={16}/> Redigera TV-vy</button>
    <Card style={{padding:16}}>
      <Label>Bjud in</Label>
      {!inviteCode?(<button onClick={createInvite} disabled={creating} style={{...btnPrimary,marginTop:12,opacity:creating?0.6:1}}>{creating?"Skapar kod...":"Skapa inbjudningskod"}</button>):(<div style={{textAlign:"center",marginTop:12}}>
        <div style={{fontSize:11,color:t.textSec,marginBottom:8}}>Dela denna kod</div>
        <div onClick={copyCode} style={{fontFamily:"'Comfortaa'",fontSize:32,fontWeight:700,letterSpacing:"0.15em",color:ACCENT,cursor:"pointer",padding:"14px",background:ACCENT+"08",borderRadius:16,marginBottom:8,border:`1px solid ${ACCENT}15`}}>{inviteCode}</div>
        <div style={{fontSize:11,color:copied?GREEN:t.textMuted}}>{copied?"Kopierad!":"Tryck f\u00f6r att kopiera \u00b7 Giltig i 7 dagar"}</div>
        <button onClick={()=>setInviteCode(null)} style={{marginTop:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,borderRadius:12,padding:"8px 16px",fontSize:12,color:t.textSec,cursor:"pointer"}}>Skapa ny kod</button>
      </div>)}
    </Card>
  </div>)
}

// ── Home Dashboard ──
function HomeDashboard({activeWidgets,editingWidgets,onRemoveWidget,onMoveWidget,onResizeWidget,calEventsByDay,sharedTodos,onToggleTodo,meals,onUpsertMeal,weather,eventsToday,onDeleteEvent}){
  const renderWidget=(id)=>{switch(id){case"calendar":return <CalendarCard calEventsByDay={calEventsByDay}/>;case"todo":return <TodoCard todos={sharedTodos} onToggle={onToggleTodo}/>;case"meal":return <MealCard meals={meals} onEdit={onUpsertMeal}/>;case"weather":return <WeatherCard weather={weather}/>;case"events":return <EventsCard eventsToday={eventsToday} onDelete={onDeleteEvent}/>;default:return null}}
  function WidgetWrapper({id,children}){const idx=activeWidgets.indexOf(id);if(!editingWidgets)return children;return(<div style={{position:"relative"}}>{children}<div style={{position:"absolute",top:6,right:6,display:"flex",gap:4,zIndex:5}}>
    {idx>0&&<button onClick={()=>onMoveWidget(id,-1)} style={{width:24,height:24,borderRadius:"50%",background:"#fff",border:`1px solid ${t.cardBorder}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}><ChevronUp size={12} color={t.textSec}/></button>}
    {idx<activeWidgets.length-1&&<button onClick={()=>onMoveWidget(id,1)} style={{width:24,height:24,borderRadius:"50%",background:"#fff",border:`1px solid ${t.cardBorder}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}><ChevronDown size={12} color={t.textSec}/></button>}
    <button onClick={()=>onRemoveWidget(id)} style={{width:24,height:24,borderRadius:"50%",background:RED,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><XIcon size={11} color="#fff"/></button>
  </div></div>)}
  const items=activeWidgets.map(id=>({id,size:WIDGET_REGISTRY[id]?.size||"half"}));const rendered=[];let halfBuf=[]
  items.forEach(item=>{if(item.size==="full"){if(halfBuf.length>0){rendered.push({type:"grid",widgets:[...halfBuf]});halfBuf=[]};rendered.push({type:"full",widget:item})}else{halfBuf.push(item);if(halfBuf.length===2){rendered.push({type:"grid",widgets:[...halfBuf]});halfBuf=[]}}})
  if(halfBuf.length>0)rendered.push({type:"grid",widgets:[...halfBuf]})
  return(<>{rendered.map((row,ri)=>{if(row.type==="full")return <div key={ri}><WidgetWrapper id={row.widget.id}>{renderWidget(row.widget.id)}</WidgetWrapper></div>;return(<div key={ri} style={{display:"grid",gridTemplateColumns:row.widgets.length===2?"1fr 1fr":"1fr",gap:10}}>{row.widgets.map(w=><div key={w.id}><WidgetWrapper id={w.id}>{renderWidget(w.id)}</WidgetWrapper></div>)}</div>)})}</>)
}

// ── TV View (540x960 fixed, zoom:2 for 1080x1920) ──
function TvView({tvWidgets,calEventsByDay,sharedTodos,onToggleTodo,meals,weather,eventsToday,bgUrl}){
  const widgets=tvWidgets||DEFAULT_TV_WIDGETS
  const[time,setTime]=useState(new Date())
  useEffect(()=>{const i=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(i)},[])
  const h=String(time.getHours()).padStart(2,"0"),m=String(time.getMinutes()).padStart(2,"0")
  const monthsShort=["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"]
  const forecast=weather?.forecast||[]

  return(<div style={{fontFamily:"'Nunito', sans-serif",width:540,height:960,position:"fixed",top:0,left:0,overflow:"hidden",zoom:2,transformOrigin:"top left",color:t.text}}>
    <style>{"html,body{margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important} *::-webkit-scrollbar{display:none!important}"}</style>
    

    <div style={{position:"absolute",inset:0,zIndex:1,display:"flex",flexDirection:"column",padding:16,gap:10,boxSizing:"border-box"}}>
      {/* Clock + Weather */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 4px",flexShrink:0}}>
        <div>
          <div style={{fontFamily:"'Comfortaa'",fontSize:52,fontWeight:300,letterSpacing:"-0.03em",lineHeight:1,color:"#1a1a2e"}}>{h}<span style={{opacity:0.3}}>:</span>{m}</div>
          <div style={{fontSize:14,color:t.textSec,marginTop:6,fontWeight:500}}>{WEEKDAYS_SV[time.getDay()]} {"\u00b7"} {time.getDate()} {monthsShort[time.getMonth()]}</div>
        </div>
        <div style={{textAlign:"right"}}>
          {weather?.code!==undefined?<WmoIcon code={weather.code} size={32} color={t.textSec}/>:<div style={{fontSize:28}}>{weather?.icon||"\u2601\ufe0f"}</div>}
          <div style={{fontFamily:"'Comfortaa'",fontSize:24,fontWeight:300,color:t.text}}>{weather?.temp||"--"}{"\u00b0"}</div>
          <div style={{fontSize:10,color:t.textMuted}}>{weather?.desc||""}</div>
        </div>
      </div>

      {/* Forecast */}
      <div style={{display:"flex",gap:6,flexShrink:0}}>
        {forecast.map(f=>(<div key={f.day} style={{flex:1,background:"rgba(255,255,255,0.7)",borderRadius:10,padding:"5px 0",textAlign:"center",border:`1px solid ${t.cardBorder}`,boxShadow:"0 1px 2px rgba(0,0,0,0.03)"}}>
          <div style={{fontSize:9,fontWeight:700,color:t.textMuted,letterSpacing:"0.05em"}}>{f.day}</div>
          {f.code!==undefined?<WmoIcon code={f.code} size={14} color={t.textSec}/>:<div style={{fontSize:14}}>{f.icon}</div>}
          <div style={{fontSize:10,fontWeight:600,color:t.textSec}}>{f.temp}</div>
        </div>))}
      </div>

      {/* Calendar */}
      <div style={{flex:5,minHeight:0}}><CalendarCard calEventsByDay={calEventsByDay}/></div>

      {/* Bottom row */}
      <div style={{display:"flex",gap:10,flex:3,minHeight:0}}>
        <div style={{flex:1}}><TodoCard todos={sharedTodos} onToggle={onToggleTodo}/></div>
        <div style={{flex:1}}><MealCard meals={meals} onEdit={null}/></div>
      </div>
    </div>
  </div>)
}

// ── Clock Hero (mobile/desktop) ──
function ClockHero({weather,bgUrl}){
  const[time,setTime]=useState(new Date())
  useEffect(()=>{const i=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(i)},[])
  const h=String(time.getHours()).padStart(2,"0"),m=String(time.getMinutes()).padStart(2,"0")
  const monthsShort=["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"]
  return(<div style={{padding:"24px 20px 12px",position:"relative"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div>
        <div style={{fontFamily:"'Comfortaa'",fontSize:52,fontWeight:300,color:t.text,letterSpacing:"-0.03em",lineHeight:1}}>{h}<span style={{opacity:0.25}}>:</span>{m}</div>
        <div style={{fontSize:14,color:t.textSec,marginTop:6,fontWeight:500}}>{WEEKDAYS_SV[time.getDay()]} {"\u00b7"} {time.getDate()} {monthsShort[time.getMonth()]}</div>
      </div>
      <div style={{textAlign:"right",marginTop:4}}>
        {weather?.code!==undefined?<WmoIcon code={weather.code} size={28} color={t.textSec}/>:<div style={{fontSize:24}}>{weather?.icon||"\u2601\ufe0f"}</div>}
        <div style={{fontFamily:"'Comfortaa'",fontSize:22,fontWeight:300,color:t.text,marginTop:2}}>{weather?.temp||"--"}{"\u00b0"}</div>
        <div style={{fontSize:9,color:t.textMuted}}>{weather?.desc||""}</div>
      </div>
    </div>
    {weather?.forecast&&(<div style={{display:"flex",gap:6,marginTop:10}}>
      {weather.forecast.map(f=>(<div key={f.day} style={{flex:1,background:"rgba(255,255,255,0.7)",borderRadius:10,padding:"5px 0",textAlign:"center",border:`1px solid ${t.cardBorder}`,boxShadow:"0 1px 2px rgba(0,0,0,0.03)"}}>
        <div style={{fontSize:9,fontWeight:700,color:t.textMuted,letterSpacing:"0.05em"}}>{f.day}</div>
        {f.code!==undefined?<WmoIcon code={f.code} size={14} color={t.textSec}/>:<div style={{fontSize:12}}>{f.icon}</div>}
        <div style={{fontSize:10,fontWeight:600,color:t.textSec}}>{f.temp}</div>
      </div>))}
    </div>)}
  </div>)
}

// ── Desktop Sidebar ──
function DesktopSidebar({activeTab,onTabChange,tabs}){
  return(<div style={{width:220,flexShrink:0,display:"flex",flexDirection:"column",height:"100%",padding:"20px 0",background:"#fff",borderRight:`1px solid ${t.cardBorder}`}}>
    <div style={{padding:"0 20px 24px",display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:32,height:32,borderRadius:10,background:ACCENT+"12",display:"flex",alignItems:"center",justifyContent:"center"}}><LayoutDashboard size={16} color={ACCENT}/></div>
      <span style={{fontFamily:"'Comfortaa'",fontSize:16,fontWeight:600,color:t.text}}>SmartHub</span>
    </div>
    <div style={{flex:1,display:"flex",flexDirection:"column",gap:2,padding:"0 12px"}}>
      {tabs.map(tab=>{const active=activeTab===tab.key;return(<button key={tab.key} onClick={()=>onTabChange(tab.key)} style={{display:"flex",alignItems:"center",gap:12,background:active?ACCENT+"08":"transparent",border:active?`1px solid ${ACCENT}12`:"1px solid transparent",borderRadius:12,padding:"10px 14px",cursor:"pointer",width:"100%",textAlign:"left"}}>
        <tab.Icon size={18} strokeWidth={active?2:1.5} color={active?ACCENT:t.textMuted}/>
        <span style={{fontSize:13,fontWeight:active?600:400,color:active?t.text:t.textSec}}>{tab.label}</span>
      </button>)})}
    </div>
    <div style={{padding:"16px 20px",borderTop:`1px solid ${t.line}`}}><div style={{fontSize:10,color:t.textMuted}}>SmartHub v10</div></div>
  </div>)
}

// ── Nav items ──
const TABS=[{key:"hem",label:"Hem",Icon:Home},{key:"kalender",label:"Kalender",Icon:CalendarDays},{key:"listor",label:"Listor",Icon:ListChecks},{key:"mat",label:"Mat",Icon:UtensilsCrossed},{key:"mer",label:"Mer",Icon:Settings}]

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════
export default function SmartHub({session,household}){
  const userId=session?.user?.id,householdId=household?.id
  const[tab,setTab]=useState("hem")
  const[bgIdx,setBgIdx]=useState(0);const[customBg,setCustomBg]=useState(null)
  const[navOpen,setNavOpen]=useState(false);const[widgetPickerOpen,setWidgetPickerOpen]=useState(false);const[editingWidgets,setEditingWidgets]=useState(false);const[tvEditorOpen,setTvEditorOpen]=useState(false);const[tvWidgets,setTvWidgets]=useState(null)
  const[eventModalOpen,setEventModalOpen]=useState(false);const[listModalOpen,setListModalOpen]=useState(false)
  const[lists,setLists]=useState([]);const[todos,setTodos]=useState([]);const[calEvents,setCalEvents]=useState([]);const[meals,setMeals]=useState([]);const[weather,setWeather]=useState(null)
  const[loaded,setLoaded]=useState({todos:false,events:false,meals:false,lists:false});const[activeWidgets,setActiveWidgets]=useState(DEFAULT_WIDGETS)
  const isDesktop=useIsDesktop()
  const bgUrl=bgIdx>=0?BG_PRESETS[bgIdx].url:customBg

  // Weather
  useEffect(()=>{async function f(){try{const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude="+WEATHER_LAT+"&longitude="+WEATHER_LON+"&current=temperature_2m,weathercode,windspeed_10m&daily=weathercode,temperature_2m_max&timezone=Europe/Stockholm&forecast_days=4");if(!r.ok)return;const j=await r.json();const p=parseWeather(j);if(p)setWeather(p)}catch(e){console.error("[weather]",e)}};f();const i=setInterval(f,30*60*1000);return()=>clearInterval(i)},[])

  // Widget layout
  useEffect(()=>{if(!userId)return;let c=false;async function f(){const{data}=await supabase.from("layouts").select("assignments").eq("user_id",userId).maybeSingle();if(c)return;if(data?.assignments&&Array.isArray(data.assignments))setActiveWidgets(data.assignments)};f();return()=>{c=true}},[userId])

  // TV layout
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const{data}=await supabase.from("tv_layouts").select("widgets").eq("household_id",householdId).maybeSingle();if(c)return;if(data?.widgets)setTvWidgets(data.widgets)};f();const ch=supabase.channel("tv:"+householdId).on("postgres_changes",{event:"*",schema:"public",table:"tv_layouts",filter:"household_id=eq."+householdId},p=>{if(p.new?.widgets)setTvWidgets(p.new.widgets)}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId])

  // Lists
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const{data,error}=await supabase.from("lists").select("*").eq("household_id",householdId).order("created_at",{ascending:true});if(c)return;if(!error)setLists(data||[]);setLoaded(s=>({...s,lists:true}))};f();const ch=supabase.channel("lists:"+householdId).on("postgres_changes",{event:"*",schema:"public",table:"lists",filter:"household_id=eq."+householdId},p=>{setLists(prev=>{if(p.eventType==="INSERT")return prev.some(l=>l.id===p.new.id)?prev:[...prev,p.new];if(p.eventType==="UPDATE")return prev.map(l=>l.id===p.new.id?p.new:l);if(p.eventType==="DELETE")return prev.filter(l=>l.id!==p.old.id);return prev})}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId])

  // Todos
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const{data,error}=await supabase.from("todos").select("*").eq("household_id",householdId).order("created_at",{ascending:true});if(c)return;if(!error)setTodos(data||[]);setLoaded(s=>({...s,todos:true}))};f();const ch=supabase.channel("todos:"+householdId).on("postgres_changes",{event:"*",schema:"public",table:"todos",filter:"household_id=eq."+householdId},p=>{setTodos(prev=>{if(p.eventType==="INSERT")return prev.some(td=>td.id===p.new.id)?prev:[...prev,p.new];if(p.eventType==="UPDATE")return prev.map(td=>td.id===p.new.id?p.new:td);if(p.eventType==="DELETE")return prev.filter(td=>td.id!==p.old.id);return prev})}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId])

  // Events
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const now=new Date();const from=new Date(now.getFullYear(),now.getMonth()-6,1).toISOString();const to=new Date(now.getFullYear(),now.getMonth()+12,0).toISOString();const{data,error}=await supabase.from("calendar_events").select("*").eq("household_id",householdId).gte("start_time",from).lte("start_time",to).order("start_time",{ascending:true});if(c)return;if(!error)setCalEvents(data||[]);setLoaded(s=>({...s,events:true}))};f();const ch=supabase.channel("events:"+householdId).on("postgres_changes",{event:"*",schema:"public",table:"calendar_events",filter:"household_id=eq."+householdId},p=>{setCalEvents(prev=>{if(p.eventType==="INSERT")return prev.some(e=>e.id===p.new.id)?prev:[...prev,p.new];if(p.eventType==="UPDATE")return prev.map(e=>e.id===p.new.id?p.new:e);if(p.eventType==="DELETE")return prev.filter(e=>e.id!==p.old.id);return prev})}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId])

  // Meals
  const currentWeekStart=useMemo(()=>{const now=new Date();const day=now.getDay();const diff=day===0?6:day-1;const mon=new Date(now.getFullYear(),now.getMonth(),now.getDate()-diff);return mon.getFullYear()+"-"+String(mon.getMonth()+1).padStart(2,"0")+"-"+String(mon.getDate()).padStart(2,"0")},[])
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const{data,error}=await supabase.from("meals").select("*").eq("household_id",householdId).eq("week_start_date",currentWeekStart);if(c)return;if(!error)setMeals(data||[]);setLoaded(s=>({...s,meals:true}))};f();const ch=supabase.channel("meals:"+householdId+":"+currentWeekStart).on("postgres_changes",{event:"*",schema:"public",table:"meals",filter:"household_id=eq."+householdId},p=>{const row=p.new||p.old;if(!row||row.week_start_date!==currentWeekStart)return;setMeals(prev=>{if(p.eventType==="INSERT")return prev.some(m=>m.id===p.new.id)?prev:[...prev,p.new];if(p.eventType==="UPDATE")return prev.map(m=>m.id===p.new.id?p.new:m);if(p.eventType==="DELETE")return prev.filter(m=>m.id!==p.old.id);return prev})}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId,currentWeekStart])

  // Save widget layout
  useEffect(()=>{if(!userId)return;const ti=setTimeout(async()=>{await supabase.from("layouts").upsert({user_id:userId,assignments:activeWidgets,updated_at:new Date().toISOString()},{onConflict:"user_id"})},500);return()=>clearTimeout(ti)},[userId,activeWidgets])

  // CRUD
  async function handleToggleTodo(item){const nd=!item.done;setTodos(p=>p.map(td=>td.id===item.id?{...td,done:nd,completed_at:nd?new Date().toISOString():null}:td));const{error}=await supabase.from("todos").update({done:nd,completed_at:nd?new Date().toISOString():null}).eq("id",item.id);if(error)setTodos(p=>p.map(td=>td.id===item.id?item:td))}
  async function handleAddTodo(text,listId){const tmp={id:"tmp-"+Date.now(),household_id:householdId,text,done:false,list_id:listId,shared:true,created_by:userId,created_at:new Date().toISOString()};setTodos(p=>[...p,tmp]);const{data,error}=await supabase.from("todos").insert({household_id:householdId,text,done:false,list_id:listId,created_by:userId}).select().single();if(error)setTodos(p=>p.filter(td=>td.id!==tmp.id));else setTodos(p=>p.map(td=>td.id===tmp.id?data:td))}
  async function handleDeleteTodo(item){setTodos(p=>p.filter(td=>td.id!==item.id));await supabase.from("todos").delete().eq("id",item.id)}
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
  const sharedTodos=todos.filter(td=>{const list=lists.find(l=>l.id===td.list_id);return!list||list.shared!==false})
  const isTV=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("mode")==="tv"

  // TV MODE
  if(isTV){return(<><style>{"body{margin:0;background:#000} @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;600;700&family=Nunito:wght@300;400;600;700&display=swap');"}</style><TvView tvWidgets={tvWidgets} calEventsByDay={calEventsByDay} sharedTodos={sharedTodos} onToggleTodo={handleToggleTodo} meals={meals} weather={weather} eventsToday={eventsToday} bgUrl={bgUrl}/></>)}

  const mainStyles=isDesktop?{fontFamily:"'Nunito', sans-serif",display:"flex",height:"100vh",position:"relative",overflow:"hidden",background:t.bg}:{fontFamily:"'Nunito', sans-serif",maxWidth:"430px",margin:"0 auto",height:"100dvh",position:"relative",overflow:"hidden",background:t.bg}

  return(<>
    <style>{`
      @keyframes navSlide{from{opacity:0;transform:translateY(10px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}
      body{margin:0;background:${t.bg}}
      @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;600;700&family=Nunito:wght@300;400;600;700&display=swap');
    `}</style>
    <div style={mainStyles}>
      {isDesktop&&<DesktopSidebar activeTab={tab} onTabChange={setTab} tabs={TABS}/>}
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",flex:1,height:"100%"}}>
        <ClockHero weather={weather} bgUrl={bgUrl}/>

        {/* Content */}
        <div style={{flex:1,padding:isDesktop?"12px 24px 24px":"8px 16px 80px",display:"flex",flexDirection:"column",gap:10,overflowY:"auto",minHeight:0}}>
          {tab==="hem"&&(<>
            <HomeDashboard activeWidgets={activeWidgets} editingWidgets={editingWidgets} onRemoveWidget={handleRemoveWidget} onMoveWidget={handleMoveWidget} onResizeWidget={handleResizeWidget} calEventsByDay={calEventsByDay} sharedTodos={sharedTodos} onToggleTodo={handleToggleTodo} meals={meals} onUpsertMeal={handleUpsertMeal} weather={weather} eventsToday={eventsToday} onDeleteEvent={handleDeleteEvent}/>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button onClick={()=>setWidgetPickerOpen(true)} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,flex:1,padding:"12px",background:"#fff",border:`1px dashed ${t.cardBorder}`,borderRadius:14,cursor:"pointer",color:t.textSec,fontSize:12,fontWeight:500}}><Plus size={14}/> L{"\u00e4"}gg till</button>
              <button onClick={()=>setEditingWidgets(e=>!e)} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"12px 18px",background:editingWidgets?ACCENT+"10":"#fff",border:editingWidgets?`1px solid ${ACCENT}25`:`1px dashed ${t.cardBorder}`,borderRadius:14,cursor:"pointer",color:editingWidgets?ACCENT:t.textSec,fontSize:12,fontWeight:500}}>{editingWidgets?<><CheckIcon size={14}/> Klar</>:"Redigera"}</button>
            </div>
          </>)}
          {tab==="kalender"&&<div style={{display:"flex",flexDirection:"column",gap:10}}><div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={()=>setEventModalOpen(true)} style={{background:ACCENT,color:"#fff",border:"none",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Ny h{"\u00e4"}ndelse</button></div><CalendarCard calEventsByDay={calEventsByDay}/></div>}
          {tab==="listor"&&<ListsTab lists={lists} todos={todos} onAddList={()=>setListModalOpen(true)} onDeleteList={handleDeleteList} onAddTodo={handleAddTodo} onToggleTodo={handleToggleTodo} onDeleteTodo={handleDeleteTodo}/>}
          {tab==="mat"&&<MealCard meals={meals} onEdit={handleUpsertMeal}/>}
          {tab==="mer"&&<SettingsTab householdId={householdId} userId={userId} householdName={household?.name} onOpenTvEditor={()=>setTvEditorOpen(true)}/>}
        </div>

        {/* Mobile nav */}
        {!navOpen&&!isDesktop&&(<button onClick={()=>setNavOpen(true)} style={{position:"absolute",bottom:24,left:"50%",transform:"translateX(-50%)",width:52,height:52,borderRadius:"50%",background:"#fff",border:`1px solid ${t.cardBorder}`,boxShadow:"0 4px 16px rgba(0,0,0,0.08)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:20}}><MenuIcon size={20} color={t.textSec}/></button>)}
        {navOpen&&!isDesktop&&(<>
          <div onClick={()=>setNavOpen(false)} style={{position:"absolute",inset:0,zIndex:40,background:"rgba(0,0,0,0.1)"}}/>
          <div style={{position:"absolute",bottom:24,left:16,right:16,zIndex:50,animation:"navSlide 0.25s ease-out"}}>
            <div style={{background:"#fff",borderRadius:22,display:"flex",padding:4,boxShadow:"0 8px 32px rgba(0,0,0,0.12)",border:`1px solid ${t.cardBorder}`}}>
              {TABS.map(n=>{const active=tab===n.key;return(<button key={n.key} onClick={()=>{setTab(n.key);setNavOpen(false)}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:active?ACCENT+"08":"transparent",border:active?`1px solid ${ACCENT}12`:"1px solid transparent",borderRadius:18,cursor:"pointer",padding:"10px 0 11px"}}>
                <n.Icon size={18} strokeWidth={active?2:1.5} color={active?ACCENT:t.textMuted}/>
                <span style={{fontSize:9,fontWeight:600,color:active?ACCENT:t.textMuted,letterSpacing:"0.05em",textTransform:"uppercase"}}>{n.label}</span>
              </button>)})}
            </div>
          </div>
        </>)}
      </div>
      {eventModalOpen&&<AddEventModal onSave={handleAddEvent} onClose={()=>setEventModalOpen(false)}/>}
      {listModalOpen&&<AddListModal onSave={handleAddList} onClose={()=>setListModalOpen(false)}/>}
      {widgetPickerOpen&&(<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.3)",zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}><div style={{background:"#fff",borderRadius:"24px 24px 0 0",padding:"20px 16px 32px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><span style={{fontSize:16,fontWeight:700,color:t.text}}>L{"\u00e4"}gg till widget</span><button onClick={()=>setWidgetPickerOpen(false)} style={{background:"none",border:"none",cursor:"pointer",color:t.textMuted}}>St{"\u00e4"}ng</button></div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {Object.entries(WIDGET_REGISTRY).filter(([id])=>!activeWidgets.includes(id)).map(([id,w])=>(<button key={id} onClick={()=>handleAddWidget(id)} style={{display:"flex",alignItems:"center",gap:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,borderRadius:14,padding:"12px 16px",cursor:"pointer",width:"100%",textAlign:"left"}}>
            <div style={{flex:1}}><div style={{fontSize:14,color:t.text,fontWeight:600}}>{w.label}</div><div style={{fontSize:11,color:t.textMuted}}>{w.size==="full"?"Hel bredd":"Halv bredd"}</div></div>
          </button>))}
          {Object.entries(WIDGET_REGISTRY).filter(([id])=>!activeWidgets.includes(id)).length===0&&<span style={{fontSize:12,color:t.textMuted}}>Alla widgets tillagda</span>}
        </div>
      </div></div>)}
    </div>
  </>)
}
