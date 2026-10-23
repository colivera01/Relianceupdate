export type ManagerStageAsset = {
  id?: string | null;
  createdAt?: string | null;
  uploadState?: string | null;
  audioExpected?: boolean;
  audioPresence?: string | null;
};

export type ManagerStageSession = {
  mediaAssets?: ManagerStageAsset[] | null;
} | null | undefined;

function normalizedUploadState(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

export function resolveManagerStageAssetState(session: ManagerStageSession) {
  const asset = session?.mediaAssets?.[0] || null;
  const uploadState = normalizedUploadState(asset?.uploadState);

  return {
    asset,
    uploadState,
    saved: Boolean(asset?.id) && uploadState === "SAVED",
    correctionRequested: Boolean(asset?.id) && uploadState === "REJECTED",
  };
}
