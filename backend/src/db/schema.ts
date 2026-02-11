import { pgTable, uuid, text, timestamp, serial, integer, jsonb } from 'drizzle-orm/pg-core'

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
