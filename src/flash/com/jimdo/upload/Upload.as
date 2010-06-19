/* 
@credits Moxiecode Systems AB
*/

package com.jimdo.upload {
  	
  import flash.display.Sprite;
  	import flash.display.MovieClip;
	import flash.display.StageAlign;
	import flash.display.StageScaleMode;
	import flash.net.FileReferenceList;
	import flash.net.FileReference;
  import flash.net.FileFilter;
  	import flash.events.Event;
  import flash.events.MouseEvent;
	import flash.events.FocusEvent;
  import flash.events.ProgressEvent;
  import flash.events.DataEvent;
  import flash.events.SecurityErrorEvent;
  import flash.events.IOErrorEvent;
  import flash.external.ExternalInterface;
  import flash.utils.Dictionary;

  
  public class Upload extends Sprite {
    
    private var clickArea:MovieClip;
    private var fileRefList:FileReferenceList;
		private var files:Dictionary;
    private var fileRef:FileReference;
    private var id:String;
    private var callbackName:String;
    private var fileFilters:String;
    private var multipleFiles:Boolean;
    
    private var idCounter:int = 0;
    private var currentFile:File;
    
    
    public function Upload():void {
      addEventListener(Event.ADDED_TO_STAGE, init);
    }
    
    private function init(e:Event = null):void {
      removeEventListener(Event.ADDED_TO_STAGE, init);
      this.id = this.stage.loaderInfo.parameters["id"];
      this.fileFilters = this.stage.loaderInfo.parameters["filters"];
      this.multipleFiles = !!('true' == this.stage.loaderInfo.parameters["multiple"]);
      this.callbackName = this.stage.loaderInfo.parameters["callbackName"];
      
      // Setup file reference list
			this.fileRefList = new FileReferenceList();
			this.fileRefList.addEventListener(Event.CANCEL, cancelEvent);
			this.fileRefList.addEventListener(Event.SELECT, selectEvent);

			this.fileRef = new FileReference();
			this.fileRef.addEventListener(Event.CANCEL, cancelEvent);
			this.fileRef.addEventListener(Event.SELECT, selectEvent);
      this.files = new Dictionary();
      
      // Align and scale stage
			this.stage.align = StageAlign.TOP_LEFT;
			this.stage.scaleMode = StageScaleMode.NO_SCALE;
      // Add something to click on
			this.clickArea = new MovieClip();
			this.clickArea.graphics.beginFill(0xFF0000, 0); // Fill with transparent color
			this.clickArea.graphics.drawRect(0, 0, 1024, 1024);
			this.clickArea.x = 0;
			this.clickArea.y = 0;
			this.clickArea.width = 1024;
			this.clickArea.height = 1024;
			this.clickArea.graphics.endFill();
			this.clickArea.buttonMode = true;
			this.clickArea.useHandCursor = true;
			addChild(this.clickArea);
      this.clickArea.addEventListener(MouseEvent.MOUSE_OVER, this.stageEvent);
      this.clickArea.addEventListener(MouseEvent.MOUSE_OUT, this.stageEvent);
			this.clickArea.addEventListener(FocusEvent.FOCUS_IN,this.stageEvent);
      this.clickArea.addEventListener(FocusEvent.FOCUS_OUT,this.stageEvent);
      this.clickArea.addEventListener(MouseEvent.CLICK, this.stageClickEvent);

			ExternalInterface.addCallback('flashUploaderSendFile', this.uploadFile);
      ExternalInterface.addCallback('flashUploaderClearQueue', this.clearFiles);
      ExternalInterface.addCallback('flashUploaderRemoveFile', this.removeFile);
      ExternalInterface.addCallback('flashUploaderCancelFileUpload', this.cancelFileUpload);
      this.fireEvent("init");
    }
    
    private function uploadFile(id:String, url:String, settings:Object):void {
      	var file:File = this.files[id] as File;
      if (file) {
				this.currentFile = file;
				file.upload(url, settings);
			}
    }
    
    private function cancelFileUpload(id:String):void {
      	var file:File = this.files[id] as File;
      file && file.cancelUpload();
    }
    
    private function stageEvent(e:Event):void {
      this.fireEvent(e.type);
    }
    
    private function clearFiles():void {
			this.files = new Dictionary();
		}
    
    /**
    * removing file from the files Dictionary
    * and returning new files list
    */
    private function removeFile(id:String):Array {
      var newFilesList:Array = []; 
			if (this.files[id] != null)
        delete this.files[id];
      for (id in this.files) {
        var file:File = this.files[id];
        newFilesList.push({id : file.id, name : file.fileName, size : file.size, loaded : 0});
      }
      return newFilesList;
		}

		private function cancelEvent(e:Event):void {
			this.fireEvent("cancelselect");
		}
    
    private function selectEvent(e:Event):void {
      var selectedFiles:Array = [], files:Dictionary = this.files;
      
      function processFile(file:File):void {
        
        file.addEventListener(Event.OPEN, function(e:Event):void {
          fireEvent("uploadstart", {
            fileId : file.id
          });
        });
        file.addEventListener(ProgressEvent.PROGRESS, function(e:ProgressEvent):void {          
					var file:File = e.target as File;
					fireEvent("uploadprogress", {
						fileId : file.id,
						loaded : e.bytesLoaded,
						size : e.bytesTotal
					});
				});
        file.addEventListener(Event.COMPLETE, function(e:Event):void {
          fireEvent("uploadcomplete", {
            fileId : file.id, 
            total: e.target.size
          });
        });
        file.addEventListener(DataEvent.UPLOAD_COMPLETE_DATA, function(e:DataEvent):void {
					fireEvent("uploadcompletedata", {
						fileId : file.id,
            total: e.target.size,
						text : e.text
					});
				});
        file.addEventListener(IOErrorEvent.IO_ERROR, function(e:IOErrorEvent):void {
          fireEvent("uploaderror", {
            fileId : file.id,
            text: e.text
          });
        });
        files[file.id] = file;	
        selectedFiles.push({id : file.id, name : file.fileName, size : file.size, loaded : 0});
      }
      
      if (this.multipleFiles) {
        for (var i:Number = 0; i < this.fileRefList.fileList.length; i++) {
          var file:File = new File("file_" + (this.idCounter++), this.fileRefList.fileList[i]);
          processFile(file);
        }
      } else { 
        processFile(new File("file_" + (this.idCounter++), this.fileRef));
      }
      
      this.fireEvent("selectfiles", selectedFiles);
    }
    
    private function stageClickEvent(e:Event):void {
      this.fireEvent("click");
      try {
        var refBrowse:Object = (this.multipleFiles) ? this.fileRefList : this.fileRef;
        if (this.fileFilters) {
          var fileFilter:FileFilter = new FileFilter("Images",'*.' + this.fileFilters.replace(/,/g, ";*."));
          refBrowse.browse([fileFilter])
        } else {
          refBrowse.browse();
        }
      } catch(ex:Error) {
        this.fireEvent("selecterror", ex.message);
      }
    }
    
    /**
		 * Fires an event from the flash movie out to the page level JS.
		 *
		 * @param type Name of event to fire.
		 * @param obj Object with optional data.
		 */
		private function fireEvent(type:String, data:Object = null):void {
      ExternalInterface.call((<![CDATA[
        function(callbackName, callbackData) {
          if (typeof window[callbackName] != 'function') {
            throw ("No flashUploader callback defined with following name: '" + callbackName +"'");            
          }
          window[callbackName](callbackData);
        }
      ]]>).toString(), this.callbackName, { id: this.id, type: type, data: data });
		}

  }
  
}

