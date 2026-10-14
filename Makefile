.PHONY: harness test dev harness-integration icon tap winget screenshots site

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

winget: ## abre o PR do winget para uma release publicada (VERSION=1.5.0)
	bash scripts/update-winget.sh $(VERSION)

screenshots: ## refaz as capturas do README (docs/images e docs/images/en) com o kubectl falso; só no macOS
	npm run build
	npx playwright test -c playwright.screenshots.config.ts

site: ## gera o site do GitHub Pages em _site/ com os links da versão do package.json (abra _site/index.html)
	node scripts/build-site.mjs "$$(node -p "require('./package.json').version")" wisecort/LogDeck _site
