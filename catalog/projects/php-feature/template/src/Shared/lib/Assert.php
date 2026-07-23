<?php

declare(strict_types=1);

namespace App\Shared\lib;

final class Assert
{
    public static function true(bool $value, string $message = 'assertion failed'): void
    {
        if (!$value) {
            throw new \InvalidArgumentException($message);
        }
    }
}
