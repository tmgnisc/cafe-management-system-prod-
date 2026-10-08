<?php
declare(strict_types=1);

/**
 * Small rule-based validator.
 *
 *   $clean = Validator::validate($input, [
 *       'name'  => 'required|string|max:100',
 *       'email' => 'required|email',
 *       'price' => 'required|numeric|min:0',
 *       'role'  => 'required|in:SUPERADMIN,STAFF',
 *       'phone' => 'nullable|string|max:30',
 *       'sort'  => 'sometimes|integer',
 *   ]);
 *
 * Returns only validated keys (trimmed/cast). Throws HttpException 422 with
 * field => [messages] on failure.
 */
final class Validator
{
    public static function validate(array $data, array $rules, string $prefix = ''): array
    {
        $errors = [];
        $clean = [];

        foreach ($rules as $field => $ruleString) {
            $fieldRules = is_array($ruleString) ? $ruleString : explode('|', $ruleString);
            $present = array_key_exists($field, $data);
            $value = $present ? $data[$field] : null;
            if (is_string($value)) {
                $value = trim($value);
            }
            $label = str_replace('_', ' ', $field);
            $key = $prefix . $field;

            $isEmpty = $value === null || $value === '' || (is_array($value) && $value === []);

            if (in_array('sometimes', $fieldRules, true) && !$present) {
                continue;
            }
            if (in_array('required', $fieldRules, true) && $isEmpty) {
                $errors[$key][] = "The {$label} field is required.";
                continue;
            }
            if ($isEmpty) {
                if ($present || in_array('nullable', $fieldRules, true)) {
                    $clean[$field] = in_array('array', $fieldRules, true) && is_array($value) ? [] : null;
                }
                continue;
            }

            foreach ($fieldRules as $rule) {
                [$name, $param] = array_pad(explode(':', $rule, 2), 2, null);
                $error = null;

                switch ($name) {
                    case 'string':
                        if (!is_string($value) && !is_int($value) && !is_float($value)) {
                            $error = "The {$label} must be text.";
                        } else {
                            $value = (string) $value;
                        }
                        break;
                    case 'email':
                        if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                            $error = "The {$label} must be a valid email address.";
                        } else {
                            $value = strtolower((string) $value);
                        }
                        break;
                    case 'integer':
                        if (filter_var($value, FILTER_VALIDATE_INT) === false) {
                            $error = "The {$label} must be a whole number.";
                        } else {
                            $value = (int) $value;
                        }
                        break;
                    case 'numeric':
                        if (!is_numeric($value)) {
                            $error = "The {$label} must be a number.";
                        } else {
                            $value = (float) $value;
                        }
                        break;
                    case 'boolean':
                        $b = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                        if ($b === null) {
                            $error = "The {$label} must be true or false.";
                        } else {
                            $value = $b;
                        }
                        break;
                    case 'array':
                        if (!is_array($value)) {
                            $error = "The {$label} must be a list.";
                        }
                        break;
                    case 'in':
                        $options = explode(',', (string) $param);
                        if (!in_array((string) $value, $options, true)) {
                            $error = "The selected {$label} is invalid.";
                        }
                        break;
                    case 'min':
                        if (is_string($value) && !is_numeric($value) || in_array('string', $fieldRules, true)) {
                            if (mb_strlen((string) $value) < (int) $param) $error = "The {$label} must be at least {$param} characters.";
                        } elseif (is_array($value)) {
                            if (count($value) < (int) $param) $error = "The {$label} must have at least {$param} items.";
                        } elseif ((float) $value < (float) $param) {
                            $error = "The {$label} must be at least {$param}.";
                        }
                        break;
                    case 'max':
                        if (is_string($value) && !is_numeric($value) || in_array('string', $fieldRules, true)) {
                            if (mb_strlen((string) $value) > (int) $param) $error = "The {$label} may not be greater than {$param} characters.";
                        } elseif (is_array($value)) {
                            if (count($value) > (int) $param) $error = "The {$label} may not have more than {$param} items.";
                        } elseif ((float) $value > (float) $param) {
                            $error = "The {$label} may not be greater than {$param}.";
                        }
                        break;
                    case 'date':
                        $d = DateTimeImmutable::createFromFormat('!Y-m-d', (string) $value);
                        if (!$d || $d->format('Y-m-d') !== $value) {
                            $error = "The {$label} must be a date (YYYY-MM-DD).";
                        }
                        break;
                    case 'password':
                        if (mb_strlen((string) $value) < 8 || !preg_match('/[A-Za-z]/', (string) $value) || !preg_match('/\d/', (string) $value)) {
                            $error = "The {$label} must be at least 8 characters and contain letters and numbers.";
                        }
                        break;
                    case 'confirmed':
                        if (($data[$field . '_confirmation'] ?? null) !== $data[$field]) {
                            $error = "The {$label} confirmation does not match.";
                        }
                        break;
                    case 'regex':
                        if (!preg_match((string) $param, (string) $value)) {
                            $error = "The {$label} format is invalid.";
                        }
                        break;
                }

                if ($error !== null) {
                    $errors[$key][] = $error;
                    break;
                }
            }

            if (!isset($errors[$key])) {
                $clean[$field] = $value;
            }
        }

        if ($errors) {
            throw HttpException::validation($errors);
        }
        return $clean;
    }
}
