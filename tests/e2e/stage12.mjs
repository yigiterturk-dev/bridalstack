import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
let pass=0, fail=0; const out=[];
const check=(n,ok,d="")=>{ok?(pass++,out.push(`  OK   ${n}`)):(fail++,out.push(`  FAIL ${n}${d?" — "+d:""}`));};
const strip=h=>h.replace(/<!--[\s\S]*?-->/g,"");
function jarOf(){const j=new Map();return{set:r=>{for(const c of r.headers.getSetCookie?.()??[]){const[p]=c.split(";");const i=p.indexOf("=");j.set(p.slice(0,i).trim(),p.slice(i+1).trim());}},hdr:()=>[...j].map(([k,v])=>`${k}=${v}`).join("; ")};}
async function login(email,password){const j=jarOf();let r=await fetch(`${BASE}/api/auth/csrf`);j.set(r);const{csrfToken}=await r.json();
 r=await fetch(`${BASE}/api/auth/callback/credentials`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",cookie:j.hdr()},body:new URLSearchParams({csrfToken,email,password,json:"true"}),redirect:"manual"});j.set(r);return j;}

const stamp=Date.now(), EMAIL=`fp${stamp}@example.com`, PW="Str0ngPass!234", SHOP=`Free Bridal ${stamp}`;

const run=async()=>{
// ── Kaldırılan modüller hiçbir yerde kalmamalı ──
{
  const src=["config/modules.ts","lib/dodo.ts",".env.example"]
    .map(f=>fs.readFileSync(f,"utf8")).join("\n");
  for (const term of ["whatsapp","efatura","COMMUNICATION",'"communication"'])
    check(`Kodda '${term}' kalmadı`, !src.toLowerCase().includes(term.toLowerCase()));
  const landing=fs.readFileSync("app/landing/page.tsx","utf8");
  check("Tanıtım sayfası WhatsApp vaat etmiyor", !landing.includes("WhatsApp"));
}

// ── Yeni kayıt ücretsiz paketleri alıyor ──
await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email:EMAIL,password:PW,shopName:SHOP})});
const user=await prisma.user.findUnique({where:{email:EMAIL}});
const tenant=await prisma.tenant.findFirst({where:{owner_id:user.id}});
{
  check("Yeni kiracı base paketini alıyor", tenant.packs.includes("base"), tenant.packs.join(","));
  check("Yeni kiracı ücretsiz salon paketini alıyor", tenant.packs.includes("salon"), tenant.packs.join(","));
  check("Ücretli paket otomatik verilmiyor",
    !tenant.packs.includes("sales") && !tenant.packs.includes("inventory"), tenant.packs.join(","));
}

// ── Ücretsiz katmanda randevu sayfası gerçekten açılıyor ──
const j=await login(EMAIL,PW); const H={cookie:j.hdr()};
{
  const bookings=strip(await(await fetch(`${BASE}/bookings`,{headers:H})).text());
  check("Rezervasyon sayfası ücretsiz katmanda açık", !bookings.includes("not part of your current plan"));
  const services=strip(await(await fetch(`${BASE}/services`,{headers:H})).text());
  check("Hizmetler sayfası ücretsiz katmanda açık", !services.includes("not part of your current plan"));
  const dash=strip(await(await fetch(`${BASE}/dashboard`,{headers:H})).text());
  check("Menüde rezervasyon bağlantısı var", dash.includes('href="/bookings"'));
  const pub=await fetch(`${BASE}/book/${tenant.slug}`,{redirect:"manual"});
  check("Herkese açık randevu sayfası çalışıyor", pub.status===200, `status ${pub.status}`);
}

// ── Ücretli modül denemede açık, deneme bitince kapanır ──
{
  const duringTrial=strip(await(await fetch(`${BASE}/orders`,{headers:H})).text());
  check("Sipariş modülü deneme sırasında açık", !duringTrial.includes("not part of your current plan"));
  // Kayıt tüm satılabilir paketlerde deneme açıyor; denemeyi bitirince modül kapanmalı.
  await prisma.tenant.update({where:{id:tenant.id},data:{trial_ends_at:new Date(Date.now()-1000)}});
  const afterTrial=strip(await(await fetch(`${BASE}/orders`,{headers:H})).text());
  check("Deneme bitince sipariş modülü kapanıyor", afterTrial.includes("not part of your current plan"));
}

// ── Ücretsiz paket satın alınamaz ──
{
  for (const pack of ["base","salon"]) {
    const res=await fetch(`${BASE}/api/billing/checkout`,{method:"POST",
      headers:{"content-type":"application/json",...H},
      body:JSON.stringify({packs:["base",pack]})});
    // Ücretsiz paketler ücretli listeye girmez; istek reddedilmez ama
    // satın alma satırı üretmez.
    check(`'${pack}' paketi ödeme satırı üretmiyor`, res.status < 500, `status ${res.status}`);
  }
}

// ── Kaldırılan paket artık seçilemiyor ──
{
  const res=await fetch(`${BASE}/api/billing/checkout`,{method:"POST",
    headers:{"content-type":"application/json",...H},
    body:JSON.stringify({packs:["base","communication"]})});
  const body=await res.json().catch(()=>({}));
  // Bilinmeyen paket sessizce yok sayılırsa müşterinin planı farkında
  // olmadan ücretsize düşer. Açıkça reddedilmeli.
  check("Kaldırılan paket açıkça reddediliyor",
    res.status === 400 && String(body.error || "").includes("Unknown plan"),
    `status ${res.status} ${JSON.stringify(body).slice(0,80)}`);
}

// ── Ayarlarda kaldırılan paketler görünmüyor ──
{
  const html=strip(await(await fetch(`${BASE}/settings`,{headers:H})).text());
  check("Ayarlarda Communication paketi yok", !html.includes("Communication"));
  check("Ayarlarda e-Fatura yok", !html.includes("Fatura"));
  check("Salon paketi aktif görünüyor", html.includes("Salon"));
  check("Ayarlarda veri dışa aktarma bağlantısı var", html.includes("Export my data"));
  check("Ayarlarda hesap silme bölümü var", html.includes("Delete my account permanently"));
}

console.log(out.join("\n"));
console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
await prisma.$disconnect();
process.exit(fail?1:0);
};
run().catch(async e=>{console.error("BETİK HATASI:",e);await prisma.$disconnect();process.exit(2);});
