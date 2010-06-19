<?php
 if (is_uploaded_file($_FILES['Filedata']['tmp_name'])){
  $pathinfo = pathinfo($_SERVER['PHP_SELF']);
  $dir =  $pathinfo['dirname'];
  $path = $_SERVER['DOCUMENT_ROOT'] . $dir . '/files/';
	$uploadFile=$path.basename($_FILES['Filedata']['name']);
	copy($_FILES['Filedata']['tmp_name'], $uploadFile);
  exit(json_encode(array(
    'status' => 'success',
    'filename' => $_FILES['Filedata']['name'],
    'total' => $_FILES['Filedata']['size']
  )));
 }
?> 
