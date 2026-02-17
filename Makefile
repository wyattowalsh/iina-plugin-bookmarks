# IINA Plugin Bookmarks Makefile
# Automates building, packaging, and development workflow

# Project Configuration
PLUGIN_NAME := iina-plugin-bookmarks
PACKAGE_DIR := packaging
BUILD_DIR := dist
PLUGIN_DIR := $(PACKAGE_DIR)/$(PLUGIN_NAME).iinaplugin
PLUGIN_ARCHIVE := $(PACKAGE_DIR)/$(PLUGIN_NAME).iinaplgz

# Build Tools
NPM := pnpm
TSC := tsc
PARCEL := npx parcel

# Colors for output
RED := \033[31m
GREEN := \033[32m
YELLOW := \033[33m
BLUE := \033[34m
MAGENTA := \033[35m
CYAN := \033[36m
RESET := \033[0m

# Default target
.PHONY: all
all: build package

# Help target
.PHONY: help
help:
	@echo "$(CYAN)IINA Plugin Bookmarks - Build System$(RESET)"
	@echo ""
	@echo "$(YELLOW)Available targets:$(RESET)"
	@echo "  $(GREEN)build$(RESET)          - Build TypeScript and UI components"
	@echo "  $(GREEN)package$(RESET)        - Create packaged .iinaplgz plugin file"
	@echo "  $(GREEN)all$(RESET)            - Build and package (default)"
	@echo "  $(GREEN)clean$(RESET)          - Remove build artifacts and packages"
	@echo "  $(GREEN)dev$(RESET)            - Start development servers for UI components"
	@echo "  $(GREEN)test$(RESET)           - Run test suite"
	@echo "  $(GREEN)test-e2e$(RESET)       - Run E2E tests with Playwright"
	@echo "  $(GREEN)test-watch$(RESET)     - Run tests in watch mode"
	@echo "  $(GREEN)lint$(RESET)           - Run ESLint"
	@echo "  $(GREEN)lint-fix$(RESET)       - Run ESLint with auto-fix"
	@echo "  $(GREEN)format$(RESET)         - Format code with Prettier"
	@echo "  $(GREEN)format-check$(RESET)   - Check code formatting"
	@echo "  $(GREEN)type-check$(RESET)     - Run TypeScript type checking"
	@echo "  $(GREEN)install$(RESET)        - Install dependencies"
	@echo "  $(GREEN)validate$(RESET)       - Validate plugin structure and configuration"
	@echo "  $(GREEN)release$(RESET)        - Clean, build, package, test, and validate"
	@echo "  $(GREEN)help$(RESET)           - Show this help message"

# Install dependencies
.PHONY: install
install:
	@echo "$(BLUE)Installing dependencies...$(RESET)"
	$(NPM) install --frozen-lockfile

# Clean build artifacts
.PHONY: clean
clean:
	@echo "$(YELLOW)Cleaning build artifacts...$(RESET)"
	rm -rf $(BUILD_DIR)
	rm -rf .parcel-cache
	rm -rf $(PLUGIN_DIR)
	rm -f $(PLUGIN_ARCHIVE)
	@echo "$(GREEN)✓ Clean complete$(RESET)"

# Build TypeScript and UI components
.PHONY: build
build:
	@echo "$(BLUE)Building plugin...$(RESET)"
	$(NPM) run build
	@echo "$(GREEN)✓ Build complete$(RESET)"

# Package the plugin into .iinaplgz format
.PHONY: package
package: build
	@echo "$(BLUE)Packaging plugin...$(RESET)"
	
	@echo "$(CYAN)  → Preparing plugin directory...$(RESET)"
	rm -rf $(PLUGIN_DIR)
	mkdir -p $(PLUGIN_DIR)
	
	@echo "$(CYAN)  → Copying build artifacts...$(RESET)"
	cp -r $(BUILD_DIR)/* $(PLUGIN_DIR)/
	cp Info.json $(PLUGIN_DIR)/
	cp LICENSE $(PLUGIN_DIR)/
	
	@echo "$(CYAN)  → Copying preferences page...$(RESET)"
	cp preferences.html $(PLUGIN_DIR)/ 2>/dev/null || true
	
	@echo "$(CYAN)  → Creating archive...$(RESET)"
	cd $(PLUGIN_DIR) && zip -r ../$(PLUGIN_NAME).iinaplgz . -x ".*"
	
	@echo "$(GREEN)✓ Package created: $(PLUGIN_ARCHIVE)$(RESET)"

# Development servers for UI components
.PHONY: dev
dev:
	@echo "$(BLUE)Starting development servers...$(RESET)"
	@echo "$(YELLOW)Press Ctrl+C to stop all servers$(RESET)"
	@echo ""
	@echo "$(CYAN)Sidebar:  http://localhost:1234$(RESET)"
	@echo "$(CYAN)Overlay:  http://localhost:1235$(RESET)" 
	@echo "$(CYAN)Window:   http://localhost:1236$(RESET)"
	@echo ""
	$(NPM) run serve-sidebar & \
	$(NPM) run serve-overlay & \
	$(NPM) run serve-window & \
	wait

# Run tests
.PHONY: test
test:
	@echo "$(BLUE)Running tests...$(RESET)"
	$(NPM) run test -- --run

# Run E2E tests
.PHONY: test-e2e
test-e2e:
	@echo "$(BLUE)Running E2E tests...$(RESET)"
	@pnpm exec playwright --version >/dev/null 2>&1 || \
		(echo "$(YELLOW)Playwright not installed. Run 'pnpm exec playwright install --with-deps webkit' first.$(RESET)" && exit 1)
	$(NPM) run test:e2e

# Run tests in watch mode
.PHONY: test-watch
test-watch:
	@echo "$(BLUE)Running tests in watch mode...$(RESET)"
	$(NPM) run test

# Lint
.PHONY: lint
lint:
	@echo "$(BLUE)Running linter...$(RESET)"
	$(NPM) run lint

# Lint with auto-fix
.PHONY: lint-fix
lint-fix:
	@echo "$(BLUE)Running linter with auto-fix...$(RESET)"
	$(NPM) run lint:fix

# Format
.PHONY: format
format:
	@echo "$(BLUE)Formatting code...$(RESET)"
	$(NPM) run format

# Format check
.PHONY: format-check
format-check:
	@echo "$(BLUE)Checking code formatting...$(RESET)"
	$(NPM) run format:check

# Type checking
.PHONY: type-check
type-check:
	@echo "$(BLUE)Running TypeScript type checking...$(RESET)"
	$(NPM) run type-check
	@echo "$(GREEN)✓ Type checking passed$(RESET)"

# Validate plugin structure
.PHONY: validate
validate:
	@echo "$(BLUE)Validating plugin structure...$(RESET)"
	
	@echo "$(CYAN)  → Checking required files...$(RESET)"
	@test -f Info.json || (echo "$(RED)✗ Info.json missing$(RESET)" && exit 1)
	@test -f LICENSE || (echo "$(RED)✗ LICENSE missing$(RESET)" && exit 1)
	@test -d $(BUILD_DIR) || (echo "$(RED)✗ Build directory missing - run 'make build' first$(RESET)" && exit 1)
	
	@echo "$(CYAN)  → Validating Info.json...$(RESET)"
	@node -e "const info = JSON.parse(require('fs').readFileSync('Info.json')); \
		if (!info.name) throw new Error('Missing name'); \
		if (!info.identifier) throw new Error('Missing identifier'); \
		if (!info.version) throw new Error('Missing version'); \
		if (!info.entry) throw new Error('Missing entry'); \
		console.log('Info.json valid');"
	
	@echo "$(CYAN)  → Checking build artifacts...$(RESET)"
	@test -f $(BUILD_DIR)/index.js || (echo "$(RED)✗ Main entry file missing (expected index.js)$(RESET)" && exit 1)
	@test -d $(BUILD_DIR)/ui || (echo "$(RED)✗ UI build directory missing$(RESET)" && exit 1)
	
	@echo "$(GREEN)✓ Plugin structure validation passed$(RESET)"

# Full release process
.PHONY: release
release: clean install lint type-check test test-e2e build package validate
	@echo ""
	@echo "$(GREEN)🎉 Release complete!$(RESET)"
	@echo "$(CYAN)Plugin package: $(PLUGIN_ARCHIVE)$(RESET)"
	@ls -lh $(PLUGIN_ARCHIVE)

# Force rebuild (ignore file timestamps)
.PHONY: rebuild
rebuild: clean build

# Quick package (assumes build is up to date)
.PHONY: quick-package
quick-package:
	@echo "$(YELLOW)Quick packaging (skipping build)...$(RESET)"
	rm -rf $(PLUGIN_DIR)
	mkdir -p $(PLUGIN_DIR)
	cp -r $(BUILD_DIR)/* $(PLUGIN_DIR)/
	cp Info.json $(PLUGIN_DIR)/
	cp LICENSE $(PLUGIN_DIR)/
	cd $(PLUGIN_DIR) && zip -r ../$(PLUGIN_NAME).iinaplgz . -x ".*"
	@echo "$(GREEN)✓ Quick package created: $(PLUGIN_ARCHIVE)$(RESET)"

# Show package information
.PHONY: info
info:
	@echo "$(CYAN)Plugin Information:$(RESET)"
	@node -e "const info = JSON.parse(require('fs').readFileSync('Info.json')); \
		console.log('Name:', info.name); \
		console.log('Version:', info.version); \
		console.log('Identifier:', info.identifier); \
		console.log('Author:', info.author.name);"
	@echo ""
	@if [ -f $(PLUGIN_ARCHIVE) ]; then \
		echo "$(CYAN)Package Information:$(RESET)"; \
		ls -lh $(PLUGIN_ARCHIVE); \
		echo ""; \
		echo "$(CYAN)Package Contents:$(RESET)"; \
		unzip -l $(PLUGIN_ARCHIVE) | head -20; \
	else \
		echo "$(YELLOW)Package not found - run 'make package' first$(RESET)"; \
	fi