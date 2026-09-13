// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Stage 21 — AI Stylist paket kapısı.                                      ║
// ║  Ücretsiz kiracı /api/ai'ye giremez (403); Pro kiracı girer (200,         ║
// ║  AI anahtarı yoksa fallback istatistik yanıtı).                           ║
// ║  Çalıştırma: PORT=3100 npm run dev && node tests/e2e/stage21-ai-gate.mjs  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
let pass=0, fail=0; const out=[];
const check=(n,ok,d="")=>{ok?(pass++,out.push(`  OK   ${n}`)):(fail++,out.push(`  FAIL ${n}${d?" — "+d:""}`));};
function jarOf(){const j=new Map();return{set:r=>{for(const c of r.headers.getSetCookie?.()??[]){const[p]=c.split(";");const i=p.indexOf("=");j.set(p.slice(0,i).trim(),p.slice(i+1).trim());}},hdr:()=>[...j].map(([k,v])=>`${k}=${v}`).join("; ")};}
async function login(email,password){const j=jarOf();let r=await fetch(`${BASE}/api/auth/csrf`);j.set(r);const{csrfToken}=await r.json();
 r=await fetch(`${BASE}/api/auth/callback/credentials`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",cookie:j.hdr()},body:new URLSearchParams({csrfToken,email,password,json:"true"}),redirect:"manual"});j.set(r);return j;}

const stamp=Date.now(), EMAIL=`ai${stamp}@example.com`, PW="Str0ngPass!234", SHOP=`AI Gate Bridal ${stamp}`;

const run=async()=>{
await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email:EMAIL,password:PW,shopName:SHOP})});
const user=await prisma.user.findUnique({where:{email:EMAIL}});
const tenant=await prisma.tenant.findFirst({where:{owner_id:user.id}});
check("ücretsiz kiracı oluştu (Pro yok)", !!tenant && !(tenant.packs??[]).includes("pro"));

const j=await login(EMAIL,PW); const H={cookie:j.hdr(),"content-type":"application/json"};
check("giriş yapıldı", j.hdr().includes("authjs.session-token") || j.hdr().includes("next-auth.session-token"));

let r=await fetch(`${BASE}/api/ai`,{method:"POST",headers:H,body:JSON.stringify({query:"best sellers"})});
check("ücretsiz kiracı AI'ya giremez (403)", r.status===403, `status ${r.status}`);
const err=await r.json().catch(()=>({}));
check("hata Pro paketini işaret eder", (err.error||"").includes("Pro pack"), JSON.stringify(err).slice(0,120));

await prisma.tenant.update({where:{id:tenant.id},data:{packs:["base","salon","pro"]}});
r=await fetch(`${BASE}/api/ai`,{method:"POST",headers:H,body:JSON.stringify({query:"best sellers"})});
check("Pro kiracı AI'ya erişir (200)", r.status===200, `status ${r.status}`);
const okBody=await r.json().catch(()=>null);
check("yanıt metinsel", !!okBody && typeof okBody.answer==="string");

console.log(`\n  ${pass} geçti, ${fail} kaldı`);
await prisma.$disconnect();
process.exit(fail>0?1:0);
};

run().catch(e=>{console.error(e);process.exit(1);});
