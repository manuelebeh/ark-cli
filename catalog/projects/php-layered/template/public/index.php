<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use App\Controller\HelloController;

(new HelloController())->handle();
