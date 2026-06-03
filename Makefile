.PHONY: install dev be lint format docker docker-down

install:
	pnpm install

dev:
	pnpm dev

be:
	pnpm be

lint:
	pnpm lint

format:
	pnpm format

docker:
	docker compose up --build

docker-down:
	docker compose down --remove-orphans
