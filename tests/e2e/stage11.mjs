import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
let pass=0, fail=0; const out=[];
const check=(n,ok,d="")=>{ok?(pass++,out.push(`  OK   ${n}`)):(fail++,out.push(`  FAIL ${n}${d?" — "+d:""}`));};
const strip=h=>h.replace(/<!--[\s\S]*?-->/g,"");
function jarOf(){const j=new Map();return{set:r=>{for(const c of r.headers.getSetCookie?.()??[]){const[p]=c.split(";");const i=p.indexOf("=");j.set(p.slice(0,i).trim(),p.slice(i+1).trim());}},hdr:()=>[...j].map(([k,v])=>`${k}=${v}`).join("; ")};}
async function login(email,password){const j=jarOf();let r=await fetch(`${BASE}/api/auth/csrf`);j.set(r);const{csrfToken}=await r.json();
 r=await fetch(`${BASE}/api/auth/callback/credentials`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",cookie:j.hdr()},body:new URLSearchParams({csrfToken,email,password,json:"true"}),redirect:"manual"});j.set(r);return j;}

const stamp=Date.now(), EMAIL=`rp${stamp}@example.com`, PW="Str0ngPass!234", SHOP=`Reports Bridal ${stamp}`;
const iso=d=>d.toISOString().split("T")[0];
const ago=d=>new Date(Date.now()-d*864e5);

const run=async()=>{
await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email:EMAIL,password:PW,shopName:SHOP})});
const user=await prisma.user.findUnique({where:{email:EMAIL}});
const tenant=await prisma.tenant.findFirst({where:{owner_id:user.id}});
await prisma.tenant.update({where:{id:tenant.id},data:{packs:["base","sales","inventory"]}});
const j=await login(EMAIL,PW); const H={cookie:j.hdr()};

const bride=await prisma.customer.create({data:{tenant_id:tenant.id,name:"Ledger Bride",phone:"+1 555 0400"}});
// Vadesi çok geçmiş borç
const late=await prisma.order.create({data:{tenant_id:tenant.id,ref_no:`L${stamp}`.slice(0,14),
  customer_id:bride.id,order_type:"sale",status:"confirmed",order_date:iso(ago(120)),
  discounted_total:8000,list_total:8000,deposit_amount:2000,remaining_balance:6000,
  sales_person:"Isabella",created_at:ago(120)}});
await prisma.installment.create({data:{tenant_id:tenant.id,order_id:late.id,customer_id:bride.id,
  installment_no:1,total_count:1,amount:6000,due_date:"2020-01-01",status:"pending"}});
// Tamamen ödenmiş sipariş
await prisma.order.create({data:{tenant_id:tenant.id,ref_no:`F${stamp}`.slice(0,14),
  customer_id:bride.id,order_type:"sale",status:"completed",order_date:iso(ago(5)),
  discounted_total:3000,list_total:3000,deposit_amount:3000,remaining_balance:0,
  sales_person:"Emma",created_at:ago(5)}});
// İptal edilmiş sipariş
await prisma.order.create({data:{tenant_id:tenant.id,ref_no:`C${stamp}`.slice(0,14),
  customer_id:bride.id,order_type:"sale",status:"cancelled",order_date:iso(ago(3)),
  discounted_total:9999,list_total:9999,deposit_amount:0,remaining_balance:9999,created_at:ago(3)}});

// ── Faturalar ──
{
  const html=strip(await(await fetch(`${BASE}/invoices`,{headers:H})).text());
  check("Faturalar sayfası açılıyor", html.includes("Invoices"));
  check("Açık bakiye toplamı gösteriliyor", html.includes("6,000"));
  check("Borçlu sipariş listede", html.includes(late.ref_no));
  check("Tamamı ödenen sipariş listede DEĞİL", !html.includes(`F${stamp}`.slice(0,14)));
  check("İptal edilen sipariş borç sayılmıyor", !html.includes("9,999"));
  check("Yaşlandırma kovaları var", html.includes("60+ days") && html.includes("Not yet due"));
  check("Gecikme gün sayısı gösteriliyor", html.includes("days overdue"));
  check("Fatura yazdırma bağlantısı var", html.includes(`/print/order/${late.id}`));
}
{
  const html=strip(await(await fetch(`${BASE}/invoices?bucket=d61_plus`,{headers:H})).text());
  check("Kova filtresi çalışıyor", html.includes(late.ref_no));
  const bos=strip(await(await fetch(`${BASE}/invoices?bucket=current`,{headers:H})).text());
  check("Boş kovada uygun mesaj çıkıyor", bos.includes("Nothing in this range"));
}

