all: build

build: index.html

index.html: src/index.html src/main.js 3rd/gifjs
	mkdir -p www
	sed -e '/<JSHEREPLZ>/{r 3rd/gifjs/dist/gif.js' \
		-e 'r src/main.js' -e 'd}' \
		-e '/<WORKERJSHEREPLZ>/{r 3rd/gifjs/dist/gif.worker.js' -e 'd}' \
		$< > $@

3rd/gifjs:
	git clone git@github.com:jnordberg/gif.js.git $@
	# yes
	echo ';' >> 3rd/gifjs/dist/gif.worker.js
	echo ';' >> 3rd/gifjs/dist/gif.js

run:
	xdg-open localhost:8000 || open localhost:8000
	php -S localhost:8000 -t ./
