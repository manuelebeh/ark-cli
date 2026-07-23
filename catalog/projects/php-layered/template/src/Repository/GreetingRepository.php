<?php

declare(strict_types=1);

namespace App\Repository;

use App\Model\Greeting;

final class GreetingRepository
{
    public function find(string $name): Greeting
    {
        return new Greeting(text: 'Hello, ' . $name);
    }
}
