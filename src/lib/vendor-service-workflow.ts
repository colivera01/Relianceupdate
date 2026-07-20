export type VendorServiceWorkflowBucket = 'published' | 'pending_approval' | 'archived';
export type VendorServiceWorkflowFilter = 'all' | VendorServiceWorkflowBucket;

export type VendorServiceWorkflowItem = {
  lifecycleStatus: 'active' | 'pending_approval' | 'archived';
  isPublished: boolean;
};

export const VENDOR_SERVICE_WORKFLOW_TABS: ReadonlyArray<{
  value: VendorServiceWorkflowFilter;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'pending_approval', label: 'Pending Admin Review' },
  { value: 'archived', label: 'Archived' },
];

export function getVendorServiceWorkflowBucket(
  service: VendorServiceWorkflowItem
): VendorServiceWorkflowBucket {
  if (service.lifecycleStatus === 'archived') return 'archived';
  if (service.lifecycleStatus === 'active' || service.isPublished) return 'published';
  return 'pending_approval';
}

export function countVendorServicesByWorkflow(services: VendorServiceWorkflowItem[]) {
  return services.reduce(
    (counts, service) => {
      const bucket = getVendorServiceWorkflowBucket(service);
      counts[bucket] += 1;
      if (bucket !== 'archived') counts.all += 1;
      return counts;
    },
    { all: 0, published: 0, pending_approval: 0, archived: 0 }
  );
}

export function filterVendorServicesByWorkflow<T extends VendorServiceWorkflowItem>(
  services: T[],
  filter: VendorServiceWorkflowFilter
) {
  return services.filter((service) => {
    const bucket = getVendorServiceWorkflowBucket(service);
    return filter === 'all' ? bucket !== 'archived' : bucket === filter;
  });
}
