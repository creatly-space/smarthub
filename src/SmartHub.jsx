import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "./lib/supabase"

const ACCENT = "#5B52E7"
const ACCENT_SOFT = "#EEEDFE"
const ACCENT_TEXT = "#3C3489"
const GREEN = "#1D9E75"
const GREEN_BG = "#E1F5EE"
const AMBER = "#BA7517"
const RED = "#D94343"
const BG = "#F2F1EE"
const CARD = "#FFFFFF"
const BORDER = "rgba(0,0,0,0.07)"
const T1 = "#1A1A1A"
const T2 = "#666660"
const T3 = "#9E9E98"
const LIST_COLORS = ["#5B52E7","#1D9E75","#BA7517","#185FA5","#D94343","#7c6ef7","#E76F51","#2A9D8F"]

const WEEKDAYS_SV = ["S\u00f6ndag","M\u00e5ndag","Tisdag","Onsdag","Torsdag","Fredag","L\u00f6rdag"]
const WEEKDAYS_SHORT = ["S\u00f6n","M\u00e5n","Tis","Ons","Tor","Fre","L\u00f6r"]
const MONTHS = ["januari","februari","mars","april","maj","juni","juli","augusti","september","oktober","november","december"]
const MEAL_DAYS = ["M\u00e5n","Tis","Ons","Tor","Fre","L\u00f6r","S\u00f6n"]
const EVENT_COLORS = [{color:"#5B52E7",label:"Lila"},{color:"#1D9E75",label:"Gr\u00f6n"},{color:"#BA7517",label:"Orange"},{color:"#185FA5",label:"Bl\u00e5"},{color:"#7c6ef7",label:"Ljuslila"},{color:"#D94343",label:"R\u00f6d"}]

const BACKGROUNDS = [
  {id:"sunset",label:"Solnedg\u00e5ng",style:{background:"linear-gradient(160deg,#1a1a2e 0%,#16213e 40%,#0f3460 70%,#e94560 100%)"},textColor:"#fff"},
  {id:"forest",label:"Skog",style:{background:"linear-gradient(160deg,#0f2027 0%,#203a43 50%,#2c5364 100%)"},textColor:"#fff"},
  {id:"nordic",label:"Nordisk",style:{background:"linear-gradient(160deg,#e8f4f8 0%,#d6eaf8 50%,#a9cce3 100%)"},textColor:"#1a3a5c"},
  {id:"warm",label:"Morgon",style:{background:"linear-gradient(160deg,#f8e7d3 0%,#f5c6a0 50%,#e8956d 100%)"},textColor:"#6b3a1f"},
  {id:"night",label:"Natt",style:{background:"linear-gradient(160deg,#0d0d0d 0%,#1a1a1a 50%,#2d2d2d 100%)"},textColor:"#fff"},
  {id:"aurora",label:"Aurora",style:{background:"linear-gradient(160deg,#0b1a2e 0%,#0d4f3c 40%,#1a7a5e 70%,#00d4aa 100%)"},textColor:"#c8fff4"}
]

const LAYOUTS = [
  {id:"big-two-small",label:"1 stor + 2 sm\u00e5",preview:[[2],[1,1]],cols:2,rows:2,rowFr:[2,1],slots:[{id:"A",col:1,colSpan:2,row:1,rowSpan:1},{id:"B",col:1,colSpan:1,row:2,rowSpan:1},{id:"C",col:2,colSpan:1,row:2,rowSpan:1}]},
  {id:"two-two",label:"2x2 grid",preview:[[1,1],[1,1]],cols:2,rows:2,rowFr:[1,1],slots:[{id:"A",col:1,colSpan:1,row:1,rowSpan:1},{id:"B",col:2,colSpan:1,row:1,rowSpan:1},{id:"C",col:1,colSpan:1,row:2,rowSpan:1},{id:"D",col:2,colSpan:1,row:2,rowSpan:1}]},
  {id:"tall-right",label:"Stor h\u00f6ger",preview:[[1,1],[1,1]],cols:2,rows:2,rowFr:[1,1],slots:[{id:"A",col:1,colSpan:1,row:1,rowSpan:1},{id:"B",col:1,colSpan:1,row:2,rowSpan:1},{id:"C",col:2,colSpan:1,row:1,rowSpan:2}]},
  {id:"two-small-big",label:"2 sm\u00e5 + 1 stor",preview:[[1,1],[2]],cols:2,rows:2,rowFr:[1,2],slots:[{id:"A",col:1,colSpan:1,row:1,rowSpan:1},{id:"B",col:2,colSpan:1,row:1,rowSpan:1},{id:"C",col:1,colSpan:2,row:2,rowSpan:1}]},
  {id:"three",label:"3 lika",preview:[[1,1,1]],cols:3,rows:1,rowFr:[1],slots:[{id:"A",col:1,colSpan:1,row:1,rowSpan:1},{id:"B",col:2,colSpan:1,row:1,rowSpan:1},{id:"C",col:3,colSpan:1,row:1,rowSpan:1}]}
]

const WIDGET_DEFS = [
  {id:"kalender",label:"Kalender",icon:"\ud83d\udcc5"},{id:"todo",label:"Att g\u00f6ra",icon:"\u2611\ufe0f"},{id:"mat",label:"Matsedel",icon:"\ud83c\udf7d\ufe0f"},{id:"events",label:"H\u00e4ndelser",icon:"\ud83d\udccb"},{id:"vader",label:"V\u00e4der",icon:"\ud83c\udf24\ufe0f"},{id:"tom",label:"Tom",icon:"\u2795"}
]

const WEATHER_LAT=56.66,WEATHER_LON=16.36,WEATHER_LOCATION="Kalmar"
const WMO={0:{e:"\u2600\ufe0f",t:"Klart"},1:{e:"\ud83c\udf24\ufe0f",t:"Mestadels klart"},2:{e:"\u26c5",t:"Halvklart"},3:{e:"\u2601\ufe0f",t:"Mulet"},45:{e:"\ud83c\udf2b\ufe0f",t:"Dimma"},48:{e:"\ud83c\udf2b\ufe0f",t:"Rimfrost"},51:{e:"\ud83c\udf26\ufe0f",t:"L\u00e4tt duggregn"},53:{e:"\ud83c\udf26\ufe0f",t:"Duggregn"},55:{e:"\ud83c\udf27\ufe0f",t:"Kraftigt duggregn"},61:{e:"\ud83c\udf26\ufe0f",t:"L\u00e4tt regn"},63:{e:"\ud83c\udf27\ufe0f",t:"Regn"},65:{e:"\ud83c\udf27\ufe0f",t:"Kraftigt regn"},71:{e:"\ud83c\udf28\ufe0f",t:"L\u00e4tt sn\u00f6"},73:{e:"\u2744\ufe0f",t:"Sn\u00f6fall"},75:{e:"\u2744\ufe0f",t:"Kraftigt sn\u00f6fall"},80:{e:"\ud83c\udf26\ufe0f",t:"L\u00e4tt regnskur"},81:{e:"\ud83c\udf27\ufe0f",t:"Regnskur"},82:{e:"\ud83c\udf27\ufe0f",t:"Kraftig skur"},95:{e:"\u26c8\ufe0f",t:"\u00c5skv\u00e4der"},96:{e:"\u26c8\ufe0f",t:"\u00c5ska med hagel"},99:{e:"\u26c8\ufe0f",t:"Kraftig \u00e5ska"}}
function parseWeather(json){if(!json||!json.current)return null;const temp=Math.round(json.current.temperature_2m);const code=json.current.weathercode;const wind=Math.round(json.current.windspeed_10m/3.6);const w=WMO[code]||{e:"\u2601\ufe0f",t:"Ok\u00e4nt"};const forecast=[];if(json.daily&&json.daily.time){for(let i=1;i<json.daily.time.length&&forecast.length<3;i++){const d=new Date(json.daily.time[i]);const fc=json.daily.weathercode[i];const fi=WMO[fc]||{e:"\u2601\ufe0f",t:""};forecast.push({day:WEEKDAYS_SHORT[d.getDay()],icon:fi.e,temp:Math.round(json.daily.temperature_2m_max[i])+"\u00b0"})}};return{temp,icon:w.e,desc:w.t,wind,forecast,location:WEATHER_LOCATION}}