// ── Raporlar ──
{
  const html=strip(await(await fetch(`${BASE}/reports?range=365`,{headers:H})).text());
  check("Raporlar sayfası açılıyor", html.includes("Reports"));
  check("Sipariş tablosu var", html.includes(late.ref_no));
  check("Stilist kırılımı var", html.includes("Isabella") && html.includes("Emma"));
  check("Durum kırılımı var", html.includes("By status"));
  // İptal edilen sipariş listede ve durum kırılımında GÖRÜNMELİ, sadece
  // ciro toplamına girmemeli. Ciro = 8000 + 3000 = 11.000.
  check("İptal edilen sipariş listede görünüyor", html.includes(`C${stamp}`.slice(0,14)));
  check("Ciro toplamı iptal edileni saymıyor", html.includes("11,000") && !html.includes("20,999"));
  check("İptal sayısı ayrıca belirtiliyor", html.includes("1 cancelled"));
  check("CSV indirme bağlantıları var", html.includes("report=orders") && html.includes("report=staff"));
}

// ── CSV dışa aktarma ──
{
  const res=await fetch(`${BASE}/reports/export?report=orders&range=365`,{headers:H});
  const body=await res.text();
  check("CSV indiriliyor", res.status===200, `status ${res.status}`);
  check("CSV içerik türü doğru", (res.headers.get("content-type")||"").includes("text/csv"));
  check("CSV dosya adı veriliyor", (res.headers.get("content-disposition")||"").includes("attachment"));
  check("CSV başlık satırı var", body.includes("Reference,Date,Customer"));
  check("CSV borçlu siparişi içeriyor", body.includes(late.ref_no));
  const staff=await (await fetch(`${BASE}/reports/export?report=staff&range=365`,{headers:H})).text();
  check("Personel CSV'si üretiliyor", staff.includes("Stylist,Orders,Revenue") && staff.includes("Isabella"));
  const bad=await fetch(`${BASE}/reports/export?report=uydurma`,{headers:H});
  check("Bilinmeyen rapor reddediliyor", bad.status===400, `status ${bad.status}`);
}

// ── Formül enjeksiyonu ──
{
  await prisma.customer.create({data:{tenant_id:tenant.id,name:"=1+1"}});
  const evil=await prisma.customer.findFirst({where:{tenant_id:tenant.id,name:"=1+1"}});
  await prisma.order.create({data:{tenant_id:tenant.id,ref_no:`E${stamp}`.slice(0,14),
    customer_id:evil.id,order_type:"sale",status:"confirmed",discounted_total:100,
    list_total:100,deposit_amount:0,remaining_balance:100}});
  const body=await (await fetch(`${BASE}/reports/export?report=orders&range=365`,{headers:H})).text();
  check("Formül gibi görünen müşteri adı kaçışlanıyor", body.includes("'=1+1") && !/,=1\+1,/.test(body));
}

// ── Erişim ──
{
  check("Faturalar oturumsuz kapalı", (await fetch(`${BASE}/invoices`,{redirect:"manual"})).status===307);
  check("Raporlar oturumsuz kapalı", (await fetch(`${BASE}/reports`,{redirect:"manual"})).status===307);
  const csv=await fetch(`${BASE}/reports/export?report=orders`,{redirect:"manual"});
  check("CSV ucu oturumsuz kapalı", csv.status===401 || csv.status===307, `status ${csv.status}`);
  const exportRes=await fetch(`${BASE}/settings/export`,{redirect:"manual"});
  check("Veri dışa aktarma ucu oturumsuz kapalı", exportRes.status===401 || exportRes.status===307, `status ${exportRes.status}`);
}

// ── Modül kapısı ──
{
  // Kayıt tüm satılabilir paketlerde deneme açıyor; kapıyı sınamak için denemeyi bitir.
  await prisma.tenant.update({where:{id:tenant.id},data:{packs:["base"],trial_ends_at:new Date(Date.now()-1000)}});
  const html=strip(await(await fetch(`${BASE}/invoices`,{headers:H})).text());
  check("Sales paketi yokken yükseltme çağrısı çıkıyor", html.includes("not part of your current plan"));
  await prisma.tenant.update({where:{id:tenant.id},data:{packs:["base","sales","inventory"]}});
}

// ── Kiracı izolasyonu ──
{
  const e2=`rpiso${stamp}@example.com`;
  await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email:e2,password:PW,shopName:`RpIso ${stamp}`})});
  const j2=await login(e2,PW);
  await prisma.tenant.updateMany({where:{name:`RpIso ${stamp}`},data:{packs:["base","sales"]}});
  const html=strip(await(await fetch(`${BASE}/invoices`,{headers:{cookie:j2.hdr()}})).text());
  check("Başka kiracı bu borçları görmüyor", !html.includes(late.ref_no));
}

console.log(out.join("\n"));
console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
await prisma.$disconnect();
process.exit(fail?1:0);
};
run().catch(async e=>{console.error("BETİK HATASI:",e);await prisma.$disconnect();process.exit(2);});
