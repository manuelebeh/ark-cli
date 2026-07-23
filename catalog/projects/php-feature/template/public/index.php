<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use App\Features\Greet\Action;

echo (new Action())->run('world') . PHP_EOL;
