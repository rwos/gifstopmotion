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
    var preview = null;

    var workerblob = new Blob([document.getElementById('workerscript').textContent], {type: "text/javascript"});

    var gif = new GIF({
        quality: 10,
        workers: 2,
        workerScript: URL.createObjectURL(workerblob)
    });

    var delay = 200;

    function init() {
        video = document.getElementById('viewfinder');
        canvas = document.getElementById('tmp');
        preview = document.getElementById('preview');
        document.getElementById('clear').addEventListener('click', function(ev) {
            clear();
            ev.preventDefault();
        });
        preview.addEventListener('click', function(ev) {
            // XXX: this isn't exactly obvious
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
            video.setAttribute('width', width);
            video.setAttribute('height', height);
            canvas.setAttribute('width', width);
            canvas.setAttribute('height', height);
            preview.setAttribute('width', width);
            preview.setAttribute('height', height);
            streaming = true;
        }, false);

        document.body.addEventListener('keydown', function(ev){
            if (ev.charCode === 32 || ev.keyCode === 32) {
                addframe();
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

    function addframe() {
        var context = canvas.getContext('2d');
        if (width && height) {
            canvas.width = width;
            canvas.height = height;
            context.drawImage(video, 0, 0, width, height);

            gif.addFrame(clonecanvas(canvas), {delay: delay});
            gif.on('finished', function(blob) {
                preview.src = URL.createObjectURL(blob);
                gif.abort();
            });
            gif.render();
        }
    }

    window.addEventListener('load', init, false);
})();
