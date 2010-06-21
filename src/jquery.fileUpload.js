/** 
 * fileUpload - jQuery plugin
 * 
 * Upload using html5, iframe or flash depending on settings
 * and browser compatibility
 * 
 * @requires jquery.js jquery.flash.js Upload.swf
 * @version 0.1
 * @author Oleg Slobodskoi aka Kof (jsui.de)
 * @license Dual licensed under the MIT and GPL licenses.
 */

(function( global, document, slice, $, plugin ) {

$.fn[plugin] = function( method, options ) {
    if ( typeof method != 'string' ) {
        options = method;
        method = null;
    }
    
    var args = arguments,
        s = $.extend(true, {}, $.ajaxSettings, args.callee.defaults, options),
        ret;

    this.each(function(){
        var $elem = $(this),
            $form = $elem.closest('form');
        
        // if url is not set, get it from action attr
        if ( !s.url && $form.length )
            s.url = $form.attr('action');
        
        !s.context && (s.context = this);
        
        var inst = $.data( this, plugin );

        // lets check which type of upload we can instantiate
        !inst && $.each(s.runtime.split(' '), function( i, type ) {
            if ( support[type] ) {
                // create instance
                inst = new constructors[type]( $elem, $form, s );
                
                // attach instance to element in data store
                $elem.data( plugin, inst );
                
                // handle onchange event
                s.autoStart && $elem.bind('change.' + plugin, $.proxy(inst, 'upload'));

                return false;    
            }
        });
        
        !inst && $.error(plugin + ": your browser doesn't correspond your runtime settings");

        if ( method ) {
            ret = inst[method].apply( inst, slice.call(args, 1) ); 
        }
    });
    
    return ret || this;
};

$.fn[plugin].defaults = {
    runtime: 'iframe flash ajax',    
    dataType: 'json',
    type: 'post',
    url: null,
    params: null,
    autoStart: true,
    multiple: false,
    flash: {
        version: '9.0.0',
        swf: 'Upload.swf',
        filters: null,
        attr: {
            width: '100%',
            height: '100%' 
        }
    },
    start: $.noop,
    change: $.noop,
    progress: $.noop,
    completeall: $.noop,
    error: $.noop,
    // flash callbacks
    flashinit: $.noop,
    flashcancelselect: $.noop,
    flashcompletedata: $.noop
};

/**
 * Iframe upload constructor
 * @constructor
 * @param {Object} $element
 * @param {Object} $form
 * @param {Object} settings
 */
function IframeUpload( $element, $form, settings ) {
    this._$element = $element;
    this._$form = $form;
    this._settings = settings;
}

IframeUpload.prototype.upload = function() {
    var self = this,
        s = this._settings,
        $form = this._$form,
        form = $form[0],
        $iframe,
        $hiddenInputs;
    
    var _attr = {
            action: form.action,
            target: form.target,
            enctype: form.enctype,
            method: form.method
       },
       
       attr = {
           action: s.url,
           target: 'file-upload-'+ timestamp++,
           enctype: 'multipart/form-data',
           method: 'POST'
       };     
            
   
    // mock request header types
    var types = {
            'content-type': s.dataType,
            'Last-Modified': null,
            Etag: null
        };
    
    // mock xhr object
    var xhr = $.extend({}, xhrMock, {
        open: function(type, url, async) {
            $form.attr(attr);
            // create iframe
            $iframe = $('<iframe name="'+attr.target+'" style="display: none;" src="javascript:;"></iframe>')
                .load(onload).insertAfter($form);
            
            // add fields from ajax settings
            if ( s.data ) {
                var data = s.data.split('&'),
                    hiddenInputs = '';
                $.each(data, function(i,param){
                    param = param.split('=');
                    if ( param[0] && param[1] )
                        hiddenInputs += '<input type="hidden" name="' + param[0] + '" value="' + param[1] + '" />';
                });                

                $hiddenInputs = $(hiddenInputs).appendTo($form);
            }
        },
        send: function() {
            // submit form 
            $form.submit();
        },
        getResponseHeader: function(type) {
            return types[type];                 
        },
        abort: close
    });    
    
    s.xhr = function() {
        return xhr;
    };
    
    function onload() {
        var doc = $iframe.contents()[0];
        $.extend(xhr, {
            status: 200,
            readyState: 4,
            responseText: doc.body ? doc.body.innerHTML : null,
            responseXML: doc.XMLDocument ? doc.XMLDocument : doc
        });
        
        if ( s.dataType === 'json' || s.dataType === 'script' ) {
            var ta = doc.getElementsByTagName('textarea')[0];
            xhr.responseText = ta ? ta.value : xhr.responseText;
        } else if ( s.dataType == 'xml' && !xhr.responseXML && xhr.responseText != null ) {
            xhr.responseXML = toXml(xhr.responseText);
        };
        
        trigger(self, 'completeall', [ {files: null}, xhr ]);
        trigger(self, 'progress', [{
            total: 1,        
            loaded:  1
        }, xhr]);
        
        xhr.onreadystatechange();
        close();
    }   
    
    function close() {
        $form.attr(_attr);
        // by removing iframe without delay FF still shows loading indicator
        setTimeout(function() {  
            $iframe.remove();
        } , 500);
    }
    
    $.ajax(s);
};

/**
 * Flash upload constructor
 * @constructor
 * @param {Object} $element
 * @param {Object} $form
 * @param {Object} s
 */
function FlashUpload( $element, $form, s ) {
    var self = this,
        flashId = 'flash' + timestamp++,
        $flashContainer;
    
    this._$element = $element;
    this._$form = $form;
    this._files = [];
    this._files.loaded = 0;
    this._filesIndex = {};
    this._totalSize = 0;
    this._settings = s;
    this._xhrsHash = {};
    this._params = s.params || {};
    this._flashCallbackName = plugin + 'Callback' + timestamp++;

    $('input[type="hidden"]', $form).each(function() {
        self._params[this.name] =  this.value;
    });
    
    // global callback function, that will be called by flash
    global[this._flashCallbackName] = function( e ) {
        var data = e.data,
            xhr = self._xhrsHash[data.fileId];
        if ( e.type === 'error' ) {
            // have to find out the real error params!
            xhr.error(data);
        } else if ( e.type === 'progress' ) {
            xhr.upload.progress(progress);
        } else if ( e.type === 'complete' ) {
            xhr.onload(data);
        } else {
            trigger(self, e.type, [data]);
        }
        
    };

    $element
        .wrap($('<div></div>',{
            css: {
                position: 'relative', 
                overflow: 'hidden'
            }
        }))
        .before($('<div></div>', {
            css: {
                position: 'absolute',
                top: 0,
                width: '100%',
                height: '100%'
            },
            html: function() {
                $flashContainer = $(this).flash($.extend(true, s.flash, {
                    attr: { id: flashId },
                    params: {
                        flashvars: {
                            id: flashId,
                            filters: s.flash.filters || '',
                            multiple: !!(s.multiple || $element.attr('multiple')),
                            callbackName: self._flashCallbackName
                        }
                    }
                }));
            
                self.flashElement = $flashContainer.flash('get');
            }
        }));

    $flashContainer.parent()
        .width($element.outerWidth(true))
        .height($element.outerHeight(true));

    $element.bind('change.' + plugin, function(e, addedFiles) {
        var files = self._files;
        $.each(addedFiles, function(i,file) {
            files.push(file);
            self._filesIndex[file.id] = files.length-1;
            self._totalSize += file.size;
        });
    });
    
};

FlashUpload.prototype = {
    destroy: function() {
        delete global[this._flashCallbackName];
        this._$element
            .unbind('.' + plugin)
            .unwrap();
    },
    removeFile: function( fileId ) {
        var index = this._filesIndex[fileId];
        this._totalSize -= this._files[index].size;
        delete this._filesIndex[fileId];
        this._files.splice(index, 1);
        this.flashElement.flashUploadRemoveFile(fileId);
    },
    upload: function() {
        var self = this,
            s = this._settings, 
            files = this._files;
            
        $.each(files, function(i, file){ 
            var types = {
                    'content-type': s.dataType,
                    'Last-Modified': null,
                    Etag: null
                };
            // mock xhr object
            var xhr = $.extend({}, xhrMock, {
                onload: function(load) {
                    file.loaded = load.total;
                    file.complete = true;
                    files.loaded ++;
                    var loaded = sumLoaded(files);
    
                    trigger(self, 'success', [{ fileId: file.id, loaded: loaded, total: self._totalSize}, xhr ]);
    
                    files.loaded == files.length &&  trigger(self, 'completeall', [
                        {files: files, total: self._totalSize, loaded: loaded}, xhr 
                    ]);
    
                    $.extend(xhr, {
                        status: 200,
                        readyState: 4,
                        responseText: load.text,
                        responseXML: load.text
                    });
                    
                    xhr.onreadystatechange();
                },            
                send: function() {
                    self.flashElement.flashUploadSendFile(file.id, s.url, { 
                        params: self._params
                    });
                },
                error:function(error){ 
                    trigger(self, 'error', [ error, xhr ]);
                },
                upload: {
                    progress: function(progress) {
                        file.loaded = progress.loaded;
                        trigger(self, 'progress', [{
                            fileId: file.id,
                            total: self._totalSize,        
                            loaded: sumLoaded(files)
                        }, xhr]);
                    }
                },
                getResponseHeader: function(type) {
                    return types[type];                 
                }
            });
    
            self._xhrsHash[file.id] = xhr;
    
            s.xhr = function() {
                return xhr;
            };
            
            $.ajax(s);
        });
        
        return false;
    }
}; // end of FlashUpload prototype


/**
 * Ajax upload constructor
 * @todo call change callback onchange
 * @constructor
 * @param {Object} $element
 * @param {Object} $form
 * @param {Object} settings
 */
function AjaxUpload( $element, $form, settings ) {
    this._$element = $element;
    this._files = [];
    this._files.loaded = 0;
    this._totalSize = 0;
    this._settings = settings;
}

AjaxUpload.prototype = {
    upload: function() {
        var self = this, 
            s = this._settings,
            $element = this._$element,
            files = this._files, 
            total = this._totalSize,
            _xhr = s.xhr;
        
        $.each($element[0].files, function send( i, data ){
            var file = {
                    fileId: 'file_'+i, 
                    fileName: data.fileName, 
                    fileSize: data.fileSize,
                    loaded: 0
                },
                xhr = _xhr(),
                _send = xhr.send;
                
            total += file.fileSize;
            files.push(file);
            
            s.xhr = function() {
                return xhr;
            };
            
            xhr.send = function() {
                xhr.setRequestHeader("Content-Type", "multipart/form-data");
                xhr.setRequestHeader("Cache-Control", "no-cache");
                xhr.setRequestHeader('X-File-Name', file.fileName);
                xhr.setRequestHeader('X-File-Size', file.fileSize);
                _send.call(this, file);
            };
            
            xhr.onload = function( load ) {
                file.loaded = file.fileSize;
                file.complete = true;
                ++ files.loaded;
                
                var loaded = sumLoaded(files);
                
                trigger(self, 'success', [{
                    fileId: file.id,
                    loaded: loaded,
                    total: total
                }, xhr ]);

                files.loaded == files.length && trigger(self, 'completeall', [
                    {files: files, total: total, loaded: loaded }, 
                    xhr
                ]);
            };
            
            var onprogress = xhr.upload.onprogress = function( progress ) {
                data.loaded = progress.loaded;
                trigger(self, 'progress', [{
                    total: total,        
                    loaded:  sumLoaded(files)
                }, xhr]);
            };
            
            $.ajax(s);
        });
    }
}; // end of AjaxUpload prototype



    // detect if ajax and flash upload are supported  
var support = {
        ajax: !!($.ajaxSettings.xhr().upload),
        flash: !!($.flash && $.flash.checkVersion($.fn[plugin].defaults.flash.version)),
        iframe: true
    },
    // constructors hash
    constructors = {
        ajax: AjaxUpload,
        flash: FlashUpload,
        iframe: IframeUpload
    },
    timestamp = (new Date).getTime();
    
var xhrMock = { 
    responseText: null,
    responseXML: null,
    status: 0,
    readyState: 0,
    statusText: '',
    getAllResponseHeaders: $.noop,
    setRequestHeader: $.noop,
    open: $.noop
};
  
function trigger( inst, type, params ) {
    var s = inst._settings,
        $elem = inst._$element;
    params.push(s);    
    s[type] && s[type].apply($elem, params);
    $elem.trigger(type, params);        
}

function sumLoaded(files) {
    var loaded = 0;
    for (var i = 0; i < files.length; i++) {
        loaded += files[i].loaded; 
    }
    return loaded;
}

function toXml( s ) {
    if ( window.ActiveXObject ) {
        var doc = new ActiveXObject('Microsoft.XMLDOM');
        doc.async = 'false';
        doc.loadXML(s);
        return doc;
    } else {
        return (new DOMParser()).parseFromString(s, 'text/xml');
    }
}


})(this, window.document, Array.prototype.slice, jQuery, 'fileUpload');