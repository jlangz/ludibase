.PHONY: dev-frontend dev-backend install install-frontend install-backend build-frontend db-generate db-migrate db-push db-studio

dev-frontend:
	cd frontend && pnpm dev

dev-backend:
	cd backend && pnpm dev

install: install-frontend install-backend

install-frontend:
	cd frontend && pnpm install

install-backend:
	cd backend && pnpm install

build-frontend:
	cd frontend && pnpm build

db-generate:
	cd backend && pnpm db:generate

db-migrate:
	cd backend && pnpm db:migrate

db-push:
	cd backend && pnpm db:push

db-studio:
	cd backend && pnpm db:studio
