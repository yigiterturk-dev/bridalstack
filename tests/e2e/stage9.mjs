import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
let pass=0, fail=0; const out=[];
const check=(n,ok,d="")=>{ok?(pass++,out.push(`  OK   ${n}`)):(fail++,out.push(`  FAIL ${n}${d?" — "+d:""}`));};
const strip=h=>h.replace(/<!--[\s\S]*?-->/g,"");
function jarOf(){const j=new Map();return{set:r=>{for(const c of r.headers.getSetCookie?.()??[]){const[p]=c.split(";");const i=p.indexOf("=");j.set(p.slice(0,i).trim(),p.slice(i+1).trim());}},hdr:()=>[...j].map(([k,v])=>`${k}=${v}`).join("; ")};}
async function login(email,password){const j=jarOf();let r=await fetch(`${BASE}/api/auth/csrf`);j.set(r);const{csrfToken}=await r.json();
 r=await fetch(`${BASE}/api/auth/callback/credentials`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",cookie:j.hdr()},body:new URLSearchParams({csrfToken,email,password,json:"true"}),redirect:"manual"});j.set(r);return j;}

const stamp=Date.now(), EMAIL=`pr${stamp}@example.com`, PW="Str0ngPass!234", SHOP=`Print Bridal ${stamp}`;

const run=async()=>{
await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email:EMAIL,password:PW,shopName:SHOP})});
const user=await prisma.user.findUnique({where:{email:EMAIL}});
const tenant=await prisma.tenant.findFirst({where:{owner_id:user.id}});
await prisma.tenant.update({where:{id:tenant.id},
  data:{packs:["base","sales","inventory"],accent_color:"#b4496a"}});
const j=await login(EMAIL,PW); const H={cookie:j.hdr()};

const customer=await prisma.customer.create({data:{tenant_id:tenant.id,name:"Print Bride",
  phone:"+1 555 0300",email:`bride${stamp}@example.com`}});
const order=await prisma.order.create({data:{tenant_id:tenant.id,ref_no:`P${stamp}`.slice(0,14),
  customer_id:customer.id,order_type:"sale",status:"confirmed",
  order_date:new Date().toISOString().split("T")[0],
  discounted_total:6000,list_total:6000,deposit_amount:1500,remaining_balance:4500,
  sales_person:"Isabella",notes:"Hem to be shortened two inches."}});
await prisma.installment.createMany({data:[
  {tenant_id:tenant.id,order_id:order.id,customer_id:customer.id,installment_no:1,total_count:3,
   amount:1500,due_date:"2026-10-01",status:"paid",paid_at:new Date()},
  {tenant_id:tenant.id,order_id:order.id,customer_id:customer.id,installment_no:2,total_count:3,
   amount:1500,due_date:"2026-11-01",status:"pending"},
  {tenant_id:tenant.id,order_id:order.id,customer_id:customer.id,installment_no:3,total_count:3,
   amount:1500,due_date:"2020-01-01",status:"pending"},
]});

// ── Fatura çıktısı ──
{
  const res=await fetch(`${BASE}/print/order/${order.id}`,{headers:H,redirect:"manual"});
  const html=res.status===200?strip(await res.text()):"";
  check("Fatura çıktısı açılıyor", res.status===200, `status ${res.status}`);
  check("İşletme adı başlıkta", html.includes(SHOP));
  check("Belge türü Invoice", html.includes("Invoice"));
  check("Sipariş referansı var", html.includes(order.ref_no));
  check("Müşteri bilgisi var", html.includes("Print Bride") && html.includes("+1 555 0300"));
  check("Sipariş toplamı yazıyor", html.includes("6,000"));
  check("Kapora yazıyor", html.includes("1,500"));
  check("Kalan bakiye ödenen taksiti düşüyor", html.includes("3,000"));
  check("Taksit planı tabloda", html.includes("Payment plan") && html.includes("1/3") && html.includes("3/3"));
  check("Ödenmiş taksit Paid görünüyor", html.includes("Paid"));
  check("Vadesi geçmiş taksit Overdue görünüyor", html.includes("Overdue"));
  check("Sipariş notu çıktıda", html.includes("Hem to be shortened"));
  check("Stilist adı çıktıda", html.includes("Isabella"));
  check("Yazdırma düğmesi var", html.includes("Print or save as PDF"));
  check("Düğme çıktıda gizlenecek şekilde işaretli", html.includes("no-print"));
}

// ── Sözleşme çıktısı: imzasız ──
const token=`ct${stamp}`;
const contract=await prisma.contract.create({data:{tenant_id:tenant.id,customer_id:customer.id,
  order_id:order.id,title:"Gown Purchase Agreement",
  content:"The boutique agrees to deliver the gown by the agreed date.",
  total_amount:6000,status:"sent",token}});
{
  const html=strip(await(await fetch(`${BASE}/print/contract/${contract.id}`,{headers:H})).text());
  check("Sözleşme çıktısı açılıyor", html.includes("Gown Purchase Agreement"));
  check("Sözleşme metni çıktıda", html.includes("agrees to deliver the gown"));
  check("İlişkili sipariş referansı çıktıda", html.includes(order.ref_no));
  check("İmzasız sözleşmede boş imza satırı var", !html.includes("Signed on"));
}

// ── Sözleşme çıktısı: imzalı ──
{
  await fetch(`${BASE}/api/contracts/sign`,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({token,signature_data:"Print Bride",agreement_confirmed:true})});
  const html=strip(await(await fetch(`${BASE}/print/contract/${contract.id}`,{headers:H})).text());
  check("İmzalı sözleşmede imza görünüyor", html.includes("Signed by") && html.includes("Print Bride"));
  check("İmza tarihi görünüyor", html.includes("Signed on"));
  check("Durum signed olarak yazıyor", html.includes("signed"));
}

// ── Erişim kontrolü ──
{
  const anon=await fetch(`${BASE}/print/order/${order.id}`,{redirect:"manual"});
  check("Fatura çıktısı oturumsuz açılmıyor", anon.status===307, `status ${anon.status}`);
  const anonC=await fetch(`${BASE}/print/contract/${contract.id}`,{redirect:"manual"});
  check("Sözleşme çıktısı oturumsuz açılmıyor", anonC.status===307, `status ${anonC.status}`);
  // İmza sayfası HÂLÂ herkese açık kalmalı
  const sign=await fetch(`${BASE}/contracts/${token}`,{redirect:"manual"});
  check("Herkese açık imza sayfası kapanmadı", sign.status===200, `status ${sign.status}`);
}

// ── Kiracı izolasyonu ──
{
  const e2=`priso${stamp}@example.com`;
  await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email:e2,password:PW,shopName:`PrIso ${stamp}`})});
  const j2=await login(e2,PW);
  const res=await fetch(`${BASE}/print/order/${order.id}`,{headers:{cookie:j2.hdr()},redirect:"manual"});
  check("Başka kiracı bu faturayı açamıyor", res.status===307, `status ${res.status}`);
}

console.log(out.join("\n"));
console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
await prisma.$disconnect();
process.exit(fail?1:0);
};
run().catch(async e=>{console.error("BETİK HATASI:",e);await prisma.$disconnect();process.exit(2);});
