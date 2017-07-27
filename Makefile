SHELL=/bin/bash

all: local.html

watch:
	while true; do $(MAKE) local.html ; sleep 0.5; done

deploy:
	test -z "${TRAVIS}" && exit 1 || exit 0 # let travis take care of this
	@git clone -b gh-pages "https://${GH_TOKEN}@${GH_REF}" LIVE > /dev/null 2>&1 || exit 1
	$(MAKE) index.html
	cd LIVE; \
		git config user.email "ossdeploymeister@users.noreply.github.com"; \
		git config user.name "DEPLOY MEISTER"; \
		mv ../index.html ./; \
		git add .; \
		git commit --allow-empty -m "deploy: ${TRAVIS_COMMIT_MSG}"; \
		git push origin gh-pages > /dev/null 2>&1 || exit 1;

local.html: src/index.html src/main.js src/main.css Makefile
	sed -e '/INCLUDE JS/{r 3rd/node_modules/gif.js/dist/gif.js' \
		-e 'r src/main.js' -e 'd}' \
		-e '/INCLUDE WORKER JS/{r 3rd/node_modules/gif.js/dist/gif.worker.js' -e 'd}' \
		-e '/INCLUDE CSS/{r src/main.css' -e 'd}' \
		-e 's!INCLUDE GITREF!<a href="https://github.com/rwos/gifstopmotion">v'`git log --oneline | wc -l`'.0</a>!' \
		$< > $@

index.html: local.html
	3rd/node_modules/.bin/html-minifier --minify-css --minify-js --remove-comments --collapse-whitespace $< > $@

run:
	xdg-open local.html || open local.html
