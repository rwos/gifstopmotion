/*
    Copyright 2015 by Richard Wossal <richard@r-wos.org>

    Permission to use, copy, modify, distribute, and sell this software
    and its documentation for any purpose is hereby granted without fee,
    provided that the above copyright notice appear in all copies and
    that both that copyright notice and this permission notice appear in
    supporting documentation.  No representations are made about the
    suitability of this software for any purpose.  It is provided "as
    is" without express or implied warranty.

    Some of this is from an MDN article (code in the public domain)
    <https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Taking_still_photos>
*/
(function() {
    var width = 320;
    var height = 0;
    var streaming = false;

    var video = null;
    var canvas = null;
    var lastframe = null;
    var preview = null;
    var text = null;
    var framecontainer = null;
    var greenscreen = null;

    var workerblob = new Blob([document.getElementById('workerscript').textContent], {type: 'text/javascript'});

    var gif = new GIF({
        quality: 10,
        workers: 2,
        workerScript: URL.createObjectURL(workerblob),
        transparent: 0x000000,
    });

    var delay = 200;

    function init() {
        video = document.getElementById('viewfinder');
        canvas = document.getElementById('tmp');
        lastframe = document.getElementById('lastframe');
        preview = document.getElementById('preview');
        text = document.getElementById('text');
        framecontainer = document.getElementById('framecontainer');
        document.getElementById('clear').addEventListener('click', function(ev) {
            clear();
            ev.preventDefault();
        });
        document.getElementById('greenscreen').addEventListener('click', function(ev) {
            updategreenscreen();
            document.getElementById('greenscreen').className = 'disabled';
            ev.preventDefault();
        });
        document.getElementById('save').addEventListener('click', function(ev) {
            download();
            ev.preventDefault();
        });
        document.getElementById('delay').addEventListener('change', function(ev) {
            // XXX: this should reencode the whole thing with that delay
            delay = parseInt(ev.target.value, 10);
        });

        navigator.getMedia = (navigator.getUserMedia
                           || navigator.webkitGetUserMedia
                           || navigator.mozGetUserMedia
                           || navigator.msGetUserMedia);
        navigator.getMedia({video: true, audio: false}, function(stream) {
            if (navigator.mozGetUserMedia) {
                video.mozSrcObject = stream;
            } else {
                var vendorURL = window.URL || window.webkitURL;
                video.src = vendorURL.createObjectURL(stream);
            }
            video.play();
        }, console.log);

        video.addEventListener('canplay', function(ev) {
            if (streaming) {
                return;
            }
            height = video.videoHeight / (video.videoWidth/width);
            if (isNaN(height)) { // FF bug, apparently
                height = width / (4/3);
            }
            canvas.setAttribute('width', width);
            canvas.setAttribute('height', height);
            lastframe.setAttribute('width', width);
            lastframe.setAttribute('height', height);
            preview.setAttribute('height', height);
            streaming = true;
        }, false);

        document.body.addEventListener('keydown', function(ev) {
            if (ev.target.nodeName === 'TEXTAREA') {
                return; // ignore
            }
            if (ev.charCode === 32 || ev.keyCode === 32) {
                addframe();
                console.log("preventdefault");
                ev.preventDefault();
            }
        }, false);
    }

    function clonecanvas(oldcanvas) {
        var newcanvas = document.createElement('canvas');
        var context = newcanvas.getContext('2d');
        newcanvas.width = oldcanvas.width;
        newcanvas.height = oldcanvas.height;
        context.drawImage(oldcanvas, 0, 0);
        return newcanvas;
    }

    // main stuff

    function clear() {
        // XXX only method that seemed to work
        document.location = document.location;
    }

    function download() {
        var a = document.createElement('a');
        a.setAttribute('download', 'gif.gif');
        a.href = preview.src;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
    }

    function updategreenscreen() {
        if (greenscreen) {
            return;
        }
        var context = canvas.getContext('2d');
        if (width && height) {
            canvas.width = width;
            canvas.height = height;
            context.drawImage(video, 0, 0, width, height);
            greenscreen = clonecanvas(canvas);
        }
    }

    function addframe() {
        document.getElementById('save').className = ''; // enable button

        var context = canvas.getContext('2d');
        if (width && height) {
            canvas.width = width;
            canvas.height = height;

            // prepare frame
            context.drawImage(video, 0, 0, width, height);
            // remove background
            if (greenscreen) {
                /// XXX DEBUG
                var img = document.createElement('img');
                img.setAttribute('src', greenscreen.toDataURL('image/png'));
                img.setAttribute('class', 'frame');
                document.body.appendChild(img);
                /// XXX
                context.globalCompositeOperation = 'difference'; /// XXX this is too simplistic
                context.drawImage(greenscreen, 0, 0, width, height);
                /// XXX DEBUG
                var img = document.createElement('img');
                img.setAttribute('src', canvas.toDataURL('image/png'));
                img.setAttribute('class', 'frame');
                document.body.appendChild(img);
                /// XXX
                context.globalCompositeOperation = 'source-over';
                var map = context.getImageData(0, 0, width, height);
                var l = map.data.length / 4;
                for (var i = 0; i < l; i++) {
                    var r = map.data[i * 4 + 0];
                    var g = map.data[i * 4 + 1];
                    var b = map.data[i * 4 + 2];
                    var a = map.data[i * 4 + 3];
                    if (r+g+b > 50) {
                        map.data[i * 4 + 0] = 255;
                        map.data[i * 4 + 1] = 255;
                        map.data[i * 4 + 2] = 255;
                        map.data[i * 4 + 3] = 255;
                    } else {
                        map.data[i * 4 + 0] = 0;
                        map.data[i * 4 + 1] = 0;
                        map.data[i * 4 + 2] = 0;
                        map.data[i * 4 + 3] = 0;
                    }
                }
                context.putImageData(map, 0, 0);
                /// XXX DEBUG
                var img = document.createElement('img');
                img.setAttribute('src', canvas.toDataURL('image/png'));
                img.setAttribute('class', 'frame');
                document.body.appendChild(img);
                /// XXX
                context.globalCompositeOperation = 'source-in';
                context.drawImage(video, 0, 0, width, height);
                context.globalCompositeOperation = 'source-over';
            }
            // add caption
            context.textAlign = 'center';
            context.font = 'bold 24px sans';
            context.fillStyle = 'white';
            context.strokeStyle = '1px solid black';
            context.fillText(text.value, width/2, height-24);
            context.strokeText(text.value, width/2, height-24);

            // update transparent last frame overlay
            lastframe.getContext('2d').drawImage(canvas, 0, 0, width, height);

            // add frame to frame list
            var img = document.createElement('img');
            img.setAttribute('src', canvas.toDataURL('image/png'));
            img.setAttribute('class', 'frame');
            framecontainer.appendChild(img);
            framecontainer.className = '';
            img.addEventListener('load', function() {
                framecontainer.scrollLeft += 9000;
            });

            // update gif
            gif.addFrame(clonecanvas(canvas), {delay: delay});
            gif.on('finished', function(blob) {
                preview.removeAttribute('height');
                preview.src = URL.createObjectURL(blob);
                gif.abort();
            });
            gif.render();
        }
    }

    window.addEventListener('load', init, false);
})();
