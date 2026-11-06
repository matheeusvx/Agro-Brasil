import { TracePage } from "@/components/trace-page";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TracePage key={id} id={id} />;
}