function getISOWeek(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const dayNum=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-dayNum);const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));return{week:Math.ceil((((d-yearStart)/86400000)+1)/7),year:d.getUTCFullYear()}}
function fmtTime(iso){if(!iso)return"";const d=new Date(iso);return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")}
function fmtDate(date){return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0")}
function genCode(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let r="";for(let i=0;i<6;i++)r+=c[Math.floor(Math.random()*c.length)];return r}
function daysLeft(d){if(!d)return null;const now=new Date();const exp=new Date(d);const diff=Math.ceil((exp-now)/(1000*60*60*24));return diff}

function groupEventsByDay(events,year,month){const out={};events.forEach(ev=>{const d=new Date(ev.start_time);if(d.getFullYear()===year&&d.getMonth()===month){const day=d.getDate();if(!out[day])out[day]=[];out[day].push({time:fmtTime(ev.start_time),title:ev.title,color:ev.color||ACCENT})}});Object.keys(out).forEach(k=>out[k].sort((a,b)=>a.time.localeCompare(b.time)));return out}
function getEventsToday(events){const today=new Date();const y=today.getFullYear(),m=today.getMonth(),d=today.getDate();return events.filter(ev=>{const dt=new Date(ev.start_time);return dt.getFullYear()===y&&dt.getMonth()===m&&dt.getDate()===d}).sort((a,b)=>new Date(a.start_time)-new Date(b.start_time)).map(ev=>{const start=new Date(ev.start_time);const end=ev.end_time?new Date(ev.end_time):null;const now=new Date();const isNow=end?now>=start&&now<=end:Math.abs(now-start)<30*60*1000;return{id:ev.id,start:fmtTime(ev.start_time),title:ev.title,location:ev.location,color:ev.color||ACCENT,now:isNow}})}

const inputStyle={width:"100%",padding:"8px 10px",fontSize:12,border:"1.5px solid "+BORDER,borderRadius:10,outline:"none",fontFamily:"inherit",background:BG,boxSizing:"border-box"}
const btnSmall={background:"none",border:"none",cursor:"pointer",padding:"2px 6px",fontSize:14,color:T3,borderRadius:6,lineHeight:1}

// ----- Modals -----
function AddEventModal({onSave,onClose}){
  const[title,setTitle]=useState("");const[date,setDate]=useState(fmtDate(new Date()));const[startTime,setStartTime]=useState("12:00");const[endTime,setEndTime]=useState("13:00");const[location,setLocation]=useState("");const[color,setColor]=useState(EVENT_COLORS[0].color);const[shared,setShared]=useState(true)
  function handleSubmit(){if(!title.trim())return;onSave({title:title.trim(),start_time:date+"T"+startTime+":00",end_time:date+"T"+endTime+":00",location:location.trim()||null,color,shared})}
  return(<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}><div style={{background:CARD,borderRadius:"20px 20px 0 0",padding:"20px 16px 28px",display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:16,fontWeight:600,color:T1}}>Ny h{"\u00e4"}ndelse</span><button onClick={onClose} style={btnSmall}>Avbryt</button></div>
    <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Titel" style={inputStyle} autoFocus/>
    <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inputStyle}/>
    <div style={{display:"flex",gap:8}}><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} style={{...inputStyle,flex:1}}/><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} style={{...inputStyle,flex:1}}/></div>
    <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Plats (valfritt)" style={inputStyle}/>
    <div style={{display:"flex",gap:6}}>{EVENT_COLORS.map(c=>(<button key={c.color} onClick={()=>setColor(c.color)} style={{width:28,height:28,borderRadius:"50%",background:c.color,border:color===c.color?"3px solid "+T1:"3px solid transparent",cursor:"pointer",padding:0}}/>))}</div>
    <button onClick={()=>setShared(s=>!s)} style={{display:"flex",alignItems:"center",gap:8,background:BG,border:"1.5px solid "+BORDER,borderRadius:10,padding:"8px 12px",cursor:"pointer"}}><span style={{fontSize:14}}>{shared?"\ud83d\udc65":"\ud83d\udd12"}</span><span style={{fontSize:12,color:T1}}>{shared?"Delad med hush\u00e5llet":"Bara f\u00f6r mig"}</span></button>
    <button onClick={handleSubmit} style={{width:"100%",background:ACCENT,color:"#fff",border:"none",borderRadius:14,padding:"13px",fontSize:14,fontWeight:600,cursor:"pointer",opacity:title.trim()?1:0.5}}>L{"\u00e4"}gg till</button>
  </div></div>)
}

function AddListModal({onSave,onClose}){
  const[name,setName]=useState("");const[shared,setShared]=useState(true);const[color,setColor]=useState(LIST_COLORS[0]);const[hasExpiry,setHasExpiry]=useState(false);const[expiryDate,setExpiryDate]=useState("")
  function handleSubmit(){if(!name.trim())return;onSave({name:name.trim(),shared,color,expires_at:hasExpiry&&expiryDate?expiryDate+"T23:59:59":null})}
  return(<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}><div style={{background:CARD,borderRadius:"20px 20px 0 0",padding:"20px 16px 28px",display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:16,fontWeight:600,color:T1}}>Ny lista</span><button onClick={onClose} style={btnSmall}>Avbryt</button></div>
    <input value={name} onChange={e=>setName(e.target.value)} placeholder="Namn p\u00e5 listan" style={inputStyle} autoFocus/>
    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{LIST_COLORS.map(c=>(<button key={c} onClick={()=>setColor(c)} style={{width:26,height:26,borderRadius:"50%",background:c,border:color===c?"3px solid "+T1:"3px solid transparent",cursor:"pointer",padding:0}}/>))}</div>
    <button onClick={()=>setShared(s=>!s)} style={{display:"flex",alignItems:"center",gap:8,background:BG,border:"1.5px solid "+BORDER,borderRadius:10,padding:"8px 12px",cursor:"pointer"}}><span style={{fontSize:14}}>{shared?"\ud83d\udc65":"\ud83d\udd12"}</span><span style={{fontSize:12,color:T1}}>{shared?"Delad med hush\u00e5llet":"Privat lista"}</span></button>
    <button onClick={()=>setHasExpiry(h=>!h)} style={{display:"flex",alignItems:"center",gap:8,background:BG,border:"1.5px solid "+BORDER,borderRadius:10,padding:"8px 12px",cursor:"pointer"}}><span style={{fontSize:14}}>{hasExpiry?"\u23f0":"\u221e"}</span><span style={{fontSize:12,color:T1}}>{hasExpiry?"Utg\u00e5ngsdatum":"Ingen tidsgr\u00e4ns"}</span></button>
    {hasExpiry&&<input type="date" value={expiryDate} onChange={e=>setExpiryDate(e.target.value)} style={inputStyle}/>}
    <button onClick={handleSubmit} style={{width:"100%",background:ACCENT,color:"#fff",border:"none",borderRadius:14,padding:"13px",fontSize:14,fontWeight:600,cursor:"pointer",opacity:name.trim()?1:0.5}}>Skapa lista</button>
  </div></div>)
}

