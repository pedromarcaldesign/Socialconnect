// Espelho de db/migrations/*.sql para consultas tipadas. As migrações SQL são a fonte de verdade.
import {
  pgTable, uuid, text, timestamp, integer, bigint, boolean, jsonb, smallint, primaryKey,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type WorkspaceRole = "owner" | "admin" | "member";

export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: uuid("workspace_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: text("role").$type<WorkspaceRole>().notNull().default("member"),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })]);

export const workspaceInvites = pgTable("workspace_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  email: text("email").notNull(),
  role: text("role").$type<"admin" | "member">().notNull().default("member"),
  invitedBy: uuid("invited_by"),
  acceptedAt: ts("accepted_at"),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
});

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  name: text("name").notNull(),
  logoKey: text("logo_key"),
  color: text("color"),
  timezone: text("timezone").notNull().default("Europe/Lisbon"),
  website: text("website"),
  description: text("description"),
  location: text("location"),
  amenities: text("amenities").array().notNull().default([]),
  archivedAt: ts("archived_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const brandVoices = pgTable("brand_voices", {
  brandId: uuid("brand_id").primaryKey(),
  tone: text("tone").notNull().default("profissional e acolhedor"),
  audience: text("audience"),
  languages: text("languages").array().notNull().default(["pt-PT"]),
  keywords: text("keywords").array().notNull().default([]),
  dos: text("dos").array().notNull().default([]),
  donts: text("donts").array().notNull().default([]),
  examplePosts: text("example_posts").array().notNull().default([]),
  updatedAt: updatedAt(),
});

export type Network = "facebook" | "instagram";
export type AccountStatus = "active" | "needs_reconnect" | "removed";

export const socialAccounts = pgTable("social_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  brandId: uuid("brand_id"),
  network: text("network").$type<Network>().notNull(),
  externalId: text("external_id").notNull(),
  username: text("username"),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  pageExternalId: text("page_external_id"),
  status: text("status").$type<AccountStatus>().notNull().default("active"),
  lastError: text("last_error"),
  lastCheckedAt: ts("last_checked_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const socialAccountSecrets = pgTable("social_account_secrets", {
  socialAccountId: uuid("social_account_id").primaryKey(),
  accessTokenEnc: text("access_token_enc").notNull(),
  updatedAt: updatedAt(),
});

export type MediaStatus = "processing" | "ready" | "failed";
export type MediaAnalysis = { mood?: string; setting?: string; subjects?: string[]; suggestions?: string[] };

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  kind: text("kind").$type<"image" | "video">().notNull(),
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  width: integer("width"),
  height: integer("height"),
  thumbKey: text("thumb_key"),
  originalFilename: text("original_filename"),
  source: text("source").$type<"upload" | "ai">().notNull().default("upload"),
  status: text("status").$type<MediaStatus>().notNull().default("processing"),
  error: text("error"),
  description: text("description"),
  tags: text("tags").array().notNull().default([]),
  analysis: jsonb("analysis").$type<MediaAnalysis>(),
  uploadedBy: uuid("uploaded_by"),
  deletedAt: ts("deleted_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type RenditionPreset = "square" | "portrait" | "landscape" | "story" | "original";

export const mediaRenditions = pgTable("media_renditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  mediaAssetId: uuid("media_asset_id").notNull(),
  preset: text("preset").$type<RenditionPreset>().notNull(),
  storageKey: text("storage_key").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: createdAt(),
});

export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed" | "cancelled";
export type PostAspect = "square" | "portrait" | "landscape";

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  baseText: text("base_text").notNull().default(""),
  aspect: text("aspect").$type<PostAspect>().notNull().default("portrait"),
  status: text("status").$type<PostStatus>().notNull().default("draft"),
  scheduledAt: ts("scheduled_at"),
  scheduleVersion: integer("schedule_version").notNull().default(0),
  generationMode: text("generation_mode").$type<"manual" | "idea" | "batch">(),
  idea: text("idea"),
  createdBy: uuid("created_by"),
  publishedAt: ts("published_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type TargetFormat = "feed" | "carousel" | "story" | "reel";
export type TargetStatus = "pending" | "publishing" | "published" | "failed" | "skipped";

export const postTargets = pgTable("post_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull(),
  socialAccountId: uuid("social_account_id").notNull(),
  format: text("format").$type<TargetFormat>().notNull(),
  textOverride: text("text_override"),
  firstComment: text("first_comment"),
  status: text("status").$type<TargetStatus>().notNull().default("pending"),
  containerId: text("container_id"),
  externalPostId: text("external_post_id"),
  externalUrl: text("external_url"),
  errorMessage: text("error_message"),
  attempts: integer("attempts").notNull().default(0),
  publishedAt: ts("published_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const postMedia = pgTable("post_media", {
  postId: uuid("post_id").notNull(),
  position: smallint("position").notNull(),
  mediaAssetId: uuid("media_asset_id").notNull(),
}, (t) => [primaryKey({ columns: [t.postId, t.position] })]);

export const publishAttempts = pgTable("publish_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  postTargetId: uuid("post_target_id").notNull(),
  step: text("step").notNull(),
  ok: boolean("ok").notNull(),
  httpStatus: integer("http_status"),
  detail: jsonb("detail"),
  createdAt: createdAt(),
});

export const aiGenerations = pgTable("ai_generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  brandId: uuid("brand_id"),
  userId: uuid("user_id"),
  kind: text("kind").$type<"caption" | "analysis" | "translation" | "brand_profile" | "rewrite">().notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  ok: boolean("ok").notNull().default(true),
  createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  userId: uuid("user_id"),
  kind: text("kind").$type<"publish_failed" | "publish_partial" | "account_needs_reconnect">().notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  readAt: ts("read_at"),
  createdAt: createdAt(),
});

export type Brand = typeof brands.$inferSelect;
export type BrandVoice = typeof brandVoices.$inferSelect;
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostTarget = typeof postTargets.$inferSelect;
