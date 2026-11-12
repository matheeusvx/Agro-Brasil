import type { Metadata } from "next";
import { Toaster } from "sonner";
import { PortalProvider } from "@/components/portal-provider";
import "./globals.css";
import "./theme.css";
import "./drawers.css";
import "./destino.css";
import "./publicos.css";
export const metadata: Metadata = {
  title: "Agro+ Brasil | Portal",
  description:
    "Produção, remessas e solicitações do campo em um só espaço de trabalho.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <PortalProvider>{children}</PortalProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
