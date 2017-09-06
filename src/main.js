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
                greenscreen: false
            }
        }

        switch (action.type) {
            case 'CHANGE_DELAY':
                return {
                    delay: action.value,
                    greenscreen: state.greenscreen
                };
            case 'TOGGLE_GREENSCREEN':
                return {
                    delay: state.delay,
                    greenscreen: !state.greenscreen
                };
            default:
                return state
        }
    }

    window.STORE = Redux.createStore(Redux.combineReducers({
        frames: framesReducer,
        settings: settingsReducer
    }));

    var width = 320; /// XXX what do we use this for?
    var height = 0;
    var streaming = false; /// XXX and this?

    var ELEMENT = {};

    var workerblob = new Blob([document.getElementById('workerscript').textContent], {type: 'text/javascript'});

    function init() {
        ELEMENT = Utils.getElements({
            canvas: 'tmp',
            clear: 'clear',
            debug: 'debug',
            delay: 'delay',
            framecontainer: 'framecontainer',
            greenscreen: 'greenscreen',
            lastframe: 'lastframe',
            preview: 'preview',
            save: 'save',
            text: 'text',
            video: 'viewfinder',
            capture: 'capture',
        });

        ELEMENT.clear.addEventListener('click', ACTION.clear);
        ELEMENT.greenscreen.addEventListener('click', function(ev) {
            updategreenscreen();
            ELEMENT.greenscreen.className = 'disabled';
            return ACTION.toggleGreenscreen();
        });
        ELEMENT.save.addEventListener('click', function(ev) {
            ACTION.download();
            ev.preventDefault();
        });
        ELEMENT.delay.addEventListener('change', ACTION.changeDelay);

        Utils.initCamera(ELEMENT.video);

        ELEMENT.video.addEventListener('canplay', function(ev) {
            if (streaming) {
                return;
            }
            height = ELEMENT.video.videoHeight / (ELEMENT.video.videoWidth/width);
            if (isNaN(height)) { // FF bug, apparently
                height = width / (4/3);
            }
            streaming = true;
        }, false);

        ELEMENT.capture.addEventListener('click', function(ev) {
            addframe();
            ev.preventDefault();
        });

        document.body.addEventListener('keydown', function(ev) {
            if (ev.target.nodeName === 'TEXTAREA') {
                return; // ignore
            }
            if (ev.charCode === 32 || ev.keyCode === 32) {
                addframe();
                ev.preventDefault();
            }
        }, false);
    }

    // main stuff

    var ACTION = {};

    ACTION.clear = function() {
        STORE.dispatch({type: 'RESET'});
        return false;
    }

    ACTION.changeDelay = function(event) {
        STORE.dispatch({
            type: 'CHANGE_DELAY',
            value: parseInt(event.target.value, 10)
        });
        return false;
    }

    ACTION.toggleGreenscreen = function() {
        STORE.dispatch({
            type: 'TOGGLE_GREENSCREEN'
        });
        return false;
    }

    ACTION.download = function() {
        var a = Utils.makeElement('a', {
            download: 'gifstopmotion-' + Date.now() + '.gif',
            href: ELEMENT.preview.src,
            style: 'display: none;',
        });
        document.body.appendChild(a);
        a.click();
    }

    function updategreenscreen() {
        var context = ELEMENT.canvas.getContext('2d');
        if (width && height) {
            ELEMENT.canvas.width = width;
            ELEMENT.canvas.height = height;
            context.drawImage(ELEMENT.video, 0, 0, width, height);
            ELEMENT.greenscreen = Utils.clonecanvas(ELEMENT.canvas);
        }
    }

    /*** XXX REMOVE DEBUG STUFF ***/
    function debugcapture(canvas) {
        if (!STORE.getState().settings.debug) {
            return;
        }

        var img = document.createElement('img');
        img.setAttribute('src', canvas.toDataURL('image/png'));
        img.setAttribute('class', 'frame');
        ELEMENT.debug.appendChild(img);
    }

    function addframe() {
        var context = ELEMENT.canvas.getContext('2d');
        if (width && height) {
            ELEMENT.canvas.width = width;
            ELEMENT.canvas.height = height;

            // prepare frame
            context.drawImage(ELEMENT.video, 0, 0, width, height);
            // remove background
            if (STORE.getState().settings.greenscreen) {
                debugcapture(ELEMENT.greenscreen);
                context.globalCompositeOperation = 'difference'; /// XXX this is too simplistic
                context.drawImage(ELEMENT.greenscreen, 0, 0, width, height);
                debugcapture(ELEMENT.canvas);
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
                debugcapture(ELEMENT.canvas);
                context.globalCompositeOperation = 'source-in';
                context.drawImage(ELEMENT.video, 0, 0, width, height);
                context.globalCompositeOperation = 'source-over';
            }
            Utils.addCaption(context, ELEMENT.text.value);

            // update transparent last frame overlay
            STORE.dispatch({
                type: 'FRAME_ADD',
                canvas: Utils.clonecanvas(ELEMENT.canvas),
                frame: ELEMENT.canvas.toDataURL('image/png')
            });

            if (ELEMENT.greenscreen) {
                context.globalCompositeOperation = 'destination-over';
                /// XXX: this must match the gifjs "transparent" value
                context.fillStyle = "rgb(255,0,255)";
                context.fillRect(0, 0, width, height);
                debugcapture(ELEMENT.canvas);
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

        var remove = Utils.makeElement('a', {
            'class': 'remove-frame',
        });
        remove.addEventListener('click', function() {
            STORE.dispatch({
                type: 'FRAME_REMOVE',
                frameId: parseInt(this.parentElement.getAttribute('data-frame')),
            });
        });

        var img = Utils.makeElement('img', {
            'src': imageSrc,
            'class': 'frame'
        });
        var imgContainer = Utils.makeElement('div', {
            'data-frame': frameId
        });
        imgContainer.appendChild(remove);
        imgContainer.appendChild(img);

        container.appendChild(imgContainer);

        if (isLast) {
            img.addEventListener('load', function () {
                container.scrollLeft += 9000;
            });
        }
    }

    STORE.subscribe(function () {
        gif = new GIF({
            quality: 10,
            workers: 2,
            workerScript: URL.createObjectURL(workerblob),
            //transparent: 0xff00ff, XXX OFF for now
        });

        state = STORE.getState();
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
                buildPreviewFrame(ELEMENT.framecontainer, frameId, frame, frameLength-1 === frameCounter);
            }
            gif.addFrame(frameCanvas, {delay: delay});
            delete domFramesMap[frameId];
        }

        var toBeDeleted = Object.keys(domFramesMap);
        for (frameCounter = 0; frameCounter < toBeDeleted.length; frameCounter++) {
            domFramesMap[toBeDeleted[frameCounter]].parentElement.removeChild(domFramesMap[toBeDeleted[frameCounter]]);
        }

        if (frames.length) {
            ELEMENT.lastframe.getContext('2d').clearRect(0, 0, width, height);
            ELEMENT.lastframe.getContext('2d').drawImage(frameCanvas, 0, 0, width, height);

            gif.render();
            gif.on('finished', function(blob) {
                ELEMENT.preview.removeAttribute('height');
                ELEMENT.preview.src = '';
                ELEMENT.preview.src = URL.createObjectURL(blob);
                gif.abort();
            });

            document.getElementById('save').className = '';
            ELEMENT.framecontainer.className = 'frames row';
        } else {
            ELEMENT.lastframe.getContext('2d').clearRect(0, 0, width, height);

            ELEMENT.preview.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
            ELEMENT.preview.setAttribute('height', height);
            document.getElementById('save').className = 'disabled';
            ELEMENT.framecontainer.className = 'frames row disabled';
        }

        if (state.settings.debug) {
            ELEMENT.debug.className = '';
        }
    });

    window.addEventListener('load', init, false);
})();
