import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
let pass=0, fail=0; const out=[];
const check=(n,ok,d="")=>{ok?(pass++,out.push(`  OK   ${n}`)):(fail++,out.push(`  FAIL ${n}${d?" — "+d:""}`));};
const strip=h=>h.replace(/<!--[\s\S]*?-->/g,"");
function jarOf(){const j=new Map();return{set:r=>{for(const c of r.headers.getSetCookie?.()??[]){const[p]=c.split(";");const i=p.indexOf("=");j.set(p.slice(0,i).trim(),p.slice(i+1).trim());}},hdr:()=>[...j].map(([k,v])=>`${k}=${v}`).join("; ")};}
async function login(email,password){const j=jarOf();let r=await fetch(`${BASE}/api/auth/csrf`);j.set(r);const{csrfToken}=await r.json();
 r=await fetch(`${BASE}/api/auth/callback/credentials`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",cookie:j.hdr()},body:new URLSearchParams({csrfToken,email,password,json:"true"}),redirect:"manual"});j.set(r);return j;}

const stamp=Date.now(), EMAIL=`br${stamp}@example.com`, PW="Str0ngPass!234", SHOP=`Briefing Bridal ${stamp}`;
const ago=d=>new Date(Date.now()-d*864e5);

const run=async()=>{
await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email:EMAIL,password:PW,shopName:SHOP})});
const user=await prisma.user.findUnique({where:{email:EMAIL}});
const tenant=await prisma.tenant.findFirst({where:{owner_id:user.id}});
await prisma.tenant.update({where:{id:tenant.id},data:{packs:["base","sales","inventory","pro"]}});
const j=await login(EMAIL,PW); const H={cookie:j.hdr()};

// Temiz kiracıda olumlu brifing
{
  const html=strip(await(await fetch(`${BASE}/ai-stylist`,{headers:H})).text());
  check("AI stylist sayfası açılıyor", html.includes("AI Stylist"));
  check("Brifing bölümü işletme adıyla başlıyor", html.includes(`Today at ${SHOP}`));
  check("Sinyal yokken olumlu mesaj çıkıyor", html.includes("Nothing needs chasing"));
  check("Sohbet kutusu hâlâ duruyor", html.includes("Ask anything about your shop"));
}

// Sinyalleri kur
const customer=await prisma.customer.create({data:{tenant_id:tenant.id,name:"Briefing Bride"}});
const gown=await prisma.product.create({data:{tenant_id:tenant.id,name:"Signal Gown",
  barcode:`S${stamp}`,price:5000,cost:2000,stock_quantity:0}});
await prisma.tryOn.create({data:{tenant_id:tenant.id,customer_id:customer.id,product_id:gown.id,
  reaction:"loved",rating:5,created_at:ago(12)}});
const order=await prisma.order.create({data:{tenant_id:tenant.id,ref_no:`B${stamp}`.slice(0,14),
  customer_id:customer.id,order_type:"sale",status:"confirmed",discounted_total:5000,
  list_total:5000,remaining_balance:5000,created_at:ago(20)}});
await prisma.installment.create({data:{tenant_id:tenant.id,order_id:order.id,customer_id:customer.id,
  installment_no:1,total_count:2,amount:2500,due_date:"2025-01-01",status:"pending"}});
await prisma.booking.create({data:{tenant_id:tenant.id,customer_name:"Web Bride",
  booking_date:new Date().toISOString().split("T")[0],start_time:"10:00",end_time:"11:00",status:"pending"}});
await prisma.appointment.create({data:{tenant_id:tenant.id,customer_id:customer.id,
  title:"Fitting",appointment_date:new Date(Date.now()+3*864e5),status:"pending"}});
await prisma.contract.create({data:{tenant_id:tenant.id,customer_id:customer.id,title:"Agreement",
  content:"terms",total_amount:5000,status:"sent",token:`ct${stamp}`}});

{
  const html=strip(await(await fetch(`${BASE}/ai-stylist`,{headers:H})).text());
  check("Bekleyen rezervasyon brifingde", html.includes("awaiting approval"));
  check("Vadesi geçmiş ödeme brifingde", html.includes("overdue"));
  check("Onaylanmamış randevu brifingde", html.includes("still unconfirmed"));
  check("Takip fırsatı brifingde", html.includes("have not ordered"));
  check("İmzasız sözleşme brifingde", html.includes("waiting for a signature"));
  check("Tükenen stok brifingde", html.includes("out of stock"));
  check("Aciliyet etiketi gösteriliyor", html.includes("Do today"));
  check("Fırsat etiketi gösteriliyor", html.includes("Earns money"));
  check("Her satır tıklanabilir", html.includes('href="/bookings"') && html.includes('href="/follow-ups"'));
  const urgentAt=html.indexOf("Do today"), watchAt=html.indexOf("Keep an eye on");
  check("Acil işler gözlem işlerinin üstünde", urgentAt !== -1 && urgentAt < watchAt, `${urgentAt} / ${watchAt}`);
}

// Kiracı izolasyonu
{
  const e2=`briso${stamp}@example.com`;
  await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email:e2,password:PW,shopName:`BrIso ${stamp}`})});
  const j2=await login(e2,PW);
  const html=strip(await(await fetch(`${BASE}/ai-stylist`,{headers:{cookie:j2.hdr()}})).text());
  check("Başka kiracı bu sinyalleri görmüyor", html.includes("Nothing needs chasing"));
}

console.log(out.join("\n"));
console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
await prisma.$disconnect();
process.exit(fail?1:0);
};
run().catch(async e=>{console.error("BETİK HATASI:",e);await prisma.$disconnect();process.exit(2);});
