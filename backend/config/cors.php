<?php

/*
|--------------------------------------------------------------------------
| Cross-Origin Resource Sharing (CORS) Configuration
|--------------------------------------------------------------------------
|
| Origins are locked to our own front-ends. Override per-environment with the
| CORS_ALLOWED_ORIGINS env var (comma-separated). The hardcoded defaults are
| the production domains so a missing/blank env var still stays locked down
| rather than falling back to "*".
|
| Auth is JWT in the Authorization header (not cookies), so credentials are
| not shared cross-origin and `supports_credentials` stays false.
|
*/

$origins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))
)));

if (empty($origins)) {
    $origins = [
        'https://magicmanagement.in',
        'https://tables.magicmanagement.in',
    ];
}

return [

    'paths' => ['api/*', 'webhooks/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => $origins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 86400,

    'supports_credentials' => false,

];
