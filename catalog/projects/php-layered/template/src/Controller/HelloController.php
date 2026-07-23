<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\GreetService;

final class HelloController
{
    public function handle(): void
    {
        $message = (new GreetService())->greet('world');
        echo $message . PHP_EOL;
    }
}
