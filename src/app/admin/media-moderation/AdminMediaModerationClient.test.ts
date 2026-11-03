import { describe, expect, it } from 'vitest';

import { normalizeQueuePackage } from './AdminMediaModerationClient';

describe('AdminMediaModerationClient queue normalization', () => {
  it('preserves audio evidence and recording scope returned by a client refresh', () => {
    const normalized = normalizeQueuePackage({
      packageId: 'package-1',
      bookingId: 'booking-1',
      jobTitle: 'Outlet Installation',
      bookingStatus: 'COMPLETED',
      vendorId: 'vendor-1',
      vendorName: 'Electro LLC',
      clientName: 'Reliance Test Approval Required',
      serviceName: 'Outlet Installation',
      createdAt: '2026-11-03T18:42:24.264Z',
      uploadedByMembershipIds: ['membership-1'],
      moderationStatuses: ['pending_review'],
      visibilityStatuses: ['private'],
      packageReadiness: 'READY_FOR_ADMIN_REVIEW',
      packageVersion: 2,
      managerSubmitterName: 'Electro LLC Manager',
      managerSubmittedAt: '2026-11-03T18:42:24.264Z',
      managerAttestationHash: 'attestation-hash',
      audioAudit: {
        expected: false,
        conformance: 'CONFORMING',
        stages: [
          { stage: 'INTRO', expected: false, presence: 'ABSENT', evidenceVersion: 2 },
          { stage: 'IN_PROGRESS', expected: false, presence: 'ABSENT', evidenceVersion: 2 },
          { stage: 'COMPLETED', expected: false, presence: 'ABSENT', evidenceVersion: 2 },
        ],
      },
      recordingScope: {
        contractVersion: 'recording-assessment-v3-simplified-work-scope-v2',
        siteControl: 'customer_controlled_residence',
        intentionalParticipantPlan: 'customer_and_assigned_service_professional',
        recordingBoundary: 'service_area_equipment_item_and_work',
        prohibitedConditions: ['minors', 'credentials_access_codes_keys_or_security_information'],
      },
      videosByStage: {
        INTRO: {
          assetId: 'asset-intro',
          vendorJobVideoStageKey: 'INTRO',
          vendorJobVideoStageLabel: 'Starting Condition',
          audioExpected: false,
          audioPresence: 'ABSENT',
          audioTrackCount: 0,
          audioCodec: null,
          audioEvidenceVersion: 2,
        },
        IN_PROGRESS: null,
        COMPLETED: null,
      },
    });

    expect(normalized.audioAudit).toEqual({
      expected: false,
      conformance: 'CONFORMING',
      stages: [
        { stage: 'INTRO', expected: false, presence: 'ABSENT', evidenceVersion: 2 },
        { stage: 'IN_PROGRESS', expected: false, presence: 'ABSENT', evidenceVersion: 2 },
        { stage: 'COMPLETED', expected: false, presence: 'ABSENT', evidenceVersion: 2 },
      ],
    });
    expect(normalized.recordingScope).toMatchObject({
      siteControl: 'customer_controlled_residence',
      intentionalParticipantPlan: 'customer_and_assigned_service_professional',
    });
    expect(normalized.videosByStage.INTRO).toMatchObject({
      audioExpected: false,
      audioPresence: 'ABSENT',
      audioTrackCount: 0,
      audioCodec: null,
      audioEvidenceVersion: 2,
    });
  });
});