// Helper File class

import flash.events.EventDispatcher;
import flash.net.FileReference;
import flash.events.Event;
import flash.events.IOErrorEvent;
import flash.events.ProgressEvent;
import flash.events.DataEvent;
import flash.events.SecurityErrorEvent;
import flash.external.ExternalInterface;
import flash.net.URLRequest;
import flash.net.URLVariables;
import flash.net.URLRequestMethod;

class File extends EventDispatcher {
  private var _id:String, _fileName:String, _size:uint, _fileRef:FileReference;

  public function get id():String {
			return this._id;
  }
  
  public function get fileName():String {
    return this._fileName;
  }
  
  public function set fileName(value:String):void {
    this._fileName = value;
  }
  
  public function get size():int {
    return this._size;
	}

  public function File(id:String, file_ref:FileReference) {
    this._id = id;
    this._fileRef = file_ref;
    this._size = file_ref.size;
    this._fileName = file_ref.name;
  }
  
  public function upload(url:String, settings:Object):void {
    var file:File = this;
    for each (var evt:String in [
      Event.OPEN, 
      Event.COMPLETE, 
      IOErrorEvent.IO_ERROR,
      ProgressEvent.PROGRESS,
      DataEvent.UPLOAD_COMPLETE_DATA,
      SecurityErrorEvent.SECURITY_ERROR ]){
      
        this._fileRef.addEventListener(evt, function(e:Event):void {
          file.dispatchEvent(e);
        });
    }

    /* Simple Upload */
    /* No Custom Header - doesn't support cookies. */
    
    var request:URLRequest = new URLRequest(url);
    request.method = URLRequestMethod.POST;
    var variables:URLVariables = new URLVariables();
    if (settings && typeof settings.params == 'object') {
      for (var name:String in settings.params) {
        variables[name] = settings.params[name];
      }
    }
    request.data = variables;
    this._fileRef.upload(request, "Filedata");
  }
  
  public function cancelUpload():void {
    this._fileRef.cancel();	
  }
}
