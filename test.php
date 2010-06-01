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
	) &&
	$headers['Content-Type'] === 'multipart/form-data' &&
	$headers['Content-Length'] === $headers['X-File-Size']
){
	// create the object and assign property
	$file = new stdClass;
	$file->name = basename($headers['X-File-Name']);
	$file->size = $headers['X-File-Size'];
	$file->content = file_get_contents("php://input");
	
	
	// if everything is ok, save the file somewhere
	if(file_put_contents($path . $file->name, $file->content))
		exit(json_encode(array(
			'status' => 'success',
			'filename' => $file->name
		)));
}

// if there is an error this will be the output instead of "OK"
exit('Error');

?>