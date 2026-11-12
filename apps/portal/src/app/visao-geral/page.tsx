"use client";
import { Overview } from "@/components/overview";
import { OrganizationHomeView } from "@/components/organization-home";
import { usePortal } from "@/components/portal-provider";
export default function Page() {
  const { audience } = usePortal();
  return audience === "producer" ? <Overview /> : <OrganizationHomeView />;
}
