import { pgTable, uuid, text, timestamp, serial, integer, jsonb } from 'drizzle-orm/pg-core'

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  username: text('username').unique(),
  displayName: text('display_name'),
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
  summary: text('summary'),
  coverImageId: text('cover_image_id'),
  firstReleaseDate: timestamp('first_release_date', { withTimezone: true }),
  platforms: jsonb('platforms').$type<string[]>(),
  genres: jsonb('genres').$type<string[]>(),
  igdbUrl: text('igdb_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
