<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ImageConversionService
{
    /**
     * Store an uploaded image converted to WebP. Falls back to storing the
     * original file untouched if the server's GD build lacks WebP support
     * or the source can't be decoded (e.g. an already-corrupt upload).
     */
    public static function toWebp(UploadedFile $file, string $directory, string $disk = 'public'): string
    {
        if (!function_exists('imagewebp')) {
            return $file->store($directory, $disk);
        }

        $image = self::decode($file);
        if (!$image) {
            return $file->store($directory, $disk);
        }

        imagepalettetotruecolor($image);
        imagealphablending($image, true);
        imagesavealpha($image, true);

        $tmpPath = tempnam(sys_get_temp_dir(), 'webp');
        $ok = imagewebp($image, $tmpPath, 82);
        imagedestroy($image);

        if (!$ok) {
            @unlink($tmpPath);
            return $file->store($directory, $disk);
        }

        $contents = file_get_contents($tmpPath);
        @unlink($tmpPath);

        $path = trim($directory, '/') . '/' . Str::random(40) . '.webp';
        Storage::disk($disk)->put($path, $contents);

        return $path;
    }

    private static function decode(UploadedFile $file)
    {
        $path = $file->getRealPath();

        return match ($file->getMimeType()) {
            'image/jpeg' => @imagecreatefromjpeg($path),
            'image/png'  => @imagecreatefrompng($path),
            'image/gif'  => @imagecreatefromgif($path),
            'image/webp' => @imagecreatefromwebp($path),
            'image/bmp', 'image/x-ms-bmp' => function_exists('imagecreatefrombmp') ? @imagecreatefrombmp($path) : false,
            default => false,
        } ?: null;
    }
}
