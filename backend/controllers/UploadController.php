<?php
declare(strict_types=1);

/** SUPERADMIN only — image uploads for menu items and the cafe logo. */
final class UploadController
{
    private const MIME_EXT = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];

    /** POST /api/uploads (multipart/form-data, field "file") */
    public function store(Request $request): void
    {
        $file = $request->files['file'] ?? null;
        if (!$file || !is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw HttpException::validation(['file' => ['Please choose an image to upload.']]);
        }
        $cfg = Config::get('uploads');
        if ($file['size'] > $cfg['max_bytes']) {
            throw HttpException::validation(['file' => ['The image may not be larger than 2 MB.']]);
        }
        // Detect the real type from file contents — never trust the client-provided name/type.
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        if (!isset(self::MIME_EXT[$mime]) || @getimagesize($file['tmp_name']) === false) {
            throw HttpException::validation(['file' => ['Only JPG, PNG or WEBP images are allowed.']]);
        }

        $dir = $cfg['path'] . '/' . date('Y/m');
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new RuntimeException('Unable to create upload directory');
        }
        $name = bin2hex(random_bytes(16)) . '.' . self::MIME_EXT[$mime];
        if (!move_uploaded_file($file['tmp_name'], "{$dir}/{$name}")) {
            throw new RuntimeException('Unable to store the uploaded file');
        }
        $relative = '/uploads/' . date('Y/m') . '/' . $name;
        AuditLog::record($request->userId(), 'FILE_UPLOADED', "Uploaded image {$relative}", 'upload');
        Response::created([
            'path' => $relative,
            'url'  => rtrim(Config::get('app.url'), '/') . $relative,
        ], 'Image uploaded');
    }
}
