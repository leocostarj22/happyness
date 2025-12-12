<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$file = 'data.json';

// Se o arquivo não existir, retorna erro ou cria um padrão
if (!file_exists($file)) {
    echo json_encode(["error" => "No data found"]);
    exit;
}

// Lê o arquivo e retorna o JSON para o jogo
echo file_get_contents($file);
?>