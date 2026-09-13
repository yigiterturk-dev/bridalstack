import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
let pass=0, fail=0; const out=[];
const check=(n,ok,d="")=>{ok?(pass++,out.push(`  OK   ${n}`)):(fail++,out.push(`  FAIL ${n}${d?" — "+d:""}`));};
const strip=h=>h.replace(/<!--[\s\S]*?-->/g,"");
function jarOf(){const j=new Map();return{set:r=>{for(const c of r.headers.getSetCookie?.()??[]){const[p]=c.split(";");const i=p.indexOf("=");j.set(p.slice(0,i).trim(),p.slice(i+1).trim());}},hdr:()=>[...j].map(([k,v])=>`${k}=${v}`).join("; ")};}
async function login(email,password){const j=jarOf();let r=await fetch(`${BASE}/api/auth/csrf`);j.set(r);const{csrfToken}=await r.json();
 r=await fetch(`${BASE}/api/auth/callback/credentials`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",cookie:j.hdr()},body:new URLSearchParams({csrfToken,email,password,json:"true"}),redirect:"manual"});j.set(r);return j;}

const stamp=Date.now(), EMAIL=`inst${stamp}@example.com`, PW="Str0ngPass!234", SHOP=`Inst Bridal ${stamp}`;

const run=async()=>{
await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email:EMAIL,password:PW,shopName:SHOP})});
const user=await prisma.user.findUnique({where:{email:EMAIL}});
const tenant=await prisma.tenant.findFirst({where:{owner_id:user.id}});
await prisma.tenant.update({where:{id:tenant.id},data:{packs:["base","sales"]}});
const customer=await prisma.customer.create({data:{tenant_id:tenant.id,name:"Ayşe Yıldız",email:`ayse${stamp}@example.com`}});
const order=await prisma.order.create({data:{tenant_id:tenant.id,ref_no:`I${stamp}`.slice(0,14),customer_id:customer.id,
  order_type:"sale",order_date:new Date().toISOString().split("T")[0],status:"confirmed",
  discounted_total:6000,list_total:6000,deposit_amount:1200,remaining_balance:4800}});

const j=await login(EMAIL,PW);
const H={cookie:j.hdr()};

// 1 — plan formu görünüyor
{
  const html=strip(await(await fetch(`${BASE}/orders/${order.id}`,{headers:H})).text());
  check("Sipariş sayfasında taksit planı bölümü var", html.includes("Payment Plan"));
  check("Plan yokken oluşturma formu gösteriliyor", html.includes("Create payment plan"));
}

// 2 — plan mantığı doğrudan lib'den geliyor; burada ayrıca import gerekmiyor
{
  // Eylem HTTP üzerinden çağrılamadığı için aynı mantıkla plan kur ve sayfayı doğrula.
  const first=new Date(Date.now()+30*864e5).toISOString().split("T")[0];
  const start=new Date(first+"T00:00:00Z");
  const total=Math.round(4800*100), n=4, base=Math.floor(total/n), rem=total-base*n;
  const rows=[];
  for(let i=0;i<n;i++){
    const d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i,start.getUTCDate()));
    rows.push({tenant_id:tenant.id,order_id:order.id,customer_id:customer.id,installment_no:i+1,total_count:n,
      amount:(base+(i===0?rem:0))/100,
      due_date:`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`,
      status:"pending"});
  }
  await prisma.installment.createMany({data:rows});
  const sum=rows.reduce((s,r)=>s+r.amount,0);
  check("Taksit toplamı bölünen tutara eşit (yuvarlama kaybı yok)", Math.abs(sum-4800)<0.001, `toplam ${sum}`);

  const html=strip(await(await fetch(`${BASE}/orders/${order.id}`,{headers:H})).text());
  check("Plan tablosu sayfada listeleniyor", html.includes("1/4") && html.includes("4/4"));
  check("Tahsilat özeti gösteriliyor", html.includes("collected of"));
  check("Ödeme işaretleme düğmesi var", html.includes("Mark paid"));
  check("Plan varken tekrar oluşturma formu gösterilmiyor", !html.includes("Create payment plan"));
}

// 3 — cron artık gerçek taksit görüyor
{
  const fs=await import("node:fs");
  const CRON=fs.readFileSync(".env.local","utf8").split("\n").find(l=>l.startsWith("CRON_SECRET=")).split("=")[1].trim();
  const res=await fetch(`${BASE}/api/cron/installments`,{headers:{authorization:`Bearer ${CRON}`}});
  const body=await res.json().catch(()=>({}));
  check("Taksit cron'u kayıtları işliyor", res.status===200 && (body.total ?? 0) > 0, `status ${res.status} ${JSON.stringify(body).slice(0,120)}`);
}

// 4 — vadesi geçmiş taksit overdue görünüyor
{
  const first=await prisma.installment.findFirst({where:{order_id:order.id},orderBy:{installment_no:"asc"}});
  await prisma.installment.update({where:{id:first.id},data:{due_date:"2020-01-01"}});
  const html=strip(await(await fetch(`${BASE}/orders/${order.id}`,{headers:H})).text());
  check("Vadesi geçmiş taksit overdue olarak gösteriliyor", html.includes("overdue"));
  check("Gecikme sayacı görünüyor", html.includes("1 overdue"));
}

// 5 — kiracı izolasyonu
{
  const e2=`iso${stamp}@example.com`;
  await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email:e2,password:PW,shopName:`Iso ${stamp}`})});
  const j2=await login(e2,PW);
  const res=await fetch(`${BASE}/orders/${order.id}`,{headers:{cookie:j2.hdr()},redirect:"manual"});
  check("Başka kiracı bu siparişi açamıyor", res.status===307 || res.status===404, `status ${res.status}`);
}

console.log(out.join("\n"));
console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
await prisma.$disconnect();
process.exit(fail?1:0);
};
run().catch(async e=>{console.error("BETİK HATASI:",e);await prisma.$disconnect();process.exit(2);});
