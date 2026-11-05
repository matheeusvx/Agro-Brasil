"use client";
import { ShieldCheck, Building2, MapPin } from "lucide-react";
import { usePortal } from "./portal-provider";
export function Profile() {
  const { session, workspace } = usePortal();
  const member = session.memberships.find(
    (m) => m.organizationId === session.organizationId,
  )!;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SEU ESPAÇO</p>
          <h1>Perfil e configurações</h1>
          <p>Organização, contexto de trabalho e segurança do acesso.</p>
        </div>
      </div>
      <div className="profile-grid">
        <section className="panel p-7">
          <Building2 className="mb-5 text-[#47715b]" />
          <p className="eyebrow">ORGANIZAÇÃO ATIVA</p>
          <h2 className="text-xl mt-2 font-semibold">{member.name}</h2>
          <p className="text-[#69766d] mt-2">
            Pequeno produtor rural ·{" "}
            {member.role === "LEITOR"
              ? "Consulta"
              : member.role === "EDITOR"
                ? "Edição"
                : "Administração"}
          </p>
          <p className="text-xs text-[#69766d] mt-6">
            Use o seletor no cabeçalho para alternar entre vínculos autorizados.
          </p>
        </section>
        <section className="panel p-7">
          <MapPin className="mb-5 text-[#47715b]" />
          <p className="eyebrow">PROPRIEDADE SELECIONADA</p>
          <h2 className="text-xl mt-2 font-semibold">
            {workspace?.property.name ?? "Não selecionada"}
          </h2>
          <p className="text-[#69766d] mt-2">
            {workspace?.property.municipality}{" "}
            {workspace?.property.uf && "· " + workspace.property.uf}
          </p>
        </section>
      </div>
      <section className="panel p-7 mt-5 flex gap-4">
        <ShieldCheck className="shrink-0 text-[#47715b]" />
        <div>
          <h2 className="font-semibold">Seu acesso, protegido na sessão.</h2>
          <p className="text-[#69766d] mt-2 max-w-2xl">
            Você acessa somente as organizações e propriedades autorizadas. Ao
            terminar, use “Sair do portal” para encerrar o acesso neste
            computador.
          </p>
          <p className="text-xs text-[#69766d] mt-3">
            Acesso demonstrativo restrito ao ambiente local. Autenticação de
            produção será disponibilizada em uma próxima etapa.
          </p>
        </div>
      </section>
    </>
  );
}
