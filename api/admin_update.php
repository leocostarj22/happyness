<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

// 1. Recebe os novos dados do Admin
$json = file_get_contents('php://input');
$newData = json_decode($json, true);

if (!$newData) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON"]);
    exit;
}

$file = 'data.json';

// 2. Salva no arquivo de forma segura (Lock)
$fp = fopen($file, 'w');
if (flock($fp, LOCK_EX)) {
    fwrite($fp, json_encode($newData, JSON_PRETTY_PRINT));
    flock($fp, LOCK_UN);
    echo json_encode(["success" => true]);
} else {
    http_response_code(500);
    echo json_encode(["error" => "Could not lock file"]);
}
fclose($fp);
?>