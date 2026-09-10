import { prisma } from "../../src/server/db";
import { transitionCurrentPublicationToStandingConsent } from "../../src/lib/service-video-publication";

async function main() {
  const bookingId = String(process.argv.find((value) => value.startsWith("--booking=")) || "")
    .replace("--booking=", "")
    .trim();
  const apply = process.argv.includes("--apply");
  if (!bookingId) throw new Error("Pass one exact --booking=<id> target.");

  const current = await prisma.serviceVideoPackageVisibilityDecision.findFirst({
    where: { bookingId, isCurrent: true },
  });
  const proposal = current?.publicationProposalId
    ? await prisma.serviceVideoPublicationProposal.findUnique({ where: { id: current.publicationProposalId } })
    : null;
  const snapshot = {
    bookingId,
    customerVisibilityDecisionId: current?.id || null,
    customerDecision: current?.decision || null,
    proposalId: proposal?.id || null,
    proposalStatus: proposal?.status || null,
    proposalContractVersion: proposal?.contractVersion || null,
    proposalAuthorizationModel: proposal?.authorizationModel || null,
  };
  if (!apply) {
    console.log(JSON.stringify({ mode: "DRY_RUN", snapshot }, null, 2));
    return;
  }
  const result = await transitionCurrentPublicationToStandingConsent({ bookingId });
  console.log(JSON.stringify({
    mode: "APPLIED",
    before: snapshot,
    after: {
      previousProposalId: result.previousProposal.id,
      previousStatus: result.idempotent ? result.previousProposal.status : "SUPERSEDED",
      proposalId: result.proposal.id,
      proposalStatus: result.proposal.status,
      proposalContractVersion: result.proposal.contractVersion,
      proposalAuthorizationModel: result.proposal.authorizationModel,
      idempotent: result.idempotent,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
