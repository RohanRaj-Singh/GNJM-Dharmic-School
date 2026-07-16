<?php

namespace App\Services;

/**
 * Value object representing the result of a lifecycle validation check.
 */
final class ValidationResult
{
    public function __construct(
        public readonly bool $allowed,
        public readonly array $warnings = [],
    ) {}

    public static function allowed(array $warnings = []): self
    {
        return new self(true, $warnings);
    }

    public static function denied(string ...$warnings): self
    {
        return new self(false, $warnings);
    }
}
