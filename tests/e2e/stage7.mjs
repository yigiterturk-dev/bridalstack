import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
let pass=0, fail=0; const out=[];
const check=(n,ok,d="")=>{ok?(pass++,out.push(`  OK   ${n}`)):(fail++,out.push(`  FAIL ${n}${d?" — "+d:""}`));};
const strip=h=>h.replace(/<!--[\s\S]*?-->/g,"");
function jarOf(){const j=new Map();return{set:r=>{for(const c of r.headers.getSetCookie?.()??[]){const[p]=c.split(";");const i=p.indexOf("=");j.set(p.slice(0,i).trim(),p.slice(i+1).trim());}},hdr:()=>[...j].map(([k,v])=>`${k}=${v}`).join("; ")};}
async function login(email,password){const j=jarOf();let r=await fetch(`${BASE}/api/auth/csrf`);j.set(r);const{csrfToken}=await r.json();
 r=await fetch(`${BASE}/api/auth/callback/credentials`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",cookie:j.hdr()},body:new URLSearchParams({csrfToken,email,password,json:"true"}),redirect:"manual"});j.set(r);return j;}

const stamp=Date.now(), EMAIL=`fu${stamp}@example.com`, PW="Str0ngPass!234", SHOP=`FollowUp Bridal ${stamp}`;
const ago=(days)=>new Date(Date.now()-days*864e5);

const run=async()=>{
await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email:EMAIL,password:PW,shopName:SHOP})});
const user=await prisma.user.findUnique({where:{email:EMAIL}});
const tenant=await prisma.tenant.findFirst({where:{owner_id:user.id}});
await prisma.tenant.update({where:{id:tenant.id},data:{packs:["base","sales","inventory"]}});
const j=await login(EMAIL,PW); const H={cookie:j.hdr()};

// Prova verisi olmayan kiracıda boş durum
{
  const html=strip(await(await fetch(`${BASE}/follow-ups`,{headers:H})).text());
  check("Takip sayfası açılıyor", html.includes("Follow-ups"));
  check("Prova verisi yokken yönlendirici boş durum çıkıyor", html.includes("No try-ons recorded yet"));
  const dash=strip(await(await fetch(`${BASE}/dashboard`,{headers:H})).text());
  check("Prova verisi yokken panelde takip kartı gösterilmiyor", !dash.includes("have not ordered"));
}

// Veri kur: biri bayıldı almadı, biri bayıldı aldı, biri beğenmedi
const gownA=await prisma.product.create({data:{tenant_id:tenant.id,name:"Aurora Lace Gown",
  barcode:`A${stamp}`,category:"Bridal Gown",price:4500,cost:1600,stock_quantity:2}});
const gownB=await prisma.product.create({data:{tenant_id:tenant.id,name:"Celeste Satin Gown",
  barcode:`B${stamp}`,category:"Bridal Gown",price:3200,cost:1200,stock_quantity:1}});

const missed=await prisma.customer.create({data:{tenant_id:tenant.id,name:"Missed Bride",phone:"+1 555 0100"}});
const bought=await prisma.customer.create({data:{tenant_id:tenant.id,name:"Bought Bride",phone:"+1 555 0200"}});
const disliked=await prisma.customer.create({data:{tenant_id:tenant.id,name:"Disliked Bride"}});

await prisma.tryOn.createMany({data:[
  {tenant_id:tenant.id,customer_id:missed.id,product_id:gownA.id,reaction:"loved",rating:5,created_at:ago(20)},
  {tenant_id:tenant.id,customer_id:bought.id,product_id:gownA.id,reaction:"loved",rating:5,created_at:ago(30)},
  {tenant_id:tenant.id,customer_id:disliked.id,product_id:gownB.id,reaction:"no",rating:1,created_at:ago(10)},
]});
// Alan gelin provadan SONRA sipariş verdi
await prisma.order.create({data:{tenant_id:tenant.id,ref_no:`F${stamp}`.slice(0,14),customer_id:bought.id,
  order_type:"sale",status:"confirmed",discounted_total:4500,list_total:4500,remaining_balance:4500,
  created_at:ago(25)}});

{
  const html=strip(await(await fetch(`${BASE}/follow-ups`,{headers:H})).text());
  check("Bayılıp almayan gelin listede", html.includes("Missed Bride"));
  check("Provadan sonra sipariş veren gelin listede DEĞİL", !html.includes("Bought Bride"));
  check("Beğenmeyen gelin listede DEĞİL", !html.includes("Disliked Bride"));
  check("Denediği elbise gösteriliyor", html.includes("Aurora Lace Gown"));
  check("Kaçan ciro hesaplanıyor", html.includes("4,500"));
  check("Bekleme süresi gösteriliyor", html.includes("20 days ago"));
  check("Elbise performans paneli var", html.includes("Loved but not selling"));
  check("Dönüşüm oranı hesaplanıyor", html.includes("50%"));
}

// Panel kartı → Today ekranı takip uyarısı kartını artık göstermiyor;
// takip listesi kendi sayfasında ve ana menüden erişiliyor.
{
  const fu=strip(await(await fetch(`${BASE}/follow-ups`,{headers:H})).text());
  check("Takip listesi 'have not ordered' bağlamını taşıyor", fu.includes("have not ordered"));
  const dash=strip(await(await fetch(`${BASE}/dashboard`,{headers:H})).text());
  check("Panel uyarısı takip sayfasına bağlanıyor", dash.includes('href="/follow-ups"'));
}

// Menüde yer alıyor
{
  const dash=strip(await(await fetch(`${BASE}/dashboard`,{headers:H})).text());
  check("Kenar menüsünde Follow-ups var", dash.includes('href="/follow-ups"') && dash.includes("Follow-ups"));
}

// Takip edilince listeden düşüyor
{
  await prisma.order.create({data:{tenant_id:tenant.id,ref_no:`G${stamp}`.slice(0,14),customer_id:missed.id,
    order_type:"sale",status:"confirmed",discounted_total:4500,list_total:4500,remaining_balance:4500}});
  const html=strip(await(await fetch(`${BASE}/follow-ups`,{headers:H})).text());
  check("Sipariş verilince gelin takip listesinden düşüyor", !html.includes("Missed Bride"));
  check("Liste boşalınca olumlu mesaj çıkıyor", html.includes("Nothing outstanding"));
}

// Kiracı izolasyonu
{
  const e2=`fuiso${stamp}@example.com`;
  await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email:e2,password:PW,shopName:`FuIso ${stamp}`})});
  const j2=await login(e2,PW);
  const html=strip(await(await fetch(`${BASE}/follow-ups`,{headers:{cookie:j2.hdr()}})).text());
  check("Başka kiracı bu gelinleri görmüyor", !html.includes("Aurora Lace Gown"));
}

// Oturumsuz erişim kapalı
{
  const res=await fetch(`${BASE}/follow-ups`,{redirect:"manual"});
  check("Oturumsuz erişim login'e yönleniyor", res.status===307, `status ${res.status}`);
}

console.log(out.join("\n"));
console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
await prisma.$disconnect();
process.exit(fail?1:0);
};
run().catch(async e=>{console.error("BETİK HATASI:",e);await prisma.$disconnect();process.exit(2);});
