import { describe, expect, it } from 'vitest';

import {
  buildSelectedTemplateServices,
  createInitialRegisterFormData,
  getRegisterFormDataForRoleSwitch,
} from './register-flow';

describe('register-flow helpers', () => {
  it('resets vendor-only registration state when switching to the customer flow', () => {
    const current = createInitialRegisterFormData();
    current.firstName = 'Rosa';
    current.lastName = 'Vendor';
    current.email = 'rosa.vendor@reliance.test';
    current.phone = '407-555-1212';
    current.address = '123 Main St';
    current.city = 'Orlando';
    current.state = 'Florida';
    current.zipCode = '32801';
    current.password = 'VendorTest1!';
    current.confirmPassword = 'VendorTest1!';
    current.businessName = 'Rosa Plumbing Co';
    current.businessType = 'Plumbing';
    current.category = 'Plumbing';
    current.businessBio = 'Family-owned plumbing team.';
    current.serviceTypes = ['Drain Cleaning'];
    current.specializations = ['Residential'];
    current.serviceAreas = ['Orlando'];

    const next = getRegisterFormDataForRoleSwitch(current, 'user');

    expect(next.firstName).toBe('Rosa');
    expect(next.email).toBe('rosa.vendor@reliance.test');
    expect(next.businessName).toBe('');
    expect(next.businessType).toBe('');
    expect(next.category).toBe('');
    expect(next.businessBio).toBe('');
    expect(next.serviceTypes).toEqual([]);
    expect(next.specializations).toEqual([]);
    expect(next.serviceAreas).toEqual([]);
  });

  it('includes rename, duration, price, and description for selected template services', () => {
    expect(
      buildSelectedTemplateServices({
        category: 'Plumbing',
        serviceTypes: ['Drain Cleaning'],
        nameOverrides: {
          'Drain Cleaning': 'Emergency Drain Cleaning',
        },
        detailDrafts: {
          'Drain Cleaning': {
            defaultDuration: '75',
            price: '149.99',
            description: 'Clear urgent drain backups and inspect the line.',
          },
        },
      })
    ).toEqual([
      {
        name: 'Emergency Drain Cleaning',
        defaultDuration: 75,
        price: 149.99,
        description: 'Clear urgent drain backups and inspect the line.',
        source: 'template',
      },
    ]);
  });

  it('falls back to configured template duration when the vendor leaves duration blank', () => {
    expect(
      buildSelectedTemplateServices({
        category: 'Barber',
        serviceTypes: ['Haircut'],
        nameOverrides: {},
        detailDrafts: {
          Haircut: {
            defaultDuration: '',
            price: '',
            description: '',
          },
        },
      })
    ).toEqual([
      {
        name: 'Haircut',
        defaultDuration: 30,
        price: undefined,
        description: undefined,
        source: 'template',
      },
    ]);
  });
});
