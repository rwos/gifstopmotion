/*
    Copyright 2015-2017 by Richard Wossal <richard@r-wos.org>

    Permission to use, copy, modify, distribute, and sell this software
    and its documentation for any purpose is hereby granted without fee,
    provided that the above copyright notice appear in all copies and
    that both that copyright notice and this permission notice appear in
    supporting documentation.  No representations are made about the
    suitability of this software for any purpose.  It is provided "as
    is" without express or implied warranty.
*/

var Utils = {};

Utils.makeElement = function(tag, options) {
    var el = document.createElement(tag);
    if (options) {
        for (var key in options) {
            el.setAttribute(key, options[key]);
        }
    }
    return el;
};

Utils.getElements = function(spec) {
    var out = {};
    for (var key in spec) {
        out[key] = document.getElementById(spec[key]);
    }
    return out;
};

Utils.initCamera = function(videoElement) {
    navigator.getMedia = (navigator.getUserMedia
                       || navigator.webkitGetUserMedia
                       || navigator.mozGetUserMedia
                       || navigator.msGetUserMedia);
    navigator.getMedia({video: true, audio: false}, function(stream) {
        if (navigator.mozGetUserMedia) {
            videoElement.mozSrcObject = stream;
        } else {
            var vendorURL = window.URL || window.webkitURL;
            videoElement.src = vendorURL.createObjectURL(stream);
        }
        videoElement.play();
    }, console.log);
};

Utils.clonecanvas = function(oldcanvas) {
    var newcanvas = document.createElement('canvas');
    var context = newcanvas.getContext('2d');
    newcanvas.width = oldcanvas.width;
    newcanvas.height = oldcanvas.height;
    context.drawImage(oldcanvas, 0, 0);
    return newcanvas;
};


//function o
// TODO: get UserMedia
// clonecanvas
// maybe createElement - build DOM element from object
