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

    // redux setup
    var currentFrame = 0;
    function getFrameId() {
        return ++currentFrame;
    }

    function framesReducer(state, action) {
        if (!state) {
            state = [];
        }

        switch (action.type) {
            case 'FRAME_ADD':
                return state.concat({
                    id: getFrameId(),
                    frame: action.frame,
                    canvas: action.canvas
                });
            case 'FRAME_REMOVE':
                return state.filter(function (element) {
                    return element.id !== action.frameId;
                });
            case 'RESET':
                return [];
            default:
                return state
        }
    }

    function settingsReducer(state, action) {
        if (!state) {
            state = {
                delay: 200,
                debug: false,
                greenscreen: false
            }
        }

        switch (action.type) {
            case 'CHANGE_DELAY':
                return {
                    delay: action.value,
                    debug: state.debug,
                    greenscreen: state.greenscreen
                };
            case 'TOGGLE_DEBUG':
                return {
                    delay: state.delay,
                    debug: !state.debug,
                    greenscreen: state.greenscreen
                };
            case 'TOGGLE_GREENSCREEN':
                return {
                    delay: state.delay,
                    debug: state.debug,
                    greenscreen: !state.greenscreen
                };
            default:
                return state
        }
    }

    window.store = Redux.createStore(Redux.combineReducers({
        frames: framesReducer,
        settings: settingsReducer
    }));

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
        document.getElementById('clear').addEventListener('click', clear);

        document.getElementById('greenscreen').addEventListener('click', function(ev) {
            updategreenscreen();
            document.getElementById('greenscreen').className = 'disabled';
            return toggleGreenscreen();
        });
        document.getElementById('save').addEventListener('click', function(ev) {
            download();
            ev.preventDefault();
        });
        document.getElementById('delay').addEventListener('change', changeDelay);

        navigator.getMedia = ((navigator.mediaDevices && navigator.mediaDevices.getUserMedia
                               && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices))
                           || navigator.getUserMedia
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
            toggleDebug();
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
        return false;
    }

    function changeDelay(event) {
        store.dispatch({
            type: 'CHANGE_DELAY',
            value: parseInt(event.target.value, 10)
        });
        return false;
    }

    function toggleDebug(value) {
        store.dispatch({
            type: 'TOGGLE_DEBUG'
        });
        return false;
    }

    function toggleGreenscreen() {
        store.dispatch({
            type: 'TOGGLE_GREENSCREEN'
        });
        return false;
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
        var context = canvas.getContext('2d');
        if (width && height) {
            canvas.width = width;
            canvas.height = height;
            context.drawImage(video, 0, 0, width, height);
            greenscreen = clonecanvas(canvas);
        }
    }

    function debugcapture(canvas) {
        if (!store.getState().settings.debug) {
            return;
        }

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
            if (store.getState().settings.greenscreen) {
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

    var state,
        gif,
        frameCounter,
        frameLength,
        frameCanvas,
        frame,
        frames,
        delay;

    function buildPreviewFrame(container, frameId, imageSrc, isLast) {
        var remove = document.createElement('a'),
            imgContainer = document.createElement('div'),
            img = document.createElement('img');

        remove.setAttribute('class', 'remove-frame');
        remove.addEventListener('click', function() {
            store.dispatch({
                type: 'FRAME_REMOVE',
                frameId: parseInt(this.parentElement.getAttribute('data-frame')),
            });
        });

        img.setAttribute('src', imageSrc);
        img.setAttribute('class', 'frame');
        imgContainer.appendChild(remove);
        imgContainer.appendChild(img);
        imgContainer.setAttribute('data-frame', frameId)

        container.appendChild(imgContainer);

        if (isLast) {
            img.addEventListener('load', function () {
                container.scrollLeft += 9000;
            });
        }
    }

    store.subscribe(function () {
        gif = new GIF({
            quality: 10,
            workers: 2,
            workerScript: URL.createObjectURL(workerblob),
            //transparent: 0xff00ff, XXX OFF for now
        });

        state = store.getState();
        frames = state.frames;
        delay = state.settings.delay;
        frameLength = frames.length;

        var domFrames = document.querySelectorAll('[data-frame]')
            domFramesMap = {};
        for (frameCounter = 0; frameCounter < domFrames.length; frameCounter++) {
            domFramesMap[domFrames[frameCounter].getAttribute('data-frame')] = domFrames[frameCounter];
        }

        for (frameCounter = 0; frameCounter < frameLength; frameCounter++) {
            frameCanvas = frames[frameCounter].canvas;
            frame = frames[frameCounter].frame
            frameId = frames[frameCounter].id;

            if (typeof domFramesMap[frameId] === "undefined") {
                buildPreviewFrame(framecontainer, frameId, frame, frameLength-1 === frameCounter);
            }
            gif.addFrame(frameCanvas, {delay: delay});
            delete domFramesMap[frameId];
        }

        var toBeDeleted = Object.keys(domFramesMap);
        for (frameCounter = 0; frameCounter < toBeDeleted.length; frameCounter++) {
            domFramesMap[toBeDeleted[frameCounter]].parentElement.removeChild(domFramesMap[toBeDeleted[frameCounter]]);
        }

        if (frames.length) {
            lastframe.getContext('2d').clearRect(0, 0, width, height);
            lastframe.getContext('2d').drawImage(frameCanvas, 0, 0, width, height);

            gif.render();
            gif.on('finished', function(blob) {
                preview.removeAttribute('height');
                preview.src = '';
                preview.src = URL.createObjectURL(blob);
                gif.abort();
            });

            document.getElementById('save').className = '';
            framecontainer.className = '';
        } else {
            lastframe.getContext('2d').clearRect(0, 0, width, height);

            preview.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
            preview.setAttribute('height', height);
            document.getElementById('save').className = 'disabled';
            framecontainer.className = 'disabled';
        }

        if (state.settings.debug) {
            debug.className = '';
        }
    });

    window.addEventListener('load', init, false);
})();
