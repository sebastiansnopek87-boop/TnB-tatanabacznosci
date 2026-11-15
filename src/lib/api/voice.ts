// Backend call layer for guest stories, Instagram, and the dedicated YouTube Edge Function.
export {
  storySchema,
  submitVoiceStory,
  adminListSubmissions,
  adminUpdateSubmission,
  listInstagram,
  adminGetInstagram,
  adminCheckInstagramConfig,
  adminStartInstagramConnect,
  adminSyncInstagram,
  adminDisconnectInstagram,
  adminSaveInstagramOptions,
} from "@/lib/voice.functions";
export type { PublicReel } from "@/lib/voice.functions";

export {
  listVideos,
  getPublicChannel,
  adminGetYoutubeSource,
  adminSaveYoutubeKey,
  adminTestYoutubeKey,
  adminSaveYoutubeSource,
  adminSyncYoutube,
  adminSyncIfStale,
  adminListVideos,
  adminSetVideoStatus,
  adminUpdateVideo,
  adminAddManualVideo,
} from "@/lib/api/youtube";
export type {
  PublicVideo,
  AdminVideo,
  YoutubeSource,
  YoutubeSyncResult,
  AdminVideoUpdate,
  AdminManualVideoInput,
} from "@/lib/api/youtube";
