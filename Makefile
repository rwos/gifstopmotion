all: build

build: index.html

watch:
	while true; do $(MAKE) build ; sleep 0.5; done

deploy:
	test -z "${TRAVIS}" && exit 1 || exit 0 # let travis take care of this
	@git clone -b gh-pages "https://${GH_TOKEN}@${GH_REF}" LIVE > /dev/null 2>&1 || exit 1
	cd LIVE; \
		git config user.email "ossdeploymeister@users.noreply.github.com"; \
		git config user.name "DEPLOY MEISTER"; \
		git pull origin master; \
		git push origin gh-pages > /dev/null 2>&1 || exit 1;

index.html: src/index.html src/main.js src/main.css 3rd/gifjs 3rd/htmlminifier
	mkdir -p www
	sed -e '/INCLUDE JS/{r 3rd/gifjs/dist/gif.js' \
		-e 'r src/main.js' -e 'd}' \
		-e '/INCLUDE WORKER JS/{r 3rd/gifjs/dist/gif.worker.js' -e 'd}' \
		-e '/INCLUDE CSS/{r src/main.css' -e 'd}' \
		$< > $@
	3rd/htmlminifier/cli.js --minify-css --minify-js --remove-comments --collapse-whitespace $@ > tmp.js
	mv tmp.js $@

3rd/gifjs:
	git clone git@github.com:jnordberg/gif.js.git $@
	# yes
	echo ';' >> 3rd/gifjs/dist/gif.worker.js
	echo ';' >> 3rd/gifjs/dist/gif.js

3rd/htmlminifier:
	git clone git@github.com:kangax/html-minifier.git $@
	cd $@ && npm install

run:
	xdg-open localhost:8000 || open localhost:8000
	php -S localhost:8000 -t ./
