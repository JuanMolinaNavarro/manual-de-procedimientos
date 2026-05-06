import { prisma } from '@/lib/prisma';

export interface Plan {
  name: string;
  subtitle: string;
  price: number;
  highlighted: boolean;
  badge: string | null;
}

export interface PlanConfigData {
  plans: Plan[];
  tvAddonPrice: number;
}

const DEFAULT_PLANS: Plan[] = [
  { name: 'Fibra 100 MB', subtitle: 'Solo internet', price: 12999, highlighted: false, badge: null },
  { name: 'Fibra 200 MB', subtitle: 'Solo internet', price: 14999, highlighted: false, badge: null },
  { name: 'Fibra 300 MB', subtitle: 'Solo internet', price: 16999, highlighted: true,  badge: '¡El más elegido!' },
];
const DEFAULT_TV_ADDON = 18000;

export async function getPlanConfig(empresa: string): Promise<PlanConfigData> {
  const record = await prisma.planConfig.findUnique({ where: { empresa } });
  if (!record) return { plans: DEFAULT_PLANS, tvAddonPrice: DEFAULT_TV_ADDON };
  return { plans: record.plans as unknown as Plan[], tvAddonPrice: record.tv_addon_price };
}

export async function upsertPlanConfig(empresa: string, data: PlanConfigData): Promise<PlanConfigData> {
  const plansJson = data.plans as unknown as Parameters<typeof prisma.planConfig.create>[0]['data']['plans'];
  const record = await prisma.planConfig.upsert({
    where: { empresa },
    create: { empresa, plans: plansJson, tv_addon_price: data.tvAddonPrice },
    update: { plans: plansJson, tv_addon_price: data.tvAddonPrice },
  });
  return { plans: record.plans as unknown as Plan[], tvAddonPrice: record.tv_addon_price };
}
