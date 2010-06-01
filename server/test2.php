<?php 
echo "A\n";

exit;

cc_Ajax_Upload::handleUpload();
echo "A\n";

class cc_Ajax_Upload
{
    public static $tmpfile = false;

    public static function handleUpload()
    {
echo "0\n";
        //register_shutdown_function(array('cc_Ajax_Upload', 'shutdown'));
echo "1\n";

        $headers = getallheaders();
        if(!(
	        // basic checks
        	isset(
        		$headers['Content-Type'],
        		$headers['Content-Length'],
        		$headers['X-File-Size'],
        		$headers['X-File-Name']
        	) &&
        	$headers['Content-Length'] === $headers['X-File-Size']
        )){
            exit('Error');
        }
echo "A\n";
        $maxSize = 80 * 1024 * 1024;

        if (false === self::$tmpfile = tempnam('tmp', 'upload_')) {
            exit(json_encode(array(
                'status' => 'error',
                'filename' => 'temp file not possible'
            )));
        }
echo "A\n";

        $fho = fopen(self::$tmpfile, 'w');
        $fhi = fopen('php://input', 'r');
        $tooBig = ($maxSize <= stream_copy_to_stream($fhi, $fho, $maxSize));
echo "A\n";

        if ($tooBig) {
            exit(json_encode(array(
                'status' => 'error',
                'filename' => 'upload too big'
            )));
        }
echo "A\n";

        exit(json_encode(array(
            'status' => 'success',
            'filename' => $headers['X-File-Name']
        )));
    }

    public static function shutdown()
    {
        if ((false !== self::$tmpfile) && is_file(self::$tmpfile)) {
            unlink(self::$tmpfile);
        }
    }
}
