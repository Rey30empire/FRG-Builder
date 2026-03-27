import { PublicProposalPortal } from "@/components/proposals/PublicProposalPortal";

export const dynamic = "force-dynamic";

export default async function ProposalPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicProposalPortal token={token} />;
}
