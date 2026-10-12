.PHONY: harness test dev harness-integration icon tap

harness: ## pipeline completo, igual ao CI
	bash scripts/harness.sh

test: ## testes unitários e de integração (kubectl fake)
	npm run test:unit
	npm run test:integration

dev: ## abre o app em modo desenvolvimento
	npm run dev

harness-integration: ## testes contra cluster kind local (manual, nunca no CI)
	bash scripts/harness-integration.sh

icon: ## gera build/icon.png e build/icon.icns a partir do SVG (ICON=build/icon-src/a-deck.svg)
	bash scripts/build-icon.sh $(or $(ICON),build/icon-src/a-deck.svg)

tap: ## aponta o cask do Homebrew para uma release publicada (VERSION=1.2.0)
	bash scripts/update-tap.sh $(VERSION)
