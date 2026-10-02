import type { PrismaClient } from '@orbit/db/client';
import { pino } from 'pino';
import { classifyLead, type ClassifierPort } from './classify.ts';
import { sendToScout, type SetupInputs } from './engine/bridge.ts';
import type { EnginePort } from './engine/port.ts';

const log = pino({ name: 'frontdesk-pipeline' });

export type PipelineDeps = {
  prisma: PrismaClient;
  classifier: ClassifierPort;
  engine: EnginePort;
  setup: SetupInputs;
  workspaceId: string;
};

const BATCH = 10;
const STUCK_MS = 5 * 60_000; // a lead left classifying this long lost its worker mid-flight

/**
 * Moves polled leads on: classify, then hand a lead to Scout. Every step is safe to repeat. A lead
 * that is only a "maybe" or whose classification failed rests at awaiting_verdict (FD-2): no guess, no draft.
 */
export async function advanceLeads(deps: PipelineDeps): Promise<{ advanced: number }> {
  const { prisma } = deps;
  const stuckBefore = new Date(Date.now() - STUCK_MS);
  const leads = await prisma.lead.findMany({
    where: {
      workspaceId: deps.workspaceId,
      OR: [
        { state: 'received' },
        { state: 'classifying', classification: 'lead' }, // classified, but the hand-off did not finish
        { state: 'classifying', updatedAt: { lt: stuckBefore } },
      ],
      body: { isNot: null },
    },
    include: { body: true },
    orderBy: { receivedAt: 'asc' },
    take: BATCH,
  });

  let advanced = 0;
  for (const lead of leads) {
    try {
      let verdict: 'lead' | 'not_lead' | 'unsure' | 'failed';
      if (lead.state === 'classifying' && lead.classification === 'lead') {
        verdict = 'lead';
      } else {
        // Only one caller moves a lead out of `received`; the rest see count 0 and leave it.
        if (lead.state === 'received') {
          const claim = await prisma.lead.updateMany({ where: { id: lead.id, state: 'received' }, data: { state: 'classifying' } });
          if (claim.count !== 1) continue;
        }
        verdict = await classifyLead(
          { prisma, classifier: deps.classifier, now: () => Date.now() },
          { id: lead.id, workspaceId: lead.workspaceId, cleanBody: lead.body!.cleanBody ?? lead.body!.rawBody },
        );
        await prisma.lead.update({ where: { id: lead.id }, data: { classification: verdict } });
      }
      if (verdict === 'lead') {
        await sendToScout(
          { prisma, engine: deps.engine, setup: deps.setup },
          { id: lead.id, workspaceId: lead.workspaceId, subject: lead.subject, cleanBody: lead.body!.cleanBody ?? lead.body!.rawBody },
        );
      } else {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { state: verdict === 'not_lead' ? 'not_lead' : 'awaiting_verdict' },
        });
      }
      advanced += 1;
    } catch (err) {
      // The lead stays where it is and is picked up again; one bad lead never blocks the others.
      log.error({ leadId: lead.id, errName: err instanceof Error ? err.name : typeof err }, 'pipeline: lead did not advance');
    }
  }
  return { advanced };
}
