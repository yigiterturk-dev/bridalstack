import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
const CRON = fs.readFileSync(".env.local","utf8").split("\n").find(l=>l.startsWith("CRON_SECRET=")).split("=")[1].trim();
let pass=0, fail=0; const out=[];
const check=(n,ok,d="")=>{ok?(pass++,out.push(`  OK   ${n}`)):(fail++,out.push(`  FAIL ${n}${d?" — "+d:""}`));};
const strip=h=>h.replace(/<!--[\s\S]*?-->/g,"");
function jarOf(){const j=new Map();return{set:r=>{for(const c of r.headers.getSetCookie?.()??[]){const[p]=c.split(";");const i=p.indexOf("=");j.set(p.slice(0,i).trim(),p.slice(i+1).trim());}},hdr:()=>[...j].map(([k,v])=>`${k}=${v}`).join("; ")};}
async function login(email,password){const j=jarOf();let r=await fetch(`${BASE}/api/auth/csrf`);j.set(r);const{csrfToken}=await r.json();
 r=await fetch(`${BASE}/api/auth/callback/credentials`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",cookie:j.hdr()},body:new URLSearchParams({csrfToken,email,password,json:"true"}),redirect:"manual"});j.set(r);return j;}
const cron=(path)=>fetch(`${BASE}${path}`,{headers:{authorization:`Bearer ${CRON}`}});

const stamp=Date.now(), EMAIL=`bf${stamp}@example.com`, PW="Str0ngPass!234", SHOP=`Briefing Mail ${stamp}`;
const today=new Date().toISOString().split("T")[0];

const run=async()=>{
// Diğer kiracıların bugünkü gönderimi bu testi kirletmesin.
await prisma.tenant.updateMany({data:{briefing_sent_on:today}});

await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email:EMAIL,password:PW,shopName:SHOP})});
const user=await prisma.user.findUnique({where:{email:EMAIL}});
const tenant=await prisma.tenant.findFirst({where:{owner_id:user.id}});
await prisma.tenant.update({where:{id:tenant.id},
  data:{packs:["base","sales","inventory"],briefing_sent_on:null}});

// ── Yetki ──
{
  const anon=await fetch(`${BASE}/api/cron/briefing`);
  check("Brifing cron'u yetkisiz isteği reddediyor", anon.status===401, `status ${anon.status}`);
  const wrong=await fetch(`${BASE}/api/cron/briefing`,{headers:{authorization:"Bearer yanlis"}});
  check("Yanlış anahtar reddediliyor", wrong.status===401, `status ${wrong.status}`);
}

// ── Sinyal yokken e-posta gönderilmiyor ──
{
  const res=await cron("/api/cron/briefing");
  const body=await res.json();
  check("Brifing cron'u çalışıyor", res.status===200, `status ${res.status}`);
  check("Sessiz günde e-posta gönderilmiyor", body.sent===0 && body.skippedEmpty>=1,
    JSON.stringify(body));
  const t=await prisma.tenant.findUnique({where:{id:tenant.id},select:{briefing_sent_on:true}});
  check("Gönderilmeyince damga atılmıyor (yarın tekrar denenir)", t.briefing_sent_on===null,
    String(t.briefing_sent_on));
}

// ── Sinyal varken gönderiliyor ──
await prisma.booking.create({data:{tenant_id:tenant.id,customer_name:"Web Bride",
  booking_date:today,start_time:"10:00",end_time:"11:00",status:"pending"}});
{
  const body=await (await cron("/api/cron/briefing")).json();
  check("Sinyal varken e-posta gönderiliyor", body.sent===1, JSON.stringify(body));
  const t=await prisma.tenant.findUnique({where:{id:tenant.id},select:{briefing_sent_on:true}});
  check("Gönderim sonrası bugünün damgası atılıyor", t.briefing_sent_on===today, String(t.briefing_sent_on));
}

// ── Aynı gün ikinci kez gönderilmiyor ──
{
  const body=await (await cron("/api/cron/briefing")).json();
  check("Aynı gün ikinci gönderim yapılmıyor", body.sent===0 && body.considered===0,
    JSON.stringify(body));
}

// ── Kapatınca hiç gönderilmiyor ──
{
  await prisma.tenant.update({where:{id:tenant.id},
    data:{briefing_sent_on:null,briefing_emails:false}});
  const body=await (await cron("/api/cron/briefing")).json();
  check("Kapatan kiracıya gönderilmiyor", body.considered===0, JSON.stringify(body));
}

// ── Ayarlarda düğme görünüyor ──
{
  await prisma.tenant.update({where:{id:tenant.id},data:{briefing_emails:true}});
  const j=await login(EMAIL,PW);
  const html=strip(await(await fetch(`${BASE}/settings`,{headers:{cookie:j.hdr()}})).text());
  check("Ayarlarda brifing anahtarı var", html.includes("Daily briefing email"));
  check("Anahtar açıklaması var", html.includes("Nothing is sent on a quiet day"));
  check("Anahtar varsayılan olarak açık", html.includes('name="briefing_emails"') && html.includes("checked"));
}

// ── Cron zamanlaması tanımlı ──
{
  const cfg=fs.readFileSync("vercel.json","utf8");
  for (const p of ["/api/cron/briefing","/api/cron/reminders","/api/cron/installments"])
    check(`${p} zamanlanmış`, cfg.includes(p));
}

console.log(out.join("\n"));
console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
await prisma.$disconnect();
process.exit(fail?1:0);
};
run().catch(async e=>{console.error("BETİK HATASI:",e);await prisma.$disconnect();process.exit(2);});
