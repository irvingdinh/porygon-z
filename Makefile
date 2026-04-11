.PHONY: release

release:
	npm version patch --no-git-tag-version
	npm run build
	npm publish --access=public
