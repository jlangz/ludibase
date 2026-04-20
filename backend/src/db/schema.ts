import { pgTable, uuid, text, timestamp, serial, integer, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  username: text('username').unique(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  platforms: jsonb('platforms').$type<string[]>(),
  subscriptions: jsonb('subscriptions').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  igdbId: integer('igdb_id').unique().notNull(),
  title: text('title').notNull(),
  slug: text('slug'),
  summary: text('summary'),
  coverImageId: text('cover_image_id'),
  firstReleaseDate: timestamp('first_release_date', { withTimezone: true }),
  platforms: jsonb('platforms').$type<string[]>(),
  genres: jsonb('genres').$type<string[]>(),
  category: integer('category'),
  developer: text('developer'),
  publisher: text('publisher'),
  aggregatedRating: integer('aggregated_rating'),
  ratingCount: integer('rating_count'),
  igdbUrl: text('igdb_url'),
  igdbUpdatedAt: integer('igdb_updated_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const gameSubscriptions = pgTable('game_subscriptions', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id').notNull().references(() => games.id),
  serviceSlug: text('service_slug').notNull(),
  source: text('source').notNull(),
  externalId: text('external_id'),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  removedAt: timestamp('removed_at', { withTimezone: true }),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('game_service_active_idx')
    .on(table.gameId, table.serviceSlug)
    .where(sql`${table.removedAt} IS NULL`),
  index('game_subscriptions_game_id_idx').on(table.gameId),
  index('game_subscriptions_service_slug_idx').on(table.serviceSlug),
])

export const subscriptionSyncRuns = pgTable('subscription_sync_runs', {
  id: serial('id').primaryKey(),
  source: text('source').notNull(),
  status: text('status').notNull(),
  totalChecked: integer('total_checked').default(0).notNull(),
  totalAdded: integer('total_added').default(0).notNull(),
  totalRemoved: integer('total_removed').default(0).notNull(),
  totalUnchanged: integer('total_unchanged').default(0).notNull(),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

export const steamConnections = pgTable('steam_connections', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => profiles.id).unique(),
  steamId: text('steam_id').notNull().unique(),
  steamUsername: text('steam_username'),
  steamAvatarUrl: text('steam_avatar_url'),
  connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
  lastImportAt: timestamp('last_import_at', { withTimezone: true }),
})

export const userGameCollection = pgTable('user_game_collection', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  gameId: integer('game_id').notNull().references(() => games.id),
  source: text('source').notNull(),
  ownedPlatforms: jsonb('owned_platforms').$type<string[]>(),
  storefronts: jsonb('storefronts').$type<string[]>(),
  steamAppId: integer('steam_app_id'),
  steamPlaytimeMinutes: integer('steam_playtime_minutes'),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('user_game_collection_user_game_idx').on(table.userId, table.gameId),
  index('user_game_collection_user_id_idx').on(table.userId),
])

export const savedArticles = pgTable('saved_articles', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  articleUrl: text('article_url').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  source: text('source').notNull(),
  pubDate: timestamp('pub_date', { withTimezone: true }),
  savedAt: timestamp('saved_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('saved_articles_user_url_idx').on(table.userId, table.articleUrl),
  index('saved_articles_user_id_idx').on(table.userId),
])

export const gameStoreIds = pgTable('game_store_ids', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id').notNull().references(() => games.id),
  store: text('store').notNull(),
  storeId: text('store_id').notNull(),
}, (table) => [
  uniqueIndex('game_store_ids_game_store_idx').on(table.gameId, table.store),
  index('game_store_ids_store_idx').on(table.store),
])

export const importRuns = pgTable('import_runs', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  totalFetched: integer('total_fetched').default(0).notNull(),
  totalInserted: integer('total_inserted').default(0).notNull(),
  totalUpdated: integer('total_updated').default(0).notNull(),
  totalSkipped: integer('total_skipped').default(0).notNull(),
  lastOffset: integer('last_offset').default(0).notNull(),
  filterQuery: text('filter_query'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})
