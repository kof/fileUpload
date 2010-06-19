<?php 
$pathinfo = pathinfo($_SERVER['PHP_SELF']);

$dir =  $pathinfo['dirname'];

$path = $_SERVER['DOCUMENT_ROOT'] . $dir . '/files/';

$headers = getallheaders();
if(
	// basic checks
	isset(
		$headers['Content-Type'],
		$headers['Content-Length'],
		$headers['X-File-Size'],
		$headers['X-File-Name']
	) 
){
  try {
    // create the object and assign property
    $file = new stdClass;
    $file->name = basename($headers['X-File-Name']);
    $file->size = $headers['X-File-Size'];
    $file->handle = fopen($path . $file->name,'wb');
    $stream = fopen('php://input','r');
    while(!feof($stream)) {
      set_time_limit(0);
      $content = fread($stream, 1024);
      fwrite($file->handle,$content, strlen($content));
    }
    fclose($stream);
    fclose($file->handle);
    exit(json_encode(array(
      'status' => 'success',
      'filename' => $file->name
    )));
  } catch (Exception $e) {
    exit ('Error' . $e->getMessage());
  }
}

// if there is an error this will be the output instead of "OK"
exit('Error');

?>