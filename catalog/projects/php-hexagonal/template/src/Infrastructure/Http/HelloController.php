<?php

declare(strict_types=1);

namespace App\Infrastructure\Http;

use App\Application\Greet;

final class HelloController
{
    public function handle(): void
    {
        $greeting = (new Greet())->execute('world');
        echo $greeting->text . PHP_EOL;
    }
}