// ----- Widgets (unchanged from v6 except WidgetTodo uses shared todos for Hem) -----
function WidgetKalender({calEventsByDay}){
  const now=new Date();const[vm,setVm]=useState(now.getMonth());const[vy,setVy]=useState(now.getFullYear())
  const firstDay=new Date(vy,vm,1).getDay();const offset=firstDay===0?6:firstDay-1;const days=new Date(vy,vm+1,0).getDate()
  const cells=[];for(let i=0;i<offset;i++)cells.push(null);for(let i=1;i<=days;i++)cells.push(i);while(cells.length%7!==0)cells.push(null)
  const weeks=[];for(let i=0;i<cells.length;i+=7)weeks.push(cells.slice(i,i+7))
  const isToday=d=>d===now.getDate()&&vm===now.getMonth()&&vy===now.getFullYear()
  const eventsForView=(vm===now.getMonth()&&vy===now.getFullYear())?calEventsByDay:{}
  return(<div style={{display:"flex",flexDirection:"column",height:"100%",gap:6}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}><button onClick={()=>{if(vm===0){setVm(11);setVy(y=>y-1)}else setVm(m=>m-1)}} style={{background:"none",border:"none",cursor:"pointer",color:T2,fontSize:14}}>{"<"}</button><span style={{fontSize:11,fontWeight:700,color:T1}}>{MONTHS[vm].slice(0,3).toUpperCase()} {vy}</span><button onClick={()=>{if(vm===11){setVm(0);setVy(y=>y+1)}else setVm(m=>m+1)}} style={{background:"none",border:"none",cursor:"pointer",color:T2,fontSize:14}}>{">"}</button></div>
    <table style={{width:"100%",borderCollapse:"collapse",flex:1,tableLayout:"fixed"}}><thead><tr>{["M","T","O","T","F","L","S"].map((d,i)=>(<th key={i} style={{fontSize:8,color:i>=5?ACCENT:T3,fontWeight:600,textAlign:"center",padding:"2px 0"}}>{d}</th>))}</tr></thead><tbody>{weeks.map((week,wi)=>(<tr key={wi}>{week.map((d,di)=>{const evs=d?(eventsForView[d]||[]):[];const today=d&&isToday(d);return(<td key={di} style={{verticalAlign:"top",padding:"1px",textAlign:"center"}}>{d&&(<><div style={{width:18,height:18,borderRadius:"50%",background:today?ACCENT:"transparent",color:today?"#fff":di>=5?ACCENT:T1,fontSize:9,fontWeight:today?700:400,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 1px"}}>{d}</div>{evs.slice(0,2).map((ev,ei)=>(<div key={ei} style={{display:"flex",alignItems:"center",gap:2,marginBottom:1,paddingLeft:2,borderLeft:"2px solid "+ev.color}}><span style={{fontSize:7,color:T3,fontWeight:600,flexShrink:0}}>{ev.time}</span><span style={{fontSize:7,color:T1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"left"}}>{ev.title}</span></div>))}{evs.length===0&&<div style={{height:3}}/>}</>)}</td>)})}</tr>))}</tbody></table>
  </div>)
}

function WidgetHomeTodo({todos,onToggle}){
  const remaining=todos.filter(i=>!i.done).length
  return(<div style={{display:"flex",flexDirection:"column",height:"100%",gap:6}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}><span style={{fontSize:11,fontWeight:700,color:T1}}>Att g{"\u00f6"}ra</span><span style={{fontSize:9,color:GREEN,background:GREEN_BG,padding:"2px 7px",borderRadius:10,fontWeight:600}}>{remaining} kvar</span></div>
    <div style={{flex:1,display:"flex",flexDirection:"column",gap:5,overflowY:"auto"}}>{todos.length===0&&<span style={{fontSize:10,color:T3,fontStyle:"italic"}}>Inga uppgifter</span>}{todos.map(item=>(<div key={item.id} style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}><div onClick={()=>onToggle(item)} style={{width:15,height:15,borderRadius:"50%",flexShrink:0,border:item.done?"none":"1.5px solid "+BORDER,background:item.done?GREEN:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff",cursor:"pointer"}}>{item.done?"\u2713":""}</div><span onClick={()=>onToggle(item)} style={{fontSize:11,color:item.done?T3:T1,textDecoration:item.done?"line-through":"none",flex:1,cursor:"pointer"}}>{item.text}</span></div>))}</div>
  </div>)
}

function WidgetMat({meals,onEdit,compact}){
  const now=new Date();const todayIdx=now.getDay()===0?6:now.getDay()-1
  const[editingDay,setEditingDay]=useState(null);const[editText,setEditText]=useState("");const inputRef=useRef(null)
  const byDay={};meals.forEach(m=>{byDay[m.weekday-1]=m.meal_text})
  function startEdit(dayIdx){if(!onEdit)return;setEditingDay(dayIdx);setEditText(byDay[dayIdx]||"");setTimeout(()=>inputRef.current?.focus(),50)}
  function saveEdit(){if(editingDay===null)return;onEdit(editingDay+1,editText.trim());setEditingDay(null);setEditText("")}
  return(<div style={{display:"flex",flexDirection:"column",height:"100%",gap:5}}><span style={{fontSize:11,fontWeight:700,color:T1,flexShrink:0}}>Matsedel</span><div style={{flex:1,display:"flex",flexDirection:"column",gap:4,overflowY:"auto"}}>{MEAL_DAYS.map((day,i)=>(<div key={i} style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,minHeight:24}}><span style={{fontSize:8,fontWeight:600,color:i===todayIdx?AMBER:T3,minWidth:22,textAlign:"right",flexShrink:0}}>{day}</span>{editingDay===i?(<input ref={inputRef} value={editText} onChange={e=>setEditText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveEdit();if(e.key==="Escape")setEditingDay(null)}} onBlur={saveEdit} style={{...inputStyle,padding:"4px 6px",fontSize:11,flex:1}}/>):(<span onClick={()=>startEdit(i)} style={{fontSize:11,color:i===todayIdx?T1:T2,fontWeight:i===todayIdx?600:400,flex:1,cursor:onEdit?"pointer":"default",borderRadius:6,padding:"2px 4px"}}>{byDay[i]||<span style={{color:T3,fontStyle:"italic"}}>{onEdit?"Klicka...":"\u2014"}</span>}</span>)}</div>))}</div></div>)
}

function WidgetEvents({eventsToday,onDelete}){
  return(<div style={{display:"flex",flexDirection:"column",height:"100%",gap:6}}><span style={{fontSize:11,fontWeight:700,color:T1,flexShrink:0}}>Idag</span><div style={{flex:1,display:"flex",flexDirection:"column",gap:8,overflowY:"auto"}}>{eventsToday.length===0&&<span style={{fontSize:10,color:T3,fontStyle:"italic"}}>Inget inplanerat idag</span>}{eventsToday.map(e=>(<div key={e.id} style={{display:"flex",gap:8,alignItems:"flex-start",flexShrink:0}}><div style={{width:3,minHeight:32,background:e.color,borderRadius:2,flexShrink:0,marginTop:2}}/><div style={{flex:1}}><div style={{fontSize:9,color:T3,fontWeight:500}}>{e.start}{e.now&&<span style={{background:ACCENT,color:"#fff",fontSize:8,padding:"1px 5px",borderRadius:6,marginLeft:4}}>Nu</span>}</div><div style={{fontSize:11,color:T1,fontWeight:500}}>{e.title}</div>{e.location&&<div style={{fontSize:9,color:T3}}>{"\ud83d\udccd"} {e.location}</div>}</div>{onDelete&&<button onClick={()=>onDelete(e.id)} style={{...btnSmall,fontSize:11,marginTop:2}}>{"\u00d7"}</button>}</div>))}</div></div>)
}

function WidgetVader({weather}){
  if(!weather)return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:T3,fontSize:10}}>Laddar v{"\u00e4"}der...</div>)
  return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:4}}><span style={{fontSize:32}}>{weather.icon}</span><span style={{fontSize:28,fontWeight:200,color:T1}}>{weather.temp}{"\u00b0"}</span><span style={{fontSize:10,color:T3}}>{weather.desc} {"\u00b7"} {weather.location}</span><span style={{fontSize:9,color:T3}}>Vind: {weather.wind} m/s</span><div style={{display:"flex",gap:10,marginTop:6}}>{weather.forecast.map(w=>(<div key={w.day} style={{textAlign:"center"}}><div style={{fontSize:9,color:T3}}>{w.day}</div><div style={{fontSize:14}}>{w.icon}</div><div style={{fontSize:10,color:T2,fontWeight:500}}>{w.temp}</div></div>))}</div></div>)
}

function WidgetTom({onEdit}){return(<div onClick={onEdit} style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",flexDirection:"column",gap:6,opacity:0.3,cursor:"pointer"}}><span style={{fontSize:22}}>{"\u2795"}</span><span style={{fontSize:10,color:T3}}>L{"\u00e4"}gg till</span></div>)}

function renderWidget(id,ctx){switch(id){case"kalender":return<WidgetKalender calEventsByDay={ctx.calEventsByDay}/>;case"todo":return<WidgetHomeTodo todos={ctx.sharedTodos} onToggle={ctx.onToggleTodo}/>;case"mat":return<WidgetMat meals={ctx.meals} onEdit={ctx.onUpsertMeal} compact/>;case"events":return<WidgetEvents eventsToday={ctx.eventsToday} onDelete={ctx.onDeleteEvent}/>;case"vader":return<WidgetVader weather={ctx.weather}/>;default:return<WidgetTom onEdit={ctx.onEdit}/>}}

function ClockHero({bg,onChangeBg,weather}){
  const[time,setTime]=useState(new Date());const[showPicker,setShowPicker]=useState(false)
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t)},[])
  const h=String(time.getHours()).padStart(2,"0"),m=String(time.getMinutes()).padStart(2,"0"),s=String(time.getSeconds()).padStart(2,"0")
  const tc=bg.textColor,ts=tc==="#fff"?"0 2px 12px rgba(0,0,0,0.3)":"none"
  const wi=weather||{icon:"\u2601\ufe0f",temp:"--",desc:"Laddar..."}
  return(<div style={{...bg.style,padding:"20px 20px 14px",position:"relative",flexShrink:0}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:50,fontWeight:200,color:tc,letterSpacing:"-0.02em",lineHeight:1,textShadow:ts,fontVariantNumeric:"tabular-nums"}}>{h}:{m}<span style={{fontSize:18,opacity:0.5}}>:{s}</span></div><div style={{fontSize:12,color:tc,opacity:0.75,marginTop:5,textShadow:ts}}>{WEEKDAYS_SV[time.getDay()]} {"\u00b7"} {time.getDate()} {MONTHS[time.getMonth()]}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:26}}>{wi.icon}</div><div style={{fontSize:20,fontWeight:200,color:tc,textShadow:ts}}>{wi.temp}{"\u00b0"}</div><div style={{fontSize:10,color:tc,opacity:0.7}}>{wi.desc}</div></div></div>
    <button onClick={()=>setShowPicker(p=>!p)} style={{position:"absolute",top:10,right:10,background:"rgba(255,255,255,0.15)",border:"none",borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:11,color:tc}}>{"\ud83c\udfa8"}</button>
    {showPicker&&(<div style={{position:"absolute",top:38,right:10,background:"rgba(10,10,10,0.9)",borderRadius:14,padding:10,display:"flex",flexDirection:"column",gap:6,zIndex:20,minWidth:145}}>{BACKGROUNDS.map(b=>(<button key={b.id} onClick={()=>{onChangeBg(b);setShowPicker(false)}} style={{display:"flex",alignItems:"center",gap:8,background:bg.id===b.id?"rgba(255,255,255,0.15)":"transparent",border:"1px solid "+(bg.id===b.id?"rgba(255,255,255,0.3)":"transparent"),borderRadius:10,padding:"6px 10px",cursor:"pointer"}}><div style={{...b.style,width:22,height:22,borderRadius:5,flexShrink:0}}/><span style={{fontSize:12,color:"#fff",fontWeight:bg.id===b.id?600:400}}>{b.label}</span></button>))}</div>)}
  </div>)
}

function EditPanel({layout,assignments,onSave,onClose}){
  const[selLayout,setSelLayout]=useState(layout);const[selAssign,setSelAssign]=useState({...assignments});const[pickingSlot,setPickingSlot]=useState(null);const curLayout=LAYOUTS.find(l=>l.id===selLayout)
  return(<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}><div style={{background:CARD,borderRadius:"20px 20px 0 0",maxHeight:"88%",display:"flex",flexDirection:"column"}}><div style={{display:"flex",justifyContent:"center",padding:"12px 0 0",flexShrink:0}}><div style={{width:36,height:4,borderRadius:2,background:BORDER}}/></div><div style={{padding:"14px 20px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"0.5px solid "+BORDER,flexShrink:0}}><span style={{fontSize:16,fontWeight:600,color:T1}}>Anpassa dashboard</span><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:T3}}>Avbryt</button></div>
    <div style={{flex:1,overflowY:"auto",padding:"16px"}}><div style={{fontSize:11,fontWeight:600,color:T3,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Layout</div><div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8}}>{LAYOUTS.map(l=>(<button key={l.id} onClick={()=>{setSelLayout(l.id);setSelAssign({})}} style={{flexShrink:0,background:selLayout===l.id?ACCENT_SOFT:BG,border:"1.5px solid "+(selLayout===l.id?ACCENT:BORDER),borderRadius:12,padding:"10px 12px",cursor:"pointer",textAlign:"center",minWidth:82}}><div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:6}}>{l.preview.map((row,ri)=>(<div key={ri} style={{display:"flex",gap:3}}>{row.map((span,ci)=>(<div key={ci} style={{height:14,background:selLayout===l.id?ACCENT:T3,borderRadius:3,flex:span,opacity:0.6}}/>))}</div>))}</div><span style={{fontSize:10,fontWeight:500,color:selLayout===l.id?ACCENT_TEXT:T2,whiteSpace:"nowrap"}}>{l.label}</span></button>))}</div>
      <div style={{fontSize:11,fontWeight:600,color:T3,textTransform:"uppercase",letterSpacing:"0.08em",margin:"16px 0 10px"}}>Inneh{"\u00e5"}ll per ruta</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{curLayout.slots.map(slot=>{const wid=selAssign[slot.id]||"tom";const def=WIDGET_DEFS.find(w=>w.id===wid)||WIDGET_DEFS[WIDGET_DEFS.length-1];return(<div key={slot.id}><button onClick={()=>setPickingSlot(pickingSlot===slot.id?null:slot.id)} style={{width:"100%",background:BG,border:"1.5px solid "+(pickingSlot===slot.id?ACCENT:BORDER),borderRadius:12,padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left"}}><span style={{fontSize:20}}>{def.icon}</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,color:T1}}>Ruta {slot.id}</div><div style={{fontSize:11,color:T3}}>{def.label}</div></div><span style={{fontSize:12,color:T3}}>{pickingSlot===slot.id?"\u25b2":"\u25bc"}</span></button>{pickingSlot===slot.id&&(<div style={{display:"flex",flexWrap:"wrap",gap:8,padding:"10px 2px"}}>{WIDGET_DEFS.map(w=>(<button key={w.id} onClick={()=>{setSelAssign(a=>({...a,[slot.id]:w.id}));setPickingSlot(null)}} style={{display:"flex",alignItems:"center",gap:6,background:wid===w.id?ACCENT_SOFT:CARD,border:"1.5px solid "+(wid===w.id?ACCENT:BORDER),borderRadius:10,padding:"8px 12px",cursor:"pointer"}}><span style={{fontSize:16}}>{w.icon}</span><span style={{fontSize:12,fontWeight:500,color:wid===w.id?ACCENT_TEXT:T1}}>{w.label}</span></button>))}</div>)}</div>)})}</div>
    </div><div style={{padding:"12px 16px 28px",flexShrink:0,borderTop:"0.5px solid "+BORDER}}><button onClick={()=>onSave(selLayout,selAssign)} style={{width:"100%",background:ACCENT,color:"#fff",border:"none",borderRadius:14,padding:"14px",fontSize:15,fontWeight:600,cursor:"pointer"}}>Spara layout</button></div></div></div>)
}

function GridDash({layoutId,assignments,onEdit,widgetCtx}){const layout=LAYOUTS.find(l=>l.id===layoutId);const rowFrStr=layout.rowFr.map(f=>f+"fr").join(" ");return(<div style={{display:"flex",flexDirection:"column",height:"100%"}}><div style={{display:"flex",justifyContent:"flex-end",marginBottom:8,flexShrink:0}}><button onClick={onEdit} style={{background:CARD,border:"0.5px solid "+BORDER,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:500,color:T2}}>{"\u270f\ufe0f"} Anpassa</button></div><div style={{flex:1,display:"grid",gridTemplateColumns:"repeat("+layout.cols+",1fr)",gridTemplateRows:rowFrStr,gap:8,minHeight:0}}>{layout.slots.map(slot=>{const wid=assignments[slot.id]||"tom";return(<div key={slot.id} style={{gridColumn:slot.col+" / span "+slot.colSpan,gridRow:slot.row+" / span "+slot.rowSpan,background:CARD,borderRadius:14,border:"0.5px solid "+BORDER,padding:10,overflow:"hidden",minHeight:0}}>{renderWidget(wid,{...widgetCtx,onEdit})}</div>)})}</div></div>)}

function FullKal({events,onAddEvent,onDeleteEvent}){
  const now=new Date();const[vm,setVm]=useState(now.getMonth());const[vy,setVy]=useState(now.getFullYear())
  const firstDay=new Date(vy,vm,1).getDay();const offset=firstDay===0?6:firstDay-1;const days=new Date(vy,vm+1,0).getDate()
  const cells=[];for(let i=0;i<offset;i++)cells.push(null);for(let i=1;i<=days;i++)cells.push(i);while(cells.length%7!==0)cells.push(null)
  const weeks=[];for(let i=0;i<cells.length;i+=7)weeks.push(cells.slice(i,i+7))
  const isToday=d=>d===now.getDate()&&vm===now.getMonth()&&vy===now.getFullYear()
  const getWeek=d=>{if(!d)return"";return getISOWeek(new Date(vy,vm,d)).week}
  const eventsByDay=useMemo(()=>groupEventsByDay(events,vy,vm),[events,vy,vm])
  return(<div style={{display:"flex",flexDirection:"column",gap:8}}>
    {onAddEvent&&<div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={onAddEvent} style={{background:ACCENT,color:"#fff",border:"none",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Ny h{"\u00e4"}ndelse</button></div>}
    <div style={{background:CARD,borderRadius:14,border:"0.5px solid "+BORDER,overflow:"hidden"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"0.5px solid "+BORDER}}><button onClick={()=>{if(vm===0){setVm(11);setVy(y=>y-1)}else setVm(m=>m-1)}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:T2}}>{"<"}</button><span style={{fontSize:15,fontWeight:700,color:T1}}>{MONTHS[vm].charAt(0).toUpperCase()+MONTHS[vm].slice(1)} {vy}</span><button onClick={()=>{if(vm===11){setVm(0);setVy(y=>y+1)}else setVm(m=>m+1)}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:T2}}>{">"}</button></div>
      <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed"}}><colgroup><col style={{width:"22px"}}/><col/><col/><col/><col/><col/><col/><col/></colgroup><thead><tr style={{borderBottom:"0.5px solid "+BORDER}}><th style={{padding:"6px 0",fontSize:9,color:T3,textAlign:"center"}}>#</th>{["M\u00e5n","Tis","Ons","Tor","Fre","L\u00f6r","S\u00f6n"].map((d,i)=>(<th key={d} style={{padding:"6px 2px",fontSize:10,color:i>=5?ACCENT:T3,fontWeight:600,textAlign:"center",textTransform:"uppercase"}}>{d}</th>))}</tr></thead><tbody>{weeks.map((week,wi)=>(<tr key={wi} style={{borderBottom:wi<weeks.length-1?"0.5px solid "+BORDER:"none"}}><td style={{padding:"4px 2px",textAlign:"center",borderRight:"0.5px solid "+BORDER}}><span style={{fontSize:9,color:T3}}>{week.find(d=>d)?getWeek(week.find(d=>d)):""}</span></td>{week.map((d,di)=>{const evs=d?(eventsByDay[d]||[]):[];const today=d&&isToday(d);return(<td key={di} style={{padding:"3px",verticalAlign:"top",borderRight:di<6?"0.5px solid "+BORDER:"none",background:today?"rgba(91,82,231,0.05)":"transparent"}}>{d&&(<><div style={{width:20,height:20,borderRadius:"50%",background:today?ACCENT:"transparent",color:today?"#fff":di>=5?ACCENT:T1,fontSize:11,fontWeight:today?700:400,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto"}}>{d}</div>{evs.map((ev,ei)=>(<div key={ei} style={{display:"flex",flexDirection:"column",marginTop:2,paddingLeft:3,borderLeft:"2px solid "+ev.color,lineHeight:1.1}}><span style={{fontSize:8,color:T3,fontWeight:600}}>{ev.time}</span><span style={{fontSize:9,color:T1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.title}</span></div>))}</>)}</td>)})}</tr>))}</tbody></table></div>
    {onDeleteEvent&&(<div style={{background:CARD,borderRadius:14,border:"0.5px solid "+BORDER,padding:14}}><div style={{fontSize:11,fontWeight:700,color:T1,marginBottom:8}}>Kommande h{"\u00e4"}ndelser</div>{events.filter(e=>new Date(e.start_time)>=new Date(new Date().setHours(0,0,0,0))).slice(0,15).map(ev=>(<div key={ev.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"0.5px solid "+BORDER}}><div style={{width:3,height:24,background:ev.color||ACCENT,borderRadius:2,flexShrink:0}}/><div style={{flex:1}}><div style={{fontSize:10,color:T3}}>{new Date(ev.start_time).toLocaleDateString("sv-SE")} {fmtTime(ev.start_time)}</div><div style={{fontSize:12,color:T1,fontWeight:500}}>{ev.title}</div></div><button onClick={()=>onDeleteEvent(ev.id)} style={{...btnSmall,color:RED,fontSize:13}}>{"\u00d7"}</button></div>))}</div>)}
  </div>)
}

// ----- Lists Tab -----
function ListsTab({lists,todos,onAddList,onDeleteList,onAddTodo,onToggleTodo,onDeleteTodo,userId,members}){
  const[expanded,setExpanded]=useState({})
  const toggle=id=>setExpanded(p=>({...p,[id]:!p[id]}))
  const[addingTo,setAddingTo]=useState(null);const[newText,setNewText]=useState("")
  function handleAdd(listId){if(!newText.trim())return;onAddTodo(newText.trim(),listId);setNewText("");setAddingTo(null)}
  return(<div style={{height:"100%",overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
    <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={onAddList} style={{background:ACCENT,color:"#fff",border:"none",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Ny lista</button></div>
    {lists.map(list=>{const listTodos=todos.filter(t=>t.list_id===list.id);const remaining=listTodos.filter(t=>!t.done).length;const isOpen=expanded[list.id]!==false;const dl=daysLeft(list.expires_at)
      return(<div key={list.id} style={{background:CARD,borderRadius:14,border:"0.5px solid "+BORDER,overflow:"hidden"}}>
        <div onClick={()=>toggle(list.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer",borderBottom:isOpen?"0.5px solid "+BORDER:"none"}}>
          <div style={{width:4,height:24,borderRadius:2,background:list.color,flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:600,color:T1}}>{list.name}</span>{!list.shared&&<span style={{fontSize:9,color:T3}}>{"\ud83d\udd12"}</span>}</div>
            <div style={{display:"flex",gap:8,marginTop:2}}><span style={{fontSize:10,color:T3}}>{remaining} kvar</span>{dl!==null&&<span style={{fontSize:10,color:dl<=2?RED:dl<=5?AMBER:T3}}>{dl<=0?"Utg\u00e5ngen":dl+" dagar kvar"}</span>}</div>
          </div>
          <span style={{fontSize:12,color:T3}}>{isOpen?"\u25b2":"\u25bc"}</span>
          <button onClick={e=>{e.stopPropagation();onDeleteList(list.id)}} style={{...btnSmall,color:T3,fontSize:11}}>{"\u00d7"}</button>
        </div>
        {isOpen&&(<div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
          {listTodos.map(item=>(<div key={item.id} style={{display:"flex",alignItems:"center",gap:7}}>
            <div onClick={()=>onToggleTodo(item)} style={{width:15,height:15,borderRadius:"50%",flexShrink:0,border:item.done?"none":"1.5px solid "+BORDER,background:item.done?GREEN:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff",cursor:"pointer"}}>{item.done?"\u2713":""}</div>
            <span onClick={()=>onToggleTodo(item)} style={{fontSize:12,color:item.done?T3:T1,textDecoration:item.done?"line-through":"none",flex:1,cursor:"pointer"}}>{item.text}</span>
            {item.due_date&&<span style={{fontSize:9,color:daysLeft(item.due_date)<=1?RED:T3}}>{new Date(item.due_date).toLocaleDateString("sv-SE",{day:"numeric",month:"short"})}</span>}
            <button onClick={()=>onDeleteTodo(item)} style={{...btnSmall,color:T3,fontSize:11}}>{"\u00d7"}</button>
          </div>))}
          {addingTo===list.id?(<div style={{display:"flex",gap:6}}><input value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleAdd(list.id);if(e.key==="Escape"){setAddingTo(null);setNewText("")}}} placeholder="Ny uppgift..." style={{...inputStyle,flex:1}} autoFocus/><button onClick={()=>handleAdd(list.id)} style={{background:ACCENT,color:"#fff",border:"none",borderRadius:10,padding:"0 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>+</button></div>):(<button onClick={()=>setAddingTo(list.id)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:"4px 0",color:T3,fontSize:11}}>+ L{"\u00e4"}gg till uppgift</button>)}
        </div>)}
      </div>)
    })}
    {lists.length===0&&<div style={{background:CARD,borderRadius:14,border:"0.5px solid "+BORDER,padding:24,textAlign:"center",color:T3,fontSize:12}}>Inga listor {"\u00e4"}n. Skapa en!</div>}
  </div>)
}

// ----- Settings Tab -----
function SettingsTab({householdId,userId,householdName}){
  const[inviteCode,setInviteCode]=useState(null);const[creating,setCreating]=useState(false);const[members,setMembers]=useState([]);const[copied,setCopied]=useState(false)
  useEffect(()=>{if(!householdId)return;supabase.from("household_members").select("user_id,role,joined_at").eq("household_id",householdId).then(({data})=>{if(data)setMembers(data)})},[householdId])
  async function createInvite(){setCreating(true);const code=genCode();const{error}=await supabase.from("invites").insert({household_id:householdId,code,created_by:userId});if(!error)setInviteCode(code);setCreating(false)}
  function copyCode(){if(!inviteCode)return;navigator.clipboard.writeText(inviteCode).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})}
  return(<div style={{height:"100%",overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>
    <div style={{background:CARD,borderRadius:14,border:"0.5px solid "+BORDER,padding:16}}><div style={{fontSize:13,fontWeight:600,color:T1,marginBottom:12}}>Hush{"\u00e5"}ll: {householdName}</div><div style={{fontSize:11,fontWeight:600,color:T3,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Medlemmar</div>{members.map((m,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<members.length-1?"0.5px solid "+BORDER:"none"}}><div style={{width:28,height:28,borderRadius:"50%",background:ACCENT_SOFT,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:ACCENT,fontWeight:600}}>{m.user_id===userId?"Du":String(i+1)}</div><div style={{flex:1}}><div style={{fontSize:12,color:T1}}>{m.user_id===userId?"Du":"Medlem "+(i+1)}</div><div style={{fontSize:10,color:T3}}>{m.role}</div></div></div>))}</div>
    <div style={{background:CARD,borderRadius:14,border:"0.5px solid "+BORDER,padding:16}}><div style={{fontSize:11,fontWeight:600,color:T3,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Bjud in</div>{!inviteCode?(<button onClick={createInvite} disabled={creating} style={{width:"100%",background:ACCENT,color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:14,fontWeight:600,cursor:creating?"not-allowed":"pointer",opacity:creating?0.6:1}}>{creating?"Skapar kod...":"Skapa inbjudningskod"}</button>):(<div style={{textAlign:"center"}}><div style={{fontSize:10,color:T3,marginBottom:8}}>Dela denna kod med din familjemedlem</div><div onClick={copyCode} style={{fontFamily:"monospace",fontSize:32,fontWeight:700,letterSpacing:"0.15em",color:ACCENT,cursor:"pointer",padding:"12px",background:ACCENT_SOFT,borderRadius:12,marginBottom:8}}>{inviteCode}</div><div style={{fontSize:10,color:copied?GREEN:T3}}>{copied?"Kopierad!":"Tryck f\u00f6r att kopiera \u00b7 Giltig i 7 dagar"}</div><button onClick={()=>setInviteCode(null)} style={{marginTop:12,background:"none",border:"1px solid "+BORDER,borderRadius:10,padding:"8px 16px",fontSize:12,color:T2,cursor:"pointer"}}>Skapa ny kod</button></div>)}</div>
  </div>)
}

const TABS=[{key:"hem",label:"Hem",icon:"\ud83c\udfe0"},{key:"kalender",label:"Kalender",icon:"\ud83d\udcc5"},{key:"listor",label:"Listor",icon:"\u2611\ufe0f"},{key:"mat",label:"Mat",icon:"\ud83c\udf7d\ufe0f"},{key:"mer",label:"Mer",icon:"\u2699\ufe0f"}]

export default function SmartHub({session,household}){
  const userId=session?.user?.id,householdId=household?.id
  const[tab,setTab]=useState("hem");const[bg,setBg]=useState(BACKGROUNDS[0]);const[layoutId,setLayoutId]=useState("big-two-small");const[assignments,setAssign]=useState({A:"kalender",B:"todo",C:"events"});const[editOpen,setEditOpen]=useState(false);const[eventModalOpen,setEventModalOpen]=useState(false);const[listModalOpen,setListModalOpen]=useState(false)
  const[lists,setLists]=useState([]);const[todos,setTodos]=useState([]);const[calEvents,setCalEvents]=useState([]);const[meals,setMeals]=useState([]);const[weather,setWeather]=useState(null);const[loaded,setLoaded]=useState({todos:false,events:false,meals:false,layout:false,lists:false})

  // Weather
  useEffect(()=>{async function f(){try{const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude="+WEATHER_LAT+"&longitude="+WEATHER_LON+"&current=temperature_2m,weathercode,windspeed_10m&daily=weathercode,temperature_2m_max&timezone=Europe/Stockholm&forecast_days=4");if(!r.ok)return;const json=await r.json();const p=parseWeather(json);if(p)setWeather(p)}catch(e){console.error("[weather]",e)}};f();const t=setInterval(f,30*60*1000);return()=>clearInterval(t)},[])

  // Layout
  useEffect(()=>{if(!userId)return;let c=false;async function f(){const{data}=await supabase.from("layouts").select("layout_id,assignments,bg_id").eq("user_id",userId).maybeSingle();if(c)return;if(data){if(data.layout_id)setLayoutId(data.layout_id);if(data.assignments)setAssign(data.assignments);if(data.bg_id){const found=BACKGROUNDS.find(b=>b.id===data.bg_id);if(found)setBg(found)}};setLoaded(s=>({...s,layout:true}))};f();return()=>{c=true}},[userId])

  // Lists
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const{data,error}=await supabase.from("lists").select("*").eq("household_id",householdId).order("created_at",{ascending:true});if(c)return;if(error)console.error("[lists]",error);else setLists(data||[]);setLoaded(s=>({...s,lists:true}))};f();const ch=supabase.channel("lists:"+householdId).on("postgres_changes",{event:"*",schema:"public",table:"lists",filter:"household_id=eq."+householdId},p=>{setLists(prev=>{if(p.eventType==="INSERT")return prev.some(l=>l.id===p.new.id)?prev:[...prev,p.new];if(p.eventType==="UPDATE")return prev.map(l=>l.id===p.new.id?p.new:l);if(p.eventType==="DELETE")return prev.filter(l=>l.id!==p.old.id);return prev})}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId])

  // Todos
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const{data,error}=await supabase.from("todos").select("*").eq("household_id",householdId).order("created_at",{ascending:true});if(c)return;if(error)console.error("[todos]",error);else setTodos(data||[]);setLoaded(s=>({...s,todos:true}))};f();const ch=supabase.channel("todos:"+householdId).on("postgres_changes",{event:"*",schema:"public",table:"todos",filter:"household_id=eq."+householdId},p=>{setTodos(prev=>{if(p.eventType==="INSERT")return prev.some(t=>t.id===p.new.id)?prev:[...prev,p.new];if(p.eventType==="UPDATE")return prev.map(t=>t.id===p.new.id?p.new:t);if(p.eventType==="DELETE")return prev.filter(t=>t.id!==p.old.id);return prev})}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId])

  // Events
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const now=new Date();const from=new Date(now.getFullYear(),now.getMonth()-6,1).toISOString();const to=new Date(now.getFullYear(),now.getMonth()+12,0).toISOString();const{data,error}=await supabase.from("calendar_events").select("*").eq("household_id",householdId).gte("start_time",from).lte("start_time",to).order("start_time",{ascending:true});if(c)return;if(error)console.error("[events]",error);else setCalEvents(data||[]);setLoaded(s=>({...s,events:true}))};f();const ch=supabase.channel("events:"+householdId).on("postgres_changes",{event:"*",schema:"public",table:"calendar_events",filter:"household_id=eq."+householdId},p=>{setCalEvents(prev=>{if(p.eventType==="INSERT")return prev.some(e=>e.id===p.new.id)?prev:[...prev,p.new];if(p.eventType==="UPDATE")return prev.map(e=>e.id===p.new.id?p.new:e);if(p.eventType==="DELETE")return prev.filter(e=>e.id!==p.old.id);return prev})}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId])

  // Meals
  const currentWeekStart=useMemo(()=>{const now=new Date();const day=now.getDay();const diff=day===0?6:day-1;const mon=new Date(now.getFullYear(),now.getMonth(),now.getDate()-diff);return mon.getFullYear()+"-"+String(mon.getMonth()+1).padStart(2,"0")+"-"+String(mon.getDate()).padStart(2,"0")},[])
  useEffect(()=>{if(!householdId)return;let c=false;async function f(){const{data,error}=await supabase.from("meals").select("*").eq("household_id",householdId).eq("week_start_date",currentWeekStart);if(c)return;if(error)console.error("[meals]",error);else setMeals(data||[]);setLoaded(s=>({...s,meals:true}))};f();const ch=supabase.channel("meals:"+householdId+":"+currentWeekStart).on("postgres_changes",{event:"*",schema:"public",table:"meals",filter:"household_id=eq."+householdId},p=>{const row=p.new||p.old;if(!row||row.week_start_date!==currentWeekStart)return;setMeals(prev=>{if(p.eventType==="INSERT")return prev.some(m=>m.id===p.new.id)?prev:[...prev,p.new];if(p.eventType==="UPDATE")return prev.map(m=>m.id===p.new.id?p.new:m);if(p.eventType==="DELETE")return prev.filter(m=>m.id!==p.old.id);return prev})}).subscribe();return()=>{c=true;supabase.removeChannel(ch)}},[householdId,currentWeekStart])

  // CRUD
  async function handleToggleTodo(item){const nd=!item.done;setTodos(p=>p.map(t=>t.id===item.id?{...t,done:nd,completed_at:nd?new Date().toISOString():null}:t));const{error}=await supabase.from("todos").update({done:nd,completed_at:nd?new Date().toISOString():null}).eq("id",item.id);if(error){console.error("[todos]",error);setTodos(p=>p.map(t=>t.id===item.id?item:t))}}
  async function handleAddTodo(text,listId){const tmp={id:"tmp-"+Date.now(),household_id:householdId,text,done:false,list_id:listId,shared:true,created_by:userId,created_at:new Date().toISOString()};setTodos(p=>[...p,tmp]);const{data,error}=await supabase.from("todos").insert({household_id:householdId,text,done:false,list_id:listId,created_by:userId}).select().single();if(error){console.error("[todos]",error);setTodos(p=>p.filter(t=>t.id!==tmp.id))}else setTodos(p=>p.map(t=>t.id===tmp.id?data:t))}
  async function handleDeleteTodo(item){setTodos(p=>p.filter(t=>t.id!==item.id));const{error}=await supabase.from("todos").delete().eq("id",item.id);if(error){console.error("[todos]",error);setTodos(p=>[...p,item])}}

  async function handleAddList(list){const{error}=await supabase.from("lists").insert({household_id:householdId,name:list.name,shared:list.shared,color:list.color,expires_at:list.expires_at,created_by:userId});if(error)console.error("[lists]",error);setListModalOpen(false)}
  async function handleDeleteList(id){setLists(p=>p.filter(l=>l.id!==id));const{error}=await supabase.from("lists").delete().eq("id",id);if(error)console.error("[lists]",error)}

  async function handleAddEvent(ev){const{error}=await supabase.from("calendar_events").insert({household_id:householdId,title:ev.title,start_time:ev.start_time,end_time:ev.end_time,location:ev.location,color:ev.color,shared:ev.shared,created_by:userId});if(error)console.error("[events]",error);setEventModalOpen(false)}
  async function handleDeleteEvent(id){setCalEvents(p=>p.filter(e=>e.id!==id));const{error}=await supabase.from("calendar_events").delete().eq("id",id);if(error)console.error("[events]",error)}

  async function handleUpsertMeal(weekday,text){if(!text){const ex=meals.find(m=>m.weekday===weekday);if(ex){setMeals(p=>p.filter(m=>m.id!==ex.id));await supabase.from("meals").delete().eq("id",ex.id)};return};const ex=meals.find(m=>m.weekday===weekday);if(ex){setMeals(p=>p.map(m=>m.id===ex.id?{...m,meal_text:text}:m));await supabase.from("meals").update({meal_text:text}).eq("id",ex.id)}else{const tmp={id:"tmp-"+Date.now(),household_id:householdId,week_start_date:currentWeekStart,weekday,meal_text:text};setMeals(p=>[...p,tmp]);const{data,error}=await supabase.from("meals").insert({household_id:householdId,week_start_date:currentWeekStart,weekday,meal_text:text}).select().single();if(error)setMeals(p=>p.filter(m=>m.id!==tmp.id));else setMeals(p=>p.map(m=>m.id===tmp.id?data:m))}}

  // Persist layout
  useEffect(()=>{if(!userId||!loaded.layout)return;const t=setTimeout(async()=>{await supabase.from("layouts").upsert({user_id:userId,layout_id:layoutId,assignments,bg_id:bg.id,updated_at:new Date().toISOString()},{onConflict:"user_id"})},400);return()=>clearTimeout(t)},[userId,layoutId,assignments,bg,loaded.layout])

  const handleSave=(lid,assign)=>{setLayoutId(lid);setAssign(assign);setEditOpen(false)}
  const now=new Date()
  const sharedEvents=calEvents.filter(e=>e.shared!==false)
  const calEventsByDay=useMemo(()=>groupEventsByDay(sharedEvents,now.getFullYear(),now.getMonth()),[sharedEvents])
  const eventsToday=useMemo(()=>getEventsToday(sharedEvents),[sharedEvents])
  const sharedLists=lists.filter(l=>l.shared!==false)
  const sharedTodos=todos.filter(t=>{const list=lists.find(l=>l.id===t.list_id);return!list||list.shared!==false})
  const widgetCtx={sharedTodos,onToggleTodo:handleToggleTodo,calEventsByDay,eventsToday,onDeleteEvent:handleDeleteEvent,meals,onUpsertMeal:handleUpsertMeal,weather}

  return(<div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:BG,display:"flex",flexDirection:"column",height:"100dvh",position:"relative",overflow:"hidden"}}>
    <ClockHero bg={bg} onChangeBg={setBg} weather={weather}/>
    <div style={{display:"flex",borderBottom:"0.5px solid "+BORDER,background:CARD,flexShrink:0}}>{TABS.map(t=>(<button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"7px 0 9px",borderBottom:tab===t.key?"2px solid "+ACCENT:"2px solid transparent"}}><span style={{fontSize:17}}>{t.icon}</span><span style={{fontSize:10,fontWeight:500,color:tab===t.key?ACCENT:T3}}>{t.label}</span></button>))}</div>
    <div style={{flex:1,padding:10,minHeight:0,overflow:"hidden"}}>
      {tab==="hem"&&<GridDash layoutId={layoutId} assignments={assignments} onEdit={()=>setEditOpen(true)} widgetCtx={widgetCtx}/>}
      {tab==="kalender"&&<div style={{height:"100%",overflowY:"auto"}}><FullKal events={calEvents} onAddEvent={()=>setEventModalOpen(true)} onDeleteEvent={handleDeleteEvent}/></div>}
      {tab==="listor"&&<ListsTab lists={lists} todos={todos} onAddList={()=>setListModalOpen(true)} onDeleteList={handleDeleteList} onAddTodo={handleAddTodo} onToggleTodo={handleToggleTodo} onDeleteTodo={handleDeleteTodo} userId={userId}/>}
      {tab==="mat"&&<div style={{height:"100%",overflowY:"auto"}}><div style={{background:CARD,borderRadius:14,border:"0.5px solid "+BORDER,padding:16}}><WidgetMat meals={meals} onEdit={handleUpsertMeal}/></div></div>}
      {tab==="mer"&&<SettingsTab householdId={householdId} userId={userId} householdName={household?.name}/>}
    </div>
    {editOpen&&<EditPanel layout={layoutId} assignments={assignments} onSave={handleSave} onClose={()=>setEditOpen(false)}/>}
    {eventModalOpen&&<AddEventModal onSave={handleAddEvent} onClose={()=>setEventModalOpen(false)}/>}
    {listModalOpen&&<AddListModal onSave={handleAddList} onClose={()=>setListModalOpen(false)}/>}
  </div>)
}
