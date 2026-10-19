"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/client-ui";
import { BrandForm } from "@/components/brand-form";
import { createBrand } from "./actions";

export function NewBrandButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>Nova marca</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nova marca">
        <BrandForm
          action={createBrand}
          submitLabel="Criar marca"
          compact
          onDone={(r) => {
            setOpen(false);
            if (r.ok && r.data) router.push(`/b/${r.data.id}/settings?nova=1`);
          }}
        />
      </Modal>
    </>
  );
}
