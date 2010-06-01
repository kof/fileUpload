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

(function($, window){

// detect if ajax upload is supported
$.support.ajaxUpload = $.ajaxSettings.xhr().upload;     

$.fn.fileUpload = function( options ) {
    var s = $.extend(true, {}, $.ajaxSettings, arguments.callee.defaults, options);
	$.support.ajaxUpload ? ajaxUpload(this, s) : iframeUpload(this, s);     
    return this;
};        

$.fn.fileUpload.defaults = {
    dataType: 'json',
    type: 'post',
    url: null,
    progress: $.noop,
    completeall: $.noop
};

var timestamp = (new Date).getTime();

function ajaxUpload( form, s ) {

	var _xhr = s.xhr,
		files = [],
		total = 0,
		loaded = 0;
		
	files.loaded = 0;
	
	$('[type="file"]', form).each(function( i, elem ){
		this.files.length && $.each(this.files, function(){
			files.push({file: this, elem: elem});
			total = total + this.fileSize;
		});
	});
	
	!s.url && (s.url = $(form).attr('action'));
	
	$.each(files, function send( i, data ){
		var xhr = _xhr(),
			_send = xhr.send,
			file = data.file;
			
		s.xhr = function() {
			return xhr;
		};

		xhr.send = function() {
			xhr.setRequestHeader('X-File-Name', file.fileName);
			xhr.setRequestHeader('X-File-Size', file.fileSize);
			//xhr.setRequestHeader('Content-Type', 'multipart/form-data');
			xhr.setRequestHeader('Content-Type', file.type);
			_send.call(this, file);
		};

		xhr.onload = function( load ) {
			loaded = loaded + load.total;
			files.loaded ++;
			onprogress.call(this, {loaded: total, total: total});
			files.loaded == files.length && s.completeall.call(form, {total: total, loaded: loaded}, xhr);
		};
		
		var onprogress = xhr.upload.onprogress = function( progress ) {
			var params = [
				{
					total: total,		
					loaded: loaded + progress.loaded
				},
				xhr
			];
			s.progress.apply(form, params);
			$(data.elem).trigger('progress', params);
		};
		
		$.ajax(s);
	});

}


function iframeUpload( form, s ) {
    var // cache original form attributes
        _attr = {
            target: form.target,
            enctype: form.enctype,
            method: form.method,
            action: form.action
        },
        attr = {
            target: 'file-upload-' + timestamp++, 
            enctype: 'multipart/form-data', 
            method: 'POST',
            action: s.url || form.action            
        },
        $f = $(form),
        $iframe,
        $ajaxData;

    // mock request header types
    var types = {
        'content-type': s.dataType,
        'Last-Modified': null,
        Etag: null
    };

    // mock xhr object
    var xhr = { 
        responseText: null,
        responseXML: null,
        status: 0,
        readyState: 0,
        statusText: '',
        getAllResponseHeaders: $.noop,
        setRequestHeader: $.noop,
        open: function(type, url, async) {
            // create iframe
            $iframe = $('<iframe name="'+attr.target+'" style="display: none;" src="javascript:;"/>').load(onload).insertAfter(form);
            // change form attr to submit in to the iframe and ensure other attr are correct
            $f.attr(attr);
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
            $f.submit();
        },
        getResponseHeader: function(type) {
            return types[type];                 
        },
        abort: close
    };	
    
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

        xhr.onreadystatechange();
        close();
    }   
    
    function close() {
        $f.attr(_attr); 
         
        // by removing iframe without delay FF still shows loading indicator
        setTimeout($iframe.remove, 500);
    };
    
    $.ajax(s);
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


})(jQuery, this);
