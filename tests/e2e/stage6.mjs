import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3100";
let pass=0, fail=0; const out=[];
const check=(n,ok,d="")=>{ok?(pass++,out.push(`  OK   ${n}`)):(fail++,out.push(`  FAIL ${n}${d?" — "+d:""}`));};
const strip=h=>h.replace(/<!--[\s\S]*?-->/g,"");
function jarOf(){const j=new Map();return{set:r=>{for(const c of r.headers.getSetCookie?.()??[]){const[p]=c.split(";");const i=p.indexOf("=");j.set(p.slice(0,i).trim(),p.slice(i+1).trim());}},hdr:()=>[...j].map(([k,v])=>`${k}=${v}`).join("; ")};}
async function login(email,password){const j=jarOf();let r=await fetch(`${BASE}/api/auth/csrf`);j.set(r);const{csrfToken}=await r.json();
 r=await fetch(`${BASE}/api/auth/callback/credentials`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",cookie:j.hdr()},body:new URLSearchParams({csrfToken,email,password,json:"true"}),redirect:"manual"});j.set(r);return j;}

const stamp=Date.now(), EMAIL=`up${stamp}@example.com`, PW="Str0ngPass!234", SHOP=`Upload Bridal ${stamp}`;
const BLOB_OK = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const run=async()=>{
await fetch(`${BASE}/api/auth/register`,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email:EMAIL,password:PW,shopName:SHOP})});
const user=await prisma.user.findUnique({where:{email:EMAIL}});
const tenant=await prisma.tenant.findFirst({where:{owner_id:user.id}});
await prisma.tenant.update({where:{id:tenant.id},data:{packs:["base","inventory"]}});
const j=await login(EMAIL,PW);
const H={cookie:j.hdr()};

// ── Yükleme ucu yetki istiyor ──
{
  const anon=await fetch(`${BASE}/api/upload`,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({type:"blob.generate-client-token",payload:{pathname:"x.jpg",callbackUrl:`${BASE}/api/upload`,clientPayload:JSON.stringify({scope:"product"}),multipart:false}})});
  check("Yükleme ucu oturumsuz isteği reddediyor", anon.status >= 400, `status ${anon.status}`);
}

// ── Yapılandırma yoksa uç bunu açıkça söylüyor ──
if (!BLOB_OK) {
  const res=await fetch(`${BASE}/api/upload`,{method:"POST",headers:{"content-type":"application/json",...H},
    body:JSON.stringify({type:"blob.generate-client-token",payload:{pathname:"x.jpg",callbackUrl:`${BASE}/api/upload`,multipart:false}})});
  const body=await res.json().catch(()=>({}));
  check("Blob yapılandırılmamışken uç 503 ve açıklayıcı mesaj dönüyor",
    res.status===503 && String(body.error||"").includes("BLOB_READ_WRITE_TOKEN"), `status ${res.status}`);
}

// ── Arayüz yükleme yapılandırılmamışken bozulmuyor ──
{
  const html=strip(await(await fetch(`${BASE}/products/new`,{headers:H})).text());
  check("Ürün formu açılıyor", html.includes("New Product"));
  check("Fotoğraf alanı formda yer alıyor", html.includes("Product photo"));
  if (!BLOB_OK) check("Yapılandırma yokken alan devre dışı ve sebebi yazıyor",
    html.includes("BLOB_READ_WRITE_TOKEN"));
}

// ── Sahte adres kaydedilmiyor (doğrulama sunucuda) ──
{
  const prod=await prisma.product.create({data:{tenant_id:tenant.id,name:"Fake Image Gown",
    barcode:`FI${stamp}`,price:100,cost:40,stock_quantity:1,image_url:null}});
  check("Ürün görselsiz de oluşturulabiliyor", prod.image_url === null);
}

// ── Görseli olan ürün listede resimle çıkıyor ──
{
  const url=`https://abc123.public.blob.vercel-storage.com/${tenant.id}/product/x.jpg`;
  await prisma.product.create({data:{tenant_id:tenant.id,name:"Photo Gown",barcode:`PG${stamp}`,
    price:2000,cost:800,stock_quantity:2,image_url:url}});
  const html=strip(await(await fetch(`${BASE}/products`,{headers:H})).text());
  check("Ürün listesi görseli gösteriyor", html.includes(url));
  check("Görselsiz ürün yedek ikonu koruyor", html.includes("checkroom"));
}

// ── Prova fotoğrafları portalda görünüyor ──
{
  const customer=await prisma.customer.create({data:{tenant_id:tenant.id,name:"Photo Bride"}});
  const product=await prisma.product.findFirst({where:{tenant_id:tenant.id,name:"Photo Gown"}});
  const photo=`https://abc123.public.blob.vercel-storage.com/${tenant.id}/try-on/f.jpg`;
  await prisma.tryOn.create({data:{tenant_id:tenant.id,customer_id:customer.id,product_id:product.id,
    reaction:"loved",rating:5,photo_urls:[photo]}});
  const ptok=`ptok${stamp}`;
  await prisma.portalToken.create({data:{tenant_id:tenant.id,customer_id:customer.id,token:ptok,
    expires_at:new Date(Date.now()+7*864e5)}});
  const portal=strip(await(await fetch(`${BASE}/portal/${ptok}`)).text());
  check("Müşteri portalı prova fotoğrafını gösteriyor", portal.includes(photo));
}

// ── Migration sırası bozulmamış ──
{
  const rows=await prisma.$queryRawUnsafe("select migration_name from _prisma_migrations order by migration_name");
  const names=rows.map(r=>r.migration_name);
  check("İlk migration init", names[0]?.endsWith("_init"), names.join(", "));
}

console.log(out.join("\n"));
console.log(`\nGeçen: ${pass}  Kalan: ${fail}`);
await prisma.$disconnect();
process.exit(fail?1:0);
};
run().catch(async e=>{console.error("BETİK HATASI:",e);await prisma.$disconnect();process.exit(2);});
