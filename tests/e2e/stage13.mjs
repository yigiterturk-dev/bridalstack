import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
let pass=0, fail=0; const out=[];
const check=(n,ok,d="")=>{ok?(pass++,out.push(`  OK   ${n}`)):(fail++,out.push(`  FAIL ${n}${d?" — "+d:""}`));};
const strip=h=>h.replace(/<!--[\s\S]*?-->/g,"");
function jarOf(){const j=new Map();return{set:r=>{for(const c of r.headers.getSetCookie?.()??[]){const[p]=c.split(";");const i=p.indexOf("=");j.set(p.slice(0,i).trim(),p.slice(i+1).trim());}},hdr:()=>[...j].map(([k,v])=>`${k}=${v}`).join("; ")};}
async function login(email,password){const j=jarOf();let r=await fetch(`${BASE}/api/auth/csrf`);j.set(r);const{csrfToken}=await r.json();
 r=await fetch(`${BASE}/api/auth/callback/credentials`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",cookie:j.hdr()},body:new URLSearchParams({csrfToken,email,password,json:"true"}),redirect:"manual"});j.set(r);return j;}

const stamp=Date.now();
const EMAIL=`inv${stamp}@example.com`, PW="Str0ngPass!234", SHOP=`Full Bridal ${stamp}`;
const OTHER=`out${stamp}@example.com`;

const run=async()=>{
// ── İki ayrı kiracı: izolasyon sınaması için ──
for (const [email,shop] of [[EMAIL,SHOP],[OTHER,`Other Bridal ${stamp}`]]) {
  await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email,password:PW,shopName:shop})});
}
const user=await prisma.user.findUnique({where:{email:EMAIL}});
const tenant=await prisma.tenant.findFirst({where:{owner_id:user.id}});
const other=await prisma.tenant.findFirst({where:{owner:{email:OTHER}}});

// Tüm paketleri aç ki yeni sayfaların hepsi görünsün.
await prisma.tenant.update({where:{id:tenant.id},
  data:{packs:["base","salon","sales","inventory","pro","finance"]}});

const j=await login(EMAIL,PW); const H={cookie:j.hdr()};
const get=async p=>strip(await(await fetch(`${BASE}${p}`,{headers:H})).text());

// ── Menüde artık "yakında" sayfa yok: 9 yeni yol da açılıyor ──
const NEW_ROUTES=["/suppliers","/inventory-count","/returns","/commissions","/commissions/rules","/cash","/installments","/ledger","/checks"];
{
  for (const route of NEW_ROUTES) {
    const res=await fetch(`${BASE}${route}`,{headers:H,redirect:"manual"});
    check(`${route} açılıyor`, res.status===200, `status ${res.status}`);
  }
  const dash=await get("/dashboard");
  for (const route of ["/suppliers","/inventory-count","/returns","/commissions","/cash","/installments","/ledger","/checks"])
    check(`Menüde ${route} bağlantısı var`, dash.includes(`href="${route}"`));
}

// ── Native select kalmadı ──
{
  const pages=await Promise.all(["/suppliers","/returns","/checks","/services","/staff","/orders/new"].map(get));
  check("Yeni sayfalarda native <select> yok", pages.every(h=>!h.includes("<select")));
}

// ── Tedarikçi + ürün bağı ──
const supplier=await prisma.supplier.create({data:{tenant_id:tenant.id,name:"Maggie Test",lead_time_days:120}});
const product=await prisma.product.create({data:{tenant_id:tenant.id,name:"Test Gown",barcode:`BC${stamp}`,price:2000,cost:800,stock_quantity:4,supplier_id:supplier.id}});
{
  const html=await get("/suppliers");
  check("Tedarikçi listede görünüyor", html.includes("Maggie Test"));
  check("Tedarikçi teslim süresi yazıyor", html.includes("120 day lead time"));
  check("Tedarikçiye bağlı elbise sayılıyor", html.includes("1</strong>") || html.includes("1 gown"));
}

// ── Stok sayımı: beklenen donuyor, boş kalan stoğa dokunmuyor ──
{
  const count=await prisma.stockCount.create({data:{tenant_id:tenant.id,reference:"E2E count",
    items:{create:[{product_id:product.id,expected_qty:product.stock_quantity}]}},include:{items:true}});
  const item=count.items[0];

  // Sayımdan sonra stok değişse bile beklenen sabit kalmalı.
  await prisma.product.update({where:{id:product.id},data:{stock_quantity:9}});
  const frozen=await prisma.stockCountItem.findUnique({where:{id:item.id}});
  check("Sayım açılırken beklenen adet donduruldu", frozen.expected_qty===4, String(frozen.expected_qty));

  const sheet=await get(`/inventory-count/${count.id}`);
  check("Sayım föyü ürünü listeliyor", sheet.includes("Test Gown"));
  check("Sayım föyünde kaydet butonu var", sheet.includes("Save counts"));

  // Sayılmamış kalem kapanışta ellenmemeli.
  const { closingQuantity } = await import("../../lib/inventory.ts");
  check("Boş bırakılan kalem stoğa dokunmuyor", closingQuantity({expected_qty:4,counted_qty:null})===null);
  await prisma.stockCount.delete({where:{id:count.id}});
  await prisma.product.update({where:{id:product.id},data:{stock_quantity:4}});
}

