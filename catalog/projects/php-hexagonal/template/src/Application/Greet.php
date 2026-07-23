<?php

declare(strict_types=1);

namespace App\Application;

use App\Domain\Greeting;

final class Greet
{
    public function execute(string $name): Greeting
    {
        return new Greeting(text: 'Hello, ' . $name);
    }
}
