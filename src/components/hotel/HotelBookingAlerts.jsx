import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bell,Volume2,VolumeX,X} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {supabase} from '../../lib/supabase';
import './HotelBookingAlerts.css';
let tone;
function audio(){if(!tone)tone=new Audio('/sounds/waki-reserva.wav');tone.currentTime=0;return tone}
const readSeen=hotel=>{try{return localStorage.getItem('waki-notice-seen-'+hotel)||''}catch{return ''}};
export default function HotelBookingAlerts({hotelId}){
 const [rows,setRows]=useState([]),[open,setOpen]=useState(false),[enabled,setEnabled]=useState(false),[toast,setToast]=useState(null),[error,setError]=useState(''),[seen,setSeen]=useState(()=>readSeen(hotelId));
 const armed=useRef(false);const navigate=useNavigate();
 useEffect(()=>{
  let alive=true;const map=new Map();
  async function announce(row){
   if(new Date(row.created_at).getTime()<Date.now()-120000)return;
   if(alive)setToast(row);
   if(!armed.current)return;
   const play=async()=>{try{const key='waki-notice-sounded-'+hotelId;if(localStorage.getItem(key)===row.id)return;localStorage.setItem(key,row.id)}catch{}
    audio().play().catch(()=>{if(alive){setEnabled(false);armed.current=false;setError('Activa nuevamente el sonido en este navegador.')}});
    if(alive)setToast(row);
    if(document.hidden&&'Notification' in window&&Notification.permission==='granted'){
     const notice=new Notification('Nueva reserva WAKI',{body:'Tienes una reserva confirmada. Toca para revisarla.',icon:'/waki_fav.png',tag:'waki-'+row.id});notice.onclick=()=>{window.focus();navigate('/reservas/'+row.reservation_id);notice.close()};
    }
   };
   if(navigator.locks)await navigator.locks.request('waki-reservation-tone',{ifAvailable:true},async lock=>{if(lock)await play()});else await play();
  }
  function add(row,notify){if(!row?.id||map.has(row.id))return;map.set(row.id,row);if(alive)setRows([...map.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,20));if(notify)announce(row)}
  const channel=supabase.channel('hotel-booking-notices-'+hotelId).on('postgres_changes',{event:'INSERT',schema:'public',table:'hotel_booking_notices',filter:'hotel_id=eq.'+hotelId},event=>add(event.new,true)).subscribe(status=>{if(status==='CHANNEL_ERROR'&&alive)setError('Avisos sin conexión. Revisa Reservas y actualiza la página.');if(status==='SUBSCRIBED')load()});
  async function load(){const {data,error:e}=await supabase.from('hotel_booking_notices').select('id,reservation_id,created_at').eq('hotel_id',hotelId).gte('created_at',new Date(Date.now()-7*86400000).toISOString()).order('created_at',{ascending:false}).limit(20);if(alive){if(e)setError('No pudimos consultar los avisos. Revisa la sección Reservas.');else (data||[]).forEach(row=>add(row,false))}}
  return()=>{alive=false;supabase.removeChannel(channel)};
 },[hotelId,navigate]);
 async function toggle(){if(armed.current){armed.current=false;setEnabled(false);return}try{await audio().play();armed.current=true;setEnabled(true);setError('');if('Notification' in window&&Notification.permission==='default')Promise.resolve(Notification.requestPermission()).catch(()=>{})}catch{setError('El navegador no pudo reproducir el sonido. Revisa sus permisos.')}}
 function show(){setOpen(!open);if(!open){const now=new Date().toISOString();setSeen(now);try{localStorage.setItem('waki-notice-seen-'+hotelId,now)}catch{}}}
 const unread=rows.filter(r=>r.created_at>seen).length;
 return <><div className="hotel-booking-alerts"><button type="button" onClick={show} aria-expanded={open} aria-label={`Avisos de reservas, ${unread} nuevos`}><Bell size={16}/><span>Reservas</span>{unread>0&&<b>{unread}</b>}</button><button type="button" onClick={toggle} aria-pressed={enabled} title={enabled?'Silenciar avisos':'Activar sonido WAKI'}>{enabled?<Volume2 size={16}/>:<VolumeX size={16}/>}<span>{enabled?'Sonido activo':'Activar sonido'}</span></button></div>{error&&<p className="hotel-alert-warning" role="status">{error}</p>}
 {createPortal(<>{toast&&<div className="hotel-reservation-toast" role="status"><Bell size={23}/><div><strong>Nueva reserva WAKI</strong><button type="button" onClick={()=>{navigate('/reservas/'+toast.reservation_id);setToast(null)}}>Ver reserva</button></div><button type="button" aria-label="Cerrar aviso" onClick={()=>setToast(null)}><X size={18}/></button></div>}{open&&<section className="hotel-reservation-panel" aria-label="Avisos de reservas"><header><h2>Tus reservas WAKI</h2><button type="button" aria-label="Cerrar avisos" onClick={()=>setOpen(false)}><X size={20}/></button></header><p>Activa el sonido al comenzar tu turno. Mantén el portal abierto para recibirlo; el navegador puede limitar los avisos en segundo plano.</p><div>{rows.map(r=><button key={r.id} type="button" onClick={()=>{setOpen(false);navigate('/reservas/'+r.reservation_id)}}><Bell size={18}/><span><strong>Reserva confirmada</strong><small>{new Date(r.created_at).toLocaleString('es-PE',{timeZone:'America/Lima'})}</small></span><span>Ver</span></button>)}{!rows.length&&<p>No hay nuevas reservas en los últimos 7 días.</p>}</div></section>}</>,document.body)}</>;
}
