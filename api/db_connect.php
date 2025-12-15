<?php
$host = 'localhost';
$db   = 'gmcentral_happyness';
$user = 'gmcentral_gmcentral';
$pass = 'vvKqRqrHNpE5';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// Garante que a tabela existe (Auto-migration)
$tableCheck = $pdo->query("SHOW TABLES LIKE 'game_state'");
if ($tableCheck->rowCount() == 0) {
    $sql = "CREATE TABLE game_state (
        id INT PRIMARY KEY,
        data LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )";
    $pdo->exec($sql);
    
    // Insere o estado inicial se estiver vazio
    $defaultState = json_encode([
        "status" => "setup",
        "mode" => "quiz",
        "leaderboardType" => "general",
        "currentQuestionIndex" => 0,
        "questionStartTime" => 0,
        "questions" => [],
        "currentVotes" => [],
        "players" => [],
        "settings" => [
            "logo" => "",
            "background" => "",
            "welcomeMsg" => "🎉 BEM-VINDO À FESTA! 🎉"
        ]
    ]);
    
    $stmt = $pdo->prepare("INSERT INTO game_state (id, data) VALUES (1, ?)");
    $stmt->execute([$defaultState]);
}
?>