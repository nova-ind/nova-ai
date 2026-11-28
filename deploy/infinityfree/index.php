<?php
/**
 * Nova AI — InfinityFree fallback redirect.
 *
 * Agar .htaccess se 301 redirect na chala (kuch shared hosts mod_rewrite band karte hain),
 * to ye file 302 + meta-refresh se Render live app par bhej degi.
 *
 * Upload: File Manager → htdocs → index.php
 */

$target = 'https://nova-ai-9gbh.onrender.com/';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if ($path && $path !== '/' && $path !== '/index.php') {
    $target .= ltrim($path, '/');
}

header('Location: ' . $target, true, 302);
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=<?= htmlspecialchars($target, ENT_QUOTES, 'UTF-8') ?>">
  <title>Nova AI</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0b0b10; color: #e9e9f2; display: grid; place-items: center; height: 100vh; margin: 0; }
    a { color: #7c5cff; }
  </style>
</head>
<body>
  <p>Nova AI par ja rahe hain… <a href="<?= htmlspecialchars($target, ENT_QUOTES, 'UTF-8') ?>">Open Nova AI</a></p>
</body>
</html>
