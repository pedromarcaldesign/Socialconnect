import { requireBrand } from "@/lib/auth";
import { listMedia } from "@/lib/media-view";
import { PageHeader } from "@/components/ui";
import { MediaLibrary } from "@/components/media-library";

export const metadata = { title: "Biblioteca" };

export default async function MediaPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { brand } = await requireBrand(brandId);
  const items = await listMedia(brand.id);
  return (
    <>
      <PageHeader title="Biblioteca" description={`Fotos de ${brand.name}. A IA descreve e etiqueta cada foto ao chegar.`} />
      <MediaLibrary brandId={brand.id} initial={items} />
    </>
  );
}
