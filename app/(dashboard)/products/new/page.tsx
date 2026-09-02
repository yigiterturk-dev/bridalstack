import { uploadsEnabled } from "@/lib/uploads";
import NewProductForm from "./new-product-form";

export default function NewProductPage() {
  // Yükleme yapılandırılmamışsa form fotoğraf alanını devre dışı gösterir.
  return <NewProductForm uploadsOn={uploadsEnabled()} />;
}
