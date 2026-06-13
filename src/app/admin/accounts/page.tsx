import { AdminAccountsConsole } from '@/components/admin/AdminAccountsConsole';
import { countableUserWhere, countableVendorWhere } from '@/lib/metrics-exclusion';
import { prisma } from '@/server/db';

const USER_RESTRICTED_STATUSES = ['suspended', 'banned', 'deactivated', 'archived_inactive'] as const;
const VENDOR_RESTRICTED_STATUSES = [
  'suspended',
  'banned',
  'deactivated',
  'archived_inactive',
  'pending_approval',
] as const;

export default async function AdminAccountsPage() {
  const [
    customers,
    vendors,
    pendingVerification,
    pendingVendorApproval,
    restrictedCustomers,
    restrictedVendors,
  ] = await Promise.all([
    prisma.user.count({ where: countableUserWhere() }),
    prisma.vendor.count({ where: countableVendorWhere() }),
    prisma.user.count({
      where: countableUserWhere({
        OR: [
          { authCredential: { is: null } },
          { authCredential: { is: { emailVerifiedAt: null } } },
        ],
      }),
    }),
    prisma.vendor.count({
      where: countableVendorWhere({
        accountStatus: 'pending_approval',
      }),
    }),
    prisma.user.count({
      where: countableUserWhere({
        accountStatus: {
          in: [...USER_RESTRICTED_STATUSES],
        },
      }),
    }),
    prisma.vendor.count({
      where: countableVendorWhere({
        accountStatus: {
          in: [...VENDOR_RESTRICTED_STATUSES],
        },
      }),
    }),
  ]);

  return (
    <AdminAccountsConsole
      summary={{
        customers,
        vendors,
        restricted: restrictedCustomers + restrictedVendors,
        pendingVerification,
        pendingVendorApproval,
      }}
    />
  );
}
