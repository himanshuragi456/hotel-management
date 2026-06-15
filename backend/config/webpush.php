<?php

/*
|--------------------------------------------------------------------------
| Web Push (VAPID) configuration
|--------------------------------------------------------------------------
|
| VAPID identifies our server to the browser push services (Apple / Google).
| The public key is sent to the browser to create a subscription; the private
| key signs outgoing pushes and must stay secret (backend .env only).
|
*/

return [
    'subject'     => env('VAPID_SUBJECT', 'mailto:admin@magicmanagement.in'),
    'public_key'  => env('VAPID_PUBLIC_KEY'),
    'private_key' => env('VAPID_PRIVATE_KEY'),
];
