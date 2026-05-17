<?php

use Illuminate\Support\Facades\Route;

// SPA catch-all — serve the React build for every non-API, non-storage route
Route::get('/{any}', function () {
    return file_get_contents(public_path('index.html'));
})->where('any', '^(?!storage).*$');
