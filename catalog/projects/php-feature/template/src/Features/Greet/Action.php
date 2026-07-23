<?php

declare(strict_types=1);

namespace App\Features\Greet;

final class Action
{
    public function run(string $name): string
    {
        return 'Hello, ' . $name;
    }
}
