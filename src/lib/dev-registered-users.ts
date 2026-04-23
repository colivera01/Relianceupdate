// In-memory dev users (in production, replace with database)
export const registeredUsers: any[] = [
  /** Browser E2E smoke (`e2e/booking-smoke.spec.ts`); Prisma row must exist with the same `id` (see `e2e/global-setup.ts`). */
  {
    id: "e2e-smoke-customer",
    firstName: "E2E",
    lastName: "Smoke",
    email: "e2e-smoke-customer@reliance.test",
    password: "E2E_Smoke_dev_only_9!",
    userType: "customer",
    address: "1 Smoke Test Lane",
    city: "Orlando",
    state: "FL",
    zipCode: "32801",
    bio: "",
    createdAt: new Date().toISOString(),
    isActive: true,
  },
  {
    // Must match Prisma `users.id` for this email so vendor APIs work after login
    // (including dev sessions created while the DB was briefly unreachable).
    id: "D43B6BB3-1A72-45EC-A362-A6E1E0580EA0",
    firstName: "Cesar",
    lastName: "Olivera",
    email: "colivera080124@gmail.com",
    password: "Co080124!",
    userType: "customer",
    address: "407 Boxwood Circle",
    city: "Winter Springs",
    state: "Florida",
    zipCode: "32824",
    bio: "test test",
    createdAt: new Date().toISOString(),
    isActive: true,
  },
  {
    id: "test-vendor-1",
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@sparkleclean.com",
    password: "vendor123!",
    userType: "vendor",
    address: "123 Business Ave",
    city: "Orlando",
    state: "Florida",
    zipCode: "32801",
    bio: "Professional cleaning services",
    businessName: "Sparkle Clean Pro",
    businessType: "Cleaning Services",
    category: "Home Cleaners",
    businessBio: "Professional cleaning services for homes and offices",
    foundedYear: "2020",
    licenseNumber: "FL-CLEAN-12345",
    insuranceStatus: "Insured",
    bondingStatus: "Bonded",
    totalEmployees: "5",
    yearsInBusiness: "4",
    serviceTypes:
      "Residential Cleaning, Commercial Cleaning, Deep Cleaning",
    specializations:
      "Eco-friendly cleaning, Move-in/out cleaning, Post-construction cleaning",
    serviceAreas: "Orlando, Winter Park, Maitland, Winter Springs",
    website: "https://sparklecleanpro.com",
    emergencyContact: "407-555-0123",
    responseTime: "2 hours",
    profileImage: "",
    isActive: true,
    isVerified: true,
    isApproved: true,
    approvalStatus: "Approved",
    rating: 4.8,
    totalReviews: 127,
    totalBookings: 89,
    totalEarnings: 15420,
    createdAt: new Date().toISOString(),
  },
];

export function addRegisteredUser(userData: any) {
  registeredUsers.push(userData);
  console.log("User added to storage:", { ...userData, password: "[HIDDEN]" });
}
