"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { sendMagicLink, signInWithGoogle, type LoginState } from "./actions";

export function LoginForm({ error, googleEnabled }: { error: string | null; googleEnabled: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {});
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">Entrar</h1>
      <p className="mt-1 text-sm text-text-muted">Enviamos-te um link para entrares, sem password.</p>
      <div className="mt-5 flex flex-col gap-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {state.sent ? (
          <Alert tone="success" title="Verifica o teu email">Se este email tiver acesso, vais receber um link para entrar.</Alert>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <Field label="Email" htmlFor="email" error={state.error}>
              <Input id="email" name="email" type="email" autoComplete="email" required placeholder="nome@purepixel.pt" aria-invalid={Boolean(state.error)} />
            </Field>
            <Button type="submit" variant="primary" icon={Mail} loading={pending}>Enviar link</Button>
          </form>
        )}
        {googleEnabled ? (
          <form action={signInWithGoogle}>
            <Button type="submit" className="w-full">Entrar com Google</Button>
          </form>
        ) : null}
      </div>
    </Card>
  );
}
