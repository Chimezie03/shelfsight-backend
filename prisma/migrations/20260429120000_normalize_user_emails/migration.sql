-- Task 5: normalize stored emails (trim + lowercase) for consistent unique matching.
UPDATE "User" SET email = lower(trim(email));
