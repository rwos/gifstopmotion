SHELL=/bin/bash

all: local.html build

watch:
	while true; do $(MAKE) local.html ; sleep 0.5; done

build: docs/index.html

local.html: src/index.html src/*.js src/main.css Makefile
	sed -e '/INCLUDE JS/{r 3rd/node_modules/gif.js/dist/gif.js' \
	    -e 'r 3rd/node_modules/redux/dist/redux.js' \
		-e 'r src/utils.js' \
		-e 'r src/main.js' -e 'd}' \
		-e '/INCLUDE WORKER JS/{r 3rd/node_modules/gif.js/dist/gif.worker.js' -e 'd}' \
		-e '/INCLUDE CSS/{r src/main.css' -e 'd}' \
		-e 's!INCLUDE GITREF!<a href="https://github.com/rwos/gifstopmotion">v'`git log --oneline | wc -l`'.0</a>!' \
		$< > $@

docs/index.html: local.html
	3rd/node_modules/.bin/html-minifier --minify-css --minify-js --remove-comments --collapse-whitespace $< > $@

run:
	xdg-open local.html || open local.html
