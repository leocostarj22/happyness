<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

$file = 'data.json';

// Se o arquivo não existir, retorna erro ou cria um padrão
if (!file_exists($file)) {
    echo json_encode(["error" => "No data found"]);
    exit;
}

// Lê o arquivo, adiciona o timestamp do servidor e retorna
$content = file_get_contents($file);
$data = json_decode($content, true);

if ($data) {
    // Adiciona o tempo atual do servidor (em ms) para sincronização
    $data['serverTime'] = round(microtime(true) * 1000);
    echo json_encode($data);
} else {
    // Se falhar o decode, retorna o conteúdo original (fallback)
    echo $content;
}
?>