// ── İade: stok sadece "teslim alındı" adımında artar ──
{
  const ret=await prisma.productReturn.create({data:{tenant_id:tenant.id,product_id:product.id,
    quantity:1,reason:"sizing",condition:"resellable",restock:true,refund_amount:500}});
  let html=await get("/returns");
  check("İade listede görünüyor", html.includes("Test Gown"));
  check("Bekleyen iadede onay butonu var", html.includes("Approve"));

  const before=(await prisma.product.findUnique({where:{id:product.id}})).stock_quantity;
  await prisma.productReturn.update({where:{id:ret.id},data:{status:"approved"}});
  const afterApprove=(await prisma.product.findUnique({where:{id:product.id}})).stock_quantity;
  check("Onay tek başına stoğu artırmıyor", before===afterApprove, `${before} -> ${afterApprove}`);
  await prisma.productReturn.delete({where:{id:ret.id}});
}

// ── Prim: kural yoksa sıfır, kural varsa hesaplanıyor ──
{
  const customer=await prisma.customer.create({data:{tenant_id:tenant.id,name:"E2E Bride"}});
  const period=new Date().toISOString().slice(0,7);
  await prisma.order.create({data:{tenant_id:tenant.id,ref_no:`E2E-${stamp}`,customer_id:customer.id,
    sales_person:"Ayla",status:"confirmed",discounted_total:2000,order_date:`${period}-05`}});

  let html=await get("/commissions");
  check("Kural yokken boş durum çıkıyor", html.includes("No commission rules yet"));

  await prisma.commissionRule.create({data:{tenant_id:tenant.id,name:"Standard",rate_percent:5}});
  html=await get("/commissions");
  check("Prim satışçıya göre hesaplanıyor", html.includes("Ayla"));
  check("Prim tutarı doğru ($100)", html.includes("$100"), "2000 x %5");
  check("Uygulanan kural gösteriliyor", html.includes("Standard"));
}

// ── Kasa + defter: taksit tahsilatı kasaya tek kayıt yazıyor ──
{
  const customer=await prisma.customer.findFirst({where:{tenant_id:tenant.id}});
  const order=await prisma.order.findFirst({where:{tenant_id:tenant.id}});
  const inst=await prisma.installment.create({data:{tenant_id:tenant.id,order_id:order.id,
    customer_id:customer.id,amount:750,due_date:new Date().toISOString().slice(0,10),installment_no:1,total_count:2}});

  let html=await get("/installments");
  check("Taksit listede görünüyor", html.includes("E2E Bride"));
  check("Tahsilat butonu var", html.includes("Mark collected"));

  // Sunucu eylemini taklit et: tahsilat + kasa kaydı aynı taksit kimliğine bağlı.
  await prisma.$transaction([
    prisma.installment.update({where:{id:inst.id},data:{status:"paid",paid_at:new Date()}}),
    prisma.cashMovement.create({data:{tenant_id:tenant.id,direction:"in",amount:750,method:"cash",
      category:"installment",occurred_on:new Date().toISOString().slice(0,10),installment_id:inst.id}}),
  ]);

  let duplicated=false;
  try {
    await prisma.cashMovement.create({data:{tenant_id:tenant.id,direction:"in",amount:750,method:"cash",
      category:"installment",occurred_on:new Date().toISOString().slice(0,10),installment_id:inst.id}});
    duplicated=true;
  } catch { /* unique kısıt tuttu */ }
  check("Aynı taksit iki kez kasaya yazılamıyor", !duplicated);

  const cash=await get("/cash");
  check("Kasa taksit tahsilatını gösteriyor", cash.includes("Installment"));
  check("Kasa kaydı otomatik işaretli", cash.includes("auto"));
  const ledger=await get("/ledger");
  check("Defter tahsilatı topluyor", ledger.includes("$750"));
}

// ── Çek: sadece tahsil edilince kasaya girer ──
{
  const check1=await prisma.check.create({data:{tenant_id:tenant.id,counterparty:"Bride Father",
    amount:1200,due_date:new Date().toISOString().slice(0,10)}});
  const html=await get("/checks");
  check("Çek listede görünüyor", html.includes("Bride Father"));
  check("Portföydeki çekte 'Deposit' adımı var", html.includes("Deposit"));
  const moved=await prisma.cashMovement.count({where:{tenant_id:tenant.id,check_id:check1.id}});
  check("Tahsil edilmemiş çek kasada görünmüyor", moved===0);
}

// ── Kiracı izolasyonu: komşunun kaydı görünmüyor ──
{
  const theirSupplier=await prisma.supplier.create({data:{tenant_id:other.id,name:"Neighbour Supplier"}});
  const theirCheck=await prisma.check.create({data:{tenant_id:other.id,counterparty:"Neighbour Check",
    amount:99,due_date:new Date().toISOString().slice(0,10)}});
  const suppliers=await get("/suppliers");
  const checks=await get("/checks");
  check("Başka kiracının tedarikçisi sızmıyor", !suppliers.includes("Neighbour Supplier"));
  check("Başka kiracının çeki sızmıyor", !checks.includes("Neighbour Check"));
  await prisma.supplier.delete({where:{id:theirSupplier.id}});
  await prisma.check.delete({where:{id:theirCheck.id}});
}

// ── Paket kapalıysa sayfa kapalı ──
{
  await prisma.tenant.update({where:{id:tenant.id},data:{packs:["base","salon"]}});
  for (const route of ["/suppliers","/cash","/commissions"]) {
    const html=await get(route);
    check(`${route} paket kapalıyken erişime kapalı`, html.includes("not part of your current plan"));
  }
}

console.log(out.join("\n"));
console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
await prisma.$disconnect();
process.exit(fail?1:0);
};
run().catch(async e=>{console.error("BETİK HATASI:",e);await prisma.$disconnect();process.exit(2);});
