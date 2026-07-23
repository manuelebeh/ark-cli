<?php

declare(strict_types=1);

namespace App\Service;

use App\Model\Greeting;
use App\Repository\GreetingRepository;

final class GreetService
{
    public function greet(string $name): string
    {
        $greeting = (new GreetingRepository())->find($name);
        return $greeting->text;
    }
}
