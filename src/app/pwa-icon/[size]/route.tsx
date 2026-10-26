import { renderAppIcon } from "@/lib/app-icon";

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  return renderAppIcon(size === "192" ? 192 : 512);
}
