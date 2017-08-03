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
    function frames(state, action) {
        switch (action.type) {
            case 'FRAME_ADD':
                state.frames = state.frames.concat({
                    frame: action.frame,
                    canvas: action.canvas
                });
                return state;
            case 'FRAME_REMOVE':
                state.frames = state.frames.filter(function (element, index) {
                    return index !== action.index;
                });
                return state;
            case 'RESET':
                state.frames = [];
                return state;
            default:
                return state
        }
    }

    Redux.createStore(frames, {'frames': []});

    var width = 320;
    var height = 0;
    var streaming = false;

    var video = null;
    var canvas = null;
    var lastframe = null;
    var preview = null;
    var text = null;
    var debug = null;
    var framecontainer = null;
    var greenscreen = null;

    var workerblob = new Blob([document.getElementById('workerscript').textContent], {type: 'text/javascript'});

    function init() {
        video = document.getElementById('viewfinder');
        canvas = document.getElementById('tmp');
        lastframe = document.getElementById('lastframe');
        preview = document.getElementById('preview');
        text = document.getElementById('text');
        debug = document.getElementById('debug');
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

        if (document.location.hash === '#d') {
            debug.className = '';
        }
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
        store.dispatch({type: 'RESET'});
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

    function debugcapture(canvas) {
        var img = document.createElement('img');
        img.setAttribute('src', canvas.toDataURL('image/png'));
        img.setAttribute('class', 'frame');
        debug.appendChild(img);
    }

    function addframe() {
        var context = canvas.getContext('2d');
        if (width && height) {
            canvas.width = width;
            canvas.height = height;

            // prepare frame
            context.drawImage(video, 0, 0, width, height);
            // remove background
            if (greenscreen) {
                debugcapture(greenscreen);
                context.globalCompositeOperation = 'difference'; /// XXX this is too simplistic
                context.drawImage(greenscreen, 0, 0, width, height);
                debugcapture(canvas);
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
                        map.data[i * 4 + 0] = 255;
                        map.data[i * 4 + 1] = 0;
                        map.data[i * 4 + 2] = 255;
                        map.data[i * 4 + 3] = 0;
                    }
                }
                context.putImageData(map, 0, 0);
                debugcapture(canvas);
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
            store.dispatch({
                type: 'FRAME_ADD',
                canvas: clonecanvas(canvas),
                frame: canvas.toDataURL('image/png')
            });

            if (greenscreen) {
                context.globalCompositeOperation = 'destination-over';
                /// XXX: this must match the gifjs "transparent" value
                context.fillStyle = "rgb(255,0,255)";
                context.fillRect(0, 0, width, height);
                debugcapture(canvas);
                context.globalCompositeOperation = 'source-over';
            }
        }
    }

    store.subscribe(function () {
        var gif = new GIF({
            quality: 10,
            workers: 2,
            workerScript: URL.createObjectURL(workerblob),
            //transparent: 0xff00ff, XXX OFF for now
        });

        var delay = 200;
        frames = store.getState().frames;
        framecontainer.innerHTML = '';

        for (var frameCounter in frames) {
            var remove = document.createElement('a'),
                imgContainer = document.createElement('div'),
                frameCanvas = frames[frameCounter].canvas,
                frame = frames[frameCounter].frame;
            remove.setAttribute('data-frame', frameCounter);
            remove.setAttribute('class', 'remove-frame');
            remove.addEventListener('click', function() {
                store.dispatch({
                    type: 'FRAME_REMOVE',
                    index: parseInt(this.getAttribute('data-frame')),
                });
            });

            var img = document.createElement('img');
            img.setAttribute('src', frame);
            img.setAttribute('class', 'frame');
            imgContainer.appendChild(remove);
            imgContainer.appendChild(img);
            framecontainer.appendChild(imgContainer);
            framecontainer.className = '';

            gif.addFrame(frameCanvas, {delay: delay});
        }

        if (frames.length) {
            img.addEventListener('load', function() {
                framecontainer.scrollLeft += 9000;
            });

            lastframe.getContext('2d').clearRect(0, 0, width, height);
            lastframe.getContext('2d').drawImage(frameCanvas, 0, 0, width, height);

            gif.render();
            gif.on('finished', function(blob) {
                preview.removeAttribute('height');
                preview.src = URL.createObjectURL(blob);
                gif.abort();
            });

            document.getElementById('save').className = '';
        } else {
            lastframe.getContext('2d').clearRect(0, 0, width, height);

            preview.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
            preview.setAttribute('height', height);
            document.getElementById('save').className = 'disabled';
        }
    });

    window.addEventListener('load', init, false);
})();
