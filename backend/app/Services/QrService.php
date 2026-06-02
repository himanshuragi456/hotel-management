<?php

namespace App\Services;

use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

/**
 * Generates QR codes as SVG data URIs using bacon-qr-code's pure-PHP SVG backend.
 *
 * We avoid simple-qrcode's PNG output because that path requires the imagick PHP
 * extension, which isn't available on our shared Apache host (no root). SVG renders
 * with the bundled php-svg-lib, so DomPDF embeds it fine via an <img> data URI.
 */
class QrService
{
    /**
     * Build an SVG QR for the given content and return it as a base64 data URI
     * suitable for <img src="..."> inside a DomPDF view.
     */
    public static function svgDataUri(string $content, int $size = 120): string
    {
        $renderer = new ImageRenderer(
            new RendererStyle($size),
            new SvgImageBackEnd()
        );

        $svg = (new Writer($renderer))->writeString($content);

        return 'data:image/svg+xml;base64,' . base64_encode($svg);
    }
}
