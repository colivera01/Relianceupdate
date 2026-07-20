import { describe, expect, it } from 'vitest';
import {
  countVendorServicesByWorkflow,
  filterVendorServicesByWorkflow,
  getVendorServiceWorkflowBucket,
} from './vendor-service-workflow';

const services = [
  { id: 'published-1', lifecycleStatus: 'active' as const, isPublished: true },
  { id: 'published-2', lifecycleStatus: 'active' as const, isPublished: true },
  { id: 'pending-1', lifecycleStatus: 'pending_approval' as const, isPublished: false },
  { id: 'archived-1', lifecycleStatus: 'archived' as const, isPublished: false },
];

describe('vendor service workflow tabs', () => {
  it('maps each service to its displayed workflow stage', () => {
    expect(getVendorServiceWorkflowBucket(services[0])).toBe('published');
    expect(getVendorServiceWorkflowBucket(services[2])).toBe('pending_approval');
    expect(getVendorServiceWorkflowBucket(services[3])).toBe('archived');
  });

  it('keeps archived services out of the All tab', () => {
    expect(filterVendorServicesByWorkflow(services, 'all').map((service) => service.id)).toEqual([
      'published-1',
      'published-2',
      'pending-1',
    ]);
    expect(filterVendorServicesByWorkflow(services, 'archived').map((service) => service.id)).toEqual([
      'archived-1',
    ]);
  });

  it('reports accurate counts for every tab', () => {
    expect(countVendorServicesByWorkflow(services)).toEqual({
      all: 3,
      published: 2,
      pending_approval: 1,
      archived: 1,
    });
  });
});
