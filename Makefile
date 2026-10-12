.PHONY: harness test dev harness-integration

harness: ## pipeline completo, igual ao CI
	bash scripts/harness.sh

test: ## testes unitários e de integração (kubectl fake)
	npm run test:unit
	npm run test:integration

dev: ## abre o app em modo desenvolvimento
	npm run dev

harness-integration: ## testes contra cluster kind local (manual, nunca no CI)
	bash scripts/harness-integration.sh
