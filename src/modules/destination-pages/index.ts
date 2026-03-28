// GioHomeStudio — Destination Pages Module

import { prisma } from "@/lib/prisma";
import type { DestinationPage, PagePlatform } from "@/types/content";

export async function listDestinationPages(): Promise<DestinationPage[]> {
  const pages = await prisma.destinationPage.findMany({
    orderBy: { createdAt: "asc" },
  });
  return pages as DestinationPage[];
}

export async function getDestinationPage(id: string): Promise<DestinationPage | null> {
  const page = await prisma.destinationPage.findUnique({ where: { id } });
  return page as DestinationPage | null;
}

export async function createDestinationPage(data: {
  name: string;
  platform: PagePlatform;
  handle?: string;
  notes?: string;
}): Promise<DestinationPage> {
  const page = await prisma.destinationPage.create({ data });
  return page as DestinationPage;
}

export async function updateDestinationPage(
  id: string,
  data: Partial<{
    name: string;
    platform: PagePlatform;
    handle: string;
    notes: string;
    isActive: boolean;
  }>
): Promise<DestinationPage> {
  const page = await prisma.destinationPage.update({ where: { id }, data });
  return page as DestinationPage;
}

export async function deleteDestinationPage(id: string): Promise<void> {
  await prisma.destinationPage.delete({ where: { id } });
}
