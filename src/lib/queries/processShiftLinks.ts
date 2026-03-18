import { prisma } from '@/lib/db/client'

export interface ProcessShiftLinkRow {
  processId: string
  shiftTemplateId: string
  processName: string
  shiftName: string
}

export async function getProcessShiftLinks(organizationId: string): Promise<ProcessShiftLinkRow[]> {
  const links = await prisma.processShiftLink.findMany({
    where: { organizationId },
    include: {
      process: { select: { name: true } },
      shiftTemplate: { select: { name: true } },
    },
  })
  return links.map((l) => ({
    processId: l.processId,
    shiftTemplateId: l.shiftTemplateId,
    processName: l.process.name,
    shiftName: l.shiftTemplate.name,
  }))
}

export async function setProcessShiftLink(
  organizationId: string,
  processId: string,
  shiftTemplateId: string,
): Promise<void> {
  await prisma.processShiftLink.upsert({
    where: {
      organizationId_processId_shiftTemplateId: {
        organizationId,
        processId,
        shiftTemplateId,
      },
    },
    create: { organizationId, processId, shiftTemplateId },
    update: {},
  })
}

export async function removeProcessShiftLink(
  organizationId: string,
  processId: string,
  shiftTemplateId: string,
): Promise<void> {
  await prisma.processShiftLink.deleteMany({
    where: { organizationId, processId, shiftTemplateId },
  })
}
