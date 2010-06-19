/** 
 * fileUpload - upload any file using iframe
 * 
 * @todo add ajax upload for modern browsers
 * @depends jquery.js
 * @website jsui.de
 * @version 0.1
 * @author Oleg Slobodskoi aka Kof
 * @credits http://malsup.com/jquery/form/
 * @license Mit Style License
 */

(function(global, document, $, plugin){

    /* detect if ajax upload is supported */
  var hasHTML5Upload = !!($.ajaxSettings.xhr().upload),
      runtimeHash = {
        html5: (function() { 
          return hasHTML5Upload ? Html5Uploader : IframeUploader;
        })(),
        flash:  (function() { 
            return $.flash.checkVersion('9.0.0') ? FlashUploader : IframeUploader;
        })(),
        iframe: IframeUploader
      },
      instantiateUploader = function($form, s) {
        var inst;
        $.each(s.runtime.split(/\s+/), function(i,r) {
          inst = new runtimeHash[r]($form,s);
          return !inst;
        });
        return inst;
      };
   
  var timestamp = (new Date).getTime();
     
  $.fn[plugin] = function( method, options ) {
    if ( typeof method != 'string' ) {
        options = method;
        method = null;
    }
    var s = $.extend(true, {}, $.ajaxSettings, arguments.callee.defaults, options);
    
    var ret = this;
    this.each(function(){
      var $form = $(this);
      !s.url && (s = $.extend({}, s, { url: $form.attr('action') }));
      
      var inst = $.data(this, plugin ) || $.data(this, plugin, instantiateUploader($form,s));  /* end init instance */
      if (method) {
        ret = inst[method](options); 
      } else {
        // add global event handler
        s.autoStart && $form.bind('change.' + plugin, $.proxy(inst, 'upload'));
        $form.bind('submit.' + plugin, function(e) {
          inst.upload();
          return false;
        });
      }
    });
    return ret;
  };

$.fn[plugin].defaults = {
    runtime: 'html5 flash iframe',    
    dataType: 'json',
    type: 'post',
    url: null,
    params: null,
    autoStart: true,
    filesadd: $.noop,
    progress: $.noop,
    completeall: $.noop,
    error: $.noop,
    flash: {
      fileFilters: null,
      init: $.noop,
      cancelselect: $.noop,
      mouseover: $.noop,
      mouseout: $.noop,
      swf: 'Upload.swf',
      button: $('<input />',{ type: 'button', value: 'Add Files' })
    }
};

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


function FlashUploader($form, s ) {
  
  this._$form = $form;
  this._files = [];
  this._files.loaded = 0;
  this._totalSize = 0;
  this._s = s;
  this._filesIndex = {};
  this._xhrsHash = {};
  this._$originContent = $form.html();
  this._params = s.params || {};
  this._flashCallbackName = plugin+'Callback'+(++timestamp);
  
  var self = this,
      flashId = ++timestamp + '-flash',
      $input = $('input[type="file"]', $form).first().hide(),
      $flashContainer,
      $browseButton = s.flash.button, 
      flasheventprefix = 'flashuploader';
      
  $('input[type="hidden"]', $form).each(function() {
    self._params[this.name] =  this.value;
  });
  global[this._flashCallbackName] = function(evt) {
      $flashContainer.trigger(flasheventprefix + evt.type.toLowerCase(), [evt.data]);
  };

  $input
    .wrap($('<div />',{
      css: {
        position: 'relative', 
        overflow: 'hidden'
      }
    }))
    .before($('<div />', {
      css: {
        position: 'absolute',
        top: 0,
        width: '100%',
        height: '100%'
      },
      html: function() {
        $flashContainer = $(this).flash({
          swf: s.flash.swf,
          checkVersion: false,
          version: '9.0.0',
          attr: { 
            id: flashId, 
            name: flashId, 
            data: s.flash.swf,
            width:'100%',
            height:'100%' 
          },
          params: {
            flashvars: {
              id: flashId,
              filters: s.flash.fileFilters || '',
              multiple: !!($input.attr('multiple')),
              callbackName: self._flashCallbackName
            }
          }
        });
        self.flashObjectEl = $flashContainer.flash('get');
      }
    }))
    .before($browseButton)
    .parent() 
    .width($browseButton.outerWidth(true)).height($browseButton.outerHeight(true));

  $flashContainer.bind(flasheventprefix+'init.' + plugin , function(e, data) {
      s.flash.init.apply($flashContainer, data);
  })
  .bind(flasheventprefix+'cancelselect.' + plugin , function(e, data) {
      s.flash.cancelselect.apply($flashContainer, data);
  })
  .bind(flasheventprefix+'mouseover.' + plugin, function(e, data) {
      s.flash.mouseover.apply($flashContainer, data);
  })
   .bind(flasheventprefix+'mouseout.' + plugin, function(e, data) {
      s.flash.mouseout.apply($flashContainer, data);
  })
  .bind(flasheventprefix+'selectfiles.' + plugin , function(e, selectedFiles) {
      var files = self._files;
      $.each(selectedFiles, function(i,file) {
        files.push(file);
        self._filesIndex[file.id] = files.length-1;
        self._totalSize+= file.size;
      });
      s.filesadd.apply($form, [files]);
      $form
        .trigger("filesadd",files)
        .trigger("change");
  })
  .bind(flasheventprefix+'uploadcompletedata.' + plugin, function(e, load) {
      var xhr = self._xhrsHash[load.fileId];
      xhr.onload(load);
  })
  .bind(flasheventprefix+'uploadprogress.' + plugin, function (e, progress) {
      var xhr = self._xhrsHash[progress.fileId];
      xhr.upload.progress(progress);
  })
  .bind(flasheventprefix+'uploaderror.' + plugin, function (e, error) {
      var xhr = self._xhrsHash[error.fileId];
      // have to find out the real error params!
      xhr.error(error);
  });

};

FlashUploader.prototype = {
  destroy: function() {
    delete global[this._flashCallbackName];
    this._$form.removeData(plugin)
    .find('*').unbind('.' + plugin)
    .html(this._$originContent);
  },
  removeFile: function(fileId) {
    var self = this, 
        fileIdx = this._filesIndex[fileId],
        file = this._files[fileIdx];
    this._totalSize -= file.size;
    this._files = this.flashObjectEl.flashUploaderRemoveFile(fileId);
    // rebuild files cache
    self._filesIndex = {};
    $.each(this._files, function(i,file) {
        self._filesIndex[file.id] = i;
    });
  },
  upload: function() {
    var self = this,
    s = this._s, $form = this._$form, files = this._files;
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
            triggerEvent(self, 'success', [{ fileId: file.id, loaded: loaded, total: self._totalSize}, xhr ]);
            files.loaded == files.length &&  triggerEvent(self, 'completeall', [
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
            self.flashObjectEl.flashUploaderSendFile(file.id, s.url, { 
                params: self._params
            });
          },
          error:function(error){ 
            triggerEvent(self, 'error', [ error,xhr ]);
          },
          upload: {
            progress: function(progress) {
              file.loaded = progress.loaded;
              triggerEvent(self, 'progress', [{
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
  }
}

function Html5Uploader( $form, s ) {
  this._$form = $form;
  this._files = [];
  this._totalSize = 0;
  this._files.loaded = 0;
  this._s = s;
};
Html5Uploader.prototype = {
  upload: function() {
    var self = this, s = this._s,
        $form = this._$form, files = this._files, total = this._totalSize;
        
    var _xhr = s.xhr;
    $('[type="file"]', this._$form).each(function( i, elem ) {     
      this.files.length && $.each(this.files, function(i){
        files.push({ fileId: 'file_'+i, file: this, elem: elem, loaded: 0});
        total += this.fileSize;
      });
    });
    $.each(files, function send( i, data ){
        
      var xhr = _xhr(),
        _send = xhr.send,
        file = data.file;
        
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
        data.loaded = file.fileSize;
        data.complete = true;
        files.loaded ++;
        var loaded = sumLoaded(files);
        
        triggerEvent(self, 'success', [{
          fileId: file.id,
          loaded: loaded,
          total: total
        }, xhr ]);
        files.loaded == files.length && triggerEvent(self, 'completeall', [
           {total: total, loaded: loaded }, xhr
        ]);
      };
      var onprogress = xhr.upload.onprogress = function( progress ) {
        data.loaded = progress.loaded;
        triggerEvent(self, 'progress', [{
          total: total,		
          loaded:  sumLoaded(files)
        }, xhr]);
      };
      
      $.ajax(s);
    });
  }
};

function IframeUploader($form, s ) {
   this._$form = $form;
   this._s = s;
};
IframeUploader.prototype =  {
  upload: function() {
    var s = this._s,
        $form = this._$form,
        form = $form[0],
        // cache original form attributes
        _attr = {
            target: form.target,
            enctype:form.enctype,
            method: form.method,
            action: form.action
        },
        attr = {
            target: 'file-upload-' + timestamp++, 
            enctype: 'multipart/form-data', 
            method: 'POST',
            action: s.url
        },
        $iframe,
        $ajaxData;
    // mock request header types
    var types = {
        'content-type': s.dataType,
        'Last-Modified': null,
        Etag: null
    };
  
    // mock xhr object
    var xhr = $.extend({}, xhrMock, {
        open: function(type, url, async) {
            // create iframe
            $iframe = $('<iframe name="'+attr.target+'" style="display: none;" src="javascript:;"/>').load(onload).insertAfter(form);
            // change form attr to submit in to the iframe and ensure other attr are correct
            $form.attr(attr);
            // add fields from ajax settings
            if ( s.data ) {
                var data = s.data.split('&'),
                    ajaxData = '';
                $.each(data, function(i,param){
                    param = param.split('=');
                    if ( param[0] && param[1] )
                        ajaxData += '<input type="hidden" name="' + param[0] + '" value="' + param[1] + '" />';
                });                
                $ajaxData = $(ajaxData).appendTo(form);
            };
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
        
        if ( s.dataType == 'json' || s.dataType == 'script' ) {
            var ta = doc.getElementsByTagName('textarea')[0];
            xhr.responseText = ta ? ta.value : xhr.responseText;
        } else if ( s.dataType == 'xml' && !xhr.responseXML && xhr.responseText != null ) {
            xhr.responseXML = toXml(xhr.responseText);
        };
        triggerEvent(self, 'completeall', [ null, xhr ]);
        xhr.onreadystatechange();
        close();
    }   
    
    function close() {
        $form.attr(_attr);
        // by removing iframe without delay FF still shows loading indicator
        setTimeout(function() {  
          $iframe.remove()
        } , 500);
    }
    
    $.ajax(s);
  }
};

function triggerEvent(instance, type, params) {
    var s = instance._s,
       $form = instance._$form;
    s[type].apply($form, params);
    $form.trigger(type, params);        
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


})(this, window.document, jQuery, 'fileUpload');
