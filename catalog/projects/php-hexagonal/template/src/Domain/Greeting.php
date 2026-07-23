<?php

declare(strict_types=1);

namespace App\Domain;

final class Greeting
{
    public function __construct(public readonly string $text)
    {
    }
}
